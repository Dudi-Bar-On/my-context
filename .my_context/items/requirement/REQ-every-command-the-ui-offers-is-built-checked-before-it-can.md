---
id: REQ-every-command-the-ui-offers-is-built-checked-before-it-can
type: requirement
title: every command the UI offers is BUILT, checked before it can be copied, and teaches its own syntax
status: active
severity: hard
always: false
summary: Every command the screens offer is assembled from choices, checked before it can be copied, and shows the person what a legal value looks like.
summary_of: a6ea6065d45b3dc3
scope: []
tags:
  - v2
  - ui
  - dx
  - owner-ruling
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 91aaf399dee0a35f
---

# every command the UI offers is BUILT, checked before it can be copied, and teaches its own syntax

OWNER REQUIREMENT, 2026-08-24: "in the ui, everywhere there is a command builder like the capture but include all of them, syntax should be enforced by the selections and data entry and also checked before a command is allowed to be copied" - and, on approving the design: "there are missing help examples on those screens and the user does not know what is the correct format what is legal and what is not, also it would be helpful to place a grayed out hint in the fields as placeholder before user enter values".

SO THIS IS THREE REQUIREMENTS, and the third is the one that is easy to drop. A builder that ENFORCES syntax refuses a reader after the fact; a builder that TEACHES it tells them before. The owner asked for both, and the placeholder is the cheapest teaching surface there is.

MEASURED 2026-08-24, before any of this was designed:

- the CLI registers `38` commands; `lib/palette-defs.js` - the catalogue that already exists - defines `20`.
- screens compose `22` distinct commands, and THREE of them (`audit`, `init`, `procedure`) are hand-built in the screen, bypassing the catalogue entirely.
- `palette-lib.test.ts` probes the real argument parser and fails the catalogue when it advertises a flag the command REFUSES. That is one direction. A flag the CLI has and the catalogue lacks is invisible, and a command absent from the catalogue is unchecked in both.

WHAT ALREADY WORKS, and is the model the owner named: the Capture screen is a real builder - a select for the category, inputs for title and scope, a select for severity - and on a half-built capture `captureCommand` THROWS, so there is no `.cmd` row and NOTHING TO COPY. "An invalid command cannot be copied" is already the behaviour there. What is missing is that it is true on one screen out of ten, that the catalogue behind it covers half the CLI, and that nothing tells the reader what a legal value looks like.

THE HARD CONSTRAINT, which decides the whole architecture: `src/cli/index.ts` is BANNED from `src/ui/` by `test/ui/no-writes.test.ts`, because importing it registers the entire mutating command surface as a side effect. So the validator cannot simply call the CLI's parser. The parsers must be LIFTED into a module both sides import - the same shape as the already-filed plan:api seq:5, and the same principle plan:categories seq:15 applied to refusals: guidance and behaviour cannot disagree if there is only one of them.

ONE DECLARATION SERVES ALL THREE. A flag that declares its legal values drives the select; a flag that declares a format hint and an example drives the placeholder and the help; and both drive the check. That is exactly the shape `UpdatableName` took in plan:categories seq 13 - closed `values` or absent-means-free-text, plus a `note` a person reads - and it should not be invented a second time.

DONE WHEN: every command site in the UI is a builder; its selects and inputs cannot compose an illegal command; every free-text field carries a placeholder showing the expected format; each builder can show what is legal without leaving the screen; and copy is refused, visibly, until the composed command passes a check that is the CLI's own parser rather than a second description of it.
