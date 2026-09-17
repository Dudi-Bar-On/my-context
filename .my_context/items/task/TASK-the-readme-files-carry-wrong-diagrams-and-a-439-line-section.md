---
id: TASK-the-readme-files-carry-wrong-diagrams-and-a-439-line-section
type: task
title: the readme files carry wrong diagrams and a 439-line section about things that have since shipped
status: active
severity: soft
always: false
summary: Correct and refresh both README files, and retire the not-yet-available section entry by entry.
summary_of: 1113141bc2d8635f
scope:
  - README.md
  - docs/README.he.md
tags:
  - v2
  - docs
  - "plan:rulings"
  - "seq:102"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: d6684f6a256ddcf1
plan: rulings
seq: "102"
state: done
priority: "1"
---

# the readme files carry wrong diagrams and a 439-line section about things that have since shipped

THE OWNER, 2026-09-17: "if you found that readme has errors, please fix it and also remove from it chapter 8 about what is not implemented yet, the english and the hebrew versions and verify they are updated internally as well as in the github repo, in this occasion it is also a good oportunity to update the readme files because the project has added and changed many things from the day the readme files were written".

THE ERRORS ARE MEASURED, not suspected. Of the five README diagrams reused verbatim into the capability chapters, THREE carry false claims, and the source is README itself:
  - `README.md:418` draws `DB --> SEL`. Selection does not read the index at all - `inject.ts:372` says "No database on the injection-critical path".
  - `README.md:1496` says an item arrives "once per context window". The seen file is PER SESSION (`seen-file.ts:11`) and survives a compaction - and README's own prose repeats the error at line 1626.
  - The lifecycle diagram has no terminal node for a review draft, which is DELETED rather than deprecated (`review.ts:1115`).

SECTION 8 IS 439 LINES AND SEVEN SUBSECTIONS, AND IT BREAKS ITS OWN RULE. The section's text says: "Nothing stays in this section once it ships." Yet it still carries "A subagent does not receive the session-start injection" - and a verifier PROVED EMPIRICALLY on 2026-09-17 that a subagent selects as `source: 'session-start'` (`inject.ts:708`) and receives pinned, continuity and index tiers; its own dispatch delivered the continuity item.

SO DO NOT DELETE IT BLIND. Take the seven entries one at a time. An entry that has SHIPPED does not vanish - the fact moves into the chapter that owns it, because a capability nobody documents is worse than one listed as missing. An entry that is STILL TRUE is a real limitation, and deleting it makes this product over-promise to a reader who trusted the section. Name any that are still true and leave them for the owner rather than removing them quietly.

BOTH LANGUAGES, AND THEY MUST AGREE. `README.md` is 6,744 lines and `docs/README.he.md` is 7,180, mirroring it with its own RTL conventions. A fix to one is a fix to both, and the Hebrew edition of the documentation is written next - an error left here is inherited there.

AND THE PROJECT HAS MOVED. `git log --since=2026-09-13 --name-only` is the fastest reading of what shipped after the capability reference froze: the search grammar, the find panel, folding and highlighting, mark kinds, two marks on one turn, corpus ranking, searchable tool calls, the mid-turn refresh, `mycontext path`. README predates all of it.
