---
id: TASK-reading-an-item-is-not-audited-so-nobody-can-tell-whether-an
type: task
title: reading an item is not audited, so nobody can tell whether an index line was ever followed
status: active
severity: soft
always: false
summary: Following an index line is recorded from the command line and the tool interface, so it becomes possible to tell whether an item was ever actually read.
summary_of: 8c75093b2a2abeeb
summary_was:
  - 2026-09-07 Item fetches leave no record, so whether a reader ever acted on an index line is unmeasurable rather than merely unknown.
scope:
  - src/core/audit.ts
  - src/cli/commands/context.ts
  - src/cli/commands/query.ts
tags:
  - v2
  - audit
  - injection
  - "plan:budget"
  - "seq:15"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 6ade6153e67edb84
plan: budget
seq: "15"
state: todo
priority: "2"
---

# reading an item is not audited, so nobody can tell whether an index line was ever followed

Found while answering the owner’s question on 2026-09-04 about whether an agent given only
an item name can be made to read its body. The question could not be answered from the log.

ACCESS_OPS is ui-refused and nonce-minted. An item fetch through show, get_item or the web is
not among them, so no record exists that anyone ever followed an index line. That is an
unmeasured thing and this project draws a measured zero differently from an unmeasured one,
so it must not be reported as never happened.

This matters beyond one question. The index tier exists on the premise that a name is enough
because it can be followed. Nothing tests that premise, and a premise that cannot be tested
is being taken on faith in the middle of the mechanism this project is for.

What to build: record an item read as an audit op, with what was fetched and by what surface,
so the index tier can be evaluated rather than assumed. Ops are a closed list grouped in
families with a validate that refuses an unknown op, so this is an addition to that list and
must be made the way the list requires rather than around it.

Keep what is recorded to ids and surfaces. A fetch payload carries item text and the audit
log is not the place to copy the corpus into.

Then the honest question becomes answerable: of the items that arrived as index lines, how
many were ever read.

OWNER RULING 2026-09-07, taken after the conflict was measured rather than argued.

RECORD ON THE CLI AND MCP SURFACES ONLY, INTO THE CORPUS, the way every other op is written.
Do NOT record on the UI read routes.

WHY THAT IS NOT A COMPROMISE. An agent follows an index line through MCP get_item; a person browsing
the web screen is not the reader this item is asking about. So the UI read routes are simultaneously
the ONLY surface that conflicts and the one LEAST relevant to the question. Dropping them costs the
item nothing and buys it a clean landing.

THE CONFLICT, MEASURED 2026-09-07 rather than assumed. recordAudit appends to <corpus>/.audit/
audit.jsonl and updates .audit/audit.db beside it - both INSIDE .my_context/, which is exactly what
test/ui/server-e2e.test.ts snapshots. A throwaway corpus was built, snapshotted with a byte-for-byte
copy of that test own snapshot(), given ONE record through the real recordAudit, and re-snapshotted:
one key moved, .audit/audit.jsonl. And a second gate fires without running anything - no-writes.test
.ts holds an EXACT SET of write bindings under src/ui/, so a read module binding recordAudit fails
before a request is ever made.

A CORRECTION TO A LEAD I GAVE THE MEASURING LANE: I said a write to the disposable index might cost
nothing. Wrong - .index.db is inside .my_context/ and is a hashed key in the snapshot. Only the WAL
and SHM sidecars are excluded, and the WAL is then asserted empty separately. There is no cheap
corner inside the corpus.

AND A FINDING WORTH MORE THAN THE ANSWER, recorded here because it will be read again: the guarantee
is ALREADY NARROWER THAN ITS NAME, by design and disclosed. It says "not one byte of THE CORPUS", and
the UI writes to the global root ~/.my-context/ and to os.tmpdir() today, both ruled in explicitly. A
read-audit landed in the global root would leave both tests green and both prose claims literally
true while the substance of "the UI is a read surface" changed. That is the trap this ruling avoids
by not going there at all.

COSTS MEASURED, and none of them lands on this ruling scope: an append is p95 0.55 ms, 3.3-4.6 ms
with the projection, against a 50 ms hook ceiling. What would have hurt is UI volume (one screen load
fires many routes; this corpus already rotates its 8 MiB log every three days), the projection handle
(57 MB here, pinned open for the process life - on Windows that blocks the rebuild another process
needs), and a self-disabling loop ALREADY OBSERVED: a refusal is the read surface one permitted write
, the log outgrows the projection, and the Audit stream 503s from then on. CLI and MCP reads are
nothing like that volume.

TWO CORRECTIONS TO THIS ITEM OWN TEXT, found by the same measurement. Its scope: is wrong on two of
three files - src/cli/commands/context.ts holds no read command; show and list are in
src/cli/index.ts. And a hazard it implies is already paid down: commit 8b59bbc taught the validator
to tell vocabulary skew from corruption, so a new op no longer makes a running server declare the log
untrustworthy. Also note ACCESS_OPS has no field naming the SURFACE; Origin is human/agent/ingest and
does not mean that. Use the existing note convention or add a field deliberately.
