# The Learn screen — definition, requirements, and the gap list

**Method.** `INSTR-a-screen-is-defined-from-every-document-that-mentions-it`, applied a second
time (the first was Tutorials, `reports/2026-09-05-tutorials-screen-definition.md`, read as the
template). Read: `docs/superpowers/specs/2026-08-16-web-ui-design.md` (§4 "Learn", its
2026-08-20 correction, and the inventory table), `docs/design/web-ui-mockup.html`
§`data-p="learn"` and its nav entry, `docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md`
Task 19, `reports/uiux/` in full — the sketches' own reports (`01-coverage.md`, `02-ia.md`,
`08-onboarding.md`), the adversarial rulings (`A1`–`A3`) and both requirements addenda — plus
`reports/2026-08-22-DOCS-REVIEW.md`, `reports/V2-HANDOVER.md`, `reports/CONTINUE-HERE.md`,
`reports/HANDOVER.md`, `reports/2026-09-05-walk-sweep.md`, `reports/2026-09-04-v2-0-in-out-cut.md`;
the corpus (`search "learn"`, 64 hits, plus `show` on the ones that named this screen); and
`git log -S learn -- docs/ src/` (121 commits). Verified live in `src/ui/public/screens/learn.js`,
`apiHelp`/`UI_HELP_TOPICS` in `src/ui/read-model.ts`, `HELP_TOPICS` in `src/core/teach.ts`, the
route table in `src/ui/server.ts`, and by driving the built screen in a browser with Playwright
against a server started on `--port 0` (never 58888), killed afterward. No production code
changed; no item state changed. The only write is this file.

**On the word "learn".** This corpus's `lesson` items (37) and `lesson` CLI command are a
different subsystem entirely — mistakes captured for review, not a screen — and none of the
findings below cite one. Everything cited is either the `Learn` nav destination
(`data-p="learn"`, `nav.read`) or the `mycontext help <topic>` command it wraps.

---

## 1. What the record says the screen is for

Unlike Tutorials, the record **does** state a purpose, in the design of record's own words:

> *"Rendering `mycontext help <topic>` in a browser is `mycontext help <topic>` in a browser. It
> passes §1's test only in the form specified here: every help topic cross-links to your own
> corpus. … That join — generated guidance against your actual corpus — is what a terminal
> cannot do, and it is the whole justification. Built without it, this screen is a documentation
> viewer and should be cut."*
> — `docs/superpowers/specs/2026-08-16-web-ui-design.md:1308-1316`

Restated on the mockup itself, at the screen: *"conditional pass — the corpus cross-links earn
it"* (`ln.v`) and *"The four help topics, each linked to the items in **this** corpus that
demonstrate it. That join is what a docs page cannot do"* (`ln.sub`,
`docs/design/web-ui-mockup.html:3742-3743`). So the definition is precise and sourced: **Learn
exists only as a joined view — `mycontext help <topic>`'s prose plus which items in *your*
corpus demonstrate that topic — and without the join it is redundant with the terminal and the
spec says to cut it.**

## 2. Requirements, each traced to its source

| # | Requirement (quoted) | Source |
|---|---|---|
| R1 | Four rows, one per help topic — *"`categories`, `scope`, `capture`, `workflow`"* | `docs/superpowers/specs/2026-08-16-web-ui-design.md:1324-1325`, mirrored in the mockup table |
| R2 | *"Two of the four rows carry a real item id beside the topic"* | spec:1325-1326 |
| R3 | The title is **`Learn`**, never "Help" | Task 19 header, `docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md:6392-6394`: *"The Learn screen's title is **Learn** (`ln.h`, `s.learn`), not 'Help'."* |
| R4 | *"`categories` topic shows how many items you have of each and which of your categories are empty"* | spec:1310-1311 |
| R5 | *"`scope` topic shows the items in this project that declare a scope and the ones that do not, with what that means under this project's `scopePolicy`"* | spec:1309-1310 |
| R6 | *"`capture` topic links to your most recent captures"* | spec:1311 |
| R7 | Where a topic's join carries no item id (`categories`, `workflow`), the row must not invent one — *"An id invented from a tally would be a claim … that nothing in the response makes"* | `TASK-learn-the-categories-row-cannot-draw-the-cross-link-its-own-verdict-is-conditional-on` (plan:walk seq:88) |
| R8 | Sits in `nav.read`, one third of the group an earlier document called "Learn" before the 2026-08-20 correction split it into `docs`/`tut`/`learn` | spec:113, 730-732, 743 |
| R9 | Every help topic id, wherever it renders, is machine text (`span.m`, `unicode-bidi:isolate`) — the mockup's own drawn shape for this screen, not `button.linkid` | `docs/design/web-ui-mockup.html:3746-3749` (drawn shape); reasoning in `src/ui/public/screens/learn.js:104-113` |

