# The six reviews, audited against the corpus

**2026-09-15 · what the six reviews of 2026-09-12 and 2026-09-13 said, and what
the corpus never received.** The deliverable of
`TASK-audit-the-six-review-reports-against-the-corpus-and-find` (`rulings/90`),
which exists because the owner asked: *"we need to go back to our revised 6
reviews reports and look what we need to do and currentlly didn't according to
the reports."*

This is not *what is open* — `mycontext ready` answers that from the corpus'
own `needs:` fields and cannot go stale. This is **what the reports said and the
corpus never received.**

---

## The headline, in four numbers

| | Category | Rows | Where they are |
|---|---|---|---|
| **1** | **Filed and open** | **70** | on the board, in eleven plans and sixteen widened subjects |
| **2** | **Filed and closed** | **49** | **one is narrower than the review finding behind it** — row 12, below |
| **3** | **Never filed** | **0 of 119 rows** — plus **one** precondition the consolidation named outside its table and nobody filed | `swallow/16` |
| **4** | **Dropped by the consolidation** | **13 findings** | ten filed today, three deliberately not — below |

**Category 3 is zero, and that is the most surprising result in this audit.**
Every one of the 119 rows of `reports/2026-09-13-the-consolidated-findings.md`
resolves to a corpus item or to a documented reason for not minting one. The
filing on 2026-09-13 was complete. **The loss happened one step earlier — in the
deduplication, between the six reports and the table.**

---

## What was scanned, and what counted as a match

A count is a claim, so here is how each one was produced.

**Scanned in full:** all six reviews and the consolidation — 5,815 lines —
plus every `*.md` under `.my_context/items/**` carrying a `plan` and a `seq`
(the working tree at 2026-09-15, not a commit).

**What counted as a match, row to item.** Three things had to agree, and where
they did not I say so below rather than pick one:

1. the row's own **proposed D** column;
2. the plan and `seq` range that
   `REF-the-d-numbers-what-each-one-means-and-which-are-only` records for that D
   number — it is the map, and it names the ranges (`D66` → `plan:swallow`
   `seq:1-12`, and so on);
3. the item's **title**, read against the row's text.

Order alone would have been a weak instrument, so it was used only as
corroboration: within all eleven new plans the `seq` order happens to follow the
consolidation's row order exactly, and every one of the 62 rows was
additionally matched by title.

**What counted as "the consolidation dropped it".** A finding in one of the six
reports that (a) carries no row in the consolidation table, (b) is not in its
*refuted*, *stays exactly as it is*, *what is genuinely good* or *what nobody
assessed* sections, and (c) resolves to no corpus item. Each of the thirteen
below was checked all three ways, and the report-side evidence is quoted.

**What decided whether something landed.** `git log`, the source at HEAD, and
the corpus item — never a report's own claim and never a lane's summary. Twelve
of the 49 closures were opened and read in the source or the commit; the rest
were read as items only. That asymmetry is stated rather than hidden, and it is
the first thing that would make a number here wrong.

### What would make these numbers wrong

- **The row-to-item mapping is a judgement, not a derivation.** Nothing
  mechanical links a row number to an item id. If one row inside a plan was
  matched to its neighbour, the two counts move by one each and neither total
  changes. Nine such pairings were checked by re-reading both the row and the
  item body in full; the rest rest on title agreement.
- **Twelve of forty-nine closures were verified in code.** A closed item that
  reads correct and whose code does not do what it says would be counted here as
  covered. The twelve chosen were the ones whose rows carried two or more halves
  — the shape most likely to close narrow.
- **"The consolidation dropped it" rests on a text search of one file.** Where
  a finding was carried under different words with no shared token, this audit
  would call it dropped. Each of the thirteen was therefore also searched for by
  its file path, its symbol name and its measurement.
- **The item index reads the working tree.** Three other lanes are live in
  `src/` today. A file staged and not committed counts as it stands on disk.
- **`plan/seq` is not unique in this corpus** — five collisions are on record —
  so `screens/27` resolves to two items and is reported as two.

---

## Category 1 — filed and open: 70 rows

Counted, not listed, as the task asked. The distribution, because it is the
argument for the count:

