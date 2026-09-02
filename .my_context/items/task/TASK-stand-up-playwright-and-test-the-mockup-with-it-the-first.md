---
id: TASK-stand-up-playwright-and-test-the-mockup-with-it-the-first
type: task
title: stand up Playwright and test the mockup with it - the first test dependency
status: active
severity: soft
always: false
summary: Start testing in a real browser, beginning with the design file, so what is now hand-checked once becomes something that re-runs itself.
summary_of: 20b797de5ff5abef
scope: []
tags:
  - "plan:rulings"
  - "seq:27"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: b6409269a5e51af8
plan: rulings
seq: "27"
state: done
progress: "100"
priority: "1"
source: .my_context/items/rule/RULE-playwright-is-how-the-ui-is-tested-and-it-is-the-most.md
last_change: "2026-08-20T17:09:50Z"
---

# stand up Playwright and test the mockup with it - the first test dependency

RULE-playwright-is-how-the-ui-is-tested-and-it-is-the-most is active and NOTHING HAS USED IT. devDependencies are still typescript and @types/node only.

**Do it against the MOCKUP, now, before the real UI exists.** The rule's own worked example is the mockup: its JavaScript once turned out never to have run at all, because a literal script-closing tag inside a string ended the element - and nothing was reviewable until a browser said so. The mockup is the specification, it is a real HTML file, and it changes constantly. It is testable today.

**Why now rather than after ui1 T16.** This session made more than twenty mockup changes - 329 to 351 keys, a slot grammar, ten aria-labels, five relocated badges, a fourth marker coming - and every one was verified by an agent driving Chrome DevTools MCP BY HAND, once, non-repeatably. Nothing re-checks any of it. A suite that lands before mockup pass 2 verifies that pass; one that lands after only pins whatever pass 2 produced.

**What it must cover, from the rule:** the page runs with zero console errors on EVERY screen, not just the landing one; every screen renders; both languages AND the round trip, asserting English is restored identically; bidi isolation counted in both directions rather than eyeballed; keyboard and focus in both writing directions; empty and error states; and the print stylesheet, which has already shipped printing a blank page.

**Assert against the mockup, never against what the implementation happens to produce.** A test written by reading the built page passes for whatever was built, including the wrong thing.

**It is the FIRST test dependency and that is worth stating plainly rather than slipping in.** Everything until now runs on node:test alone. The rule already permits it: dependencies stays {}, the constraint is zero RUNTIME dependencies and no build step, and a test tool violates neither. Check what it does to CI time and to npm ci on both runners before assuming it is free.

**It does not replace the static checkers.** They catch what a browser cannot - key parity in both directions, dead translation keys, physical CSS, a truncated script element. Playwright catches what they cannot. Run the cheap ones far more often.

Two known things for it to pin immediately: the language toggle must not destroy the five PROPOSED badges (it did, until this session), and data-t-aria labels must actually change language (they did not, because applyLang only called replaceChildren, which cannot reach an attribute).
