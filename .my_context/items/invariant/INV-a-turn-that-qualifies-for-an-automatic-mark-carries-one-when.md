---
id: INV-a-turn-that-qualifies-for-an-automatic-mark-carries-one-when
type: invariant
title: a turn that qualifies for an automatic mark carries one when a reader sees it, or the screen says it has not been read yet
status: active
severity: hard
always: false
summary: If the tool would bookmark something, you see that bookmark on it — and if it has not got to it yet, it tells you that rather than showing you a blank.
summary_of: 2de4c1de7c71996a
scope:
  - src/core/anchor-pass.ts
  - src/core/conversation-index.ts
  - src/core/conversation-search.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - recall
  - ui
  - silent-failure
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 599cdf7d8e9ec1df
---

# a turn that qualifies for an automatic mark carries one when a reader sees it, or the screen says it has not been read yet

OWNER RULING 2026-09-15, in his words: "when a table for example is displayed on the conversation
viewer, there is no reason why it’s generated anchore not displayed with it - in general it applies
to any anchore generation on the fly - enforce it."

THE RULE. A turn that the automatic grammar would mark IS marked by the time a reader is looking at
it, and the mark is drawn ON that turn. A reader scrolling a document must never be shown a turn
that qualifies and carries nothing.

WHY IT NEEDS TO BE NORMATIVE RATHER THAN A TASK. Every piece of this already exists and works in
isolation, and the reader still got nothing:
  — the grammar decides correctly (`anchorInTurn`, tables and rulings),
  — the pass runs on every Stop turn (`markAnchorsOnTurn`),
  — the screen draws a mark on a marked turn (the `tvanchored` chip, pinned by
    `e2e/anchors.spec.ts` — "a turn the automatic pass marked shows its name in the document").
On 2026-09-15 the chain between them stopped for over half an hour and every layer reported
success, because each was asked a narrower question than the one that matters. THIS ITEM IS THE
WIDER QUESTION, and it is the only one a reader can check.

THE HONEST LIMIT, because a rule that cannot be kept is worse than none. Marking cannot be
instantaneous: the turn is still being written when the hook runs, so the mark for the newest turn
may land a turn later. What is FORBIDDEN is not latency — it is a reader being unable to tell
latency from failure.

SO THE RULE HAS TWO HALVES AND BOTH BIND:
  1. A QUALIFYING TURN THE ARCHIVE HAS READ CARRIES ITS MARK, and the screen shows it.
  2. A TURN THE ARCHIVE HAS NOT YET READ IS DRAWN AS EXACTLY THAT — not as unmarked. The screen
     must be able to say "the archive is N bytes behind this document" from a `statSync` it can
     afford. An unread turn drawn as a turn with no mark is a silent lie, and
     `INV-nothing-is-dropped-silently` already forbids it.

WHAT THIS RULES OUT, so it is not read narrowly:
  — A pass that answers "nothing to do" when it means "I could not read anything". Those are two
    different answers and must be two different values.
  — Any layer that trusts a recorded size instead of the file when deciding there is no work.
  — Closing a marking defect by running `conversation rebuild`. A rebuild proves the grammar and
    proves nothing about the on-the-fly path, which is the path this rule is about.

HOW IT IS CHECKED, and it must be checkable or it is decoration: take a document the viewer can
open, find the turns a fresh run of the grammar would mark, and assert that each is marked on the
screen or explicitly disclosed as not-yet-read. That is one assertion over real data and it is the
shape `doctor` already uses.
