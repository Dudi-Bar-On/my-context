---
id: INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask
type: instruction
title: "The mockup is the UI specification: build it exactly, and ask when it does not answer"
status: active
severity: soft
always: true
summary: "The design drawing decides what the screens are: build exactly that, invent nothing, and where it does not answer, ask rather than choose."
summary_of: 2228a9ef8f290925
scope: []
tags:
  - ui
  - mockup
  - v2
  - process
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 55189d7bf6b4d972
---

# The mockup is the UI specification: build it exactly, and ask when it does not answer

**The mockup is the specification for the UI. Build what it shows. Do not invent.**

`my-context/docs/design/web-ui-mockup.html` is the design of record — 21 screens,
the rail, the gloss, the graphical views, the EN/HE string table, the provenance
bar, the print stylesheet. When you implement any part of the frontend, **the
mockup decides**: the screens that exist, what each one shows, where a control
lives, what a chart plots, what a state looks like when it is empty, and what
the words are.

**What this forbids, specifically:**

- **Adding a screen, panel, control or field the mockup does not show.** If it
  seems obviously missing, it is a question, not a licence.
- **Dropping one it does show**, or quietly rendering a weaker version — a table
  where it draws a chart, a number where it draws a distribution, a label where
  it discloses a reason. **This has already happened twice**: a regeneration
  dropped six screens, and a later one kept the screens and lost the 18
  graphical views inside them. Both were caught late.
- **Restyling.** The gloss, the logical properties, the light-dark tokens and the
  type scale are decisions, not defaults.
- **Rewording.** Every user-visible string is in the mockup's table with a
  Hebrew pair. Inventing a new sentence creates an untranslated string and a
  parity failure.

**When the mockup does not answer, or answers something the code cannot do —
STOP AND ASK THE OWNER.** Do not resolve it yourself and do not pick the
reading that is easiest to build. A UI decision taken quietly is one nobody can
find later, and the mockup stops being the record the moment the shipped screen
disagrees with it.

That includes: a screen whose data the product does not actually record; a
control whose command does not exist; a layout that cannot hold real values; and
any place two screens imply different rules.

**If a change to the mockup is agreed, the mockup changes first**, and the
implementation follows it. Never the reverse — a shipped screen that leads the
design turns the design file into documentation of the past.

**Two things that are NOT exceptions.** A mockup element marked
`PROPOSED` is still specified; it is marked because the capability behind it is
not built, and it is drawn to be built that way. And an accessibility or
correctness fix that the mockup contradicts is still worth making — but it is
raised, agreed, and applied to the mockup first, like anything else.

**AND THE SAME RULE BINDS A RECONCILIATION PASS — added 2026-08-20, because it
was learned the hard way.**

When a spec, plan or task is brought into line with the mockup and it turns out
to specify a feature **the mockup does not show**, that is a **question for the
owner**, exactly as it would be during implementation. It is not a licence to
delete the feature, reword it away, or record it as "corrected".

**This went wrong once and the owner caught it.** A reconciliation pass removed
Ask's read-only SQL display and the status strip's injection-volume figure, and
recorded both as corrections. Neither was the pass's to decide: the owner
reversed both, and the mockup gained them back. Two other reductions in the same
pass turned out to be right — but being right is not the point. **The pass had
no standing to rule on any of the four.**

So, in a reconciliation:

- The mockup **wins on appearance** where both describe the same thing
  differently. That is a reconciliation, and it needs no permission.
- The mockup being **SILENT** about something the document specifies is **not
  disagreement**. Record it as an open question, name it in the report, and
  leave the document's text intact until the owner rules.
- **Never** convert a specified feature into a `CORRECTED` note saying it does
  not exist. A correction states what the mockup shows; it does not decide what
  should have been shown.

**The test to apply:** could a reader tell, from what you wrote, that the owner
has not yet decided? If not, you decided — and that was not yours to do.
