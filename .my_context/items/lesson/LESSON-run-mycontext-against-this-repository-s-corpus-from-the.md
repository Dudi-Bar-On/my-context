---
id: LESSON-run-mycontext-against-this-repository-s-corpus-from-the
type: lesson
title: "Run mycontext against THIS repository's corpus from the outer repo root, never from inside my-context/. The plugin clone carries its own .my_context, so a command run from my-context/ resolves that corpus instead of the project's — and it does not define the task category, so 'search --type task' fails with 'category must be one of: adr, assumption, ...' and the board looks like it does not exist. The failure names a category list, not a directory, so it reads as a bad flag rather than the wrong corpus."
status: active
severity: soft
always: false
summary: Run the tool from the top of the project, or it quietly reads a different store and complains about something that is not the problem.
summary_of: f8cd06c1e34f3610
scope: []
tags: []
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 6705d079917d462c
---

# Run mycontext against THIS repository's corpus from the outer repo root, never from inside my-context/. The plugin clone carries its own .my_context, so a command run from my-context/ resolves that corpus instead of the project's — and it does not define the task category, so 'search --type task' fails with 'category must be one of: adr, assumption, ...' and the board looks like it does not exist. The failure names a category list, not a directory, so it reads as a bad flag rather than the wrong corpus.
