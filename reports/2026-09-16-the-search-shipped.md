Lane AF, `semantic/4` — `TASK-ship-the-search-the-research-recommended-three-readings-of`, the
implementation of `reports/2026-09-16-the-search-grammar.md` §5 (lane AC, committed `c5e372dd`).
2026-09-16. Nothing in AC's report was re-derived; every number below is either its measurement,
cited, or a new one this lane took and says so.

## THE ANSWER IN ONE PARAGRAPH

The owner's two words no longer have to be adjacent. One query is now read three ways — `"a b"`,
then `NEAR("a" "b", 30)`, then `"a" AND "b"` — and the union comes back in that order with a line
over each block saying what the reading is. A word the trigram index cannot match is kept out of
the boolean readings and NAMED instead of silently emptying them. A `-word` excludes, on every
reading. **Zero new controls were added to any screen.** Driven in a real browser against this
repository's own live archive in both languages: `trigram hebrew` returns 63 passages under three
headings where the shipped search returned one block, and `שורה תוך` returns 7 under two headings
where the shipped search returned none.

---

# 1. WHAT WAS BUILT

## ONE — three readings, in tiers · `core/conversation-search.ts`

`searchArchiveTiered(index, query, scope)` is new and is the READER's search. It parses the query
(`parseSearchQuery`), builds the three FTS5 expressions (`tiersOf`, `NEAR_CHARS = 30`), sends each
through `index.matchProse`, and returns the union with `tier` on every hit plus one `TierAnswer`
per reading. First reading to return a span wins it — the three nest, so that is the most literal
reading that holds it.

**`searchArchive` was NOT changed**, and that is the one design decision this lane took that §5's
sketch did not contain. §7's sketch rewrites `searchArchive` in place. It cannot be rewritten in
place, for a measured reason that is in this repository already: `anchor-pass.ts` sends the probes
`"|---"` and `"| ---"` and PAGES through them with `offset` over `matchProse`'s total order — 25
pages of 200 — and that paging is the repair for the 2026-09-15 incident where automatic marking
stopped for over half an hour. A union of three rankings has no stable global offset: page 2 of a
tiered answer is not the rows after page 1. Splitting `"| ---"` on whitespace would also stop it
being a substring. `retrieval/from-selection.ts` searches item-id slugs for the same reason. So the
probe keeps the substring reading and the reader gets the three; `searchArchiveTiered`'s header
carries the whole argument and a test pins both halves.

`SearchScope` minus `offset` is the tiered function's parameter type, so "offset is meaningless
here" is a compiler error rather than a comment.

## TWO — the floor moved from the query to the term · same file, plus `conversation-index.ts`

`parseSearchQuery` returns `{ phrase, terms, short, excluded }`. `short` are the words under
`MIN_QUERY_CHARS`: they stay glued into the phrase reading, which can still match them, and never
enter a boolean. They reach the screen as WORDS, not as a sentence — `conversations.js` composes
the sentence from `conv.arch.short`, because the reader may be reading in Hebrew and a `String`
built on the server arrives in one language whatever the page is set to.

`ConversationIndex.countProse(match, scope)` is new. It exists so that a reading which fills its
bound can say BY HOW MUCH, which is the half of `INV-nothing-is-dropped-silently` a boolean `more`
cannot carry. `matchProse` and `countProse` now share one `proseWhere(match, scope)` — a count
built from a second, separately-written scope would be a number that is wrong in exactly the cases
a reader consults it. It is asked for only when a reading actually filled its bound; a reading that
came back short already knows its own total and is not charged for a query.

## THREE — `-word`, and nothing else that looks like syntax

A leading `-` on a word of three or more characters excludes it from every reading. A `-` inside a
word, a lone `-`, a `-` on a word below the floor: all literals. Nothing throws — Elasticsearch's
rule, which is the whole difference between a grammar that can live behind a keystroke and one that
cannot.

## THE SCREEN · `src/ui/public/screens/conversations.js`, `strings/en.js`, `strings/he.js`, `styles.css`

