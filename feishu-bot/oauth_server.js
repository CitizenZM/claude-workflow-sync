// ─────────────────────────────────────────────────────────────────────────────
// oauth_server.js — Local OAuth PKCE server to get Feishu user_access_token
// Run once: node oauth_server.js
// Then open the printed URL in Feishu browser → token stored automatically
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const TOKEN_FILE = path.join(__dirname, '.user_token.json');
const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

// Use only PUBLISHED scopes (already in v1.1.2)
// im:message + im:message:readonly are published and allow user-token message history
const SCOPES = [
  'im:message',
  'im:message:readonly',
  'im:chat:readonly'
].join(' ');

// ── PKCE helpers ──────────────────────────────────────────────────────────────
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}
function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ── Token API calls ───────────────────────────────────────────────────────────
async function post(apiPath, body, bearerToken) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
    if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
    const req = https.request({
      hostname: 'open.feishu.cn',
      path: `/open-apis${apiPath}`,
      method: 'POST',
      headers
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

async function exchangeCode(code) {
  // Step 1: get app_access_token
  const appTokenRes = await post('/auth/v3/app_access_token/internal', {
    app_id: APP_ID, app_secret: APP_SECRET
  });
  const appToken = appTokenRes.app_access_token || appTokenRes.tenant_access_token;
  if (!appToken) throw new Error('Failed to get app_access_token: ' + JSON.stringify(appTokenRes));
  console.log('   App token obtained:', appToken.slice(0, 15) + '...');

  // Step 2: exchange code for user tokens
  // Include app_id + app_secret in body AND Authorization header (fixes 20025 error)
  const tokenRes = await post('/authen/v1/oidc/access_token', {
    grant_type: 'authorization_code',
    code,
    app_id: APP_ID,
    app_secret: APP_SECRET
  }, appToken);
  console.log('   Token exchange result code:', tokenRes.code, '| msg:', tokenRes.msg);

  // Fallback: try v1 non-OIDC endpoint if OIDC fails
  if (tokenRes.code !== 0) {
    console.log('   Trying v1 fallback endpoint...');
    const fallbackRes = await post('/authen/v1/access_token', {
      grant_type: 'authorization_code',
      code,
      app_id: APP_ID,
      app_secret: APP_SECRET
    }, appToken);
    console.log('   Fallback result code:', fallbackRes.code, '| msg:', fallbackRes.msg);
    return fallbackRes;
  }
  return tokenRes;
}

async function refreshUserToken(refreshToken) {
  const appTokenRes = await post('/auth/v3/app_access_token/internal', {
    app_id: APP_ID, app_secret: APP_SECRET
  });
  const appToken = appTokenRes.app_access_token;
  const data = JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'open.feishu.cn',
      path: '/open-apis/authen/v1/oidc/refresh_access_token',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), Authorization: `Bearer ${appToken}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

// ── Token storage ─────────────────────────────────────────────────────────────
function saveToken(data) {
  // Handle both /authen/v1/access_token and OIDC response formats
  const d = data.data || data;
  const stored = {
    access_token: d.access_token,
    refresh_token: d.refresh_token || null,
    expires_in: d.expires_in || 7200,
    refresh_expires_in: d.refresh_expires_in || 2592000,
    scope: d.scope || '',
    name: d.name || d.en_name || '',
    open_id: d.open_id || '',
    saved_at: Date.now(),
    expires_at: Date.now() + ((d.expires_in || 7200) - 60) * 1000
  };
  if (!stored.access_token) throw new Error('No access_token in response: ' + JSON.stringify(data).slice(0, 200));
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(stored, null, 2));
  return stored;
}

function loadToken() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE)); }
  catch { return null; }
}

async function getValidToken() {
  let stored = loadToken();
  if (!stored) return null;

  // Refresh if expired
  if (Date.now() >= stored.expires_at) {
    if (!stored.refresh_token) return null;
    console.log('♻️  Refreshing user token...');
    const refreshed = await refreshUserToken(stored.refresh_token);
    if (refreshed.code !== 0) { console.error('Token refresh failed:', refreshed.msg); return null; }
    stored = saveToken(refreshed);
    console.log('✅ Token refreshed');
  }
  return stored.access_token;
}

// ── OAuth URL builder ─────────────────────────────────────────────────────────
function buildAuthUrl(state, codeChallenge) {
  // Use OIDC authorize endpoint (not legacy /authen/v1/index)
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  return `https://accounts.feishu.cn/open-apis/authen/v1/authorize?${params}`;
}

// ── HTTP server ───────────────────────────────────────────────────────────────
async function startServer() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(8).toString('hex');
  const authUrl = buildAuthUrl(state, codeChallenge);

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');

        if (returnedState !== state) {
          res.writeHead(400); res.end('State mismatch — possible CSRF');
          return;
        }
        if (!code) {
          res.writeHead(400); res.end('No code in callback');
          return;
        }

        try {
          console.log('\n🔄 Exchanging code for tokens...');
          const tokenData = await exchangeCode(code);
          if (tokenData.code !== 0) throw new Error(tokenData.msg);

          const stored = saveToken(tokenData);
          console.log('✅ user_access_token obtained and saved!');
          console.log(`   Expires in: ${stored.expires_in}s`);
          console.log(`   Token file: ${TOKEN_FILE}`);

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<html><body style="font-family:sans-serif;padding:40px;background:#0f0;"><h1>✅ Authorized!</h1><p>Feishu user_access_token saved. You can close this window.</p><p>Token expires in ${stored.expires_in} seconds. Run the history fetcher now.</p></body></html>`);

          server.close();
          resolve(stored);
        } catch(e) {
          console.error('❌ Token exchange failed:', e.message);
          res.writeHead(500); res.end('Error: ' + e.message);
          reject(e);
        }
      } else {
        res.writeHead(404); res.end('Not found');
      }
    });

    server.listen(PORT, () => {
      console.log('\n🔐 Feishu OAuth Server running\n');
      console.log('━'.repeat(60));
      console.log('📋 STEP 1: Open this URL in your browser:');
      console.log('\n' + authUrl + '\n');
      console.log('━'.repeat(60));
      console.log('📋 STEP 2: Log in to Feishu and authorize');
      console.log('📋 STEP 3: You\'ll be redirected back → token auto-saved\n');

      // Auto-open in browser on macOS
      exec(`open "${authUrl}"`, (err) => {
        if (err) console.log('(Could not auto-open browser — copy URL above manually)');
        else console.log('🌐 Browser opening automatically...\n');
      });
    });

    server.on('error', reject);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔑 Feishu User Access Token Setup');
  console.log(`   App ID: ${APP_ID}`);

  // Check existing token
  const existing = await getValidToken();
  if (existing) {
    console.log('✅ Valid token already exists!');
    console.log('   Token:', existing.slice(0, 20) + '...');
    console.log('   Run: node fetch_history.js --all to start fetching');
    console.log('   To re-authorize: delete .user_token.json and run again\n');
    return;
  }

  try {
    await startServer();
    console.log('\n🎉 Authorization complete!');
    console.log('   Next: node fetch_history.js --all');
  } catch(e) {
    console.error('❌ OAuth failed:', e.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { getValidToken, saveToken, loadToken, refreshUserToken };
