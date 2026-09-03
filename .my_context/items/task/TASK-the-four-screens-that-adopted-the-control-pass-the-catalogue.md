---
id: TASK-the-four-screens-that-adopted-the-control-pass-the-catalogue
type: task
title: Capture composes a catalogued command and discards its id
status: active
severity: soft
always: false
summary: Only one screen could gain a Run button, and it is waiting on a design decision and on plumbing that has not landed; the other three should not have one.
summary_of: 5afb54041d58c8e6
summary_was:
  - 2026-09-03 A claim that four screens were throwing away a run button turned out to be wrong for three of them; only one is a real gap.
acknowledged:
  - body_disagrees_with_meta@ba7f426dc474ab65
scope: []
tags:
  - v2
  - ui
  - execute
  - "plan:execute"
  - "seq:6c"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: bda1ac0206f74768
valid_from: 2026-08-27
valid_until: null
checksum: d2d3f4f8c1671619
plan: execute
seq: 6c
state: done
priority: "1"
source: owner, 2026-08-27 ruling after diagnosis
---

# Capture composes a catalogued command and discards its id

> **Corrected 2026-08-27, before any code was written.** This was filed on the
claim that all four screens "compose a command the catalogue does name, so the
work is to pass the id being discarded". The claim held for one of the four and
failed for the other three, and it was made by reading the four call LINES
without reading the reasoning directly above each one.

The catalogue has 24 entries. `init`, `export` and `procedure` are all
absent, and in three of the four screens `id: null` is the documented answer,
not a shortfall:

* `packs.js` composes `mycontext init` — the command run BEFORE a workspace
  exists, which is why it was never catalogued. Its own comment warns against
  precisely the remedy proposed here: passing the nearest id to obtain an
  Execute button is "exactly how a different command ships behind a confirm
  that looks right".
* `port.js` composes `mycontext export`, and the line is deliberately one
  argument short — `--out` carries no destination because the CLI refuses to
  default one, on the grounds that "an artefact written into whatever directory
  the command happened to be run from is the one destination nobody chose". An
  Execute button could only refuse or write somewhere unchosen.
* `proc.js` has no `procedure` entry, its argv has never been verified against
  the real argument parser, and it omits `--yes` deliberately: rule `pr.w3`,
  "active → done stays yours", makes the confirmation prompt the human's
  decision. Composing `--yes` to enable Execute would answer it for them.

Only `capture.js` composes a catalogued command (`add`), and that one screen is
what this item is about. It is blocked on two things, one technical and one
not: `add` is `boundary: true` and absent from `COMMAND_EFFECTS`, so an Execute
button would mint a nonce and then decline until `seq:5b` lands; and `cap.warn`
— "This is a write. Run it in your own shell." — is a sentence of the DESIGN OF
RECORD, drawn in the mockup's capture section, which becomes false the moment a
button beside it runs the command. `capture.js` states that choosing between
them is the owner's call, and `test/ui/capture-screen.test.ts` pins both halves
so the decision is re-taken rather than inherited.

**Scope as it actually stands:** this is Capture alone, it lands after
`seq:5b`, and it requires the owner to rule on `cap.warn` first. The other
three keep `id: null`; if that is ever revisited it is new work — cataloguing
a command and verifying its flags against the real parser — not an id pass.
