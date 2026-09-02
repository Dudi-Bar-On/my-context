# Task 7 Report: CLI Sweep — Capture and Inspection Commands

## Summary
Completed Task 7: wrote case table, ran sweep, verified records, and committed evidence.

## Execution

### Step 1: Case Table Written
Created `harness/cases/cli-capture.mjs` with comprehensive case array covering:
- `init` (bare, global flag, unknown args)
- `add` (flags, conflicts, refusals)
- `list` / `show` (detail levels, categories, missing records)
- `status` / `doctor` (formats, quiet flag)
- `help` / `examples` / `rebuild` (help topics, refusals)
- Top-level commands (bare invocation, help flag, unknown command)

### Step 2: Sweep Executed
Command: `node harness/sweep.mjs cli-capture ./cases/cli-capture.mjs`
Result: **57 cases swept into evidence/cli-capture.jsonl**

### Step 3: Verification
Command: Load and verify exit codes
```javascript
const r = await load('cli-capture');
console.log(r.length, r.filter(x => x.exitCode === undefined && !x.harnessError).length)
```
Result: **57 0** (57 total records, 0 missing exit codes, 0 harness errors)

### Step 4: Commit
```
[campaign/my-context-test 0331e94] test(sweep): capture and inspection CLI commands
```
Committed both `harness/cases/cli-capture.mjs` and `harness/evidence/cli-capture.jsonl`.

## Findings

### Case Count Discrepancy
- **Expected (brief):** 56 cases
- **Actual (swept):** 57 cases
- **Discrepancy:** +1 case
- This is informational; the table is the source of truth.

### Exit Code Distribution
- 36 cases exited 0 (success/accepted)
- 21 cases exited 1 (refused/error)

### Errors During Execution
- **harnessError:** 0
- **cleanupError:** 0
- **setupFailures:** 0
- All 57 cases produced exactly one evidence record with an exit code.

### Documented vs Actual Behaviors

#### 1. init-unknown-arg (cli-capture/init-unknown-arg)
- **Note in brief:** "README 2841 lists init as NOT checking unknown flags — contradicts 4494"
- **Actual behavior:** exit 1 (refuses unknown flags)
- **Finding:** init DOES refuse unknown flags, contradicting README 2841 claim
- This is the documented-vs-actual comparison Task 16 will audit

#### 2. show-unknown-flag (cli-capture/show-unknown-flag)
- **Note in brief:** "README 2841: show does NOT check unknown flags"
- **Actual behavior:** exit 0 (accepts unknown flags)
- **Finding:** Consistent with documented behavior ✓

#### 3. All other refusal cases
All documented refusals (add conflicts, missing records, invalid categories, two detail levels, etc.) exhibited expected behavior (exit 1):
- `add-body-and-file-conflict` → refused (README 1928) ✓
- `add-repeated-single-value` → refused (README 1927) ✓
- `add-severity-hard-on-rationale` → refused (README 3974) ✓
- `list-two-detail-levels` → error (as noted) ✓
- `add-normative-without-yes` → refused (as expected) ✓

## Anomalies Identified
**One notable defect for Task 16:**
- **cli-capture/init-unknown-arg:** Plugin rejects unknown flags on `init`, contradicting README line 2841. This case documents the discrepancy between documentation and implementation.

## Commit Information
- **Branch:** campaign/my-context-test
- **Commit SHA:** 0331e94
- **Files committed:**
  - `harness/cases/cli-capture.mjs` (case table)
  - `harness/evidence/cli-capture.jsonl` (evidence records)

## Success Criterion
✓ **All 57 cases produced exactly one evidence record**
✓ **Every record has an exit code**
✓ **Zero harness/cleanup/setup errors**
✓ **my-context directory remains unmodified**

---

# Fix Round 1: Harness Improvements and Discrepancy Audit

## Changes Made

### 1. Pristine Workspace Support
**Fixes:** The `init-bare` case was running `init` twice (once by `createWorkspace()`, once by the case itself), preventing observation of init on a truly empty directory.

**Implementation:**
- Added `createBareWorkspace()` to `harness/lib/workspace.mjs` — creates an empty directory without running `mycontext init`
- Modified `harness/sweep.mjs` to check `kase.pristine` and use the appropriate workspace creation function
- Split the single init case into two:
  - `init-on-pristine-dir` (pristine: true): exit 0, successfully initializes a bare directory
  - `init-on-initialised-dir`: exit 1, refuses to reinitialize an already-initialized workspace

### 2. Readback Cases for State Verification
**Fixes:** Four cases claimed behaviors that couldn't be verified from their output alone (no evidence of stored state).

**Cases Added:**
- `add-scope-comma-readback`: Reads back the constraint to verify comma-separated scope format is stored
- `add-scope-repeated-readback`: Reads back the constraint to verify repeated `--scope` form is equivalent to comma-separated
- `add-note-repeated-readback`: Reads back the constraint to verify two observations are stored for two `--note` occurrences

