---
id: TASK-five-browser-assertions-pin-a-number-that-only-holds-while
type: task
title: five browser assertions pin a number that only holds while nobody is using the product
status: active
severity: soft
always: false
summary: "Measured: the five conversations failures do not reproduce, and the browser gate is red because .demo-corpus was retired while forty-one specs still assert states only it held."
summary_of: 9a2f9b9a5ab3fb1a
summary_was:
  - 2026-09-11 Five tests fail because the conversation files grew while the tests were reading them, which is what dogfooding means.
scope:
  - e2e/graph-focus.spec.ts
  - e2e/app-layout.spec.ts
  - e2e/doctor-settle.spec.ts
  - e2e/doctor-workspace.ts
tags:
  - v2
  - archive
  - test
  - "plan:archive"
  - "seq:54"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: cf7095b826cf3c43
plan: archive
seq: "54"
state: done
priority: "1"
---

# five browser assertions pin a number that only holds while nobody is using the product

CLOSED 2026-09-11. MEASURED TWICE OVER THE FULL SERIAL SUITE, BOTH PROJECTS, `--workers=1`, with
Playwright's own exit code read from a file.

BEFORE: 972 tests, 845 passed, 127 failed (67 distinct tests; chromium 61, chrome 66), exit 1, 2.7h.
AFTER, chromium half: 54 failed of 486. The chrome half of the after-run is NOT comparable and is not
claimed: concurrent lanes edited 24 tracked files under it mid-run, including `src/ui/read-model.ts`
at 04:02, and every spec that brings its own harness rather than `e2e/app.ts` then loaded behind the
code-skew banner `app.ts` dismisses — `code-colour`, `code-hue` and `conversations` collapsed whole,
on `.convrow` never becoming visible. That is the documented hazard in `app.ts`, observed live.

THE EXIT-CODE TRAP, OBSERVED: the before-run was 845 passed / 127 failed with Playwright exit 1, and
the background shell that wrapped it reported exit 0. Redirect and read the file; never a pipeline.

THIS ITEM'S OWN PREMISE DID NOT SURVIVE MEASUREMENT, and that is the first finding. It names
`e2e/conversations.spec.ts` failing 5 of 66 because "this session is being written into those files
WHILE the suite reads them". That file is 91 tests now and passed 91 OF 91 on chromium; the two
chrome failures are a 30s timeout and a tab-close button, not content deltas. And it cannot drift
with the corpus at all: it builds its own session in a throwaway `CLAUDE_CONFIG_DIR` and never reads
the live conversation files. The brief's second claim inverts too — it says a browser test "expects 2
edges where the corpus now has more than 50"; the spec expects MORE THAN 50 and the corpus answers 2.

THE REAL CAUSE OF THE UNREADABLE GATE IS THE RETIREMENT OF `.demo-corpus` ON 2026-09-07. 41 of the 67
distinct failures are specs still asserting a state only that fixture ever held. Measured directly
against this corpus: `selection.spilled` is 0, so 16 spill tests page nothing; there is no
`revisions.jsonl` and no drafts directory, so the Review queue is empty and 9 `announce`/`execute`
tests time out on a control that exists only when something is pending; `injected-*` and
`served-shape` still name `demo-session-a3f9c1-*` by id; and all 75 doctor findings route to
`acknowledge`, not one to `run`, so `execute.spec.ts`'s "Doctor's repair reaches a confirm" cannot be
repaired on the live corpus at all. Every one of those needs a state seeded in a scratch workspace,
which is the exception `INSTR-testing-happens-against-the-current-corpus-and-an-exception` requires
the owner to approve. NONE was created and NONE was touched.

WHAT WAS RE-CUT — 10 tests across 4 files, all green, every new assertion proved able to fail by
planting an impossible value and reading back the planted message.

`e2e/graph-focus.spec.ts`, 4 tests, DRIFT. It opened on two constants measured on `.demo-corpus` on
2026-08-31. One of them, `CONST-the-pool-is-capped-at-20-connections`, IS NOT IN THE CORPUS AT ALL —
`selectOption` timed out on an option that could never appear — and the other,
`CONST-a-correction-records-the-class-of-error-not-only-the`, is no longer offered, because the
picker now lists only items with a relation of a kept type. Nothing writes an id or a count down now.
The focus is read off the picker; the relations asserted are `paths === drawn`,
`rects === nodes + (omitted ? 1 : 0)`, the focus node carrying the id the readout names, and the
default being the first `<option>` — which is a property of `render()` picking
`find(qualifies && !isRetired)` over the array `fill()` lists from. `radius === 1` is the one value
still written, because it is the screen's own constant rather than a fact about the corpus.

`e2e/app-layout.spec.ts`, 2 tests, DRIFT. The budget ribbon asserted `gaps + ghosts > 0` for a
running tier, under a comment reasoning about what `scripts/demo-corpus.ts` authored; over this
corpus `pinned` runs and admits nothing, because the `seen` gate holds every pinned item back from a
session that already has them. It now asserts `gaps === segs`, plus `segs === in` and
`ghosts === out` read off the label — three places the same fact is written, and stronger than the
floor it replaces, with an anti-vacuity guard that at least one running tier put a segment on its
track. The carried block asserted `blocks === claimed`, true only while the carry fits inside
`BOUND_CAP_LIST`: measured 36 claimed against 20 drawn, which is the cap exactly. Nothing was being
dropped — `drawCarry` renders through `boundedList` and discloses the remainder — so the chain is
now sentence total === bound total === 36, and blocks === bound shown === 20.

`e2e/doctor-workspace.ts` and `e2e/doctor-settle.spec.ts`, 4 tests, NOT DRIFT. The contradiction gate
landed on 2026-09-08 in `9c9cd31b`; both probe rules share `RETRACTING_BODY` verbatim, so the second
`add` has been refused ever since and the failure is a `Command failed:` before a browser opens. The
same commit fixed the node twin `test/cli/ack-all.test.ts` with `--distinct` and left this fixture
behind — two copies of one helper that had to agree, which is the failure `doctor-workspace.ts`'s own
header says it exists to prevent. `seedRetractingRule` now takes the ids already seeded and makes the
ruling a person makes.

HOW DRIFT WAS TOLD FROM A DEFECT, IN EVERY CASE: by reading what the screen answered rather than that
it answered wrongly. `CONST-the-pool-…` was absent from `/api/items`; `spilled` was 0 in
`/api/select`; the carried bound said 36 and the sentence said 36, so the screen agreed with itself
and only the test disagreed; the doctor failure never reached a browser.

REAL DEFECTS FOUND AND LEFT FOR THEIR OWNERS, none of them drift: `docs` and `tut` render no
`[data-p]` content at all, failing `app-layout`'s silent-band sweep and `tree-parity`'s inventory; a
`.chip.ok` on `simulate` draws no word inside it; `doctor-outcome` prepends an outcome that belongs
beside the row it was run from; `runs.spec.ts` lists 21 rail screens and the rail now offers 22, with
`gaps` unledgered; `screen-parity` reports 10 unledgered kinds; and `test/review/pass.test.ts` did not
typecheck while I measured, from another lane's in-flight work.
