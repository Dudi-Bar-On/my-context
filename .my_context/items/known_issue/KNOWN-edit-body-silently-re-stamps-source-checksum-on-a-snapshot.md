---
id: KNOWN-edit-body-silently-re-stamps-source-checksum-on-a-snapshot
type: known_issue
title: edit --body silently re-stamps source_checksum on a snapshot item
status: active
severity: soft
always: false
summary: Rewriting the text of an entry copied from a file makes it quietly claim to still match that file, after which the mismatch can never be spotted.
summary_of: 1b9cce4512b36188
scope: []
tags:
  - provenance
  - snapshot
  - data-loss
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-19
valid_until: null
checksum: 6b6db64ff3e41ca3
---

# edit --body silently re-stamps source_checksum on a snapshot item

`mycontext edit --body` on a **snapshot** item silently re-stamps
`source_checksum` from the newly authored body, turning a provenance record into
a hash of the item's own text.

**The mechanism.** `persist()` recomputes `source_checksum` on every write while
`isSnapshot(item)` holds — `my-context/src/core/persist.ts` · `isSnapshot(item)` · ~94. `isSnapshot` is
keyed on field *shape*, not on how the item was created: `source_file` set,
`source_anchor` null, `source_checksum` set
(`my-context/src/core/reference.ts` · `export function isSnapshot(item: Item): boolean {` · ~127). The comment there records the
assumption plainly: a whole-file snapshot's `source_checksum` "is the checksum of
the content the item HOLDS, which is its body."

**That assumption is what `edit --body` breaks.** Before the edit, body and file
agree, so hashing either gives the same answer. After it, the body is authored
text that no file contains — and `source_checksum` now describes the body while
`source_file` still names the file. The two fields describe different things and
nothing says so.

**The consequences, in order of severity.**

1. **Drift becomes undetectable.** `doctor` compares the live file's checksum
   against `source_checksum` (`my-context/src/doctor/checks.ts` · `if (liveChecksum === item.sourceChecksum) continue;` · ~264). Since
   `source_checksum` no longer describes the file, that comparison is
   meaningless — the file can change freely and `source_drift` will fire or stay
   silent for reasons unrelated to whether the item is current.
2. **`refresh` becomes destructive, and `doctor` recommends it.** On drift,
   doctor's message tells the reader to run `mycontext refresh <id>`. Refresh
   replaces the body **whole** from the file — so the authored text is destroyed
   by a command the tool itself recommended.

**`edit` is not otherwise involved.** It has no code path that reads or writes
any of the three `source_*` fields; `UpdateInput` has no such member
(`my-context/src/core/mutate.ts` · `export interface UpdateInput {` · ~571) and the flag is not in `ALLOWED`
(`my-context/src/cli/commands/edit.ts` · `source_file` · ~88). `source_file` and `source_anchor`
survive by omission; only `source_checksum` is actively rewritten.

**Related gap, and the reason this was found.** There is **no supported way to
clear the source linkage on an existing item** — no CLI flag, no MCP argument.
`--extra source_file=` is refused as a reserved key
(`my-context/src/core/validate.ts` · `'source_file', 'source_anchor', 'source_checksum',` · ~158), and a direct file write is denied by
the PreToolUse hook. So an item that acquires a wrong `source_file` can only be
retired and replaced. That is what was done, which is why this issue exists as a
record rather than as a fix.

**Suggested resolution.** Either refuse `edit --body` on a snapshot item and
direct the user to `refresh`, or clear all three `source_*` fields when a
snapshot's body is authored over — an item whose body no longer comes from its
source is no longer a snapshot, and should stop claiming to be one.
