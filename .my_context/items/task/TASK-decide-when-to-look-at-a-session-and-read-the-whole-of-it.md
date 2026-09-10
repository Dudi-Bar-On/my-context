---
id: TASK-decide-when-to-look-at-a-session-and-read-the-whole-of-it
type: task
title: decide when to look at a session, and read the whole of it
status: active
severity: soft
always: false
summary: Work out when a session is worth reviewing and read everything that happened in it, without ever making the user wait.
summary_of: bdaa33022c505b0e
scope:
  - src/**
  - test/**
  - scripts/**
tags:
  - v2
  - review-loop
  - "plan:loop"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 76a46db595cfc4c5
plan: loop
seq: "2"
state: done
priority: "1"
needs: loop/1
---

# decide when to look at a session, and read the whole of it

D36b, done 2026-09-10. Five modules: core/review-counter.ts (the counter), the bump in hooks/post-tool-use.ts, review/rubric.ts, review/input.ts (the whole read), review/pass.ts + review/trigger.ts (the detached dry run), wired into Stop and PreCompact, with a `review` block in core/config.ts. It ends at a dry run: `created` is a FIELD on every report and always empty.

WHAT DECIDES THAT A SESSION IS WORTH LOOKING AT. Six gates in cost order — not a lane, a workspace, a config that parses, `review.enabled` (the one switch), the ration, the interval (waived on PreCompact), and one `stat` saying there are new bytes since the last pass. Replayed over his own session by scripts/review-trigger-replay.ts: 87,056,891 bytes, 36,448 records, 3,924 tool calls; at everyNToolCalls 15 that is 261 considerations, 164 rubric fires, 3 passes. THE RATION BOUNDS VOLUME, NOT THE RUBRIC — and firing on every Stop would have been 766 passes in that one session. The rubric still earns its place: 28 of its 97 refusals are stretches of fifteen tool calls with no admitted point at all, which is mid-derivation exactly as arXiv:2606.23525 describes.

SessionEnd was refused on a count rather than an argument: 0 rows in 36,084 audit records, against 1,094 `stop`, 17 `pre-compact` and 54 `session-start`.

THE RUBRIC RUNS IN THE CHILD, NOT THE TRIGGER — the plan and spec s2 both put it in the trigger and measurement says it cannot be. It reasons over points, points come from the reader, and the reader costs 1,297 ms over 86.7 MB while Stop has a person waiting. Running it over a cheap tail instead would be a decision made on a sample. It still runs before any model call, which is where the paper's saving is.

THE WHOLE OF IT, GUARANTEED AND DISCLOSED. gather() reads the session transcript and every lane transcript through the reader that exists, bounded per file by MAX_SCAN_BYTES and in aggregate by 4 GiB, and carries `whole` plus a `skipped` list naming every file, its size, what was read and why it fell short — cap, budget, unreadable, excluded, shrank. wholenessLine() is the first field of the report and leads with NOT when anything was missed. sinceByte bounds what is RETURNED and never what is scanned.

THREE FIGURES IN SPEC s3b ARE WRONG. It says 478 task transcripts totalling 91 MB in Temp. Measured: 280 lane files, 694 MiB, in <transcriptDir>/<sessionId>/subagents/ — 8.4x the session file, not a supplement to it. And the archive indexes them already (listSubagentFiles / subagentDir), so this consumes that rather than extending the scanner. Reading the whole of it: 816,525,094 bytes, 152,312 records, 281 sources, 3.3 s.

THE FINDING THAT CHANGED THE CODE. A lane's DISPATCH BRIEF is a `type: user` record, so the reader labels it `person` and admits it on the person's low bar (ADMIT_SCORE_PERSON 1 against the model's 3, plus a 40% reserve). Across the 280 lanes that is 1,927 person points against 1,165 model points, from 1,453,700 characters of "person" text — 33x the 44,006 the owner actually typed, and none of it his: it is the parent model quoting items the corpus already holds. In one lane, five of the top six points were record 0, one brief split into paragraphs. Feeding that to a loop that proposes items is the corpus proposing its own rules back to itself, and it defeats s3c's independence check, because one rule quoted into ten briefs looks like ten confirmations. So in a lane transcript nobody typed anything and every person-side point is dropped; 1,867 dropped on his corpus, counted as `briefPoints` and printed in the wholeness line. session-summary.ts is NOT changed — its labelling is right for the file it was written for.

CONFIG. Six of s11's nine keys are accepted; maxProposalsPerPass, crossSessionSameCwd and model are REFUSED by name with a message saying they belong to a later phase, because this build proposes nothing and calls no model, and a key accepted and ignored is the one-way failure config.ts refuses everywhere else. readWholeTranscript is accepted and true is the only behaviour this build has.

PROVED BY REMOVAL, ten mutations, ten red, each restored: the kill switch, detachment, recordIndexAt, the excluded-lane disclosure, the aggregate budget, the counter's per-session reset, its corrupt-file tolerance, the hook's lane gate, the rubric's ordering, and the lane-brief filter. Two of those runs were worth more than the eight: the rubric's ordering mutation came back GREEN and exposed a vacuous test (a `decision` fires alone, so the failure branch was never reached), and the never-waits test failed on RESTORED code as a timing ratio, so it was rewritten as a state assertion — the report does not exist when the trigger returns, which is true on any machine at any speed.

WHAT IS STILL UNSEEN, SAID RATHER THAN LEFT QUIET. Every figure is a floor: the transcript records what was said, not what was understood or acted on, and not the reasoning that never reached a lane's file. The trigger can miss a session — a state directory that cannot be written reads as zero forever and the pass never fires, and there is nowhere on the PostToolUse path to say so, which is why the Stop and PreCompact rows carry the verdict. And a lane transcript still holds false starts beside recoveries; the rubric refuses an unresolved failure, but s12's own limit stands — these rules catch carelessness, not falsehood.

Unit suite 7,338 pass, 0 fail.
