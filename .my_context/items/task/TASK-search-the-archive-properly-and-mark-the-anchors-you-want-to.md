---
id: TASK-search-the-archive-properly-and-mark-the-anchors-you-want-to
type: task
title: search the archive properly, and mark the anchors you want to come back to
status: active
severity: soft
always: false
summary: Search every word of every recorded session and helper agent from the viewer, narrowed by session, speaker or date, and mark the points worth returning to — by hand, or automatically for a table, a report or a ruling.
summary_of: ebaf4c38f93da8ea
summary_was:
  - 2026-09-11 Real search across every recorded session and a way to mark the points you want to find again — the index and the anchors have landed, the viewer half has not.
  - 2026-09-11 Real search across every recorded session, and a way to mark the points you want to find again.
scope:
  - src/core/conversation-search.ts
  - src/core/anchors.ts
  - src/core/conversation-index.ts
  - src/cli/commands/conversation.ts
  - src/ui/**
  - test/**
  - e2e/**
tags:
  - v2
  - recall
  - "plan:recall"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: 20403c7f3184e9f3
plan: recall
seq: "1"
state: done
priority: "1"
---

# search the archive properly, and mark the anchors you want to come back to

D42 PHASE 1. Plan: docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md Tasks 1-5. Design: docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md sections 7, 11, 12.

WORTH HAVING EVEN IF NOTHING ELSE SHIPS: it improves the viewer he uses today, and everything else
in D42 stands on it.

FTS5 COSTS NOTHING. Node 24's bundled SQLite 3.51.2 has ENABLE_FTS5, bm25(), porter and trigram -
verified including Hebrew - and `node:sqlite` is already imported in 14 files. No dependency, no
build step.

ANCHORS GET A TABLE, NOT A COLUMN, and plan:archive seq:34 proved why hours before this was
written: `upsert` sets every column from `excluded` and the Stop hook rebuilds every turn, so a
hand-typed value lives ONE TURN silently; and `removeMissing` deletes the whole row when the
harness prunes. Anchors carry id, timestamp, session and a BYTE offset - the corpus is Hebrew from
record 5, so character offsets are wrong.

A new table is a new schema version by this index's own rule: an older index reports Incomplete
and heals on rebuild. Run the rebuild rather than leaving his server stale.

Anchors are set two ways: he marks one, and a table, a report or a ruling is marked automatically.

ALL FIVE TASKS HAVE LANDED. Tasks 1 and 3 on 2026-09-11 in commit c7bcaa1b; Tasks 2, 4 and 5
later the same day. The tokenizer was chosen by MEASUREMENT and the measurement is the reason:
`unicode61` returns NOTHING for a Hebrew stem inside a prefixed form (0 hits where trigram finds
14), because Hebrew glues its one-letter particles onto the front of the word. It indexes lanes
as well as sessions - 305 lanes against 2 sessions here, so a session-only index would have
searched under 1% of the archive and looked like it worked.

WHAT THE VIEWER GAINED. `GET /api/conversations/search` reads the prose of every transcript the
archive holds a row for, scoped by session id, by the name this project gave a session, by lane,
by who spoke, and by a date range read in the READER's zone through `zonedDay`. A query under
three characters is answered with `searchable: false` and the sentence saying why, because a
trigram index cannot match it AT ALL and an empty list would say something false about the
archive. `GET /api/conversations/anchors` lists what is marked and searches the labels.

THE SNIPPET THE INDEX RETURNS IS UNUSABLE ON ITS OWN, and that was found in a browser rather
than in a test. `snippet(conversation_prose, 7, ..., 16)` counts TOKENS, and a trigram token is
three characters - measured against the live archive it drew `...fy [byte offset]s on...`, about
eighteen characters. The read model now seeks to the hit's byte offset, reads that one record
under a 64 KiB bound, and returns before/match/after so the screen can mark the match without
parsing the brackets the index uses, which are ordinary characters in this text.

THE PER-TURN COST WAS MEASURED BEFORE ANYTHING WAS WIRED, and the number changed the decision.
Cold fill of this workspace: 8.6 s, 307 transcripts, 875 MB read, 7,993 passages. Steady state
AS THE CODE STANDS: 1.8-2.1 s and 95.7 MB read EVERY run, because `prose_sources.bytes` records
where the walk actually REACHED and that runs past the `conversations` row whenever the file grew
between the archive scan and the prose walk - after which `source.bytes > previous.bytes` is
false for ever and the transcript falls to a whole re-read. With the resume point clamped to the
row it is 3-6 ms with nothing appended and 26 ms for a 256 KB append. So `buildSearchIndex` and
the automatic anchor pass run on `mycontext conversation rebuild`, which a person types, and NOT
on the Stop hook. The viewer serves `index.indexedAt` with every answer so a stale index is
disclosed rather than answering a smaller question than the one asked. See TASK-the-prose-index-re-reads-95-mb-every-run-because-its-resume for the repair
that makes the hook affordable.

HOW AUTOMATIC ANCHORING DECIDES, AND WHY IT IS NOT A GUESS. Three grammars, each a shape the text
either has or has not, in `cli/commands/conversation.ts`: a TABLE is GFM's delimiter row with a
header above it of the same cell count; a REPORT is a dated `.md` path under `reports/` or
`docs/superpowers/{specs,plans}/`; a RULING is a turn HE TYPED naming a normative corpus id
(DEC, RULE, INSTR, STD, CONST, INV). Nothing scores and nothing thresholds - the research measured
a lexical classifier at AUC 0.499 on this corpus. FTS probes narrow the archive to candidates and
the grammar decides, so a probe may be loose and the grammar may not. Each anchor's label is the
EVIDENCE that fired, so a wrong mark is visibly wrong. On the live archive: 297 tables, 214
rulings, 101 reports, and at least one probe reached its bound of 200 candidates, which the
rebuild says out loud.

THE VIEWER COMPOSES THE WRITE AND NEVER PERFORMS IT. Every search hit carries `anchorArgv` built
on the SERVER, and the screen renders it through the same `quoteArg` every other composed write
uses, with Copy and no Execute - `conversation anchor` is in no catalogue entry, and an entry is
a licence for a browser to write. `test/ui/palette-lib.test.ts` names that gap and says whose
decision it is.
