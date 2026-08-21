# String-key reconciliation — plan 3 against the mockup

**ui3 task 0. 2026-08-21. Proposal only: nothing in this report has been written to the mockup, to
plan 3, or to either string table.**

Provenance marks on every claim: `[V]` measured or read today in this worktree
(`mycontext-worktrees/ui3-t0`, branch `v2/ui3-t0`); `[R]` reasoned from what `[V]` established.

---

## The counts, measured today

| Measured | Value | How |
|---|---|---|
| Mockup keys, all three attributes | **370** | `[V]` `grep -oE 'data-t(-aria\|-title)?="[^"]*"' \| sort -u` |
| — of which `data-t` | **355** | `[V]` (382 elements carry them; 12 keys are used more than once — `btn.copy` ×8, `tu.todo` ×7, `port.yes` ×4, `port.no` ×3, `th.item` ×3, and seven others ×2) |
| — of which `data-t-aria` | **11** | `[V]` |
| — of which `data-t-title` | **4** | `[V]` |
| Plan 3 Task 9 `en.js` block | **69 keys**, all distinct | `[V]` fenced block at `docs/superpowers/plans/2026-08-16-web-ui-3-watch-and-ask.md:2795-2879` |
| — of the 69, on the **strip**, not on Watch or Ask | **14** | `[V]` `strip.*` — the status-line footer, plan 3's third subject |
| — of the 69, on Watch / Ask / the rail | **55** | `[V]` |
| Plan 3 keys the mockup **already carries** | **21** | `[V]` set intersection |
| Plan 3 keys the mockup **does not** carry | **48** | `[V]` set difference — matches the brief's number |
| Mockup Watch/Ask/rail keys plan 3 **does not** declare | **19** | `[V]` reverse difference (see §5) |

**Two corrections to the framing the task item uses.** `[V]`

1. "Plan 3 declares 69 string keys for Watch and Ask" is 14 keys too generous: **14 of the 69 are
   `strip.*`**, and all fourteen are already in the mockup verbatim. The Watch/Ask/rail figure is
   **55**.
2. "The mockup declares 21 for the same two screens" is not a count of the mockup's Watch/Ask
   surface — **21 is the intersection**, the number of plan 3's keys the mockup already has. The
   mockup's own Watch and Ask screens declare **24** keys in those two namespaces (6 `watch.*` +
   18 `ask.*`), plus `s.watch` / `s.ask` on the rail and six shared keys borrowed from `th.*` and
   `aria.*`.

**The 48 do decompose into exactly the families the brief names** — `watch.stream*` (4),
`watch.kind.*` (4), `watch.spills.*` (5), `watch.volume.*` (1), `ask.tab.*` (2),
`ask.projection.*` (3), `ask.field.*` (15), plus `nav.watch`, `nav.ask`, `watch.title`,
`ask.title` — and **10 more the brief's list does not mention**: `watch.injected`,
`watch.spilledCount`, `watch.tokens`, `watch.tokensNotRecorded`, `watch.resync`, `ask.filters`,
`ask.rows`, `ask.truncated`, `ask.noRows`, `ask.updatedAtTrap`. `[V]` Four of those ten are the
strongest ADOPTs in this report, so the list in the brief would have lost them.

**The mockup's own arithmetic checks out.** Its KEY NAMING block says "the fourteen keys plan 3
declares (`strip.ctx.*`, `strip.myctx*`, `ask.sqlCaption`, `ask.predefined*`)" — 5 + 3 + 1 + 5 = 14,
and all fourteen are on disk in the mockup today. `[V]` The earlier "13" was wrong; 14 is right.

**Starting position: the three files are in exact parity right now.** `en.js` 370, `he.js` 370,
mockup 370, with **zero** keys dropped and **zero** invented in either direction. `[V]` (ran the
comparison the parity test runs). Every adoption below is therefore a **three-file commit** — mockup
element, `en.js`, `he.js` — or `test/ui/strings-parity.test.ts` reddens the moment one lands alone.

---

## 1. ADOPT — 12 keys

