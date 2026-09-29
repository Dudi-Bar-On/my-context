---
id: TASK-the-subjects-with-no-document-have-no-home-and-capabilities
type: task
title: the subjects with no document have no home, and capabilities is the wrong one
status: active
severity: soft
always: false
summary: Write the missing system documents in their own directory, at the accuracy of the capability chapters.
summary_of: fc6194c7f3ef3d72
scope:
  - docs/system/**
  - README.md
  - src/**
tags:
  - v2
  - docs
  - "plan:rulings"
  - "seq:98"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 4cbfe04cde6c179f
plan: rulings
seq: "98"
state: done
priority: "1"
---

# the subjects with no document have no home, and capabilities is the wrong one

THE OWNER, 2026-09-16: "2 - the same reviewers over the table above including the readme.md and here the results should be more documents maybe in a different directory than capabilities with the same accuracy and detailing levels". He approved docs/system/ as the home.

WHY A SEPARATE DIRECTORY. docs/capabilities/ answers WHAT CAN IT DO. The gaps in reports/2026-09-16-the-subjects-of-this-system.md are a different question - HOW DOES THIS WORK - and mixing the two corrupts both.

THE SOURCE MATERIAL is that report's table of 32 subjects, plus README.md (6,744 lines, nine sections, and a section 8 that lists what is deliberately NOT yet available).

THE SUBJECTS WITH NOTHING AT ALL: the board (plans, needs, ready, path, the D-numbers) - the highest undocumented-times-load-bearing thing in the table and what a newcomer must learn first; the document and lane viewer; the palette and the drawn language. Search over the archive has only same-day reports. Decay/contribution/the audit log, lessons, ingest, focus and the status line have a tutorial each and no chapter.

AND DIAGRAMS ARE AUTHORED AS MERMAID, DELIBERATELY. README already carries good ones and scripts/gen-diagrams.ts renders them. Mermaid is text, so a later Hebrew edition translates LABELS rather than redrawing pictures. A diagram shipped as an image has to be redrawn in Hebrew.

## Request

i looked at the docs/capabilities and it looks the direction but i need to do several things: 1 - select professional reviewers from the tools you have and let ne approve them, they should go over the capabilities documents as well as over the code base and fix refactor add missing subjects documents mechanisms and every single detail to make them super accurate, 2 - the same reviewers over the table above including the readme.md and here the results should be more documents maybe in a different directory than capabilities with the same accuracy and detailing levels, 3 - i will look and review the documents and then i would like to generate documents similar to the-store.he.md in hebrew with the same simplicity and clearness as you did including all the features like screen snapshots, examples, drawings, diagrams etc. readme already contains good drawings and diagrams use them and add more to the documemnts from step 1 and 2 so when we will write the hebrew documents the drawing will be prepaired (maybe a simple translation will be requiredd)
