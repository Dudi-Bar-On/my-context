---
id: TASK-the-preview-can-hold-two-renders-at-once-and-session
type: task
title: the preview can hold two renders at once, and session listeners accumulate per render
status: active
severity: soft
always: false
summary: The main screen can draw itself twice at once, and its listeners pile up with every visit, so everything appears in duplicate.
summary_of: ab15a33fac68663f
acknowledged:
  - state_unaudited@8459d0d3359f0a53
scope: []
tags:
  - v2
  - ui
  - walk
  - "plan:walk"
  - "seq:72"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 5e0c7f894c97dd29
plan: walk
seq: "72"
state: done
priority: "1"
source: found out of lane while fixing two e2e tests, 2026-08-29
---

# the preview can hold two renders at once, and session listeners accumulate per render

> Found 2026-08-29 by the agent fixing two browser tests, **out of its lane and reported rather than patched**. Pre-existing, user-visible, and the cause of a flake nobody had traced.
>
> **The defect**
>
> `screens/preview.js`'s `show()` has **no in-flight guard**. It does `out.replaceChildren()`, then awaits `/api/select` and `/api/simulate`, then `draw()` **appends**.
>
> Two overlapping calls therefore each clear an already-empty container and each append a full render. The preview ends up holding **two `#spilledRows`, two Delivered cards and two ribbons** — one per selection, both on screen.
>
> **Why a second call is easy to start, and this is the half that makes it common**
>
> * `render()` registers `ctx.onSessionChange(() => void show())` **before** its own `await show()`.
> * `app.js`'s `loadSessions()` fires **every** session listener on **every** call, whether or not the session actually changed — once from `main()` and again from the nonce-redemption handler, which is exactly the boot every browser test performs.
> * `onSessionChange` pushes listeners and **never removes them**, so they accumulate one per render. Visit the screen three times and a single session refresh starts three renders.
>
> **Measured consequence**
>
> An unscoped `#spilledRows .row` reads **40 rows from two different selections**. It is why `a spilled row says which band it was offered in` was already flaky: on unchanged files it failed 1 of 3 runs under one command and **4 of 4** when that spec ran alone.
>
> The test file was scoped to the last card as a mitigation, with the cause written down. **That mitigation cannot hide the defect** — every comparison is against `/api/select`'s answer for the current selection, so reading the wrong render still fails outright.
>
> **The fix, in two places**
>
> 1. **`screens/preview.js`** — a generation guard in `show()`: capture a token before the awaits, and abandon the render if it is no longer current when they resolve. The container clear must move to the point where the answer arrives, not before the request.
> 2. **`src/ui/public/app.js`** — `loadSessions()` should fire session listeners **on change only**, and `onSessionChange` should return an unsubscribe that `render()` calls, so listeners do not accumulate per render.
>
> **Check the neighbours before assuming preview is alone.** Any screen whose `render()` subscribes and whose loader awaits between a clear and an append has the same shape. `simulate.js` and `decay.js` both fetch after clearing; `watch.js` subscribes to the stream. This is a pattern to sweep, not a single site.
>
> **Done when**
>
> An overlapping `show()` cannot leave two renders on screen; session listeners fire on change and are removed with the render that made them; the neighbouring screens are checked and either fixed or recorded as safe with the reason; and a browser test starts two selections in flight at once and asserts exactly one of each card.
