---
description: "Activate or reconfirm MOP v4.6.1 master orchestration protocol. Loads mop-master skill, applies Iron Laws, prepares for triage. Use at session start or when MOP appears to have drifted."
---

# /mop — Activate Master Orchestration Protocol

When invoked, immediately:

1. **Read in full**: `~/Documents/Claude/config/skills/mop-master/SKILL.md`
2. **Confirm Iron Laws active** (§0.5):
   - Verification before completion (fresh evidence required)
   - Root cause before fix (name the cause in one sentence)
   - Test first for new behavior
   - No performative agreement ("You're absolutely right" banned)
   - Subagent context hygiene (no inheritance)
3. **Confirm Karpathy guidelines active** (§0.6): think → simplify → surgical → goal-driven
4. **Output the activation block**:

```
[MOP v4.6.1 ACTIVATED]
Iron Laws: ✓ verification ✓ root-cause ✓ test-first ✓ no-performative ✓ subagent-hygiene
Karpathy:  ✓ think-first ✓ simplicity ✓ surgical ✓ goal-driven
Hooks:     UserPromptSubmit (triage inject), Stop (telemetry + autosync)
Cron:      02:00 daily autosync --daily, 02:00 Sun mop_learn (if installed)
Models:    PM=opus  Worker=haiku-via-Task  Fallback=sonnet
Vault:     ~/Documents/Obsidian/30-Operations/MOP/
Repos:     claude-config + claude-obsidian-vault
Ready: emit [MOP T v4.5] block on next non-trivial task.
```

5. **Then wait for the user's actual task** and emit `[MOP T v4.5]` triage block as first output.

## When to invoke

- Start of session (if MOP didn't auto-load via UserPromptSubmit hook)
- Mid-session if behavior has drifted from Iron Laws
- After a `--mop-off` suppression to re-enable
- Before any Class L/XL task as explicit acknowledgement

## Suppressing

`--mop-off` on any prompt skips triage requirement for that prompt only.
