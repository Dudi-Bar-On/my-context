---
id: TASK-ruling-33-sweep-the-44-bare-file-line-citations-into-the
type: task
title: "ruling 33: sweep the 44 bare file:line citations into the checked form"
status: active
severity: soft
always: false
summary: Forty-four references to code are written in a form the checker ignores; convert them, and repair the ones that turn out to be wrong.
summary_of: 82f3ef11cf1ab09d
acknowledged:
  - citation_form@27140dd5951189b9
scope: []
tags:
  - "plan:rulings"
  - "seq:33"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: bd060bc9eac2f4bf
plan: rulings
seq: "33"
state: done
priority: "2"
---

# ruling 33: sweep the 44 bare file:line citations into the checked form

**Ruled 2026-08-21.**

`verify:citations` matches only the three-part form — file, verbatim fragment, ~line. **44 citations across the plans use the bare `file.ts:NNN` form, which the gate does not read at all**, and at least two are already stale:

- `isMainEntry` cited at `core/paths.ts:161`; it is at **187**. <!-- historical-citation: the stale citation quoted so the clause after the semicolon can say where the code really is; converting it here would repair the very thing this line was filed to report -->
- the `matchesAnyGlob` comment cited at `select.ts:127-129`; line 126 is `export function isEligible(` and 127-129 are its body. The comment is at **173**. <!-- historical-citation: quoted as the plans wrote it, so the sentence can say what those lines hold instead; the pointer is the evidence of the drift and not a pointer anyone should follow -->

This is the project's own recorded failure mode, still live in the body, in exactly the form the gate was built to catch.

Convert all 44. Where a bare citation turns out to name a line that no longer says what the prose claims, **repair both halves** — the anchor and the sentence beside it. A re-anchor walks straight past a claim that has gone false.

**Sequence this one alone.** It touches every plan document, and any agent that breaks a citation repairs it in the same files. Isolation is not available here, so it does not run beside other work.
