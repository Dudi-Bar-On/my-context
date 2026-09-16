---
id: KNOWN-rules-verify-answers-intact-for-an-entry-the-store-s-own
type: known_issue
title: rules verify answers intact for an entry the store’s own parser refuses to read
status: active
severity: soft
always: false
summary: The command that checks the rules are sound says they are, for a rule that cannot be read at all.
summary_of: 482115c27c309208
scope:
  - src/rules/integrity.ts
  - src/rules/schema.ts
  - src/cli/commands/rules.ts
  - test/**
tags:
  - v2
  - silent-failure
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 29394138dd70c42f
---

# rules verify answers intact for an entry the store’s own parser refuses to read

REPORTED BY A LANE ON 2026-09-16 AND LEFT UNFILED; REPRODUCED BY THE MAIN SESSION THE SAME DAY,
on a COPY of the store so nothing shipped was touched.

TAKE A VALID ENTRY, BREAK ITS FRONTMATTER FENCE (`---` → `--`), THEN RE-STAMP ITS CHECKSUM IN
THE MANIFEST. Both halves of the product were then asked about the same file:

    parseEntry(…)      → REFUSED: "no frontmatter: an entry is Markdown opening with a `---`
                         fenced block, exactly as a corpus item is."
    verifyManifest(…)  → ok: TRUE

The store’s own parser knows the entry is unreadable. The command whose entire job is to say
the store is sound says it is intact — and `mycontext rules verify` prints "the rule store is
intact — every entry matches the checksum that shipped with it" and exits 0.

── WHY, AND THE SENTENCE IS ALREADY TRUE ──────────────────────────

**A CHECKSUM SAYS UNCHANGED. IT NEVER SAYS VALID.** `verifyManifest` compares bytes to a
recorded digest and nothing else, so anything sealed passes — including something that was
sealed while already broken. The verdict’s own vocabulary gives it away: its `why` values are
`altered`, `missing`, `unknown`. There is no value for "present, unaltered, and unreadable",
because that state was never considered.

THIS IS THE SAME FAMILY AS `KNOWN-running-the-test-suite-can-leave-the-shipped-rule-store`, and
the two together are the shape of the problem: that one is a store whose seal is CONSISTENT BUT
NOT THE SHIPPED ONE; this one is a store whose seal is consistent and whose CONTENT IS GARBAGE.
A checksum cannot see either, and `verify` is the only gate a reader has.

── WHY IT MATTERS ─────────────────────────────────────

The rule store is delivered at session start and OUTRANKS every other source in a consuming
session. An entry that cannot parse is an entry that is not delivered — and the reader is told
the store is intact while a rule silently governs nothing. That is
`nothing-to-do-and-could-not-look-are-different-answers` at the level of a whole gate: "I
checked and it is fine" and "I checked the only thing I know how to check" are the same answer
today.

── WHAT WOULD FIX IT ───────────────────────────────────

PARSE EVERY ENTRY AS PART OF VERIFYING, and give the verdict a fourth `why` — `unreadable` —
so the three states stay three values. The parser already exists and already returns a usable
refusal; nothing new has to be written to know the answer, only to ASK it.

AND HOLD IT WITH A PROOF THAT CAN GO RED: build a temp store, break an entry, re-stamp it, and
assert `verify` refuses. `KNOWN-running-the-test-suite-can-leave-the-shipped-rule-store` is the
reason that fixture must be a COPY — the existing rules test damages the real shipped directory
to make a similar point, and that is how the store gets left dirty.
