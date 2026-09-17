---
id: TASK-no-english-document-carries-a-single-screenshot-so-the
type: task
title: no english document carries a single screenshot, so the hebrew edition would have to decide from scratch what to photograph
status: active
severity: soft
always: false
summary: Embed real screenshots across the capability and system documents, before the Hebrew edition is written.
summary_of: d8a2b432ef1c8a13
scope:
  - docs/capabilities/**
  - docs/system/**
tags:
  - v2
  - docs
  - ui
  - "plan:rulings"
  - "seq:101"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 6d785181ba9cc6d6
plan: rulings
seq: "101"
state: todo
priority: "1"
needs: rulings/99
---

# no english document carries a single screenshot, so the hebrew edition would have to decide from scratch what to photograph

THE OWNER, 2026-09-17: "if you found that no screenshots are included in the documents, will not it be a good idea to embed them before moving to hebrew ?"

HE IS RIGHT AND THE MAIN SESSION'S EARLIER REASONING WAS WRONG. That reasoning was: screenshots cannot be reused across languages, because an English screen and a Hebrew RTL screen are different images - so they do not help the Hebrew pass. That is true and beside the point.

THE ENGLISH DOCUMENT BECOMES THE SHOT LIST. Same positions, same captions, same judgement about which screens are worth showing. The Hebrew pass then RE-SHOOTS INTO SLOTS THAT ALREADY EXIST rather than deciding from scratch what to photograph and where it belongs. Doing it the other way round means making every one of those decisions twice, in two languages, with no guarantee they agree.

MEASURED 2026-09-17: ZERO screenshots across 17 capability chapters and 8 system documents. `docs/the-store.he.md` - the document the owner named as the standard and praised - carries TEN, every one of the real tool.

THE STANDARD IS THAT DOCUMENT'S. Read-only screens shot against the real corpus; anything that writes shot against a COPY; and because the screens print their own store or workspace directory, each image says which it was. A drawing of a screen nobody opened is the claim this project refuses.

WHAT IS IN SCOPE HERE AND WHAT IS NOT. The three floating panels are `rulings/100` and are blocked on `semantic/12`, `/13` and `/14` - two of them do not exist yet. EVERYTHING ELSE IS UNBLOCKED: the rail screens, the conversations list and the document viewer, doctor, coverage, the composer, the review queue, the watch stream, the palette. Those are shippable now and they are the majority.

AND IT FOLLOWS THE DIAGRAM REPAIR RATHER THAN RACING IT. `rulings/99` is repairing 28 false diagram claims in the same files right now; two writers in one chapter is how a commit becomes unsplittable.
