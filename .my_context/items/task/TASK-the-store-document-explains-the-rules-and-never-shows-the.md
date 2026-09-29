---
id: TASK-the-store-document-explains-the-rules-and-never-shows-the
type: task
title: the store document explains the rules and never shows the tool a person actually uses to change them
status: active
severity: soft
always: false
summary: The store document now shows the maintenance tool with real screenshots, gives a filled template for each of the five entry kinds, and walks one entry from a draft to something that ships.
summary_of: 5d3812a578140474
summary_was:
  - 2026-09-16 Add the maintenance screens, a template for each kind of entry, and the path from a draft to something that ships.
scope:
  - docs/the-store.he.md
  - src/ui/maintenance/**
  - src/rules/**
tags:
  - v2
  - docs
  - "plan:rulings"
  - "seq:95"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 1ed82d6cc7386868
plan: rulings
seq: "95"
state: done
priority: "1"
---

# the store document explains the rules and never shows the tool a person actually uses to change them

THE OWNER READ `docs/the-store.he.md` AND SAID WHAT IS MISSING, 2026-09-16: "i read it, it was
written very well, what is missing is about the mainenance application some screenshots and the
forms aka templates for every item type, also how the developer moves from developemnt to
productions."

THREE GAPS, AND THEY ARE THE SAME GAP: the document explains what the rules ARE and never shows
the tool a person opens to change one. A reader finishes it knowing the mechanism and still not
knowing where to click.

── 1. THE MAINTENANCE APPLICATION, WITH SCREENSHOTS ──────────────────

It exists and almost nobody knows: `src/ui/maintenance/` — `server.ts`, `router.ts` and four
screens (`list.ts`, `form.ts`, `page.ts`, `publish.ts`). `package.json` EXCLUDES it from the
shipped package on purpose (`"!src/ui/maintenance/"`), because publishing an entry is an act of
authoring this product and not of installing it.

AND IT HAS NO LAUNCHER — measured by the lane that wrote the document. No CLI command, no npm
script; `startMaintenanceServer` is exported and started only from tests. That is not a
digression: it is mechanically WHY the last entries were added by hand-editing the manifest,
and a reader who is told to use a tool must be told how to start it. State it plainly, whatever
shape the answer takes.

── 2. A TEMPLATE FOR EVERY KIND ──────────────────────────────

Five kinds ship: `definition`, `standard`, `prohibition`, `fact`, `procedure`. The document
already says a template IS the schema; what it does not give is the template itself. For EACH
kind: which fields are required, which are optional, what a good one looks like FILLED IN with a
real example from the store, and what the form refuses.

`example` and `check` are mandatory and that is the interesting part — say why, because it is
the difference between a rule and an opinion.

── 3. FROM DEVELOPMENT TO PRODUCTION ──────────────────────────

The journey, end to end, as one reader’s path: where a draft lives, what `working` means,
what `planPublish` shows before anything moves, what `publishStore` does, how the version and
the changelog advance, what the checksums are stamped from, and how the two TIERS decide who
ever sees the entry — `developer` stays in this repository, `product` ships to every install.

AND THE TRAP IS ON THIS PATH: `planPublish` today reports ZERO CHANGES, so the changelog gap
cannot be closed by publishing. A reader following the happy path meets that and must not think
they broke it.

── HOW TO DO IT ───────────────────────────────────────

EXTEND the document; do not rewrite it. The owner called it well written and the parts he did
not complain about are not in scope. Keep its Hebrew, its RTL conventions and its voice.

Every screenshot is of the REAL tool on the REAL store, taken by driving it. A drawing of a
screen that was never opened is exactly the kind of claim this project refuses.

## Request

docs/the-store.he.md - i read it, it was written very well, what is missing is about the mainenance application some screenshots and the forms aka templates for every item type, also how the developer moves from developemnt to productions. take my comments and improve it, after that i would like you to go over the conversation, transcripts, documents and the code and generate a table for the whole system of subjects like the store we would document them in the same way.