**Requirement not stated by the design of record, but stated elsewhere and contradicting it —
flagged, not resolved (see §5):**

| # | Requirement (quoted) | Source |
|---|---|---|
| R10 | *"Cut `Learn` as a destination; reach help from the term it explains"* — help should be an affordance on the confusing word itself (`?topic=scope` opening the item pane), not a rail screen at all | `reports/uiux/sketches/02-ia.html` §Cut, as ruled on in `reports/uiux/adversarial/A1-constraints.md` row 2.7 and `A2-honesty.md` §C, and specified concretely as **R4** in `reports/uiux/REQUIREMENTS-ADDENDUM.md:75-90`: *"It appears where the user must act, not in a separate destination."* |

Nothing in any plan besides Task 19 assigns work to this screen; the other eleven plan hits for
"learn" are the CLI's `learn`-adjacent vocabulary (`lesson`), unrelated design prose, or generic
English ("learned the hard way") — not requirements on this screen.

## 3. What is built today, driven in a browser

Started `mycontext ui --port 0 --no-open` (bound `127.0.0.1:9219`, never 58888), navigated to the
printed URL, then clicked **Learn** in the `nav.read` group.

- **Renders.** Heading "Learn", verdict badge `⚠️ conditional pass — the corpus cross-links earn
  it`, subtitle exactly as `ln.sub`. One card, one table, four rows: `categories`, `scope`,
  `capture`, `workflow` — **R1, R3 met.**
- **The join is real, not mocked.** `scope` showed *"how scope restricts ·
  DEC-focus-discloses-and-allows-rather-than-refusing-to-hide"*; `capture` showed *"what to
  write down, and when · REQ-the-two-readmes-are-the-base-of-a-documentation-system-that"` —
  both live ids from this project's own corpus, not the mockup's literal fixture ids
  (`INV-prices-are-integer-cents`, `CONST-zero-runtime-dependencies`). **R2, R5, R6 met.**
- **`categories` shows no id.** Cell reads only "which are normative" — confirmed in the DOM
  (`querySelectorAll('td')` — no `span.m` in that cell). **R7 met**: the row is honestly blank
  rather than carrying an invented id.
- **`workflow` shows no id either**, matching the mockup — never claimed one.
- **The two ids that do render are inert.** DOM inspection confirms both are plain
  `<span class="m">…</span>`, not `<button class="linkid m">`; clicking one produces no
  navigation, no pane, no console activity. **R9 met as drawn** — but see the gap below.
- **No console errors from the screen itself.** The only browser console error was an unrelated
  `favicon.ico` 404, present on every route.

## 4. The gap between them

**A gap the record itself already names and has not closed (R7's live half).** Confirmed live:
`categories` carries no cross-link while the mockup draws one there
(`CONST-zero-runtime-dependencies`, `docs/design/web-ui-mockup.html:3745`). `TASK-learn-the-categories-row-cannot-draw-the-cross-link-its-own-verdict-is-conditional-on`
(`plan:walk seq:88`, `state: todo`) already names this precisely and puts the fix in
`apiHelp`'s `categories` case (`/api/help/categories`'s `corpus` shape needs an exemplar item id,
with the selection rule written down) or, alternatively, in a correction to the mockup removing
the id it draws there. Neither has happened; the row is still exactly as todo as filed on
2026-08-29.

**A gap not named anywhere else in the record, found by cross-reading two files that shipped the
same day.** `src/ui/public/screens/learn.js`'s own header still says (unedited since
2026-08-23 15:50): *"the item detail pane … has not been built (`index.html` declares no
`aside#pane`, `app.js` registers no delegated click — the pane is one of the 'unowned' surfaces
its own header lists), so every `linkId` in this app is inert."* That was true when written. It
is not true now: `git log` shows `aa34358`, committed the same day at 18:21, titled *"ui: build
the item detail pane, so every linkid stops being inert,"* and `src/ui/public/app.js:862` today
reads *"Every `button.linkid` in this product **was** inert"* (past tense) — the pane exists in
`index.html:301`, and seven other screens (`ask`, `coverage`, `doctor`, `graph`, `injected`,
`preview`, `watch`) call `linkId()` and open it live. Verified in the browser this session:
clicking `scope`'s id on Learn opens nothing, while the same id anywhere else in the product
would open the pane. **Learn is now the one screen in the product where an item id is drawn but
inert, and the code comment that justified drawing it that way is stale by the two and a half
hours between its own last edit and the pane's build.** This is a fact about the running code,
not a request to change it — the mockup still draws `span.m` here, not `button.linkid`
(`docs/design/web-ui-mockup.html:3744-3745`), so the drawn shape is still correct against the
design of record. What is stale is only the *reason given* for it.

