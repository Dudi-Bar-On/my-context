---
id: TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the
type: task
title: reconstruct a subject from a passage you copied, without the noise reaching your context
status: active
severity: soft
always: false
summary: Copy something from the viewer and get back a short, cited account of it, checked against the code and the history — the five core modules have landed, the screen has not.
summary_of: 93eb81deaced3d11
summary_was:
  - 2026-09-11 Copy something from the viewer and get back a short, cited account of it, checked against the code and the history.
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
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: 2698a451b89cc82d
plan: recall
seq: "2"
state: todo
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

PART OF THIS HAS LANDED, 2026-09-11, AND THE ITEM STAYS `todo` FOR THE REST. Recorded here
for the reason `plan:budget seq:16` gives: an item whose code shipped while its state still
said todo went unnoticed for four days, and the half that was missed is exactly the half a
person reads when deciding what to dispatch.

DONE, on master:
  Task 6   a selection becomes a query   `src/core/retrieval/from-selection.ts`
  Task 7   subjects from documents       `src/core/retrieval/subjects.ts`
  Task 8   noise removal                 `src/core/retrieval/noise.ts`
  Task 9   the mission                   `src/core/retrieval/mission.ts`
  Task 10  results are files, and cite   `src/core/retrieval/result.ts` + `.gitignore`

NOT DONE, and this is what keeps the item open:
  Task 11  the UI — read the result, choose what returns
  Task 12  rounds compose
Both touch `src/ui/**`, both string tables and `e2e/retrieval.spec.ts`, and were held because
a browser lane held Playwright. THE PLAN’S OWN SELF-REVIEW CALLS TASK 11 STEP 2 THE SAFETY
BOUNDARY — "everything else can be imperfect; this one cannot" — so it is not a task to hurry.

NOTHING IS WIRED. No command, route or hook reaches retrieval, and two source scans assert it
in both directions, so a hook that reaches for it later turns them red.

ONE SEAM LEFT DELIBERATELY: `MissionRequest` carries no field naming the RESULT FILE’S SHAPE
for the subagent. Task 11 or 12 should either pass one or have `mission.ts` import
`result.ts`’s renderer contract; it was left alone rather than guessed.
