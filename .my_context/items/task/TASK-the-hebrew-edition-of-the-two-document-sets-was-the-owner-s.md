---
id: TASK-the-hebrew-edition-of-the-two-document-sets-was-the-owner-s
type: task
title: the hebrew edition of the two document sets was the owner’s third step all along and was never written down
status: active
severity: soft
always: false
summary: Mirror docs/capabilities and docs/system into Hebrew, matching the conventions the two existing Hebrew documents already set.
summary_of: d5ee87dd8dea549b
scope:
  - docs/capabilities/**
  - docs/system/**
  - test/docs/**
tags:
  - v2
  - docs
  - "plan:rulings"
  - "seq:109"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 2370791efd69b1f2
plan: rulings
seq: "109"
state: done
priority: "1"
---

# the hebrew edition of the two document sets was the owner’s third step all along and was never written down

THE OWNER NAMED THIS AS HIS THIRD AND FINAL STEP REPEATEDLY ACROSS 2026-09-17 — *"verify the system
docs, then verify diagrams... then we could proceed to hebrew"*, *"then it will be the last and
final"* — **AND IT WAS NEVER FILED.** It lived in replies and nowhere else, which is the exact
defect that lost two of his three floating panels for a day. Filed now, before it is dispatched.

── THE SURFACE, MEASURED ───────────────────────────────

    docs/capabilities   17 chapters   8,455 lines   no Hebrew mirror
    docs/system          8 chapters   1,614 lines   no Hebrew mirror

**THIS SPLITS INTO AT LEAST TWO LANES** — the two directories share no file. Capabilities may want
two of its own. Whoever coordinates decides; the work does not serialise.

── THE PRECEDENT EXISTS AND IS GOOD ─────────────────────────

`docs/README.he.md` and `docs/the-store.he.md` already set this project’s Hebrew conventions — its
voice, its RTL handling, how it treats an English identifier inside a Hebrew sentence. **READ BOTH
BEFORE WRITING A LINE.** The owner read the store document and called it well written; that is the
bar and the register.

── FOUR THINGS THAT ARE NOT TRANSLATION ──────────────────────

1. **THE DIAGRAMS ARE TEXT, SO THE HEBREW EDITION TRANSLATES RATHER THAN REDRAWS.** That was
   decided when they were written and it is why they are mermaid fences and not images. Translate
   the LABELS; keep the structure identical. **`npm run check:diagrams` covers `docs/capabilities`
   and `docs/system` by directory, so your new files are gated the moment they land** — run it,
   and RAISE `FENCE_FLOOR` and `FILE_FLOOR` in the same change, because the floors exist to catch a
   future loss and a stale floor cannot.

2. **A CODE IDENTIFIER IS NOT TRANSLATED AND IS NOT BIDI-SAFE BY DEFAULT.** `pre-tool-use.ts`,
   `--supersedes`, `INV-nothing-is-dropped-silently` must survive a Hebrew run intact. This project
   has already measured the failure: `text-overflow` ate the HEAD of a session id in RTL while an
   English reader lost the tail, and the fix was `direction:ltr; unicode-bidi:isolate`. Prose has
   no CSS — so the risk here is punctuation migrating around an identifier, and you must READ the
   rendered result rather than trust the source.

3. **A NUMBER INSIDE A HEBREW RUN IS THIS PROJECT’S KNOWN TRAP.** Every count, ratio and byte
   figure needs checking in the rendered document, not the source.

4. **PASTED COMMAND OUTPUT IS NOT TRANSLATED AT ALL.** It is what the program printed. Translate
   the sentence that introduces it; leave the block byte-identical, cuts marked exactly as the
   English marks them. The English sweeps found 10 abridged and 5 DOCTORED blocks — a retyped
   block is the worst defect in this campaign and a translation is where it would be invisible.

── WHAT MUST BE TRUE WHEN IT LANDS ─────────────────────────

  — **HEADING SEQUENCE PARITY.** `test/docs/parity.test.ts` already holds `README.md` to
    `docs/README.he.md` — 121 headings, identical `##`/`###` sequence. **Extend that gate to the
    new pairs**, or the two editions drift the first time someone edits one.
  — **EVERY CITED ITEM ID IS IDENTICAL**, not transliterated. Verified against `.my_context/items/`.
  — **NO CLAIM IS INVENTED IN TRANSLATION.** If an English sentence is unclear, do not resolve it by
    writing a clearer Hebrew one — name it and leave it. A translation that improves a claim has
    made an unverified claim.
  — `docs/README.he.md` is NOT yours. It exists and is maintained; touch only the new mirrors.

**SCREENSHOTS ARE SEPARATE AND THE HEBREW ONES MUST BE SHOT IN HEBREW.** `rulings/101` embeds the
English images. An RTL screen is not the English screen flipped — the panels place from the right
edge, the strip reflects, the counters sit differently. Leave marked placeholders saying what each
Hebrew shot must show; do not reuse an English image.