`drawHits` grew three helpers: `queryNotes` (the two disclosures, drawn above the answer AND above
the zero, because a word the index cannot match is the commonest reason for an empty answer and is
invisible in one), `tierHead` (the line over each block) and `hitRow` (lifted out of the loop
unchanged). Seven new string keys in both tables. `conv.arch.idle` was REWRITTEN in both languages,
because it said *"It looks for the words exactly as you type them"* and that is no longer true — a
stale sentence beside a changed feature is the defect this project measures.

`styles.css` gained `.convarchtier` — a rule above and the ink colour, using logical properties so
it lands on the correct side under `dir="rtl"`. Nothing else.

## THE ENDPOINT · `src/ui/read-model-conversations.ts`

`apiConversationSearch` calls the tiered search, merges per named session, and sorts by **tier
first, then `bm25()`**. The body gained `terms`, `short`, `excluded`, `tiers` and `nearChars`, and
every hit gained `tier`.

`passageAt` now takes a LIST of needles rather than the query. This was a real defect found while
building: a `near` or `both` hit's turn does not contain the query as one substring — that is what
those readings are FOR — so every one of them fell into `passageAt`'s `-1` branch, which means *"the
transcript was rewritten under the index"* and draws the head of the turn with nothing marked. The
needles are now the whole query first, then each of the reader's words, most literal first.

## RANKING, WHICH THE RULING OF 2026-09-16 ALLOWED

`RULE-search-may-rank-its-results-and-the-model-it-asks-is-the` lifted `filterItems`' refusal. The
tier was kept anyway, because it is better than a score and not a substitute for one: a tier says
WHY a result is where it is and `bm25()` cannot. What the ruling bought is the ordering WITHIN a
tier, and it cost nothing to take — `matchProse` already returns `ORDER BY bm25() ASC`, so each
reading arrives best-first and the only work was to not re-sort across the tiers.

**Ordering is not filtering.** The scope is in the `WHERE` of every reading (`proseWhere`, one
spelling) and the bound is a `LIMIT` after it, per reading, disclosed with a counted number. The
bound-before-scope shape from `nothing-to-do-and-could-not-look-are-different-answers` is not
rebuilt, and there is a test that fails if the count is ever taken around the scope instead of
through it.

---

# 2. THE PLAYWRIGHT EVIDENCE, IN BOTH LANGUAGES

## Driven by hand, against THIS repository's live archive (11,161 prose spans)

Own throwaway server on **port 58911**, `--no-open`, killed at the end and confirmed down. Port
58888 was never touched.

**English.** `trigram hebrew` →

```
63 passage(s) hold those words, best match first.
  Your words, next to each other                                          1 hit
  Your words within 30 characters of each other — the same sentence      49 hits
      "Showing 49 here; this reading matches 55 passage(s) in all…"
  All your words, somewhere in the same turn                             13 hits
      "Showing 13 here; this reading matches 72 passage(s) in all…"
```

`trigram hebrew -unicode61` → 63 becomes **16**, the phrase block disappears (the adjacent hit
carried `unicode61`), and the screen says *"Leaving out unicode61. A word with a hyphen in front of
it is removed from every reading — delete the hyphen to bring it back."*

**Hebrew**, page in `dir="rtl"`. `שורה תוך` → **7 passages, no phrase block**, under
*"המילים שלכם במרחק של עד 30 תווים זו מזו — באותו משפט"* and *"כל המילים שלכם, איפשהו באותו תור"*.
Those two words are in the same sentence of a lane's turn and are NOT adjacent, so this is the
owner's complaint, in Hebrew, answered. `הם שורה תוך` additionally draws
*"קצרה מכדי לחפש אותה לבדה: הם. האינדקס הזה קורא רצפים של 3 תווים…"* — `הם` is two characters and
this index cannot match it; before this task it silently emptied nothing and said nothing.

Screenshots (gitignored, as `e2e/screens/` is): `lane-af-tiers-live-en.png`,
`lane-af-tiers-live-he.png`.

## Driven by the suite

