---
id: TASK-the-screen-says-repository-and-shows-whatever-is-on-disk
type: task
title: the screen says repository and shows whatever is on disk, because the walk never asks git
status: active
severity: soft
always: false
summary: The file walk lists the working directory under a heading that promises the project, so ignored files are drawn as project content.
summary_of: b8cfda9c5333d970
scope:
  - src/doctor/checks.ts
  - src/ui/read-model.ts
tags:
  - v2
  - doctor
  - ui
  - coverage
  - "plan:rulings"
  - "seq:62"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 0552049b1d0c88ad
plan: rulings
seq: "62"
state: done
priority: "1"
verified_on: 2026-09-04
---

# the screen says repository and shows whatever is on disk, because the walk never asks git

Owner reported 2026-09-04 that the scope coverage screen points at the demo corpus rather
than the current one, and when the wording was questioned he was right and the questioning
was wrong: he used the word repository because that is the word ON THE SCREEN.

The label is cov.tree, Repository. What feeds it is walkFiles in doctor/checks.ts, a plain
readdirSync recursion from the project directory filtered only by a hardcoded set of names -
git, my_context, node_modules, dist, build and out. It never asks git what is tracked and
never reads gitignore. It walks the directory tree and calls the result a repository.

Measured: git tracks 2,019 files while the disk holds 3,502 outside git and node_modules, so
about 1,483 ignored files are drawn as project content. 818 of them are the demo corpus,
which is gitignored and is what the owner noticed. The remaining six hundred odd are build
output and scratch, quieter but the same defect.

A word like repository promises what is IN the project. Behind it sits whatever is on the
filesystem. That mismatch is why a directory marked as not-part-of-the-project looked like it
belonged, and it is also why the row count has been reported three different ways in one day.

The ruling is to make the label true rather than to soften it: the walk respects gitignore, so
the tree shows the project.

Two things to read before changing either list. SKIP_DIRS and SCOPE_SKIP_DIRS are DELIBERATELY
different sizes, and the smaller one exists because a scope glob may legitimately target a
path the file walk skips. Collapsing them would silently change what dead_scope reports, which
is a different question from what the tree draws. Keep them apart and say what each means
after the change.

listRepoFiles is shared with doctor, so this moves what doctor counts as covered. Report the
doctor output before and after rather than discovering it later.

Cost matters: the walk is already bounded by a file limit because it runs on a request path.
Say what consulting gitignore costs, and do not trade a correct number for a slow screen
without saying so.
