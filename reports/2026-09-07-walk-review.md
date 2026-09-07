# The open walk items, measured and put to you

**One row per open walk item. Each row asks one question and offers boxes. Tick one box per row and
the largest open block on the board is ruled.**

Filed under `plan:walk seq:140`. This was a read-only lane: nothing under `.my_context/` was written,
no walk item was closed, edited or superseded, no git command wrote, and port 58888 was never
touched. Every verdict below is a **proposal**.
`RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done` means only you close a walk item.

---

## The answer first

**Fifteen of the forty-four close today without a line of code being written.** Seven are OVERTAKEN —
the product already does the thing — and five are SUPERSEDED by a later ruling of yours. Add
`walk/16` (already deprecated), `walk/21` (blocked forever on a mockup edit that is now forbidden)
and `walk/121` (whose remainder is nil), and a third of the block is bookkeeping.

**What genuinely remains is about eleven working days, plus four items that need a sitting before
anyone can estimate them.** That is an afternoon of ruling and a fortnight of building — not a month.

| Verdict | Count | Meaning |
|---|---:|---|
| **STANDS** | 15 | real, unbuilt work |
| **SPLIT** | 15 | part done or part ruled away; a smaller item survives |
| **OVERTAKEN** | 7 | already built; successor named in the row |
| **SUPERSEDED** | 5 | a later ruling reversed the premise; ruling named in the row |
| | **42** | the live items |
| plus | 3 | `walk/16` deprecated · `walk/21` blocked · `walk/141` filed today |
| | **45** | rows in this sheet |

**Effort of everything that survives** (STANDS in full, plus the surviving half of each SPLIT):

| Size | Items | Days |
|---|---:|---:|
| ~1 hour | 7 | ~1 |
| ~half a day | 15 | ~7.5 |
| ~a day | 3 | ~3 |
| **needs its own design** | **4** | unsized — `walk/11`, `walk/15`, `walk/39`, `walk/66` |
| nothing left | 1 | `walk/121` |

---

## The thing worth knowing before you read a single row

**This was measured two days ago and nothing moved.** `reports/2026-09-05-walk-sweep.md` and
`reports/2026-09-05-walk-reverify.md` drove the live screens on 2026-09-05 and found **eleven** of
these items already done and six partly done. Since then four walk items closed
(`decay.deccaveat`, preview rung 4, and the two `learn` cross-link items), `walk/16` was deprecated,
and three new ones were filed.

**Not one of the eleven the sweep called ALREADY DONE has closed.** All eleven are still `state:
todo` today. The bottleneck was never measurement. It is that no lane may close a walk item and
nobody put the list in front of you. That is the entire reason this sheet exists, and it is why every
row below ends in boxes rather than in a paragraph.

For scale: the corpus holds 656 task items, **109 open**. `plan:walk` is **46** of them — 42% of
everything still open.

**One caution about that sweep, because it changes how much of it you should trust — and this is a
correction of my own leads as much as of it.** It drove the live screens, which is the right way to
check a screen, but a live corpus can hide a structural defect. Measured against source, **seven of
its eleven "already done" hold up as closable** (`walk/34`, `63`, `121`, `127`, `129`, `130`, `131`)
and **four carry real remaining work**:

- `walk/2` — it passed Procedures on a corpus that happens to serve exactly one disclosure. `render()`
  still hands **every** deduped message to the one foot card (`proc.js:849-853`), so a second would
  pile there beside the first. The screen looks fixed on this corpus and is not fixed in the code.
- `walk/8` — the window *anchor* shipped and was seen live; the *marker on the staircase* the item
  asks for was never built (`simulate.js:1414-1418`).
- `walk/105` — two of the three sentences are keyed; `skippedNotice` is still raw English
  (`config.js:1237`), and it is the one a requirement compels this surface to print.
- `walk/122` — the dedup shipped in the browser only. `mycontext doctor` in the terminal still prints
  26,544 characters of re-printed tail.

That is why this review measured source. It is also why the recommended box on those four is "close
the done half, keep the rest" rather than "close".

## How to read a row

- **Says** — what the item asks for, in one line.
- **Today** — what the code actually does, measured, with citations. Every one of these was opened.
- **Superseded?** — checked against the corpus, never assumed. The whole reason for this review is
  that `walk/20` had its instruction killed by a decision that names it by id, and nobody noticed
  for five days.
- **Verdict** — the proposal.
- Then four boxes. **The recommended one is marked.** Tick one.

A note on the mechanics you will be choosing between: an OVERTAKEN item is closed `state: done` —
the work exists, and `RULE-a-task-is-not-done-until-its-state-says-done` says the board must say so.
A SUPERSEDED item is superseded **with its successor named**, never deleted;
`retirementEdgeRefusal` refuses a retirement with no successor, and five items in this corpus already
violate that. Every SUPERSEDED and OVERTAKEN row below names its successor so a sixth is not created.

---

## Index