`e2e/conversations.spec.ts` gained `reading one query three ways`, four tests, en and he:

  — `two words that are not adjacent are found, and the reading is named` — `index report` against
    a turn reading *"read the index and report what it holds"*: the `near` heading is visible and
    **the `phrase` heading has count 0**, which is the statement that the shipped reading finds
    nothing for those two words. Then `terminal table`, 64 characters apart, which only the widest
    reading may claim; then `lane report`, adjacent, which must still come back under the first.
  — `a word too short to match is named, and a hyphen leaves one out` — `ui report` draws
    `.convarchshort` and NOT `.convarchnote` (the two sentences mean different things), and
    `report -lane` removes the turn holding both words and says so.

`e2e/conversations.spec.ts` in full: **200 passed**, no regressions.

---

# 3. EVERY REMOVAL PROOF, AND WHAT REDDENED

Each row: the exact line broken, and the assertion that went red at its own line. All nine were
confirmed to LAND (the file really differed) before the run, and all were restored after.

| # | line broken | what reddened |
|---|---|---|
| 1 | the `NEAR` reading in `tiersOf` | `one query is read three ways…` · conversation-search.test.ts:710 |
| 2 | the per-term floor (`terms.push` for every token) | `a Hebrew pair the boolean reading cannot reach…` :784 · `a word too short…` :821 · `a hyphen that is not an operator…` :950 |
| 3 | `excluding()` returns `match` unchanged | `a leading hyphen excludes a word from every reading…` :877 |
| 4 | `matched:` always `found.length` | `a reading cut by the bound says so…` :984 · `the truncation count is taken through the reader scope` :1024 |
| 5 | `countProse(reading.match)` without the scope | `the truncation count is taken through the reader scope` :1026 |
| 6 | the first-tier-wins dedup | seven tests, :709 :823 :872 :926 :982 :1033 :1092 |
| 7 | the tier dropped from the endpoint sort | `the search answers in tiers…` · conversations-endpoint.test.ts:1959 |
| 8 | `passageAt` given only the query | `the search answers in tiers…` :1962 |
| 9 | `short` not sent to the screen | `the words too short to match…` :2011 |

And three at the browser level, each restarting the suite's own server:

| # | line broken | what reddened |
|---|---|---|
| E1 | the `NEAR` reading in `tiersOf` | `two words that are not adjacent…` en+he · spec.ts:4750 |
| E2 | `host.append(tierHead(…))` in `drawHits` | same, :4750, en+he |
| E3 | `host.append(...queryNotes(…))` in `drawHits` | `a word too short to match is named…` en+he · spec.ts:4792 |

## THE PROOF THAT REDDENED NOTHING, WHICH IS THE FINDING WORTH READING

**Proof 7 failed to redden on its first run.** Dropping the tier from the endpoint's sort changed
nothing, and every assertion stayed green. The fixture was carrying the result: `bm25()` is computed
per QUERY, so a phrase score and an AND score are not on the same scale at all, and on a three-turn
fixture the phrase reading's score happened to dominate — a score-only sort came back in tier order
by luck.

Measured, 2026-09-16, to build a fixture that can fail: with the phrase COMMON (in five of seven
turns) its `bm25()` is **-1.49e-6** while a near-miss turn scores **-3.12e-6**, so a score-only sort
hands the near-miss back FIRST. The endpoint fixture was rebuilt to that shape, the comment in it
says why it looks like that, and proof 7 then reddened at its own line. **A fixture that fails to
carry a red is the thing the brief warned about and it happened here; it is recorded rather than
quietly fixed.**

## TWO ASSERTIONS THIS LANE WROTE WRONG AND CORRECTED

  1. **The parentheses around an exclusion are NOT a precedence repair.** The first version of the
     code comment and the test claimed FTS5 binds `NOT` tighter than `AND`, so
     `"a" AND "b" NOT "c"` would keep a span holding `a` and `c` and no `b`. Measured: FTS5 answers
     **1** to both spellings on a fixture built to distinguish them, and for the readings this code
     emits — a phrase, a `NEAR` and an `AND`, never an `OR` — the two spellings cannot differ. The
     parentheses stay because the grouping should not rest on a precedence nobody measured, and
     both the comment and the test now say that instead of the claim.
  2. **`-ui` is not "a hyphen on a short word".** `-ui` is three characters WITH its hyphen, so it
     is a perfectly matchable trigram and is searched for as one. The test asserts that, and the
     removal proof beside it is `-hyphen`, which IS an exclusion.

  3. **One e2e control was wrong and was deleted.** It typed `index and report` expecting *"no turn
     holds those words"*, as the before-picture. `index and report` IS a contiguous substring of the
     turn in question, so it matched, and the line would have been proving the opposite of what it
     looked like. The control is now the absent `phrase` heading, plus `index periscope` for the
     genuine measured zero.

