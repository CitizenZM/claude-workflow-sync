# MOP External Skills Reference Index

> **Purpose**: Lookup-only catalog of external tools, skills, hooks, and patterns NOT installed locally. When a task needs a capability MOP doesn't have, the supervisor/PM reads this file to know where to look.
>
> **Rule**: This file lists candidates only. Nothing here is auto-installed. Each item must be evaluated for fit before adoption — see §17.7 Pattern C (TDD for skill changes) and §0.6 (simplicity first).
>
> **Last curated**: 2026-05-14 from research across `hesreallyhim/awesome-claude-code`, `addyosmani/agent-skills`, `obra/superpowers`, and `multica-ai/andrej-karpathy-skills`.

---

## When to use this index

The PM/supervisor consults this file when ANY of the following occurs:
1. A task needs a capability not in `~/Documents/Claude/config/skills/`
2. An Iron Law violation (§0.5) is detected and existing skills can't fix it
3. A retrospective notes the same gap appearing 2+ times
4. User says "is there a skill for X?"

**Lookup workflow**:
1. Search this file (Ctrl-F or grep) by category or capability
2. Read the linked repo's SKILL.md or README via `gh api` or WebFetch
3. Evaluate against §0.6 simplicity-first — does this replace something existing, or add new noise?
4. If adopting, fork the relevant file into `~/Documents/Claude/config/skills/<name>/` and add a pressure-test scenario per §17.7 Pattern C

---

## Category 1 — Behavioral & Quality Skills

### From obra/superpowers (already integrated as §0.5 Iron Laws; below are skills NOT yet absorbed)

| Skill | What it does | Repo path |
|-------|-------------|-----------|
| `brainstorming` | HARD-GATE pattern — no code until design doc approved | `obra/superpowers/skills/brainstorming` |
| `dispatching-parallel-agents` | Formal contract for fan-out (already in MOP §9 Pattern A but with worked examples) | `obra/superpowers/skills/dispatching-parallel-agents` |
| `executing-plans` | Load written plan → TodoWrite → chain into finishing branch | `obra/superpowers/skills/executing-plans` |
| `finishing-a-development-branch` | Verify tests pass → merge/PR/cleanup decision tree | `obra/superpowers/skills/finishing-a-development-branch` |
| `receiving-code-review` | How to absorb feedback without performative agreement | `obra/superpowers/skills/receiving-code-review` |
| `requesting-code-review` | Dispatch fresh reviewer with BASE_SHA/HEAD_SHA context | `obra/superpowers/skills/requesting-code-review` |
| `writing-plans` | 2-5min task chunks + file-structure map (write for zero-context implementer) | `obra/superpowers/skills/writing-plans` |
| `writing-skills` | TDD applied to skill authoring — pressure scenario → baseline failure → write → pass | `obra/superpowers/skills/writing-skills` |

**Highest value for MOP**: `writing-skills` (formalizes our §17.7 Pattern C); `writing-plans` (improves spec quality for Haiku dispatch).

### From addyosmani/agent-skills (5 genuinely new, 18 are duplicates of installed skills)

| Skill | What it does | Why worth indexing |
|-------|-------------|--------------------|
| `doubt-driven-development` | Adversarial fresh-context review of non-trivial outputs | Catches confident-but-wrong outputs in long sessions — no equivalent installed |
| `interview-me` | One-question-at-a-time until ~95% intent confidence | Collapses the "build me X" gap before code is wasted on wrong target |
| `idea-refine` | Divergent/convergent stress-testing of vague ideas | Already installed locally; addy's version is alternative framing |
| `deprecation-and-migration` | Sunset old code; migrate users safely | Already installed locally |
| `browser-testing-with-devtools` | Live runtime verification via Chrome DevTools MCP | Already installed locally |

**Recommendation**: Adopt `doubt-driven-development` and `interview-me` only. The rest overlap.

Repo: `addyosmani/agent-skills`

---

## Category 1.5 — Browser Stealth / Anti-Detection (added 2026-05-14)

For workflows hitting Cloudflare Turnstile, Google OAuth detection, or other bot-detection. Use when `browser-stealth-recovery` skill is invoked.

