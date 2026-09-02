---
id: STD-a-citation-names-a-file-a-verbatim-fragment-and-an-optional
type: standard
title: "A citation names a file, a verbatim fragment and an optional line — never a bare file:line"
status: active
severity: soft
always: true
summary: Point at code by quoting the exact text you mean, with the position only as a hint, so the pointer breaks honestly when the code is rewritten.
summary_of: e26fccbb44920237
scope: []
tags:
  - v2
  - gates
  - citations
  - authoring
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 499d939db620ff7f
---

# A citation names a file, a verbatim fragment and an optional line — never a bare file:line

**Write every citation — in an item, in a comment, in a plan — as three parts:**

    `select.ts` · `export function select(` · ~1086
     ^ file       ^ verbatim fragment          ^ hint, allowed to be stale

**The fragment is the identity. The line is a convenience.** A refactor that
moves the code updates the hint and the citation stays true; a change that
deletes or rewrites the cited code turns it red, which is the failure you
actually want surfaced. The `~line` is optional — a citation may carry the
fragment alone, and that is the right shape when the line is not known or is
known to be wrong.

**Never `file.ts:123`.** A bare line number carries no fragment, so nothing can
check it beyond "that line exists". Measured over this corpus on 2026-08-29:
161 of 165 bare pointers had a line that existed, and that fact said nothing
about whether any of them still pointed at what they claimed. A plausible wrong
number is worse than a missing one, because it sends a reader somewhere real.
This is why `scripts/verify-citations.ts` refuses to learn `file:line` and why
it does not walk `.my_context/` — its docblock states the rule: **it walks what
it can resolve BY FRAGMENT.**

**Anchor on a key or an identifier, never on user-facing copy.** A citation
that names `cap.nosim` by KEY survives a copy rewrite; one quoting its English
text does not, and neither does a line number. Copy changes constantly and is
the most fragile anchor there is.

**Where the fragment itself contains backticks, use a double-backtick span.** A
single-backtick span ends at the first inner backtick, so the fragment is
silently truncated (observed: `"needs the paths "`, `"~1476"`) and the rest of
the citation is left as an unread separator on the same line — a citation the
author believes is checked and is not.

**Keep it on one line in Markdown.** A citation wrapped across two lines matches
nothing: not broken, invisible. In source it may wrap, because a run of comment
lines is joined before it is read.

**If the cited code is gone, say so.** Do not repoint to something plausible,
and do not re-anchor onto whatever text now happens to sit at that line number:
that manufactures a true-looking statement about the wrong thing. Drop the hint,
keep the fragment the claim actually made, and name the drift.

`mycontext doctor` counts the bare pointers that remain, per item, under
`citation_form`.
