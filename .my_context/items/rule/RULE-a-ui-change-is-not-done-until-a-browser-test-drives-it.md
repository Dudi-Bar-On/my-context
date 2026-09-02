---
id: RULE-a-ui-change-is-not-done-until-a-browser-test-drives-it
type: rule
title: a UI change is not done until a browser test drives it
status: active
severity: hard
always: true
summary: A change to a screen is not finished until a test clicks, types and reads it the way a person would; checking the page has the right parts is not enough.
summary_of: f13b132dd0d5d265
scope: []
tags:
  - v2
  - ui
  - testing
  - process
origin: human
source_file: null
source_anchor: null
source_checksum: 1bd3fe53d8854b21
valid_from: 2026-08-27
valid_until: null
checksum: c5a467db33e9ee1b
---

# a UI change is not done until a browser test drives it

> Owner instruction, 2026-08-28: *"every ui implementation and fixes should be
> tested from the ui itself"*.
>
> A UI change is not done when the node suite is green. It is done when a browser
> test DRIVES it the way a person does — clicks the control, types the input,
> reads what comes back — and that test has been watched fail without the change.
>
> **The measurement that produced this rule.** Execute shipped across five days
> and eight tasks. Every gate was green at every step: typecheck, ~4,900 node
> tests, four static gates, 176 browser tests. In one afternoon the owner found
> three defects by clicking:
>
>   * the confirm could not copy the corpus at all while a server was running
>     (the SQLite index is locked on Windows) — every boundary command
>     un-runnable, always;
>   * repository-relative paths resolved against a temp directory, so `add --file`
>     was refused as unreadable and a file inside the repository was reported
>     "outside this repository";
>   * a command that changes nothing drew a blank confirm that said nothing.
>
> Then the suite was counted. **Until that day, not one browser spec had ever
> pressed the Execute button.** Seven of twenty-two specs perform no click, fill
> or select at all. The largest spec, `app-layout.spec.ts`, has seventeen tests
> and five interactions. And the trend runs the wrong way: the OLDEST specs
> (2026-08-20/21) are the most interactive, and the newest are element inventories
> compared against the mockup.
>
> That is the shape this corpus already names — a gate correct about what it
> measured and silent about what it missed — grown to the size of a whole suite.
> Parity specs are not worthless: they catch real drift, and they caught it. But
> they answer "does the DOM match the design" and were allowed to stand in for
> "does the feature work", which they cannot do, and every one of the three
> defects lived behind the UI where no inventory could reach.
>
> **What this rule requires.** A change to a screen, a control, or anything a
> screen calls ships with a spec that reaches the state the change lives in, acts
> on it, and asserts what the user would see. Reaching the state is a STEP that
> fails as itself — a screen is not a state, and most controls in this product do
> not exist until something is typed or selected. Proving it is not optional
> either: reintroduce the defect, watch the test go red, restore it. A UI test
> that has never failed has not been shown to test anything.
