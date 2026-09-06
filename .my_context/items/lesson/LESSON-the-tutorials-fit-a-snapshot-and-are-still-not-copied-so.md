---
id: LESSON-the-tutorials-fit-a-snapshot-and-are-still-not-copied-so
type: lesson
title: the tutorials fit a snapshot and are still not copied, so what the corpus adds is a roster check
status: active
severity: soft
always: false
summary: A tutorial is small enough to copy into the corpus, but copying it would make a teaching page govern the project, so the corpus records where it is instead.
summary_of: 28092b2e69b041cd
scope:
  - docs/tutorials/**
  - src/doctor/checks.ts
  - src/core/tutorial-manifest.ts
  - src/ui/read-model.ts
tags:
  - v2
  - docs
  - corpus
  - "plan:docsys"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 9daa709cdc5206d4
---

# the tutorials fit a snapshot and are still not copied, so what the corpus adds is a roster check

MEASURED 2026-09-06 while carrying out the TUTORIAL half of `docsys/4`, whose README half had
already ruled that the corpus's record of a watched document is not a copy
(`LESSON-neither-readme-fits-in-a-snapshot-so-the-corpus-s-record-of`).

THE MEASUREMENT, AND IT DOES NOT REPEAT THE READMES'. The 48 tutorial files under
`docs/tutorials/` are 331,598 bytes in total and the LARGEST is 10,385 bytes
(`docs/tutorials/scope-and-coverage.he.md`), against a `SNAPSHOT_MAX_BYTES` of 262,144. Every
one of them FITS. Size refused the READMEs; here it refuses nothing, so the size argument is
not available and a different one has to carry the decision.

THREE REASONS IT IS STILL NOT A COPY, in the order they bite.
1. This project retiers `reference` to the NORMATIVE tier in its own `config.json`, so 48
   tutorial snapshots would be 48 pieces of injectable GOVERNING text. A tutorial teaches; it
   does not govern.
2. 331,598 bytes is roughly 83,000 estimated tokens against a `pinned` budget of 22,000. The
   set could not be delivered even if it should be, and `governing_spill_pressure` is already
   a standing disclosure on this corpus.
3. The reason from the README half applies unchanged: the only thing that can be silently
   stale is a copy, and `apiDoc`/`apiTutorials` read the file fresh off disk on every request.

SO "IN THE CORPUS" MEANS THE SAME PAIR IT MEANS FOR THE READMES — `watchedDocs` membership
plus a manifest entry served fresh — and both halves already held for all 48 files before this
task touched anything: `docs/**/*.md` claims them, `isServableDocPath` serves them,
`watched_doc_unserved` reads zero, and editing one already fires the capture nudge in
`src/hooks/post-tool-use.ts`.

WHAT WAS ACTUALLY MISSING IS A THIRD BOUNDARY THE READMES DO NOT HAVE. `docs/tutorials/manifest.json`
is a checked-in DERIVED roster, and it is a copy. Its drift against the four surfaces it
clusters is gated by `test/core/tutorial-manifest.test.ts`. Its drift against the FILE ROSTER
was gated by nothing, and only one direction of that drift is silent: a roster entry naming an
absent file is drawn `unmeasured`/`todo` by `GET /api/tutorials`, but a tutorial file that NO
entry names is watched, served at `GET /api/doc/:id`, and invisible to the Tutorials screen,
to `heRollup`, and to `test/docs/tutorial-facts.test.ts` — which derives its document set from
that same roster. An unlisted tutorial's version string, hook roster and budget numbers can
therefore go stale forever while the screen beside it reports the set complete.

`doctor`'s `tutorial_unlisted` is what now reports that, and reads zero on this repository
today: 48 files on disk, 24 entries naming 48 files, the two sets equal. `tutorial_roster_unreadable`
covers the other silence — `apiTutorials` catches a malformed manifest and answers an empty
list, so the screen would draw nothing and say nothing.

## Relations
- discovered_by [[TASK-bring-readme-md-docs-readme-he-md-and-the-tutorial-files]]
- refines [[LESSON-neither-readme-fits-in-a-snapshot-so-the-corpus-s-record-of]]
- enforces [[REQ-the-two-readmes-are-the-base-of-a-documentation-system-that]]
