# Retiring README §8 — where each of the eight entries went

Lane AU · 2026-09-17 · item `TASK-chapter-8-is-three-different-things-wearing-one-heading-and`
(`plan:rulings seq:104`) · owner's ruling, verbatim: *"go ahead with option 2, both languages"*.

`## 8. Not yet available` and `## 8. עדיין לא זמין` no longer exist. `## 9. Glossary` is now
`## 8. Glossary` in both documents. Both files carry **107 headings** with an identical
`##`/`###` sequence; `test/docs/parity.test.ts` and all 112 tests under `test/docs/` pass.

**The tree is dirty and uncommitted, as instructed. No git command that writes was run. No
subagent was dispatched — every edit below is mine.**

Files touched: `README.md`, `docs/README.he.md`, `test/docs/capabilities.test.ts`, and this
report. `docs/capabilities/**` was in scope and needed nothing.

---

## The table — every entry, and where it now lives

Destinations are named by **heading**, never by line number
(`RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`).

| # | §8 entry | Group | English destination | Hebrew destination |
|---|---|---|---|---|
| 1 | Automatic session naming from a slash command — **declined, not undone** | A · decision | §5 `### What you type: the slash commands`, the **Continuity.** paragraph, directly under `/mycontext:session-name` | §5 `### מה שאתה מקליד: פקודות הסלאש`, פסקת **המשכיות.** |
| 2a | Hard delete will not be added — `NOGOAL-no-agent-hard-delete` | A · decision | §5 `### What you run: the CLI`, **Capture and change**, immediately above **Find and read.** | §5 `### מה שאתה מריץ: שורת הפקודה`, **לכידה ושינוי**, מעל **חיפוש וקריאה.** |
| 2b | `observations` cannot be edited at any surface, by any origin | A · decision | same place, the paragraph before 2a (it is a fact about *editing*) | same place |
| 3 | A committable revision log — **considered and declined** | A · decision | §7 `### What a pending revision is, and what it cannot do`, last two paragraphs | §7 `### מהי רוויזיה ממתינה, ומה היא אינה יכולה לעשות` |
| 3b | The revision store: unpruned, no `doctor` check, gitignored `*` | B · gap | same place, the paragraph before 3 | same place |
| 4 | **Nothing enforces `severity: hard`** | B · gap | §3 `### Step 2 — it is stored as Markdown…`, an `[!IMPORTANT]` block directly under the frontmatter field table where `severity` is defined — **plus** a second landing in §2's own definition of **governs** | §3 `### צעד 2 — זה נשמר כ-Markdown…` + §2's `שולט` bullet |
| 5 | Custom category prefixes collide silently | B · gap | §6 `### Categories you define yourself`, the `prefix` paragraph (it replaced a hedge — see *Corrections* below) | §6 `### קטגוריות שאתם מגדירים בעצמכם` |
| 6 | A custom category gets no slash command | B · gap | §6 `### Categories you define yourself`, the existing **"Slash commands come from the shipped catalogue"** paragraph, extended | same paragraph in Hebrew |
| 7 | No `mycontext init --global` | B · gap | §4 `#### Creating one, today`, the opening blockquote, expanded; the "a move is not a supported surface" judgement folded into the prose below it | §4 `#### איך יוצרים אחת, היום` |
| 8 | A just-in-time injection trusts any index it can read, **including a stale one** | C · live defect | §4 `### Just in time — the ones that apply to what you are touching`, a `[!WARNING]` block closing the section | §4 `### בדיוק בזמן — אלה שחלים על מה שאתה נוגע בו` |
| + | `mycontext help query` / `mycontext help config` refused by name | keep | §5 `### What you run: the CLI`, opening — beside the "one of seven" sentence | §5 `### מה שאתה מריץ: שורת הפקודה`, opening |
| + | `REQ-changes-are-timestamped-and-audited` — items carry no `created_at`/`updated_at` | D row that was a live limitation | §5 `##### Scope, not content`, a third bullet in the audit log's own "what it cannot answer" list | §5 `##### scope, לא תוכן` |
| + | "How to tell whether something here has shipped" (12 test files, and what they cannot see) | relocate, do not delete | **new `## How this document is checked`**, between `## Contents` and `## 1. The problem` | **`## איך המסמך הזה נבדק`**, same position |
| — | "What used to be recorded here, and where it went" (5 rows) | D · bookkeeping | **dropped**, all five destinations verified present first | dropped |
| — | "Three recorded requirements this section used to carry" (3 rows) | D · bookkeeping | **dropped** except the row above; `REQ-items-carry-a-domain` was *not* resurrected | dropped |
| — | §8's own preamble (the "only section where unbuilt behaviour appears" note, the sequencing-document pointer, the "nothing stays here once it ships" rule) | D · about itself | **dropped.** Its one durable claim now sits in `## Contents` as a positive statement: *"Nothing here describes behaviour this project does not have."* | same, in `## תוכן העניינים` |

