---
id: TASK-a-misspelled-config-section-is-dropped-in-silence-for-every
type: task
title: a misspelled config section is dropped in silence for every terminal user
status: active
severity: soft
always: false
summary: A typo in a settings file is ignored without warning, so someone working at a terminal believes a setting applied when it never did.
summary_of: 8018dc48d85df0ea
scope: []
tags:
  - v2
  - config
  - cli
  - walk
  - "plan:walk"
  - "seq:110"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/skipped.md"
source_anchor: null
source_checksum: 7337657f8ea9b7f3
valid_from: 2026-08-29
valid_until: null
checksum: acc8598569b23d39
plan: walk
seq: "110"
state: done
priority: "1"
source: "found by plan:rulings seq:42, 2026-08-29"
---

# a misspelled config section is dropped in silence for every terminal user

> > Found 2026-08-29 by `plan:rulings seq:42` while confirming that no other config key is validated-but-unread. `ui.enabled` was the last of those and is closed. This is the same defect one level up.
>
> **The defect**
>
> An **unknown top-level key is accepted, carried, and disclosed to nobody at a terminal.** `resolveConfig` collects it into `Config.skippedKeys`, and `skippedKeyNotice()` composes the one sentence that would tell a reader about it — and the *only* caller is the web UI's `/api/config`. **No CLI surface calls it.**
>
> **Verified live.** With `"uiu": { "enabled": false }` in `config.json` — one transposed letter away from `ui` — `mycontext status` prints `profile "standard"` and says nothing at all; `mycontext doctor --summary` reports `0 error(s), 0 warning(s), 0 note(s)`.
>
> So a user who misspells a section key in a terminal-only workflow is told **nothing**, and their configuration silently does not apply. They will believe it did.
>
> **The field's own docblock already calls this a duty**
>
> > *"a surface that shows config to a human and does not print this notice has re-created the silent drop this field exists to end"*
>
> `status.ts` and `doctor` are both such surfaces and both do exactly that. The rule was written down and then not applied to the two places that needed it most.
>
> **Why it bites hardest in a terminal**
>
> The web UI reader can see the notice. But the person most likely to have hand-edited `config.json` is at a terminal, and the CLI is where the mistake is made. A notice that only appears on the surface the user is not looking at is not a disclosure.
>
> **Done when**
>
> `mycontext status` and `mycontext doctor` both print the skipped-key notice when `skippedKeys` is non-empty; a test drives a real misspelled key through each and asserts the sentence appears; and the assertion names the KEY rather than merely a non-empty output, so a notice that fires without saying which key is not mistaken for a fix.
