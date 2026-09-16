---
id: TASK-every-cli-invocation-prints-an-experimental-warning-that-is
type: task
title: every CLI invocation prints an experimental warning that is suppressed at all twelve other entry points
status: active
severity: soft
always: false
summary: The command a person installs no longer prints a warning before every run; running it straight from the source files still does, and closing that costs more than a flag.
summary_of: 115ecdccddadf02e
summary_was:
  - 2026-09-16 Every command a person types prints a warning that has already been silenced everywhere else in the project.
scope:
  - src/cli/index.ts
tags:
  - v2
  - cli
  - noise
  - "plan:cliscript"
  - "seq:5"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: cff766c6362e2f1d
plan: cliscript
seq: "5"
state: todo
priority: "3"
---

# every CLI invocation prints an experimental warning that is suppressed at all twelve other entry points

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, C9) as row 112 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Every `mycontext` invocation prints `ExperimentalWarning: SQLite is an experimental feature`.

AND IT IS SOLVED AT EVERY OTHER ENTRY POINT IN THE PROJECT -- all eleven hooks, the statusline installer and the review pass -- and NOT at the one a person types. That asymmetry is the finding: the fix exists, is applied twelve times, and was never applied to the CLI.

THE CONSEQUENCE FOR A SCRIPT. Two lines of warning on stderr before every command, on a surface whose stdout and stderr discipline is otherwise deliberate -- report 6 measured eight commands redirected and through a pipe as byte-identical every time and called that the one area it would change nothing.

CONFIRMED WHILE FILING THIS ITEM: it is still printed on every run of the CLI from source.

── STILL OPEN 2026-09-16, AND THIS IS WHAT REMAINS ─────────────────────

NAMED-BUT-OPEN fc0b57da — the installed command is fixed and `node src/cli/index.ts …` still warns; closing that means the flag on every command line or a dynamic import in four core modules

THE COMMIT THAT DID THE WORK SAID "see the follow-up notes in each item" AND WROTE NONE, which is the defect `rulings/93` was filed for, one level down from an unchanged state field. This is that note, written from the commit.

THIS ITEM'S PREMISE IS FALSE AND THAT IS THE FINDING. The fix is a Node command-line flag and the CLI is the one entry point with no parent of ours to put one on. An in-process filter CANNOT work: the warning is emitted while Node links the module graph, before any project code evaluates — proved by building the filter, showing a module imported first still prints after it, reproducing it outside this repository, and then deleting it.

WHAT LANDED: the shebang `#!/usr/bin/env -S node --disable-warning=ExperimentalWarning`, verified end to end. `cmd-shim` on Windows carries the flag through verbatim into the `.cmd`, `.ps1` and `sh` shims, measured on a scratch package the same day. `5e2b45a9` repaired the literal pin in `test/plugin-assets.test.ts` that the first commit broke.

WHAT REMAINS: `node src/cli/index.ts …` — how every test, doc and lane runs this CLI — still warns. Closing it means either the flag on those command lines or making `node:sqlite` load dynamically in four `src/core/` modules. AND ONE THING TO FIX WITH IT: `harness/self-test/run.test.mjs` asserts the CLI's stderr CONTAINS `ExperimentalWarning`, so it encodes the defect as expected behaviour and goes red on the day this closes.

The `NAMED-BUT-OPEN` line above is read by `npm run check:board`.

NAMED-BUT-OPEN 5e2b45a9 — that commit repaired the literal shebang pin in `test/plugin-assets.test.ts` that the fix above broke, and measured `cmd-shim` carrying the flag through on Windows. It changed nothing about what is left here.
