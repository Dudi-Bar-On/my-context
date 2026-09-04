---
id: TASK-one-circled-question-mark-carries-every-screen-s-extended
type: task
title: one circled question mark carries every screen’s extended help, built once as a shared component
status: active
severity: soft
always: false
summary: A single disclosure component gives every screen a way to offer more without putting more on the page.
summary_of: 978eec60e8c3ca48
scope:
  - src/ui/public/lib/**
  - src/ui/public/styles.css
  - src/ui/public/strings/**
tags:
  - v2
  - ui
  - readability
  - i18n
  - "plan:screens"
  - "seq:20"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: e4384c4119f91d58
plan: screens
seq: "20"
state: done
priority: "1"
verified_on: 2026-09-04
---

# one circled question mark carries every screen’s extended help, built once as a shared component

Owner approved the mockup on 2026-09-04 with the words that it is exactly what was required,
including the help and the screen refactor. The approved picture is
reports/2026-09-04-scope-coverage-redesign-mockup.html and https://claude.ai/code/artifact/bddaa8be-22a4-49c9-9572-611e77494122.

This is the FIRST of the three and everything after it copies what it draws, so it is built
once and built properly. One icon, one interaction, one set of string keys. A reader who
learns it on scope coverage knows it on every screen. A second shape for the same idea is the
defect this exists to prevent.

The component already half exists: the screen has a details.help disclosure in one place. This
promotes it to the shared convention rather than introducing a rival to it.

What it owes. A short plain sentence stays on the page, always. The circle opens more detail
in the same plain words, with a concrete example where an example earns its place. The
approved mockup carries the worked one: why pinned items are not repeated per folder, ending
in an example about a file that does not exist yet.

Three boundaries, all from the standard and none negotiable. The extended help is a place for
MORE and never for DENSER, because a reader who opens it is the last person who should meet
jargon. It may not hold a fact a reader needs in order to understand what they are looking
at; it carries what is useful to some readers sometimes, never what is required by all
readers always. And a measured zero is still drawn and named, so brevity never becomes
silence.

Both languages, and every string keyed. Text built in script has no key and is permanently
English on the Hebrew page, which is a defect class that took a lane of its own to clear
today and must not be reopened here.

Verify it in a browser, closed and open, in English and Hebrew, and with a keyboard as well
as a mouse: a disclosure nobody can reach without a pointer is not finished. Then leave it
documented well enough that the next screen uses it without asking.
