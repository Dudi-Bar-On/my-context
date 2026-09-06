---
id: OPENQ-a-fourth-devdependency-was-committed-and-the-constraint-that
type: open_question
title: a fourth devDependency was committed, and the constraint that forbids it still says there are three
status: deprecated
severity: soft
always: false
summary: package.json carries four devDependencies while CONST-zero-runtime-dependencies enumerates three and says a fourth must be ruled on, not committed.
summary_of: fbd5d95effeaab4b
scope:
  - package.json
  - .my_context/items/constraint/CONST-zero-runtime-dependencies.md
tags:
  - v2
  - governance
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: 2026-09-06
checksum: c71452dcac6bc8fe
---

# a fourth devDependency was committed, and the constraint that forbids it still says there are three

Found 2026-09-06 while verifying the wa-tree vendoring did not add a dependency. It did not. This
is a pre-existing breach found by the same check.

MEASURED: package.json devDependencies are FOUR - @playwright/test, @types/node, mermaid,
typescript. CONST-zero-runtime-dependencies says, in as many words: "Today they are three:
`typescript`, `@types/node` and `@playwright/test`" and "A fourth is a ruling to record, never a
commit to make."

WHEN: `mermaid` entered in 52f74e4, "the readmes stop rendering as one 45,000-character code
block" - the diagram generation for the READMEs. It is genuinely dev-only; `dependencies` is still
absent, so the SHIPPED plugin still installs with zero runtime dependencies and the promise a user
relies on is intact.

SO THIS IS NOT A PRODUCT DEFECT. It is the constraint being right about itself: it says NOTHING
CHECKS THIS AUTOMATICALLY - no check:* script and no CI step reads a dependency list - and that
the guarantee is held by review. Review missed it, which is the evidence the constraint asked for.

TWO THINGS ARE OWED AND THEY ARE SEPARABLE:
  1. the ruling itself - is mermaid admitted as the fourth, on the same footing @playwright/test
     was admitted (a build-time tool violating neither the runtime rule nor the no-build-step
     rule)? If yes the constraint body must be updated to enumerate four and say why.
  2. whether the enumeration should stop being prose. A check that reads package.json and compares
     it to the enumerated list would have caught this the day it landed, and would catch a genuine
     runtime dependency - the case that actually matters - rather than relying on a reviewer
     noticing a line in a file nobody diffs.

The second is the one with teeth. The first is a sentence.