**Results:**
- Both scope forms produce identical stored state: `scope: [src/api/**, src/db/**]` ✓ (README 1926 equivalence confirmed)
- Note repetition stores exactly 2 observations, one per `--note` occurrence ✓ (documented behavior confirmed)

## Sweep Results (Round 1)

- **Total cases:** 61 (57 → 61, +4 cases: 2 split init cases + 3 readback cases)
- **Records produced:** 61 (one per case, all with exit codes)
- **Harness/cleanup/setup errors:** 0

## Discrepancies Identified (Task 16 Audit List)

The following discrepancies between documentation and actual implementation were discovered in the evidence:

### 1. **init-unknown-arg** (cli-capture/init-unknown-arg)
- **Finding:** Plugin rejects unknown flags even though README 2841 claims init does NOT check unknown flags
- **Evidence:** exit 1, stderr: "init takes no arguments, and "--nope" was passed"
- **Contradiction:** README 2841 vs actual behavior

### 2. **Inconsistent invalid-category error parameter names** 
- **Add command** (cli-capture/add-unknown-category): Uses parameter name `"type"` in error message
  - "type" must be one of: constraint, invariant, rule, requirement...
  - References: `See mycontext_help("categories")`
- **List command** (cli-capture/list-unknown-category): Uses parameter name `"category"` in error message
  - "category" must be one of: adr, assumption, constraint... (alphabetical order)
  - References: `See mycontext_help("categories")`
- **Finding:** Same help reference but different parameter names and category lists suggest inconsistent error formatting

### 3. **`--yes=false` indistinguishable from omitting `--yes`**
- **Cases:** cli-capture/add-yes-false vs cli-capture/add-normative-without-yes
- **Evidence:** Both produce identical output:
  ```
  about to create constraint "Uploads capped at 10 MB"...
  my_context: refusing without confirmation — stdin is not interactive...
  ```
- **Finding:** `--yes=false` is not recognized as a specific form of declining the operation; behaves identically to omitting `--yes`
- **Expected:** `--yes=false` should either be refused as invalid or should skip the confirmation prompt differently from no `--yes`

### 4. **`rebuild` silently ignoring unknown flags**
- **Case:** cli-capture/rebuild-with-args-dropped
- **Evidence:** exit 0, stdout: "my_context: indexed 0 item(s)"
- **Finding:** Like `show-unknown-flag`, `rebuild` accepts unknown flags (`--nope`) and exits 0
- **Context:** Deliberately drops arguments per index.ts:811, documented as intentional but inconsistent with other commands

### 5. **Hardcoded `mycontext_help("workflow")` on unrelated help refusals**
- **Cases:** cli-capture/help-query-refused, cli-capture/help-config-refused
- **Evidence:** Both errors end with identical suffix: `See mycontext_help("workflow")`
  ```
  "topic" must be one of: categories, scope, capture, workflow. You passed "query". See mycontext_help("workflow").
  "topic" must be one of: categories, scope, capture, workflow. You passed "config". See mycontext_help("workflow").
  ```
- **Finding:** Error messages about invalid help topics reference `help("workflow")` regardless of which invalid topic was passed
- **Expected:** Should either omit the help reference or reference an appropriate topic (e.g., `help("capture")` for general help about capturing)

### 6. **CLI errors suggesting MCP call syntax**
- **Case:** cli-capture/add-unknown-flag
- **Evidence:** Usage message includes:
  ```
  capture those with the `create_item` tool on the mycontext MCP server.
  ```
- **Finding:** CLI error messages suggest using MCP server tools instead of CLI flags, which may confuse CLI-only users
- **Context:** This appears in the usage text when explaining what CLI flags don't support, mixing CLI and MCP documentation

### 7. **doctor-quiet-and-full indistinguishable with zero findings** (Acknowledged coverage gap)
- **Cases:** cli-capture/doctor-bare, cli-capture/doctor-quiet, cli-capture/doctor-quiet-and-full
- **Evidence:** All produce identical output when workspace has zero findings:
  ```
  my_context doctor: 0 error(s), 0 warning(s), 0 note(s) across 0 finding(s).
  ```
- **Finding:** Cannot verify that `--quiet` suppresses output differently from `--full` when there are no findings to suppress
- **Status:** Coverage gap — would require a workspace with doctor findings to verify the behavior difference

## Verification

✓ All 61 cases produced exactly one evidence record with exit code
✓ Zero harness/cleanup/setup errors
✓ my-context directory remains clean
✓ Evidence readback cases confirm scope and note behaviors match documentation

## Commits

- **Harness fix commit:** 2d6e8cf `fix(sweep): pristine workspace option and readback cases for state verification`
  - Modified: `harness/sweep.mjs`, `harness/lib/workspace.mjs`
  - Updated: `harness/cases/cli-capture.mjs` (split init + added readbacks)
  - Regenerated: `harness/evidence/cli-capture.jsonl` (61 records)