| Subject | Plan | Open / total from the reviews |
|---|---|---|
| D66 a failure the code never looks at | `swallow` | 4 of 12 |
| D67 WCAG conformance measured, not assumed | `wcag` | 9 of 9 |
| D68 the CLI answers a script honestly | `cliscript` | 2 of 6 |
| D69 the screen confirms a write landed | `confirm` | 0 of 5 |
| D70 a returned failure flag with no reader | `unread` | 0 of 5 |
| D71 a gate that is not a gate | `gates` | 0 of 5 |
| D72 the read model blocks the whole server | `readmodel` | 4 of 4 |
| D73 the invariant lives in the type | `invariant` | 0 of 4 |
| D74 the MCP surface declares what it does | `mcpsurface` | 0 of 4 |
| D75 doctor's findings earn their keep | `dxfindings` | 2 of 4 |
| D76 a module that grew by accretion | `accretion` | 3 of 4 |
| **the sixteen widened subjects** | `walk`, `store`, `rulings`, `builder`, `contra`, `hooks`, `live`, `screens` | **46 of 57** |

24 open in the eleven new subjects, 46 in the widened ones. `mycontext ready`
surfaces them and this audit adds nothing to that half.

---

## Category 2 — filed and closed: 49 rows, one of them narrower than its finding

Forty-nine rows are closed. **Forty-eight of them cover what the row said**, and
twelve were checked in the source rather than taken from the item. The twelve,
with what was found:

| Row | Item | Checked | Verdict |
|---|---|---|---|
| 1 | `walk/145` | commit `288377eb`; `test/hooks/config-unreadable-disclosure.test.ts` | **covers**, including the half the row led with — the test asserts the healthy-config control and the `findProjectRoot` gate the old disclosure hung on |
| 4 | `recall/7` | `src/ui/read-model-retrieval.ts` imports `retrieval/noise.ts` and `retrieval/subjects.ts` | **covers** — both modules are wired, which was the owner's ruling |
| 12 | `rulings/69` | `src/core/trust.ts` `launderedEnumsOf`; commit `86a0c840` | **covers the row**; narrower than the review — see below |
| 14 | `store/6` | `src/rules/deliver.ts` now imports `verifyManifest` | **covers** — the door asks the manifest |
| 16 | `gates/2` | `.github/workflows/ci.yml` and `release.yml`; `.githooks/pre-commit` | **covers, exemplary** — four of five wired in both workflows, `check:cited-items` excluded *with a recorded ruling and a test pinning the absence*, and the pre-commit hook the row said did not exist now runs `check:dependencies` |
| 17 | `dxfindings/1` | `VERIFIED_ON_INTRODUCED_AT` survives only as a dated comment in `src/doctor/state-verification.ts` | **covers** |
| 42 | `confirm/4` | `conversations.js` now branches on `answer.indexed === false` and `!== true` | **covers both halves**, including the `{ indexed: true, anchor: null }` envelope |
| 59 | `cliscript/4` | `CONST-the-cli-exit-code-contract`, created in commit `7eb4ea30` | **covers** — the row's "written down nowhere" half is now an item |
| 67 | `dxfindings/3` | `test/doctor/check-failed-names-its-check.test.ts` | **covers** |
| 74 | `invariant/4` | `ITEM_CHECKSUM`, `SUMMARY_BASIS_HASH_BRAND`, `SOURCE_CHECKSUM_BRAND`, `CONTENT_HASH_BRAND` in `types.ts`; `ExecutionNonce` in `execute-nonce.ts` | **covers both halves** — the nonces *and* the four hashes |
| 79 | `accretion/2` | `checks.ts` 4,631 → 2,596 lines; `test/doctor/registry-membership.test.ts` exists | **covers, in the required order** — the registry guard is in the tree |
| 32 | `unread/2` | `session-start.ts` and `subagent-start.ts` both import `unrecordedDeliveryLine`; `session-start.ts` reads `delivered.recorded` | **covers both doors** |

### The one narrower closure: row 12 / `rulings/69`

**Quote the row so the match can be judged rather than taken on my word.** Row
12 reads, in part:

> `parseItem` cast `status`/`severity`/`origin` out of frontmatter, so a typo
> made `GOVERNING_STATUS[status]` answer `undefined` and five gates failed open
> together. Found independently at the read boundary (4 §1) and as a silent
> failure (3 B4).