## 5. Contradictions between documents, named and not resolved

Applying `STD-the-precedence-order-when-four-sources-of-truth-disagree` (corpus/screens → plans
→ specs → first documents; later overrides earlier; screens are authority on fact, the corpus on
intent, and neither settles the other's question):

- **The uiux sketches rule the opposite of the design of record: `Learn` should not be a
  destination at all.** `reports/uiux/sketches/02-ia.html` (2026-08-19, per its own numbering,
  predating the 2026-08-20 spec correction) argues to *"cut `Learn` as a destination; reach help
  from the term it explains."* The adversarial pass that follows it does not simply overrule this
  — it **keeps the mechanism and drops the destination as a compromise**: *"Give up the cut of
  `Learn`. Keep 02's mechanism as R4 and add a Docs destination"* (`reports/uiux/adversarial/A1-constraints.md`
  row 8) and *"02's cut of `Learn` as a rail entry stands"* under the term-anchored design
  (`reports/uiux/adversarial/A2-honesty.md:798-807`). **`REQUIREMENTS-ADDENDUM.md`'s R4** then
  specifies this as an owner-delegated requirement: help *"appears where the user must act, not
  in a separate destination."** None of this reached the 2026-08-20 spec correction or the
  mockup — both keep `learn` as a `nav.read` rail entry with its own screen, and the shipped code
  matches the mockup, not the sketches. Under the precedence order, **the corpus and the running
  screens are authority on fact — Learn exists as a destination today, and that is not in
  dispute** — but the sketches and the requirements addendum are a *later, more specific* owner
  instruction about intent (`REF-the-uiux-sketches-…`: *"never been consulted by anyone working
  on the UI"* until 2026-08-28) that the spec correction never addressed. This is the
  contradiction the precedence rule says to name rather than resolve: **is `Learn`-as-destination
  still the standing design, or was it superseded by R4 and never carried through?** Nothing in
  the record after 2026-08-28 answers this either way.
- **Task 19's claiming item is `state: done` (`verified_on: 2026-09-05`) while a task the design
  of record's own condition depends on is `state: todo`.** `TASK-ui1-task-19-doctor-decay-status-and-learn-screens`
  tracks only that the plan section landed; `TASK-learn-the-categories-row-cannot-draw-the-cross-link-its-own-verdict-is-conditional-on`
  (walk/88) says the screen's *own stated condition* — the join, per row — is only 2/4 rows
  strictly demonstrated with a cross-link and the mockup draws 3/4 wanting one, filed 2026-08-29,
  never closed. Read together this is the same pattern the Tutorials report found: a claiming
  task marked done measures the plan section landed, not the screen's own named condition met.
- **The mockup is not in the four-source precedence list** (it governs presentation, separately)
  — cited here only for what it draws (`span.m`, the id it puts on the `categories` row), not as
  a vote on the destination-vs-affordance question above.

## 6. What the owner would need to supply

The record states a purpose and requirements for the screen as built (§1–§2); it does not
resolve one live disagreement inside itself. Concretely:

1. **Is `Learn` still meant to be a destination screen, or was R4 (term-anchored help, no
   separate destination) meant to replace it?** The uiux sketches and the requirements addendum
   argue the latter; the 2026-08-20 spec correction and the shipped mockup still say the former,
   and nothing dated after 2026-08-28 (when the sketches were first read) rules between them.
2. **On the `categories` row: should `/api/help/categories` gain a documented rule for choosing
   an exemplar item id** (closing walk/88 the way it proposes), **or should the mockup be
   corrected to stop drawing one there** (accepting the condition is met by 2/4 rows, not 3/4)?
   Both are named as live options in the corpus; neither has been chosen.
3. **Now that the item detail pane exists and works everywhere else, should Learn's two ids stay
   inert `span.m` (matching the mockup as drawn) or become `button.linkid` like the other seven
   screens** — a question the screen's own code comment already flags as "worth re-asking with
   the owner," on the mockup, which is where the change would have to start?
