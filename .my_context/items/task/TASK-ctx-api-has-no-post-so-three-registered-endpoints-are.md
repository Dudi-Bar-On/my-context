---
id: TASK-ctx-api-has-no-post-so-three-registered-endpoints-are
type: task
title: ctx.api has no POST, so three registered endpoints are unreachable from any screen
status: active
severity: soft
always: false
summary: Screens can only ask the server simple questions, so three finished features sit unreachable and two screens are missing half of what they do.
summary_of: 32ab0661d4a8b9a2
scope: []
tags:
  - "plan:ui2"
  - "seq:15p"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: 5bf0490a5b644dce
valid_from: 2026-08-23
valid_until: null
checksum: 2d7720aa38761079
plan: ui2
seq: 15p
state: done
---

# ctx.api has no POST, so three registered endpoints are unreachable from any screen

> `app.js`'s `api(path)` takes a path only, and the token is closed over inside
> that module, so a hand-rolled `fetch` from a screen would carry no credential.
>
> The consequence, measured 2026-08-23: `POST /api/config/check` and
> `POST /api/config/preview` are registered, tested and completely unreachable
> from any screen, and so is `POST /api/overlap`.
>
> What that costs today, on two screens that are otherwise finished:
>
> - Configure ships a DISABLED scope-policy segbar, because moving it must answer
>   "and what would that do to this corpus" and that answer lives behind the POST.
>   Its Apply block copies the current budgets text rather than a patch, so the
>   `btn.copypatch` label overstates what exists. Its whole candidate/diff/blast
>   half — the before/after delta rows and the three blast panels — is absent, and
>   is eight of its element kinds in the parity ledger.
> - The Composer cannot call the overlap scorer at all.
>
> The extension is `ctx.api(path, init)`, which plan 2 Task 12 already specifies.
> It is one function in one file, and it unblocks two screens' missing halves plus
> whatever a later screen needs to send.
