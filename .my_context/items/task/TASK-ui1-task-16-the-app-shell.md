---
id: TASK-ui1-task-16-the-app-shell
type: task
title: "ui1 task 16: The app shell"
status: active
severity: soft
always: false
summary: "The frame around every screen: starting up, language, moving between screens, and noticing when the server has gone away."
summary_of: 7ac0de5323bff890
scope: []
tags:
  - "plan:ui1"
  - "seq:16"
  - "state:done"
  - v2
  - ui
  - "reconcile:rewritten"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 20d94f58e150b9b9
plan: ui1
seq: "16"
state: done
progress: "0"
source: "my-context/docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md#task-16"
last_change: "2026-08-20T00:00:00Z"
priority: "3"
---

# ui1 task 16: The app shell

The app shell — bootstrap, heartbeat, i18n, router, exit banner

Task 16 of the ui1 plan. The full specification is the task section itself: my-context/docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md at line 5082 — that file is the authority, and this item tracks state only.

**The mockup's exit banner is fired by a FAKE timer, and the real shell must not inherit it.**

The mockup runs a 900 ms interval that unhides `#exited` at beat 60, so the banner appears **54 seconds after load, unconditionally**, and again 54 seconds after every dismissal. Nothing resets the counter except the OK button, because the mockup has nothing to poll. Carried across verbatim, this reports a healthy server as exited every 54 seconds.

The real shell polls `/api/ping` — landed with `server.ts`, ui1 task 13 — and resets the counter on every successful response. Then the banner means what it says.

Reported by the owner from a Playwright run on 2026-08-21, having reasonably taken the mockup for the real frontend. Worth knowing why that is easy to do: **all 21 e2e specs load `MOCKUP_URL`** (`e2e/mockup.ts` resolves it to `docs/design/web-ui-mockup.html`), and `src/ui/public/index.html` is still a 253-byte shell with an empty body. There is no real frontend to look at yet, so every browser run in this campaign has been the mockup.

Related: the string-key reconciliation folds `watch.streamEnded` into this same banner (`ex.msg`), so whatever drives it drives the Watch screen's stream-ended state too.

**Reconciliation against the visual repaint, 2026-08-21 (repaint plan Task 13) — REWRITTEN.** The mockup's theme button and this task's own placeholder styles.css palette are gone with the repaint: dark only, no theme toggle. Task 16's own section now specifies populating styles.css by copying the repainted mockup's token layer and primitive classes verbatim (with a parity test), not from a second hand-written palette. See docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md Task 16 for the corrected text.
