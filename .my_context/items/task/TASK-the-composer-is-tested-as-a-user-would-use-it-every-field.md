---
id: TASK-the-composer-is-tested-as-a-user-would-use-it-every-field
type: task
title: the composer is tested as a user would use it, every field, every value, every combination
status: active
severity: soft
always: false
summary: "Nothing on the command builder is taken on trust: every input is tested by running the command and checking what it actually did."
summary_of: 71811f52218a7ea8
summary_was:
  - "2026-09-06 Nothing on the command builder is taken on trust: a plan is written for the whole surface, executed, and every failure fixed until it passes."
scope:
  - src/ui/public/screens/palette.js
  - src/ui/public/lib/palette-defs.js
  - e2e/**
tags:
  - v2
  - ui
  - composer
  - testing
  - "plan:builder"
  - "seq:11"
  - "state:todo"
  - "priority:3"
  - "needs:builder/9"
  - builder/10
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 266530ad17691669
plan: builder
seq: "11"
state: todo
priority: "3"
needs: builder/3,builder/4,builder/5,builder/6,builder/8,builder/15
---

# the composer is tested as a user would use it, every field, every value, every combination

Owner ruling 2026-09-06 (plan D12), RE-CUT the same day after the Composer changed under it.

HIS INSTRUCTION, unchanged and still governing: the tools plan the tests, test every single feature
and input of the Composer - all fields, all values, all combinations - nothing skipped. Then the
plan is executed and failures are fixed by systematic debugging until every test passes.

AND THE BAR HE SET, which is the sentence that decides what "passes" means: a test passes only once
the command has been EXECUTED and has RETURNED THE CORRECT RESULT. A composed line that looks right
is not a passing test.

WHY THIS WAS RE-CUT. The original was written on 2026-09-06 morning and its every number is now
stale, and one of its assumptions turned out to be false.

  THE SURFACE MOVED. D10 gave four fields pickers; D11 landed two of three suggest inputs; D20 made
  every id in a result open the item pane; D21 put the executed command above its own output. The
  original's "30 entries, 89 fields, 21 pickers, 8 option sets, 60 free-text" is a snapshot of a
  screen that no longer exists. RE-MEASURE FIRST and put the numbers in the report; do not inherit
  a single figure from this item, including the ones written here.

  THE TWO RUN PATHS DISAGREE, and this is the real reason for the re-cut. `builder/15` measured it:
  composing `mycontext list rule` and pressing RUN calls `/api/items`, which ignores the category
  and accepts no query parameters at all, so the screen answers 965 rows of every type under a
  composed line that says `list rule`. EXECUTE, the real CLI, returns 56. The owner's bar names
  BOTH verbs - "execute and run" - so this task must test BOTH PATHS AND ASSERT THEY AGREE. The
  original never said so, because nobody knew they could differ.

  Consequently `builder/15` is now a prerequisite rather than a finding this task would rediscover.
  Testing against a known disagreement would fail on the first entry and tell nobody anything new.

WHAT "EVERY COMBINATION" HAS TO MEAN, unchanged because it is still right: taken literally it is
unbounded and an unbounded plan is not a plan. Every field exercised on every command that carries
it; every fixed option chosen; both branches of every boolean; required-missing and required-present
for each; and for free text the values that have bitten this product before - a value with a space,
a quote, a shell metacharacter, a leading hyphen, an empty string, a very long string, and a
right-to-left string in a left-to-right field. The combinatorial part is pairs that INTERACT, never
the cross product of every field.

THE COMPOSED LINE IS STILL AN ASSERTION, and now it is not the only one. What the screen produces
for a non-runnable entry is text a person pastes into a shell, so quoting is still the failure mode
that matters most there. But for a runnable entry there are now three things to check and they can
disagree: the composed line, what RUN answers, and what EXECUTE answers.

THE REFUSALS ARE PART OF THE SURFACE, not an edge of it. For every entry marked `runnable: false`
the CORRECT RESULT IS THE REFUSAL, and a test that succeeds in executing one is a security
regression rather than a pass. Entries that sit on the approval boundary exercise the
confirm-and-nonce path, which must not be bypassed to make a test convenient.

AND IT IS TESTED AS A USER, not as a module: driven in a browser, in both languages, clicking what a
person clicks. A screen that renders correctly and does nothing when used is the defect this rule
exists for. Three separate lanes found real defects this week by LOOKING AT A SCREENSHOT after every
assertion had passed - a chevron pointing the wrong way, a leading dot migrating under RTL, and an
output table shredded by a flex container. Assertions are necessary and have repeatedly been
insufficient.

FIXING IS PART OF THE TASK, not a follow-up: failures are traced to a root cause before a change is
made, one fix at a time, each measured.

THE CORPUS QUESTION IS A PREREQUISITE AND NOT A DETAIL. Roughly two thirds of the runnable entries
are writes, so executing them mutates a corpus. The standing rule is that tests run against the
current corpus and an exception needs the owner's approval FIRST. `e2e/execute.spec.ts` already
isolates write tests into their own workspace and is the precedent to follow rather than a new
mechanism to invent.
