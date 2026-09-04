---
id: TASK-docs-tutorial-md-and-docs-tutorial-advanced-md-add-examples
type: task
title: docs/TUTORIAL.md and docs/TUTORIAL-ADVANCED.md add examples also predate the --summary requirement
status: active
severity: soft
always: false
summary: "The install tutorial's own example commands fail as written for the same reason the README's did: they predate the --summary requirement on mycontext add."
summary_of: 3cdf65c7ca0c2e4e
scope:
  - docs/TUTORIAL.md
  - docs/TUTORIAL-ADVANCED.md
tags:
  - docs
  - tutorial
  - summary-gate
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: f17ffb688c486096
state: done
verified_on: 2026-09-04
---

# docs/TUTORIAL.md and docs/TUTORIAL-ADVANCED.md add examples also predate the --summary requirement

Found while working TASK-readme-examples-for-mycontext-add-predate-the-summary: the same --summary gate (shipped 2026-09-02) that broke the four README add examples also breaks docs/TUTORIAL.md's own walkthrough (section 2's constraint capture, and section 3's rule+lesson pair) and docs/TUTORIAL-ADVANCED.md:216's reference capture. TUTORIAL.md's own header claims every command and block of output was run against a fresh workspace and nothing is illustrative, so the fix is re-running the whole walkthrough with --summary added and re-deriving every downstream block (item ids, checksums, counts) that the frontmatter/console dumps show, not just patching the command lines.
