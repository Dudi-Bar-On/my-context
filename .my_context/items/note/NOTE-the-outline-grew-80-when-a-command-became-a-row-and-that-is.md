---
id: NOTE-the-outline-grew-80-when-a-command-became-a-row-and-that-is
type: note
title: the outline grew 80% when a command became a row, and that is the bound the next ruling holds
status: active
severity: soft
always: false
summary: Promoting every shell command and question out of the fold made the document's index nearly twice as large, and the numbers behind that trade are written down for whoever changes it.
summary_of: 88e95e96817473f2
scope:
  - src/ui/read-model-conversation-document.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - measurement
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 7536040963e79917
---

# the outline grew 80% when a command became a row, and that is the bound the next ruling holds

MEASURED on the owner's own transcript, 2026-09-09 - 74,195,701 bytes, 31,107 records - immediately before and after `plan:archive seq:16` promoted a shell command and a question to nodes of their own and `seq:28` began reading the payload of records that carry no `message`.

                                        BEFORE        AFTER      change
    nodes in the outline                 5,446        9,211        +69%
    outline response, JSON            950,883    1,713,726        +80%
    worst 24-node window              228,419      390,569        +71%
    outline walk                        378 ms       380 ms           -

WHY NO CAP WAS TAKEN, and it is the same reasoning `seq:7` and `seq:24` recorded rather than an inheritance of their answer. The largest single payload now served is 62,002 characters (an `invoked_skills` attachment) against the 58,888-character step text this list already drew whole before any of this, and the largest `queue-operation` payload is 51,745. Nothing in the file is out of scale with what was already uncapped, and 390 KB over loopback is the same order as the 215 KB `seq:24` measured and accepted.

WHAT THE GROWTH ACTUALLY BUYS, so the trade is legible: 2,502 deed nodes carry a `peek` of what the call ASKED, so the filter above the scroll finds a command by what it ran. Measured on the same file, `shell` matches 2,470 of 9,230 sections and `askuserquestion` matches 70. Before this, a search over 2,433 shell calls could match nothing but the word `Bash`.

THE CHEAPEST LEVER IF IT EVER NEEDS ONE, named so nobody has to find it again: `PEEK_CHARS` is 140 and every deed node carries one, which is roughly 350 KB of the 763 KB the outline gained. A smaller peek for a deed than for a turn would take most of it back and would cost the filter exactly as much reach as it removed.

WHAT IS DELIBERATELY NOT READ, so the omission is a decision rather than an oversight. `last-prompt.lastPrompt` is 1,322 records and 152,383 characters and is the harness restating a prompt the document already draws as its own turn; `bridge-session`, `ai-title`, `custom-title`, `agent-name`, `mode`, `permission-mode` and `atis-latch` are single short identifiers already named by `DocStep.subtype`. Reading any of them would be duplication, which is the one thing a document that tiles its record space cannot afford.
