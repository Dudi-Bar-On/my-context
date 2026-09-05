---
id: TASK-extend-the-documentation-test-family-to-hold-the-new
type: task
title: extend the documentation test family to hold the new manifest, index and coverage claims true
status: active
severity: soft
always: false
summary: Add tests, in the same style as the existing documentation gates, that catch a hand-edited manifest, index or coverage claim instead of a regenerated one.
summary_of: 3db7a37039364a81
scope:
  - test/docs/**
tags:
  - v2
  - documentation
  - testing
  - "plan:docsys"
  - "seq:8"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/docsys/8.md"
source_anchor: null
source_checksum: dd81dd808bf59077
valid_from: 2026-09-05
valid_until: null
checksum: 1dc8786ba23551c8
plan: docsys
seq: "8"
state: todo
priority: "3"
needs: docsys/5,docsys/7
---

# extend the documentation test family to hold the new manifest, index and coverage claims true

> Found 2026-09-05 under `reports/2026-09-05-documentation-screen-definition.md`, researching the
> Documentation screen for `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`. Extends
> `test/docs/inventory.test.ts` and `test/docs/counts.test.ts`'s own family, per the dispatching
> instruction to extend the existing gates rather than replace them, and per
> `STD-documentation-is-regenerated-not-edited-to-match`'s own admission of what those tests do NOT
> check.
>
> WHAT THIS TASK ADDS, three new tests in the same file family:
>
> 1. A MANIFEST REACHABILITY test: every document `watchedDocs` names (post docsys/4) resolves to a
>    reachable `GET /api/doc/:id` entry, and no id in the manifest names a path outside what
>    `watchedDocs` matches — the same shape `inventory.test.ts` already takes for CLI commands
>    ("every CLI command … is named in README.md, and README.md names no CLI command that does not
>    exist"), applied to documents instead of commands.
> 2. A HEADING-INDEX ACCURACY test: the manifest's heading list for `README.md` matches the file's
>    own ATX headings exactly, in count and order — the same "derived, not hand-kept" discipline this
>    corpus already applies to counts (`counts.test.ts`), applied to the new index (docsys/5).
> 3. A COVERAGE-DERIVATION test: the CLI-vs-UI coverage table (docsys/7) is regenerated from
>    `COMMANDS` and the route table rather than committed as static prose, in the shape
>    `parity.test.ts` already takes for the two READMEs' structure.
>
> EACH TEST SHOULD BE COMMITTED DELIBERATELY RED where the corresponding feature is not yet built,
> exactly as `inventory.test.ts`'s own header documents doing for Task 4→6 of the original
> documentation plan — a failure list that IS the remaining work, not a surprise regression.
>
> WHAT THIS DOES NOT ADD, stated so it is not assumed later: no test here checks that the PROSE is
> true, or that the Hebrew is current in meaning rather than in structure — those remain human review
> obligations, exactly as `STD-documentation-is-regenerated-not-edited-to-match` already states of
> its four existing tests.
>
> NEEDS: docsys/5 (the manifest and index to test), docsys/7 (the coverage table to test).