| Item | Screen | Verdict | Effort | Recommended |
|---|---|---|---|---|
| [walk/0](#walk0) | cross-cutting | SPLIT | ~a day | re-cut to the apply pass |
| [walk/2](#walk2) | proc | SPLIT | ~half a day | do it, restate the reason |
| [walk/3](#walk3) | mockup | SUPERSEDED | — | retire |
| [walk/4](#walk4) | parity gates | STANDS | ~half a day | do it |
| [walk/8](#walk8) | simulate | SPLIT | ~half a day | close the anchor, keep the marker |
| [walk/11](#walk11) | gates | STANDS | design | design it |
| [walk/12](#walk12) | UI refusals | STANDS | ~a day | make the list |
| [walk/14](#walk14) | simulate → config | SPLIT | ~half a day | keep the carry, drop the patch |
| [walk/15](#walk15) | parity gates | SPLIT | design | keep steps 1–2 |
| [walk/16](#walk16) | mockup | SUPERSEDED | — | already closed; file two edges |
| [walk/18](#walk18) | doctor / cli | STANDS | ~a day | after walk/106 |
| [walk/20](#walk20) | builder | OVERTAKEN | — | close |
| [walk/21](#walk21) | parity gates | SUPERSEDED | — | retire; nine refs go stale |
| [walk/24](#walk24) | docs | SUPERSEDED | — | retire |
| [walk/25](#walk25) | docs | OVERTAKEN | — | close |
| [walk/30](#walk30) | citations | SPLIT | ~half a day | close the gate half |
| [walk/32](#walk32) | watch/ask/decay | STANDS | ~1 hour | do it |
| [walk/33](#walk33) | watch/ask/decay | STANDS | ~1 hour | do it |
| [walk/34](#walk34) | doctor | OVERTAKEN | — | close |
| [walk/39](#walk39) | shell | SPLIT | design | decide what the bar is for |
| [walk/43](#walk43) | shell | SPLIT | ~half a day | keep the test half |
| [walk/55](#walk55) | e2e / capture | STANDS | ~1 hour | do it; it is three, not four |
| [walk/57](#walk57) | preview | STANDS | ~1 hour | two keys |
| [walk/59](#walk59) | simulate | SPLIT | ~half a day | decide the opening tier |
| [walk/63](#walk63) | strings | OVERTAKEN | — | close |
| [walk/66](#walk66) | decay / ledger | STANDS | design | answer current-vs-batch |
| [walk/76](#walk76) | ask | STANDS | ~1 hour | do it |
| [walk/82](#walk82) | test suite | STANDS | ~half a day | do it |
| [walk/89](#walk89) | status / port | SPLIT | ~half a day | Status is buildable now |
| [walk/95](#walk95) | docs | SUPERSEDED | — | retire |
| [walk/100](#walk100) | ask | STANDS | ~half a day | answer top-N, then one key |
| [walk/102](#walk102) | preview | SPLIT | ~1 hour | three sentences left |
| [walk/105](#walk105) | Configure | SPLIT | ~1 hour | `skippedNotice` only |
| [walk/106](#walk106) | doctor / Configure | STANDS | ~half a day | do it; it unblocks walk/18 |
| [walk/108](#walk108) | proc/port/packs | SUPERSEDED | — | retire, but file the DEC's work |
| [walk/119](#walk119) | item pane | SPLIT | ~half a day + ruling | re-cut to four gaps |
| [walk/121](#walk121) | doctor | SPLIT | none | close, striking two clauses |
| [walk/122](#walk122) | doctor | SPLIT | ~half a day | fix the CLI half |
| [walk/127](#walk127) | Review queue | OVERTAKEN | — | close |
| [walk/129](#walk129) | Composer | OVERTAKEN | — | close the definition |
| [walk/130](#walk130) | packs | OVERTAKEN | — | close |
| [walk/131](#walk131) | Tutorials | SUPERSEDED | — | retire |
| [walk/134](#walk134) | search | STANDS | ~half a day | do it |
| [walk/139](#walk139) | shell | STANDS | ~half a day | do it |
| [walk/141](#walk141) | Ask + Capture | STANDS | design | leave held |

---

# The design of record and the parity gates

Six items. **This is where the supersessions cluster**, because
`DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written` (2026-09-02) says in its own words:
*"`docs/design/web-ui-mockup.html` is not edited again. Not one byte."* It also says what to do with
the tasks it kills: *"THOSE TASKS ARE NOT VOID. Their SUBJECT still stands; only the instruction to
EDIT the mockup is dead."* Every row here was tested against that sentence, not against the title.

<a id="walk2"></a>
### walk/2 — proc: scatter the disclosures back beside the cards they qualify

**Says:** Each disclosure goes back beside the card it qualifies; only the screen-wide "progress is
recorded per workspace" sentence may stay at the foot; the foot card may carry no `<h3>`.
**Today:** Still collected. `disclosureCard()` builds one `div.card.pane` (`src/ui/public/screens/proc.js:771-773`)
and `render()` appends it once at the foot (`proc.js:849-853`). The `<h3>` clause is falsified by the
code itself — the card has carried `ctx.t('pr.disc')` as an `<h3>` since 2026-08-30 (`proc.js:772-774`).
Dedup-by-message is intact (`proc.js:432-444`). **The 2026-09-05 sweep reported this screen as fixed
and it is not, for a reason worth knowing**: the sweep counted four top-level cards live and saw only
the workspace sentence at the foot — true, because this corpus serves exactly one disclosure.
`render()` still hands **every** deduped message to the one foot card (`proc.js:849-853`), so a second
disclosure would pile there beside the first. The screen looks fixed on this corpus and is not fixed
in the code.
**Superseded?** Partly. `DEC-a-disclosure-sits-beside-the-card-it-qualifies` is active and unreversed —
the placement ruling stands. What the freeze kills is the item's *justification*: tree-parity findings
proc #00/#01 are the app drawing MORE than the mockup, and app-ahead "must never fail a gate, a review
or a report". The no-`<h3>` constraint died with the bidirectional strings check on 2026-08-26.
**Verdict:** SPLIT · ~half a day

- [ ] **A — do it, and restate the item without the tree-parity rationale and without the `<h3>` constraint** *(recommended: the placement ruling is live, only the reason given for it is dead)*
- [ ] B — do it exactly as written, tree-parity reasoning and all
- [ ] C — supersede it; the collected card is acceptable and `DEC-a-disclosure-sits-beside-the-card-it-qualifies` is withdrawn
- [ ] D — split / other (say what)

> Side effect worth one line: `proc.js:766-769` still tells the next implementer *"Where these
> sentences belong on the page is still an open question for the owner."* You answered it on
> 2026-08-24. That comment is the first thing the item tells them to read.

<a id="walk3"></a>
### walk/3 — the mockup gains a command block per procedure card

**Says:** The mockup must draw one `.cmd` block inside each procedure card instead of the single one
in the prose card.
**Today:** 100% a mockup edit; no app work is left in it. The mockup still has exactly one
`class="cmd"` in the whole `[data-p="proc"]` section (`docs/design/web-ui-mockup.html:3544-3545`). The
app already does what the ruling wanted: `commandRow()` builds a `div.cmd` per call
(`proc.js:544-548`) inside `procedureCard()`, and that card's own header states and defends the
divergence (`proc.js:620-627`).
**Superseded?** **Yes** — `DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written`. The subject
ruling, `DEC-the-procedure-done-command-belongs-to-each-procedure-card`, is still active and is
already satisfied in code.
**Verdict:** SUPERSEDED — by `DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written`,
successor `DEC-the-procedure-done-command-belongs-to-each-procedure-card`

- [ ] **A — supersede it against the freeze, naming the procedure-command decision as the surviving subject** *(recommended: nothing to build, and the app is already right)*
- [ ] B — keep it open; you intend to unfreeze the mockup for this
- [ ] C — close it `done` instead, on the strength of `proc.js:620-627`
- [ ] D — split / other (say what)

<a id="walk4"></a>
### walk/4 — the tree walker must ignore the design's own PROPOSED annotation

**Says:** Teach the walk to skip the chip that annotates the SCREEN — `span.prop` inside
`div.phd > span.verdict` — and keep every chip inside a card. Re-measure 21 screens.
**Today:** Not done. `e2e/tree-walk.ts` (538 lines) contains no `prop`, no `phd` and no annotation
skip; the only skip is the hidden-element one (`tree-walk.ts:35-43`). Both chips the item's own
correction distinguishes still exist — the mockup's screen-level one
(`web-ui-mockup.html:3492-3493`) and the app's card-level one (`src/ui/public/screens/port.js:392`).
The sibling gate absorbed the noise instead: `span.prop` is a written accepted divergence in
`KNOWN_GAPS` for five screens (`e2e/screen-parity.spec.ts:244-250, 324, 529, 601, 740, 761`).
**Superseded?** No — reinforced. `DEC-the-proposed-chip-is-the-design-annotating-itself-not-ui` says
in terms *"the WALKER is what changes ... and NOT the mockup"*. The freeze moots only the port EXTRA
half, since app-ahead is no longer reportable.
**Verdict:** STANDS · ~half a day

- [ ] **A — do it, scoped to the mockup-ahead direction only** *(recommended: it is one narrow ancestry test, and the app-side chip is no longer a finding)*
- [ ] B — do it in a later parity pass
- [ ] C — supersede it; leave the findings in `KNOWN_GAPS` permanently
- [ ] D — split / other (say what)

> There is no checked-in baseline. The item asks for the new totals to be recorded against
> 182 / 97 / 14 / 71, and nothing in the repository stores those — `tree-parity.spec.ts` renders its
> inventory at run time. Whoever takes this has nothing to diff against.

<a id="walk15"></a>
### walk/15 — styles-parity must compare what the cascade RESOLVES to, not just the blocks

**Says:** Find equal-specificity rule pairs sharing a property that the two files order differently
(step 1), keep only pairs where a real element on the 21 screens matches both (step 2), and fix an
instance by MOVING the rule, never by raising specificity, because that would break byte-identity.
**Today:** The defect shape is real and now unguarded. `test/ui/styles-parity.test.ts` is an
explicitly one-directional presence floor — its own header says *"every `assert.equal(shipped,
mockup)` below is gone"* and names what is lost, values and order included (`styles-parity.test.ts:1-31`).
Nothing anywhere compares declaration order between the two files. **The item's last paragraph is
dead**: byte-identity no longer exists, so raising `.pulse svg` to `.pulse svg.chart` would break
nothing.
**Superseded?** **No — this is the one item a decision protects by id.**
`DEC-the-frozen-mockup-unpins-the-css-coupling-styles-parity` lists it under `constrains` and says,
under NAME WHAT PROTECTION IS LOST, that the declaration-order difference *"is already a known defect
shape on this repository ... so it has to become someone's job under the new check rather than be
assumed gone."*
**Verdict:** SPLIT · needs its own design

- [ ] **A — keep steps 1 and 2 as the freeze ruling's named orphan protection, and strike the "order, not specificity" prescription** *(recommended: step 2 needs a rendered DOM, which is the design question; the fix rule only held while byte-identity did)*
- [ ] B — keep the whole item as written
- [ ] C — supersede it; accept that the cascade is no longer compared and record that as the cost of the unpinning
- [ ] D — split / other (say what)

<a id="walk20"></a>
### walk/20 — draw the builder once in the mockup, as the pattern every command site uses

**Says:** You draw the builder once in the mockup — the select and its disabled state, the input with
placeholder and help, the Copy control while incomplete, the composed `.cmd` row.
**Today:** The freeze names it and *inverts* it: *"plan:walk seq:20 is the clearest case, and it
INVERTS rather than dying. ... the mockup is where the builder gets READ ... and plan:builder seq:5 is
where the builder gets BUILT."* And it has been built: `src/ui/public/lib/builder.js`, 1011 lines,
commit `93920f6` — *"builder/5: one builder component"*. Its header answers all four of walk/20's
clauses by name: disabled select plus `emptyPickerNote`, `spec.format` as placeholder,
`markRequired`/`aria-invalid`, and `commandFor` throwing so there is nothing to copy. Imported by
`capture.js:180` and `palette.js:190`.
**Superseded?** Yes for the instruction (the freeze), and the subject is delivered
(`DEC-the-mockup-draws-the-builder-once-and-screens-instantiate-it` + `builder.js`).
**Verdict:** OVERTAKEN — by `plan:builder seq:5` / `src/ui/public/lib/builder.js` / commit `93920f6`

- [ ] **A — close it, naming `93920f6` and `lib/builder.js`** *(recommended: the pattern exists and two screens instantiate it; the one remainder — `config.js` not yet instantiating — already has its own item)*
- [ ] B — supersede rather than close, so the record shows the mockup half died rather than shipped
- [ ] C — keep it open until `config.js` also instantiates the builder
- [ ] D — split / other (say what)

> `plan:builder seq:5` itself still reads `state: todo` although the commit named after it shipped
> `builder.js`. Same shape as `walk/127` below: the work was verified, the board never moved.

<a id="walk21"></a>
### walk/21 — the parity gates must understand a screen that instantiates a pattern *(state: blocked)*

**Says:** Give a mockup section a way to SAY it instantiates the builder so the gates stop reporting
borrowed controls as invented — capture (4 labels, 2 inputs, 2 selects) and palette (12, 8, 3).
Explicitly: do NOT solve it with a `KNOWN_GAPS` entry. Blocked on `walk/20`.
**Today:** The premise has collapsed on one gate and never held on the other. `screen-parity`
compares in one direction only — `const missing = mockKinds.filter((k) => !appKinds.includes(k))`
(`e2e/screen-parity.spec.ts:911-921`) — so a kind the APP alone draws is structurally invisible to it.
Neither ledger carries the cited findings: `capture` lists ten kinds, none of them a label, input or
select (`:695-698`), and `palette` lists one (`:627`). And the blocker cannot clear: `walk/20` is the
mockup drawing, and the mockup is frozen.
**Superseded?** **Yes.** The freeze: *"App-has-it-and-mockup-does-not is NORMAL and must never fail a
gate, a review or a report"* — exactly the finding class this item exists to suppress, so no `data-p`
mechanism is needed.
**Verdict:** SUPERSEDED — by `DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written`,
successor `e2e/screen-parity.spec.ts`'s already-one-directional comparison

- [ ] **A — retire it as blocked-forever, naming the freeze** *(recommended: it has been blocked since 2026-08-25 on work that became impossible on 2026-09-02)*
- [ ] B — keep it open; unblock it another way
- [ ] C — keep it open, un-blocked, as a general gate-improvement item
- [ ] D — split / other (say what)

> **This one has a blast radius.** Eight `plan:builder` task bodies carry an identical paragraph
> naming `walk/21` as their pending gate work, and
> `docs/superpowers/specs/2026-09-06-composer-architecture-review.md:136` still argues the mockup must
> gain the pattern first. If you retire `walk/20` and `walk/21`, nine references point at dead work.

<a id="walk63"></a>
### walk/63 — the mockup's Hebrew contradicts its English in two places, and abridges it in two more

**Says:** Fix two Hebrew/English contradictions (`port.sub`, `pk.trustn`), two Hebrew abridgements
(`cfg.nocmd`, `dv.mdnote`), and answer the `preview.whyn` / `work.diffn` emphasis question.
**Today:** All four fixed, **including in the mockup, before it froze**. `web-ui-mockup.html:4572`
now carries the corrected `port.sub` and `:4585` the corrected `pk.trustn`, matching
`src/ui/public/strings/he.js:859` and `:884`. `cfg.nocmd` now gives the quotation it promises
(`he.js:724`, mockup `:4495`) and `dv.mdnote` carries the whole refusal clause (`he.js:911`, mockup
`:4502`). The open sub-question is answered: `en.js:218` and `en.js:932` carry no emphasis, which is
what `DEC-the-mockup-rewords-down-to-the-shipped-plain-english-rather` ruled.
**Superseded?** The route for part 1 is (the freeze), but it is moot — the file was corrected first.
`DEC-the-string-grammar-stays-at-five-markers-ins-and-del-are` closes the `work.diffn` tail.
**Verdict:** OVERTAKEN — by `he.js:724`/`:911`, mockup `:4572`/`:4585`, and the two decisions above

- [ ] **A — close it `done`; every "Done when" clause is satisfied on disk** *(recommended)*
- [ ] B — send a lane to re-verify in the browser in both languages first
- [ ] C — keep it open for the `work.diffn` word-level/line-level mockup disagreement the 09-05 reverify flagged
- [ ] D — split / other (say what)

<a id="walk95"></a>
### walk/95 — Documentation: a table-alignment class, and whether the mockup refuses images

**Says:** (1) Add `.md td.end` / `.md td.center` to the mockup's `<style>` and to `styles.css`
byte-identically; (2) either give the mockup's `mdInline` an image branch or stop `dv.mdnote`
promising one. Both are mockup edits.
**Today:** Alignment was solved by a **better mechanism than the item prescribes**: `alignOf`
(`src/ui/public/lib/markdown.js:754`) translates markdown-it's `style="text-align:…"` into GitHub's
`align` attribute (`markdown.js:1058-1059`) — no CSS class, no inline style, no CSP problem. The old
`markdownNodes` path still drops alignment, but that path has **zero live instances**: none of the
four served help topics and no corpus item body uses `--:`. Half 2 is moot — `screens/docs.js` was
deleted (`65671da`), `dv.mdnote` was rewritten (`en.js:1326`), and the app refuses images
(`markdown.js:258`).
**Superseded?** Yes, three ways: the freeze kills both actions as written; the subject of half 1 was
answered by `DEC-the-document-page-wears-github-styling-lists-the-readmes-and`; half 2's surface was
cancelled by `DEC-the-documentation-and-tutorials-screens-become-one-list-and`.
**Verdict:** SUPERSEDED — by those three decisions

- [ ] **A — retire it, naming the three decisions** *(recommended: it fixes nothing measurable today)*
- [ ] B — retire it and file a fresh ~1 hour belt-and-braces item to give `markdownNodes` the same `alignOf` call
- [ ] C — keep it open
- [ ] D — split / other (say what)

---

# Refusals, gates and the test suite

<a id="walk11"></a>
### walk/11 — a refusal must state its unblocking condition where a gate can test it

**Says:** A refusal — and, per its own reconciliation, a task blocker — declares its unblocking
condition in a form something can evaluate, and a checker FAILS when a condition has flipped.
**Today:** No such checker exists. `scripts/` holds 27 scripts and none walks refusal conditions; the
nearest, `check-retired.ts`, checks retired phrases in plan documents. **All three of the item's own
test cases have flipped and nothing noticed**: `GET /api/watch/ratio` is registered
(`src/ui/watch-model.ts:1088`), `post` is on `window.myctx` (`app.js:7512-7514`), and `ctx.post` now
has five callers (`lib/builder.js:545`, `lib/command-actions.js:625`, `config.js:899,1139,1671`).
They were cleared by hand, one at a time — the manual sweep this task exists to replace.
**Superseded?** No. Its parent ruling `DEC-a-refusal-is-a-state-to-leave-and-the-standing-goal-is-none`
*asks* for the gate. Four corpus hits, all citing it as still needed.
**Verdict:** STANDS · needs its own design

- [ ] **A — design it, widened to task blockers as its own reconciliation says** *(recommended: one sweep found seven stale blockers; the three test cases are a ready acceptance suite)*
- [ ] B — build only the refusal half, leave blockers alone
- [ ] C — supersede it; keep clearing them by periodic sweep
- [ ] D — split / other (say what)

<a id="walk12"></a>
### walk/12 — enumerate every standing refusal in the UI and drive the list to zero

**Says:** One row per standing refusal in `src/ui/` — where, what it refuses, its condition, whether
that condition still holds — then each row gets exactly one of build / file as a task / decide out loud.
**Today:** No enumeration exists as a corpus item or a report; the 09-05 sweep reached the same
conclusion independently (`walk-sweep.md:212`). Meanwhile the harvest has been drained piecemeal:
`ctx.post` has five callers, `config.js:117-121` now corrects its own header, and the delta/blast
refusal is closed in `styles.css:2822-2829`. **The list — the actual deliverable — was never made.**
**Superseded?** No. `DEC-served-and-not-drawn-is-a-refusal-and-it-is-enumerated-with` does not replace
it — it *widens* it (*"It goes into the same enumeration, plan:walk seq:12"*) and explicitly defers
every per-field ruling because *"nobody has seen the list"*. Eight corpus hits, every one feeding it.
**Verdict:** STANDS · ~a day

- [ ] **A — make the list: read the 22 screen-module headers and file it** *(recommended: three decisions are waiting on it, and it is the only one of these that unblocks others)*
- [ ] B — do it later
- [ ] C — supersede it; rule the refusals individually as they surface
- [ ] D — split / other (say what)

> Do not re-derive it by grepping the word "refusal". A proxy that did exactly that ranked `packs` —
> the best-defended screen in the product — as second least complete, because refusing is what that
> screen does.

<a id="walk30"></a>
### walk/30 — verify:citations must scan the corpus, and the corpus should cite by anchor not by line

**Says:** ONE — the gate must scan `.my_context/items/`, with its scope settled BY RULE. TWO — decide
whether the line number belongs in a citation at all.
**Today:** **Both parts are answered, and part one's answer is a documented refusal rather than a
widening.** `SOURCE_ROOTS` is now `['src','test','scripts','e2e']` (`scripts/verify-citations.ts:340`)
and `isSourceFile` accepts `.ts|.js|.mjs|.cjs` (`:633`), so both blind spots the item measured on
2026-08-28 are closed. The script then measured the corpus (658 files, exactly one citation in the
checked form against 165 bare pointers) and wrote the refusal into its own docblock (`:211-247`):
*"it walks what it can resolve BY FRAGMENT"*. Part two was settled by
`STD-a-citation-names-a-file-a-verbatim-fragment-and-an-optional` and
`RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number` (filed today), which says in its
own words *"This is plan:walk seq:30 position, arrived at independently."*
**Superseded?** Parts one and two, yes, by those two rulings. What survives is the residue the gate
handed back: bare `file.ts:123` pointers, **31 across 11 of 1,006 items today, down from 165 across 63**.
**Verdict:** SPLIT · ~half a day for the surviving half

- [ ] **A — close the gate half against the standard and the rule; keep the corpus residue as work — normalise 31 pointers and stop the writer emitting `file:line`** *(recommended)*
- [ ] B — overrule the script and make the gate scan the corpus anyway
- [ ] C — close the whole item; 31 of 1,006 is below the bar
- [ ] D — split / other (say what)

<a id="walk55"></a>
### walk/55 — drive Capture into its composed state, and close four ledger entries at once

**Says:** `KNOWN_GAPS['capture']` records four gaps with one cause — the walk never types — so add
the typing step, delete the entries, and remove `capture` from `button-contrast`'s `EXPECTED_EMPTY`.
**Today:** Unbuilt, and **the count is three, not four**. `e2e/screen-parity.spec.ts:695-698` still
lists the capture gaps; `p.cmdnote` left the list on 2026-08-27 for an unrelated and better reason
(`:683-690` — the element no longer exists on either side). `capture` is still in `EXPECTED_EMPTY`
(`e2e/button-contrast.spec.ts:65`), and the comment at `:62` still says Capture wants the equivalent
of `composeOnPalette` (`:271`), which exists and works.
**Superseded?** No — reinforced by `RULE-drive-a-ui-into-the-state-the-thing-under-test-appears-in`
(severity `hard`) and `RULE-harness-cases-must-reach-the-behaviour-they-name`.
**Verdict:** STANDS · ~1 hour

- [ ] **A — do it, and correct the item to three entries** *(recommended: two gates are blind to the same screen for the same cause)*
- [ ] B — do it later
- [ ] C — supersede it; leave the ledger entries
- [ ] D — split / other (say what)

> `e2e/` is another lane's file this hour; the measurement above is a snapshot.

<a id="walk82"></a>
### walk/82 — tests that bind a port without the safe-port guard fail with bad port under load

**Says:** Route every direct server call in `test/**` through `startOnSafePort`; done when no test
binds unguarded, a loaded full run shows zero `bad port`, and the guard is enforced by more than
convention.
**Today:** `startOnSafePort` exists (`test/ui/unsafe-ports.ts:232`) and `startUiChild` goes through it
(`test/ui/helpers.ts:77`). But **19 direct `startUiServer(` calls across nine files are still
unguarded**, including all three named victims — `execute-budgets-route.test.ts:55`,
`execute-route.test.ts:96,786,794`, `live-config.test.ts:77,258`. No gate enforces the convention.
**Contradiction with the item, named:** `test/cli/statusline-chain.test.ts` binds no port at all — no
`startUiServer`, no `listen`, no `fetch`, no `--port`. Its inclusion as "the same shape" is not
supportable from source today.
**Superseded?** No. `RULE-do-not-accept-a-test-that-passes-in-isolation-and-fails` supports it.
**Verdict:** STANDS · ~half a day

- [ ] **A — do it, and put the guard inside `startUiServer` rather than at 19 call sites** *(recommended: that makes the "better than convention" clause fall out for free, and it corrects the statusline-chain claim)*
- [ ] B — wrap the 19 call sites only
- [ ] C — supersede it; treat the failures as flakes and re-run
- [ ] D — split / other (say what)

---

# Doctor

<a id="walk34"></a>
### walk/34 — doctor draws a card headed error containing nothing, which reads as an error

**Says:** An empty level renders as a heading and nothing else, so good news looks like bad news; fix
`doctor`, and `gaps` and `injected` in the same pass.
**Today:** All three named surfaces are fixed. `doctor.js:1190` is `if (rows.length === 0)` appending
`doc.zero` — "Checked — none here." (`en.js:661`, `he.js:478`) — and its comment cites `plan:walk
seq:34` and the standard by id. `injected.js` picks between three zero sentences (`:236, 342-344`).
`gaps.js` no longer exists — it was folded into `coverage.js`, whose one live fact draws
`cov.emptycat.none` (`coverage.js:432-439`).
**Superseded?** No — governed, not reversed.
`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` names `plan:walk seq:34` as an
instance to fix, and `DEC-a-screen-with-no-verdict-yet-draws-the-unmeasured-mark-never` cites it as
precedent.
**Verdict:** OVERTAKEN — by `doctor.js:1190`, `injected.js:342-344` and `coverage.js:432-439`, under
`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`

- [ ] **A — close it `done`; the code comment already names it as the closer** *(recommended)*
- [ ] B — re-verify live in the browser first
- [ ] C — keep it open
- [ ] D — split / other (say what)

<a id="walk121"></a>
### walk/121 — doctor cannot tell a finding a command could clear from one nothing can

**Says:** `Finding` gains an optional `fix`; only findings carrying one offer Execute; the rest draw a
keyed sentence saying why; **no bulk "fix all"**.
**Today:** Shipped — under the name `remedy`, and *required* rather than optional
(`src/doctor/checks.ts:135`). `repairFor` (`doctor.js:208-224`) routes `copy`/`run`/`acknowledge`
through the catalogue as an id plus a value bag, never a string; a route of `none` draws
`noRepairChip` (`doctor.js:1119`) keyed in both tables. Three browser specs exist. **And a bulk
control exists**: `settleGroups` (`doctor.js:409-434`).
**Superseded?** **Yes, in part, by a decision that names this task by id.**
`DEC-doctor-gets-a-bulk-settlement-overturning-the-no-bulk-ruling` (2026-09-03) withdraws exactly two
clauses — the ruling "No bulk 'fix all'" and the Done-when "no bulk control exists" — and says
*"the rest of that task stands and is largely shipped."*
**Verdict:** SPLIT — the no-bulk clause SUPERSEDED, everything else OVERTAKEN. **Nothing here is open work.**

- [ ] **A — close it, striking the two withdrawn clauses by name** *(recommended: the body currently reads as a live prohibition against code that already shipped)*
- [ ] B — close it without amending the body
- [ ] C — keep it open until a corpus exists with a fixable finding to click through
- [ ] D — split / other (say what)

> **Its load-bearing argument has expired underneath it.** The item's whole case rests on
> `citation_form` being 60 of 61 findings. Measured today at the repository root: **63 findings, and
> `citation_form` has fallen to 5.** The dominant code is now `state_unaudited` at 38 — which
> `src/doctor/checks.ts:60-72` itself calls *"noise wearing work's clothes"*, a row *"only an accident
> can clear"*. The check the codebase criticises by name is now three-fifths of the health screen.
> That is not this item's business, but it is worth a look.

<a id="walk122"></a>
### walk/122 — one doctor message does two jobs so 58,000 characters print sixty-one times

**Says:** The per-item message states the finding alone; the explanation is drawn once per code group
and stays reachable; no code repeats more than a sentence.
**Today:** **The screen half shipped; the producer half did not.** `sharedTail`/`sharedNotes`
(`doctor.js:571-619`) compute the common suffix per code, slice it off every row (`:1083-1085`) and
draw it once as `doc.shared` — generically, so every code is covered, exactly as the item asked. But
`checkCitationForm` still concatenates finding and teaching into one string
(`src/doctor/checks.ts:3736-3742`). Measured today: 63 findings, 83,168 characters of message, of
which per-code shared tails account for **26,544 re-printed characters** — and `mycontext doctor` in
the terminal prints every one of them, because the dedup lives only in the browser.
**Superseded?** No. One corpus hit, its own `needs: walk/121`.
**Verdict:** SPLIT · ~half a day

- [ ] **A — lift `sharedTail` into a module both `doctor.js` and `src/cli/commands/doctor.ts` read** *(recommended: the cut is already proven; the terminal reader currently gets none of it)*
- [ ] B — fix it at the producer instead, re-splitting each check's prose
- [ ] C — close it; the screen is fixed and the terminal is out of scope
- [ ] D — split / other (say what)

---

# The shell

<a id="walk0"></a>
### walk/0 — no screen has hover or click help, and most buttons carry none at all

**Says:** ~35 buttons across the screens, ~10 titled, no question-mark affordance anywhere — and it
asks the doer to DECIDE three things: the affordance, where the strings live, the relationship to
`mycontext help`.
**Today:** Re-measured: **45** `el('button'` call sites in `src/ui/public/screens/*.js`, not ~35, and
**3** carry a title — `watch.js:1321`, `watch.js:1428`, `preview.js:1600` — not ~10. The per-screen
figures hold except one: preview is **1 of 7**, not "4 of 6". The affordance the item said does not
exist now does: `src/ui/public/lib/disclosure.js:1` — *"The one circled question mark, built once"* —
imported by five screens.
**Superseded?** **Partly — all three "decide" questions are ruled.**
`DEC-help-is-written-for-controls-a-reader-cannot-infer-and-the` (2026-09-05) names walk/0 in its
first line, rules help onto controls a reader cannot infer rather than all ~200, reuses
`lib/disclosure.js`, and requires a browser re-check afterwards.
`STD-a-screen-explains-itself-in-plain-words-and-depth-hides` settles the affordance;
`STD-the-fact-on-the-line-the-explanation-on-hover-the` settles where the text lives.
**Verdict:** SPLIT · ~a day. The DECIDE half is settled and must not be re-opened; the APPLY half — 42
untitled buttons, thirteen screens with no help — is unbuilt.

- [ ] **A — re-cut it as an application pass under the settled standard, dispatched after `plan:screens seq:23`** *(recommended: that item consolidates the hand-built disclosures, so the pass has one mechanism to reach for)*
- [ ] B — dispatch it now, without waiting for screens/23
- [ ] C — close it; the ruling is the deliverable and per-control help can wait for v2.1
- [ ] D — split / other (say what)

> **This item has no `seq` field.** It is the only `plan: walk` task in the corpus missing one, and it
> has no `seq:0` tag either. `mycontext ready --plan walk` prints it as `(no plan/seq)`. A decision of
> yours refers to it as "walk/0", and it cannot be listed in sequence.

<a id="walk39"></a>
### walk/39 — the provenance bar is empty on every screen: no module has ever filled provparts

**Says:** `renderChrome()` builds `#prov` and an empty `#provparts` that no screen ever fills; do it
beside `walk/29` and `walk/31`, three tasks in one function.
**Today:** Half true, and the "one sitting" premise is gone. `renderChrome()` still builds
`#provparts` empty (`app.js:3820-3821`) and `grep provparts src/ui/public/screens/` is still **zero
hits**. But the bar is no longer blank: `#provproj` is built at `app.js:3823-3824` and filled
shell-side by `fillProvenance()` (`app.js:4911-4930`), and `e2e/runs.spec.ts:39` now asserts
`#provparts` text length `> 0`. **Both companions landed** — `walk/29` and `walk/31` are `state: done`.
**Superseded?** No. Zero corpus hits for `walk/39`.
**Verdict:** SPLIT · needs its own design — the projection third is OVERTAKEN by `fillProvenance()`;
the other two parts ("preview of &lt;session&gt;", the token-recording caveat) have no filler and no task.

- [ ] **A — re-file the surviving half alone, and decide what `#provparts` is FOR before any screen writes into it** *(recommended: the item itself says the contract must be settled first, and its "three tasks, one sitting" instruction is now obsolete — both siblings shipped)*
- [ ] B — build the two remaining parts without settling the contract
- [ ] C — close it; the projection group is enough and the bar needs nothing else
- [ ] D — split / other (say what)

<a id="walk43"></a>
### walk/43 — nothing translated the shell markup: ten data-t labels were English on the Hebrew page

**Says:** The defect is fixed; what is owed is a TEST that no `[data-t]` in the shell still holds
authored English after boot in Hebrew.
**Today:** `applyStatic(root)` exists (`app.js:7448`) and `main()` calls it at `:7464`, after
`applyLanguage`, using `replaceChildren` + `translate()` exactly as specified. `index.html` now carries
**25** `data-t` elements, ten of which still seed authored English. **No test anywhere asserts this**:
`grep applyStatic test/ e2e/` returns nothing, and `e2e/language.spec.ts` drives the mockup, not the
shipped shell. The mockup-scanner-agreement half is also unwritten.
**Superseded?** No. Zero corpus hits. `DEC-hebrew-gets-the-same-emphasis-english-does` reinforces the
nodes-not-text shape of the fix.
**Verdict:** SPLIT · ~half a day

- [ ] **A — retire the defect half against `app.js:7448`; keep the test half open** *(recommended: ten seeded-English nodes are a live regression surface with no gate on them, which is the entire reason the item exists)*
- [ ] B — close the whole item; the defect is fixed
- [ ] C — keep the whole item open as written
- [ ] D — split / other (say what)

<a id="walk119"></a>
### walk/119 — every item everywhere needs a trigger that explains it in one place

**Says:** Every item gets a trigger showing a plain summary; the summary is corpus data with a
written-against basis; a missing one composes the command that would generate it; a stale one says so;
the graph and the ribbon are each covered or named out of scope.
**Today:** **The corpus half is built.** Items carry `summary`, `summary_of` (the basis checksum) and
`summary_was`; `summaryState` is in `src/core/content-hash.ts` and served at `read-model.ts:2060` and
`:3085`; the gate is `src/core/summary-gate.ts`; doctor raises `summary_stale`. The pane draws it —
`fillPaneSummary` (`app.js` ~997-1010) with three staleness carriers, pinned by
`test/ui/pane-route.test.ts:744-861`. Four gaps remain, measured: `graph.js` contains the string
`summary` **zero times**; the ribbon segments and ghosts still take an unkeyed `title` with no
reachable id (`preview.js:2283, 2301`); Composer and Capture are nowhere named as excluded; and no
`e2e/` spec touches the trigger, so the "drive it from three screens" proof does not exist.
**Superseded?** In part, by construction rather than reversal — four decisions and a standard
together built the field, its basis, its staleness and its re-affirmation.
**Verdict:** SPLIT · ~half a day for the remainder, **plus one ruling from you**

- [ ] **A — re-cut it to the four gaps only, and rule the contradiction below** *(recommended)*
- [ ] B — keep it whole
- [ ] C — close it; the summary infrastructure is the feature and the four gaps are acceptable
- [ ] D — split / other (say what)

> **A direct contradiction between the item and shipped code, and only you can settle it.** walk/119
> requires a missing summary to be *"drawn and named rather than blank"* and to compose its generating
> command. `app.js`'s `fillPaneSummary` docblock rules the opposite, under the heading ABSENT IS
> ABSENT: *"null hides all three elements rather than drawing an empty paragraph, a blank line or a
> dash."* One of the two is wrong and neither knows about the other.

<a id="walk139"></a>
### walk/139 — a screen shows "not read yet" for over a second while it is reading, and sets no busy state

**Says:** There are three states, not two — reading now, read and empty, not read — and the first
wears the third's clothes; add an in-flight key, `aria-busy`, and a progress affordance.
**Today:** Unchanged. `route()` still writes `screen.unread` into the section before awaiting the
dynamic import (`app.js:7357-7360`), and `en.js:378` is still the flat `'not read yet'`.
`grep aria-busy src/ui/` returns exactly one hit, in vendored Web Awesome code — nothing first-party.
No in-flight key exists in either table. `en.js:367-379`'s own comment records that this key was
written *for want of one* for the transient state.
**Superseded?** No. Zero corpus hits; no ruling anywhere on screen loading.
**Verdict:** STANDS · ~half a day

- [ ] **A — do it in `route()` where the chip is already appended: one new key in both tables, `aria-busy` for the life of the await, and `screen.unread` reserved for a settled non-read** *(recommended: it is your own 2026-09-05 request and it is a 1.2-second lie on every screen change)*
- [ ] B — do it in a later accessibility pass
- [ ] C — supersede it; the delay is short enough to live with
- [ ] D — split / other (say what)

---

# Injection preview

<a id="walk57"></a>
### walk/57 — the event picker's four are right; subagent-start and the tool/jit rename are undisclosed

**Says:** Four is correct and must stay four. What is owed is a DISCLOSURE — the screen says a
subagent's delivery is previewed by `session-start` (or a ruling says it should not), and the
`tool`/`jit` mapping is written where a reader joining picker to log meets it.
**Today:** Still exactly four in all three places (`src/core/select.ts:18`, `read-model.ts:252`,
`preview.js:200`) — the verification half holds. Neither string table mentions a subagent on this
screen. The `tool`/`jit` mapping exists only in source comments (`audit.ts:199,662`,
`preview.js:212`), never in a string a reader meets. No corpus item records the "should not" ruling.
**Superseded?** No, and the subject survives intact. One clause of its Done-when IS dead: the
`{m:...}` markers in the mockup's Hebrew copy, killed by the freeze — and
`test/ui/strings-parity.test.ts:180` now enforces only the mockup→tables direction, so a new key needs
no mockup edit at all.
**Verdict:** STANDS · ~1 hour

- [ ] **A — add two keys to `en.js`/`he.js` only, and drop the mockup clause as superseded** *(recommended: the reasoning is already written in the item; it needs a sentence on the screen, not a decision)*
- [ ] B — rule instead that the screen should NOT say it, and record the ruling
- [ ] C — supersede it; the reader can work it out
- [ ] D — split / other (say what)

<a id="walk102"></a>
### walk/102 — the screen-literals ledger names twelve unkeyed sentences as Filed, and nothing was filed

**Says:** `test/ui/screen-literals.test.ts` holds twelve `unkeyed` entries — ten on preview, plus
`coverage.js`'s *Copy failed* and `watch.js`'s *regime change ·* — that no item owns.
**Today:** The ledger holds **seven** entries now, all in `preview.js`, and **four of those seven are
NEW**, filed by `walk/103`. Of the original twelve, **nine are gone**: `not reached — <q>` and the
`GATES` descriptions are keyed (`en.js:229,236`), the tier label is `preview.rbTo`/`rbInOut`
(`en.js:243-244`), the range/no-spill/index/spill hints are `preview.rbRange`/`rbFit`/`rbIndex`/`rbSpill`
(`en.js:249-254`) all with Hebrew; `coverage.js`'s literal died with the `commandActions` swap and
`watch.js`'s is `watch.regime` (`en.js:479`).
**Superseded?** The blocking premise is gone. `walk/92` is `state: done` and
`test/ui/strings-parity.test.ts` now has exactly one mockup-facing test, "the gap direction". The
`needs: walk/92` is discharged.
**Verdict:** SPLIT · ~1 hour

- [ ] **A — retire nine-twelfths against `walk/92` and the keys above; the residue is three preview sentences** *(recommended: the `help.p1` tail, the `path — none` slot and the ghost tooltip need Hebrew written, not a gate lifted)*
- [ ] B — keep the item whole and re-measure it
- [ ] C — close the whole item
- [ ] D — split / other (say what)

> Worth knowing: four of the ledger's seven live entries were added by `walk/103` (`state: done`) for
> keys it could not write because `src/ui/public/strings/**` was another lane's file. That bound has
> expired. Those four have proposed keys and proposed Hebrew written inline in the test file and no owner.

---

# The budget simulator

<a id="walk8"></a>
### walk/8 — anchor the simulator on the real context window, from the status line

**Says:** Draw a marker at the room actually left in the context window, with three honesty states —
known, not-yet-known, unknown — and never guess.
**Today:** **The anchor is built; the chart marker is not.** `classifyContext` returns exactly the
three states (`src/core/statusline-tee.ts:255,264,272,283`), `writeTee` still writes the sample to
disk joined on `session_id` (`:156`), and it is served at `GET /api/watch/context`
(`watch-model.ts:1086`). The simulator already consumes it: `simulate.js:2144-2165` fetches it, keeps
`win` null on anything but `state === 'known'`, and `drawWindow` (`:1193-1244`) draws a banded chip
plus the full-window next step, with `sim.winNone` as the named refusal — built by `plan:budget seq:3`
and `seq:4`, both done, and **seen rendering live** in the 2026-09-05 reverify. What does not exist is
the marker ON the staircase: `drawStair` pushes only `axis`, `step`, eviction circles, `defline` and
`nowline` (`:1414-1418`).
**Superseded?** No. Four corpus hits, all treating it as pending.
**Verdict:** SPLIT · ~half a day

- [ ] **A — close the "anchor it and say when it is unknown" half against `plan:budget seq:3`/`seq:4`; keep only the free-space line on the staircase** *(recommended)*
- [ ] B — close the whole item; the chip is the anchor and a chart line adds nothing
- [ ] C — keep it whole
- [ ] D — split / other (say what)

> The surviving half needs one ruling from you, which is the item's own constraint 3: what a moving
> `size − used` line means when drawn against a budget axis. A tier budget and free window space are
> different units of decision.

<a id="walk14"></a>
### walk/14 — carry a successful simulation to config as a pending budget change

**Says:** A control on simulate takes the current tier and budget forward; config shows it as an
accumulating PENDING PATCH the user applies; the value travels in the URL hash.
**Today:** **The config end is gone as a premise.** Configure's budgets pane no longer composes a
patch to paste — `budgetSaveControl` (`config.js:791-930`) mints a nonce, renders a field-by-field
before→after diff and POSTs `/api/execute` with `id: 'config:budgets'`. It **writes** `config.json`.
The simulate end does not exist: no carry control, no `#/config` navigation, no budget in the hash.
The only value that crosses is the slider RANGE, which
`DEC-the-slider-s-range-maximum-is-client-state-in-one-shared` rules is explicitly not a budget.
**Superseded?** **Half of it, yes.** `DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to`
(2026-08-27) and `DEC-the-web-screens-may-write-and-compose-then-run-in-a-terminal` (2026-09-04)
reverse the closing sentence of this item's own parent ruling — *"NOTHING HERE WRITES. config still
composes a patch the human applies."* The parent's other clause — a successful simulation can be
carried to config — is untouched.
**Verdict:** SPLIT · ~half a day

- [ ] **A — retire the pending-patch / accumulate / copy-patch half; keep the simulate-side carry, re-aimed at Configure's budget field** *(recommended: keep the "only after a simulation SUCCEEDED" gate, and say whether the URL carry is still wanted now that nothing has to survive a paste)*
- [ ] B — build it as written, patch and all
- [ ] C — close the whole item; the write path makes carrying unnecessary
- [ ] D — split / other (say what)

> `DEC-a-budget-is-chosen-by-simulating-it-and-carried-to-config` still carries the sentence "NOTHING
> HERE WRITES", which was reversed two days later and is now false. The decision has no note recording
> that.

<a id="walk59"></a>
### walk/59 — the simulator opens on the tier that shows nothing, and div.at needs a behaviour test

**Says:** Decide and record the opening tier (or say on `jit` what is missing and how to supply it),
and write a behaviour test asserting the `at` highlight lands on the right rung and MOVES.
**Today:** Both cited symbols are unchanged: `let tier = 'jit'` (`simulate.js:518`) and the
`EVENT_FOR[tier] === 'tool' && path === null` guard (`:1530-1539`); `drawLadder` still clears and
returns with no sentence on an all-zero sweep (`:1487-1491`). **The staircase half was fixed
elsewhere**: `drawStair` now names the empty case with `sim.stairNoPath` — *"Absent, not empty"*
(`:1316-1324`), landed under `plan:walk seq:86`. `div.at` is still in the ledger
(`e2e/screen-parity.spec.ts:358-378`), and no spec asserts the highlight —
`e2e/simulate-range.spec.ts:72-74` only waits for the ladder to be non-empty.
**Superseded?** No. No ruling anywhere records an opening-tier decision.
**Verdict:** SPLIT · ~half a day

- [ ] **A — the opening-tier decision and the ladder's own missing-path sentence still stand, plus the `at` behaviour test** *(recommended: the test is cheap — `simulate-range.spec.ts` already drives the pinned tier and the slider — and `div.at` cannot leave the ledger without it)*
- [ ] B — just do the test; the blank opening is acceptable
- [ ] C — close it; `plan:walk seq:86` and `ensurePath()` between them answered enough
- [ ] D — split / other (say what)

---

# Configure and watchedDocs

<a id="walk105"></a>
### walk/105 — the three sentences that tell a reader their config is broken are drawn in English with no key

**Says:** `config.parseError`, `config.resolveError` and `skippedNotice` are the loader's raw English
with no key; key the FRAME, not the loader's text.
**Today:** **Two of the three are done, in exactly the prescribed shape.** `config.js:1210-1220`
defines `stop(key, text)` drawing `ctx.t(key)` above `errorNote(text)`, called with `'cfg.parseErr'`
(:1214) and `'cfg.resolveErr'` (:1218); both keys exist in both tables (`en.js:1089-1090`,
`he.js:711-712`) and leave the loader's sentence untranslated as required. **`skippedNotice` is
untouched**: `config.js:1237` is still `root.append(el('p','small', resolved.skippedNotice))` — raw
server English, no frame key.
**Superseded?** No. `walk/92` is done and unblocks the remainder rather than reversing it.
**Verdict:** SPLIT · ~1 hour

- [ ] **A — close the parseError/resolveError two-thirds; keep `skippedNotice`** *(recommended: it is the one `src/ui/read-model-config.ts` COMPELS this surface to print — "a surface that shows config to a human and does not print this notice has re-created the silent drop this field exists to end" — so an untranslated one is the weakest of the three)*
- [ ] B — close the whole item
- [ ] C — keep it whole
- [ ] D — split / other (say what)

<a id="walk106"></a>
### walk/106 — watchedDocs is the one config subject nothing prints and nothing checks

**Says:** Build `watched_docs_no_match` in `src/doctor/checks.ts` FIRST, because it unblocks
`walk/18`, and because `watchedDocs` is invisible to the CLI, to `doctor` and to
`POST /api/config/preview` at once.
**Today:** The check still does not exist — `checks.ts:923-925` names it by id and says it is *"not
built here"*. **A close sibling landed on 2026-09-05** under `plan:docsys seq:4`:
`checkWatchedDocsServable` emits `watched_doc_unserved` (`checks.ts:937-959`) plus a
`watched_doc_coverage` disclosure (`:962-971`) — the exact `dead_scope`-shaped pattern this item asks
for, so the work is now largely a copy. The preview blindness is unchanged. **Two of the item's own
measurements have drifted**: `watchedDocs` is not written by `init`, and since `mycontext config`
landed on 2026-09-04 its blast line and refusals DO print the list
(`src/cli/commands/config.ts:279-286`, `src/core/config.ts:2378-2384`).
**Superseded?** No. `DEC-a-dead-watched-docs-list-earns-a-one-command-repair` is active and orders it.
**Verdict:** STANDS · ~half a day

- [ ] **A — build point 1 by copying `checkWatchedDocsServable`'s shape, and correct the two stale measurements in the body** *(recommended: this is now the cheapest item in its group, and it is the one that unblocks `walk/18`)*
- [ ] B — build all three points including the blast-panel decision
- [ ] C — supersede it; `watched_doc_unserved` is close enough
- [ ] D — split / other (say what)

<a id="walk18"></a>
### walk/18 — build init --rewrite-watched, and offer it from the doctor screen

**Says:** Add `mycontext init --rewrite-watched` with `--yes`, and give `repairCommandFor` the code
`watched_docs_no_match`, because *"`init` already knows how to write `watchedDocs` from what the
repository actually has"*.
**Today:** Neither half exists, **and the item's premise is false.** There is no
`src/cli/commands/init.ts` at all — `init` is `cmdInit` (`src/cli/index.ts:388`), it refuses every
flag but `--pack` (`:389-404`), it aborts when `.my_context` already exists (`:419`), and
`INIT_CONFIG` (`:150`) is `{ profile, categories: {}, budgets: {} }` — **no `watchedDocs` key, ever**.
The list comes from the static `DEFAULT_WATCHED_DOCS` at resolve time (`src/core/config.ts:118-122`).
Separately, `repairCommandFor` no longer carries a code table: it delegates to `repairArgvFor`, which
switches on the SERVER's `finding.remedy` route (`viewmodel.js:1609-1626`), so the repair belongs in
`checks.ts:276` (`REMEDY`), not in the browser.
**Superseded?** No — `DEC-a-dead-watched-docs-list-earns-a-one-command-repair` is active and orders
both halves. `needs: walk/106` is still true.
**Verdict:** STANDS · ~a day *(not the "two small changes in two places" the item budgets for)*

- [ ] **A — build after `walk/106`, and correct both citations first** *(recommended: `init` must GAIN a repository scan and an existing-workspace path; it has neither, which is what makes this a day rather than an hour)*
- [ ] B — build it now, before `walk/106`
- [ ] C — supersede it; a dead watched list is a doctor finding and needs no repair command
- [ ] D — split / other (say what)

---

# Watch, Ask, Decay and the audit projection

<a id="walk32"></a>
### walk/32 — the stale-projection refusal names a command and will not hand it over

**Says:** watch, ask and decay all name `mycontext audit` in prose and offer zero compose-and-copy
rows; give them the row this UI already has.
**Today:** Still true. Grepping for `cmd`, `command.js`, `composeCommand`, `cmdRow` across
`watch.js`, `ask.js` and `decay.js` returns nothing — none of the three imports `lib/command.js`. The
refusal is unchanged at `src/ui/watch-model.ts:170-192`, and the screens render it as flat text
(`watch.js:1790`, `decay.js:372,721`, `ask.js:1108`).
**Superseded?** **No, and this was checked hardest.**
`DEC-the-writer-keeps-the-audit-projection-current-so-no-reader` LANDED — `plan:walk seq:28` is done
and `keepProjectionCurrent` is called from `src/core/audit.ts:1541`. But it does not make the state
unreachable: the ruling's own text keeps the refusal for *"an imported log, a corpus edited outside
the tool, or a deleted projection"*, and `refuseProjection` still handles `diverged`/`damaged`. The
item anticipated exactly this.
**Verdict:** STANDS · ~1 hour

- [ ] **A — build it; `mycontext audit` takes no arguments, so it is a fixed string and a copy button on three screens** *(recommended: walk/28 made the state rarer, which strengthens the case — a rare refusal with no way out is worse than a common one, because nobody will have learned the cure)*
- [ ] B — do it later
- [ ] C — supersede it; walk/28 made it rare enough
- [ ] D — split / other (say what)

<a id="walk33"></a>
### walk/33 — the projection refusal says everything twice, and leaks an absolute filesystem path

**Says:** The refusal states the same four facts twice — once keyed, once as the server's raw error in
parentheses — and prints an absolute path into `.audit/audit.db`.
**Today:** Both defects stand, and both lines can be named. The doubling is built at
`src/ui/watch-model.ts:176-182`: the composed sentence ends `` `${BUILD_IT} (${detail})` ``. That
detail is built at `src/core/audit-db.ts:1149-1158` and repeats all four facts, and its `file` is
`auditDbPath(root)` (`:1049`) — an absolute path. The browser prints it verbatim on three screens; no
dedup logic exists anywhere. The wording has shifted since the 2026-08-25 capture, so quote the
current text, not the item's.
**Superseded?** No. Zero corpus hits — nothing has ruled on it either way.
**Verdict:** STANDS · ~1 hour

- [ ] **A — drop `(${detail})` from `refuseProjection` where the state is already carried in the body** *(recommended: one line, and it keeps the CLI's terminal message with its path intact — same fact, two audiences, only one of which needs the path)*
- [ ] B — do it later
- [ ] C — supersede it; the duplication is acceptable
- [ ] D — split / other (say what)

<a id="walk66"></a>
### walk/66 — the ledger projection is behind by construction, and it is a different store

**Says:** `ledger.record`/`recordRestored` run only from `topUpLedger`, itself run only by readers, so
Decay and the Ledger read a store stale by construction — and the currency-versus-batch question must
be answered before any code.
**Today:** Unchanged. Both are called from exactly one site, `src/core/ledger-replay.ts:39-40` inside
`topUpLedger`, which has **four** callers, all readers — `audit.ts:312`, `status.ts:103`,
`decay.ts:139`, and one the item does not name, `src/mcp/tools.ts:397`. No hook, no append-path caller.
`read-model.ts:1870-1900` still documents the staleness verbatim and states that no read-only probe of
how far behind the ledger is even exists.
**Superseded?** No. `DEC-the-writer-keeps-the-audit-projection-current-so-no-reader` rules only on the
AUDIT projection — its defect is `.audit/audit.jsonl` against its own projection, its symptom is two
endpoints answering 503, and it says nothing about `.index.db`. The item's "different store" claim holds.
**Verdict:** STANDS · needs its own design

- [ ] **A — answer current-vs-batch first; if the answer is "batch", the whole remedy is a freshness sentence on Decay and the Ledger and it becomes ~half a day** *(recommended: this is a design question, not a patch — `.index.db` is the database the product invites a user to delete, and putting a must-be-current projection in a file whose recovery story is "delete it" is a decision)*
- [ ] B — make it current now, and measure the append-path cost first as the item demands
- [ ] C — supersede it; batch is fine and unsaid
- [ ] D — split / other (say what)

<a id="walk76"></a>
### walk/76 — the audit tab cannot tell a capped answer from a complete one

**Says:** `filterSelect` binds the cap itself with no probe row, so a capped audit answer is
indistinguishable from a complete one — and the SQL box's `+1` note is false about the query displayed
directly beneath it.
**Today:** Exactly as filed. `src/core/audit-db.ts:1266` is still `if (limited) params.push(filter.limit!)`
— the cap itself, no `+1` — and `queryProjection` (`:1225-1229`) drops nothing. The audit response
body carries no `truncated` field at all, while the corpus path at `ask-model.ts:241-252` does bind
the probe and does return `truncated`. And `ask.sqlCaption` (`en.js:587`) still asserts *"The final
LIMIT binds one row more than the cap"* — drawn on both tabs, true of only one.
**Superseded?** No. Zero corpus hits; neither typed-SQL ruling touches the probe row.
**Verdict:** STANDS · ~1 hour

- [ ] **A — do it: one line in `filterSelect`, one slice in `queryProjection`, plus the over-cap fixture** *(recommended: it also stops an already-shipped teaching sentence from lying)*
- [ ] B — do it later
- [ ] C — supersede it; fix only the caption instead
- [ ] D — split / other (say what)

<a id="walk100"></a>
### walk/100 — the four canned reports cannot take the fetch-cap ladder, and nothing says so

**Says:** The fetch cap is inert over the four canned reports and nothing on the page says so; decide
first whether a longer top-N is the offer, and do NOT "fix" it by clamping.
**Today:** Unchanged in every particular. `runSummary` (`ask.js:1171-1180`) builds params from
`report` and `role` only — the cap is never sent — while the select stays in the filter row above.
`/api/ask/summary` still clamps at 1..200 (`ask-model.ts:594`) and `report=ops` still takes no limit
at all (`:598`). No sentence exists in `en.js`. The screen's own docstring records the gap as *"named
here and in this task's report rather than papered over"*. Confirmed live by the 09-05 sweep: pressing
"Operations by count" returned 34 rows with the cap sitting at 200, governing nothing.
**Superseded?** No. `DEC-the-ask-screen-accepts-typed-sql-reversing-shown-never-typed` ends *"The
canned `report=tasks` is filed separately and is NOT superseded by this"*, and typed SQL has not
landed — no `/api/ask/sql` route exists.
**Verdict:** STANDS · ~half a day

- [ ] **A — answer the top-N question, then ship one key wording the cap's inertness** *(recommended: the endpoint's own 200 only needs raising if the answer is "a longer top-N is what these offer")*
- [ ] B — just ship the sentence and leave the top-N question open
- [ ] C — supersede it; wait for typed SQL to make the canned reports moot
- [ ] D — split / other (say what)

---

# Documentation, Tutorials and Template packs

**Read this group as one.** All five come back non-standing, and the reason is structural: since these
items were written the documentation cluster was ruled on end to end, `screens/docs.js` and
`screens/tut.js` were **deleted** (`65671da`), and their content moved to a Library screen and a
standalone document page. `plan:docsys` is 12 items with 5 open (4 of them deprecated); `plan:tuts` is
8 with 1 open.

<a id="walk24"></a>
### walk/24 — research a documentation tool, then build the full application documentation

**Says:** Research a documentation tool FIRST — no runtime dependency, EN and HE, generated from
existing sources — then build the full documentation.
**Today:** The research half is finished and ruled on:
`docs/superpowers/specs/2026-09-05-documentation-tooling-research.md`,
`DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings`, and `docsys/3` (`state: done`). The
chosen shape is vendored, not depended on: `src/ui/public/lib/vendor/markdown-it.esm.min.js`, with
`package.json` carrying **no `dependencies` key at all**. The screen the item names no longer exists;
the content is served from `README.md`, `docs/README.he.md` and 48 tutorial files (24 EN, 24 HE).
**Superseded?** **Yes, on all three premises.** The tool question:
`DEC-the-documentation-system-is-hand-built-over-a-wide-glob` — *"BUILT BY HAND, NOT BY A GENERATOR …
this ruling is that we do not take one"*. The surface question:
`DEC-the-documentation-and-tutorials-screens-become-one-list-and` — *"The console stops trying to be a
documentation site."*
**Verdict:** SUPERSEDED — successor `docsys/11` holds the residual prose work

- [ ] **A — retire it against those two decisions, naming `docsys/11` as the successor** *(recommended: every question this item posed has since been answered by a ruling of yours)*
- [ ] B — keep it open as the umbrella for the documentation programme
- [ ] C — close it `done` instead
- [ ] D — split / other (say what)

<a id="walk25"></a>
### walk/25 — serve markdown documents to the UI, behind a decided boundary

**Says:** Serve markdown from a server-built manifest with stable ids at `/api/doc/:id`; no
client-supplied path ever reaches the filesystem; a refusal that names what it refused; plus the
viewer and the deep link.
**Today:** **Built, exactly as ruled.** `src/ui/server.ts:548-553` registers `GET /api/doc` and
`GET /api/doc/:id`; `buildDocManifest` (`read-model.ts:3765`) produces the ids itself; `apiDoc` looks
the client id up as a Map key, and the 404 text says so literally — *"the id is looked up as a key,
never joined onto a path"* (`read-model.ts:3846-3850`). The viewer shipped as `src/ui/public/doc.html`
+ `doc.js:335`, and the deep link landed as `?doc=<id>#heading` rather than the `#/docs/4` the item
sketched. The `needs: walk/37` renderer block is discharged — `lib/markdown.js` handles blockquotes,
tables, ordered lists and rules (`:339-352`). `test/ui/doc-endpoint.test.ts` exists.
**Superseded?** Not reversed — carried out.
`DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer` answered its open question, and
`DEC-the-documentation-system-is-hand-built-over-a-wide-glob` widened the boundary.
**Verdict:** OVERTAKEN — by `src/ui/server.ts:548-553`, `read-model.ts:3765`/`3757`, commits
`65671da` and `52f74e4`

- [ ] **A — close it `done`, naming the route and the commits** *(recommended)*
- [ ] B — re-verify the traversal refusal live first
- [ ] C — keep it open until `/api/help/:topic` also opens beyond its four topics
- [ ] D — split / other (say what)

<a id="walk130"></a>
### walk/130 — Template packs: what the screen is, and what implemented means for it

**Says:** Four prose cards, three endpoint-driven; the packs actually in this workspace joined to the
corpus; double-anchored isolation of author-supplied names; a bounded list with show-all; and the
three engine-only counts given words.
**Today:** Every clause is built. `GET /api/packs` is registered (`packs-model.ts:451`);
`packs.js:543` fetches it, `packCard` draws one card per imported pack, `boundedList`/`BOUND_CAP_TABLE`
give the bounded list and show-all. The double anchor is present and argued — `<bdi>` plus `.m`,
nothing stripped or refused (`packs.js:33-51`). The three counts draw even when empty (`:263, 281-283`),
and the "given words" clause was resolved *against* words on the record: the labels are the endpoint's
own field paths because inventing a key is forbidden (`packs.js:121-131`). `plan:screens seq:10s` is
`state: done`. Confirmed live by both 09-05 passes.
**Superseded?** No reversal found; zero corpus hits.
**Verdict:** OVERTAKEN — by `src/ui/public/screens/packs.js` + `src/ui/packs-model.ts` and
`plan:screens seq:10s`

- [ ] **A — close it `done`** *(recommended: the code predates the item, which was filed to record what the screen IS, not to build it)*
- [ ] B — re-verify live first
- [ ] C — keep it open
- [ ] D — split / other (say what)

<a id="walk131"></a>
### walk/131 — Tutorials: what the screen is, and what implemented means for it

**Says:** The `data-p="tut"` screen — six job-titled rows, two language columns — must be drawn from
something a gate can check rather than twelve hard-coded literals; and the prior question of whether
tutorials are in scope at all must be answered.
**Today:** **The screen is gone.** `src/ui/public/screens/tut.js` was deleted in `65671da`; there are
no twelve cells left to check. Its content moved to `screens/library.js`, which reads `/api/tutorials`
(`:816`) — one row per entry of the checked-in `docs/tutorials/manifest.json`, with the EN/HE state
**measured off disk per request** (`read-model.ts:3387-3396`), which is precisely the "something a gate
can check" the item asked for. The reader half exists too: `GET /api/tutorials/:id`
(`server.ts:527-530`). Scope was answered affirmatively — `docs/tutorials/` now holds 24 English and 24
Hebrew files, not six.
**Superseded?** **Yes, outright.** `DEC-the-documentation-and-tutorials-screens-become-one-list-and`
(2026-09-05): *"One console page replaces both screens … with the measured EN/HE state beside each."*
A screen that was merged away cannot need a definition of what implemented means for it.
**Verdict:** SUPERSEDED — successors `tuts/2` and `src/ui/public/screens/library.js`

- [ ] **A — retire it against that decision, naming `tuts/2` and `library.js`** *(recommended)*
- [ ] B — close it `done` instead
- [ ] C — keep it open, re-aimed at the Library screen
- [ ] D — split / other (say what)

---

# Status and Export / import

<a id="walk89"></a>
### walk/89 — Status and Export / import: the em dash is correct and cannot say why

**Says:** Both screens draw an em dash where a number would go and no key says why. Status's
`st.staged`/`st.ingest` are held out because serving them would put the mutation surface into the
read-only server's import graph; Port's buckets are empty because *"there is NO POST anywhere in this UI"*.
**Today:** The dashes are unchanged (`status.js:124-125,139`; `port.js:427`), and no key words the
reason. **But both stated blockers are gone.** `listStaging` now lives in `src/lesson/staging.ts:272`,
which imports nothing that writes, and `src/ui/read-model-staging.ts:292` already serves
`GET /api/staging` with `counts.lessons`/`counts.pending` — the split
`DEC-the-read-half-of-lesson-derive-ts-is-split-out-so-a-read` (2026-09-06) ordered. **The ingest half
was never blocked at all**: `test/ui/no-writes.test.ts:239` bans three named symbols from
`src/ingest/session.ts`, and `listSessions`/`pendingAnchors` are not among them. And there ARE POSTs
now — seven, including `/api/execute`.
**Superseded?** **Partly.** The Status half, yes, by that split decision. Item 1's "declare it in the
design of record FIRST" is dead twice over — the freeze forbids the edit, and
`strings-parity.test.ts:180` now asserts only the mockup→tables direction. The Port half is **not**
superseded: `OPENQ-does-export-import-ever-import-or-is-a-third-of-that-screen` is still open and
names this task's size as what it blocks.
**Verdict:** SPLIT · ~half a day

- [ ] **A — build Status's two counts now (wire `/api/staging` plus a read-only ingest count into `/api/status`); leave Port's dash key blocked on the open question** *(recommended: and correct the item's "no POST anywhere" sentence before anyone reasons from it)*
- [ ] B — keep the whole item blocked until the Export/import question is answered
- [ ] C — build only the two dash-reason keys and leave the counts unserved
- [ ] D — split / other (say what)

> Two comments are now the primary evidence a reader would use to conclude the Status counts are
> unservable, and both are wrong: `src/ui/read-model.ts:1541` and `src/ui/public/screens/status.js:30-32`
> still say `listStaging` lives in `lesson/derive.ts` and imports `createItem`.

<a id="walk108"></a>
### walk/108 — three screens state no verdict, because the retired PROPOSED badge filled that slot

**Says:** Draft `pr.v`, `port.v`, `pk.v` into both string tables, take the three to you, then switch
`proc.js`, `port.js` and `packs.js` to `screenHead` and delete their hand-drawn heads.
**Today:** The measurement still holds. `screenHead` is at `parts.js:502` and eighteen screens call it;
`proc.js:470`, `port.js:322-328` and `packs.js:533-539` still hand-draw the `.phd`/`h2`/`.psub` shape,
and `port.js:325` still appends an **empty** `el('span','verdict')`. Neither table declares any of the
three keys. Nothing outside `learn.js:310` draws the unmeasured mark.
**Superseded?** **Yes — by an owner ruling that names `walk/108` by id in its second line.**
`DEC-a-screen-with-no-verdict-yet-draws-the-unmeasured-mark-never` (2026-09-05) reverses the action:
the three screens do **not** get a drafted verdict sentence — what "implemented" means for them is
undecided and is `walk/127`/`129`/`130`/`131` — they draw Learn's unmeasured mark instead, *"the same
component and the same strings"*.
**Verdict:** SUPERSEDED — by that decision · successor work ≈ ~half a day

- [ ] **A — retire it against that ruling AND file the ruling's own implementation as a new item before closing** *(recommended: see the warning below)*
- [ ] B — retire it and leave the ruling unimplemented
- [ ] C — keep it open, re-aimed at drawing the unmeasured mark on the three screens
- [ ] D — split / other (say what)

> **Retiring this without filing the successor work would lose the ruling.**
> `DEC-a-screen-with-no-verdict-yet-draws-the-unmeasured-mark-never` is ruled and **unbuilt**, and no
> task in the corpus carries it. Its own text asserts *"A test asserts every screen's badge is either a
> real verdict or the unmeasured mark — never blank"* — that test does not exist, and `port.js:325`
> still ships the empty `.verdict` span the ruling was taken to end. `walk/108` is currently the only
> thing pointing anywhere near it.

---

# Screen definitions, and the two review items

<a id="walk127"></a>
### walk/127 — Review queue: what the screen is, and what implemented means for it

**Says:** Both queues drawn, all four settlements reachable, per-field staleness expressed as the row's
own shape, and the word-level diff promise either built once and shared or corrected.
**Today:** All four are true. `screens/work.js` draws both queues, including the draft queue that "was
never built", with both measured zeros named (`work.draftsEmpty`, `work.revisionsEmpty`). All four
settlements exist as data — `SETTLEMENT.revision`/`.draft` × accept/reject, composed by `revisionPlan`
and `draftPlan` (`:237, 262`) so the verdict composes the line, the sentence and the argv together. A
stale field replaces its two value cells rather than being diffed (`:342-345`). The diff promise was
**corrected, not re-implemented**: `work.diffn` says line-level in both tables against `lineDiff` in
`core/revision-diff.ts`, and nothing composes a browser-side diff.
**Superseded?** No reversal.
**Verdict:** OVERTAKEN — by commit `a18b804` (*"the Review queue was already built"*) and
`src/ui/public/screens/work.js`

- [ ] **A — close it `done`, naming `a18b804`** *(recommended)*
- [ ] B — re-verify live first
- [ ] C — keep it open
- [ ] D — split / other (say what)

> This is the sharpest illustration of why this sheet exists. The commit that finished it is titled
> *"the Review queue was already built"*, it set the item's state from `done` back to `doing`, the
> 2026-09-05 reverify drove the screen in both languages and confirmed every condition — and the item
> reads `state: todo` today, `verified_on: 2026-09-05`.

<a id="walk129"></a>
### walk/129 — Composer: what the screen is, and what implemented means for it

**Says:** Every catalogue entry reachable through pickers built from its own arguments and flags, the
glob tester answering from the server, no control able to compose a withheld flag, and the count line
plus the dead-scope sentence.
**Today:** `PALETTE` holds 30 entries; `controlSpecs()` reads only `def.args` and `def.flags` and
*"has no third case, so the withheld list cannot reach a control by being forgotten about"*, with
`FLAGS_NOT_OFFERED` pinning that from outside. The glob tester is server-answered — `palette.js:988`
and `:1038` call `/api/glob` (`read-model-work.ts:371`); `pal.globn` is the count line and
`pal.globDead` names the truly-empty result, both confirmed rendering live on 2026-09-05. The picker
work landed (`builder/9`, `builder/10`, both done). `e2e/composer-matrix.spec.ts` re-measured the
surface today at 30 entries and 89 fields.
**Superseded?** No — zero corpus hits outside the item's own file.
**Verdict:** OVERTAKEN — by `lib/builder.js`, `lib/palette-defs.js`, `builder/9` and `builder/10`

- [ ] **A — close the DEFINITION now, and let the verification close under `builder/11`** *(recommended: `builder/11` is the proof and it is still `state: todo` and in flight)*
- [ ] B — hold this open until `builder/11` closes, and close them together
- [ ] C — keep it open
- [ ] D — split / other (say what)

<a id="walk141"></a>
### walk/141 — Ask and Capture are reviewed against what they are now, not against the first sketch

**Says:** Your ruling of 2026-09-07 — keep both screens, change neither's existence, review, refactor
and extend them against what the product is now. `needs: builder/11`.
**Today:** **Brand new, filed today, correctly held, not stale.** Its blocker is real and unmet:
`builder/11` is `status: active`, `state: todo`. Work on it has begun but is unfinished —
`e2e/composer-matrix.spec.ts` carries it as its basis and re-measured today, and
`e2e/composer-execute.spec.ts` is the executing half. Its factual premise holds: `capture.js:180`
imports `lib/builder.js`, so Capture does render through the same component since `builder/5`.
**Superseded?** No — zero corpus hits anywhere, including in `seq:140`, which does not name it.
**Verdict:** STANDS · needs its own design

- [ ] **A — leave it held until `builder/11` closes** *(recommended: its scope — "review, refactor, extend" two screens — cannot be sized until the Composer proof is in hand, which is the order you set)*
- [ ] B — start it now in parallel
- [ ] C — supersede it; the merge question is settled and no review is needed
- [ ] D — split / other (say what)

---

# Search

<a id="walk134"></a>
### walk/134 — search matches only an unbroken phrase, so the same words in another order find nothing

**Says:** The query is matched as a contiguous substring, so a reordering finds nothing; decide and
implement the matching rule, say it in the usage line and the no-match message, and move
`GET /api/search` and the query tool with it.
**Today:** Still one `includes` — `src/core/search.ts:265` — over a lowercased join of the item's
fields. No tokenisation anywhere in the file. `GET /api/search` shares the rule: `apiSearch`
(`read-model-work.ts:151-181`) builds the same `ItemFilters` and hands it to the same core filter.
`en.js:692` already tells UI readers matching is literal and that a stemmer is decided — the CLI's
no-match text does not.
**Superseded?** No — zero corpus hits, and nothing anywhere on stemming, per-word AND or word order
outside this item.
**Verdict:** STANDS · ~half a day

- [ ] **A — do it, and pin the reordered-query test the body asks for** *(recommended: this is the surface a person or an agent uses to check whether an item already exists before creating one — the item records four board rows nearly duplicated because a paraphrase returned zero)*
- [ ] B — do it later
- [ ] C — supersede it; keep substring matching and only fix the no-match wording
- [ ] D — split / other (say what)

> Careful re-measuring this one: `search "spawns server"` now returns a hit — **this walk item itself**,
> whose body quotes the phrase. Anyone re-running the repro must read *which* item came back or they
> will record the defect as fixed.

---

# Already deprecated

<a id="walk16"></a>
### walk/16 — the mockup catches up with preview.whyn, and work.diffn needs a ruling *(status: deprecated)*

**Says:** Already closed on 2026-09-05 without being built. Included so you see it rather than have it
silently dropped.
**Today:** Its supersession claim checks out in substance and is **under-recorded in structure**. The
successor it names, `OPENQ-do-the-ins-and-del-marks-become-run-markers-or-is-a-marker`, exists — and
is itself already `status: deprecated`, `valid_until: 2026-09-06`, answered by
`DEC-the-string-grammar-stays-at-five-markers-ins-and-del-are` (ruled: no, the grammar stays at five).
So the split-out question is already closed and needs nothing. The factual half is true in code: both
string tables say line-level, matching `lineDiff`, the only diff in `src/`.
**Superseded?** Yes, by `DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written`, named in its
own body — but **neither `walk/16` nor the open question carries a `supersededBy` relation to its
successor.** Both record it in prose only.
**Verdict:** SUPERSEDED · already closed. No work.

- [ ] **A — file the two missing relation edges** *(recommended: `walk/16` → the freeze decision, and the open question → the grammar decision, so this pair stops looking like a sixth `retirementEdgeRefusal` violation)*
- [ ] B — leave it; prose is enough
- [ ] C — reopen it
- [ ] D — split / other (say what)

---

# Not a walk item, and worth filing

Eleven things this review turned up that belong to nobody. Ordered by how much they would cost if left.

1. **`walk/0` has no `seq` field.** The only `plan: walk` task in the corpus missing one, and it has no
   `seq:0` tag either. `mycontext ready --plan walk` prints it as `(no plan/seq)`, and
   `DEC-help-is-written-for-controls-a-reader-cannot-infer-and-the` refers to it as "walk/0". A ruling
   names an item that cannot be listed in sequence.

2. **`DEC-a-screen-with-no-verdict-yet-draws-the-unmeasured-mark-never` is ruled, unbuilt, and nothing
   points at it.** No task carries the work. Its own text asserts a test exists that does not, and
   `port.js:325` still ships the empty `.verdict` span the ruling was taken to end. If `walk/108` is
   retired, nothing in the corpus remembers this.

3. **`plan:builder seq:5` reads `state: todo` although `lib/builder.js` shipped in a commit named after
   it (`93920f6`)**, and two screens import it. Same shape as `walk/127`.

4. **The document page ships GitHub's LIGHT stylesheet.** `src/ui/public/doc.html:57` loads
   `/lib/vendor/github-markdown-light.css`, which contains **zero** `prefers-color-scheme` rules, and
   the page's own style paints `#ffffff` deliberately. Two rulings ask for dark:
   `DEC-the-documentation-and-tutorials-screens-become-one-list-and` names *"its dark presentation"*
   and `DEC-an-external-documentation-tool-may-be-embedded-and-it-may` says *"dark theme only, because
   this product has no light theme."* The code comment shows the white page was a choice, so this is a
   contradiction to rule on, not obviously a bug.

5. **`mycontext doctor` in the terminal still prints 26,544 characters of re-printed tail.** The dedup
   `walk/122` asked for was built in the browser only. The terminal is the surface the CLI's own docs
   point people at.

6. **The safe-port guard is enforced only on the child-process path.** `startUiChild` routes through
   `startOnSafePort`; the in-process `startUiServer` has no equivalent, and nine test files call it
   directly. Putting the guard inside `startUiServer` would close `walk/82` and its "better than
   convention" clause at once.

7. **`state_unaudited` is now 38 of doctor's 63 findings** — and `src/doctor/checks.ts:60-72` argues in
   its own words that such findings are *"noise wearing work's clothes"*, a row *"only an accident can
   clear"*. The check the codebase criticises by name is three-fifths of the health screen.

8. **A hard-severity standard cites a deleted file.**
   `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is:44-46` names `gaps` as an unfixed
   instance; `src/ui/public/screens/gaps.js` was folded into `coverage.js` and no longer exists. Two of
   the three instances it lists as unfixed are fixed.

9. **`DEC-a-budget-is-chosen-by-simulating-it-and-carried-to-config` carries a sentence that is now
   false** — *"NOTHING HERE WRITES. config still composes a patch the human applies."* Reversed two days
   later by `DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to` and built as
   `budgetSaveControl`. The decision has no note recording that.

10. **Four stale comments that will actively mislead the next implementer.**
    `proc.js:766-769` calls a question you answered on 2026-08-24 *"still an open question for the
    owner"* — and `walk/2` tells its implementer to read that comment first.
    `read-model.ts:1541` and `status.js:30-32` still say `listStaging` lives in `lesson/derive.ts` and
    imports `createItem`; it moved on 2026-09-06.
    `markdown.js:347-350` argues alignment cannot be carried, 400 lines from the `alignOf` that carries it.
    `src/doctor/checks.ts:131` cites `reports/V2-HANDOVER.md:437` — a bare `file:line` into the one file
    `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number` names as guaranteed to rot,
    and that rule was filed today from this exact citation.

11. **`docs/cli-ui-coverage.md` says 45 CLI commands; `PALETTE` holds 30.** `plan:builder seq:3` — *"the
    catalogue covers every command the generated coverage document counts"* — reads `state: done`.
    Either it was re-scoped without saying so, or `done` is wrong by fifteen commands.

---

# What this lane did not do, stated rather than implied

- **No browser and no server.** Every measurement above is from source, from `git show`, or from
  read-only CLI commands (`mycontext ready`, `doctor`, `doctor --json`, `search`) run at the repository
  root. Port 58888 was never touched, killed, restarted or bound to. `.demo-corpus` was not used.
- **Nothing under `.my_context/` was written**, by hand or through the CLI. No walk item was closed,
  edited, superseded or re-stated. No git command wrote and nothing was staged.
- **`e2e/**`, `src/ui/public/lib/builder.js` and `src/ui/public/styles.css` were read, never written** —
  another lane owns them this hour. Every citation into those three is a snapshot taken while they were
  changing and should be re-verified before anyone acts on it.
- **Two things were NOT re-measured and are stated as gaps rather than guessed at.** The tree-parity
  totals `walk/4` asks to be compared against 182 / 97 / 14 / 71 — no checked-in artifact holds them,
  and the gate renders its inventory at run time. And `walk/82`'s "zero `bad port` under deliberate
  concurrent load", which the item itself says is the only real test and which a quiet machine cannot
  reproduce.
