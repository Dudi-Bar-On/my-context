---
id: TASK-nothing-translated-the-shell-markup-ten-data-t-labels-were
type: task
title: "nothing translated the shell markup: ten data-t labels were English on the Hebrew page"
status: active
severity: soft
always: false
summary: Ten labels stayed in English on the Hebrew page for months; the fix is in, but nothing yet stops it happening again.
summary_of: cb8840e18ef1b703
acknowledged:
  - body_disagrees_with_meta@ac65ef6e0e6f5d91
scope: []
tags:
  - v2
  - ui
  - i18n
  - a11y
  - "plan:walk"
  - "seq:43"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 014589d1b67d0229
plan: walk
seq: "43"
state: todo
priority: "2"
source: "found while building plan:walk seq:40, 2026-08-25"
---

# nothing translated the shell markup: ten data-t labels were English on the Hebrew page

2026-08-25: THE DEFECT WAS FOUND AND FIXED while building the pane s sparkline, code 5e69257.

THE DEFECT. `src/ui/public/index.html` carries TEN `data-t` attributes -- the item pane s six `<dl>` labels plus `pane.body`, `pane.hist`, `pane.histn` and `pane.well`. The file s own comment says they "are translated in place by i18n.js's applyStatic". THERE WAS NO `applyStatic`. `applyLanguage()` sets `lang` and `dir` and nothing else, and nothing anywhere queried `[data-t]`.

SO THOSE TEN RENDERED THEIR AUTHORED ENGLISH ON THE HEBREW PAGE, and had since the pane was built. A Hebrew reader opening any item saw `type`, `status`, `tier`, `scope`, `governs`, `file` and "Body - as authored" in English, inside an RTL layout.

NO GATE COULD SEE IT, and the reason is the now-familiar one: `strings-parity` compares the two tables against the mockup s `data-t` SET, and all ten keys are present in all three files. A key that exists and is never rendered still matches. The e2e Hebrew sweep asserts every screen RENDERS in Hebrew, not that every string is Hebrew.

THE FIX: `applyStatic(document)` at boot, filling every `[data-t]` from the table with `translate()` -- nodes, not `textContent`, because these keys carry `{b:}`/`{i:}` emphasis and `{m:}` runs and assigning text would flatten them (owner ruling A1). `replaceChildren` first, so the authored English that seeds the markup is REPLACED.

WHY THIS ITEM EXISTS AT ALL, since the defect is fixed: the fix was made in passing while building something else, and it deserves a TEST rather than a comment. WHAT TO ADD: an assertion that after boot in Hebrew, no `[data-t]` element in the shell still holds its authored English -- the same shape as the existing per-screen Hebrew assertions, pointed at the shell instead of at a screen. Without it the next element authored with English seed text and a `data-t` regresses silently, exactly as these ten did.

AND CHECK THE MOCKUP S OWN SCANNER while there: it has one, and the app deliberately does not copy its behaviour ("Take the mockup s DESIGN, never its BEHAVIOUR"). The two now agree on the outcome; they should be verified to agree on the SET of elements they translate.
