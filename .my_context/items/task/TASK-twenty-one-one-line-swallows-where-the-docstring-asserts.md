---
id: TASK-twenty-one-one-line-swallows-where-the-docstring-asserts
type: task
title: twenty-one one-line swallows where the docstring asserts what the code does not do
status: active
severity: soft
always: false
summary: Twenty-one places where the comment promised more than the code delivered; fourteen are fixed and seven are waiting on files another piece of work holds.
summary_of: 028a8823eace8928
summary_was:
  - 2026-09-16 In twenty-one places the comment promises the code will report a problem and the code quietly reports success instead.
scope:
  - src/core/**
  - src/ui/**
  - src/cli/**
tags:
  - v2
  - core
  - silent-failure
  - pattern
  - "plan:swallow"
  - "seq:11"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 8879475ee024ddd8
plan: swallow
seq: "11"
state: doing
priority: "3"
---

# twenty-one one-line swallows where the docstring asserts what the code does not do

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, m1 through m19) as row 109 of `reports/2026-09-13-the-consolidated-findings.md`. TWENTY-ONE FURTHER ONE-LINE SWALLOWS, each one a place where the docstring asserts what the code does not do. The named ones:

- `readCarryOnce` -- the comment says "and says so"; the code returns `error: null`.
- `ui-sessions` -- the comment says "`error` is non-null only when a file EXISTS"; it is not.
- `isTorn` returns "not torn" for a file it could not `stat`.
- `clearFocus` says "there was nothing to remove" when it could not look.
- `decay.ts` · the renamed-category branch (line 103) makes a renamed category not-normative.
- Sixteen more of the same shape.

WHY ONE ITEM RATHER THAN TWENTY-ONE. They are the same defect and the same fix, and they were found as one pattern -- report 3's P1, a `catch` wider than the case it argues. Splitting them would hide that the argument for doing it right is already written at every one of the twenty-one sites.

A WORKED EXAMPLE EXISTS IN THE TREE, and report 3 names it: `corpus-identity.ts`'s `UNREADABLE = -1` and `context-occupancy.ts`'s missing `percent` field -- MAKE THE ZERO UNREPRESENTABLE, not merely discouraged.

── STILL OPEN 2026-09-16, AND THIS IS WHAT REMAINS ─────────────────────

NAMED-BUT-OPEN 96ab4288 — 14 of 21 sites fixed, 7 left with reasons — five of them because their only disclosure route is in a file another lane holds

WHAT LANDED, and the measurement that makes the rule the right one: AT 15 OF THE 21 SITES THE DOCSTRING ALREADY STATED IT AND THE CODE DID NOT KEEP IT — "and says so" over an `error: null`, "`error` is non-null only when a file EXISTS" over a catch that nulls it for every errno. THE ARGUMENT WAS NEVER MISSING; THE NARROWING WAS. The rule extracted from that is three questions, all three of which must pass before a catch may swallow: is the condition IDENTIFIED (only `ENOENT` is absence), is the value an ACTION or an ANSWER, and is the disclosure READ, in this same change.

WHAT REMAINS: seven sites, five of them because their only disclosure route is in a file another lane holds — which is the defect this campaign is about and not a thing to half-do.

TWO CORRECTIONS TO THIS ITEM'S OWN TEXT, from the audit in `a9ffa990`, recorded so nobody quotes them as measured: it says "twenty-one" and cites nineteen, and `readStdin` — which report 3 called "the single most load-bearing instance" — is in scope here and appears nowhere in the description. The class is real; the count must not be quoted.

The `NAMED-BUT-OPEN` line above is read by `npm run check:board`.

NAMED-BUT-OPEN a9ffa990 — that commit only AUDITED this item — it corrected the count and named `readStdin` as in scope and invisible in the description. It did none of the remaining seven sites.