Twelve subjects the mockup genuinely renders or genuinely owes, and has no key for. **Two of the
twelve already have both an English and a Hebrew sentence inside the mockup** (#6 and #7), and two
more have the English (#4 and #5) — built by a `HEB ? … : …` ternary or a fixture in the inline
script rather than kept in the table. `[V]` The mockup names that exact defect itself, in the comment
above `#ctx`:

> "They used to be three states **BUILT IN SCRIPT** behind a `HEB ? … : …` ternary, which had two
> consequences: no key could name them, so neither string table could carry them and the parity check
> could not see them" — and, forty lines on, "**Toggled, never built: the strings live in the table
> under keys, which is the only place a string can be checked from.**" `[V]`
> (`docs/design/web-ui-mockup.html:1561-1567`, `:2425`)

The mockup fixed that for `#ctx` and left **seven live instances** on Watch, Ask and the provenance
bar — enumerated in §5b. `[V]` Adopting these keys is finishing a job the mockup started against
itself, not importing plan 3's opinion. `[R]`

Grammar note for every entry: the mockup side is markup — `<span class="v" data-v="name">sample</span>`
for a plain slot, `class="m v"` for a monospace one — and the shipped tables transcribe those to
`{name}` and `{mv:name}` respectively. `[V]` (mockup i18n block, `:1612-1692`)

### Watch — the live connection has no voice

The mockup's `#alive` is an `aria-live="polite"` paragraph whose only content is a record count built
by a ternary: `` `${rows.length} records shown` `` / `` `${rows.length} רשומות` ``. `[V]`
(`:907`, `:2216`) It is the one element on the screen that can speak about the stream, and it says
nothing about the stream.

| # | Key | Value, in the mockup's grammar | Carrier | Reason |
|---|---|---|---|---|
| 1 | `watch.streamWaiting` | `connected — waiting for the next record` | `#alive` | `watch.pulsen` calls the pulse "**the only thing that makes a live stream feel live**". `[V]` A live stream with nothing arriving and no sentence saying so is a screen that looks broken, and the aria-live region that would say it is already in the markup. `[R]` |
| 2 | `watch.streamFault` | `the stream refused to continue: <span class="v" data-v="error">…</span>` | `#alive` | `watch.v` — the screen's own verdict — is "**the only record of what spilled**". `[V]` A feed that stops without saying so makes that claim false while looking correct. The mockup already has the pattern for an error sentence carrying a slot: `strip.myctxUnavailable`, `project-knowledge share unavailable: {error}`. `[V]` |
| 3 | `watch.resync` | `the log rotated or moved — continuing from now; the history list below was refetched` | `#alive` | `watch.voidn`'s stated principle: "**A zero-length bar would be a claim the record does not make.**" `[V]` A feed that silently restarts its read offset is making exactly such a claim about continuity. `[R]` |

*Companion, not one of the 48:* `#alive`'s existing sentence needs a key of its own —
proposed `watch.shown`, `<span class="v" data-v="records">6</span> records shown`, Hebrew
`{v:records=6} רשומות` already written in the script. `[V]` Adopting 1-3 without it leaves one of the
four states of one element outside the table. `[R]`

### Watch — the row summary and the token note

| # | Key | Value, in the mockup's grammar | Carrier | Reason |
|---|---|---|---|---|
| 4 | `watch.delivered` *(plan 3 spells it `watch.injected`)* | `<span class="v" data-v="delivered">4</span> delivered` | the `What` cell of an injection row | The mockup's fixture row **is** this sentence: `['09:22:41','injection','4 delivered, 1 spilled',4260]`. `[V]` (`:2160`) In the mockup it is fixture text; in the shipped app `describeRecord` composes it client-side (plan 3 Task 10), so it needs a key. **Respelled**: the mockup's prose word for this is *delivered* everywhere — `preview.delivered`, `sim.ratio` "Selected, then **not delivered**", `dec.heat` "**delivered** against spilled". `[V]` `injected` is the `audit_item.role` literal, correct on the Ask chip and wrong in prose. `[R]` |
| 5 | `watch.spilled` *(plan 3: `watch.spilledCount`)* | `<span class="v" data-v="spilled">1</span> spilled` | same cell | Same fixture row. `[V]` Suffix respelled because `Count` names the datatype, not the subject, and no other key in the mockup does that. `[R]` |
| 6 | `watch.tokens` | `<span class="v" data-v="tokens">4,260</span> estimated tokens, computed at injection time` | `.nt` note under the gold token bar | **The English and the Hebrew both already exist in the mockup**, as a ternary: `tok.toLocaleString('en-US')+' estimated tokens, computed at injection time'` / `' אסימונים מוערכים, חושבו בזמן ההזרקה'`. `[V]` (`:2207-2210`) Nothing to translate; only to move into the table. Note the wording is the **mockup's**, not plan 3's `{n} tokens, estimated at injection time`. `[R]` |
| 7 | `watch.tokensNotRecorded` | `tokens: not recorded — this record predates the field. Not zero.` | `.nt` note under the hatched void | Same — both languages already written as a ternary. `[V]` (`:2199-2202`) `watch.voidn` explains the void in the caption; this is the **per-row** disclosure and a different element, so this is an adoption and not a fold. `[R]` **Second key needed:** the void's `title` attribute is hard-coded English (`v.title='tokens not recorded'`, no ternary at all — `[V]` `:2198`), so Hebrew users get an English tooltip today. It wants `data-t-title="title.tokensNotRecorded"`, the fifth `-title` key. |

### Ask — the result table has no states

The mockup's `#qres` renders two fixture rows and nothing else: no caption, no count, no empty state,
no truncation notice. `[V]` (`:964`, `:2224-2238`)

| # | Key | Value, in the mockup's grammar | Carrier | Reason |
|---|---|---|---|---|
| 8 | `ask.rows` | `<span class="v" data-v="rows">2</span> rows` | a `<caption>` on `#qres` | The mockup's own pattern for "say how big this table is" is a keyed caption: `preview.cap` — `<caption data-t="preview.cap"><span class="v" data-v="items">4</span> items, …</caption>`. `[V]` (`:698`) Ask's table is the only result table in the file without one. `[V]` **Respelled value**: plan 3's `{n} row(s)` — a parenthesised plural — is not this file's register; `preview.cap` writes plain `{items} items`. `[R]` |
| 9 | `ask.noRows` | `no rows matched` | `#qres` region | `ask.recallq` in the mockup is a whole disclosure titled "**Why a search can return nothing**", with `ask.recall1` and `ask.recall2` under it. `[V]` (`:965-978`) The mockup explains the empty result at length and never draws it. An explanation with no state to explain. `[R]` |
| 10 | `ask.truncated` | `capped at <span class="v" data-v="rows">200</span> rows — more matched; raise the limit to see them` | beside the caption | `ask.sqlCaption` — **already in the mockup** — says: "The final `LIMIT` binds one row more than the cap: **that extra row is the truncation signal, dropped before display**." `[V]` (`:943-946`) The mockup declares the mechanism and then shows nothing when it fires. That is the same defect `watch.voidn` was written to prevent, inverted. `[R]` |

### The provenance bar — two states it can reach and cannot say

`#prov` is described in the mockup as "**one home for the qualifications every screen owes**" and
already carries a `projection` part whose value is the literal `'fresh'`. `[V]` (`:1540`, `:2401-2415`)
Two facts about it, both measured: it is **global** (a sibling of `<footer>`, outside `<main>`, so it
is on Watch and Ask), and its *values* are **not** ternaried — only its labels are, so
`parent thread`, `off — a different question`, `not recorded before 1.0.1` and `fresh` all render in
English inside the Hebrew UI. `[V]`

| # | Key | Value | Reason |
|---|---|---|---|
| 11 | `prov.projCaughtUp` *(plan 3: `ask.projection.caughtUp`)* | `<span class="m v" data-v="state">behind</span> and caught up before answering` | The subject belongs to `#prov` — the mockup says so in the element's own comment `[V]` — not to a note line under one screen. Two homes for one qualification is the second-spelling defect this project has paid for repeatedly. `[R]` `{mv:state}` and not `{state}`: plan 3's §0 sweep of 2026-08-20 already ruled it, and its reason is the mockup's own — a `ProjectionState` literal is an untranslated Latin run in RTL prose. `[V]` |
| 12 | `prov.projFailed` *(plan 3: `ask.projection.failed`)* | `could not catch up — no partial answer is shown: <span class="v" data-v="error">…</span>` | Same carrier. The mockup's `#prov` can only ever say `fresh`, which is a claim it cannot always make. `[R]` |

---

## 2. DROP — 17 keys

### 2a. `watch.kind.*` — 4 keys. The design does not translate machine vocabulary.

`watch.kind.mutation`, `watch.kind.injection`, `watch.kind.hook`, `watch.kind.focus`.

Three independent places in the mockup render exactly these four words as **plain literal text with
no key**: `[V]`

- `#wfilters` has five buttons; only `all` is keyed (`watch.all`). `mutation`, `injection`, `hook`
  and `focus` are bare text with `data-k` attributes and no `data-t`. `[V]` (`:899-903`)
- The row's kind chip is `ch.textContent = kk` — the record's own kind literal. `[V]` (`:2193`)
- Ask's value select offers the same four as bare `<option>` text. `[V]` (`:927`)

And the mockup's i18n block states the policy that explains all three: a literal identifier, path,
flag or command is "**product vocabulary. Not data. Unchanged.**" `[V]` (`:1616-1618`)

**A second, harder reason.** `AUDIT_KINDS` in `src/core/audit.ts:245` has **six** members —
`mutation, injection, hook, focus, access, progress`. `[V]` Plan 3's family declares four, and plan 3's
own Task 11 renders it as `` t(`watch.kind.${d.kind}`) `` (`:3403`) `[V]` against a `t()` that
**throws on a missing key** (plan 3's own Interfaces line, `:2759`). `[V]` So an `access` or `progress`
record blanks the Watch screen. A closed machine vocabulary that is keyed must track its enum by
hand forever; rendered as a literal it tracks itself. `[R]`

### 2b. `ask.field.*` — 8 of 15 keys, on the same ground.

`ask.field.kind`, `.op`, `.origin`, `.item` — the mockup draws exactly these four as `<option>`
elements of `#qf`, unkeyed, and labels the control `ask.field` ("Field"). `[V]` (`:925`) Same policy
as 2a. `[R]`

`ask.field.session`, `.since`, `.until`, `.limit` — real server filters the mockup's field list does
not offer. `[V]` The mockup's `#qf` **is** the design's field list, and §0 of plan 3 states the class
itself: "**A panel the design does not draw is a panel that is not built, however defensible it is on
its own terms.**" `[V]` (`:106`) A field is a smaller panel. `[R]` For `.limit` specifically: the
mockup's cap is disclosed in prose (`ask.sqlCaption`, and ADOPT #10) rather than typed by the user.
`[V]`

`ask.field.any` — `(any)`. Prose, and it would need translating — but the mockup's three selects have
no empty option; every field always carries a value. `[V]` (`:925-927`) A label for a control state
the design does not have. **Returns automatically if the corpus tab is adopted** (see §4). `[R]`

### 2c. `watch.spills.*` — 3 of 5 keys.

`watch.spills.title`, `watch.spills.window`, `watch.spills.none`.

- Plan 3's own §0: "**The mockup's Audit stream has neither a spills pane nor a volume chart.**" `[V]`
  (`:108`) Re-verified today: the Watch section is one card — pulse, five filters, table, `#alive`,
  `watch.voidn`. `[V]`
- Plan 3's own open question 2 carries the standing instruction: "**build the endpoint and render no
  spills pane.**" `[V]` (`:144`)
- **Nothing is lost.** The mockup renders spills in five places already: the injection preview's ghost
  lane `[V]` (`:729`), the simulator's diverging ratio bar `sim.ratio` "Selected, then not delivered"
  `[V]` (`:857`), the decay heatstrip `dec.heat` "90-day delivery, per item — delivered against
  spilled" `[V]` (`:1049`), the item pane's twelve-week sparkline `pane.histn` `[V]` (`:1527`), and
  the Watch row's own text (ADOPT #5). `[R]`

`watch.spills.title` is the closest call of the three: `Spills — selected, and did not fit the budget`
against the mockup's `sim.ratio`, `Selected, then not delivered`. Same sentence, different screen. It
is dropped rather than folded because the two are different renderings on different screens and
folding would put the simulator's heading on a pane that does not exist. `[R]`

### 2d. `ask.filters` — 1 key.

`Filters`. **Plan 3 declares it and never calls it.** `[V]` — `grep "t('ask.filters')"` across the
whole plan returns nothing; Task 12 builds `el('form', 'ask-filters')`, a CSS class. The mockup labels
the *field* (`ask.field`), not the group. `[V]` A key with no call site in the document that declares
it is the definition of an invented key. `[R]`

*Worth recording, not adopting:* the mockup gives Watch's filter row a group label
(`role="group" data-t-aria="aria.wfilters"`) and gives Ask's filter row neither. `[V]` If the owner
wants that symmetry it is an `aria.` key on a `role="group"`, mirroring `aria.wfilters` — not a
visible "Filters" heading the design never draws. `[R]`

### 2e. `watch.spills.top` is **not** here — see FOLD #5.

---

## 3. FOLD — 10 keys

| # | Plan 3 spells it | The mockup spells it | Mapping evidence |
|---|---|---|---|
| 1 | `nav.watch` — `Watch` | **`s.watch`** — `Audit stream` | The rail's `nav.*` namespace is **group headings** (`nav.inj`, `nav.ev`, `nav.ch`, `nav.read`); screen entries are `s.*`. `[V]` (`:637-667`) `nav.watch` would put a screen entry inside the group namespace. Plan 3's own §0 already ruled the structure: "**The rail is four groups by tense, fixed** … `watch` and `ask` are the first two entries of `nav.ev`." `[V]` (`:111`) Wording of record is the mockup's: **Audit stream**, not Watch. `[R]` |
| 2 | `nav.ask` — `Ask` | **`s.ask`** — `Ask` | Same. Wording identical; only the key moves. `[V]` |
| 3 | `watch.title` — `Watch` | **`watch.h`** — `Audit stream` | Every screen in the mockup heads itself `<h2 data-t="<ns>.h">`. `[V]` Plan 3's Task 11 puts `t('watch.title')` in exactly that element (`el('h1', null, t('watch.title'))`, `:3262`). `[V]` Same element, two spellings. |
| 4 | `ask.title` — `Ask` | **`ask.h`** — `Ask` | Same, and the wording agrees. `[V]` |
| 5 | `watch.spills.top` — `Most-spilled items` | **`ask.predefined.spilled`** — `Most-spilled items` | **Byte-identical English**, and the mockup's Hebrew is already written: `הפריטים שנשפכו הכי הרבה`. `[V]` (mockup `:937`, `:1907`; plan `:2811`) The mockup's home for "most-spilled items" is a canned query button on Ask, not a heading on a pane it does not draw. `[R]` |
| 6 | `watch.spills.why` | **`watch.v`** — `the only record of what spilled` | Plan 3's value: "This is the **only record** of why an item was not shown. The ledger records deliveries; a spill is recorded here and nowhere else." The mockup compresses the same claim into the screen's verdict chip. `[V]` (`:888`) Nothing is lost; one sentence is shorter. **Merge candidate**: plan 3's second clause names *why* — the ledger records deliveries only — and the mockup's verdict does not. If the owner wants that clause kept it belongs in `watch.sub`, not in a new key. `[R]` |
| 7 | `watch.stream` — `Live audit stream` | **`watch.h`** — `Audit stream` | Plan 3 renders it as an `<h2>` above the record list (`:3390`) `[V]`, on a screen whose `<h1>` already reads *Audit stream*. Two headings for one thing. The mockup's Watch card has no sub-heading between the filters and the table. `[V]` |
| 8 | `watch.streamEnded` | **`ex.msg`** + **`ex.ok`** | The mockup answers server-exit **globally**, not per screen: `#exited`, a `role="alert"` banner — "The server has exited. This page shows what it last knew." + `<code>mycontext ui</code>` + an OK button — fired by a heartbeat timeout. `[V]` (`:1587-1590`, `:2463`) It even carries the same `mycontext ui` remedy plan 3's sentence does. `[R]` **Merge candidate**: plan 3's clause "this page never reconnects on its own" is a real disclosure `ex.msg` does not make; if it is wanted, it belongs inside `ex.msg`. `[R]` |
| 9 | `watch.volume.title` — `Records, last {minutes}m` | **`watch.pulsen`** | Plan 3's own comment on the key says it: "**The mockup's own caption for the same series is `watch.pulsen`**". `[V]` (`:2818-2821`) `watch.pulsen` already carries the whole content — "one column per ten seconds… **Height is records in that column**, colour is the record kind". `[V]` And plan 3's Task 11 concedes its own drawing is "**a weaker drawing than `#pulse`, in the wrong place, and the instruction forbids shipping a weaker version of what the mockup draws — so it is an interim, not the target.**" `[V]` (`:3183`) A key for an interim is a key for something nobody intends to ship. `[R]` The mockup's footer has no volume series at all; its nearest figure is `strip.inj`, "injections today". `[V]` |
| 10 | `ask.projection.fresh` | **`#prov`'s `projection / fresh` part** | The mockup already renders this exact qualification, on every screen, in the bar whose comment reads "one home for the qualifications every screen owes". `[V]` (`:2401-2415`) It has no key today, so the fold lands on an unkeyed element — proposed spelling **`prov.projFresh`**, `the audit projection was already current`, paired with ADOPT #11 and #12. `[R]` |

---

## 4. UNDECIDED — 9 keys, one question

`ask.tab.corpus`, `ask.tab.audit`, `ask.updatedAtTrap`, `ask.field.type`, `.status`, `.layer`,
`.always`, `.scoped`, `.title`.

All nine hang on a single question: **does the Ask screen query the corpus, or only the audit
history?** I cannot settle it from these two documents, and the two documents point opposite ways.

**For "audit only" (drop all nine):** `[V]`

- The mockup's Ask has no tab strip. Its filter row is `kind / op / origin / item`, all audit fields;
  its result table is `At · Item · Role`; its SQL pane reads `SELECT * FROM audit`.
- The rail's 21 screens include no corpus browse or search screen anywhere.
- `ask.updatedAtTrap` is a property of the **corpus** query (plan 3 design decision 9 cites
  `query.ts:46-49`), not of the audit projection — so on an audit-only screen it has no subject at all.

**For "corpus too" (adopt all nine):** `[V]`

- The mockup's Ask carries `ask.recallq` — "**Why a search can return nothing**" — and under it
  `ask.recall1`, which is entirely about the **corpus**: `search "silently drop"` finding nothing
  "while the corpus says 'dropped silently'", scoped to "`search` and `query_items` only", citing
  `core/search.ts`. `[V]` (`:965-978`) That is a disclosure about corpus search recall, sitting on a
  screen that cannot search the corpus. Either the screen is missing half its job, or the disclosure
  is on the wrong screen.
- Plan 3 Task 7 builds `corpusSelect` and the corpus half of `/api/ask` — the server side already
  exists in the design. `[V]`

**What would settle it:** one sentence from the owner on whether `ask.recall1` describes something the
Ask screen does, or something the CLI does that the Ask screen merely warns about. `[R]` If the first,
the nine adopt as a family and `ask.field.any` (DROP 2b) returns with them, because a multi-field
optional form needs an empty option. If the second, all nine drop and `ask.recallq`/`ask.recall1`
should probably move to the Docs screen.

---

## 5. The other direction — 19 keys, and 7 sentences with no key at all

The set difference has two sides, and this side has not been counted before.

### 5a. Mockup keys on these two screens that plan 3 does not know about — 19 `[V]`

`s.watch`, `s.ask`, `watch.h`, `watch.v`, `watch.sub`, `watch.all`, `watch.pulsen`, `watch.voidn`,
`ask.h`, `ask.v`, `ask.sub`, `ask.field`, `ask.sqlh`, `ask.sqln`, `ask.whyq`, `ask.why`,
`ask.recallq`, `ask.recall1`, `ask.recall2`.

Plan 3's open question 5 names **seven** of these (`watch.pulsen`, `watch.voidn`, `ask.whyq`,
`ask.why`, `ask.recallq`, `ask.recall1`, `ask.recall2`) as "strings this task currently drops". `[V]`
(`:174-179`) It does **not** name the other twelve — the screen headings, verdicts, subtitles, the
`Field` label, the rail entries, the `All` filter, or the two SQL-pane keys the owner added on
2026-08-20. `[R]` Twelve of the nineteen are therefore invisible to plan 3 in both directions today.

*Also on the strip, outside these two screens but inside plan 3's Task 9 claim:* the mockup carries
`strip.unknownTip` (a **seventh** git state — "the local tip could not be read"), `strip.items`,
`strip.inj`, `strip.append`, `strip.meas`, `strip.rt`. `[V]` Plan 3 declares six git states; the
mockup draws seven. `[V]` That belongs to open question 4 (who owns the footer), not to this task.

### 5b. Sentences the mockup renders with no key at all — the ternary residue `[V]`

Every one is invisible to the parity test, uncarriable by either string table, and unavailable to the
shipped screens. Listed because "nothing important is to be lost" cuts this way too.

| Where | English | Hebrew |
|---|---|---|
| `#alive` (`:2216`) | `{n} records shown` | present |
| regime row (`:2182`) | `regime change · ` | present |
| token bar note (`:2207-2210`) | `{n} estimated tokens, computed at injection time` | present → ADOPT #6 |
| void note (`:2199-2202`) | `tokens: not recorded — this record predates the field. Not zero.` | present → ADOPT #7 |
| void `title` (`:2198`) | `tokens not recorded` | **none — hard English** |
| pulse `aria-label` (`:2904`) | `Activity pulse, one column per ten seconds, newest at the reading-end edge` | present |
| `#prov` values (`:2405-2408`) | `parent thread`, `off — a different question`, `not recorded before 1.0.1`, `fresh` | **none — hard English, inside a bar that is on every screen** |

The `#prov` row is the sharpest: only the *labels* are ternaried, so four English values render inside
the Hebrew UI on every screen in the product. `[V]` It is the same bug the mockup's `#ctx` comment says
was already fixed once. `[R]`

---

## 6. What each recommendation trips

### `test/ui/strings-parity.test.ts` — derived, never pinned `[V]`

Its count is derived, so **no recommendation here fails it for a count**. What it does enforce, in
both directions, is that `en.js`'s key set equals the mockup's `data-t*` set exactly. `[V]` Today all
three files sit at 370 with zero difference either way. `[V]` Consequences:

- **Every ADOPT is a three-file commit.** Adding `watch.tokensNotRecorded` to the tables without
  adding a `data-t` element to the mockup fires *"in the string tables … not shown by the mockup —
  invent a screen, invent a string"*. Adding it to the mockup alone fires the *dropped* assertion.
  `[R]`
- **Every DROP is free** — those keys are in neither file today. `[V]`
- **Every FOLD is free in the same way**, except FOLD #10 (`prov.projFresh`), which is really an
  adoption because the mockup element it folds onto carries no key. `[R]`
- The two slot assertions bite on ADOPT #11: `{mv:state}` must be `{mv:state}` in **both** tables, and
  `valueSlots()` compares whole markers, so a Hebrew `{state}` against an English `{mv:state}` fails.
  `[V]`

### `e2e/` — three pinned counts, and my recommendations move all three `[V]`

| Pin | Value | Moved by |
|---|---|---|
| `bidi.spec.ts:103` — `[data-t]` elements | **382** | **Every ADOPT.** 12 adoptions + `watch.shown` + `title.tokensNotRecorded` ≈ **396-398**, depending on how many states share one element. `[R]` |
| `bidi.spec.ts:58` — `.m` monospace literals in English | **221** | **ADOPT #11 only**, which adds a `<span class="m v" data-v="state">`. → **222**. `[R]` |
| `language.spec.ts:150` — `data-t-aria` keys | **11** | **Not by any of the 48.** Moved only by §5b's pulse `aria-label`, if the owner wants it keyed. → **12**. `[R]` |

A fourth pin, `language.spec.ts:119` (12 `PROPOSED` badges), is untouched by everything here. `[V]`

These pins are the failure the parity test's own header warns about: *"a test that remembers a number
fails for the wrong reason the next time a screen gains a label."* `[V]` Three e2e specs remember
numbers and will fire on a change that is entirely correct. **Whoever lands the adoptions should
derive these three the way the parity test derives its own**, in the same commit — otherwise the next
person reads three red specs as evidence the adoption was wrong. `[R]`

### `AUDIT_OPS` — yes, this reconciliation touches the Ask view's vocabulary `[V]`

DROP 2b turns `op`, `kind` and `origin` into literal machine vocabulary rendered from an enum, and
`ask.predefined.ops` ("Operations by count") is a canned query over the same enum. So the hand-copied
list matters here.

Measured today against `src/core/audit.ts`: the real `AUDIT_OPS` is
`MUTATION_OPS + INJECTION_OPS + HOOK_OPS + FOCUS_OPS + ACCESS_OPS + PROGRESS_OPS` = **25 ops**. `[V]`
Plan 3's mockup block at `:3581` hand-copies **19**. `[V]` It is short **six**:

`subagent-start`, `post-tool-use-failure`, `ui-refused`, `step-done`, `step-undone`, `step-reset` `[V]`

The brief's "six" is right, and the two beyond the four it names (`subagent-start`,
`post-tool-use-failure`) are drift in `MUTATION_OPS`/`HOOK_OPS` that nobody has caught yet. `[R]`

`AUDIT_KINDS` has the same shape of problem one level up: the source declares **six** kinds
(`mutation, injection, hook, focus, access, progress`) `[V]` and the **mockup's own `#wfilters` draws
four** `[V]`. So this is not only plan 3's defect — the design of record is short two filter buttons,
and that is a mockup question, not a string-key question. `[R]`

**Recommendation:** whoever implements Ask derives both lists from `AUDIT_OPS` and `AUDIT_KINDS` by
import, exactly as plan 3's Task 6 already does for the pulse's colours ("taken from the one
declaration rather than respelled", `:1652`) `[V]`, and deletes the literal array at `:3581`. `[R]`

### `src/ui/public/i18n.js` does not exist `[V]`

Confirmed: `src/ui/public/` contains only `strings/en.js` and `strings/he.js`. `[V]` Both table headers
and the parity test speak of `t()` "in i18n.js" and of `slotNode()`; the only implementation of either
is the mockup's inline script (`slotNode` at `:1935`, `slots`/`flat` at `:1943-1953`). `[V]` ui1 task 16
builds it. Nothing in this report depends on it existing — every verdict is about which keys exist —
but **ADOPT #11's `{mv:state}` is the first key in this reconciliation that a string-returning `t()`
would render wrong** (braces on screen, isolation flattened), so it is a useful canary for whoever
lands ui1 task 16. `[R]`

---

## 7. Summary

| Verdict | Count | Families |
|---|---|---|
| **ADOPT** | 12 | 3 stream states, 2 row summaries, 2 token notes, 3 Ask table states, 2 projection states |
| **DROP** | 17 | `watch.kind.*` (4), 8 of `ask.field.*`, 3 of `watch.spills.*`, `ask.filters`, `ask.field.any` |
| **FOLD** | 10 | `nav.*`→`s.*` (2), `*.title`→`*.h` (2), `watch.stream`→`watch.h`, `watch.streamEnded`→`ex.msg`, `watch.volume.title`→`watch.pulsen`, 2 of `watch.spills.*`, `ask.projection.fresh`→`#prov` |
| **UNDECIDED** | 9 | `ask.tab.*` and everything downstream of the corpus question |
| | **48** | |

Net effect on the mockup if the owner takes ADOPT and FOLD as written: **370 → roughly 384 keys**, no
key renamed, no key removed, and **three of the new keys already have their Hebrew written** inside
the mockup's own script (`watch.tokens`, `watch.tokensNotRecorded`, `watch.shown`) — the rest need
translating. `[V]`

Three keys are respelled rather than adopted verbatim — `watch.injected` → `watch.delivered`,
`watch.spilledCount` → `watch.spilled`, `ask.projection.*` → `prov.*` — each because the mockup
already has a settled word or a settled home for the subject, and none of the three is among the
fourteen the mockup's KEY NAMING block freezes "exactly as declared". `[V]`

---

## The one question for the owner

**Does the Ask screen query the corpus, or only the audit history?**

Nine of the forty-eight turn on it, and so does whether `ask.recallq` / `ask.recall1` — a disclosure
about *corpus search recall*, currently sitting on a screen whose every field, column and `SELECT` is
audit-shaped — is on the right screen at all. `[V]` Everything else in this report I can defend from
the two documents. This one I cannot: the mockup's controls say audit, and the mockup's prose says
corpus, and only you can say which of the two was the intention.
