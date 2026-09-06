---
id: TASK-the-enumerated-devdependencies-become-a-check-instead-of-a
type: task
title: the enumerated devDependencies become a check instead of a sentence review keeps missing
status: active
severity: soft
always: false
summary: The list of build-time tools this project allows is enforced by a test rather than by someone noticing.
summary_of: 290faa475b65ddad
scope:
  - package.json
  - scripts/**
  - .my_context/items/constraint/**
tags:
  - v2
  - governance
  - packaging
  - "plan:governance"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 9e0374098f5b5134
plan: governance
seq: "5"
state: done
priority: "2"
verified_on: 2026-09-07
---

# the enumerated devDependencies become a check instead of a sentence review keeps missing

Owner ruling 2026-09-06 (plan D16): admit `mermaid` as the fourth devDependency AND add the check.

`CONST-zero-runtime-dependencies` enumerates three - typescript, @types/node, @playwright/test -
and says in as many words that a fourth is "a ruling to record, never a commit to make". `mermaid`
entered in `52f74e4` for the README diagrams and nobody recorded anything. It is genuinely
build-time and `dependencies` is still absent, so the shipped promise held; what failed is the
review the constraint says holds it.

TWO PARTS, and the second is the one with teeth:
  1. The constraint enumerates FOUR and says why mermaid earns it - the same footing
     @playwright/test was admitted on: a build-time tool violating neither the runtime rule nor the
     no-build-step rule.
  2. A check reads `package.json` against the enumerated list and fails on a fifth - and on a
     RUNTIME dependency, which is the case that actually matters and which nothing reads today.

THE CONSTRAINT’S OWN WORDS ARE THE ARGUMENT FOR PART 2: "NOTHING CHECKS THIS AUTOMATICALLY. No
`check:*` script and no CI step reads a dependency list, so a runtime dependency added in a pull
request goes green. The guarantee is held by review." Review missed it for weeks. The check must
read the ENUMERATION out of the constraint or out of one place both agree on - a second list in a
script is the drift being fixed, wearing a different hat.
