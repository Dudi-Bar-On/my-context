---
id: TASK-two-browser-gates-are-red-before-any-lane-touches-them-and
type: task
title: two browser gates are red before any lane touches them, and one of them is hiding its own size
status: active
severity: soft
always: false
summary: Two browser checks are red before anybody touches them, and one of them hides how big the problem is; the first failure was confirmed still true and nothing was changed.
summary_of: 5eabbe8d46ffe4a8
summary_was:
  - 2026-09-16 Two of the visual checks fail on the current code for reasons unrelated to the work in progress, so they cannot flag anything new until they are dealt with.
scope:
  - e2e/**
  - src/ui/public/**
tags:
  - v2
  - ui
  - "plan:ui-gates"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 3760d5e37f256919
plan: ui-gates
seq: "1"
state: done
priority: "2"
---

# two browser gates are red before any lane touches them, and one of them is hiding its own size

> Found by the archive/20+22+23 lane on 2026-09-08, which needed to know whether its own change had
> broken these before it could report. It had not, and the way that was established is the useful part
> of this item: the lane DISABLED its one new CSS rule and re-ran the failing test, which failed
> identically. So these two gates are red on the tree as it stands, independently of that work.
>
> WHAT IS RED, run through the project's own config (`npx playwright test --config
> e2e/playwright.config.ts <spec>`) at `--workers=1`, so contention is not the explanation:
>
>   e2e/chip-hue-authority.spec.ts   "a chip never carries its state in colour alone"
>   e2e/screen-parity.spec.ts        "every screen draws every KIND of element its mockup section
>                                     draws"
>
> FAILURE ONE, and the message names the defect exactly: `simulate "" class="chip ok"` - a chip with
> its state in its COLOUR and no word inside it. The rule that gate defends is this app's own: a
> distinction is carried by more than colour, so it survives a monochrome print, a colour-blind reader
> and the RTL flip. An empty `chip ok` on the Budget simulator carries nothing but green.
>
> FAILURE TWO is a LEDGER failure rather than a drawing failure, and its own message says what to do
> about it: "Read the mockup section and build it, or add a task and record it in KNOWN_GAPS - never
> delete a ledger entry to go green". Eight screens are short of the design of record and not in the
> ledger. Serially, the list was:
>
>   preview    div.gh, div.pinned.seg, i
>   coverage   span.chip.gov
>   injected   span.chip.gov
>   watch      div
>   graph      path.bearing.edge, path.dangling.edge, rect.missing.node, rect.more.node,
>              rect.node.superseded
>   learn      span.m
>   work       bdi, button, code, del, details.help, div.bound, div.cmd, div.cmdstate, div.helpbox,
>              h3, ins, span.chip.warn, span.small, span.v, summary, td, td.m, td.m.stale, td.small
>   packs      bdi.m
>
> CONVERSATIONS IS NOT IN THAT LIST, which is the other half of why this is filed by this lane rather
> than fixed by it: nothing here is on the surface the lane touched, and every screen named belongs to
> another plan.
>
> AND PARALLELISM MAKES IT WORSE, WHICH IS A SECOND FINDING AND NOT THE SAME ONE. At the config's own
> worker count the same run reported preview short of THIRTY-TWO selectors instead of three, and two
> further chip-hue tests failed as well ("no chip is invisible against the surface it sits on", "the
> stylesheet still owns a chip colour"), all of which pass alone. That is the contention
> `e2e/playwright.config.ts` already measured and capped workers for, and it is currently hiding the
> size of the real gap behind a bigger fake one - the exact failure mode that config's header says
> had "already hidden a real failure".
>
> WHAT THIS ITEM IS FOR: someone has to decide, per screen, whether each missing element is work to do
> or a gap to record, and that is a judgement per plan rather than one commit. Until then these two
> gates cannot tell a new regression from the standing one, which is the cost being carried.

── STILL OPEN 2026-09-16, AND THIS IS WHAT REMAINS ─────────────────────

NAMED-BUT-OPEN a537c99c — confirmed still true at HEAD and deliberately not fixed — the lane that looked was closing four other items and had no browser

WHAT THAT COMMIT ESTABLISHED, recorded here so nobody re-derives it: this plan is the only one at 0% and IT IS REAL WORK, NOT A STUB. Its first failure was confirmed still true at HEAD WITHOUT A BROWSER — the simulate screen appends the sentence as a SIBLING of the chip, so the chip's own text is empty, which is exactly the reported empty-chip finding.

WHAT REMAINS: all of it. The confirmation is a starting point, not a delivery.

The `NAMED-BUT-OPEN` line above is read by `npm run check:board`, which is what surfaced this item's naming in the first place.
