---
id: KNOWN-every-hook-invocation-prints-an-experimentalwarning-to
type: known_issue
title: Every hook invocation prints an ExperimentalWarning to stderr, keeping 11 tests red
status: deprecated
severity: soft
always: false
summary: A harmless warning is printed on every single run, which keeps a group of checks permanently red and teaches everyone to ignore the count.
summary_of: 7438d20436358e26
acknowledged:
  - body_disagrees_with_meta@34ba371ef676cb1d
scope: []
tags:
  - hooks
  - tests
  - noise
  - node24
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-19
valid_until: 2026-09-03
checksum: 65e3ca8be329cc81
---

# Every hook invocation prints an ExperimentalWarning to stderr, keeping 11 tests red

Every hook invocation writes a Node experimental warning to stderr, in
production, on every call:

```
(node:NNNNN) ExperimentalWarning: SQLite is an experimental feature and might
change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
```

**Reproduced directly:** `echo '{}' | node src/hooks/session-start.ts 2>&1
>/dev/null` prints it. `hooks/hooks.json` invokes each hook as a bare
`node "${CLAUDE_PLUGIN_ROOT}/src/hooks/<name>.ts"` with no warning-suppression
flag, so this is what a real session gets — and Claude Code surfaces hook
stderr.

**It has kept nine tests red.** Measured in a detached git worktree at HEAD with
no uncommitted work present: `test/hooks/*.test.ts` gives 145 tests, 135 pass,
**9 fail**, every one of them asserting that stderr is empty. Two more MCP tests
fail the same way, for eleven in total.

**Why that matters more than the noise itself.** A suite that is red on eleven
tests trains everyone to read "11 failing" as normal, and the next real
regression lands inside that number. It also blocked a diagnosis: an unrelated
change that adds a stderr disclosure cannot be tested for on a channel that is
already non-empty, so the pollution has to be cleared before the disclosure can
be asserted at all.

**The fix is one flag, in two places.** Node accepts
`--disable-warning=ExperimentalWarning`. It belongs in `hooks/hooks.json`'s four
command lines, so production is quiet, and in whatever spawns the hooks under
test, so the assertions become meaningful again.

**What must NOT be done:** widening the tests to tolerate a non-empty stderr.
The assertion is correct — a hook that prints to stderr on a normal run is
telling the user something is wrong when nothing is. Loosening the test would
discard the only thing that noticed.

**One caution for whoever fixes it.** Suppressing warnings globally would also
suppress a genuine deprecation the project would want to see. Disable the
specific `ExperimentalWarning` class, not all warnings, and only for the hook
entry points — the CLI can keep them.

2026-09-03: THE FLAG IS IN BOTH PLACES THIS ITEM NAMES, and the issue is closed on that. `hooks/hooks.json` invokes each of its four hooks as `node --disable-warning=ExperimentalWarning "<root>/src/hooks/<name>.ts"`, so a real session is quiet; and the harness that spawns the hooks under test passes the same flag -- `test/hooks/hook-binaries-e2e.test.ts` · `['--disable-warning=ExperimentalWarning', ...args]` · ~117, with `hook-contention.test.ts` and `observation-binaries-e2e.test.ts` doing the same. The 11 tests this issue kept red are asserting an empty stderr against a channel that is empty again. What was never in scope still prints it: `node src/cli/index.ts doctor` shows the warning today, and this item says in as many words that the CLI can keep them.
