---
id: TASK-a-spilled-tool-result-is-reachable-from-the-step-that
type: task
title: a spilled tool result is reachable from the step that produced it
status: active
severity: soft
always: false
summary: Large tool outputs are saved to separate files; this makes those files findable from the conversation step that created them, instead of leaving a dead reference.
summary_of: 012d98bc2e04bfef
acknowledged:
  - source_drift@30b0a3b3100a43a9
scope:
  - src/core/conversation-index.ts
  - src/ui/**
tags:
  - v2
  - archive
  - "plan:archive"
  - "seq:30"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/body.md"
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 5dd84adcc9a37b51
plan: archive
seq: "30"
state: todo
priority: "2"
needs: archive/12
---

# a spilled tool result is reachable from the step that produced it

> Found while building `plan:archive seq:12`, and it corrects that item's own numbers.
>
> SEQ:12 SAYS "478 subagent transcripts, 91 MB, in the harness temp directory". Measured on this
> workspace 2026-09-08, all three parts of that sentence are wrong, and the third is wrong in a way
> that matters:
>
>     subagent transcripts      254 files    615.3 MB   ~/.claude/projects/<proj>/<session>/subagents/
>     tool-result files       1,318 files    144.4 MB   ~/.claude/projects/<proj>/<session>/tool-results/
>     the session transcript      1 file      70.1 MB
>
> So 91 MB was never the subagents figure - it was `tool-results/`, as `listTranscriptFiles`' own
> header block had recorded a day earlier ("<session>/tool-results/ 1,149 files 91 MB"). The two got
> crossed. And NEITHER directory is a temp directory: both sit under `~/.claude/projects/`, the same
> durable tree the session transcript lives in. `%TEMP%` holds the SCRATCHPAD, which is a different
> thing. Seq:12's urgency argument - "they are in a temp directory, so they will be deleted" - does
> not hold. The VALUE argument holds completely and is why seq:12 was worth building.
>
> WHAT IS STILL UNREACHABLE, which is the actual gap. `tool-results/` is where the harness spills a
> tool result too large to inline: the transcript keeps a `<persisted-output>` stub naming the file,
> and the bytes go to `tool-results/hook-<id>-<n>-<what>.txt`. 144.4 MB of them here. A reader in the
> archive following a lane's step sees the stub and the sentence "Full output saved to: ..." and can
> go no further, because the archive indexes neither the file nor the link to it. That is the same
> shape of defect seq:12 just closed one level up, and the same argument applies: the stub is the
> CONCLUSION and the spilled file is the EVIDENCE.
>
> WHAT TO DECIDE RATHER THAN ASSUME, and seq:12's experience says to measure first:
>
>   - IS THE STUB PARSEABLE INTO A LINK? It carries an absolute path in prose, not a field. Measure
>     whether that path is stable and whether it always resolves, before designing anything that
>     depends on parsing a sentence. A correlation the data does not support must not be invented -
>     that instruction is what made seq:12's parent link trustworthy.
>   - IS A ROW PER FILE RIGHT? 1,318 files against 254 lanes and 2 sessions. seq:12 decided its own
>     table on the evidence that a subagent is not a session; a tool result is not a transcript
>     either - it has no records, no turns and no timestamps, so `scanTranscript` has nothing to say
>     about it. It may want size and mtime only, with no scan at all.
>   - COST. Seq:12's numbers are the precedent: 5.06 ms to stat 253 files against 1,577 ms to read
>     them, and the incremental path is what made a per-turn refresh affordable. A tool-result file
>     is written once and never appended to, so the steady state should be stats alone.
>
> DEPENDS ON seq:12, which built the mechanism this extends: `subagents` is a second table in
> `core/conversation-index.ts` owning its own DDL, joined to the same `(bytes, mtime_ms)` freshness
> key and the same Stop-hook refresh. A third kind of file should be the same shape again rather than
> a third mechanism.
>
> AND ONE THING TO CARRY FORWARD: adding a table to `CONVERSATION_TABLE_COLUMNS` breaks every
> existing index until something rebuilds it. Seq:12 met that on the owner's own running server - the
> sessions list drew no files and printed the read door's refusal - and the repair is already in
> place: `ConversationIndexIncompleteError` distinguishes "a schema behind" from damage, and
> `stopConversationRefresh` treats the former as existing so the write path heals it on the next
> turn. Whoever adds this table inherits that and should not re-derive it.

DO NOT RUN `mycontext refresh` ON THIS ITEM. Its `source_file` points at a SCRATCHPAD path that is
reused between pieces of work, and the file at that path now holds a DIFFERENT item’s text -
`plan:archive seq:36`’s. Refreshing would replace this body with that one, silently, and the
checksum would agree afterwards because the item would be self-consistent with the wrong content.

`mycontext doctor` reports this as `source_drift` and its suggested repair is exactly the refresh
that would destroy the item. That is the trap: the advice is right in general and wrong here,
because the pointer is to a transient file rather than to a document.

IT IS ACKNOWLEDGED RATHER THAN REPAIRED, because there is no repair available: `mycontext edit` has
no flag that clears `source_file`, so the pointer cannot be removed through the product. The
acknowledgement lapses the moment this item is edited, which is correct - and this note is why the
next person to see the warning should re-acknowledge it rather than act on it.

AND IT IS NOT ONE ITEM. Measured 2026-09-09: 60 items carry a `source_file` under a temp directory.
Only this one is REPORTED, because reporting drift needs the file to still exist and to have
changed; the rest are silent, not clean. That is a product question rather than an item’s defect -
a capture that accepts a path in a temp directory records a provenance that cannot survive - and it
is the owner’s to rule on, not this lane’s to fix while D37 is being closed.

── PAUSED 2026-09-10, MID-LANE, BY OWNER INSTRUCTION. NOT FINISHED. ─────────────────────

The owner had to close his machine. The lane was stopped mid-verification and could not write its
own state, so this note is written from OUTSIDE it by the coordinator. Treat every claim here as
observed rather than reported: what the lane knew and did not say is lost, and the files are the
only reliable record.

WHAT IS ON DISK, UNCOMMITTED - 9 files, 762 insertions, 23 deletions:

  new       e2e/spill-evidence.spec.ts
  modified  src/ui/read-model-conversation-document.ts
  modified  src/ui/public/screens/conversations.js
  modified  src/ui/public/styles.css
  modified  src/ui/public/strings/en.js
  modified  src/ui/public/strings/he.js
  modified  test/ui/conversation-document.test.ts   (+243)
  modified  test/ui/server-e2e.test.ts              (+21)
  modified  docs/cli-ui-coverage.md

So the shape it chose is legible from the file list even though its reasoning is not: it went
through the DOCUMENT read model rather than the index alone, it drew something (both string tables
and the stylesheet moved), and it wrote a dedicated browser spec. Read those before assuming a
design; do not re-derive one and then discover the files disagree.

THE LAST THING IT SAID IS THE MOST USEFUL THING IT LEFT, and it is a warning about its own
evidence: "Exit 0 was `tail`’s, not Playwright’s. Let me get the real tallies and then re-run the
parts that matter." It had piped a Playwright run through `tail` and read the PIPE’s exit code as
the suite’s. So it was in verification, it had caught itself holding a FALSE GREEN, and it had not
yet re-run. **No browser number from this lane may be trusted.** Whoever resumes starts by running
the specs properly - both projects, serially, exit code read from Playwright itself.

THAT MISTAKE IS WORTH KEEPING RATHER THAN JUST FIXING. A pipeline’s exit status is the LAST
command’s, so `npx playwright test ... | tail -5` reports tail’s success whatever the suite did.
The coordinator made the same class of error twice today in reverse - reading a passing count out
of a grep and missing a failure line beneath it. Read the tally, not the exit code, or set
`pipefail`.

WHAT WAS ASKED OF IT AND IS THEREFORE STILL OPEN: re-measure `tool-results/` on the real corpus
(the item’s 1,318 files / 144.4 MB predates a harness prune - 867 subagent transcripts appeared
under scratchpad-probe project dirs on 2026-09-10, so the tree has moved); decide what to index and
what deliberately not; make a missing spilled file a DISCLOSURE rather than a dead link the way
`conv.doc.laneGone` does; and decide whether a spilled file belongs in a copied passage now that
seq:42 has put Ctrl+C on the well.

AND ONE THING THE RESUMING LANE SHOULD CHECK FIRST, because it is cheap and it changes the shape:
whether the index needed a new TABLE. seq:34 proved hours earlier that a COLUMN on `conversations`
is lost twice - `upsert` sets every column from `excluded` on every rebuild, and `removeMissing`
deletes the whole row when the harness prunes. If this lane stored anything the scan does not
produce, it needed a table, and the file list does not say whether it used one.