`rulings/69` is faithful to that row and is properly closed: `readEnum` and
`ENUM_READ` replaced the cast, `pack/reader.ts` refuses a laundered artefact,
`launderedEnumsOf` in `trust.ts` gives the five gates the fail-closed predicate
the consolidation recommended as answer (c), and `doctor` reports the local
file. Nothing about that closure is wrong.

**What is narrower is the row, not the item.** Report 4's §4.4 graded **seven**
parse boundaries and named **three** cast families as not defensible. The row
carried one. In report 4's own words:

> **Not defensible:** `as Item` (`store.ts:507,513,538`) launders §1's
> unvalidated enums a second time with no chance to catch them, and two
> `as Origin` from row data (`verdict-store.ts:121`, `pack/history.ts:555`).

> Twenty-one `JSON.parse(...) as <DomainType>` sites in `src/` assert a domain
> type with no check. The sharpest is `SessionHeader` × 4 in
> `ingest/session.ts` … the `catch` handles invalid JSON, never valid JSON of
> the wrong shape, so a `session.json` holding `[]` passes through as a
> fully-typed `SessionHeader`.

**Re-measured at HEAD on 2026-09-15**, because a number from 2026-09-13 is a
claim about a tree that has moved: all three `as Item` casts are still at
`store.ts:507,513,538`; both `as Origin` sites survive; `JSON.parse(...) as` is
now **fifteen** sites in `src/`, not twenty-one, five of them in
`ingest/session.ts`. `readEnum` reaches seven files and none of these four.

So D64's subject — *a value reaching a gate unchecked makes the gate answer no*
— reads one member closed and is missing two. **Filed as `rulings/91`**, with
the one thing report 4 could not know written into it: `Store.upsert` writes
`JSON.stringify(item)` from an already-validated `Item`, so the `store.ts` half
may be closable by argument rather than by code, and that question is the first
step.

---

## Category 3 — never filed: zero rows, and one precondition

**No row of the consolidation went unfiled.** The six that were deliberately not
minted are on the record in
`REF-the-d-numbers-what-each-one-means-and-which-are-only` and each resolves:
row 4 → `recall/7`, row 12 → `rulings/69`, row 54 → commit `ae4984d7` with no
residue, row 76 → `rulings/70`, row 77 → `rulings/74`, row 87 → `rulings/73`.
Two more landed with a residue and only the residue was filed: row 53 →
`rulings/82`, row 57 → `cliscript/3`. All verified present and `done`.

**One thing the consolidation named and nobody filed, and it is load-bearing.**
Under *Known unknowns that block a fix rather than a finding*:

> **Whether Claude Code surfaces stderr on each event.** Most of report 3's
> recommendations route a disclosure there, and the hook files assert it
> confidently for SessionStart/PreToolUse/SubagentStart and assert the
> *opposite* for SessionEnd. None of it was verified against a build. Where
> stderr is discarded, the fix must be the audit row instead — **this is a
> precondition for roughly a third of the silent-failure fixes above.**

It was never filed, and it is no longer a precondition — **it is a debt**, because
the fixes shipped anyway and they shipped onto that channel.
`test/hooks/config-unreadable-disclosure.test.ts` asserts `r.stderr` at all six
delivery paths; `session-start.ts` writes `unrecordedDeliveryLine` there for
D70. The contradiction report 3 named is still in the source:
`src/hooks/session-end.ts` states the platform copies a SessionEnd hook's output
to stderr *only on the failure branch*, while `src/hooks/session-start.ts`
treats stderr as "the channel". Both cannot be the general rule, and eight
closed D66 items rest on the answer.

**Filed as `swallow/16`**, priority 1, as a measurement whose deliverable is a
table of events, not a fix.

---

## Category 4 — what the consolidation dropped: 13 findings

The prize, and the reason the task said *read the six, not only the
consolidation.* Ten are filed; three are deliberately not, and the reasons are
in the next section.

### From report 3 — `reports/2026-09-12-silent-failures-reviewed.md`

**1 · M17, a major that has no row.** The string `M17` does not appear in the
consolidation. M5–M16, M18, M19 and M21–M25 all became rows; this one did not.
Report 3:

