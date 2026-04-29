---
name: Encrypted Credentials System
description: Master credential file for Awin, Impact, and other affiliate platforms — loaded automatically in automation
type: reference
---

## Location
- **Credentials file**: `~/.claude/credentials.json` (encrypted, gitignored)
- **Setup script**: `~/.claude/setup-credentials.js` (AES-256 encryption)
- **Retriever**: `~/.claude/get-credentials.js` (quick access in scripts)

## Usage in Automation

### Retrieve via Node.js
```js
const { loadCredentials } = require(path.join(process.env.HOME, '.claude/setup-credentials.js'));
const creds = loadCredentials();
const awINEmail = creds.awin.email;
const awINPassword = creds.awin.password;
```

### Retrieve via CLI
```bash
node ~/.claude/get-credentials.js awin email
node ~/.claude/get-credentials.js awin password
```

## Stored Services
- **awin**: affiliate@celldigital.co
- **impact**: affiliate@celldigital.co

## Update Credentials
```js
const { saveCredentials } = require('~/.claude/setup-credentials.js');
saveCredentials({
  awin: { email: 'xxx', password: 'xxx' },
  impact: { email: 'xxx', password: 'xxx' }
});
```