---

# 4. FOUND AND DELIBERATELY NOT CHANGED

  1. **THE CORPUS BOX WAS NOT TOUCHED**, and this is the largest thing this lane did not do. §4 is
     explicit that none of the three is worth having on `filterItems` alone — *"an unranked union of
     three tiers over 1,282 items returns items in `ORDER BY id` and a reader would be handed the
     alphabet"* — and that AND-ing FIVE terms there is ruinous (2/42 against OR-ed bm25's 15/42):
     *"whatever a surface does with two terms it must not do with five."* What the corpus needs is
     the RANKING the 2026-09-16 ruling has now allowed, measured in §4 at **0/42 → 15/42 at rank one
     for 535 ms of build time**. That is a different build, in files this item's own scope does not
     name, and it is recorded on the item as remaining. **It is the owner's to schedule and wants an
     item of its own.**
  2. **`src/core/conversation-search.ts:248` still cites the phantom id
     `STD-nothing-to-do-and-could-not-look-are-different-answers`.** AC's report named it (§7
     finding 6) and the handover of 2026-09-16 asks for all seven sites to be repaired as ONE act.
     Left alone rather than making that count harder to verify. This lane's own citations use the
     bare entry id, which is the established form.
  3. **`conv.arch.noMatch` is drawn when a DATE BOUND removed every hit**, and it says *"No turn in
     this archive holds those words"*, which is then false. Pre-existing, untouched by this task,
     and visible beside the `undated` note that partially covers it. Named because the next reader
     of `drawHits` will see it.
  4. **A lone `-` stays in the phrase.** §5 says a lone hyphen is a literal, so `byte -` searches
     for the characters `byte -` and legitimately finds nothing. A reader typing `byte -harbour`
     passes through that state and can see one debounced "no match" on the way. It is a measured
     zero and correctly drawn; changing it means dropping a character the reader typed, which needs
     a number this lane does not have. §6 says do not reopen without one.
  5. **The number of terms is not capped.** Measured on the live index, 2026-09-16: `NEAR` over 60
     phrases does not raise and costs 0.19 ms; a 20-term `AND` costs 12.5 ms. Over-restriction just
     empties a tier, and the phrase tier is still today's answer, so a cap would be a bound with
     nothing behind it.

---

# 5. WHAT IS THE OWNER'S TO DECIDE

  1. **The corpus box.** Item 4.1 above. Ranking is ruled; the build is not scheduled.
  2. **The per-reading bound.** AC left `limit` as "a decision it does not have today". This lane
     gave **each reading the caller's own limit** (50 on the screen, so up to 150 rows) rather than
     sharing one budget across the three, because a shared budget spends itself on the most literal
     reading and leaves the one the owner actually asked for empty. Every reading discloses its own
     `shown` and counted `matched`. If he wants a smaller page, the number is one constant.
  3. **The tier heading is a line of text, not a control.** That was deliberate — §5's *"the right
     number of new controls here is zero"* — but it does mean the three blocks are distinguished by
     a rule and a sentence rather than by anything he can click. Worth his eye on the screenshots.

---

# 6. FILES TOUCHED BY THIS LANE