### Destinations checked before the bookkeeping tables were dropped

The item required this, because those tables were the last hand-maintained record that the
moves happened. All eight targets exist today:

| Row | Claimed destination | Present? |
|---|---|---|
| "A subagent does not receive the session-start injection" | §4 `### A subagent, at birth` | yes |
| "One surface for every operation" | §5 `### What you type: the slash commands` | yes |
| "Choosing a value instead of remembering it" | §5 CLI + the slash commands section | yes — **but see finding 2** |
| "The one help topic `mycontext_help` does not offer" | §5 `### What the model calls: the MCP tools` | yes — the `mycontext_help` table row states the withheld `cli` topic and why |
| `REQ-changes-are-timestamped-and-audited` | `#### The audit log` | yes — and its unmet clause now travels with it |
| `REQ-items-carry-a-domain` | superseded by `NOGOAL-no-domain-axis-on-items` | confirmed superseded; not resurrected |
| `REQ-session-focus-controls-what-loads` | `#### Session focus — narrowing what loads` | yes |
| `OPENQ-how-do-filters-respect-dependencies` | superseded by the focus decision | not re-stated; nothing pointed at it |

No "Limitations" section was created. Nothing was renamed into a second "not yet" bin.

---

## Findings — including where the grouping was wrong

### 1. `test/docs/counts.test.ts` was already RED when I arrived, on three assertions

This is the most important thing in this report, and it is not something I caused.

Three pins that `counts.test.ts` computes from the running program lived **only inside §8** at
`HEAD`, and the earlier uncommitted 439 → 241 pass deleted all three without relocating them.
The §8 I read in full before my first edit carried none of them:

| Pin | Where it lived at `HEAD` | State when I arrived |
|---|---|---|
| `Every one of the twenty-eight MCP tools…` — the 4th of four sentences `counts.test.ts` requires to state the MCP tool total | `HEAD:README.md`, inside §8 (§8 ran 6256–6693) | gone; §5's copy reads `…review**: every\none of the…` — lowercase and split across a line, so the pattern does not see it |
| `The 29 \`/mycontext:add-<type>\` and 29 \`/mycontext:list-<type>\`…` — the per-category command count | `HEAD:README.md`, inside §8 | gone from the document entirely |
| `ל-20 מתוך 49 פקודות שורת הפקודה` — the Hebrew half of the no-slash-command ratio | `HEAD:docs/README.he.md`, inside §8 (§8 ran 6703–7127) | gone; the pass wrote a **new** §5 sentence spelling it `ב-20`, which the pattern does not match |

A fourth, same family: the pass's new Hebrew §5 sentence spelled twenty-eight as
`שמונה-ועשרים`, where `NUMBER_WORDS` and every other Hebrew occurrence in the file use
`עשרים ושמונה`.

**I fixed all four, in scope, by putting each fact where it belongs rather than by touching the
test:**

- the MCP parity sentence: §5's own copy re-punctuated so it reads `**…rather than by
  review.** Every one of the twenty-eight MCP tools has a CLI command, a slash command, or
  both.` — same claim, now on one line and capitalised;
- the 29 + 29 category-picker fact: restored as a paragraph in §5's slash-command breakdown,
  which is exactly where §8's own bookkeeping row said it had gone (both languages);
- the Hebrew ratio: §5 rephrased to `אומר של-20 מתוך 49 פקודות שורת הפקודה אין אחת` — the
  English's mirror, and the shape `HEAD` used;
- the number word corrected.

**I cannot show you a red baseline run**, because I did not run the suite before my first edit
and the pre-edit working copy is gone. The evidence is the line numbers above, taken from
`git show HEAD:` (read-only), plus the fact that I only *added* text outside the §8 range —
the two Hebrew pins never existed anywhere in the pre-edit tree outside §8, so no deletion of
mine could have removed them.

### 2. Your grouping got one thing wrong: entry 6 was not an unplaced gap

**"A custom category gets no slash command" was already documented beside the feature, twice**,
before I touched anything — once as *"The one surface it does not get for free is a slash
command of its own"* and again as *"Slash commands come from the shipped catalogue, not from
your config"*, both in §6 `### Categories you define yourself`. §8's entry was a **third copy**.

