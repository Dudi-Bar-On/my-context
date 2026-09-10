---
id: TASK-the-archive-borrows-claude-code-own-session-name-and-never
type: task
title: the archive borrows Claude Code own session name and never offers one of its own
status: active
severity: soft
always: false
summary: "The archive shows the name Claude Code gave a session and offers no way to give it one of its own; seq:10 says that silence is not defensible either way."
summary_of: e40356d4e126548f
scope:
  - src/ui/**
  - src/core/conversation-index.ts
  - src/cli/commands/conversation.ts
tags:
  - v2
  - ui
  - archive
  - "plan:archive"
  - "seq:34"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: f90e4b1b57947320
plan: archive
seq: "34"
state: done
priority: "3"
---

# the archive borrows Claude Code own session name and never offers one of its own

BUILT 2026-09-10. The archive now offers a name of its own, the harness's is still drawn beside it, and the screen says which is which.

WHAT SHIPPED. A `named(session_id, name, named_at)` table in the conversation index; `setName`/`nameOf`/`names`/`clearName` on ConversationIndex; `mycontext conversation name [<session>] [<name>] [--clear] [--json]`, with a bare form that lists every name beside what Claude Code calls the same session; `name` and `namedAt` on ConversationSummary and on DocOutlineBody, BESIDE `title`/`titleSource` and never instead of them; the search reading the name; and `titleNodes` drawing our name as the heading with `(named here)` and `Claude Code calls it X` after it. Four new strings in both tables. `conversation forget` now reports how many names it dropped.

WHERE THE NAME LIVES, AND WHY NOT WHERE THIS ITEM PROPOSED. The reversal was costed here as "a title_override column beside title, one CLI subcommand, and the screen preferring it", with the risk named in the same breath - "the override needs a column the rebuild must learn not to overwrite". Measured against the code, that column loses the name TWICE rather than once. `ConversationIndex.upsert` sets every column from `excluded`, and the Stop hook runs `rebuildConversations` at the end of every assistant turn, so a name typed by hand would have lived one turn. And `removeMissing` DELETES the conversations row when the harness prunes the transcript (seq:11's ruling), taking any column on it. So the store is a TABLE, which is exactly the shape `persisted` already is and for the same reason: what the owner put there outlives what the scan found. The rebuild had to learn nothing, because no writer of the scan can reach it.

PROVED BY REMOVAL RATHER THAN ARGUED. With `DELETE FROM named` added to `upsert` and to `removeMissing` - the column defect, simulated - exactly two of the nine tests in test/cli/conversation-name.test.ts go red and the other seven stay green: "a name survives the rebuild that would have overwritten a column" and "a name survives the sweep that would have deleted the row it sat on".

WHAT THIS ITEM CLAIMS THAT MEASUREMENT CONTRADICTS. "This archive has exactly one writer - mycontext conversation rebuild" is not true of the code: `conversation persist` writes the `persisted` table, `advanceMirrors` rewrites conversations rows with source `exported`, and `conversation forget` drops the tables. The second of those is the precedent the item was looking for and did not cite. Everything else it measured still holds, re-measured today: 2 sessions in this workspace, one titled MyContext V2.0 with title_source `custom` and one with no title at all; and no list row draws the session id - the row is name, day, counts, lanes, duration, branch, size.

HOW A READER TELLS HIS NAME FROM THE HARNESS'S. Both are on the row. `title`/`titleSource` are untouched and still say `(named by the model)` where they did; ours is marked `(named here)` and the borrowed one follows as `Claude Code calls it X, which the model wrote` - or `Claude Code never named it`, which is the honest answer for a session the harness never titled. Nothing is written into the transcript: `naming a session writes nothing into the transcript` asserts the bytes, not the intention. A lane is refused by name, because it already carries the line its dispatcher typed and has no borrowed name to replace.

MEASURED. Unit suite 7357 tests, 1 failure - `statusline-chain`, on the documented contention list, 28 of 28 green alone. Archive e2e specs run serially in BOTH projects: 200 passed, 2 failed, and both failures are the documented pre-existing race in `a lane opened in a new tab can close itself`, one per project. The 8 new browser tests (4 in chromium, 4 in chrome) pass, and all 8 go red in both projects when the name branch is taken out of `titleNodes`. Evidence on both pages: `/#/conversations` in en and he draws the three parts in one heading, and `/lane.html?id=agent-named` draws the dispatcher's line with no mark at all, which is what a lane must look like.

ONE CONSEQUENCE ON UPGRADE DAY, WHICH IS THE DESIGNED PATH AND NOT A DEFECT. A new table is a new version by this index's own rule (seq:12, seq:33), so every index built before this build reports Incomplete until a rebuild. Measured on this workspace: the list said so in its own words, and one `mycontext conversation rebuild` healed it in 231 ms with zero whole re-reads.
