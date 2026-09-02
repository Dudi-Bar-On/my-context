---
id: TASK-procedures-pr-sub-tells-every-reader-that-nothing-implements
type: task
title: "Procedures: `pr.sub` tells every reader that nothing implements the screen, and the app ships that sentence in both languages"
status: active
severity: soft
always: false
summary: A screen that works perfectly tells everyone who opens it that it has not been built yet, in both languages.
summary_of: d4edd5e86a79a72b
scope: []
tags:
  - v2
  - ui
  - walk
  - "screen:proc"
  - proposed
  - "plan:walk"
  - "seq:109"
  - "state:done"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 3d6e4f7c5c3600a9
plan: walk
seq: "109"
state: done
priority: "2"
progress: "0"
source: "plan:walk seq:5, measured against src/ui/public/strings/en.js, he.js and screens/proc.js on 2026-08-29"
---

# Procedures: `pr.sub` tells every reader that nothing implements the screen, and the app ships that sentence in both languages

FOUND 2026-08-29 under plan:walk seq:5, the PROPOSED audit. This is the exact sentence `DEC-proposed-is-a-stage-to-leave-not-a-label-to-keep` named as the reason the audit could not be skipped — *"the proc screen already ships a working procedure list, a step table and a command row while its own subtitle says `Decided; nothing implements it yet.`"* — and five days later nothing carries the correction.

**THE APP SHIPS IT, not only the design of record.** `pr.sub` is the screen's subtitle, declared in both string tables (`src/ui/public/strings/en.js` · `'pr.sub':` · ~668; `src/ui/public/strings/he.js` · `'pr.sub':` · ~508, where the Hebrew carries the same claim) and rendered unconditionally (`src/ui/public/screens/proc.js` · `sub.append(...ctx.t('pr.sub'));` · ~346). A reader who opens `#/proc` is told the screen they are looking at does not exist.

**WHAT IS TRUE INSTEAD, measured the same day.** `screens/proc.js` is one of the twenty-one registered loaders (`src/ui/public/app.js` · `proc: () => import('/screens/proc.js'),` · ~184), both routes behind it are registered and tested (`src/ui/proc-model.ts` · `const STAGES = ['proposed', 'ready', 'active', 'done', 'abandoned'] as const;`), and the screen draws a live card per procedure carrying a measured injection chip, a step table replayed from the audit log, a progress bar and a composed `procedure done` block. plan:port seq:7 and plan:api seq:2 are both done.

**WHAT THE WORK IS, AND IT IS THE APP'S HALF ONLY.** Reword the status claim in `en.js` AND `he.js` — the en/he direction of `strings-parity` is untouched by the 2026-08-26 ruling and still bidirectional, so one table alone is red. Keep the first half of the sentence: the definition — a rule is one instruction, a procedure is a sequence — is still exactly right and is the only thing on the screen that says what a procedure IS. Only the trailing status claim is false.

**DO NOT EDIT THE MOCKUP TO CLOSE THIS.** `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap` gives the design of record two jobs and one of them is history: the original sentence records what was true when the section was drawn. The surviving mockup-facing direction of `strings-parity` compares KEY SETS and not text, so a reworded value in the app cannot make that gate red. If the owner wants the mockup's copy corrected too, that is a separate sitting under `DEC-claude-drafts-the-mockup-and-the-owner-approves`, and it belongs with plan:walk seq:96 and seq:3 rather than here.

**THE CLASS, so this is not fixed one screen at a time by accident:** a screen reporting its own maturity in shipped copy. `port.sub` was corrected on 2026-08-23 for precisely this reason and now opens *"Built, and this screen reports it."* Nobody came back for `pr.sub`. `pk.sub` was checked in the same pass and makes no status claim, so it needs nothing.