> **M17 · A corrupt or locked index makes every retrieval mission answer "no
> material".** `src/ui/read-model-retrieval.ts:343-348` catches everything,
> where the sibling route `read-model-conversations.ts:2046-2056` narrows on
> `instanceof` and rethrows the rest. `openReadOnlyChecked` throws four
> distinguishable things; one of them is "genuinely empty" and three are faults.
> **Size: one-line.**

→ **`swallow/13`** (`TASK-a-corrupt-or-locked-archive-index-makes-every-retrieval`).

**2 · M20, the other major with no row.** The string `M20` does not appear in
the consolidation either. Report 3:

> **M20 · The restore tier drops snapshot ids with no disclosure, while the
> carry tier names every one of its drops.** `src/core/select.ts:1638-1647` vs
> `:1104-1120`. An id in the snapshot that has since been superseded, retired,
> disabled, or hidden by a focus is never a *candidate*, so no `Spill` is
> written and `noteParts` has no entry. `carriedDropReason` exists solely to
> name those same five cases for the carry tier.

→ **`swallow/14`** (`TASK-the-restore-tier-drops-snapshot-ids-with-no-disclosure-where`).

**3 · The gate report 3 proposed for pattern P1.** The consolidation carried
every *instance* of P1 into D66 and carried the *gate* nowhere. Report 3:

> **The gate this project would build for it:** a check that every `catch`
> wrapping an `fs` read either rethrows, inspects `.code`, or names the
> directory it could not read. … and **it would have caught B2, B5, B6, M5, M15
> and half the minors.**

Verified absent: no file under `scripts/` or `test/` reads catch blocks. Eight
of D66's twelve items are already closed, so the subject is four items from
reading finished with nothing standing between the tree and a thirteenth
instance. → **`swallow/15`**.

**4 · The gate report 3 proposed for pattern P2 — and this is the sharpest one
in the audit.** Report 3:

> **The gate:** these are six named functions. A test asserting that every call
> site of each one binds the result is a grep with an allowlist, in the idiom of
> `test/ui/no-writes.test.ts`.

**D70 is 5 of 5 done.** The five readers were added; the subject *a returned
failure flag with no reader* now reads closed, and the mechanism that keeps it
closed was never built. `recordAudit` alone had fourteen unbinding call sites
and only three were argued load-bearing — a fifteenth arrives with the next
hook. → **`unread/6`**.

**5 · Pattern P5, entire.** `P5` and `checkGoverningSpillPressure` both return
zero matches in the consolidation. P1 and P2 are each named as the argument for
a new subject (D66 and D70), P3 is carried as row 36's class and P4 is row 15.
**P5 is named nowhere and carries nothing.** Report 3:

> **P5 — The disclosure is routed to a surface nobody is on.** Not silence
> exactly — worse, because it reads as coverage. … `checkGoverningSpillPressure`
> is the same trade made well — *"silent rather than alarmed when it cannot
> look"*, fully argued — but its last step is the same: a doctor run shows
> nothing at all, **not even that the check could not look.** One `info`
> disclosure would preserve every stated property.

→ **`dxfindings/6`**, filed under D75 rather than D66 because neither `catch`
is wrong and the fix changes no decision — it adds the finding that a check
could not run, which is exactly what that subject is about.

**6 · One entry of report 3's minors tail.** Four of the five findings in the
paragraph after the minors table became row 115; this one did not. Report 3:

> `src/rules/manifest.ts:165, 550, 626` would erase the store changelog on the
> next publish after a corrupt manifest, reachable only from
> `src/ui/maintenance/`, which `package.json` excludes from `files` — **minor
> today, major the day it ships.**

The exclusion is real and is the recorded security model, but it excludes the
maintenance UI from the *published package*, not from this repository — and the
owner runs this repository. → **`store/13`**, priority 3, with reproduction
named as the first step because report 3 wrote *would erase*, not *erases*.

### From report 1 — `reports/2026-09-12-the-ui-reviewed-as-a-user.md`

**7 · Finding 1.2.** Report 1's other three rail findings became rows 95, 89 and
90. This one has no row; *"below the fold"* returns zero matches in the
consolidation.

