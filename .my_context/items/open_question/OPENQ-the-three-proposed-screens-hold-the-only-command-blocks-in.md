---
id: OPENQ-the-three-proposed-screens-hold-the-only-command-blocks-in
type: open_question
title: "the three PROPOSED screens hold the only command blocks in the app that cannot be run: does Execute reach export, init --pack and procedure done?"
status: active
severity: soft
always: false
summary: "Three commands can only be copied and not run from inside the application: should any of them become runnable, and each on its own terms?"
summary_of: b2ba3c49954444db
scope: []
tags:
  - v2
  - ui
  - "screen:proc"
  - "screen:port"
  - "screen:packs"
  - proposed
  - walk
  - security
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 303a4c6797ebae08
blocks: "plan:builder seq:7, and the Copy-only command blocks on Procedures, Export / import and Template packs"
---

# the three PROPOSED screens hold the only command blocks in the app that cannot be run: does Execute reach export, init --pack and procedure done?

Raised 2026-08-29 under plan:walk seq:5. `plan:builder seq:7` owns the WORK — bringing the hand-built commands into the catalogue — and does not answer the question that work asks.

**THE MEASUREMENT, 2026-08-29.** `commandActions` is called at seven sites (`src/ui/public/lib/command-actions.js` · `export function commandActions({ argv, id, values = {}, ctx, copyBlocked = false }) {` · ~276). Five pass a catalogue id — capture, config, doctor, palette, work — and get Copy AND Execute behind a rendered confirm and a single-use nonce. Three pass `id: null` and get Copy alone, because the control returns early rather than run anything composed outside the catalogue: *"Nothing composed outside the catalogue may run. Asserted, not assumed."* Those three are `screens/proc.js`, `screens/port.js` and `screens/packs.js`, and the reason is that `mycontext procedure done`, `mycontext export` and `mycontext init --pack` are none of them among the twenty-five entries in `src/ui/public/lib/palette-defs.js`.

**So the three screens the PROPOSED audit is about are exactly the three whose settlement the reader must leave the app to perform.** That is not a coincidence and it is not a defect: nothing has ever ruled that they should be executable.

**WHAT IS ACTUALLY UNDECIDED, and it is not "add three catalogue entries".** Each of the three touches something the approval boundary was drawn around, and they do not answer alike:

- **`mycontext procedure done <id>`** is the one act the product reserves for the owner in its own printed words — `pr.w3`, *"`active → done` stays yours … an agent that can mark its own procedure done can declare victory."* An owner clicking Run IS the owner, so this is the strongest candidate of the three; it is also the act with the loudest reason to stay deliberate.
- **`mycontext export --out <path>`** writes OUTSIDE the workspace by design. No catalogue entry today takes a path that escapes the corpus root, and whether one may has never been asked.
- **`mycontext init --pack <path>`** creates a corpus somewhere else and reads an artefact from a path the reader supplies. It is the entry point of the untrusted-input path `screens/packs.js` already spends half its header defending against on the read side.

**RECOMMENDATION: rule them one at a time, not as a set.** `procedure done` — yes, above the boundary, with the confirm. `export` — yes, above the boundary, but only once someone rules whether a catalogue entry may take a path outside the workspace; that is a real question and this is the first entry that would ask it. `init --pack` — no, for now: it is the only one of the three whose effect is not on this corpus at all, and Copy is the honest control for it.

**WHAT MUST NOT HAPPEN:** plan:builder seq:7 closing by adding three catalogue entries and granting Execute to all three as a side effect nobody weighed. Bringing a command into the catalogue is what makes it runnable — the `id` is the whole gate — so the builder work and this ruling are one change and not two.
