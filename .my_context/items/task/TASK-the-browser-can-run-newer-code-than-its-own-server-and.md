---
id: TASK-the-browser-can-run-newer-code-than-its-own-server-and
type: task
title: the browser can run newer code than its own server, and nothing says so
status: active
severity: soft
always: false
summary: The page can load newer code than the server it talks to, so a feature that works looks broken and nothing says why.
summary_of: 9528c62a4205c1ca
scope: []
tags:
  - v2
  - ui
  - live
  - "plan:live"
  - "seq:12"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 9937e149695f34ef
plan: live
seq: "12"
state: todo
priority: "1"
source: owner, 2026-08-28
---

# the browser can run newer code than its own server, and nothing says so

> Owner, 2026-08-28: *"the budget ribbon has continuity lane that nothing update it."*
>
> Correct, and the app was not broken — **the running server was four hours older than the feature.**
>
> ## Measured
>
>     server process (pid 57660) started   13:58
>     continuity landed in src/core/select.ts   17:42
>
> `src/ui/static.ts`'s `serveStatic` ends in `readFileSync(resolved)` on every request, with no cache. TypeScript modules load ONCE, when the process starts. So:
>
> * the browser fetched the NEW `screens/preview.js` from disk — five tracks, continuity among them;
> * the server answered `/api/select` from the OLD `select.ts` in memory — four tiers, no continuity;
> * the lane drew, and nothing could ever fill it.
>
> Restarting the server resolves it. Nothing was wrong with either half.
>
> ## Why this is worth fixing rather than remembering
>
> **The client can silently run ahead of its own server, and nothing says so.** Every asset under `public/` is live from disk; every module behind `/api/` is frozen at process start. Any edit to a screen while a server runs produces a half-updated application, and the failure looks exactly like a feature that does not work.
>
> It cost the owner a bug report on a feature that had shipped correctly an hour earlier, and it will cost that again — this project edits UI files constantly with a server running.
>
> This is the same family as `plan:live seq:8` (`ws.config` resolved once at start, so a budget edited out of band never reaches `/api/simulate`) and one layer deeper: that one freezes CONFIG, this one freezes CODE. `seq:8`'s fix does not touch it.
>
> ## The shape of a fix
>
> The server knows both halves and can compare them. Something like: stamp an identity at start — the process's own module load time, or a hash over `src/ui/public/` plus the server modules — serve it on an existing endpoint, and have the shell compare what it was served against what it is running. On a mismatch, say so: a banner naming the skew and the remedy (restart), in the same register as the `noCredential` state that was added the same day for the bare URL.
>
> **Do not solve it by disabling the static read-through.** Live assets are what makes UI iteration fast here, and losing that to fix a disclosure problem is the wrong trade. The defect is silence, not freshness.
>
> Consider also whether `mycontext ui` should say, at start, that it will not pick up code changes without a restart. A sentence at start is cheaper than a banner and catches the case before it confuses anyone — though it does not catch the person who has had the tab open since morning, which is the case that actually happened.
>
> ## Done when
>
> The shell can tell that its assets and its server disagree, and says so with the remedy; the static read-through is unchanged; and a test drives the mismatch — a server started against one set of assets, then the assets changed under it — and asserts the disclosure appears.
