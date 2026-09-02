# Task 13 Report: Config schema, profiles, and all 21 categories sweep

## Summary
Sweep completed successfully. 72 evidence records produced. All 21 category captures passed. No harness errors, cleanup errors, setup failures, or timeouts.

### Fix Round 1 (Coordinator feedback)
Original sweep produced 70 cases. Budget spill-note case was a short-circuit: it created an unpinned item that landed in index tier, so the 50-token pinned budget was never consulted. Added two corrected cases:
- `budgets-spill-pinned`: Creates two 3000-char pinned items against a 40-token pinned budget, produces spill note naming excluded items per INV-nothing-is-dropped-silently
- `budgets-index-overflow`: Creates five normative items against a 60-token index budget, produces overflow line indicating "+1 more"
- Updated `budgets-spill-note` note to clarify it demonstrates non-pinned items landing in index tier unaffected by pinned budget

## Mechanics
- **Command run:** `node harness/sweep.mjs config ./cases/config.mjs`
- **Cases defined in config.mjs:** 72
  - Per-category (add + list): 42 cases
  - Profiles: 5 cases
  - Budgets: 8 cases (budgets-defaults, budgets-override, budgets-unknown-key-refused, budgets-negative-refused, budgets-non-number-refused, budgets-spill-note, budgets-spill-pinned, budgets-index-overflow)
  - Top-level keys: 3 cases
  - Per-category overrides: 14 cases
- **Expected by brief:** 72 cases
- **Actually swept:** 72 cases
- **Evidence records produced:** 72 in `harness/evidence/config.jsonl`

## Case Verification
- **All 21 category adds:** Passed (exitCode 0)
  - Initial run: 1 failure (add-reference; file missing)
  - Added `fixture` to create README.md for reference category
  - Re-run: 0 failures
- **Spot-checked valid-config cases (4 samples):**
  - `profile-minimal`: exit=0, executed
  - `budgets-override`: exit=0, executed
  - `category-prefix-override`: exit=0, executed
  - `custom-category-complete`: exit=0, executed
- **Spot-checked refused cases (4 samples):**
  - `profile-full-refused`: exit=1, "unknown profile 'full'"
  - `budgets-negative-refused`: exit=1, "Expected a number >= 0"
  - `category-extraFields-refused`: exit=1, "not a key this config understands"
  - `unknown-top-level-key-refused`: exit=1, "not a key this config understands"

## Budget Spill/Overflow Verification
- **budgets-spill-pinned:** Exit 0, output shows spill note "_2 item(s) omitted from full text for budget: CONST-first-long-constraint, CONST-second-long-constraint. Fetch with mycontext show <id>._" — verifies INV-nothing-is-dropped-silently invariant with item names present
- **budgets-index-overflow:** Exit 0, output shows overflow line "… +1 more (fetch with mycontext show <id>)" — demonstrates documented index overflow format

## Error Handling
No harness errors (0), cleanup errors (0), setup failures (0), or timeouts (0).

## Confirmation
- **Did not commit:** Confirmed. Only modified `harness/cases/config.mjs` and generated `harness/evidence/config.jsonl`.
- **No modifications to sweep.mjs or harness/lib/:** Confirmed. `configPatch` handler already present.

## Notes
All evidence records contain expected fields (caseId, surface, argv, exitCode, stdout, stderr, durationMs, note). Reference category required fixture addition to create test file. All valid-config cases executed successfully rather than refusing at load. All invalid-config cases refused with appropriate error messages at load or command execution.
