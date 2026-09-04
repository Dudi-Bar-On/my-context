---
id: TASK-ui3-task-0b-write-the-reconciliation-into-the-mockup
type: task
title: "ui3 task 0b: write the reconciliation into the mockup, and derive the audit-kind buttons"
status: active
severity: soft
always: false
summary: Apply the agreed wording decisions to the design file, and work the filter buttons out from the code rather than listing them by hand.
summary_of: 9b6c4302a35f1fdd
scope: []
tags:
  - "plan:ui3"
  - "seq:0b"
  - mockup
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 9fac40f0e0d3e646
plan: ui3
seq: 0b
state: done
priority: "1"
last_change: "2026-08-21T07:37:18Z"
progress: "100"
---

# ui3 task 0b: write the reconciliation into the mockup, and derive the audit-kind buttons

**Ruled 2026-08-21, after the owner read the reconciliation report.**

**What was decided**

**Adopt as written, plus the nine.** 12 ADOPT + 10 FOLD + 17 DROP from
`reports/2026-08-21-STRING-KEY-RECONCILIATION.md`, and the nine UNDECIDED keys adopt as a
family because the owner ruled that **the Ask screen queries the corpus too, via a tab
strip**. `ask.field.any` returns with them — a multi-field optional form needs an empty
option.

The mockup goes from 370 to roughly 393 keys. **Nothing renamed, nothing removed.** Three of
the new keys already have their Hebrew written inside the mockup's own script; the rest need
translating.

Three keys are respelled, each because the mockup already has a settled word for the
subject: `watch.injected` becomes `watch.delivered` (the mockup's prose says *delivered* in
five places; *injected* is the `audit_item.role` literal), `watch.spilledCount` becomes
`watch.spilled`, and `ask.projection.*` becomes `prov.*`. None of the three is among the
fourteen the KEY NAMING block freezes "exactly as declared".

**The audit-kind filter buttons are derived from `AUDIT_KINDS`** — six, not four. The
mockup's four were drawn when there were four kinds; `access` and `progress` landed later
and nothing redrew them. Deriving them also fixes a live bug: `t()` throws on an unknown
key, so a `` t(`watch.kind.${d.kind}`) `` lookup against an `access` or `progress` record
**blanks the screen**.

**How it must land**

**One commit, three files** — the mockup, `strings/en.js`, `strings/he.js`. The parity test
enforces equality in both directions and all three files are at exact parity today, so a
partial commit reddens immediately.

**Derive the three pinned e2e counts in the SAME commit.** `bidi.spec.ts` pins 382
`[data-t]` elements and 221 `.m` nodes; `language.spec.ts` pins 11 `data-t-aria`. All three
move. Three red specs left standing would read as evidence the adoption was wrong — which is
exactly the wrong-reason failure `strings-parity.test.ts`'s own header warns about, and the
reason that suite derives its count instead of pinning it.

**Correct plan 3 for the 17 DROPs and the three respellings**, so the two documents stop
disagreeing on purpose.

**Not in scope, but adjacent and recorded**

`AUDIT_OPS` is hand-copied into a mockup block in plan 3 and is short **six**: `ui-refused`,
the three `step-*`, plus `subagent-start` and `post-tool-use-failure` — the last two being
drift nobody had caught. Whoever builds the Ask view must derive from `AUDIT_OPS` rather
than respell it. Dropping `ask.field.op` / `.kind` / `.origin` makes those lists literal
renderings of the enums, which is what forces the import.

`src/ui/public/i18n.js` still does not exist — only `strings/en.js` and `strings/he.js`.
Nothing here depends on it, but `{mv:state}` is the first key in this set that a
string-returning `t()` would render wrong, which makes it a useful canary for ui1 task 16.
