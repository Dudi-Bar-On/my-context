# Task 12 Report: Hook Sweep Evidence Collection

## Summary — Round 2

Sweep completed successfully. All 37 cases produced exactly one evidence record. All cases exited with code 0 (fail-open invariant held). No mechanical anomalies detected.

## Changes from Round 1

- **Corpus fixed:** `add` → `pin` → `harden` sequence now properly creates pinned tier
- **Case count:** 31 → 37 cases
  - Added: scoped-billing-hit, scoped-billing-miss (demonstrate scope filtering with billing path)
  - Added: deny-hyphen, deny-config, deny-notebookedit, deny-multiedit (expanded canonicalization coverage)
- **Note corrected:** pre-tool-use-scoped-miss now accurately states unscoped items still arrive

## Sweep Execution

1. **Deleted:** old `harness/evidence/hooks.jsonl`
2. **Updated:** `harness/cases/hooks.mjs` (CORPUS with pin/harden, 37 cases)
3. **Run:** `node harness/sweep.mjs hooks ./cases/hooks.mjs`
4. **Verify:** fail-open and record integrity

## Results

**Case Count:** 37 cases
- SessionStart: 8 cases (unchanged)
- PreToolUse: 21 cases (was 15; +6: 2 billing, 4 deny variants)
- PostToolUse: 5 cases (unchanged)
- PreCompact: 3 cases (unchanged)

**Evidence:** 37 records in `harness/evidence/hooks.jsonl`
- Each case produced exactly one record
- No duplicate records by caseId

**Exit Codes:** All 37 hook cases exit 0 ✓
- Fail-open invariant verified

**Mechanical Health:**
- No setupFailures
- No cleanupErrors
- No harnessError
- No timedOut

## Data Quality Verification

**Pinned tier now works:**
- session-start-startup: shows CONST-never-commit-a-secret (pinned item) in full, plus index and count line
- session-start-empty-corpus: empty (correct contrast)

**Scope filtering works:**
- pre-tool-use-scoped-miss (src/api/handler.ts): shows pinned + unscoped items, NOT db-scoped item
- pre-tool-use-scoped-billing-hit (src/billing/pricing.ts): shows pinned + billing-scoped + unscoped items

**Deny enforcement:**
- pre-tool-use-deny-hyphen: successfully denied (hyphen spelling detected)
- pre-tool-use-deny-config: successfully denied (generic branch for managed paths)
- pre-tool-use-deny-notebookedit: successfully denied (Edit|Write substring match catches NotebookEdit)

## Acknowledged Gaps

**Per-session dedupe** (`session-start-dedupe-same-session`):
- Cannot be tested: each case runs in a fresh workspace. Dedupe would require multi-call hook support within a single session, where the same session_id calls SessionStart twice.

**Compaction restore** (`session-start-compact`):
- Cannot be tested: workspace destroyed after each case. RestoreSnapshot would require PreCompact to run first and populate state, then SessionStart to read it. No multi-call workflow.

**PreCompact snapshot write** (`pre-compact-basic`):
- Cannot verify snapshot was actually written: workspace torn down immediately after case completes. Would need workspace state capture before teardown.

## Status

**Swept:** 37 cases → harness/evidence/hooks.jsonl

**Did not commit.** Repository at parent's e97ae45 commit.
