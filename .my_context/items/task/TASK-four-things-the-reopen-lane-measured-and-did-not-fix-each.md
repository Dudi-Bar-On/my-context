---
id: TASK-four-things-the-reopen-lane-measured-and-did-not-fix-each
type: task
title: four things the reopen lane measured and did not fix, each with its evidence
status: active
severity: soft
always: false
summary: "Four things measured by the plan:live seq:22 lane and deliberately left alone, each with the evidence and the reason it was not this lane's to change."
summary_of: 77cc9e188d791a92
scope:
  - src/ui/public/screens/watch.js
  - src/core/ui-sessions.ts
  - src/ui/public/app.js
  - test/ui/open.test.ts
tags:
  - v2
  - ui
  - live
  - "plan:live"
  - "seq:24"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: b692a208c6638731
plan: live
seq: "24"
state: todo
priority: "3"
---

# four things the reopen lane measured and did not fix, each with its evidence

Filed by the `plan:live seq:22` lane, 2026-09-09, on finishing the look-tick stream reopen. Nothing
here blocks that item; each is something measured on the way past and left alone deliberately, with
the reason. seq:24 rather than 23 because the owner's credential open question is already spoken of
as live/23 and an open_question cannot declare a plan to say so itself.

── 1. THE FEED APPENDS AFTER A DISCONTINUITY, SO THE NEWEST ROWS LAND AT THE BOTTOM ────────

`screens/watch.js` keeps `records` NEWEST-FIRST. Both paths that refill it after a break —
`applyStreamBacklog` (the replay on a new connection's `hello`) and `reloadBacklog` (the answer to a
`resync` gap) — call `remember(record, false)`, which does `records.push`. Records already on screen
are dropped by `seen`, so what actually gets pushed is precisely the ones that landed DURING the
break — and those are newer than everything above them, yet arrive at the oldest end, or are popped
off entirely by `while (records.length > FEED_CAP) live.delete(records.pop())`.

THIS IS NOT SOMETHING THE REOPEN INTRODUCED. It is the existing behaviour of the `resync` path,
which has shipped since the stream did; the reopen simply reaches it a second way. It is filed rather
than fixed for that reason: the honest repair is one rule about where a late record belongs, applied
to both paths at once, and doing it inside a lane whose subject was the connection would have been
one screen's ordering changed under an item about a socket.

── 2. A TAB OLDER THAN THE LAST 64 RESTARTS IS LOCKED OUT, AND THE PROMISE SAYS THIRTY DAYS ─

`core/ui-sessions.ts`: `SESSION_TTL_MS` is thirty days and `SESSION_MAX` is 64, evicted oldest
first. The store counts RESTARTS, not tabs — its own comment says so, having been raised from 8 for
exactly that reason on 2026-08-28. Sampled on this machine 2026-09-09 the file was FULL: 64 digests
spanning 63.5 HOURS, newest 09:58Z, oldest 2026-09-06T18:26Z. So on a development week the real
window is under three days, and `restartStaleServer` — which restarts after every commit — is what
spends the slots.

The measurement that matters for live/22 is separate and came out the other way: a tab whose token
IS still in the store keeps working across a restart, header and cookie both, 200 on every route
including the stream. This is the bound on that, not a contradiction of it. Raising `SESSION_MAX`
is cheap (a digest is one sha256) but it is a security-window decision and belongs to whoever owns
`live/23`.

── 3. `stream()` FORGETS THE STORED TOKEN AND KEEPS THE IN-MEMORY ONE ──────────────────────

`app.js`'s `api()` does both on a 401/403 — `forgetToken()` AND `token = null` — and its own comment
explains why the second half is load-bearing: without it "every later call in this page's life sent
the same rejected header again", and the recovery through the cookie can only happen when the page
stops sending a dead header. `stream()` calls `forgetToken()` alone. It is currently harmless
because the shell's other reads reach `api()` within the same boot and clear it there, and because
the reopen refuses to retry a connection that never said `hello`. It is an asymmetry between two
copies of one rule, which is the shape this corpus keeps finding on this exact path.

── 4. `test/ui/open.test.ts` IS RED ON A FIELD ANOTHER LANE ADDED THE SAME DAY ─────────────

`ui --no-open prints a URL that a real request can reach, and opens no browser` asserts the key set
of the `/api/ping` answer and expects `[corpus, occupancy, ok, staleCode]`. It now returns
`[corpus, occupancy, ok, session, staleCode]` — `session` arrived with
`TASK-the-session-field-names-a-session-and-says-nothing-about-its`, which `code-skew.test.ts`'s
own comments already name as a 2026-09-09 change. Reported rather than touched: it is that lane's
assertion to update, and a passing test somebody else edited into agreement is how a fixture stops
meaning anything.
