---
id: KNOWN-running-the-test-suite-can-leave-the-shipped-rule-store
type: known_issue
title: running the test suite can leave the shipped rule store edited, re-sealed, and reported intact
status: active
severity: soft
always: false
summary: A test damages the real rule store to check the damage detector, and when its cleanup loses a race the edit is left behind with a valid seal.
summary_of: 9a44c527812f5db8
scope:
  - test/cli/rules.test.ts
  - src/rules/**
  - scripts/**
tags:
  - v2
  - rules
  - silent-failure
  - testing
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 388e3708862aff31
---

# running the test suite can leave the shipped rule store edited, re-sealed, and reported intact

FOUND TWICE ON 2026-09-16, INDEPENDENTLY — by the lane closing `semantic/7`, and then
reproduced by the main session on the very next full run.

RUNNING `npm test` CAN LEAVE THE SHIPPED RULE STORE MUTATED, and the mutation is SEALED so
nothing detects it. After one run, `git status` showed two files changed:

    M src/rules/entries/manifest.json
    M src/rules/entries/numbered-options-on-a-question-put-to-the-owner.md

and the entry itself carried, appended to the end of a rule that ships to every install:

    planted by test/cli/rules.test.ts

THE MECHANISM, read off the test rather than guessed. `test/cli/rules.test.ts` imports
`entriesDir` from `src/rules/store.ts` — THE REAL SHIPPED DIRECTORY — and at line 59 does
`appendFileSync(file, "\nplanted by test/cli/rules.test.ts\n")` to a live entry, so that it can
assert `verifyManifest(...).ok === false`. That is a legitimate thing to want to prove. It then
restores the entry and rewrites the manifest from a string it read at line 57.

RUN ALONE THE TEST PASSES AND LEAVES THE STORE CLEAN — measured. It is under the CONCURRENT
suite that the restore loses. So this is a RACE and not a deterministic write, which is why it
appears once in a while and why nobody has chased it.

── WHY THE SEAL DOES NOT CATCH IT, WHICH IS THE WORST PART ─────────────────

With the store in that state, `mycontext rules verify` says:

    the rule store is intact — every entry matches the checksum that shipped with it.

AND IT IS TELLING THE TRUTH ABOUT THE WRONG THING. The test re-stamps BOTH halves, so the entry
and the manifest agree with each other while both differ from `HEAD`. A checksum proves INTERNAL
CONSISTENCY; it cannot prove PROVENANCE. The one command whose whole job is to say the shipped
rules are the shipped rules answers "intact" for a store that has been edited.

This is the second face of a defect already known and already unfiled: `mycontext rules verify`
REPORTS INTACT AND EXITS 0 WHILE AN ENTRY FAILS TO PARSE (reproduced 2026-09-16 by the lane that
landed the catch rule). Two different ways to be wrong, one command, and in both of them the
answer is the reassuring one.

── WHY IT MATTERS BEYOND TIDINESS ───────────────────────────────

The rule store is the one thing this product ships that outranks every other source in a
consuming session. A developer who runs the suite, sees a green tree, and commits with a broad
pathspec ships a MUTATED RULE to every install — and the gate that exists to prevent exactly
that says intact. `check:text-files`, `check:basis` and `npm test` itself all stay green,
because nothing compares the store to its own history.

── WHAT TO DO, AND THE SHAPE IS ALREADY IN THE FILE ───────────────────

  1. DAMAGE A COPY, NEVER THE ORIGINAL. The assertion the test wants — "a tampered entry is
     detected" — needs a store, not THE store. `verifyManifest` already takes a directory, and
     line 285 of the same file proves the test already knows `entriesDir()` is outside the
     temp workspace. Copy the entries directory to a temp dir, plant there, assert there.
  2. AND WHILE THE ORIGINAL IS STILL BEING WRITTEN, MAKE THE RESTORE CRASH-SAFE rather than
     merely present: a `finally` that rewrites a string read at the top does not survive a
     process killed mid-test, and this suite is killed mid-test often.
  3. A GATE THAT COMPARES THE STORE TO ITS HISTORY, which is the property `verify` structurally
     cannot have. `git diff --quiet -- src/rules/entries` after a suite run is the cheap form.
     Whether that belongs in CI or in `check:*` is a judgement; that it cannot be a checksum is
     not — see the argument above.

DO NOT WEAKEN THE ASSERTION TO GO GREEN. "A tampered entry is detected" is a real property and
this product would be worse without it. The defect is WHERE it is tested, not THAT it is.