> **1.2 · The rail's grouping is right; its ordering buries the reads.** …
> `Conversations`, `Help` and `Learn` sit below the fold at 1440 × 900 and are
> reachable only by scrolling the rail, whose only affordance is a scrollbar
> heavier than the nav items themselves. **`Help` and `Learn` are the two things
> a new user needs, and they are the two things they cannot see.**

→ **`walk/169`**, under D44. It is not a duplicate of `anchors/8`, which
measures a card below the fold *inside* Conversations; this is the rail, one
level up.

**8 · Finding 2.4 — not filed, by judgement.** See the next section.

### From report 4 — `reports/2026-09-13-type-design-reviewed.md`

**9 · The other two thirds of §4.4.** Covered under category 2 above. →
**`rulings/91`**.

*(And one that was dropped and delivered anyway, recorded so nobody re-files
it: report 4's change-inventory entry #3, the `WorkItem` brand in `needs.ts`,
carries no row in the consolidation — and `src/core/needs.ts` declares
`WORK_ITEM` as a `unique symbol` today, landed in commit `744b5af3` under
`invariant/1`. The lane that took row 71 read report 4 rather than only the row.
That is the counter-example to everything else in this section and it is worth
naming.)*

### From report 5 — `reports/2026-09-13-what-could-be-removed-or-done-differently.md`

**10 · Simplify #5.** Report 5's Simplify list has seven entries. Entries 1 and
2 became rows 78 and 79, 3 and 4 became row 84, 6 folded into row 65, 7 went
into the *stays* list. **Entry 5 was carried nowhere**, and D76 names four files
of which this is not one:

> **`src/core/conversation-index.ts` (3,449 lines) — lower confidence, and worth
> real care before acting.** … there is a specific, measured reason to be
> careful here: the `restore-stage.ts`/`restore-staging.ts`/`restore-store.ts`
> split one directory over exists *specifically* to keep `node:sqlite` off an
> injection-critical import path … **"consider carefully," not "do."**

Re-measured 2026-09-15: **3,869 lines**, the third-largest TypeScript file in
the repository, behind `read-model.ts` (4,264) and `mcp/tools.ts` (3,109) — both
of which have items under `plan:accretion`. → **`accretion/6`**, with the
import-boundary caution written in, because that caution is half the finding and
a recorded *it stays* is a legitimate close.

**11 · Simplify #7's action half.** The consolidation moved this finding into
*Stays exactly as it is* entry 3 and kept the words *"One small named residual
cost"* — so the observation survived and the recommendation did not:

> **Worth a small, low-priority follow-up (a shared list of filter field names,
> asserted identical at both ends)** rather than a removal.

→ **`rulings/92`**, under D51. The stay is not reopened: nothing here proposes
merging `filterAudit` and `filterSelect`.

**12 · Missing #2 — not filed, by judgement.** See the next section.

**13 · Report 1's 2.4 and report 5's Missing #2 are the two of these thirteen
that were dropped and should stay dropped as items.** Both are in the next
section with reasons.

### And the two reports the consolidation did not lose anything from

**Report 2** (`the-ui-reviewed-round-two`) — all **34 numbered entries**
(1.1–6.2; its own headline count of 29 excludes the credits and the
refutations), plus the glyph set and the *what round one missed* section, are
carried. **Report 6** (`store-cli-mcp-and-gates-reviewed`) — all **28 lettered
entries** (S1–S9, C1–C9, MCP M1–M4, G1–G6) are carried; its own headline count
is 27 and **I did not resolve which entry the difference is**, which changes
nothing here because all 28 are accounted for either way.

Neither lost a finding. The losses are concentrated in reports 1, 3, 4 and 5,
and the mechanism is visible: reports 2 and 6 are the two that enumerate every
finding in one flat scheme, so a row-by-row sweep of them cannot skip one.
Report 3's losses (M17, M20, P1's gate, P2's gate, P5) are all at the *edges* of
its structure — a majors list read by its section headings rather than by its
numbers, and pattern sections read for their instances rather than for their
recommendations. Report 5's two are inside a sub-list. Report 4's is the second
half of one table row. Report 1's is the one finding in its section 1 that is
not about accessibility.

---

## What is NOT worth filing, and why

