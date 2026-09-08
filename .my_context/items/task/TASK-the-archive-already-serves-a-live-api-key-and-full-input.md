---
id: TASK-the-archive-already-serves-a-live-api-key-and-full-input
type: task
title: the archive already serves a live API key, and full input capture adds a bearer token to it
status: active
severity: soft
always: false
summary: Decide whether the saved-session viewer hides passwords and keys that appear in the commands and files it shows, since one real key is already on screen today.
summary_of: 061692b6ff08ee07
summary_was:
  - 2026-09-08 Whether the conversation archive redacts credentials, where, and how much — reported from a scan of every transcript on the machine rather than assumed.
scope:
  - src/ui/read-model-conversation-document.ts
  - src/ui/read-model-conversations.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - security
  - "plan:archive"
  - "seq:27"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/body.md"
source_anchor: null
source_checksum: 839f88ec8e5812bd
valid_from: 2026-09-08
valid_until: null
checksum: 1a19498f73f88fb9
plan: archive
seq: "27"
state: todo
priority: "1"
needs: archive/24
---

# the archive already serves a live API key, and full input capture adds a bearer token to it

Filed by the lane that built `plan:archive seq:24` (full tool-call input capture), because that item
required the secrets question to be REPORTED and not decided in a lane. This is the report, turned
into work.

WHAT WAS MEASURED, 2026-09-08, before the capture change was believed. Every transcript on this
machine under `~/.claude/projects` — 867 files, 1,723,113,033 bytes, 343,627 records, 91,619
`tool_use` blocks — scanned for thirteen credential shapes (Anthropic, OpenAI, GitHub, AWS, Slack,
Google, PEM blocks, JWTs, bearer headers, `key=`/`secret=` assignments, `export *_TOKEN=`, and
URL userinfo).

THE NEWLY EXPOSED SET IS EIGHT MATCHES, AND ONE OF THEM IS A REAL SECRET:

    Bearer e4556318aca495f433a8081ef816afdf

inside a `Bash` `command` in
`D--Users-UserC-source-repos-test-mycontext-plugin/9e5b6b17-…/subagents/agent-a2add2e627aed6ebe.jsonl`
— a lane curling `http://127.0.0.1:58888/api/watch/context` with the UI server's own auth token on
the command line. Before seq:24 the archive kept only that call's `description`; after it, the
token is on the screen. The other seven are synthetic probes a test wrote on purpose
(`secret=leak-probe-4a7b2e`, `http://user:pw@`) and one match on the identifier `secret` in
`secret = cryptoRandomBytes`.

AND THE FINDING THAT MATTERS MORE, BECAUSE IT IS TRUE TODAY AND NOBODY FILED IT: the archive
ALREADY serves a live-shaped Anthropic API key, and has since before seq:24 was written.

    sk-ant-api03-B6y5StW2xdNgFEifpF489V1zrBqOphn109sDbRQObHxrQj-…

is the `primaryApiKey` of `~/.claude.json`, printed by a `cat` and captured in the `tool_result`
of `D--Users-UserC-source-repos-test-mycontext-plugin/9e5b6b17-c186-4c93-a0a5-775b4eccd9e7.jsonl`.
`DocStep.text` has carried tool RESULT text whole since the caps were removed on 2026-09-08
(`plan:archive seq:7`), so that key is already drawn in the browser by every reader who opens that
fold. Five `export GEMINI_API_KEY=…` lines and two `http://user:pw@` URLs sit on the same
already-captured path.

SO THE HONEST SENTENCE, and it is the one to read before anything is built: full input capture
turns ONE local bearer token from invisible into visible, while the result path it sits beside has
been exposing a real cloud API key for a day already. Redaction is not a cost of seq:24 — seq:24
merely made it obvious. The exposure is symmetric and any redaction that covers only inputs would
be theatre.

WHAT THIS IS NOT. It is not a leak off this machine: the UI server binds 127.0.0.1, the archive
reads files that already sit unencrypted in the reader's own home, and every one of these strings
was already in the JSONL before this product existed. The change is what a person sees in a
browser they may be screen-sharing or exporting from — and `plan:archive seq:4`/`seq:5` are an
EXPORT to a file that leaves the machine, which is where a captured key stops being local.

WHAT TO DECIDE, and each of these is a ruling rather than an implementation detail:

  - WHETHER TO REDACT AT ALL, given that the transcript on disk is not redacted and never will be.
    A viewer that hides what `cat` already printed is arguably lying about the record it claims to
    be, and `INV-nothing-is-dropped-silently` has a view: if something is withheld, the screen
    must SAY a value was withheld, never silently blank it.
  - WHERE. In the read model (one place, covers screen and export) or at export only (the archive
    stays faithful, the file that leaves is cleaned).
  - HOW MUCH. A shape-matcher on the thirteen patterns above finds 8 + 15 matches in 1.7 GB. That
    is a very cheap pass with a real false-negative rate — a token that looks like a word is
    missed — and a real false-positive rate, which on a viewer means a reader is shown `[redacted]`
    where the text said `secret = cryptoRandomBytes`.
  - WHETHER THE TWO CREDENTIALS FOUND SHOULD BE ROTATED. That is the owner's call and it is the
    only part of this item with a clock on it: the Anthropic key above is live-shaped and sits in
    a file that is world-readable to anything running as this user.

MEASURE FIRST, DON'T INHERIT. The 8/15 split above is this machine on this date. Re-run the scan
before designing, because a corpus with one `.env` `cat` in it changes the answer.

## Relations
- depends_on [[TASK-a-tool-call-keeps-160-characters-of-its-input-and-drops-the]]
