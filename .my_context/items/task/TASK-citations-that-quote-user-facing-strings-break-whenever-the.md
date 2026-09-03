---
id: TASK-citations-that-quote-user-facing-strings-break-whenever-the
type: task
title: citations that quote user-facing strings break whenever the copy changes
status: active
severity: soft
always: false
summary: Cross-references that quote wording people see break every time that wording changes, so they should point at names that do not move.
summary_of: ce37e84c1dc6df12
acknowledged:
  - citation_form@ff17f84c1a6b7199
scope: []
tags:
  - v2
  - upkeep
  - gates
  - "plan:walk"
  - "seq:69"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 394b29bf080dbc6d
plan: walk
seq: "69"
state: done
priority: "2"
needs: walk/30
source: "found by plan:live seq:13, 2026-08-29"
---

# citations that quote user-facing strings break whenever the copy changes

> Found 2026-08-29 by `plan:live seq:13`, and it is a consequence of running several agents in one lane rather than a defect any one of them introduced.
>
> **The observation**
>
> While correcting three comments, that task ran `verify:citations` at the start and at the end of its own work. Between those two runs, **roughly twenty new BROKEN citations appeared under `src/ui/public/**`** — none caused by its changes, all in files three concurrent agents were editing (the screens and both string tables).
>
> One concrete instance: the citation at `src/ui/capture-model.ts` · `These are the items whose scope matches` · ~41 cites `src/ui/public/strings/en.js` · `These are the items whose scope matches` · ~328. That string was rewritten in the contended lane, so the citation no longer resolves — and written in the form, the fragment says so where a line number could not.
>
> **Why the gate did not stop it**
>
> `verify:citations` distinguishes **BROKEN** (gated) from **MOVED**/**HIST** (reported, not gated) — but its `SOURCE_ROOTS` are `src`, `test` and `scripts`, and it accepts `.ts` only. **`src/ui/public/**/*.js` is not scanned at all.** So a citation whose TARGET is a browser module is checked from the `.ts` side and silently unverifiable from the other; and citations that live IN those files are not checked at all.
>
> `plan:walk seq:30` owns widening that scan and was dispatched the same night. This item is the measured evidence for why it matters, and a caution for whoever does it: **widening the gate tonight would turn it red on about twenty faults that are the honest by-product of parallel work in progress, not drift.**
>
> **The pattern worth naming**
>
> A citation is a hand-maintained cross-reference, and this project has learned repeatedly that hand-kept lists drift. Citations into the STRING TABLES are the most fragile kind, because a string's text is its identity to the checker and copy changes constantly — three separate owner requests changed strip copy in one evening.
>
> So the question `seq:30` should answer is not only "can the gate see more files" but **"should a citation ever quote a user-facing string as its anchor at all"** — a citation that names `cap.nosim` by KEY would have survived every one of tonight's rewrites, where one quoting its English text could not.
>
> **Done when**
>
> The count is re-measured once the lanes are quiet, so real drift is separated from work-in-progress; every citation broken by tonight's string rewrites is repointed or re-anchored; and a decision is recorded on whether citations may anchor on user-facing copy or must anchor on keys and identifiers.

**MEASURED BY `plan:walk seq:30`, 2026-08-29 — and it answers the question this task raised**

That task widened the gate and, on the way, measured the corpus itself. Across all 658 items in `.my_context/`:

    1     citation in the gate's `file - fragment - ~line` form
    165   bare `file.ts:123` pointers   (145 in range, 4 PAST EOF, 9 unresolvable, 7 ambiguous)
    340   backticked bare filenames     (298 resolve)
    1550  {m:...} refs

**It refused to point the gate at the corpus, and the argument is right.** Pointed at 658 items the gate would check ONE claim — *"the appearance of coverage, which is the thing this script exists to argue against"*. And teaching it `file:line` is the option to refuse outright: a bare line number carries no fragment, so the check can only prove the line EXISTS. It proved that for 161 of 165 while proving nothing about what any of them say — 4 detections out of 165, behind a green gate, over the exact form this task calls a trap.

**So the rule is now in the gate's docblock: it walks what it can resolve BY FRAGMENT.** A tree whose citations carry no fragment is out of scope until they do. That settles the blind spot by rule rather than by adding a directory — and it converts this task from "widen the gate" into corpus work.

**What that leaves, and it is the actual job:**

* **Normalise 165 pointers across 63 items** from `file.ts:123` to the fragment form. **Four already point past end of file**, which is drift that no gate could have caught in that form.
* **Stop the writer emitting `file:line`.** Agents and the owner write these constantly; normalising once without changing what produces them buys a few weeks.
* Two recurring AUTHORING faults worth fixing at the same time, both cheap: a single-backtick span around a fragment that itself contains backticks truncates the fragment (`"needs the paths "`, `"~1476"`) and produces a paired UNREAD on the same line. The form requires a double-backtick span there.

**And the question this task opened is now answerable**: a citation anchored on a KEY or an identifier survives a copy change; one quoting user-facing English cannot. The same is true of a line number — it survives nothing. **Fragment-and-identifier is the form; line hints are a convenience and copy is never an anchor.**

**RE-MEASURED AND PART-DONE 2026-08-29 by `plan:walk seq:69`. The count moved, and so did the finding.**

Re-measured at the moment of acting, over 669 item files: **171 bare pointers across 66 items**, not the 165/63 recorded above. The four PAST-EOF are still four and are still `work.js:458`, four times over in three items.

**The finding is not the four.** Each pointer was checked against the anchor its own corpus line names — the identifier or quoted text the sentence says it is citing — and resolved in the cited file:

    18   the anchor is AT the cited line          the pointer is still true
    22   the anchor is elsewhere in the file      the pointer has drifted, and the anchor says where
     4   the line is past end of file             `work.js:458`
   127   no anchor on the line resolves           unverifiable either way

So `145 in range` above measured only that the line EXISTS. Sampling the in-range ones shows most no longer land on what the sentence beside them claims: `injected.js:70` says it cites `for (const line of data.lines)` and line 70 today is a docblock sentence; `preview.js:424` says `selection.full.forEach`; `app.js:331` says `els.file.textContent = item.source_file ?? '-'`. **The four past-EOF are not a different class of drift — they are the one file that happened to SHRINK.** All five unbounded-list citations (`injected.js:70`, `work.js:458`, `packs.js:522`, `preview.js:424`, `preview.js:552`) drifted the same way, because the loops they name were replaced by `boundedList` when the bound landed. Only `work.js` got short enough for a line number to notice.

**What was normalised: 37 pointers across 27 items** — every one whose anchor could be VERIFIED in the cited file, and no others. **Deliberately not normalised: the remaining 134.** Deriving a fragment from whatever text now sits at a stale line number manufactures a true-looking statement about the wrong code, which is the trap this task named in its own words. Seven more were held by hand, including the two `file.ts:123` that are specimens of the form and the `core/paths.ts:161` in `TASK-ruling-33-…`, whose whole point is that the pointer is wrong.

**The corpus's own citations now check.** It held 1 citation in the form and 5 UNREAD faults; it now holds 39 and 0. The faults were the two AUTHORING shapes: two citations wrapped across Markdown lines in `TASK-the-item-detail-pane-…` (joined, and one stale hint fixed), and one fragment written as italic double-quoted prose rather than a span. The single-backtick-truncation shape does not occur in the corpus — its two observed instances (`"needs the paths "`, `"~1476"`) are both under `src/ui/public/**`, another lane's files, and are described rather than touched.

**The writer:** `STD-a-citation-names-a-file-a-verbatim-fragment-and-an-optional` (draft, needs promotion) states the form where it is read before the writing, and `mycontext doctor` now counts what remains per item under `citation_form`.
