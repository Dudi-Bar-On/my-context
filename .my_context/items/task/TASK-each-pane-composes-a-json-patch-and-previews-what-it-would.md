---
id: TASK-each-pane-composes-a-json-patch-and-previews-what-it-would
type: task
title: each pane composes a JSON patch and previews what it would govern
status: active
severity: soft
always: false
summary: Each settings section shows the exact text to paste and what would actually change as a result, since the file stays the user's own to edit.
summary_of: 735f4af796d4d352
acknowledged:
  - body_disagrees_with_meta@6dfcb120e7fd82d1
  - citation_form@6dfcb120e7fd82d1
scope: []
tags:
  - "plan:config"
  - "seq:2"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 5ee3e0324860fac4
plan: config
seq: "2"
state: done
---

# each pane composes a JSON patch and previews what it would govern

The composer pattern the owner asked for, applied per subject.

TODAY the screen previews a budget change and says, correctly, that there is no command that edits a budget - configuration is the user's to make. That is right and stays. What is missing is the other half: the exact bytes to add, per subject, next to the diff of what would govern if they did.

DO: each pane emits the precise JSON block for its subject, and a diff of the RESOLVED config before and after - not of the file, of what would actually govern, since a shipped default and an override compose. The endpoints exist: `/api/config/check` and `/api/config/preview` are registered and tested.

ITS BLOCKER IS GONE: `ctx.api` having no POST was filed as TASK-ctx-api-has-no-post-so-three-registered-endpoints-are: both endpoints are registered, tested and unreachable from the page, which is why Configure ships with a disabled segbar today.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, AND ITS BLOCKER IS STALE. This is the fifth stale blocker the reconciliation has cleared and the most consequential one.

It says "BLOCKED ON ctx.api having no POST, filed as TASK-ctx-api-has-no-post-so-three-registered-endpoints-are". ctx.post IS BUILT AND REACHABLE. `app.js` · `async function post(path, body) {` · ~1398 implements it, `app.js` · `window.myctx = {` · ~5036 exports it into the ctx object, and the module header documents it in full -- "POST, and THE SAME DOOR as api(): same token header, same refusal handling, same JSON parse, same throw". The task that blocked this, plan:ui2 seq:15p, is DONE. IT HAS ZERO CALLERS in any screen.

AND THE STALE COMMENT IS WHY NOBODY NOTICED. `config.js` · `no method, no body` · ~119 (corrected since) still tells every reader: "the screen contract s fetcher takes a path and nothing else -- no method, no body ... an app.js extension that plan-2 Task 12 adds and that app.js does not have today". app.js HAS it. So the screen s own header instructs the next implementer that the thing they need does not exist, and every candidate-config preview below is ABSENT rather than approximated on that basis. THE COMMENT MUST BE CORRECTED IN THE SAME COMMIT as the first POST call, or the next reader stops for the same reason.

Compare plan:builder seq:4, written 2026-08-24, which says in its own body: "ctx.post landed 2026-08-23, so the page can reach this". ONE PLAN KNEW AND THE OTHER DID NOT. That is the whole argument for this reconciliation in one line.

THE BUILD IS plan:walk seq:10, "config: the delta plate and the blast panels are unblocked, so build them" -- somebody did notice, from the walk side. This task is the per-subject half of it and holds the requirement the walk task does not: a diff of the RESOLVED config before and after, not of the file, because a shipped default and an override compose.
