// ─────────────────────────────────────────────────────────────────────────────
// Conversation Framework — voice learning, memory, brevity, anti-mechanical
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const VOICE_FILE = path.join(__dirname, 'voice_profile.json');
const MEMORY_FILE = path.join(__dirname, 'conversation_memory.json');

// ── Voice profile: incrementally learns Barron's writing style ────────────────
function loadVoice() {
  try { return JSON.parse(fs.readFileSync(VOICE_FILE, 'utf8')); }
  catch {
    return {
      samples: [],         // Recent Barron messages (rolling window)
      profile: null,       // Synthesized style description
      lastUpdate: 0,
      sampleCount: 0
    };
  }
}
function saveVoice(v) { fs.writeFileSync(VOICE_FILE, JSON.stringify(v, null, 2)); }

// Add a Barron message to the voice samples (keep last 80, dedupe)
function recordBarronMessage(text) {
  if (!text || text.length < 4 || text.length > 500) return;
  // Filter out commands/system messages
  const lower = text.toLowerCase().trim();
  if (lower.startsWith('@') || lower.startsWith('http')) return;
  if (['status','show tasks','daily briefing','test stale','test n2m','bitable status'].includes(lower)) return;

  const v = loadVoice();
  if (v.samples.includes(text)) return;
  v.samples.push(text);
  if (v.samples.length > 80) v.samples = v.samples.slice(-80);
  v.sampleCount = v.samples.length;
  saveVoice(v);
}

// Synthesize voice profile from samples (run periodically)
async function updateVoiceProfile(openai) {
  const v = loadVoice();
  if (v.samples.length < 5) return null; // need minimum samples
  if (Date.now() - v.lastUpdate < 6 * 3600 * 1000) return v.profile; // refresh every 6h

  const sampleText = v.samples.slice(-50).map((s,i) => `${i+1}. ${s}`).join('\n');

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 350,
    messages: [{
      role: 'user',
      content: `Analyze these messages from Barron Zuo (an entrepreneur/operations director). Extract his writing style as a concise voice guide for an AI assistant to mimic. Focus on:
- Sentence length (typical: short/medium/long)
- Tone (formal/casual/direct/friendly)
- Common patterns/phrases
- Language mix (English-only / Chinese-only / mixed?)
- Punctuation style
- Emoji usage

Output as a 5-line bullet list only. NO preamble.

Messages:
${sampleText}`
    }]
  });

  const profile = res.choices[0].message.content.trim();
  v.profile = profile;
  v.lastUpdate = Date.now();
  saveVoice(v);
  return profile;
}

function getVoiceProfile() {
  return loadVoice().profile;
}

// ── Conversation memory: last N messages per chat ─────────────────────────────
function loadMemory() {
  try { return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8')); }
  catch { return {}; }
}
function saveMemory(m) { fs.writeFileSync(MEMORY_FILE, JSON.stringify(m, null, 2)); }

function recordTurn(chatId, role, content, senderName) {
  const m = loadMemory();
  if (!m[chatId]) m[chatId] = [];
  m[chatId].push({
    role, // 'user' or 'assistant'
    content: content.slice(0, 600),
    sender: senderName || '',
    ts: Date.now()
  });
  // Keep last 12 turns per chat
  if (m[chatId].length > 12) m[chatId] = m[chatId].slice(-12);
  saveMemory(m);
}

function getRecentTurns(chatId, n = 6) {
  const m = loadMemory();
  return (m[chatId] || []).slice(-n);
}

// ── Anti-mechanical phrase filter ─────────────────────────────────────────────
const MECHANICAL_PATTERNS = [
  /^(I understand|I see|I can help|Let me help|Sure[,.!]|Of course[,.!]|Certainly[,.!])/i,
  /^(好的[，,。！])/, /^(明白了[，,。！])/, /^(没问题[，,。！])/, /^(当然[，,。！])/,
  /^(I'd be happy to|I'll be glad to|Happy to help)/i,
  /^(That's a great question|Good question)/i,
  /^(Based on the information provided|According to the data)/i,
  /^(Thank you for[^.]+\.)/i,
  /^(很高兴|非常感谢)/
];

function stripMechanicalOpening(text) {
  if (!text) return text;
  let cleaned = text.trim();
  for (const pattern of MECHANICAL_PATTERNS) {
    if (pattern.test(cleaned)) {
      // Remove the matched phrase and any following whitespace/punctuation
      cleaned = cleaned.replace(pattern, '').trim();
      cleaned = cleaned.replace(/^[，,。！.,!:\s]+/, '').trim();
      break;
    }
  }
  // If first letter is now lowercase, capitalize it
  if (cleaned && /^[a-z]/.test(cleaned)) {
    cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
  }
  return cleaned || text;
}

// ── Build a conversation-aware system prompt ──────────────────────────────────
function buildSystemPrompt(opts) {
  const { context, voice, mode } = opts; // mode: 'concise' | 'detailed' | 'auto-reply'

  const baseRules = `You are Clawdbot, AI ops assistant for Barron Zuo at GoGlobal Accelerator.

CRITICAL RULES — VIOLATING THESE = FAILURE:
1. NEVER start with "I understand", "Sure", "Of course", "好的", "明白了", "Happy to", "That's a great question"
2. Maximum 2-3 sentences for normal questions. ONLY go longer if explicitly asked for a list/details
3. NO preamble, NO recap of the question, NO "based on..." filler
4. Answer the actual question directly in the FIRST sentence
5. If you don't know, say "Not sure — check with X" (5-10 words). Don't pad.
6. Mirror the user's language (EN ↔ ZH). Match their tone (formal/casual)
7. NEVER repeat phrases/sentences from your previous replies in this conversation
8. Use specific data from context when available (numbers, names, dates) — don't be vague`;

  let voiceBlock = '';
  if (voice) {
    voiceBlock = `\n\nBARRON'S WRITING STYLE (mimic for auto-reply, reference for tone):\n${voice}`;
  }

  const modeBlock = {
    concise: '\n\nMODE: ULTRA-CONCISE. 1-2 sentences max. Direct answer only.',
    detailed: '\n\nMODE: Detailed. Use bullet points/structured format when listing items.',
    'auto-reply': '\n\nMODE: AUTO-REPLY AS BARRON. Match his style closely. Sound like a busy founder. 1-2 sentences. Direct.'
  }[mode] || '\n\nMODE: Default — concise but informative (2-3 sentences).';

  return baseRules + voiceBlock + modeBlock + (context ? `\n\nCURRENT CONTEXT:\n${context}` : '');
}

// ── Detect intent: short answer vs detailed ───────────────────────────────────
function classifyMode(text) {
  const t = text.toLowerCase().trim();
  // Detailed mode triggers
  if (/^(list|show|display|generate|give me|帮我|总结|分析|分析一下|列出|生成)/.test(t)) return 'detailed';
  if (/(briefing|report|summary|status|all|every|每个|所有|完整)/.test(t)) return 'detailed';
  // Question requiring brief answer
  if (/^(what|how|when|where|why|is|are|can|does|will|何时|是否|可以|能否|为什么)\s/.test(t)) return 'concise';
  if (t.length < 30) return 'concise';
  return 'auto'; // default
}

module.exports = {
  recordBarronMessage, updateVoiceProfile, getVoiceProfile,
  recordTurn, getRecentTurns,
  stripMechanicalOpening, buildSystemPrompt, classifyMode,
  loadVoice, loadMemory
};
