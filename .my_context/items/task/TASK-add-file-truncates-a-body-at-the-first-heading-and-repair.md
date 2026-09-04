---
id: TASK-add-file-truncates-a-body-at-the-first-heading-and-repair
type: task
title: add --file truncates a body at the first heading, and repair performs the loss
status: active
severity: soft
always: false
summary: Repairing an item could silently delete the part of its text that came after a heading, so written knowledge was lost with no warning at all.
summary_of: 3dac2ce332187400
acknowledged:
  - state_unaudited@c1d2f681da89c764
scope: []
tags:
  - v2
  - corpus
  - integrity
  - "plan:upkeep"
  - "seq:8"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 75b697bdd6ae6081
plan: upkeep
seq: "8"
state: done
priority: "1"
source: found losing two task bodies, 2026-08-28
---

# add --file truncates a body at the first heading, and repair performs the loss

> Found 2026-08-28 by losing two-thirds of two task bodies and recovering them from git.
>
> **Three surfaces disagree about the same input, and only one of them is safe**
>
> An item's body is stored as the prose BEFORE its first `## ` section. Given a body that contains one:
>
>     mycontext edit <id> --body "<text with ## >"   REFUSES, and explains exactly what would be lost
>     mycontext add  <cat> --file <file with ## >    ACCEPTS, stores the prefix, says nothing
>     mycontext repair                              REWRITES the item to its parsed form, silently
>
> `edit` gets it right. Its refusal is a model of the kind — it names the line, says the text "would be lost the next time the item is read back from disk, without any error", and offers three ways forward. `add --file` accepts the identical shape, prints the SOURCE byte count (`snapshotting … 3299 bytes`) and stores 1,272 of them without a word.
>
> **Measured, on this corpus**
>
>     TASK-the-injection-preview-is-deaf-…    3,918 -> 1,272 bytes
>     TASK-the-preview-names-no-spilled-item- 5,507 -> 1,535 bytes
>
> Both were created full and truncated later, in the commit where they were hand-edited and then `repair`ed. `repair` re-renders from the parsed form, so it PERFORMS the loss `edit` refuses to allow. Its own summary line — *"nothing was recovered; if any of that content was already wrong, it is still wrong and now checksums clean"* — is true and does not cover this: the content was not wrong, it was deleted, and the checksum was re-stamped over the deletion.
>
> Recovered from git, and the headings rewritten as `**bold**` so the parser cannot reach them again.
>
> **Why this is worse than a formatting rule**
>
> The corpus exists so knowledge is not lost. A body silently truncated at a heading is the one failure mode it cannot tolerate, and the truncation is invisible: the file on disk looks like a complete item that simply says less. Nothing in `doctor` reports it, because after `repair` the checksum agrees with the content.
>
> Two items were caught only because a later edit's anchor was missing and the assistant went looking for why. **Anything filed with `--file` and a `## ` heading before this is fixed has already lost text and nobody knows which.**
>
> **The fix, in order of value**
>
> 1. **`add --file` refuses exactly as `edit --body` does**, with the same message. One shared check, not two spellings of the rule.
> 2. **`repair` refuses to write a body shorter than the one it read**, or discloses it: *"this rewrite drops N bytes after the first `## ` — run with --force if that is intended."* A repair that silently shrinks an item is the opposite of repair.
> 3. **`doctor` reports items whose body ends at what looks like a truncation** — a heuristic, but a cheap one, and the only way to find the items already damaged.
> 4. Consider whether the parser's rule is right at all. "Prose before the first `## `" is a real constraint with a real reason, but every authored item wants sections; the count of items written with headings and then flattened is the measure of how badly the rule fits the use.
>
> **Done when**
>
> `add --file` refuses what `edit --body` refuses; `repair` cannot silently shrink a body; `doctor` can find an already-truncated item; a test drives each; and the corpus is swept once for items damaged before the fix.

**CORRECTED AND CLOSED 2026-08-29 — one of the three surfaces was not guilty**

Verified against the code rather than inferred from the symptom:

* **`add --file` does NOT truncate.** `snapshotBody` quotes every line, so `> ## Q3` matches no heading pattern and a heading-heavy document round-trips whole. `createItem` calls `validateBody` whatever the body's origin, so `add --body` and `edit --body` already emit a byte-identical refusal. The byte count `add --file` prints is the count it stored. Four tests pin this so it cannot regress to a prefix-store.
* **`repair` WAS guilty, and reproduced**: a hand-edited item with `## ` sections rewritten from 262 bytes of body to 24, silently, exit 0 — while its confirmation asserted *"The body, observations and relations are unchanged."* A false claim, checked now.

So the two items lost earlier were lost by MY hand-edit followed by `repair`, not by `add --file`. The original diagnosis named three guilty surfaces and there were two.

`repair` now reads each candidate, asks what the rewrite would delete, **holds those items back** naming each with its first dropped line and count, prints the route out, writes nothing for them, and exits 1. Lawful candidates beside them are still re-stamped.

**No `--force` was added, deliberately**: a one-word flag whose function is "delete the text anyway" reintroduces the defect with a keystroke. The escape hatch is editing the file — a diff, in git, made deliberately.

**Two doctor codes at different levels**: `body_truncation` (error, exact — the file holds text no future write keeps, catching damage BEFORE it is performed) and `body_ends_unfinished` (info, heuristic for damage already done, measured against 655 of 656 bodies ending in a full stop). The heuristic states its own limit: a truncation landing after a full stop leaves no trace at all.

**Corpus sweep, all 662 item files: ZERO hold droppable text and zero trip the heuristic.** Nothing else was damaged.

**One measurement for the owner, not acted on:** 29 items quote `> ## ` headings inside their body and 55 use `> **bold**` pseudo-headings. **84 of 662 items wanted sections and worked around the format by hand.** That is the number the "does the parser's rule fit" question turns on.
