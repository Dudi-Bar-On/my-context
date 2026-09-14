---
id: CONST-the-cli-exit-code-contract
type: constraint
title: the CLI exit code contract
status: active
severity: hard
always: false
summary: What each exit code from the mycontext command line means, so a script that reads nothing else can act on it.
summary_of: 700654bc78d57d77
scope:
  - src/cli/**
tags:
  - cli
  - exit-code
  - contract
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: e14804eed49172ee
---

# the CLI exit code contract

An exit code is the one thing a caller reads without parsing anything, so it is
an API and this is its specification. It was measured, not invented: on
2026-09-13 "nothing found" exited 0 in six commands and 1 in three, and the
split had never been written down anywhere — so there was nothing for a new
command to be checked against, and nothing a script author could read.

Eight rules. Each is measured by `test/cli/exit-code-contract.test.ts`, and
`mycontext help cli` is where a caller reads them.

1. **0 means the command did what it was asked.** Nothing else. Not "no
   problems were found", not "the corpus is healthy".

2. **An EMPTY RESULT is a result, and it exits 0.** `list`, `search`, `query`,
   `todo`, `ready`, `review`, `audit`, `decay`, `procedure list`, `pack list`,
   `session list`, `conversation list`, `ingest-status` and `rules list` all
   exit 0 when they find nothing, and every one of them says so in words
   rather than printing zero lines. A question that was answered "none" was
   answered.

3. **An ABSENT TARGET THE CALLER NAMED is a failure, and it exits 1.** `show
   <id>`, `rules show <id>`, `edit <id>`, `carry <id>`, `supersede <id>` and
   `refresh <id>` exit 1 when the id does not resolve. The difference from
   rule 2 is whose expectation was wrong: an empty filter is a true answer to
   the caller's question, a missing id means the question was about something
   that is not there.

4. **Work that was ENTIRELY refused is a failure; work that was PARTLY refused
   is not.** `ingest-apply` exits 1 when every candidate it was handed was
   rejected, and 0 when any of them was created, deduped or superseded. `pack
   import` exits 1 when nothing at all landed and something was left alone —
   `overwriteBlocked` or `overwriteSkipped` — and 0 when any id the pack
   carries is in the corpus afterwards. A partial run names what did not land
   on stdout; its exit code reports that the run happened.

5. **A damaged READ is disclosed, never failed.** An item file that cannot be
   parsed is printed by `emitLoadErrors` and changes nothing about the exit
   code of `list`, `show`, `rebuild`, `ingest-apply` or `pack import`; a rule
   store entry that cannot be read is named by `rules list` at exit 0. THE
   EXCEPTIONS ARE THE THREE COMMANDS WHOSE JOB IS TO ANSWER WHETHER SOMETHING
   IS INTACT — `status`, `doctor` and `rules verify` — and for those the
   damage IS the answer, so they exit non-zero on it.

6. **`<command> --help` exits 0 on every registered command.** Asking for help
   is not a failure. It was one on 47 of 48 commands until 2026-09-14.

7. **`--json` changes the channel's format, never the exit code.** A refusal
   under `--json` is a JSON envelope on stdout at the same non-zero code the
   human form returns (`rulings/72`), and a `--json` report that is itself a
   valid document is passed through untouched.

8. **70 means the process did not finish** — an unhandled rejection or an
   uncaught exception, reported on stderr with "Any output above is
   INCOMPLETE". It is the one code that says nothing about the work, because
   nothing observed the work.

WHAT THIS DOES NOT SETTLE. There is no distinction between "refused" and
"broken": a bad flag, a declined gate and an unreadable database all exit 1.
Widening that is a separate decision, and widening it by hand one command at a
time is how the split this constraint replaces came to exist.
