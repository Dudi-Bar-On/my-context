---
id: RULE-playwright-is-how-the-ui-is-tested-and-it-is-the-most
type: rule
title: Playwright is how the UI is tested, and it is the most important test
status: active
severity: hard
always: true
summary: The interface is tested by actually loading it in a browser, the one check that can catch a page that reads correctly and behaves differently.
summary_of: 9ec3674eb8833b91
scope: []
tags:
  - ui
  - testing
  - playwright
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 1c5fe3bc44be502d
---

# Playwright is how the UI is tested, and it is the most important test

**Playwright is how the UI is tested, and it is the most important test this
project has.**

Every other check reads the file. Playwright loads it. That distinction is not
theoretical here: this project has repeatedly shipped a UI file that read
correctly and behaved differently, most starkly when the mockup's JavaScript
turned out **never to have run at all** — a literal `</script>` inside a string
had ended the element, an `alert(1)` fired on load, and nothing was reviewable
until a browser said so.

**What a Playwright test must cover, because these are the failures this UI
actually has:**

- **The page runs.** Zero console errors, on every screen, not just the landing
  one.
- **Every screen renders.** Navigate to each one and assert it drew — a screen
  that throws is invisible to any file-level check.
- **Both languages, and the round trip.** Switch to Hebrew and back, and assert
  the English is restored *identically*. A one-way switch that quietly flattens
  markup passed every static check this project had.
- **Bidi isolation survives.** LTR identifiers inside Hebrew prose stay
  isolated — counted, in both directions, not eyeballed.
- **Keyboard and focus**, in both writing directions.
- **Empty and error states**, which are where invented UI usually hides.
- **The print stylesheet**, which has already shipped printing a blank page.

**How it is installed, and why that is consistent.** Playwright is a
**devDependency**. `dependencies` is `{}` and stays `{}` — the constraint this
project holds is **zero RUNTIME dependencies and no build step**, and a test
tool violates neither. It is the first test dependency, which is worth stating
plainly rather than slipping in: everything until now has run on `node:test`
alone.

**The rule about what a test asserts.** Assert against the **mockup**, which is
the specification, never against whatever the implementation happens to
produce. A test written by reading the built page is a test that passes for
whatever was built, including the wrong thing.

**And do not let it replace the other checks.** The static checkers catch what a
browser cannot — EN/HE key parity in both directions, dead translation keys,
physical CSS, a truncated script element. Playwright catches what they cannot.
Neither is a substitute, and the file-level ones are cheap enough to run far
more often.
