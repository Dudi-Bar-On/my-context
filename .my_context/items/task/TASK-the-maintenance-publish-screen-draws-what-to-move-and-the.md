---
id: TASK-the-maintenance-publish-screen-draws-what-to-move-and-the
type: task
title: the maintenance publish screen draws what to move and the three largest entries under any refusal
status: active
severity: soft
always: false
summary: When publishing the rule store is refused, the maintenance page still shows a plan of what would move as if the publish were going ahead, which is wrong for a damaged manifest and was already wrong for a refused entry.
summary_of: a977e9c505a5757e
scope: []
tags:
  - "plan:release"
  - "seq:30"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: 23b4eeb779f480b1
plan: release
seq: "30"
state: todo
---

# the maintenance publish screen draws what to move and the three largest entries under any refusal

Found by task 4.9 on 2026-09-23 (TASK-a-corrupt-manifest-makes-the-next-publish-erase-the-store): src/ui/maintenance/screens/publish.ts renders the what-to-move list and the three largest entries for every refusal planPublish returns. Since task 3.7 a refused entry refuses the publish and since 4.9 a present-and-unreadable manifest does; in both cases the screen still draws a plan beside the refusal. Closing condition: a refusal is drawn as a refusal - the sentence, what to do, and no plan - and a browser spec plants each refusal (a refused entry, a corrupt manifest) and asserts no plan is drawn. Files: src/ui/maintenance/screens/publish.ts, its view-model test, e2e. Release phase 6 (UI).
