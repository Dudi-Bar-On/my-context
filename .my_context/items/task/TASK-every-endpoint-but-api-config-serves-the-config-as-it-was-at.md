---
id: TASK-every-endpoint-but-api-config-serves-the-config-as-it-was-at
type: task
title: every endpoint but /api/config serves the config as it was at server start
status: active
severity: soft
always: false
summary: Change a setting while the app is running and almost everything keeps using the old value, because it was read once when the server started.
summary_of: eb495223dd9c1d1c
acknowledged:
  - citation_form@5f2e6f9760f1bf42
  - state_unaudited@5f2e6f9760f1bf42
scope: []
tags:
  - v2
  - ui
  - live
  - "plan:live"
  - "seq:8"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 65aa8ddca5b0aaeb
plan: live
seq: "8"
state: done
priority: "1"
source: found measuring the owner's 2026-08-28 ribbon report
---

# every endpoint but /api/config serves the config as it was at server start

> Found while measuring the owner's report that the Injection preview's budget ribbon does not stay in sync (2026-08-28).
>
> ## Measured, not inferred
>
> A server started against a corpus, then `config.json` edited **out of band** — the terminal, or the owner's own editor, which is how every budget in this project has been set because the deny hook blocks the assistant from editing that file:
>
>     endpoint           before    after the edit
>     /api/config        1111      9999     <- re-reads the file every call
>     /api/simulate      1111      1111     <- the snapshot taken at server start
>
> They disagree, and they keep disagreeing for the life of the process.
>
> ## The mechanism
>
> `resolveWorkspace()` runs ONCE, at `ui/server.ts:374`. Every request past it is handed that same `ws` object (`ui/server.ts:702`), so `ws.config` is a photograph of `config.json` taken at start. `read-model.ts`'s `apiSimulate` spreads `{ ...ws.config.budgets }` from it.
>
> `read-model-config.ts` does the opposite deliberately — its own header says so: *"`ws.config` is the snapshot taken when"* the server started, so `/api/config` resolves from disk on every call. One endpoint is live, the other is frozen, and nothing reconciles them.
>
> `plan:budget seq:5` already found this from the other side and patched around it: after writing the file it also assigns `ctx.ws.config.budgets[key] = after` (`ui/execute.ts:852`), with a comment explaining that without it *"`config.json` and the in-memory `Config` every other endpoint reads would disagree for the rest of the server's life."* That fix is correct and covers exactly one writer — the UI's own button. **Every other way a budget can change still leaves the snapshot behind.**
>
> ## Why this is not `plan:live seq:4`
>
> `seq:4` is about the gap where NO SIGNAL EXISTS — a Markdown item edited with no session running appends nothing to the log, so no stream can carry it. This is the opposite: the signal exists and works. `config.json` is watched by the `file-changed` HOOK op; `config`, `palette` and `capture` declare `hook` and refresh correctly. The data behind the refresh is what is frozen. A perfect stream and a perfect affordance would still redraw 1111.
>
> ## Blast radius — every reader of `ws.config`, not just the ribbon
>
> `capture-model.ts` (`matchesFocus`, `injection`, the tier of every governing item), `proc-model.ts`, `packs-model.ts` (`carriesFor`), `read-model-work.ts` (four `injection(i, ws.config)` calls). Anything deciding admission or tier against `ws.config` is deciding against the config as it was at start. The ribbon is simply the one place a person can SEE the number and notice.
>
> ## The shape of the fix, and what it must not become
>
> The honest options are to re-resolve per request, or to re-resolve on the `file-changed` hook and keep the snapshot as a cache. Neither is free: `resolveConfig` validates and throws on a corrupt file, so a per-request resolve turns a bad hand-edit into every endpoint failing at once rather than one screen. Whatever is chosen has to answer what happens when the file on disk is invalid — today the answer is "the server refuses to start", which is a different and much safer moment than "the server starts fine and then every request fails".
>
> Do not fix this by adding a second in-place patch beside `execute.ts`'s. That is one more writer remembering to keep a snapshot honest, and the defect is that remembering is the mechanism.
>
> ## Done when
>
> An out-of-band edit to `config.json` reaches `/api/simulate` and every other `ws.config` reader; a test performs exactly the measurement above and asserts both endpoints agree after the edit; the corrupt-file behaviour is decided and stated; and `execute.ts`'s in-place patch is either removed as redundant or kept with a comment saying why it still earns its place.
