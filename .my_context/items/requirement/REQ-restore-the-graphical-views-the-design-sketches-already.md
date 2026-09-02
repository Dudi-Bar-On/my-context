---
id: REQ-restore-the-graphical-views-the-design-sketches-already
type: requirement
title: Restore the graphical views the design sketches already worked out
status: active
severity: soft
always: true
summary: The charts and diagrams the early design work already settled must be brought back, each one plotting real recorded data or admitting it cannot.
summary_of: 429cbc732c504a50
scope: []
tags:
  - ui
  - dataviz
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-19
valid_until: null
checksum: 4accd325a5801a6f
---

# Restore the graphical views the design sketches already worked out

The web UI must carry the graphical views that the design sketches already
worked out. An inventory of `05-dataviz.html`, the pre-rebuild mockup and six
other sketches found **29 distinct views**; the current mockup has few of them.

**The requirement.** Restore the 18 named below, and where the current mockup
shows a weaker version of one the sketches did better, **replace the weaker one**
rather than keeping both. The sketch is the reference for what each view plots
and what question it answers.

**RESTORE THESE**

**Budget and admission**

1. **Admission staircase** — budget against items, drawn as eviction steps.
2. **Threshold ladder and slider** — the rungs where the answer changes.
3. **Four-tier budget ribbon with a ghost lane** — all four tiers, spills drawn
   below the line rather than omitted.
4. **Spill-ratio diverging bar** — delivered against spilled, per item.
5. **Tier fits-ratio chips** — "five of six", colour flipping at the boundary.
6. **Token bar with a not-recorded void** — absent tokens hatched, **never
   drawn as zero**. An unrecorded quantity and a measured zero are different
   claims and must not share an appearance.

**Time and decay**

7. **Recency comb** — days since injection, one tooth per item, never bucketed.
8. **90-day heatstrip** — daily delivery and spill cells.
9. **Per-item delivery sparkline** — twelve weekly bars, in the detail pane.
10. **Activity pulse** — audit volume over time.
11. **Regime boundary rule** — a focus change drawn as a rule across the feed,
    because the series either side of it is not comparable.

**Scope and coverage**

12. **Per-directory coverage magnitude** — governed over total, per directory.
13. **Live glob-match highlight strip** — matching files lit while you type.

**Relations and change**

14. **Ego-graph legend with edge labels** — relation type and severity encoded,
    absorbing the dangling-edges list.
15. **Before-after delta rows** — old struck, new highlighted, direction shown.
16. **Word-level revision diff** — which words a revision actually changes.

**Injection reasoning**

17. **Gate ladder** — `select()`'s gates in order, the binding failure
    highlighted. This is the visual form of "the first gate that failed".

**Configuration**

18. **`scopePolicy` blast-radius preview** — how many items stop injecting.

**Deferred, not dropped:** the **density rail** (whole-tree coverage beside the
scroller) is worth building only once the tree is virtualised.

**DELIBERATELY NOT RESTORED**

Ten views were judged not worth restoring, and the reasons are recorded so the
question is not reopened: the session volume column chart and the
injections-per-week decay chart both duplicate views above; the `agentEdits`
impact preview is answered by a sentence; the four-step first-run tick track has
no screen to live on; the suppressed-marker zero-state is already handled by the
zero-data toggle; dangling edges fold into the ego-graph legend; the coverage
performance readout and the measured contrast tables are design evidence and
test output, not user views; the ASCII terminal transcript was replaced by the
armed/landed state machine; the refusal ledger restates prose.

**WHY THIS REQUIREMENT EXISTS**

The mockup was regenerated once and silently dropped six screens; that was
caught and restored. The graphical views are the same failure one level down — a
rebuild kept the screens and lost the charts inside them. **A regeneration is not
a refactor: any rebuild of the mockup must diff its inventory against the
previous revision and account for every element that disappeared.**

**WHAT A RESTORED VIEW MUST SATISFY**

- **No external libraries.** The CSP is `default-src 'none'; script-src 'self';
  style-src 'self'`. Inline SVG, CSS, or hand-drawn — never a CDN chart library.
- **No `innerHTML`.** Every node constructed. A chart built from an HTML string
  cannot ship.
- **Logical CSS properties only**, and an EN/HE pair for every label. A view that
  cannot be mirrored is not finished.
- **Real data, or an honest label.** A view whose data the product does not
  record is marked proposed **in the view itself**. Inventing a plotted quantity
  is this project's characteristic defect and has been caught twice.
- **The unit must be the true one.** Decay is measured in *sessions*, not time —
  the ledger holds one row per (session, item, tier) and a repeat injection
  collides, so there is no time series. A chart against a clock is wrong even
  where it looks better.

**Scope note.** This constrains the mockup and, downstream, the shipped UI. It
does not authorise building the web UI.
