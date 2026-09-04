---
id: TASK-post-api-command-check-parses-a-composed-command-without
type: task
title: POST /api/command/check parses a composed command without executing it
status: active
severity: soft
always: false
summary: A way for the page to ask whether a command it has composed would be accepted, using the real checker, without ever running it.
summary_of: 3222900708f457df
scope: []
tags:
  - "plan:builder"
  - "seq:4"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: b593711e168e0955
plan: builder
seq: "4"
state: todo
needs: builder/1, builder/1b
---

# POST /api/command/check parses a composed command without executing it

The gate the owner asked for: "checked before a command is allowed to be copied".

It takes an argv and answers whether the CLI would accept it, using seq 1's lifted parser - so the UI's check and the CLI's refusal are the same code and cannot disagree. When it refuses, it returns the CLI'S OWN REFUSAL TEXT, which this project has spent real effort making good; a second, weaker sentence composed for the browser would waste that.

PARSE, NEVER EXECUTE, and make that structural rather than promised. The endpoint must be unable to run a command even if a later change tried to - the same bound `recordRefusal` has, where a record that is not a refusal is refused rather than written. `test/ui/no-writes.test.ts` is the gate on it.

`/api/config/check` is the precedent for a POST validator that answers rather than acts - read it first. `ctx.post` landed 2026-08-23, so the page can reach this.

DEPENDS ON seq 1.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it is UNBLOCKED -- its own body already knew, which is what makes the config plan s stale blocker so striking. It says "ctx.post landed 2026-08-23, so the page can reach this", written 2026-08-24. plan:config seq:2, on the same subject, still records ctx.post as missing. ctx.post IS BUILT AND REACHABLE. `app.js` · `async function post(path, body) {` · ~1398 implements it, `app.js` · `window.myctx = {` · ~5036 exports it into the ctx object, and the module header documents it in full -- "POST, and THE SAME DOOR as api(): same token header, same refusal handling, same JSON parse, same throw". The task that blocked this, plan:ui2 seq:15p, is DONE. IT HAS ZERO CALLERS in any screen. Its structural requirement is the important one and must not become a promise in a comment: the endpoint must be UNABLE to run a command even if a later change tried to -- the same bound recordRefusal has -- with test/ui/no-writes.test.ts as the gate. /api/config/check is the precedent to read first.

plan:builder IS INTERNALLY CONSISTENT and needed no correction -- the only plan of the six the reconciliation has read that did not. Its sequence stands: 1b, 1c, 2, 2b, 3, 4, then the mockup (plan:walk seq:20), then 5, 6, 7, 8, with plan:walk seq:21 teaching the parity gates to understand a screen that instantiates a pattern.
