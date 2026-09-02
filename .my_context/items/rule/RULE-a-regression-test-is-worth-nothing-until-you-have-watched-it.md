---
id: RULE-a-regression-test-is-worth-nothing-until-you-have-watched-it
type: rule
title: a regression test is worth nothing until you have watched it fail without the fix
status: active
severity: hard
always: true
summary: Break the fix on purpose and watch the test fail before you trust it; a test that has never failed proves nothing and hides the very thing it names.
summary_of: 6d15ed3d5738d834
scope: []
tags:
  - v2
  - agents
  - pinned-2026-08-23
origin: human
source_file: null
source_anchor: null
source_checksum: cd3c0bcf2d1e941c
valid_from: 2026-08-23
valid_until: null
checksum: b6a4d1b906e0ee20
---

# a regression test is worth nothing until you have watched it fail without the fix

> A regression test is worth nothing until you have watched it fail without the
> fix. Break the fix on purpose, run the test, see it red, then restore.
>
> Measured on 2026-08-23, twice in one session, in both directions.
>
> A test written for a boot-order defect cleared cookies and asserted the page
> still rendered. It PASSED against a deliberately reverted `app.js` — because the
> token also lives in `sessionStorage`, so the page still had a credential and the
> line that was supposed to fail never failed. Committed as written, it would have
> reported that defect fixed forever. Clearing both credentials made the mutation
> fail it in both browsers.
>
> The same day, an agent fixing a temp-file leak reinstalled the pre-fix function
> body and watched four of its sixteen tests go red, then restored the file and
> byte-compared it. That is the difference between a test and a decoration.
>
> DO
> - Mutate the fix — revert the line, flip the predicate, delete the guard — run
>   the test, and record which assertions went red and with what message.
> - Restore, then prove the restore is exact: `diff`, `git diff --stat`, or a
>   byte compare. Say so in the report.
> - Prefer a mutation that reproduces the ORIGINAL defect over one that merely
>   breaks something.
>
> DO NOT
> - Write a test after a fix and assume it covers the fix.
> - Accept a passing new test as evidence; a test that cannot fail proves nothing
>   and hides the thing it names.
> - Leave the mutation in the tree. Restore before you run anything else.
