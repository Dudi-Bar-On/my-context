---
id: TASK-measure-whether-a-mark-really-does-reach-an-open-page-on-its
type: task
title: measure whether a mark really does reach an open page on its own, over half an hour of ordinary work
status: active
severity: soft
always: false
summary: Watch a real conversation for 30 minutes and check that every bookmark the tool makes shows up on screen by itself.
summary_of: a5d092b6cb2fbc97
scope:
  - src/ui/read-model-conversation-document.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - recall
  - "plan:anchors"
  - "seq:14"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 7fddff9bacf9b7b5
plan: anchors
seq: "14"
state: todo
priority: "1"
---

# measure whether a mark really does reach an open page on its own, over half an hour of ordinary work

THE OWNER ASKED FOR IT, 2026-09-16: "currentlly i could not see any new anchor marks added to the conversation on the fly, may be it's because none was created but in order to be sure i want you to dispatch a subagent that should monitor my server using playwright and measure on the fly apearing marks compared to on the fly generated. do it for a period of 30 minutes then generate results table and conclusion if it works correctlly or needs some fixes".

WHAT IS BEING CHECKED is `d53fadda`, which made `/tip` carry a change token for the anchor store so the screen refetches when a mark is written by anything other than the reader. It was proved on THREE WRITES THE MAIN SESSION MADE ITSELF, minutes apart, on a throwaway server. That is a proof of the mechanism and not evidence about ordinary use.

THE GAP BETWEEN THE TWO IS THE WHOLE POINT. A write the prover makes is timed, deliberate and lands while the page is fresh. The per-turn pass writes when it writes, into a store shared with every lane, onto turns that may not be rendered. A measurement over half an hour of real work is the only thing that can say whether the reader actually sees them.

AND THE FIRST HYPOTHESIS IS THE OWNER'S OWN: that no mark was created in the window he watched. That must be reported as what it is - the test not getting to run - and never dressed up as a pass. The marks the pass writes come mostly from TABLES, so a stretch of short questions and short answers genuinely produces none.

WHAT WOULD MAKE THE ANSWER WRONG, and each has to be handled rather than discovered: a mark written into a LANE's transcript belongs to that lane's sub-document and need not move the main document's count, though it does move the shared store file; a hidden tab stops asking on purpose (`shouldPing`); a truncated document or a copy does not follow at all; and a browser throttles a background tab's interval to about once a minute.
