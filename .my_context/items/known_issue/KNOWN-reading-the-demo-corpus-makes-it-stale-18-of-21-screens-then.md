---
id: KNOWN-reading-the-demo-corpus-makes-it-stale-18-of-21-screens-then
type: known_issue
title: "reading the demo corpus makes it stale: 18 of 21 screens then refuse"
status: active
severity: hard
always: false
summary: Simply looking at the sample data puts it out of date, after which most screens refuse to show anything rather than show a partial picture.
summary_of: 5d43aa9d0d84bba8
scope: []
tags:
  - v2
  - ui
  - fixture
  - tree-parity
  - e2e
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 0bd50516741e24a5
---

# reading the demo corpus makes it stale: 18 of 21 screens then refuse

MEASURED 2026-08-24, walking decay in plan:port seq:98.

EIGHTEEN OF THE TWENTY-ONE screens render this sentence instead of their content:

  "the audit projection is behind relative to its log, and this endpoint may not catch it up: syncing is a write, and answering from it anyway would present a partial history as a complete one."

THE REFUSAL IS CORRECT. A read surface may not write, and a stale projection answered from anyway would present a partial history as a complete one. Nothing about the application is wrong here.

THE FIXTURE IS WHAT IS WRONG, AND IT IS SELF-DEFEATING. `scripts/demo-corpus.ts` ends by building the projection -- its own comment says why, "the difference between a demo corpus that works on first open and one that greets the owner with a 503". But every READ against that corpus appends an `access` record to `audit.jsonl`, and nothing rebuilds the projection afterwards. The last forty records in the fixture are all `access`. So the suite breaks the fixture BY RUNNING, and every run after the first measures a corpus in refusal.

THE EVIDENCE, from file times and the log itself:
  audit.db    built  2026-08-23 15:31Z
  audit.jsonl last   2026-08-23 18:38Z, and its last 40 records are reads
  tree-parity measured 2026-08-23 16:22Z -- already about fifty minutes of access
  records past the projection when it ran.

WHAT THIS MEANS FOR THE INVENTORY. The 182 divergences, the 97 STRUCTURAL and the whole node-deficit ranking were measured against a corpus where eighteen screens were refusing to draw. decay reports 547 nodes against 86 and its heatstrip is BUILT -- `drawHeat` exists, `styles.css` carries `.heat`, `.hstrip`, `.hname` and `.heataxis`, and the app draws `p.small.spill` carrying the refusal where the strip would be. It is not an unbuilt screen. It is a screen with no data.

DO NOT read the current inventory as a measure of what is built until this is closed and the measurement is taken again.