| Tool | Solves | Repo | Priority |
|------|--------|------|----------|
| `patchright` (Kaliiiiiiiiii-Vinyzu) | Patches `Runtime.enable` leak in vanilla Playwright (#1 modern Playwright tell). Drop-in replacement. | https://github.com/Kaliiiiiiiiii-Vinyzu/patchright | **CRITICAL** — swap into outreach skills |
| `camoufox` (daijro) | Patched Firefox build, kernel-level fingerprint spoofing. ~0% detect rate on bot-test sites. | https://github.com/daijro/camoufox | **HIGH** — escalation engine when patchright fails |
| `nodriver` (ultrafunkamsterdam) | Successor to undetected-chromedriver. Raw CDP, no Selenium dep. | https://github.com/ultrafunkamsterdam/nodriver | **MEDIUM** — alternative if you want to leave Playwright entirely |
| `SeleniumBase` (seleniumbase) | "UC Mode" handles Turnstile reliably. Heavy framework. | https://github.com/seleniumbase/SeleniumBase | **MEDIUM** — only if a workflow specifically needs Selenium API |
| `Scrapling` (D4Vinci) | Adaptive scraping framework with Camoufox + Playwright fetchers. | https://github.com/D4Vinci/Scrapling | **HIGH** for scrape-only flows (seo-geo-weekly) |

### Cloudflare-specific bypass tools

| Tool | Technique | Cost | Repo | Priority |
|------|-----------|------|------|----------|
| `FlareSolverr` | Docker proxy, headless browser solves CF, returns cookies | Free, self-hosted | https://github.com/FlareSolverr/FlareSolverr | **HIGH** — install on Mac Studio for HTTP-only scraping |
| `playwright-captcha` (techinz) | Click-based Turnstile + 2captcha API fallback. Integrates with Playwright/Patchright/Camoufox. | Free + optional 2captcha | https://github.com/techinz/playwright-captcha | **HIGH** — drop into impact-rockbros runner |
| `CloudflareBypassForScraping` (sarperavci) | DrissionPage + auto-click Turnstile | Free | https://github.com/sarperavci/CloudflareBypassForScraping | **MEDIUM** |
| `Turnstile-Solver` (Theyka) | Patchright-based local solver with HTTP API | Free | https://github.com/Theyka/Turnstile-Solver | **MEDIUM** |
| `CF-Clearance-Scraper` (Xewdy444) | Harvest cf_clearance cookie, reuse across HTTP | Free | https://github.com/Xewdy444/CF-Clearance-Scraper | **MEDIUM** |

### Browser-stealth Claude skills

| Skill | Purpose | Repo | Priority |
|-------|---------|------|----------|
| `claude-code-skill-scrapling` (Cedriccmh) | Auto-picks Scrapling fetcher (HTTP/Playwright/Camoufox), CF bypass built-in | https://github.com/Cedriccmh/claude-code-skill-scrapling | **HIGH** — directly relevant to outreach scrape steps |
| `google-ai-mode-skill` (PleasePrompto) | Persistent Chrome profile pattern for Google services | https://github.com/PleasePrompto/google-ai-mode-skill | **MEDIUM** — read for profile pattern |
| `stealth-browser-mcp` (vibheksoni) | MCP server wrapping a stealth browser | https://github.com/vibheksoni/stealth-browser-mcp | **MEDIUM** — possible alternative to current MCP Playwright servers |
| `camoufox-cli` (Bin-Huang) | CLI + agent skills wrapping Camoufox | https://github.com/Bin-Huang/camoufox-cli | **MEDIUM** |
| `browsers-benchmark` (techinz) | Benchmarks bypass rates across engines | https://github.com/techinz/browsers-benchmark | **MEDIUM** — read once before swapping engines |

### Google OAuth — what actually works

No single repo "solves" Google auth. The proven patterns (in order of reliability):
1. **Persistent profile + one-time manual login** (current approach — KEEP)
2. **OAuth refresh tokens via real desktop client flow** + macOS Keychain storage (current approach for Gmail/Calendar — KEEP)
3. **Patchright + persistent profile** (when fresh login required, ~30-50% success rate)
4. **Cookie export from real Chrome** via `browser_cookie3` Python lib — survives most 2FA gates

---

## Category 2 — Hooks (event-driven enforcement)

| Hook | What it enforces | Repo |
|------|-----------------|------|
| `tdd-guard` (nizos) | Blocks file ops that violate TDD — system-level Iron Law 3 enforcement | https://github.com/nizos/tdd-guard |
| `parry` (vaporif) | Prompt-injection / secrets / exfil scanner on tool I/O | https://github.com/vaporif/parry |
| `cchooks` (GowayLee) | Python SDK for writing hooks cleanly (alternative to bash) | https://github.com/GowayLee/cchooks |
| `Dippy` (ldayton) | AST-based auto-approve for safe bash; prompts on destructive | https://github.com/ldayton/Dippy |
| `HCOM` (aannoo) | @-mention comms between subagents via hooks | https://github.com/aannoo/claude-hook-comms |
| `Claudio` (ctoth) | OS-native sound effects on hook events | https://github.com/ctoth/claudio |

**When MOP supervisor should consult this**:
- Task involves secrets handling → look up `parry`
- Task needs subagent ↔ subagent comms beyond file-passing → look up `HCOM`
- Repeated TDD violations in retrospectives → look up `tdd-guard`

---

## Category 3 — Status Lines & Cost Monitoring

| Tool | Surface | Repo |
|------|---------|------|
| `Claude HUD` (jarrodwatts) | Context %, tools used, agents active, todos | https://github.com/jarrodwatts/claude-hud |
| `claude-pace` (Astro-Han) | Rate-limit burn vs time remaining (5h/7d) | https://github.com/Astro-Han/claude-pace |
| `claude-powerline` (Owloops) | Vim-style with usage + git | https://github.com/Owloops/claude-powerline |
| `CCometixLine` (Haleclipse) | Rust, fast, TUI config | https://github.com/Haleclipse/CCometixLine |
| `ccusage` (ryoppippi) | Local-log CLI cost dashboard | https://github.com/ryoppippi/ccusage |
| `ccxray` (lis186) | Transparent proxy + real-time request/response | https://github.com/lis186/ccxray |
| `better-ccflare` (tombii) | Maintained cost dashboard fork | https://github.com/tombii/better-ccflare |
| `Claudex` (kunwar-shah) | Web browser for searching CC conversation history | https://github.com/kunwar-shah/claudex |

**When MOP supervisor should consult this**:
- Retrospective notes window-pressure recurring → `Claude HUD` for visibility
- Token budget overruns in §15 → `ccusage` or `ccxray` to validate PM/Haiku/Sonnet split
- Cache hit rate concerns on template prompts → `ccxray` shows live cache stats

---

## Category 4 — Orchestrators (multi-agent / multi-session)

| Tool | Capability | Repo |
|------|-----------|------|
| `Claude Squad` (smtg-ai) | TUI managing parallel Claude/Codex/Aider workspaces | https://github.com/smtg-ai/claude-squad |
| `Happy Coder` (slopus) | Spawn/control multiple CC sessions from phone/desktop | https://github.com/slopus/happy |
| `Claude Code Flow` (ruvnet) | Recursive agent code-first orchestration | https://github.com/ruvnet/claude-code-flow |
| `The Agentic Startup` (rsmdt) | Production-shipping orchestrator | https://github.com/rsmdt/the-startup |
| `TSK` (dtormoen) | Rust CLI, parallel agents in Docker sandboxes | https://github.com/dtormoen/tsk |
| `Ralph Wiggum` family (mikeyobrien, ClaytonFarr, muratcankoylan) | Autonomous loops with KB-backed research | See awesome-claude-code |

**When MOP supervisor should consult this**:
- Task spans >2 sessions and current handoff format too rigid → `Claude Squad`
- Outreach loop needs market-research integration → `Ralph Wiggum Marketer` for pattern reference
- Mobile supervision needed → `Happy Coder`

---

## Category 5 — Slash Commands & Workflows

| Command | What it does | Repo |
|---------|-------------|------|
| `/tdd-implement` (jerseycheese) | Red-green-refactor loop wrapper | https://github.com/jerseycheese/Narraitor |
| `/analyze-issue` (jerseycheese) | GitHub issue → implementation spec |  |
| `/do-issue` (jerseycheese) | Implement GH issue with review gates |  |
| `/create-docs` (jerseycheese) | Auto-doc with edge cases |  |
| `/prd-generator` (dredozubov) | Conversation → PRD | https://github.com/dredozubov/prd-generator |

**When MOP supervisor should consult this**:
- Weekly Shopify SEO report generation → `/prd-generator` for skeleton
- GitHub issue triage workflow needed → `/analyze-issue` + `/do-issue` chain

---

## Category 6 — Tooling / Config Management

| Tool | What it does | Repo |
|------|-------------|------|
| `agnix` (agent-sh) | Linter for CLAUDE.md, AGENTS.md, SKILL.md, hooks, MCP | https://github.com/agent-sh/agnix |
| `ClaudeCTX` (foxj77) | Switch entire CC config with one command | https://github.com/foxj77/claudectx |
| `Rulesync` (dyoshikawa) | Generate rules/MCP/commands across multiple AI agents | https://github.com/dyoshikawa/rulesync |
| `viwo-cli` (OverseedAI) | CC in Docker + worktrees; safer `--dangerously-skip-permissions` | https://github.com/OverseedAI/viwo |
| `claude-code-tools` (pchalasani) | Session continuity, anti-compaction, cross-agent handoff | https://github.com/pchalasani/claude-code-tools |
| `Claude Code Templates` (davila7) | Curated UI over resource categories | https://github.com/davila7/claude-code-templates |

**When MOP supervisor should consult this**:
- Before Git L1 push to `claude-config` → run `agnix` lint
- Multi-Mac drift on rules/ dir → `Rulesync`
- Outreach workflows on shared Mac, want isolation → `viwo-cli` Docker pattern

---

## Category 7 — Skills Collections (browse-only, do NOT bulk install)

| Collection | Scope | Repo |
|-----------|-------|------|
| `anthropics/skills` | Official skill format reference | https://github.com/anthropics/skills |
| `obra/superpowers` | 14 behavioral skills (Iron Laws, two-stage review) | https://github.com/obra/superpowers |
| `addyosmani/agent-skills` | 23 production-engineering skills | https://github.com/addyosmani/agent-skills |
| `multica-ai/andrej-karpathy-skills` | Single behavioral meta-skill (4 principles) | https://github.com/multica-ai/andrej-karpathy-skills |
| `EveryInc/compound-engineering-plugin` | Turn past errors into reusable lessons | https://github.com/EveryInc/compound-engineering-plugin |
| `affaan-m/everything-claude-code` (ECC) | Already installed locally | https://github.com/affaan-m/everything-claude-code |
| `K-Dense-AI/claude-scientific-skills` | Research/science/finance/writing | https://github.com/K-Dense-AI/claude-scientific-skills |
| `klaudworks/skill-codex` | Prompt OpenAI Codex from Claude Code | https://github.com/skills-directory/skill-codex |

---

## Category 8 — Reference Material

| Item | What it provides | Repo |
|------|-----------------|------|
| `Piebald-AI/claude-code-system-prompts` | Leaked CC system prompts (Plan/Explore/Task subagents) | https://github.com/Piebald-AI/claude-code-system-prompts |
| `costiash/claude-code-docs` mirror | Searchable Anthropic docs mirror | Search GitHub |
| `JSONbored/claudepro-directory` | Hooks/commands/subagents directory | https://github.com/JSONbored/claudepro-directory |
| `hesreallyhim/awesome-claude-code` | Master awesome-list, 226 entries | https://github.com/hesreallyhim/awesome-claude-code |

---

## Lookup decision flow (for the supervisor)

```
Task needs capability X
    ↓
Is X in ~/Documents/Claude/config/skills/?
    YES → use it
    NO  → consult this index
            ↓
        Found candidate in this index?
            YES → fetch its SKILL.md via gh api / WebFetch
                    ↓
                Evaluate against §0.6 (simplicity first)
                  - Does it replace something existing?
                  - Or add unique capability?
                    ↓
                If unique + simple → fork into config/skills/<name>/
                                    + write pressure-test (§17.7 Pattern C)
                                    + commit + push (autosync)
                If not → use closest installed skill + note gap in retrospective
            NO  → user has hit ecosystem boundary; propose custom skill
```

---

## Maintenance

This index is curated quarterly (or when retrospectives surface 3+ "missing capability" notes for the same domain).

**Re-research command** (run on Mac Studio):
```bash
# Spawn fresh research agents
echo "Use mop-master research agent to refresh external-skills-index.md from:" \
     "obra/superpowers, addyosmani/agent-skills, hesreallyhim/awesome-claude-code"
```

When updating, preserve the section structure — agents grep this file by category headers.
