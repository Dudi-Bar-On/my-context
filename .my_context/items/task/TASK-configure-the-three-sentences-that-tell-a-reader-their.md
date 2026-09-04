---
id: TASK-configure-the-three-sentences-that-tell-a-reader-their
type: task
title: "Configure: the three sentences that tell a reader their config is broken are drawn in English with no key"
status: active
severity: soft
always: false
summary: The messages telling someone their settings file is broken appear only in English, on a screen that is otherwise blank and otherwise translated.
summary_of: d4a6b6afb6ac3d78
scope: []
tags:
  - v2
  - ui
  - i18n
  - walk
  - "screen:config"
  - "plan:walk"
  - "seq:105"
  - "state:todo"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: f7a4aaecbf123e57
plan: walk
seq: "105"
state: todo
priority: "1"
progress: "0"
needs: walk/92
source: "plan:walk seq:27, measured against src/ui/public/screens/config.js on 2026-08-29"
---

# Configure: the three sentences that tell a reader their config is broken are drawn in English with no key

WHAT THE SCREEN IS, so it can be built without opening the mockup. `nav.ch` -- **Configure**, `<section data-p="config">`, carrying `cfg.v`, "the strongest 'a terminal cannot do this'" claim in the product. ONE PANE PER CONFIGURATION SUBJECT -- Profile, Categories, Budgets, Watched documents -- each with its own heading, its own value in force and its own settle step. Every closed vocabulary is a `.segbar` served by `GET /api/config`'s `meta`; the three places free text is unavoidable carry the value IN FORCE as a placeholder and a sentence saying what it is for. THE SCREEN COMPOSES AND DOES NOT WRITE: `.my_context/config.json` is deny-hooked, so each pane ends in the exact bytes to paste, the ABSOLUTE path the endpoint reported, and ONE composed command that CONFIRMS the edit took. Three panes compose a line; Budgets does not, because no `mycontext` command reads or writes a budget -- it has the ruled-in `BUDGETS_ID` execute branch instead. Every pane's blast panel is filled by `POST /api/config/preview` with that pane's candidate config, and every number on it is measured server-side or it is not drawn.

WHAT IT OWES: **the three sentences a reader sees when their configuration is broken are the loader's own English, and no key declares any of them.**

  `config.parseError`   -- the file does not parse. A hard stop: `resolved` is null and nothing is drawn underneath.
  `config.resolveError` -- the file parses and does not load. The same hard stop.
  `skippedNotice`       -- keys the loader dropped, which `src/ui/read-model-config.ts` requires be printed in its own words: "a surface that shows config to a human and does not print this notice has re-created the silent drop this field exists to end."

All three go through `errorNote`, the established treatment for a refusal, and the file records the reason: `configure.parseError` / `configure.resolveError` are "the plan's names for keys that were never added, and adding them would fail `test/ui/strings-parity.test.ts` in the direction that names a key the design of record does not declare".

THAT REASON EXPIRED ON 2026-08-26. See plan:walk seq:92, which this task waits on.

WHY THIS SITE IS WORSE THAN THE OTHER UNKEYED-STRING SITES. On the first two the screen draws NOTHING ELSE -- it renders the note and returns. So a Hebrew reader whose `config.json` is broken gets one English sentence on an otherwise empty screen, on the screen whose whole claim is that a terminal cannot do this. And the third is the notice a requirement compels this surface to print; printing it in a language the reader may not have is close enough to not printing it to be worth saying out loud.

THE HONEST SHAPE OF THE FIX, because the loader's message is composed at run time from paths and key names and cannot be translated by a lookup -- this is the same problem `screens/doctor.js` solved for `Finding.message`: key the FRAME, not the text. A `cfg.` key that says "this configuration file could not be parsed" with the loader's own sentence rendered beneath it, unedited, the way `messageRuns` keeps the checker's words and isolates only what he delimited. Do NOT translate the loader's sentence, and do not paraphrase it: it names the file and the character position, and those are what the reader has to act on.
