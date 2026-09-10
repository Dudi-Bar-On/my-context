---
id: TASK-the-viewer-renders-what-the-terminal-showed-with-its
type: task
title: the viewer renders what the terminal showed, with its formatting and colour
status: active
severity: soft
always: false
summary: The saved conversation looks like the terminal it came from, colours and layout included, instead of plain text in boxes.
summary_of: ec3d855df737c39f
acknowledged:
  - body_disagrees_with_meta@9af8fcfe1b3522e3
scope:
  - src/ui/**
  - src/core/conversation-index.ts
  - e2e/**
tags:
  - v2
  - ui
  - archive
  - "plan:archive"
  - "seq:8"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 53637a2584ddc97f
plan: archive
seq: "8"
state: done
priority: "1"
verified_on: 2026-09-10
---

# the viewer renders what the terminal showed, with its formatting and colour

Carries out REQ-the-conversation-archive-is-a-terminal-you-can-scroll-not-a clause 6: "render the content AS CLOSE AS IT COULD BE TO WHAT WAS SEEN ON THE
TERMINAL ... a VIEWER that would support FORMATTED AND COLOR supporting to SIMULATE AS POSSIBLE TUI."

HIS TWO PERMISSIONS, and they are permissions rather than instructions:
  - "if you find it helpful you could look for PRE MADE UI COMPONENTS that will make the
    implementation more reliable, good looking and shorter to implement"
  - "DO NOT USE THE CSS STYLE OF THE APP CARDS, it should not be limiting you - you can use the
    cards to EMBED IN THEM components"

THE COMPONENT PERMISSION HAS A PATH ALREADY BUILT, so nobody needs to re-argue it against the
dependency constraint. src/ui/public/lib/vendor/ holds third-party code committed UNMODIFIED, pinned
by byte count and SHA-256 in VENDOR.md, gated by npm run check:vendor - which also proves the file
cannot fetch, eval, import outside its pinned set, or reach the network at render time.
CONST-zero-runtime-dependencies is not bent: dependencies stays empty and a vendored file is a static
asset, the same category as the nine committed .woff2 faces. So VENDOR IT, PIN IT, AND IT MUST RENDER
OFFLINE. An npm dependency is still refused. An ANSI-to-HTML renderer is the obvious candidate; cost
it against writing one, and say which and why.

THE CARD RULING IS A RELEASE, NOT A BAN: the app card CSS must not constrain this viewer, and a card
may still contain it. Expect to write CSS that looks unlike the rest of the app, and do not let
anyone correct it for that.

CHECK WHAT THE TRANSCRIPT ACTUALLY HOLDS BEFORE DESIGNING THE RENDERER. The records are JSONL from
the harness; whether they carry ANSI escapes, pre-rendered text, or structured blocks decides this
entire task. Measure it on the owner real transcript, not on a fixture.

LANDED 2026-09-08 in b15a9ea, and closed on evidence rather than on a status flip.

The lead in this item was WRONG and the lane measured before believing it. Across 63,871,429
bytes and 27,752 records, ONE record carries an ANSI escape - a Playwright timeout quoting its
own dim call log - and 3,684 rendered fields carry none. So nothing was vendored for it: the
transcript is structured JSON whose text blocks hold MARKDOWN, which is what the terminal itself
renders, and the weight moved onto lib/markdown.js which was already vendored and gated.

`src/ui/public/lib/ansi.js` still exists and still earns its place, but for the job that runs on
every record rather than the one that runs on 0.004% of them: it honours SGR and REMOVES non-SGR
sequences, so a stray [2J never renders as literal text.

PINNED BY A TEST A READER CAN RUN: `e2e/conversations.spec.ts` - `a turn renders with its
formatting, and terminal colour survives` - in both languages, and that file names this item in
its `@basis` header.
