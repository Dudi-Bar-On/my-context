---
id: KNOWN-two-e2e-harness-defects-make-specs-fail-for-reasons-that
type: known_issue
title: two e2e harness defects make specs fail for reasons that have nothing to do with the product
status: active
severity: soft
always: false
summary: A reload respends the one-shot nonce, and a test asserting over source bytes reddens when a comment is edited.
summary_of: 5de7f10337c7b291
scope:
  - e2e/helpers.ts
  - e2e/strip-fields.spec.ts
  - test/ui/pane-float.test.ts
  - test/ui/pane-route.test.ts
tags:
  - v2
  - silent-failure
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: ebb01c537bf0ffc4
---

# two e2e harness defects make specs fail for reasons that have nothing to do with the product

BOTH VERIFIED AGAINST PRISTINE `HEAD` BYTES ON 2026-09-17, so neither is a lane’s doing.

── 1. `page.reload()` RESPENDS THE ONE-SHOT NONCE ────────────────

The handoff nonce in the URL fragment is worth ONE browser ONCE — that is the design, and a second
use is correctly refused. A spec calling `page.reload()` therefore comes back TOKENLESS, and then
measures an empty page against a real floor: `e2e/strip-fields.spec.ts` counts 2 fields against a
floor of 10, and three `app-layout.spec.ts` tests fail the same way.

**THE TEST IS RED FOR A REASON THAT IS NOT ABOUT THE THING IT TESTS**, which is the worst kind of
red: it trains a reader to ignore it. `e2e/helpers.ts` should own reloading — mint a fresh nonce
and redeem it, or restore the token — so no spec has to know the rule.

RELATED, SAME FILE: **`mintNonce` has no retry**, and Node’s `fetch` returns `ECONNRESET` on a
reused keep-alive connection on this machine. That is a flake every spec inherits.

── 2. A TEST THAT ASSERTS OVER SOURCE BYTES ───────────────────

`test/ui/pane-float.test.ts` asserts over `app.js`’s BYTES. **Naming the panel frame’s non-modal
open IN A COMMENT turned seventeen item-pane tests red** — a documentation change reddening tests
about behaviour that did not move.

A test over bytes cannot tell a comment from code, so it forbids writing about the thing it
guards. In a repository whose source comments carry this much reasoning, that is a real tax and it
will be paid again. Whatever it is protecting deserves an assertion over BEHAVIOUR, or a much
narrower pattern that says in its own words why bytes are the only available proxy.

AND ONE MORE IN THE SAME AREA: **`pane-route.test.ts`’s DOM stand-in has no
`classList.toggle(name, force)`** — the two-argument form. A `TypeError` there takes the whole
shell down rather than failing one assertion, so the first symptom is unrelated to the cause.