An audit that only adds work has not judged anything. These were found, read,
and deliberately closed by saying so.

1. **Report 1's finding 2.4 — "there is no search screen."** Report 1 itself
   said *"Worth an owner decision, not a fix."* Still true: `src/ui/public/screens/`
   has `ask.js`, `library.js` and `work.js` and no search screen. **Not filed as
   work, because it is a decision, and because a subject for it was minted three
   days after the review**: D77, *search by meaning, and what it would cost to
   have it*, 2026-09-15. **Recommendation to the owner: answer "where do search
   results appear" inside D77's scope rather than minting a subject for it** —
   D77 is already the place where the search question has costs attached, and a
   second subject for the same verb is how a number starts meaning two things.
   This is the one decision the consolidation's *Every decision that needs you*
   section should have carried and did not.
2. **Report 5's Missing #2 — `test/ui/read-model.test.ts` has not been split.**
   Report 5 graded it itself: *"Low-confidence as a standalone finding — it
   isn't missing today because the source it tests isn't split either — but it
   is sized here so that carrying out top-five #2 doesn't arrive as a surprise
   about scope."* It is scope information for `accretion/1`, not a finding. **Not
   filed. Whoever takes `accretion/1` should read report 5's Missing section
   before estimating**, and that sentence is this report's whole contribution to it.
3. **`test/ui/screen-literals.test.ts`'s `assert.ok(true)`.** Report 3 flagged
   it in its minors tail — *"deliberately a reporter, but it would print '0
   literals enumerated' and pass if `KNOWN_LITERALS` collapsed"* — and the
   consolidation quoted it in its *praise* section instead. **Report 3 was right
   to hedge and the consolidation was right to leave it out.** Read at HEAD: the
   same file asserts `appeared` is empty against a set built from
   `KNOWN_LITERALS`, so a collapsed ledger makes every measured literal appear
   unnamed and the test goes red. The reporter's missing floor cannot be
   silently green. *(Read, not run — the suite was not executed.)*
4. **`src/cli/commands/rules.ts:279` bypassing `toCliMessage`,
   `pack/imported-audit.ts:510-516,534-541`, and `lesson/staging.ts:223-227` /
   `doctor/checks.ts:1196-1222,3341-3342`.** Report 3 listed these in the same
   tail as #6 above. **Not filed separately: they are the same shape as m1–m19
   and belong to `swallow/11`, which is open.** Filing them again would split
   one pattern into four items and hide the thing that makes it a pattern.
5. **Report 4's `isObject` declared eight times, character-identical.** Report 4
   said outright *"That is not a defect, but it is eight chances for one of them
   to drift."* **Not filed.** It is a note, and it is now recorded here.
6. **Report 4's path-flavour branding (`AbsNativePath` / `AbsPosixPath` /
   `RelPosixPath`).** Report 4 costed it and wrote **"Cost: large. Defer."**
   `rulings/70`'s own text says *"do not widen this into the general branding
   question"* and `rulings/74` bought the cheap prevention instead. **Not filed
   — the owner already ruled, and re-filing it would reopen a closed decision.**
7. **Report 4's `noUncheckedIndexedAccess`.** Measured at **2,259 errors**
   against a baseline of 0. The consolidation recorded it as the one decision it
   recommended *not* taking. **Not filed, and the number is on the record so
   nobody re-measures it.**
8. **Report 1's 5.3 (target size) and its Hebrew currency finding.** Refuted by
   report 2's own measurement — three genuinely non-compliant controls, not 629,
   and `8050.80$` is the correct Unicode outcome. **Correctly carried as
   contradictions rather than rows, and correctly not filed.**
9. **Report 5's fifteen "stays exactly as it is" entries, plus the two added
   from other reports.** Each carries a checkable argument against changing it.
   **Not filed, and this audit re-opened none of them** — including entry 3,
   where only the small follow-up was recovered as `rulings/92`.

---

## What I could not classify, and why

Two numbers in the corpus could not be reconciled against the reports they cite.
Both are reported as uncertain rather than bucketed.