So the move for entry 6 was a merge, not a relocation. I extended the existing paragraph with
the two things §8 said that it did not — *"the category is fully usable"* and *"closing it
means generating the commands from a project's own config, which is a plugin-packaging
question rather than a configuration one, and it is not built"* — and added nothing new
elsewhere. A fourth copy would have been the defect this item is about, wearing different
clothes.

### 3. Entry 5's destination already contained a hedge, and the hedge was the defect

§6's `prefix` paragraph read: *"…resolve to the same prefix, and nothing warns, so set `prefix`
explicitly when that would happen."* That sentence covers the **derived** collision and quietly
implies an explicit `prefix` is the safe answer — while the explicit case collides just as
silently. I replaced the hedge with §8's full statement (`POLICY` twice → `POLICY-…-2`, no
error, no warning, no `doctor` finding, and refusing at config load is the fix and is not
built), keeping the practical advice as a closing clause rather than as the whole claim.

### 4. Entry 4 needed two landings, not one

The item said §2 **or** where `severity` is explained. It needed both. The full statement is an
`[!IMPORTANT]` block under the frontmatter field table, where a reader meets the field. But the
sentence a reader actually mis-reads is §2's definition of **governs** — *"something the model
is expected to comply with"* — so that bullet now carries one clause saying nothing enforces an
item, and points at the block. Neither copy is a restatement of the other: §2 says *that* there
is no enforcement, §3 says *what* the two blocking hooks actually read.

### 5. A Hebrew link had been left behind by an English edit — the exact blindness parity documents

`docs/README.he.md` pointed at `#8-עדיין-לא-זמין` from the ingest paragraph
(`Claude יכול להריץ את שני הצעדים…`), where the English at the same position points at
`#what-you-type-the-slash-commands`. The English was corrected at some earlier date; the Hebrew
was not, and `parity.test.ts` passed the whole time — which is what that test's own third case
exists to demonstrate. Fixed to
`(ראו [פקודות הסלאש](#מה-שאתה-מקליד-פקודות-הסלאש))`.

### 6. Two stale comments outside my scope still cite README §8

Reported rather than edited, because `test/plugin/**` is outside the scope this item declares:

- `test/plugin/parity.test.ts` — *"This is the ratio §8 of both READMEs states"* and *"both
  READMEs' §8 had to stop saying otherwise"*. The ratio has lived in §5 since before this
  change; the comments were already stale and are now doubly so.
- `test/docs/parity.test.ts` and `test/help/categories-he.test.ts` say *"spec §8"* — that is
  `docs/SPEC.md` §8, not the README, so those are correct and need nothing.

`docs/superpowers/ledgers/2026-08-15-buried-capabilities-ledger.md` also names
`8-not-yet-available`; it is a historical ledger and should stay as written.

---

## What I could not place

Nothing. Every one of the eight, plus the two "also keep" items and the verification section,
has a destination named above. Three things were deliberately dropped, and each is named in the
table with the reason: the two hand-maintained bookkeeping tables (after verifying all eight
destinations), and §8's preamble about itself.

One judgement call worth flagging for review: **I placed the verification section at the top of
the document rather than in contributing material.** The item allowed either. Its first
sentence is now *"Do not trust a sentence here to have been updated"*, which reads as an
instruction to a sceptical reader arriving at the document — and that reader is at the top, not
at the bottom. It is linked from `## Contents` and exempted in
`test/docs/capabilities.test.ts`'s `NOT_A_CAPABILITY` with the reason *"how to distrust this
document, not a thing the product does"*.

## Tests run

All with the preload, per `RULE-run-single-tests-with-the-suite-preload`:

```
node --import ./test/helpers/pin-rendering.ts --test test/docs/*.test.ts     112 pass, 0 fail
node --import ./test/helpers/pin-rendering.ts --test test/plugin/parity.test.ts   20 pass, 0 fail
```

`counts.test.ts` (18), `parity.test.ts` (3) and `capabilities.test.ts` (7) are inside that
first run and are the three the item named as the gates. The table-of-contents link test —
`every in-body anchor link in both READMEs resolves to a heading` — passes in both languages
after the §9 → §8 renumbering, which was the check the item said would catch a missed anchor.
