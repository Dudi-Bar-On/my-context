---
id: TASK-the-approval-boundary-probe-expands-four-subcommanded
type: task
title: the approval-boundary probe expands four subcommanded commands and there are five
status: active
severity: soft
always: false
summary: The check listing which commands can act without a person misses one command entirely, so two of its options are watched by nothing.
summary_of: 3a3677e3d06c2396
scope: []
tags:
  - v2
  - gates
  - cli
  - walk
  - "plan:walk"
  - "seq:107"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/sub.md"
source_anchor: null
source_checksum: 11686cf3fddffba8
valid_from: 2026-08-29
valid_until: null
checksum: 8844cd33e0938f3d
plan: walk
seq: "107"
state: done
priority: "2"
source: "found by plan:export seq:13r, 2026-08-29"
---

# the approval-boundary probe expands four subcommanded commands and there are five

> > Found 2026-08-29 by `plan:export seq:13r` while auditing the READMEs against the shipped CLI. It could not be fixed in that lane and it is a gate blind spot, not a documentation error.
>
> **The observation**
>
> `statusline install --yes` and `statusline uninstall --yes` are real flags and are named in no flag-table row. Adding the row was tried and reverted, because `test/plugin-assets.test.ts:725` pins that row to exactly `approvalBoundary().gated` — and the probe in `test/helpers/approval-boundary.ts` expands only `pack`, `procedure`, `review` and `session` into subcommands.
>
> **`statusline` is a fifth command of that shape** and the probe therefore tests bare `mycontext statusline --yes`, which is refused — so it classifies as **ungated**, and the row is not wrong *by its own contract*.
>
> **The contract has the blind spot.** A subcommanded command that the probe does not expand can carry an approval-boundary flag that nothing measures. That is a security-shaped gap in a test whose whole job is to enumerate the approval boundary, and the fix is one entry: add `statusline` to `SUBCOMMANDED`, and the row grows two entries on its own.
>
> **Worth checking at the same time, because the same reasoning applies**
>
> Is `statusline` the only unexpanded one? The probe's list was written when four commands had subcommands. Enumerate the commands that take a subcommand from the registry rather than from that list, and make the probe derive its set instead of restating it — a hand-kept list that must agree with a registry is the drift this project has now measured in citations, in the wave map, and in the audit-kind tables.
>
> **A second, smaller finding from the same audit**
>
> `src/core/command-flags.ts:37` says *"the 38 commands `COMMANDS` registers"*. The registry registers **32** by side effect and the CLI dispatches **39** — seven live in `src/cli/index.ts`. Both READMEs say 39 and are right; the source comment is wrong in both directions at once.
>
> **Done when**
>
> The approval-boundary probe derives its subcommanded set from the registry; `statusline`'s two `--yes` flags appear in the table; and `command-flags.ts`'s count is corrected or replaced by something derived.
