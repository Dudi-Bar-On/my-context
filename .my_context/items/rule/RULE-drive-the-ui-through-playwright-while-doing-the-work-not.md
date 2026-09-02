---
id: RULE-drive-the-ui-through-playwright-while-doing-the-work-not
type: rule
title: drive the UI through Playwright while doing the work, not only at merge
status: active
severity: hard
always: true
summary: Open and use the interface yourself while you build it, in a visible window and in the browser people really use, then leave behind a test that repeats it.
summary_of: 925a8de3e0588a45
scope: []
tags:
  - ui
  - testing
  - playwright
  - workflow
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: c40436c88d9b8205
---

# drive the UI through Playwright while doing the work, not only at merge

**Playwright is not optional and it is not a merge-time formality. UI work is verified BY DRIVING THE INTERFACE, through Playwright, WHILE the work is being done.**

**The distinction this rule exists to enforce.** [[RULE-playwright-is-how-the-ui-is-tested-and-it-is-the-most]] says what a committed suite must cover. This says something different and easier to skip: **you drive the actual interface yourself, as a user would, before you claim it works.** A suite that runs in CI proves it still works. Driving it is how you find out whether it ever did.

**Reading the source is not testing the UI, and this project has the scars.** Every failure below read correctly and behaved differently:

- The mockup's JavaScript **never ran at all** — a literal script-closing tag inside a string had ended the element, and an `alert(1)` fired on load. No file-level check could see it.
- The language toggle **silently deleted five `PROPOSED` badges**. Hebrew rendered 7 where English rendered 12. Every static check passed.
- **Ten `aria-label`s stayed English** in the Hebrew UI, because `applyLang()` only called `replaceChildren`, which cannot reach an attribute. Invisible to sighted review and to every parity test, because the parity test could not see the attribute either.
- The print stylesheet has already shipped **printing a blank page**.

**What driving it means, concretely.** Navigate. Interact. Switch language and switch back. Tab through it in both writing directions. Open the empty and error states. Count what you assert instead of eyeballing it — badges, isolated runs, translated attributes. Read the console on **every** screen, not the first one.

**NOT HEADLESS.** Owner ruling, 2026-08-22: "when you use playwright do not use it headless, i want to see the debug and test activities you make." This is not a preference about windows. This project's entire failure mode has been an agent reporting green numbers over a page nobody had looked at, and a headless run is that same failure with a browser attached: the work happens where the owner cannot see it, and the only evidence left is a number the agent chose to report. Headed, the run is watchable while it happens. `e2e/playwright.config.ts` sets `headless: process.env['CI'] !== undefined`, so local runs are visible and a hosted runner with no display still works.

**AND IT MUST BE REAL CHROME, not only bundled Chromium.** Owner ruling, same day: it "also must occure correct on the chrom browser". Playwright's bundled Chromium and shipped Google Chrome differ exactly where this app lives - print, codecs, component updates, the policies a real profile carries. The browser the owner actually opens is the one that decides whether it works. The config carries a second project, `channel: 'chrome'`, which drives the installed Chrome and fails loudly rather than skipping when there is none.

**And leave something behind that re-runs.** A report saying "I checked it in a browser" is worth exactly one reading. The check that survives is the one committed as a spec. If driving it by hand found something, **that finding becomes a test** — otherwise the next change reintroduces it and nobody notices.

**There is no excuse left.** The Playwright MCP tools are installed on this machine, so a browser is one call away for the assistant and for any subagent doing UI work. Add it to the tools consulted under [[RULE-ui-work-consults-every-installed-design-frontend-and-browser]], whose list predates the install.

**What it does not replace.** The static checkers catch what a browser cannot — EN/HE key parity in both directions, dead keys, physical CSS, a truncated script element. Playwright catches what they cannot. Neither substitutes for the other, and the file-level ones are cheap enough to run far more often.

Related: [[RULE-a-ui-change-is-not-verified-until-someone-has-looked-at-it]] names the instrument and the order it is used in.
