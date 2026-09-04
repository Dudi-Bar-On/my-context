---
id: TASK-the-repo-group-belongs-in-the-header-where-the-design-puts
type: task
title: the repo group belongs in the header where the design puts it and 1660px is empty
status: active
severity: soft
always: false
summary: Move the repository details up into the mostly empty header, so the crowded bottom strip gives room back to the numbers people read.
summary_of: e167dcb6aa30f862
scope: []
tags:
  - v2
  - ui
  - shell
  - walk
  - "plan:walk"
  - "seq:114"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/t1.md"
source_anchor: null
source_checksum: ab7d994eaa27d293
valid_from: 2026-08-31
valid_until: null
checksum: 9c084de3e9cabe86
plan: walk
seq: "114"
state: done
priority: "1"
source: owner ruling, 2026-08-31
---

# the repo group belongs in the header where the design puts it and 1660px is empty

> > Owner ruling 2026-08-31, after measuring the strip in the browser.
>
> **Measured**
>
>     header width      2272px     logo 105 · pickers 481 · EMPTY 1660  (73%)
>     strip  width      1155px     REPO 724 (63%) · corpus 136 · audit 170 · context 26
>
> **The repo group is in the wrong place, and `index.html` already says so.** Its own comment describes the header as *"primitive 8: git where the avatar would have gone — branch, working tree, and the commit the corpus was reconciled against"*, and then records that *"that content is not wired here"*. It went into the strip instead, where it takes 63% of a crowded row and crushes the context figure — the one number the owner asked to be able to read — to 26 pixels.
>
> **The move pays twice.** In the header the branch can keep its full name and its SHA, because there is 1,660px spare. In the strip, 654px returns to corpus, session and audit.
>
> **What must move together**
>
> The markup, the `.sgrp-repo` styles, and the `repo` entry in `CHROME_INVALIDATION` — that group subscribes to no audit kinds (no op records a commit, checkout or fetch), and that reasoning is unchanged by the move. `fillGit` moves with it.
>
> **Done when**
>
> The repo group renders in the header at full branch and SHA; the strip's remaining groups are measured before and after and the context figure is legible; `CHROME_INVALIDATION`'s `repo` row still declares what it declared; and a browser test asserts the rendered widths rather than the markup's nesting.
