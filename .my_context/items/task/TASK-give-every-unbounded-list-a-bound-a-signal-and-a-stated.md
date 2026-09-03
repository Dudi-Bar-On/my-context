---
id: TASK-give-every-unbounded-list-a-bound-a-signal-and-a-stated
type: task
title: give every unbounded list a bound, a signal and a stated order
status: active
severity: soft
always: false
summary: Five lists print everything the server sends with no limit; each needs a limit, a stated order, and an honest sentence about what is not shown.
summary_of: 80e7ecc339a8e85d
acknowledged:
  - citation_form@6aadd7076a455562
scope: []
tags:
  - v2
  - ui
  - design
  - "plan:walk"
  - "seq:45"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-26
valid_until: null
checksum: 61a484e34d034a41
plan: walk
seq: "45"
state: done
priority: "1"
source: owner requirement 2026-08-26
---

# give every unbounded list a bound, a signal and a stated order

Carries out REQ-every-list-and-table-declares-what-leaves-it-and-when-and-says.

FIVE SURFACES RENDER A SERVER ARRAY WITH NO CAP, measured 2026-08-26:
  `preview.js:424`  the delivered items
  `preview.js:552`  the carried-id blocks -- 19 to 26 on a real corpus
  `injected.js:70`  the injected-now table
  `work.js:458`     the review queue
  `packs.js:522`    the pack list

PICK ONE OF THE TWO MECHANISMS THIS PRODUCT ALREADY HAS. Do not invent a third:
  THE CAP PLUS A TRUTHFUL SIGNAL (Ask) -- bind one row more than the cap, drop it before display, and say "capped at N -- more matched". Right where the remainder is unbounded and the reader may want to widen the question.
  THE CAP PLUS AN EXPLICIT REMAINDER (the ego-graph s `+N more`) -- right where the total is known and small enough to name, and where the remainder should stay VISIBLE rather than be described.

WHERE THE BOUND BELONGS IS PER SURFACE AND IS NOT ALWAYS THE CLIENT. Ask caps on the SERVER because the query could match the whole corpus. The delivered list cannot be capped server-side without lying about what was injected -- the screen s promise is "exactly what Claude gets" -- so its bound is a DISPLAY bound and must say so in those words, or it becomes a claim that fewer items were delivered than were.

THAT DISTINCTION IS THE HARD PART OF THIS TASK and is why it is not a mechanical sweep: a display bound on a provenance surface has to disclose that it is a display bound. Getting it wrong turns "we are showing you 20 of 47" into "you were given 20".

THE CARRIED LIST IS ALREADY AN OPEN OWNER QUESTION -- `plan:screens seq:1s-e` asks whether it is capped and how the remainder is disclosed, and notes the design of record has no `+N more` affordance for it to copy. This requirement answers the general case; that task still needs the specific ruling, and it should be taken WITH this one rather than after it.

EVERY SENTENCE THIS NEEDS IS A STRING KEY, so the mockup moves first (`DEC-claude-drafts-the-mockup-and-the-owner-approves`). Draft all of them in one sitting: five surfaces sharing two mechanisms should share their wording too, or the product grows five ways to say "there is more".

RULED 2026-08-26 by the owner -- see `DEC-a-record-list-bounds-by-time-a-computed-list-bounds-by`. The five surfaces split two ways. `injected.js:70`, `work.js:458` and `packs.js:522` replay records and take THE CAP PLUS A TRUTHFUL SIGNAL, ordered by time, newest first, with a way to the rest. `preview.js:424` and `preview.js:552` compute rather than replay, carry no timestamp, and take a DISPLAY cap ordered by the selector s own first-fit admission order, with an exact total and a show-all that costs no round trip. The hard part this task named -- that a display bound on a provenance surface must disclose that it is a display bound -- is unchanged and is now the wording work.
