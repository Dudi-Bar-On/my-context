# Task 9 Report: CLI Retrieval, Audit and Focus Commands

## Execution Summary

**Sweep Command:** `node harness/sweep.mjs cli-retrieve ./cases/cli-retrieve.mjs`

**Status:** Success

## Case Table

- **Total cases in table:** 67
- **Expected (per brief):** 60
- **Cases created:** `harness/cases/cli-retrieve.mjs`

### Case Breakdown by Command

| Command | Count | IDs |
|---------|-------|-----|
| search | 13 | search-positional through search-unknown-flag |
| query | 11 | query-select through query-double-dash-separator |
| audit | 22 | audit-bare through audit-unknown-flag |
| decay | 7 | decay-bare through decay-unknown-flag |
| focus | 14 | focus-bare-reports through focus-hard-item-never-hidden |

## Evidence Generation

**Evidence file:** `harness/evidence/cli-retrieve.jsonl`

- **Records produced:** 67
- **Records expected:** 67 (one per case)
- **File size:** 65,491 bytes
- **Generated:** 2026-08-17 15:17:49

### Record Status

| Metric | Count |
|--------|-------|
| Total records | 67 |
| Timeouts | 0 |
| harnessError | 0 |
| cleanupError | 0 |
| setupFailures | 0 |
| Cases not constructible | 0 |

### Exit Code Distribution

- Exit code 0 (success): 51 records
- Exit code 1 (expected error): 16 records
- Unexpected codes: 0

### Stderr Output

All records show expected `ExperimentalWarning: SQLite is an experimental feature` message in stderr.

## Seed Data Configuration

### Search and Query Cases

Setup: Single SEED constraint
```javascript
const SEED = ['add', 'constraint', 'Pool capped at 20', '--scope', 'src/db/**', '--tags', 'db', '--yes'];
```

### Audit, Decay, and Focus Cases

Setup: CORPUS with 6 items (to populate log and provide diverse filter targets)
```javascript
const CORPUS = [
  ['add', 'constraint', 'Pool capped at 20', '--scope', 'src/db/**', '--tags', 'db,perf', '--severity', 'hard', '--yes'],
  ['add', 'constraint', 'Uploads capped at 10 MB', '--scope', 'src/api/**', '--tags', 'api', '--yes'],
  ['add', 'rule', 'Write the failing test first', '--tags', 'testing', '--yes'],
  ['add', 'invariant', 'Prices are integer cents', '--scope', 'src/billing/**', '--tags', 'billing', '--yes'],
  ['add', 'decision', 'We chose Stripe for settlement timing', '--tags', 'billing'],
  ['add', 'lesson', 'Retry storms need jitter'],
];
```

Note: The `focus-hard-item-never-hidden` case extends CORPUS with an additional hard-severity constraint.

## Git Commit

**Commit SHA:** `9ef400465b46a311e2bb14def38e348057ec2f47`

**Commit message:** `test(sweep): retrieval, audit and focus CLI commands`

**Files committed:**
- `harness/cases/cli-retrieve.mjs`
- `harness/evidence/cli-retrieve.jsonl`

**Working tree status post-commit:** Clean

---

## Fix Round 1: Coverage Gap Closure

**Status:** Success

**New cases added:** 11 (bringing total from 67 to 78)

### Gap Coverage

**GAP 1 — Date boundary discrimination for `--until` and `--since`**
- Added `audit-until-past` with `['audit', '--until', '2020-01-01']`
  - Rationale: All corpus records postdate 2020-01-01; if `--until` works, result must be empty
  - Exit code: 0
- Added `audit-since-future` with `['audit', '--since', '2099-01-01']`
  - Rationale: All corpus records predate 2099-01-01; if `--since` works, result must be empty
  - Exit code: 0

**GAP 2 — Op discrimination via mutation**
- Added `audit-op-create-discriminates` with setup `[...CORPUS, ['pin', 'CONST-pool-capped-at-20', '--yes']]` and `['audit', '--op', 'create']`
  - Rationale: Corpus setup creates 6 items; pin mutation adds an update op; filtering `--op create` should exclude the pin
  - Exit code: 0
- Added `audit-op-update-discriminates` with setup `[...CORPUS, ['pin', 'CONST-pool-capped-at-20', '--yes']]` and `['audit', '--op', 'update']`
  - Rationale: Corpus setup creates 6 items; pin mutation adds an update op; filtering `--op update` should return only the pin
  - Exit code: 0

**GAP 3 — Focus state observation with active focus**
- Added `focus-show-with-active` with setup `[...CORPUS, ['focus', 'db']]` and `['focus', '--show']`
  - Rationale: Contrast with `focus-show` empty state; this observes active focus
  - Exit code: 0
- Added `focus-json-with-active` with setup `[...CORPUS, ['focus', 'db']]` and `['focus', '--json']`
  - Rationale: Contrast with `focus-json` empty state; this observes active focus
  - Exit code: 0
- Added `focus-clear-with-active` with setup `[...CORPUS, ['focus', 'db']]` and `['focus', '--clear']`
  - Rationale: Contrast with `focus-clear` empty state; this clears an active focus
  - Exit code: 0
- Added `focus-bare-with-active` with setup `[...CORPUS, ['focus', 'db']]` and `['focus']`
  - Rationale: Contrast with `focus-bare-reports` empty state; this reports on active focus
  - Exit code: 0

**GAP 4 — Role flag with `--items` and invalid values**
- Added `audit-items-role-subject` with `['audit', '--items', '--role', 'subject']`
  - Rationale: `--role` is only read inside `--items` branch; valid values are subject, injected, spilled
  - Exit code: 0
- Added `audit-items-role-injected` with `['audit', '--items', '--role', 'injected']`
  - Rationale: `--role` is only read inside `--items` branch; valid values are subject, injected, spilled
  - Exit code: 0
- Added `audit-role-garbage` with `['audit', '--role', 'nonsense']`
  - Rationale: Sibling flags `--kind` and `--op` reject invalid values with "must be one of" error; testing whether `--role` does the same
  - Exit code: 1

### Final Evidence Generation (Fix Round)

**Evidence file:** `harness/evidence/cli-retrieve.jsonl` (regenerated)

- **Total cases:** 78 (67 original + 11 new)
- **Records produced:** 78
- **All records:** Successfully produced with no timeouts or errors

### Final Exit Code Distribution

| Metric | Count |
|--------|-------|
| Exit code 0 | 62 |
| Exit code 1 | 16 |
| Unexpected codes | 0 |
| Timeouts | 0 |
| harnessError | 0 |
| cleanupError | 0 |
| setupFailures | 0 |

### New Case Breakdown

| Gap | Cases Added | Exit Codes |
|-----|-------------|-----------|
| GAP 1 (dates) | 2 | 0, 0 |
| GAP 2 (ops) | 2 | 0, 0 |
| GAP 3 (focus state) | 4 | 0, 0, 0, 0 |
| GAP 4 (role) | 3 | 0, 0, 1 |
| **Total new** | **11** | **10 at 0, 1 at 1** |
