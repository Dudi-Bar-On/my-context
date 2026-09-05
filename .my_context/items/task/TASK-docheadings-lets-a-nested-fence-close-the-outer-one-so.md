---
id: TASK-docheadings-lets-a-nested-fence-close-the-outer-one-so
type: task
title: docHeadings lets a nested fence close the outer one, so README.md's index carries a phantom section
status: active
severity: soft
always: false
summary: The table of contents for the main README lists a heading that belongs to a quoted example, so one entry is fake and the numbering after it is wrong.
summary_of: d5a2837c5d03fcf7
scope:
  - src/ui/read-model.ts
tags:
  - v2
  - docs
  - ui
  - drift
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 7a273fa59fcbfd2a
state: done
verified_on: 2026-09-05
---

# docHeadings lets a nested fence close the outer one, so README.md's index carries a phantom section

Found 2026-09-05 by the heading-index gate docsys/8 added (test/docs/doc-system.test.ts), which is committed RED on this.

docHeadings in src/ui/read-model.ts toggles its fenced-block flag on ANY fence line. README.md quotes the extraction request inside a five-backtick fence, and that quoted output contains a four-backtick fence whose first line is '# Bookstore API PRD'. The inner fence therefore CLOSES the outer block in docHeadings' model, and the quoted heading is indexed as a section of the README: 99 headings where the document has 98, a table-of-contents entry that is example output, and a wrong ordinal on every heading after it.

The fix is one rule: a fence closes only when it is at least as long as the fence that opened it. test/helpers/markdown.ts's fenceTracker already does exactly that, which is why the two disagree and why the gate can name the difference.

A second, related divergence was measured at the same time and is NOT this task: slugAnchor (read-model) and headingSlug (test/helpers/markdown.ts, calibrated against GitHub's own renderer) mint different anchors for a heading containing an em dash - 'step-1-you-capture-it' against 'step-1--you-capture-it'. Deep links minted from the manifest are internally consistent, but a Markdown link written inside a document's own prose uses the GitHub spelling and will not resolve against the index.
