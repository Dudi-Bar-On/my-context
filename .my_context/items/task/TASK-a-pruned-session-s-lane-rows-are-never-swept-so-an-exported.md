---
id: TASK-a-pruned-session-s-lane-rows-are-never-swept-so-an-exported
type: task
title: a pruned session's lane rows are never swept, so an exported document names lanes that are gone
status: active
severity: soft
always: false
summary: removeMissingSubagents only runs for sessions found on disk, so the lane rows of a session whose transcript is gone stay in the index for ever and an exported document draws a 'gone' link for each of them.
summary_of: 34ee957c5fe3b779
scope:
  - src/core/conversation-index.ts
tags:
  - v2
  - archive
  - "plan:archive"
  - "seq:35"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: fe59991214cc4320
plan: archive
seq: "35"
state: done
---

# a pruned session's lane rows are never swept, so an exported document names lanes that are gone

Found by `plan:archive seq:4`/`seq:5` while making `source = 'exported'` reachable, and NOT fixed
by that lane because the fix is a ruling about what an archive should hold rather than a
mechanical repair.

WHAT IS TRUE, read off the code rather than suspected. `ConversationIndex.removeMissingSubagents`
is SCOPED TO ONE SESSION and its own docblock argues why: `rebuildConversations` only lists the
`subagents/` directory of the sessions it FOUND, so sweeping globally on that knowledge would
delete every lane of a session whose own transcript had just been pruned — "knowledge leaving the
archive to a walk that never looked". That argument is right.

THE CONSEQUENCE IT DID NOT HAVE UNTIL NOW. Before `seq:4`, a pruned session left the index
entirely (`removeMissing`), so its orphaned lane rows were unreachable and harmless. A PERSISTED
session is now deliberately spared by `removeMissing`, so the row stays — and its lane rows stay
beside it, for ever, describing files that may have been deleted at any point since.

WHAT A READER SEES. `apiConversationSubagents` answers the roster from those rows;
`summariseSubagent` stats each file at request time, so `present` is `false` and
`screens/conversations.js`' `laneLink` draws `conv.doc.laneGone` — "no longer on disk, so there is
nothing to open". That is HONEST and is not a defect. Two things about it are:

  - `ConversationSummary.subagents` counts the rows, so the list row for an exported session says
    "N helper agents" about lanes none of which can be opened. The number is true of the recording
    and false of what the archive holds.
  - The rows never leave. `conversation forget` drops them wholesale, and nothing narrower does.

THE FORK, and it is a real one. Either (a) an exported session's lane rows are swept on the pass
that orphans it — cheap, and it discards the only remaining record that those lanes ever ran; or
(b) they are kept and the list row learns to say how many of its lanes are still openable, which
is one extra `stat` per lane per list request and is a cost the list currently does not pay; or
(c) the mirror grows to include lanes, which was measured and rejected — 615.3 MB of lanes against
65 MB of session in this workspace, 2026-09-08.

(b) is the one that drops nothing, and it is the one this lane would have taken if the cost of
statting a roster on the list path had been measured. It has not been. Measure it first.

MEASURED AND BUILT 2026-09-09. (b) IS AFFORDABLE AND IS BUILT -- at a quarter of the price this item quoted for it, because the cost it feared is per-LANE and the one that answers the same question is per-DIRECTORY.

THE MEASUREMENT THIS ITEM ASKED FOR, on this workspace, 268 lane rows across 2 sessions, warm cache, p50 of 21 runs:

    GET /api/conversations as it stood                    4.024 ms
    the grouped row count alone, today's lane cost        0.024 ms
    one stat per lane, which is what this item costed     3.704 ms   (+92% on the request)
        the stats alone, without the query                3.255 ms   (12-17 us per lane)
    one readdir per lane DIRECTORY, which is what shipped 0.991 ms   (+25% on the request)
        the listings alone, without the query             0.603 ms   (2.2 us per lane)

