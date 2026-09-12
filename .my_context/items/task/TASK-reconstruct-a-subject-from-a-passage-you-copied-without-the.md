---
id: TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the
type: task
title: reconstruct a subject from a passage you copied, without the noise reaching your context
status: active
severity: soft
always: false
summary: Copy something from the viewer and get back a short, cited account of it, checked against the code and the history — and the screen now STAGES what returns for a fresh window rather than composing a command.
summary_of: 6df8efeba8555795
summary_was:
  - 2026-09-12 Copy something from the viewer and get back a short, cited account of it, checked against the code and the history — the five core modules have landed, the screen has not.
  - 2026-09-11 Copy something from the viewer and get back a short, cited account of it, checked against the code and the history.
acknowledged:
  - body_disagrees_with_meta@3fc96c0ab42d5b71
scope:
  - src/core/retrieval/**
  - src/ui/**
  - .gitignore
  - test/**
  - e2e/**
tags:
  - v2
  - recall
  - "plan:recall"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: b9d8f6c5502e602a
plan: recall
seq: "2"
state: done
priority: "1"
needs: recall/1
---

# reconstruct a subject from a passage you copied, without the noise reaching your context

D42 PHASE 2. Plan: docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md Tasks 6-12. Design: docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md sections 3, 4, 5, 6, 8, 9, 10.

THE PRIMARY WAY IN IS A PASSAGE HE COPIED. A selection is not a guess at the subject - it IS the
subject. And it works because a passage worth copying is dense in NAMES: as FTS5 queries, item-id
slugs matched 68% where headings matched 4%.

RETRIEVAL NEVER WRITES INTO THE LIVE CONTEXT. It writes a MISSION for a subagent that reads in a
fresh window, verifies against the CODEBASE AND GIT rather than the corpus - a ruling can stand in
the corpus while the code that implemented it was reverted weeks ago - pulls complementary detail
out of code and documents, and returns something small, chronological and CITED.

IT MUST CITE, because the distilling subagent is itself a model and can be confidently wrong. Every
claim points at a turn, a commit, or a file and line, so the result is verifiable rather than
trusted - and a result whose citations no longer resolve can SAY it has aged.

TWO BOUNDARIES THAT CANNOT BE GOT WRONG. Result files are GITIGNORED: they hold conversation text,
and his ruling is that conversation files stay out of git. And NOTHING reaches his context until he
chooses it - then dated, marked a record, and a superseded ruling says so on arrival.

Noise reuses the document’s own said/work/deed classification plus his repeat rule. Do NOT build a
lexical noise classifier: punctuation density measured AUC 0.499, a coin flip. Do NOT build MinHash
or LSH: an exact 8-gram index found 60 pairs in 629ms against 4,065ms, and brute force over
3,136,260 pairs took 20ms.

CLOSED 2026-09-12. WHAT WAS BUILT, recorded here rather than only in a report, for the reason
`plan:budget seq:16` gives: an item whose code shipped while its state still said todo went
unnoticed for four days, and the half that was missed is exactly the half a person reads when
deciding what to dispatch.

DONE, 2026-09-11:
  Task 6   a selection becomes a query   `src/core/retrieval/from-selection.ts`
  Task 7   subjects from documents       `src/core/retrieval/subjects.ts`
  Task 8   noise removal                 `src/core/retrieval/noise.ts`
  Task 9   the mission                   `src/core/retrieval/mission.ts`
  Task 10  results are files, and cite   `src/core/retrieval/result.ts` + `.gitignore`

DONE, 121b01b0:
  Task 11  the UI — the four modes, the brief, a result read and judged, the choice marked
  Task 12  rounds compose — a subject picked out of one result becomes the next round

DONE, 2026-09-12 — AND IT IS WHY THE ITEM COULD NOT CLOSE BEFORE TODAY. The building lane
refused to close its own item against `REQ-every-anchor-capability-is-reachable-from-the-
screen-and-a`: destination two, a FRESH window, ended in a `mycontext restore --build
--from-result` the reader copied into a terminal, and that requirement's deciding sentence is
that a composed command a reader copies to a terminal is NOT the UI having a capability — it is
the UI describing one. THE OWNER RULED: *"Yes — screen stages it"*, and accepted the condition
that came with it — a click in his own browser counts as the `'human'` `approveStagedRestore`
insists on.

  `src/ui/retrieval-write.ts`      POST /api/retrieval/stage, GET /api/retrieval/approve/confirm,
                                   POST /api/retrieval/approve. Registered from `startUiServer`
                                   and NOT from `registerReadRoutes`, so `server-e2e.test.ts`'
                                   byte-identical sweep over the read surface still means what
                                   it says.
  the no-writes exception          THE SAME NARROW ONE THE ANCHORS TOOK, not a second one — the
                                   building lane's own recommendation. Two RULED_WRITES lines,
                                   two new WRITERS keys, and
                                   `test/ui/retrieval-write-route.test.ts` is what bounds it.
  what still cannot happen         STAGING IS NOT DELIVERY. The record is `proposed` and
                                   `approvedRestore` — the question `core/inject.ts` asks at
                                   every session start — still answers nothing after it.
                                   The CLEAR has no verb here or anywhere in this product.

NOTHING IS WIRED TO A HOOK, and that is unchanged. No command and no hook reaches retrieval; the
three routes above are reached by a person pressing a button, and the two source scans that
assert the hook side still assert it in both directions.

ONE SEAM WAS CLOSED IN 121b01b0: `MissionRequest` now carries `resultShape` from
`result.ts`'s `resultContract()`, so the brief names the file it asks for rather than the
subagent guessing.

WHAT WAS DELIBERATELY NOT BUILT: a DISCARD route. A staged proposal nobody approves is inert —
`approvedRestore` only ever returns an `approved` record — so withdrawing one is
`mycontext restore --discard`, on the CLI, and adding an unasked-for write to this surface is
the widening the exception exists to refuse.
