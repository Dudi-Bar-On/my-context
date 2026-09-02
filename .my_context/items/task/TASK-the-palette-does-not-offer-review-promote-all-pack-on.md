---
id: TASK-the-palette-does-not-offer-review-promote-all-pack-on
type: task
title: the palette does not offer review promote --all --pack, on purpose
status: active
severity: soft
always: false
summary: A bulk approval option is deliberately left out, because approving is a person's act and one click puts it too close to hand.
summary_of: 4c0608da9bada33d
scope: []
tags:
  - "plan:ui2"
  - "seq:10p"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: a0de81b15d718b91
plan: ui2
seq: 10p
state: todo
priority: "2"
---

# the palette does not offer review promote --all --pack, on purpose

The ui2 catalogue agent declined to ship it and wrote a test that fails if anyone offers it while the reason still stands.

The reasoning, which is the owner's own rule applied one layer out: promotion is a human act, and the skill and both READMEs say an agent must never promote on a user's behalf. Turning a whole imported pack's unreviewed drafts into one palette checkbox moves promotion closer to one click than the CLI puts it. That is a decision about the approval boundary, not a convenience.

The reason lives in FLAGS_NOT_OFFERED beside the flag, so the next person reads the argument rather than the absence.

Also marked: lesson-accept is on the approval boundary and has NO --yes at all, so the catalogue marks it ungated and the screen can say so, rather than drawing a confirmation checkbox that does not exist.

If the owner wants the bulk promote in the palette, it is one entry plus deleting a test - but it should be a ruling, not a fill-in.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS -- but it is NOT WORK, and it must not be swept up by the standing goal that a refusal is a state to leave.

THE OWNER S RULING OF 2026-08-25 IS "in general i want to remove the refusals". This one is the exception the word "in general" leaves room for, and the reconciliation is flagging it rather than letting a later agent read the goal and delete a safety boundary. The refusal is on the APPROVAL BOUNDARY: promotion is a human act, the skill and both READMEs say an agent must never promote on a user s behalf, and one checkbox for a whole pack s unreviewed drafts moves promotion closer to one click than the CLI puts it.

FOR plan:walk seq:12, which enumerates every standing refusal and drives the list to zero: this entry leaves the list by being RULED TO STAY, not by being built. So does coverage s missing print button, which was declined because the browser s own print command already reaches the print stylesheet. A refusal that has been argued and ruled is a decision; only an unargued one is a state to leave.

If the owner does want the bulk promote, it is one catalogue entry plus deleting a test -- but it is a ruling, not a fill-in, and the test exists to make sure nobody fills it in by accident.
