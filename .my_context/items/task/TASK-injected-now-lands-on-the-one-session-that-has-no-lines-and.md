---
id: TASK-injected-now-lands-on-the-one-session-that-has-no-lines-and
type: task
title: Injected now lands on the one session that has no lines, and two endpoints disagree about it
status: active
severity: soft
always: false
summary: A screen promising what this session really received opens empty, because the sample data deliberately deletes the record for the newest session.
summary_of: 3abb253eac49d430
scope: []
tags:
  - v2
  - ui
  - review
  - "screen:injected"
  - api
  - "plan:walk"
  - "seq:35"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 6a450d465b445eda
plan: walk
seq: "35"
state: done
priority: "1"
source: "plan:review seq:5, the functional UX review, 2026-08-25"
---

# Injected now lands on the one session that has no lines, and two endpoints disagree about it

FOUND 2026-08-25 by plan:review seq:5, the functional UX review, 2026-08-25. The screen is blank on open, and the data is one session away.

MEASURED, against `.demo-corpus`:
    `/api/sessions` -> default = `demo-session-a3f9c1-23`, and that session s entry says `itemCount: 6`
    the screen requests exactly `/api/session/demo-session-a3f9c1-23/injected`
    that answers `{"lines":[],"error":null}` -- EMPTY, and not an error
    sessions -22, -21, -20 and -19 each answer with SIX real lines

SO THE LANDING STATE OF A SCREEN WHOSE OWN SUBTITLE IS "live, not hypothetical -- what this context window actually received" IS AN EMPTY TABLE, while four sessions of real data sit behind the same endpoint.

TWO SEPARATE THINGS ARE WRONG AND THEY SHOULD NOT BE CONFLATED.

ONE -- TWO ENDPOINTS DISAGREE ABOUT ONE SESSION. `/api/sessions` says six items; `/injected` says none. The screen s own note anticipates a difference and explains it: "Read from the seen file, not Ledger.seen -- that is a replayed projection nothing here updates, and it would show a different number." THAT NOTE ANTICIPATES A DIFFERENT NUMBER. It does not anticipate six against ZERO, which is not a discrepancy a reader can absorb -- it is one surface saying the session had content and another saying it had none. Establish which is right for the newest session before changing anything: it is plausible that the ledger records an injection whose seen file was never written, and if so THAT is the finding and it is a data-integrity one, not a UI one.

TWO -- AND SEPARATELY -- AN EMPTY ANSWER SAYS NOTHING. `{"lines":[]}` with `error:null` renders as a bare table head. See `plan:walk seq:34`.

AND IT IS AN ARGUMENT FOR `plan:port seq:94`, the fixture that mirrors the mockup s scene: if the newest demo session carries no seen file, the fixture is producing a blank landing state on a screen the mockup draws full. That is the fifth instance of the fixture making built code look unbuilt.

CAUSE CONFIRMED 2026-08-26, and it is the fixture rather than either endpoint. `scripts/demo-corpus.ts` deletes the newest numbered session s seen file on purpose, so `/injected` answers `{"lines":[]}` for exactly the session `/api/sessions` makes default. The two endpoints do NOT disagree about the data -- one reads the seen file the script removed and the other reads the audit log it kept, and both are reporting truthfully about different stores. The data-integrity reading this task asked to rule out is ruled out.

THE FIX IS NOT SIMPLY TO STOP DELETING IT: measured A/B, that gives Injected now 5 rows and drops the delivered pane from 4 to 2, because the fixture holds only nine normative items. See `NOTE-the-injected-blank-landing-is-a-real-trade-and-the-demo`. This task therefore waits on the pool, and part TWO of it -- that an empty answer should say something rather than render a bare table head -- is independent and still stands on its own.
