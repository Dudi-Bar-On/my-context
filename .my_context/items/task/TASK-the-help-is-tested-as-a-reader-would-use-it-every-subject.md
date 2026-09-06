---
id: TASK-the-help-is-tested-as-a-reader-would-use-it-every-subject
type: task
title: the help is tested as a reader would use it, every subject, and every claim checked against its source
status: active
severity: soft
always: false
summary: Every entry in the help is opened by a person and checked to be telling the truth, not merely to be drawing something.
summary_of: f78432b0fe5b2969
scope:
  - src/ui/read-model-cli-help.ts
  - src/ui/public/screens/cli-help.js
  - e2e/**
tags:
  - v2
  - ui
  - help
  - testing
  - "plan:library"
  - "seq:6"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 682d0579c4b8ddca
plan: library
seq: "6"
state: todo
priority: "3"
needs: library/3,library/4,library/5
---

# the help is tested as a reader would use it, every subject, and every claim checked against its source

Owner ruling 2026-09-06 (plan D27): "do the same as D12 but for the help".

SO THE INSTRUCTION IS D12’S, TRANSPOSED: the tools plan the tests, cover every subject and every
section of every subject, nothing skipped; then the plan is executed and every failure is fixed by
systematic debugging until it passes.

BUT THE BAR CANNOT BE COPIED ACROSS, AND GETTING IT RIGHT IS THE WHOLE TASK. D12’s bar is that a
test passes only once the command has been EXECUTED and returned the correct result, because the
Composer’s job is to produce something that runs. The help produces nothing that runs. Its job is
to be TRUE.

  THE EQUIVALENT BAR: a test passes only once the claim on the screen has been compared against the
  DERIVATION IT CAME FROM and found equal. Not "the card rendered". Not "a flag table appeared".
  The flag names, formats, examples, notes, argument hints, tool arguments, enum values and topic
  text must each equal what the product itself answers when asked.

THIS IS NOT A THEORETICAL DISTINCTION - IT IS THE DEFECT CLASS THIS SCREEN HAS ALREADY SHIPPED,
three times in one day, every one of which a render test would have passed:
  - slash commands drew no parameters for weeks while 90 of 91 files declared `argument-hint`. The
    card rendered perfectly and said nothing true about what a command takes.
  - a help topic drew `##` instead of a heading, because it was `<pre>` where the source was
    Markdown. Correct output of the wrong thing.
  - `command-flags.ts`’s own header still says "the partition still covers all 41" when the total
    is 44, and no test reads that sentence.

THE SURFACE, to be RE-MEASURED and never inherited from this item: four kinds - command, slash,
tool, topic - and on the day this was written the picker offered 166 subjects (44 + 91 + 25 + 6).
Every number here will be stale; D12 was re-cut for exactly that reason within a day of filing.

WHAT "EVERY SUBJECT" HAS TO MEAN, because 166 x every section is not a plan: every subject opened,
and for each, every SECTION the skeleton promises it. Where a section is absent the test asserts
the absence is MEASURED rather than accidental - the difference between "takes no argument" and
"nobody wrote it down" is the distinction this screen exists to preserve, and `LoadMyContext` is
the one real case of the former.

AND IT IS DRIVEN AS A READER, in a browser, in BOTH LANGUAGES. Hebrew is not a translation check
here, it is where this screen breaks: a 600-character example line opened the page to 1,325px of
horizontal overflow, a breadcrumb rendered its leading dot at the wrong end under RTL, and `pal.run`
and `exec.btn` are STILL the same word. Every one was found by looking at a picture after the
assertions passed.

THE REFUSALS ARE PART OF THE SURFACE. `help cli` is withheld by design and its refusal must name
the reason rather than claim no such topic; an unknown kind is 400 and an unknown id is 404, kept
apart on purpose. A test that lets those two blur is testing the wrong thing.

HELD until the help stops moving: D24, D25 and D26 are in flight and each changes what a subject
draws. Testing a surface mid-refactor produces a plan that is stale before it is executed - which
is precisely what happened to D12.
