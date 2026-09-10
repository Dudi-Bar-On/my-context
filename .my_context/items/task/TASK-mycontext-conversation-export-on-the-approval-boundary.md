---
id: TASK-mycontext-conversation-export-on-the-approval-boundary
type: task
title: mycontext conversation export, on the approval boundary
status: active
severity: soft
always: false
summary: Marking a session to keep copies it outside the project and keeps that copy current as the session grows, so it survives the original being deleted.
summary_of: 0a655a7d13c9aa27
summary_was:
  - 2026-09-07 A reader looking at a conversation can take a copy of it, through the same consent gate every other write uses.
scope:
  - src/cli/commands/**
  - src/ui/public/screens/**
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:4"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 192686d83fbc5797
plan: archive
seq: "4"
state: done
priority: "2"
verified_on: 2026-09-10
---

# mycontext conversation export, on the approval boundary

Step 4 of five in docs/superpowers/specs/2026-09-04-conversation-archive-design.md.

The owner asked for this while looking at a conversation: let him take a copy. It writes a
file outside the workspace, so it belongs on the approval boundary with the rest of the write
surface.

The boundary is DERIVED by probing which commands refuse without consent, never declared in a
list, so this joins it by BEHAVING like a write rather than by being added anywhere. Read
test/helpers/approval-boundary.ts before choosing a consent shape.

Consent shape matters and this project distinguishes them: --yes is for a command performing
one write, while a command acting on N items uses --count, because stating the number IS the
agreement. Pick correctly and say why.

The spec titles this step composed, never run. That phrasing predates the owner’s ruling of
2026-09-04 that web screens MAY write, so do not inherit a restriction he has lifted - but do
not silently drop the protections either. Say what you chose.


─────────────────────────────────────────────────────────────────────────────
RE-CUT 2026-09-07 BY OWNER RULING: THIS IS PERSISTENCE, NOT A ONE-SHOT EXPORT.
─────────────────────────────────────────────────────────────────────────────

HIS WORDS: "if a session is marked as to stay persistent aka export (maybe PERSISTENT is a better
terminology, consider it), EVERY CHANGE IN A SESSION FILE SHOULD ALSO BE WRITTEN TO ITS PERSISTENT
EXTERNAL FILE IN ORDER NOT TO LOSE CONTENT."

THE DIFFERENCE THAT MATTERS: a one-shot export captures a session at a moment and then rots. A
session that is still being written to would be exported half-finished, and nobody would know which
half. Persistence is a STANDING MARK plus a MIRROR that keeps up.

ON THE TERMINOLOGY, since he asked for a view: PERSISTENT is the better word for the MARK and for the
MIRROR, and export should survive as a separate, narrower act - "give me one file I can hand to
somebody". They are not the same thing: persistence answers "do not lose this", export answers "let
me share this". If only one is built, build persistence, because it is the one that prevents loss and
the one his reasoning asked for.

THE MIRROR IS AN APPEND, NOT A REWRITE, and this is what makes it cheap enough to be automatic. The
transcript is JSONL and append-only; his own live session is 51.3 MB and 24,757 records. Copying the
file on every change is not affordable and is not needed - tail the bytes beyond what the mirror
already holds and append them. The index already stores `bytes` and `mtime_ms` per session and uses
(bytes, mtime_ms) as its freshness key, so the machinery to know what is new EXISTS.

WHAT MUST BE DECIDED, and each is a real fork rather than a detail:
  - WHERE the mirror lives. Outside the corpus is near-certain - a corpus that grows by 51 MB per
    session is not a corpus - and the global root ~/.my-context/ already holds exactly this kind of
    thing. Say where and why.
  - WHEN it runs. A mark is worthless if nothing acts on it. Candidates: the SessionEnd hook, the
    same upkeep pass that already maintains the UI server record, or an explicit command. A file
    watcher is the expensive answer and probably the wrong one.
  - WHAT IT COSTS ON THE HOT PATH. If this rides a hook, it is inside a measured budget. Measure it.
  - WHETHER A TRUNCATED MIRROR IS ALLOWED TO EXIST. If a session is marked persistent halfway
    through, the mirror starts from that point and the beginning is already unrecoverable. Say so on
    the row rather than letting a partial mirror look complete - INV-nothing-is-dropped-silently.

THE APPROVAL BOUNDARY THIS ITEM ALREADY CARRIED STILL APPLIES: writing a file outside the project on
a person behalf is an act that asks, not one that happens.
