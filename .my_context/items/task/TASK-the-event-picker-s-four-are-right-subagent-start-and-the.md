---
id: TASK-the-event-picker-s-four-are-right-subagent-start-and-the
type: task
title: the event picker's four are right; subagent-start and the tool/jit rename are undisclosed
status: active
severity: soft
always: false
summary: Confirms that the list of events offered on screen is complete, and names two things the app never tells the reader.
summary_of: c7803b8742d1f502
scope: []
tags:
  - v2
  - ui
  - walk
  - "plan:walk"
  - "seq:57"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 257622de37a39afb
plan: walk
seq: "57"
state: todo
priority: "3"
source: owner asked to verify, 2026-08-28
---

# the event picker's four are right; subagent-start and the tool/jit rename are undisclosed

> Asked to verify: the owner noticed the Injection preview's event picker offers FOUR values and asked whether there should be more (2026-08-28).
>
> ## Verified: four is correct, and the reasoning is already on the record
>
> The picker's four are `SELECT_EVENTS` in `ui/read-model.ts` · `SELECT_EVENTS` · ~193, matching `SelectEvent` in `core/select.ts` · `export type SelectEvent = 'session-start' | 'compact' | 'tool' | 'manual';` · ~17 exactly: `session-start | compact | tool | manual`.
>
> Five ops write `kind: 'injection'`, not four:
>
>     session-start     `core/inject.ts` · `op: manual ? 'manual' : subagent ? 'subagent-start'` · ~842
>     compact-restore   `core/inject.ts` · `op: manual ? 'manual' : subagent ? 'subagent-start'` · ~842
>     jit               `hooks/pre-tool-use.ts` · `op: 'jit',` · ~304
>     manual            `core/inject.ts` · `op: manual ? 'manual' : subagent ? 'subagent-start'` · ~842
>     subagent-start    `hooks/subagent-start.ts` · `op: 'subagent-start',` · ~150
>
> The fifth is absent from the picker BY DESIGN and `inject.ts` · `SelectEvent` · ~485 says so in as many words: a subagent *"selects as a session start — pinned in full plus the index, which is the decided payload (design decision 2). `SelectEvent` deliberately gains no member: a distinct one would need three new branches in `select` to arrive at the same answer."*
>
> So a fifth button would compute a byte-identical selection to `session-start`. **Nothing is missing from the picker.** No task should add one.
>
> ## Two disclosure gaps this verification did surface, and neither is the picker's fault
>
> **1. `subagent-start` appears in the log and has no preview, and nothing says why.** `mycontext audit` shows `injection/subagent-start` rows. A reader who then comes to the screen whose subject is "what does an event deliver" finds four buttons, none of them that one, and no statement that the answer is "identical to session-start". The honest fact is short and worth one sentence on the screen; the alternative — leaving a reader to conclude the preview is incomplete — is the same silent-omission shape this project has hit repeatedly.
>
> **2. The picker says `tool`; the log says `jit`.** One event, two names, across two surfaces a reader is expected to join. `SelectEvent`'s member is `'tool'` and the audit op is `'jit'` (`hooks/pre-tool-use.ts` · `op: 'jit',` · ~304). Neither name is wrong in its own file. Renaming either is a wider change than this task should take on unprompted, but the mapping belongs somewhere a reader can find it.
>
> ## Not a bug, and that is the finding
>
> This item exists because "verified, and here is why four is right" is worth as much as a defect would have been, and because the next person to count four buttons against five ops will otherwise repeat this exact measurement. `DEC-a-nothing-row-is-written-down-rather-than-left-absent` is the same argument one layer down.
>
> ## Done when
>
> The screen states that a subagent's delivery is previewed by `session-start` and why, OR the decision is recorded that it should not; the `tool`/`jit` mapping is written down where a reader joining the picker to the audit log will meet it; both string tables carry any new key, with `{m:...}` markers in the mockup's Hebrew copy so `bidi.spec.ts` does not fail on a run-count mismatch; and no fifth event is added to the picker.
