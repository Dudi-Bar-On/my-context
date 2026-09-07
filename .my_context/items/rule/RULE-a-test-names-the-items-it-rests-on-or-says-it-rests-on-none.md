---
id: RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
type: rule
title: a test names the items it rests on, or says it rests on none and why
status: active
severity: hard
always: true
summary: A test says which project rules it assumes, so that reversing a rule shows you which tests were built on it.
summary_of: 70bbab426b930f7c
scope:
  - test/**
  - e2e/**
tags:
  - v2
  - testing
  - governance
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: b02be3400b66ee02
---

# a test names the items it rests on, or says it rests on none and why

OWNER RULING 2026-09-07, from a defect measured the same day.

WHAT HAPPENED. budget/16 reversed one admission rule. It reddened 26 test fixtures across 10 files
and NOT ONE was a logic failure - every one asserted an absence the reversed rule had made true.
ZERO OF THE 26 NAMED THE RULE THEY RESTED ON. They encoded it instead: a golden string, a bare
`pinned: 1500`, an item titled "Only an index line", a helper comment reading "one pinned item and
one index-only item" with no id in it. Nothing could find them, because there was nothing to search
for. It cost an hour of reading to establish that none of the 26 was a real failure.

THE RULE. A test file declares what it rests on:
    // @basis REQ-some-requirement-id, RULE-some-rule-id
or, when it genuinely rests on no ruling:
    // @basis none - pure parser mechanics

AND "NONE" IS A LEGAL ANSWER ON PURPOSE - the reason is the whole design. If naming an item were
mandatory, a writer under pressure would name the NEAREST PLAUSIBLE one to get past the gate, and
that is measurably worse than silence. Of those same 26 fixtures, exactly ONE did cite an item, and
it cited the WRONG one - a rule still in force, while the assertion above it rested on the rule
being reversed. A reader who checked that citation concluded the test was covered. IT WAS THE ONLY
ONE THAT LOOKED RESPONSIBLE AND THE MOST DANGEROUS IN THE SET. So the gate requires the THOUGHT,
never a link, and a stated reason is readable evidence where a blank line is not.

THE LIMIT, STATED SO NOBODY LATER MISTAKES IT FOR A GUARANTEE. This catches "this test VERIFIES item
X", which an author knows while writing. It does NOT catch "this test ASSUMES item X", which is what
actually caused the damage and which the author usually does not know they are doing - nobody sat
down thinking "I am encoding the admission rule". That half is only reachable at the moment somebody
REVERSES a rule, which is plan:contra seq:2.

IT IS ENFORCED IN BOTH DIRECTIONS, item side first because it is nearly free: an item may name its
covering tests through the `scope:` globs it already carries, which checkDeadScopes already
validates against real files. See plan:basis seq:1 and seq:2.
