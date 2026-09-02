---
id: TASK-three-comments-now-argue-from-a-premise-that-is-false-and
type: task
title: three comments now argue from a premise that is false, and the config break is disclosed on one screen
status: active
severity: soft
always: false
summary: Three explanatory comments give reasons that have since stopped being true, which is worse than never having written them.
summary_of: 569196eecfd9b53f
scope: []
tags:
  - v2
  - ui
  - live
  - "plan:live"
  - "seq:13"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: b0454e087641541b
plan: live
seq: "13"
state: done
priority: "1"
source: "plan:live seq:8's out-of-lane findings, 2026-08-28"
---

# three comments now argue from a premise that is false, and the config break is disclosed on one screen

> Filed from `plan:live seq:8`'s report, 2026-08-28. That task unfroze the config; these are the things it correctly refused to touch from inside its lane, and one it could not build alone.
>
> **Three comments that argued from a premise that is now false**
>
> Each was TRUE when written and is now the opposite of the truth. This is the shape this project keeps meeting — a comment correct at its writing and wrong four hours later — and leaving them is worse than never having written them, because a reader trusts a comment that explains itself.
>
> * `src/core/budgets-write.ts` · `ctx.ws.config` · ~128 — cites `src/ui/server.ts` and the line `const ws = resolveWorkspace(options.cwd);`, which no longer exists, and says *"Never `ctx.ws.config` — that is a snapshot taken once, when the UI server started."* The reason is now wrong even though the instruction is still right. `seq:8` suggests: *"Never `ctx.ws.config` — not because it is stale (it no longer is; see `liveWorkspace`) but because this module must be readable off any corpus directory, without a `Workspace`."*
> * `src/ui/packs-model.ts:425-430` — argues for `ws.config` because *"every other endpoint on this server judges against the same boot-time config"*. There is no boot-time config now. The BEHAVIOUR it wanted is unchanged — one config per page — but it is a config a moment old rather than a boot old, and the sentence must say so.
> * `src/ui/capture-model.ts:208-217` — states *"the ITEMS are read fresh on every call; the CONFIG is not"* and that a category retiered mid-session *"does not move an item across this filter until the server restarts"*. Both are now exactly backwards. Delete or invert.
>
> `verify:citations` reports the first one and does not gate on it, so nothing is red and nothing will force this.
>
> **The disclosure gap `seq:8` accepted, and named as the thing it would land next**
>
> `seq:8` keeps the last good config when `config.json` breaks mid-session, and discloses it as `servingLastGood` on `/api/config`. That is right — the alternative takes out the one screen that can show the person the broken text — but the disclosure reaches only whoever opens Configure.
>
> **Meanwhile a person on Simulate or Work sees a ribbon and a governing set computed from a config that is not the file in front of them, with no hint.** That is a smaller version of the defect the whole task existed to fix: a screen confidently reporting a number derived from something other than what the reader believes it is reading.
>
> The shape of the fix, from `seq:8`'s own report: a `configError` field on `/api/meta`, which every screen's shell already fetches, drawn as one line in the status strip. It needs `ApiContext` in `src/ui/routes.ts` and a change under `src/ui/public/` — two lanes that were not `seq:8`'s to take.
>
> **Note the interaction with `plan:walk seq:29b`**, which rebuilds the status strip: this line belongs in that strip, so whichever lands second should carry it rather than bolting a second banner beside it.
>
> **Done when**
>
> The three comments state what is now true; the `configError` reaches every screen through `/api/meta` and the status strip rather than only Configure; and a test drives a mid-session broken config and asserts a screen other than Configure discloses it.
