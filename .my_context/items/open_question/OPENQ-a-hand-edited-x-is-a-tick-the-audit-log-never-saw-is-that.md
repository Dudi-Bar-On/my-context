---
id: OPENQ-a-hand-edited-x-is-a-tick-the-audit-log-never-saw-is-that
type: open_question
title: "a hand-edited `- [x]` is a tick the audit log never saw: is that progress, a defect, or a doctor check?"
status: active
severity: soft
always: false
summary: When someone ticks a checklist box by hand and the record of activity never saw it, does that count as progress, as a fault, or as something to report?
summary_of: c2a64775463491ca
scope: []
tags:
  - v2
  - ui
  - "screen:proc"
  - proposed
  - walk
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: f4e0837512a38375
blocks: "the Procedures step table, plan:walk seq:96, and `pr.md`'s claim that a procedure cannot disagree with itself"
---

# a hand-edited `- [x]` is a tick the audit log never saw: is that progress, a defect, or a doctor check?

Raised 2026-08-29 under plan:walk seq:5, from `src/ui/public/screens/proc.js`'s header, which reports it and deliberately does not resolve it: *"a mockup change, a parser change or a `doctor` check is the owner's call."*

**TWO STORES HOLD ONE FACT.** The item parser reads a checkbox out of the Markdown and stores it on the step (`src/core/item.ts` · `const step: Step = { text: m[2]!, checked: m[1] === 'x' };` · ~349). The endpoint does not serve that value: it serves the AUDIT LOG's replay (`src/ui/proc-model.ts` · `steps: item.steps.map((step, i) => ({ n: i + 1, text: step.text, checked: done.has(i + 1) })),` · ~493). So a person who edits `- [ ]` to `- [x]` by hand has ticked a box the log knows nothing about, and this screen draws it unticked.

**THE PRODUCT CONTRADICTS ITSELF IN PRINT ABOUT IT.** `pr.md`, drawn directly beneath the step table, ends *"there is no second place a procedure could disagree with itself."* There is. `proc-model.ts` serves a `file-ticks-are-not-progress` disclosure saying so, and `screens/proc.js` renders that disclosure under the very paragraph it contradicts. That is the correct drawing for a screen and the wrong resting state for a product.

**THREE REMEDIES, and choosing between them is the owner's because each concedes something different:**

1. **A COPY CHANGE.** `pr.md` stops asserting the invariant, and the divergence is documented as intended. Cheapest, and it accepts that the file and the screen may disagree forever with only one screen ever saying so.
2. **A PARSER CHANGE.** `checked` stops being stored on the item, so the Markdown carries no tick anyone can hand-edit. Truest to `pr.md` as written, and it is a change to what a procedure looks like on disk: the file stops reading as a checklist, which is one of the reasons items are Markdown at all.
3. **A DOCTOR CHECK.** Both stores stay, and `mycontext doctor` reports a procedure whose file ticks and whose log disagree. Nothing is lost, the divergence becomes visible outside the one screen that currently discloses it, and it is the only remedy that also catches the reverse case — the log ahead of the file.

**RECOMMENDATION: 3, with the `pr.md` half of 1.** A doctor check keeps the Markdown honestly editable, which is the whole reason a step is a checkbox and not a database row, while removing the silent half of the divergence. And `pr.md` should stop asserting an invariant this build does not hold under any of the three answers.

**NOT the same question as who may tick a box** — `pr.w1`, `pr.w2` and `pr.w3` settle that, and nothing here reopens it. This is what a tick MEANS when two stores hold one.