Source:

  — `src/core/conversation-search.ts` — `quoteTerm`, `NEAR_CHARS`, `tiersOf`, `SEARCH_TIERS`,
    `parseSearchQuery`, `searchArchiveTiered` and its types; `searchArchive` refactored onto the
    shared `quoteTerm`/`tooShortNote` and otherwise unchanged in behaviour.
  — `src/core/conversation-index.ts` — `ProseScope`, `proseWhere`, `countProse`; `matchProse` now
    builds its `WHERE` through `proseWhere` and is otherwise unchanged.
  — `src/ui/read-model-conversations.ts` — the tiered call, the tier-first sort, the new body
    fields, `passageAt`'s needle list. **This file is NOT in `semantic/4`'s declared scope**; the
    feature cannot reach a screen without it, and it is named here so the omission is visible.
  — `src/ui/public/screens/conversations.js` — `queryNotes`, `tierHead`, `hitRow`, and the tiered
    loop inside `drawHits`. **Another lane's uncommitted work is in this file** (a first-run consent
    flow around `mountArchiveSearch`); none of it was touched.
  — `src/ui/public/strings/en.js`, `src/ui/public/strings/he.js` — seven new keys plus a rewritten
    `conv.arch.idle`.
  — `src/ui/public/styles.css` — `.convarchtier`, `.convarchtiercut`, and `.convarchshort` /
    `.convarchexcluded` added to the existing dim-note rule. **Not in the declared scope either.**
  — `scripts/measure-search-grammar.ts` — `quoteTerm`, `tiersOf` and `MIN_TERM_CHARS` now IMPORT
    from `core/conversation-search.ts` instead of defining their own copies. They were written
    there when that was the only place they existed; a measurement that quotes its terms differently
    from the search it recommends is a measurement of something else. **Not in the declared scope.**
    `test/core/search-grammar.test.ts` imports them from the script and is unchanged and green.

Tests:

  — `test/core/conversation-search.test.ts` — nine new tests, `@basis` extended with this task and
    the ranking rule. It imports `searchArchiveTiered` from the module it already imported and no
    new helper.
  — `test/ui/conversations-endpoint.test.ts` — three new tests, `@basis` extended. One of them
    (`each search tier has a string in en.js and in he.js`) imports the two string tables by
    dynamic `import()` and exists because `conversations.js` builds the key as
    `conv.arch.tier.${tier}` — a computed key no scanner that looks for literal `ctx.t('…')` calls
    can see. It imports `SEARCH_TIERS` from `core/conversation-search.ts`; no untracked helper.
  — `e2e/conversations.spec.ts` — the `reading one query three ways` describe, four tests, `@basis`
    extended. It uses the file's own `open` helper and `Page` type and adds no new import.

**No file outside this list was written by this lane.** `src/cli/commands/conversation.ts`,
`src/core/anchor-pass.ts`, `src/core/command-flags.ts`, `src/ui/anchor-write.ts`,
`test/core/anchor-per-turn.test.ts`, `test/hooks/stop-conversation-refresh.test.ts`,
`test/ui/anchor-write-route.test.ts`, `test/cli/anchor-backfill.test.ts`,
`reports/2026-09-16-search-adopt-or-build.md` and
`.my_context/items/task/TASK-find-the-editor-grade-search-this-project-should-adopt.md` are other
lanes' uncommitted work in the same tree.

Corpus: `TASK-ship-the-search-the-research-recommended-three-readings-of` — body and summary edited
through `mycontext edit --yes`, never by hand. **The item is LEFT OPEN**, with what remains recorded
on it.

---

# 7. GATES

```
npm run typecheck        0
npm run check:text-files 0   1421 files, none contains a NUL byte
npm run check:basis      0
npm run check:board      0
npm test                 8728 tests, 8723 pass, 2 fail
npx playwright test e2e/conversations.spec.ts   200 passed
```

The two `npm test` failures are `the real handover resolves every pointer it carries` and `the
decision is PRINTED, not only commented`. Both are the same pre-existing dangle —
`reports/V2-HANDOVER.md:6` cites `STD-nothing-to-do-and-could-not-look-are-different-answers`,
which is the phantom id the handover itself filed on 2026-09-16 (`414b622e`). That file was not
touched by this lane and the failures are unrelated to this work.

**One process note, reported because it should not have happened.** This lane ran one
write-capable git command by mistake — `git stash push -- reports/V2-HANDOVER.md`, while checking
whether that dangle predated this work. The path had no local changes, so it was a no-op: `git
stash list` is empty and every modified path is still modified. No other writing git command was
run; nothing was added, committed, checked out or reset.
