---
id: TASK-a-promoted-draft-is-never-moved-out-of-the-ignored-folder-so
type: task
title: a promoted draft is never moved out of the ignored folder, so an accepted item is live and untracked
status: active
severity: soft
always: false
summary: Accepting a proposal leaves the item in a folder git ignores, so it governs this project while existing on only one machine.
summary_of: 5f85aaca6780aaa0
scope:
  - src/cli/commands/review.ts
  - src/review/**
  - src/core/**
tags:
  - v2
  - review
  - silent-failure
  - "plan:review"
  - "seq:8"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 6152b5145c8363d9
plan: review
seq: "8"
state: done
priority: "1"
---

# a promoted draft is never moved out of the ignored folder, so an accepted item is live and untracked

FOUND 2026-09-15 THE ONLY WAY IT COULD BE FOUND: the owner reviewed his queue, accepted eight
drafts and rejected four, said "nothing in queue now" — and `git status` was CLEAN. Not because
nothing changed, but because everything that changed is in a directory git is told to ignore.

WHAT HAPPENS. `mycontext review promote <id>` flips `status: draft` to `status: active` IN PLACE.
Nothing in `src/` moves the file: there is no `renameSync`, no move, no copy anywhere on the
promotion path. The item stays at `.my_context/.drafts/task/<id>.md`.

`.my_context/.drafts/.gitignore` is a single `*`. So a promoted item is:
  — ACTIVE, and `mycontext show <id>` resolves it with `status: active`;
  — INDEXED — it is in `.index.db` and counted by `mycontext list`;
  — GOVERNING — injection selects on status, not on which folder the bytes are in;
  — AND UNTRACKED. It is in no commit, reaches no other machine, and does not exist in a fresh
    clone. The act of accepting it is invisible to `git status`, so nothing warns anybody.

EIGHT OF HIS ITEMS ARE IN THAT STATE RIGHT NOW.

DISCARD IS CORRECT AND IS THE CONTRAST THAT PROVES THE POINT. `mycontext review discard` DELETES
the file and records "declined and deleted — a review-pass draft that never governed", keeping the
claim in the decline ledger so the pass does not re-propose it. Four were rejected that way and
they are gone, cleanly. One half of the same command pair relocates nothing and the other half
removes everything.

THIS IS THE SAME ROOT AS `dxfindings/5`, AND FILING THEM SEPARATELY IS DELIBERATE. That one says
the file roster SERVES `.drafts/` as corpus; this one says a promoted item NEVER LEAVES `.drafts/`.
Both exist because the boundary between a draft and an item is carried by a `status:` field and
not by where the bytes live — and exactly one of those two facts is enforced by the filesystem.
Fixing the roster alone would hide this one rather than fix it.

A SECOND, SMALLER GAP IN THE SAME ACT. The audit log records a promotion as a generic `update` by
`human`. `discard` gets its own op and its own sentence; `promote` does not. So the log cannot
answer "what did I accept out of the queue, and when" — which is the question a reader would ask
first after a review session.

RECOVERY FOR THE EIGHT, and it is not the fix: move the files to `.my_context/items/task/` and
reindex. The frontmatter is already a complete item — id, checksum, summary_of, valid_from — so
the bytes need no rewriting, only relocating. Do NOT close this item by moving those eight.

THE FIX ITSELF, and the decision it carries:
  1. PROMOTE MOVES THE FILE into `items/<type>/` as part of the same act, and says it did. This is
     the obvious answer and matches `discard`, which already acts on the file rather than only on
     a field.
  2. DRAFTS STOP BEING GITIGNORED, so an accepted item is tracked wherever it sits. Cheaper, and
     wrong: it also commits every unreviewed proposal, which is the thing `.drafts/` exists to
     keep out of the repository.
RECOMMENDATION: 1. And whatever is chosen, the promotion must DISCLOSE where the item now lives —
a reader who accepts a draft should be told it was written to the corpus, in the same breath.

WHAT WOULD HAVE CAUGHT IT, stated so the test is not written to the symptom: a test that promotes
a draft and then asserts the resulting path is under `items/` — or, more honestly, that `git
check-ignore` does not claim it. Every existing promote test asserts the STATUS and none asserts
the LOCATION, which is why eight items reached `active` in an ignored folder with a green suite.
