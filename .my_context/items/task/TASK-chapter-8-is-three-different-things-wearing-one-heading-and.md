---
id: TASK-chapter-8-is-three-different-things-wearing-one-heading-and
type: task
title: chapter 8 is three different things wearing one heading, and its title is false for half of them
status: active
severity: soft
always: false
summary: "Retire README section 8 in both languages: decisions restated as decisions, gaps moved beside the features they limit, bookkeeping dropped."
summary_of: 1b9d5d21ad9e5add
scope:
  - README.md
  - docs/README.he.md
  - docs/capabilities/**
  - test/docs/**
tags:
  - v2
  - docs
  - "plan:rulings"
  - "seq:104"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 164f0db610ba7a73
plan: rulings
seq: "104"
state: todo
priority: "1"
---

# chapter 8 is three different things wearing one heading, and its title is false for half of them

THE OWNER RULED ON 2026-09-17, HAVING BEEN SHOWN WHAT §8 ACTUALLY CONTAINS: *"go ahead with
option 2, both languages"*. Option 2 was put to him in these words — **"Chapter 8 disappears
entirely. Each of the 8 live limitations moves beside the feature it limits — a defect documented
next to the thing that is defective. More work, no lost truth, no 'not yet available' chapter."**

HIS EARLIER INSTRUCTION WAS *"remove chapter 8"*, FLAT. A previous pass shrank it 439 → 241 lines
instead, on my judgement, and I told him so rather than file it as done. He then asked the right
question — *"what is there that could not be deleted? are there some features that are not
implemented yet? or maybe features that i decided not to have?"* — and the answer is what produced
this item. DO NOT re-litigate the ruling. §8 GOES.

── WHY A FLAT DELETE WOULD HAVE BEEN WRONG, WHICH IS ALSO YOUR SPEC ────────

THE CHAPTER IS THREE DIFFERENT THINGS WEARING ONE HEADING, AND ITS TITLE IS FALSE FOR HALF OF
THEM. "Not yet available" tells a reader a thing is COMING. Three of the entries are PERMANENT
DECISIONS. Leaving them under that heading is a document making a claim the code contradicts — the
exact defect this product exists to prevent — and deleting them outright is worse, because then a
reader assumes the capability is merely missing and someone eventually builds it.

A DECISION BESIDE THE FEATURE IT CONSTRAINS IS KNOWLEDGE. A DECISION IN A "NOT YET" BIN IS
MISINFORMATION. That sentence is the whole of this task.

── GROUP A — THREE DECISIONS. RESTATE AS DECISIONS, WHERE THE FEATURE IS DESCRIBED ──

Each of these must read as SETTLED, not pending. Keep the recorded REASON — the reason is the
valuable half and it is why a future reader does not reopen the question.

  1. AUTOMATIC SESSION NAMING FROM A SLASH COMMAND. The README’s own words: *"This was declined,
     not left undone."* Reason to carry across: every hook here fails open, so an automatic write
     is one that SOMETIMES does not happen, and a session name that is sometimes set is a worse
     property than one always typed by hand. Goes beside `mycontext session name`.

  2. HARD DELETE. `NOGOAL-no-agent-hard-delete` is an ACTIVE item in this corpus — cite it by bare
     id. Retirement is supersession, which keeps the item, its body and its history on disk where
     a reviewer can still read them. Goes beside `mycontext supersede`. Note also that
     `observations` cannot be edited at any surface by any origin: correcting one means
     superseding the item. That belongs beside editing, not in a limitations bin.

  3. A COMMITTABLE REVISION LOG. *"Considered and declined."* Reason: the log is one append-only
     JSONL whose torn-tail heal assumes a single writer on a single machine; committed, another
     machine’s appends arrive as a merge conflict, and resolving one means rewriting history
     inside the one store whose promise is that a recorded proposal is never rewritten. What a
     reviewer actually needs already travels: a promoted revision is the item’s new text,
     committed like any other item. Goes beside the revision store.

AND A FOURTH ALREADY LEFT THIS WAY: `REQ-items-carry-a-domain` is retired by decision, superseded
by `NOGOAL-no-domain-axis-on-items`. Do not resurrect it into a limitation.

── GROUP B — FOUR REAL GAPS. MOVE BESIDE THE FEATURE THEY LIMIT ───────────

  4. NOTHING ENFORCES `severity: hard`. THIS IS THE MOST IMPORTANT ONE AND THE LEAST SAFE TO LOSE.
     `hard` changes SELECTION only — admitted to a tier’s budget before soft ones, and exempt from
     session focus. No hook, tool or command reads severity to decide whether an ACTION MAY
     PROCEED. §2 describes normative knowledge as what *must hold* and asks "what am I not allowed
     to get wrong here?", which a reader can reasonably take MECHANICALLY. So this gap is not
     merely unbuilt — it is a gap between what the document IMPLIES and what the code DOES, and it
     must land where §2 or the severity field is explained, not in a footnote.
     (The accurate reading is already in the `create_item` schema: "a future enforcement
     candidate". The two hooks that DO block read a path and a dispatch gate, never severity.)

  5. CUSTOM CATEGORY PREFIXES COLLIDE SILENTLY. Give `rule` and `invariant` both
     `{"prefix": "POLICY"}` and the second item minted is `POLICY-…-2` — no error, no warning, no
     `doctor` finding. The derived case collides too (`standard_ops`/`standardize` → `STANDA`).
     Ids then stop telling a reader what category an item is, which is most of what a prefix is
     for. Refusing the collision at config load is the fix and it is not built. Goes into §6.

  6. A CUSTOM CATEGORY GETS NO SLASH COMMAND. The generator handles it correctly, but `commands/`
     is generated from the DEFAULT configuration when the plugin is built, so nothing in it
     follows a project’s config. `mycontext add` and `create_item` both take a custom type, so the
     category is fully usable — say that, so the gap is not read as bigger than it is.

  7. NO `mycontext init --global`. The global layer is read on EVERY command and EVERY injection
     and no command creates or writes one. `--global` is refused, and the refusal correctly names
     the global root (`~/.my-context`, WITH A HYPHEN — keep that, it is a real trap) and the route
     that works. That route is: build an ordinary workspace and move the directory. Keep it, and
     keep the honest sentence that a move is not a supported surface.

── GROUP C — ONE LIVE DEFECT, AND IT IS A DIFFERENT FAILURE CLASS ──────────

  8. A JUST-IN-TIME INJECTION TRUSTS ANY INDEX IT CAN READ. It falls back to Markdown in exactly
     two cases — the read-only open fails, or the schema version is not the expected one. An index
     that opens cleanly is trusted INCLUDING A STALE ONE. The injection happens, so this is NOT a
     miss: what arrives is the index’s answer rather than the corpus’s. A WRONG-BUT-PLAUSIBLE
     ANSWER, which is a different failure class from the silent miss the hooks are built to
     prevent, and nothing in the injected block or the audit record marks it. Session start is
     unaffected (it injects from Markdown and refreshes afterwards). Recorded for 1.1
     (`docs/ROADMAP.md`, E21). This belongs beside just-in-time injection, loudly.

  ALSO KEEP, wherever it fits: two help topics are refused by name — `mycontext help query` and
  `mycontext help config` — while `help` takes seven others. Neither SUBJECT is undocumented.
  A one-line note where help is described is enough; this does not deserve a section.

── GROUP D — DROP. THESE ARE BOOKKEEPING, NOT LIMITATIONS ──────────────

"What used to be recorded here, and where it went" and "Three recorded requirements this section
used to carry, and where each one went" are a chapter keeping notes about its own history. Once
the chapter is gone they document nothing a reader needs. DROP BOTH — but first CHECK each row’s
destination actually exists, because those tables are maintained BY HAND and are the last record
that the move happened.

ONE ROW IS NOT PURE BOOKKEEPING AND MUST SURVIVE: `REQ-changes-are-timestamped-and-audited` is
implemented EXCEPT for one clause, and the corpus item says so in its own body — items carry no
`created_at`/`updated_at` frontmatter, so the log knows when every change happened but a single
item’s Markdown does not. That is a live limitation wearing a bookkeeping row. Move it beside the
audit log.

── THE SECTION THAT IS ABOUT THE TESTS ──────────────────────────

"How to tell whether something here has shipped" documents 12 test files under `test/docs/` that
hold BOTH documents to the program. That content is valuable and is NOT about §8 — it is about the
README itself. Relocate it near the top or into the contributing material. DO NOT DELETE IT.

── THE GATES THAT WILL CATCH YOU, AND THEY ARE REAL ──────────────────

`test/docs/parity.test.ts` HOLDS THIS SECTION’S HEADING SEQUENCE TO THE HEBREW MIRROR’S, and both
documents must carry the same heading sequence and the same examples in the same order. The last
pass measured 121 headings with an identical `##`/`###` sequence. SO THE TWO LANGUAGES MOVE
TOGETHER, IN THE SAME CHANGE — not English first and Hebrew after.

`counts.test.ts` recomputes the "20 of the 49 CLI commands" ratio from the RUNNING PROGRAM and
fails in BOTH languages if either half drifts; it had drifted twice before the test existed. It
also computes that paragraph’s own file count the same way. Renumbering §9 to §8 moves anchors: the
test that every table-of-contents link resolves is the one that will catch a missed one.

RUN THOSE TESTS. `node --import ./test/helpers/pin-rendering.ts --test <file>` — a bare
`node --test` skips the rendering pin and can report a green test as red.

── WHAT MUST NOT HAPPEN ─────────────────────────────────

  — NOTHING TRUE IS LOST. Every one of the eight lands somewhere a reader of that feature will
    meet it. At the end, state explicitly where each one went — a table — so the owner can check
    the move rather than trust it.
  — NO NEW "NOT YET" BIN under another name. If you find yourself making a "Limitations" section,
    you have renamed §8 rather than retired it.
  — DO NOT WEAKEN A LIMITATION WHILE MOVING IT. A gap restated as a hedge is how the four shipped
    entries ended up sitting in §8 for months in the first place.
  — RUN NO GIT COMMAND THAT CHANGES REPOSITORY STATE. No commit, no add, no stash, no checkout.
    Leave the tree dirty and report; the main session commits.
  — A FORK YOU DISPATCH IS YOURS. On 2026-09-17 a fork on this very file was told twice to touch
    nothing and rewrote both READMEs anyway. If you dispatch anything, review its diff before you
    report, and report the violation as a finding if it happens again.
