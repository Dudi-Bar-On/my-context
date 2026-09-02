---
id: TASK-the-projection-refusal-says-everything-twice-and-leaks-an
type: task
title: the projection refusal says everything twice, and leaks an absolute filesystem path
status: active
severity: soft
always: false
summary: A refusal says the same thing twice, once plainly and once in developer language, and prints out a private file path.
summary_of: 5f02900d99c6a033
scope: []
tags:
  - v2
  - ui
  - review
  - audit
  - "plan:walk"
  - "seq:33"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 64dc562724c9c0bf
plan: walk
seq: "33"
state: todo
priority: "2"
source: "plan:review seq:5, the functional UX review, 2026-08-25"
---

# the projection refusal says everything twice, and leaks an absolute filesystem path

FOUND 2026-08-25 by plan:review seq:5, the functional UX review, 2026-08-25. Captured verbatim from the running app on a behind projection, on watch, ask and decay alike:

    the audit projection is behind relative to its log, and this endpoint may not catch it
    up: syncing is a write, and answering from it anyway would present a partial history as
    a complete one. Run `mycontext audit` to build it; a read surface may not, because
    building it is a write. (my_context: C:\Users\...\.demo-corpus\.my_context\.audit\
    audit.db is behind relative to the audit log - the log has grown since it was last
    synced. Bringing it up to date is a WRITE (`syncProjection`), which a read may not
    perform: a stale projection is a state to report, not one to repair behind the user.
    `mycontext audit` performs the sync.)

TWO DEFECTS IN ONE STRING.

ONE -- IT IS THE SAME MESSAGE TWICE. The screen s own keyed sentence, then the server s raw error appended in parentheses, saying the same four things again in developer language: the projection is behind, syncing is a write, a read may not do it, run `mycontext audit`. The second copy adds nothing a user can act on and it is where the sentence stops being readable -- it more than doubles the length of a message whose whole job is to be read.

TWO -- IT PRINTS AN ABSOLUTE PATH INTO `.audit/audit.db`. A user-facing surface naming an internal file by absolute path is a leak of the host s directory layout, and it is gratuitous here: the user does not act on the path, they act on the command.

WHY IT HAPPENS: the screen renders the server s refusal text VERBATIM beside its own keyed sentence. That instinct is right in general -- `plan:builder seq:4` rules that a composed command must return the CLI S OWN refusal text, because this project has spent real effort making those good. THE RULE NEEDS AN EDGE: when the screen ALREADY HAS A KEYED SENTENCE FOR A STATE, the server s prose is a duplicate, not a detail. Show one.

AND NOTE THE ASYMMETRY WORTH KEEPING: the CLI s message is written for a terminal, where the absolute path is genuinely useful because the reader may be in another directory. The browser reader is not. Same fact, two audiences, and only one of them needs the path.
