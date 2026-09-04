---
id: DEC-the-web-screens-may-write-and-compose-then-run-in-a-terminal
type: decision
title: the web screens may write, and compose-then-run-in-a-terminal is retired
status: active
severity: soft
always: false
summary: "The read-only rule for the web UI is overturned by the owner after using it: screens may perform writes rather than only composing commands."
summary_of: 46474f8a8f1b7089
scope:
  - src/ui/**
  - test/ui/no-writes.test.ts
tags:
  - v2
  - ui
  - writes
  - architecture
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 45035e38cda712ec
---

# the web screens may write, and compose-then-run-in-a-terminal is retired

Owner ruling, 2026-09-04, in his own words: he knows this contradicts the previous decision not
to enable writes from the web, and after using it himself he changed his mind because copying a
command and executing it on a different screen in a terminal is clumsy. He states that he
understands the risks, knows the protection mechanisms already implemented, and approves that
from now on the web screens can write.

WHAT THIS RETIRES. Every write surface until today COMPOSED a command a person then ran
elsewhere. The doctor screen composes a settlement, the config writer is run in a terminal, and
the navigation itself carries the heading CHANGE, COMPOSED, NEVER RUN. That pattern is no longer
the rule. It remains a legitimate CHOICE for an operation that genuinely wants a person at a
terminal, but it is no longer the answer that requires no argument.

WHERE THE OLD RULE ACTUALLY LIVES, which matters because it is not where a reader would look.
It is not a corpus item. It is a TEST: test/ui/no-writes.test.ts, which bans a module under
src/ui/ from binding any function named in the WRITERS list in that file. That test is the
mechanism, and changing this decision means changing what that test asserts rather than editing
a document. Whoever implements this must decide what the test asserts INSTEAD, because deleting
it outright would leave the strongest guarantee in the UI with no successor.

THERE IS PRECEDENT AND IT SHOULD BE FOLLOWED. The ask screen already reversed a comparable
restriction, recorded as the decision that it accepts typed SQL, reversing shown-never-typed. A
restriction lifted there did not become an absence of protection; it became a different, stated
protection. The same is expected here.

WHAT DOES NOT CHANGE, and none of it is weakened by this ruling. The approval boundary is still
DERIVED by probing which commands refuse without consent, never declared in a list. A write still
backs up before it acts and prints where. A change still states the number of items it would
touch before the gate. Origin is still recorded on every mutation. The owner cited these
protections as the reason he is comfortable, so a screen that writes must inherit them rather
than route around them.

This settles the open question left in the requirement about editing configuration from the web,
which recorded the contradiction and deliberately did not resolve it.
