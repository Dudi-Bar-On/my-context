---
id: NOTE-twenty-seven-task-states-were-written-straight-into-the
type: note
title: Twenty-seven task states were written straight into the Markdown, and the files cannot show it
status: active
severity: soft
always: false
summary: Twenty-seven finished tasks had their state written by hand instead of through the product, which no file check can detect and only the audit log revealed.
summary_of: 12ba6c954e9a5745
scope: []
tags:
  - corpus
  - provenance
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-03
valid_until: null
checksum: 45e596350020ca48
---

# Twenty-seven task states were written straight into the Markdown, and the files cannot show it

Found 2026-09-03, after the owner asked whether tasks marked done might not actually be done.

WHAT WAS FOUND

Twenty-seven task items carry `state: done` while NO audit record ever set their state. Their state was written directly into the Markdown rather than through `mycontext edit`.

By plan and seq: budget/7 · categories/22 · categories/23 · export/14n · handover/10 · hooks/19a · live/7 · live/8 · live/9 · live/11 · live/12 · live/13 · repaint/1g · repaint/9c · rulings/39 · upkeep/7 · upkeep/8 · walk/1h · walk/28 · walk/29 · walk/29b · walk/30 · walk/37 · walk/61 · walk/62 · walk/72 · walk/7b.

THE WORK ITSELF IS REAL. All twenty-seven were verified against the tree, each requiring a file and a verbatim fragment for a DONE verdict: twenty-four are genuinely finished, three are PARTIAL (live/12, live/13, walk/30) and NONE is a false completion. So this is a provenance defect, not a lying board.

THE PART THAT MATTERS: THE FILE CANNOT BETRAY IT

A hand-edited item and one the product wrote are byte-shape identical. Same frontmatter, correct `summary`, `summary_of` and `checksum`, `state:done` correctly projected into `tags`, and `doctor` passes both. Compared side by side, nothing distinguishes them.

So no file-level check can ever find this. The audit log was the only detector, and only because a mutation record names the FIELDS it changed: these items show `create`, then `update` records touching `body` or `summary`, and never `state`.

TWO HYPOTHESES TESTED AND DISPROVED

That records were lost when the workspace moved from `test_mycontext_plugin`: disproved. Every one of the twenty-seven has its `create` record in the log. Had a git operation or the relocation truncated history, the creates would be missing with the rest.

That records rotated out of the queried segment: disproved. `mycontext audit --files` reports ONE segment, un-rotated, spanning 2026-08-17 to 2026-09-03 continuously - earlier than the oldest of these items.

The state changes did not go missing. They never happened through the product.

HOW IT WAS POSSIBLE

The deny hook that protects `.my_context/` is keyed on tool names: `hooks/hooks.json` matches `Read|Edit|MultiEdit|Write|NotebookEdit` and `src/hooks/pre-tool-use.ts` tests `/Edit|Write/`. Bash is in neither, so a shell redirection, a heredoc, `sed -i` or a python script writes an item file unguarded. Already filed as `KNOWN-the-config-deny-hook-covers-edit-and-write-not-bash`.

WHY THE PAST IS NOT REWRITTEN

No audit records were manufactured for these twenty-seven. Writing records now, dated now, for changes made days ago would be forging provenance, and `RULE-do-not-amend-an-append-only-log-append-a-second-record` refuses exactly that. This note is the second record.

The owner ruling that follows from it, in his words: "i never allow to do that only using create and edit that updates properties, generates summary and calculates checksum."
