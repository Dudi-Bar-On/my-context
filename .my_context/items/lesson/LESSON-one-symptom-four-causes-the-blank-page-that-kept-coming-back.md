---
id: LESSON-one-symptom-four-causes-the-blank-page-that-kept-coming-back
type: lesson
title: "One symptom, four causes: the blank page that kept coming back"
status: active
severity: soft
always: false
summary: When the same symptom returns after a fix that was verified, the likely reason is a second cause, not a bad fix.
summary_of: 179bd09528283fb5
scope: []
tags:
  - v2
  - method
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 0214a0443cbc7206
---

# One symptom, four causes: the blank page that kept coming back

The owner reported a blank screen five separate times over two days. Each time it was fixed and each time it came back, and it took far too long to accept what that pattern meant: the fix had been correct, for a different bug.

There were four, and from the outside they were the same white rectangle.

One. The reload had no credential at all. The handoff nonce is one-shot and the fragment carrying it is erased on first load, so the second load presented nothing. Fixed with an HttpOnly cookie.

Two. Cookies are scoped to a HOST, not a port. 127.0.0.1:58901's cookie is sent to 127.0.0.1:58902, and the next server mints a different token - so a fresh page arriving with a VALID NONCE presented a mismatched token and /api/handoff refused it, because that route exempted only a missing token and not a wrong one.

Three. A stale cookie could not be cleared by anyone. HttpOnly means script cannot touch it, and with no nonce in the URL there was nothing left to re-handshake with. Permanent lockout until the user cleared cookies by hand.

Four. A nonce pasted into a LIVE page did nothing. Changing the hash of a page that is already loaded is a same-document navigation: main() never re-runs, so the nonce was never exchanged and the router read the hex as a screen name. This is the one that cost three wrong diagnoses in a row.

WHAT SHOULD HAVE BEEN DONE SOONER

Each of the first three fixes was verified - measured, before and after, against a real server - and each was genuinely correct. What was missing was the inference from recurrence: when a symptom returns after a verified fix, the remaining probability mass is not "the fix was wrong", it is "there is a second cause". Two more rounds were spent re-examining fixes that were fine.

WHAT SETTLED IT, EVENTUALLY

The server's own refusal log. It records the CHECK that refused, and it showed token-mismatch on every GET and NO REFUSAL AT ALL on POST /api/handoff - which meant the handoff had never been called, which pointed straight at the hash. The evidence had been sitting in the product's own audit trail for hours while three theories were tested against the browser.
