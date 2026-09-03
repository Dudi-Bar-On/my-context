---
id: TASK-enumerate-every-standing-refusal-in-the-ui-and-drive-the
type: task
title: enumerate every standing refusal in the UI and drive the list to zero
status: active
severity: soft
always: false
summary: List every place the app quietly declined to build something, then for each one either build it, file it, or decide out loud not to.
summary_of: b6d845026ffad63b
acknowledged:
  - citation_form@d57d17e7adaeb294
scope: []
tags:
  - v2
  - ui
  - refusals
  - audit
  - process
  - "plan:walk"
  - "seq:12"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: ac3e97abddf9e6a0
plan: walk
seq: "12"
state: todo
priority: "2"
source: owner ruling 2026-08-25
---

# enumerate every standing refusal in the UI and drive the list to zero

Carries out the second and larger half of the ruling that a refusal is a state to leave: "in general i want to remove the refusals".

THE DELIVERABLE IS A LIST FIRST, not a sweep of edits. One row per standing refusal in `src/ui/`: where it is, what it refuses to draw, the condition it names, and whether that condition still holds TODAY. Three were already found expired without looking for them, so the list is expected to be longer than anyone assumes.

THEN EACH ROW GETS EXACTLY ONE OF THREE OUTCOMES, and none of them is "leave it":
1. The condition has expired -> BUILD IT. (config s delta plate is already this, plan:walk seq:10.)
2. The condition still holds -> it becomes a TASK with the condition named, so it is queryable and shows up in a report rather than living only in a file header.
3. It should never be built -> it becomes a DECISION or a non_goal, with the reasoning and what was weighed against it. A refusal that is really a decision should be recorded as one, and then it is not a refusal any more.

WHAT MUST NOT HAPPEN: drawing the weaker thing. Every one of these refusals exists because "Where a view cannot be drawn, stop and ask; do not draw a weaker one", and clearing the list by lowering the bar would be the worst possible reading of the ruling. Removing a refusal means building the real thing or deciding out loud not to.

CORRECTED 2026-08-25: this does NOT depend on seq:11. That was written backwards -- the
checker prevents the list REFILLING and is not needed to read what stands today. Run this
whenever; run seq:11 to keep it closed.

AND IT IS BIGGER THAN A TIDYING PASS, which is how it was first filed. Counted 2026-08-25
across the twenty-one screen modules: docs 14, packs 10, simulate 8, work 8, coverage 4,
palette 4, config 4, and gaps/injected/tut zero. That ranking is the best available answer
to "is this screen even defined" -- a refusal is its author saying what could not be built,
and the screens carrying the most are the ones nobody has reviewed.

WIDENED 2026-08-25 BY OWNER RULING: this enumerates TWO classes, not one.

  1. I COULD NOT BUILD THIS -- no endpoint answers it, the CSS is not there,
     the grammar cannot carry it. What this task was originally filed for.

  2. I WAS HANDED THIS AND HAD NOWHERE TO PUT IT -- the server computes a
     field and the design of record draws no place for it, so the screen
     leaves it unread rather than inventing a card.

The second is a refusal by the same logic as the first: a screen declining to
draw something because the specification gives it nowhere to go. And the same
reading pass finds both, because both live in the same module headers.

MEASURED THE DAY OF THE RULING -- ELEVEN of twenty-one screens record class 2:

    config 4 · proc 4 · docs 3 · packs 3 · work 3 · ask 2 · status 2
    injected 1 · learn 1 · port 1 · preview 1

status.js alone leaves EIGHT served fields unread. packs leaves
carries[].refusals, artefact.protocol, artefact.manifest and artefact.meaning.
Neither had ever been listed anywhere.

DO NOT RULE PER FIELD WHILE ENUMERATING. Three answers were offered and all
three deferred, on the ground that nobody has seen the list: give each field a
place in the mockup, stop serving what is not drawn, or keep the practice and
gate it. The list comes first; the ruling comes from the list.

AND DO NOT COUNT THE WORD "refusal" TO FIND THESE. A proxy that did exactly
that ranked packs -- the best-defended screen in the product -- as the second
least complete, because refusing is what that screen DOES. Read the headers.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, AND THE RECONCILIATION HAS FILLED IN PART OF ITS LIST. Take these to the enumeration rather than rediscovering them.

REFUSALS THAT LEAVE THE LIST BY BEING RULED TO STAY -- the owner said "in general i want to remove the refusals", and "in general" is what makes these legitimate. A refusal that has been argued and ruled is a DECISION; only an unargued one is a state to leave:
  plan:ui2 seq:10p -- the palette does not offer `review promote --all --pack`, on the APPROVAL BOUNDARY. Promotion is a human act; one checkbox for a whole pack s unreviewed drafts moves it closer to one click than the CLI puts it. A test fails if anyone offers it while the reason stands. DO NOT DELETE THIS ONE.
  coverage s missing print button -- declined because the browser s own print command already reaches the print stylesheet, and the screen would have to invent a word for a control that adds nothing.

REFUSALS THAT ARE ALREADY OVER AND NOBODY NOTICED -- these are the harvest:
  coverage s magnitude bar was refused in an earlier pass and IS DRAWN NOW
  plan:config seq:2 and the delta plate / blast panels refuse "until ctx.api can POST". ctx.post is at `app.js` · `async function post(path, body) {` · ~1398, exported at 947, with ZERO callers -- and `config.js` · `no method, no body` still tells readers it does not exist
  the status strip announces the bridge is not installed WITHOUT ASKING, while /api/watch/context serves the answer (now plan:walk seq:29)

SILENCES THAT ARE REFUSALS IN EVERYTHING BUT NAME -- nothing 503s and the reader is told nothing:
  plan:screens seq:10s -- NINE facts the read models serve that no string key can label. The single largest block of "the engine knows and the screen cannot say".
  prov.projCaughtUp -- a keyed, translated, both-tables sentence NO CODE PATH CAN EVER PRODUCE. The 2026-08-25 projection ruling makes it permanently impossible. Dead vocabulary; retire it.
  the Export screen s third format rung, served as built:false (plan:port seq:14)

AND THE ONE STRUCTURAL NOTE: three of these named their unblocking condition in a COMMENT and the condition was met without anything noticing. That is plan:walk seq:11, and it should be widened -- see its own reconciliation note.

CITATION DRIFT, checked 2026-09-03. The line above ends "and config.js still tells readers it does not exist" — it no longer does (`config.js` · `nothing else: no method, no body"*, which is why nobody noticed. It is` · ~119), and `ctx.post` has callers now.
