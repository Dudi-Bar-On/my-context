---
id: RULE-a-ui-change-is-not-verified-until-someone-has-looked-at-it
type: rule
title: "Looking is part of the test: it does not pass if a human cannot see what it should show"
status: active
severity: hard
always: false
summary: "Open it and look: if a person cannot see the thing that should be there, the change has not passed, however many automatic checks came back green."
summary_of: 92ceaec4e82b7616
scope: []
tags:
  - v2
  - ui
  - governance
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 7cd303be036b0cea
---

# Looking is part of the test: it does not pass if a human cannot see what it should show

Owner ruling, 2026-08-22, in the owner's own words: looking, as a human does, is part of your test. It does not pass if a human cannot see what you think they should see.

This is a PASS CRITERION, not a practice. A change that renders is not a change that passed. The question is not did the assertion hold, it is: open it, look at it, and is the thing that should be visible actually visible to a person.

It was recorded because gates said yes while the product said no. On 2026-08-22, 3,718 tests passed over a page whose right pane rendered the entire body text of every item across four screens of scroll, whose two tilted planes sheared because the grid that gives them a column had not landed, and whose rail was raw blue anchors. Every one of those was invisible to every gate in the suite. The owner had to say it looked horrible while I was reporting seven green gates.

The same day, a second case: the one thing on screen was an exit banner saying the server had exited. The server was fine - the page simply had no token - and the banner had no CSS, so the true state was both unstyled and misdescribed. Nothing in the suite could fail for either reason.

WHAT IT REQUIRES

Render the real product - not the mockup, not a fixture - against this repository's own corpus, drive it with the project's own @playwright/test, and LOOK at the screenshot. Attach it to the report. Before and after when something is being fixed. If a screen is meant to show data, the screenshot shows the data; if a message is meant to explain a state, the screenshot shows a person could read and act on it.

A screen you did not render is a screen you did not test. A screenshot you did not look at is a screenshot you did not take.

This binds the coordinator as much as an agent. I merged a UI on gate numbers and told the owner it worked.

THE TOOL, NAMED

Playwright's own toHaveScreenshot, from @playwright/test, which this repository already carries as one of its three devDependencies. It is the standard instrument for visual regression and it is already installed. No second tool was adopted, and none should be without a reason this one cannot meet.

Why not Applitools Eyes, Percy, Chromatic or Argos. Those are the enterprise visual-review products and they are good at what they do. They are refused here on a ground that is not about quality: this UI is dogfooded against the real corpus, so its screenshots contain the owner's actual items - decisions, constraints, private project notes. Uploading those to a third-party cloud to be stored and diffed exfiltrates the corpus. A local-first product gets a local-first instrument. Secondary but real: this project has zero runtime dependencies and three devDependencies, and none of those products is a small addition.

The hard half of pixel comparison is already done: e2e/playwright.config.ts pins colorScheme, locale, timezoneId, viewport and deviceScaleFactor, so a layout assertion means the same thing on a hosted runner as on the owner's workstation.

HOW IT IS USED, BECAUSE THE TOOL ALONE WOULD NOT HAVE CAUGHT THIS

toHaveScreenshot writes its baseline on the FIRST run. Adopted naively the day before the diagonal was found, it would have recorded the fan as the reference and passed, in green, forever. A pixel baseline is worth exactly the look a human gave it on the day they accepted it. So the order is:

1. Shape assertions first, which need no baseline and can therefore be made red against a page that is still wrong. e2e/app-layout.spec.ts is the pattern: no element establishing a perspective may be taller than the viewport; the page never scrolls sideways on any screen; no row of the shell grid is an empty band. Every one of those was made red before it was trusted.

2. A screenshot baseline only after a human has looked at that exact image and accepted it. An unreviewed baseline is worse than none, because it reads as coverage it does not have.

3. The look itself, attached to the report, before and after.

AND THE SUITE MUST OPEN THE PRODUCT

For six weeks e2e/ opened docs/design/web-ui-mockup.html over file:// - the specification asserting that it is itself - and its header said so plainly. That premise expired when the shell landed and nobody moved the suite. e2e/app.ts now starts the real server over the real corpus. A browser suite pointed at the design of record is not a test of the product, however green it is.

PRACTICAL NOTES so nobody rediscovers them: file:// is blocked for the MCP browser tool, so serve locally or drive Playwright directly; the handoff nonce is one-shot, so opening a URL spends it and the next person gets a page with no token - let the app redeem it rather than redeeming it in the test.

Related: [[RULE-everything-in-the-mockup-gets-built-and-a-proposal-to-change]] - a proposal to change the mockup needs a screenshot for the same reason, from the other direction.