Both answers agreed exactly -- 267 openable under one session and 1 under the other -- so the cheaper one is not an approximation of the dearer one, it is the same count reached in one syscall per session instead of one per lane. Every lane of a session lives in that session's single subagents/ directory, and countSubagentFiles already answers a neighbouring question this way for the status line, under the same rule: top-level *.jsonl only, the extension test alone.

SO THE FORK IS SETTLED AS THIS ITEM WANTED IT SETTLED. Nothing is dropped: the rows stay, ConversationSummary.subagents still counts them, and ConversationSummary.openableSubagents beside it counts the ones whose transcript is on disk right now. Two facts, two fields -- the same shape bytes and fileBytes already have on that row, and for the same reason: a surface that had only the second could not say that anything was missing.

The count is taken over the PAGE and not the archive, which is ConversationListBody.missing's own rule: the filesystem is asked only about rows the answer carries, so no number here is an estimate about rows nobody looked at. ConversationIndex.subagentFilesOf is bounded to the page's session ids for that reason.

WHAT IT COSTS IN PRECISION, STATED. A directory entry that is not a readable file counts as openable here and would be refused by summariseSubagent's real stat one screen down. Nothing on disk has ever been in that state, the roster a reader opens next re-checks every row with a stat, and the alternative was four times the price on every list request for a distinction no measurement has shown.

AND THE STATE THIS ITEM DESCRIBES IS REACHABLE BUT NOT YET REACHED HERE: measured 268 rows and 268 openable, so today the two numbers agree on this machine. It is constructed end to end in test/ui/conversations-kept.test.ts instead -- a marked session, its transcript and its whole lane directory pruned, the mirror keeping the session -- and the row there says 2 lanes, 0 openable, which is the sentence this item is about.

(c) was not re-proposed. (a) was not taken.

WHAT IS NOT DONE, AND IT IS ONE LINE. The screen still draws conv.lanes from subagents alone: src/ui/public/screens/conversations.js and src/ui/public/styles.css were being edited by another lane at the same minute and were not touched by this one. The field is served on every list row for that lane to read, and en.js has no string for it yet -- a string with nothing drawing it would be dead weight.

AND THE ONE LINE IS NOW DRAWN, 2026-09-09, BY THE plan:archive seq:48 LANE. drawRow in src/ui/public/screens/conversations.js appends conv.lanesOpenable — "{n} still on disk", in en.js and he.js both — beside the lane count, and ONLY when openableSubagents is fewer than subagents. The two numbers are drawn together and neither replaces the other, which is the same shape bytes/fileBytes already have on that row: a screen that had swapped the count for the openable count would still have been unable to say that anything went missing.

WHY IT IS CONDITIONAL AND THAT IS NOT THE MEASURED-ZERO RULE BEING BENT. The clause beside it IS the measurement, so "268 helper agents · 268 still on disk" on every ordinary row would be a number repeated to say nothing. When the two disagree the second number is the finding, and 0 still on disk is then drawn in full for exactly that reason.

PROVEN IN A REAL BROWSER, IN BOTH PROJECTS, BECAUSE THE STATE IS STILL UNREACHABLE ON HIS OWN CORPUS (measured again today: 274 lane rows, 274 openable). e2e/conversations-kept.spec.ts grows a SECOND lane under the orphaned session, indexed and then pruned before the last rebuild — which is this item's own finding, that removeMissingSubagents is scoped to sessions found on disk and so cannot sweep it — and the row then reads 2 helper agents · 1 still on disk. Its toolUseId deliberately matches no step of the document, so the dispatching-step test in the same file keeps measuring what it measured. Both chromium and chrome green, 10 of 10 in that file and 170 of 170 across the conversation specs.

NON-VACUOUS, PROVED RATHER THAN ASSERTED. With the openableSubagents branch removed from drawRow the new test goes red in BOTH projects on "1 still on disk", and the row reads 2 helper agents alone. The branch was then restored and the suites re-run.