1. **`swallow/11` says "twenty-one" and its row cites "m1–m19".** Report 3's
   minors table runs m1 to m21, of which m6, m8, m16, m18 and m20 each got their
   own row — leaving sixteen — and the "Also:" paragraph after the table adds
   four more of mixed shape. **So I cannot say which twenty-one sites the item
   means**, and therefore cannot say whether the four tail items in the
   not-worth-filing list above are inside it or outside it. I placed them inside
   it, and that is a judgement.

   **One consequence is worth naming whoever works that item.** `readStdin`
   (`src/hooks/io.ts:220`) is m1, and report 3 called it *"the single most
   load-bearing instance"* and made it the worked example of pattern P1 — three
   modules reason from its docstring to a decision to say nothing. It is named
   in neither the row nor the item, and the string `readStdin` appears in
   neither the consolidation nor the corpus. **It is in scope of `swallow/11`
   and it is invisible in the description of it.**

2. **`rulings/85` says "eighteen sites" and the reports enumerate fewer.**
   Report 3's P4 lists four members plus the known `isWriter`; report 6's G2
   table has eight rows plus two `no-writes.test.ts` residuals; report 4 adds
   `INVERSE_RELATIONS` and the status cast. That is at most seventeen by my
   count, and the item names only six of them. **I could not derive eighteen**,
   and the item enumerates too few for the next lane to work from. Neither is a
   defect in the finding — the class is real and was found by three reviews —
   but the number should not be quoted as measured.

---

## The instrument

`scripts/measure-review-coverage.ts` — read-only, zero dependencies, no
`node:sqlite`, no git, no writes. It turns a citation like `walk/145` into an
item id and a `state`, so every claim above can be re-checked without trusting
this report's prose:

```
node scripts/measure-review-coverage.ts                  # every plan cited here
node scripts/measure-review-coverage.ts swallow wcag     # only those
node scripts/measure-review-coverage.ts --cite walk/145  # resolve one citation
node scripts/measure-review-coverage.ts --rows           # the four counts above
```

`--rows` prints `119 rows of the consolidation: 70 open, 49 closed`, and prints
any row it cannot map and any citation that names nothing rather than folding
either into the total. **The row-to-item table is in the script, exported as
`ROW_TO_CITATION`, with the three-way matching rule written above it** — it is
a judgement and it belongs where it can be argued with. `parseFrontmatter`,
`loadPlanIndex`, `resolveCitation`, `rowsOfPlan`, `summarisePlan`, `countRows`
and `CONSOLIDATION_PLANS` are exported so a test can hold them.
Its own three caveats — a line-scanning frontmatter reader, `state` being
declared by `plan` and `task` only, and the working tree rather than a commit —
are in its header, beside the reason each one is safe here.

---

## The eleven items filed today

| Item | Subject | Category | What it recovers |
|---|---|---|---|
| `swallow/13` | D66 | 4 | report 3's M17 — a fault answered as an empty archive |
| `swallow/14` | D66 | 4 | report 3's M20 — the restore tier's silent drops |
| `swallow/15` | D66 | 4 | the `fs`-catch gate report 3 proposed for its own pattern P1 |
| `swallow/16` | D66 | 3 | **whether stderr is seen at all** — the precondition eight closed items rest on |
| `unread/6` | D70 | 4 | the call-site-binding gate; D70 reads finished without it |
| `rulings/91` | D64 | 2 + 4 | report 4 §4.4's other two cast families |
| `rulings/92` | D51 | 4 | report 5's dropped follow-up on the audit filter pair |
| `accretion/6` | D76 | 4 | `conversation-index.ts`, with its import-boundary caution |
| `walk/169` | D44 | 4 | report 1's 1.2 — the rail buries Help and Learn |
| `dxfindings/6` | D75 | 4 | report 3's pattern P5, entire |
| `store/13` | D41 | 4 | a corrupt manifest erasing the store changelog |

Four of the eleven — `swallow/15`, `swallow/16`, `unread/6` and, in its own way,
`rulings/91` — say the same thing about this campaign, and it is the finding
underneath all the others:

**The consolidation carried instances faithfully and lost mechanisms.** Every
row it wrote is a defect in one place. The two gates, the stderr question and
the second and third parse boundaries are all the *class* half of a finding
whose *case* half it did carry — and three of the four now sit behind subjects
that read as complete. A subject that closes on its instances closes early.
