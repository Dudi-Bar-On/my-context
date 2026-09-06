---
id: TASK-the-four-kinds-of-help-subject-are-read-in-one-shape-and-a
type: task
title: the four kinds of help subject are read in one shape, and a slash command carries its parameters too
status: active
severity: soft
always: false
summary: Every kind of help entry is laid out the same way, and asking about a shortcut tells you as much as asking about the command behind it.
summary_of: 65e5450e4667fa74
scope:
  - src/ui/read-model-cli-help.ts
  - src/ui/public/screens/cli-help.js
tags:
  - v2
  - ui
  - help
  - "plan:library"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 53a865875257f6dd
plan: library
seq: "5"
state: done
priority: "2"
verified_on: 2026-09-07
---

# the four kinds of help subject are read in one shape, and a slash command carries its parameters too

Owner request 2026-09-06: "the slash commands help looks different from the CLI commands - maybe
this is an opportunity to make them look the same and standardize the help format", and then: "for
every slash command hint, add its format and example value".

MEASURED, STRUCTURALLY, rather than compared by impression:
  command  p.small, then `table.flagtable`, then subcommand sections, then examples
  tool     p.small, then `table.flagtable` (argument / required / type / enum / note)
  slash    THREE p.small SENTENCES. No table, no example.
  topic    p.small, then rendered Markdown
So `command` and `tool` ALREADY share one table across two completely different sources - CLI flag
declarations and a JSON schema - which is the evidence the shape generalises. `slash` is the
outlier. `topic` is legitimately different because it IS a document.

WHY SLASH BECAME PROSE, and where that reasoning stops. Its `argument-hint` is ONE STRING written
for a person - `[category] [the item in one sentence]` - and splitting it on brackets would invent
structure the source does not have. That holds FOR THE HINT and is not to be undone.

BUT THE PARAMETERS ARE DERIVABLE FOR 85 OF THE 91, from data that already exists:

  27 SHARE A NAME WITH A CLI COMMAND - add, audit, decay, doctor, edit, focus, link, pin and more.
     `FLAG_DECLARATIONS` already carries a format and an example for every value-taking flag, and
     `/mycontext:focus`’s hint IS the CLI flag list. Same table, same source, nothing invented.
  29 ARE `list-<category>` - they map to `mycontext list <category>`, whose four detail flags are
     declared.
  29 ARE `add-<category>` - and the example value is ALREADY GENERATED. `mycontext examples rule
     --short` answers a real item: "Never log request bodies on auth endpoints". All 29 categories
     have one, verified. The category’s own description supplies the format half ("constraint:
     Non-negotiable limit: budget, stack, regulation, SLA"), which is D24.
  6 LOOKED LIKE ORPHANS AND ARE NOT, and the owner is the reason this was checked twice. He asked
     to "at least add a link to the correct example of use" for them. Reading what each file
     actually invokes shows every one names a concrete target, so the link is EXACT rather than a
     consolation:
       /discard        -> `review discard`      (subcommand, declared)
       /promote        -> `review promote`      (subcommand, declared)
       /unlink         -> `edit`                (command, declared)
       /session-carry  -> `session carry`       (subcommand, declared)
       /session-name   -> `session name`        (subcommand, declared)
       /LoadMyContext  -> `load_context`        (an MCP TOOL this card ALREADY draws a full
                                                argument table for)
     So ZERO of the 91 are without a documented target. My first pass said six had nothing; it had
     matched names against CLI COMMANDS only and missed that five of the six name a SUBCOMMAND, and
     that the sixth names a tool.

  THE CROSS-REFERENCE IS REQUIRED ON ALL 91, NOT ONLY THE SIX. Owner, asked to be explicit about it:
  "i ment all the slash commands not only the six". So every slash subject carries a link to the
  subject that documents what it actually runs - the 27 that share a CLI name, the 58 add-*/list-*,
  and the 6 that named a subcommand or a tool. A reader of any shortcut is owed the entry behind it,
  and the six were never the special case: they were only the ones where the link was the ONLY
  thing left to give.

  IT IS DERIVED FROM THE FILE, not from a table someone keeps. Each command file invokes its CLI
  through `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" <cmd>`; that invocation IS the link target.
  So the reference cannot drift from what the command really runs - the thing it points at is the
  thing it executes. A file that invokes more than one - /session-carry names `session carry`,
  `session list` and `mycontext help` - needs a rule for which is THE target rather than a list of
  every command it mentions; the first invocation is not automatically the right answer and this
  should be decided and stated, not assumed.

  WHAT STILL MUST NOT HAPPEN: a one-row table reading "the draft id" dressed up as structure. Where
  a hint is all there is, the hint is what is shown - beside a link to the subject that has more.

WHAT IS STANDARDISED IS THE SKELETON, NOT THE TABLE. Every subject reads in the same order: what it
is; what it takes; where it runs or who may invoke it; a worked example. The table appears where
structured data exists and the hint line where only a hint exists. Forcing `topic` to stop being a
document, or the six to fake a table, would be the same defect as the one being fixed.

DERIVED, NEVER TYPED. Every value above comes from a record the product already keeps - the flag
declarations, the category catalogue, the generated examples. Nothing is authored here, because 29
hand-written example sentences are the drift this project measures in days.
