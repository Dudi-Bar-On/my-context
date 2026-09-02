---
id: TASK-seven-citation-fragments-are-not-unique-in-their-file-so-fix
type: task
title: seven citation fragments are not unique in their file, so --fix would pin the wrong line
status: active
severity: soft
always: false
summary: Seven references quote text that appears more than once in its file, so an automatic repair would quietly point at the wrong place.
summary_of: acb32be3b48b5323
scope: []
tags:
  - "plan:rulings"
  - "seq:37b"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 6305908f1badfbe9
plan: rulings
seq: 37b
state: done
priority: "1"
---

# seven citation fragments are not unique in their file, so --fix would pin the wrong line

Found by ruling 33 while answering whether verify-citations --fix is safe to run across the corpus. It is safe for about 376 of the 383 moved citations. These seven are not:

- v2-export-import-and-packs.md:197 cites 'const origin: Origin = input.origin ?? human;' in src/core/mutate.ts. That exact line occurs THREE times - 312, 503, 828. The row is about updateItem at 503; the gate resolves to the first hit, 312, inside createItem, where the row's claim - that it never becomes the item's stored origin - is FALSE, because buildItem stores it. --fix would write ~312 and cement the wrong anchor permanently.
- v2-hooks-sessions-and-continuity.md at 123, 244, 677, 706, 1827 and 2188 all cite a fragment in src/core/audit.ts occurring at both 470 and 473.

Make each fragment unique - extend it by a line, or cite the enclosing signature - BEFORE anyone runs --fix. After --fix they read as freshly verified and the ambiguity is invisible.
