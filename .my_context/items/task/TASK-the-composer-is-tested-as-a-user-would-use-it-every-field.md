---
id: TASK-the-composer-is-tested-as-a-user-would-use-it-every-field
type: task
title: the composer is tested as a user would use it, every field, every value, every combination
status: active
severity: soft
always: false
summary: "Nothing on the command builder is taken on trust: every input is tested by running the command and checking what it actually did."
summary_of: e1c12876cb13ff49
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
checksum: 4ffea2a11ead82d3
plan: builder
seq: "11"
state: todo
priority: "3"
needs: builder/3,builder/4,builder/5,builder/6,builder/8,builder/10
---

# the composer is tested as a user would use it, every field, every value, every combination

Owner ruling 2026-09-06 (plan D12). Dispatched only AFTER every other Composer task is complete -
builder/9 (D10), builder/10 (D11), and builder/4, /5, /6, /8.

HIS INSTRUCTION, and the word that governs it is EVERYTHING: the tools plan the tests, test every
single feature and input of the Composer - all fields, all values, all combinations - nothing
skipped. Then the plan is executed, and failures are fixed with systematic debugging until every
test passes.

AND THE BAR FOR PASSING, added by the owner the same day and it raises the whole task: a test
passes only once the command has been EXECUTED and RETURNED THE CORRECT RESULT. A composed line
that looks right is not a passing test. What the command does when it runs is the assertion.

THAT TURNS THIS INTO A TASK THAT MUTATES, and the consequences have to be settled before it is
dispatched rather than discovered by it:

  - 19 of the 30 catalogue entries are writes. Running them for real changes a corpus.
  - The owner’s standing rule is that tests run against the CURRENT corpus because this project
    dogfoods itself, and an exception must be approved by him first. Executing `add`, `edit`,
    `supersede` and `rebuild` against the live corpus to prove a screen works is exactly the case
    that rule was written for. THE SCRATCH-CORPUS QUESTION IS HIS, and it is a prerequisite.
  - Three entries are `runnable: false` by ruling - `init`, `audit`, `procedure done`. For those,
    the correct result IS the refusal, and a test that executes them successfully is a security
    regression rather than a pass.
  - 16 of the 27 runnable entries sit on the approval boundary, so executing them exercises the
    confirm-and-nonce path as well as the command. That path is the product’s own gate and must
    not be bypassed to make a test convenient.

THE SURFACE, measured 2026-09-06: 30 catalogue entries, 89 fields. 21 sourced pickers, 8 fixed
option sets, 60 free-text inputs. The id picker carries 938 options.

WHAT "EVERY COMBINATION" HAS TO MEAN, because taken literally it is unbounded and an unbounded
plan is not a plan. Every field exercised on every command that carries it; every fixed option
chosen; both branches of every boolean; required-missing and required-present for each; and for
free text the values that have bitten this product before - a value with a space, a quote, a shell
metacharacter, a leading hyphen, an empty string, a very long string, and a right-to-left string
in a left-to-right field. The combinatorial part is pairs that INTERACT, not the cross product of
all 89.

AND IT IS TESTED AS A USER, not as a module. Driven in a browser, in both languages, clicking what
a person clicks. A screen that renders correctly and does nothing when used is the defect this
rule exists for.

FIXING IS PART OF THE TASK, not a follow-up: failures are traced to a root cause before a change
is made, one fix at a time, each measured.
