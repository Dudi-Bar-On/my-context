---
id: REQ-the-two-readmes-are-the-base-of-a-documentation-system-that
type: requirement
title: the two readmes are the base of a documentation system that indexes and links every part of the app
status: active
severity: soft
always: false
summary: Documentation becomes a browsable, indexed, cross-linked system built from the two readmes and covering every capability from both surfaces.
summary_of: e5156dee9b983ebc
scope:
  - README.md
  - docs/README.he.md
  - docs/**
  - src/ui/public/screens/library.js
  - src/ui/public/doc.js
  - src/ui/server.ts
tags:
  - v2
  - docs
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 7a62fceb43bdc36e
---

# the two readmes are the base of a documentation system that indexes and links every part of the app

Owner requirement 2026-09-05, given immediately after the tutorials requirement and by the same
reasoning: the Documentation screen is to be defined from the record first, by the same method,
and then built to this.

THE BASE. README.md and docs/README.he.md are the base of the documentation system rather than
two files a screen happens to show. They are already held in agreement by test, and several of
their sections are already DERIVED from the running program rather than hand-kept - the command
table, the flag reference, the category keys - which is the property the whole system should
inherit rather than lose.

WHAT IT MUST COVER: every single piece of the app, using the CLI and using the UI. Not a
reference for one surface with the other mentioned in passing. Where a capability exists on one
surface and not the other, the documentation says so, because a reader needs to know which can
do what.

HOW IT MUST READ: indexed, with links, the way a real documentation package works. A reader
navigates it rather than scrolling one long file and searching. That is the difference between
a document and a documentation system, and it is the requirement.

ON TOOLING, AND THIS NEEDS A RULING RATHER THAN A COMMIT. The owner said a third-party tool or
package may be used if required. CONST-zero-runtime-dependencies stands in the way and must be
read before anything is chosen: dependencies is empty and stays empty, devDependencies are
permitted and ENUMERATED - today typescript, types/node and playwright - and the constraint says
in its own words that a fourth is a ruling to record, never a commit to make. So a generator may
be adopted, and adopting one is an owner ruling captured as an item BEFORE it appears in
package.json.

Two further facts the constraint makes load-bearing here. There is no build step: source is
TypeScript executed directly, and nothing compiles. And nothing automated checks the dependency
list - no check script and no CI step reads it - so the guarantee is held by review alone. A
documentation generator that wants a build step is not a small addition; it is a change to two
of this project’s constraints at once.

AND IT MUST STAY TRUE. Both readmes have been found stale five times in two days, every time by
an agent and never by a reader, which is the measured reason to prefer derivation over prose
wherever a fact can be derived. Whatever is built inherits that problem at a larger size.

This needs the same treatment tutorials got: research the whole record for what the
Documentation screen is and was meant to be, produce a definition and requirements traced to
their sources, then a spec, a plan and tasks covering both halves - the documents and the UI
feature that serves them.
