# The consolidated findings — six reviews, one table

**2026-09-13 · every finding from the six reviews of 2026-09-12 and 2026-09-13,
deduplicated, ranked, and marked for where the evidence actually comes from.**

I wrote this file and nothing else. No source, no test, no corpus item, no D
number was minted, no git command that writes was run, no server was touched
and no browser was driven. Where a row says **fixed** I checked it against
`git log` and the corpus item, not against the report's own claim.

## The six reports, and how they are cited below

| # | Report | Its own counts |
|---|---|---|
| **1** | `reports/2026-09-12-the-ui-reviewed-as-a-user.md` | 34 — 0 blocker / 12 major / 19 minor / 3 polish |
| **2** | `reports/2026-09-13-the-ui-reviewed-round-two.md` | 29 — 1 blocker / 12 major / 12 minor / 4 polish |
| **3** | `reports/2026-09-12-silent-failures-reviewed.md` | 56 — 11 blocker / 24 major / 21 minor |
| **4** | `reports/2026-09-13-type-design-reviewed.md` | 14 — 3 critical / 5 high / 6 medium |
| **5** | `reports/2026-09-13-what-could-be-removed-or-done-differently.md` | no scale — 5 first, 3 dead functions, 7 simplify, 2 missing, 15 stay |
| **6** | `reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md` | 27 — 8 high / 12 medium / 7 low |

**Raised by is bold when more than one report found it.** Two independent
reviews landing on one defect is the strongest evidence in this document, and
there are twenty-five such rows.

## How I mapped six severity scales onto one

Reports 1 and 2 use *blocker · major · minor · polish*; report 3 uses
*blocker · major · minor*; report 4 uses *critical · high · medium*; report 6
uses *HIGH · MEDIUM · LOW*; report 5 uses none. The consolidated scale, and the
test each level had to pass:

| Level | Test | Mapped from |
|---|---|---|
| **blocker** | a person or an agent cannot finish the job, or data is destroyed with no route back | 1/2 `blocker`; 3 `blocker` where a user is stopped or a record is lost |
| **critical** | the product ships a wrong answer into a stranger's install, or a gate that exists to stop something has stopped firing | 3 `blocker` where nothing is lost but a gate is open (B4, B10, B11); 4 `critical`; 6 `HIGH` that survives outside this repository |
| **major** | the job completes slower or wrongly, or a disclosure that should exist does not | 1/2 `major`; 3 `major`; 4 `high`; 6 `HIGH` that is local to this repository |
| **medium** | a real defect with a bounded blast radius or a workaround | 4 `medium`; 6 `MEDIUM`; 3 `major` that is one site with a named mitigation |
| **minor** | friction, or an inconsistency the reader must work around | 1/2 `minor`; 3 `minor`; 6 `LOW` |
| **polish** | cosmetic | 1/2 `polish` |

Two deliberate re-levellings, both from report 2's re-measurement, and both
shown as contradictions in the table rather than resolved: report 1's
*"629 controls under 24 px"* **major** becomes **polish** on report 2's count of
three genuinely non-compliant controls, and report 1's Hebrew currency defect
becomes **refuted**.

## What "state" means

- **fixed** — verified in `git log` and in the corpus item, not taken from the report.
- **proposed** — a defect with a stated fix and no decision outstanding.
- **needs a ruling** — the fix cannot be chosen without the owner.
- **inferred — reproduce first** — the code path was read, the *trigger* was not
  reproduced. Report 3 states this of its Windows transient-error cases (B2, B5,
  B6, M15, M16), which are inferred from this repository's own measured `EPERM`
  on `rename`, and of the banner-silencing sequence (B8), which it says *"deserves
  a Playwright reproduction before it is filed"*. Report 2 states it of its own
  Lighthouse 100, earned with **24 of 76 audits actually running**. Nothing in
  this class is promoted on the strength of a report alone.
- **refuted by *n*** — a later report measured the same thing and got a different
  answer. Both measurements are in the row. I did not pick a winner.

---

# The table

| # | surface | finding | severity | size | raised by | state | proposed D |
|---|---|---|---|---|---|---|---|
| 1 | core | A trailing comma in `config.json` returns an empty `Injection` from six delivery paths, so every session starts with zero project knowledge — while the *recording* paths deliberately avoid the same throw, so the audit log keeps writing healthy rows that exonerate it (B1) | blocker | hours | 3 | proposed | widen **D46** |
| 2 | CLI | `statusline install` reads `settings.json` through a catch that covers every errno, so an unreadable file becomes `{}` and the install writes a two-key settings file over the user's permissions, hooks, env and MCP servers — saving `previousText: null`, which defeats its own uninstall (B2) | blocker | hours | 3 | inferred — reproduce first | new — *a failure the code never looks at* |
| 3 | core | Declining a review draft deletes the draft and the item even when `recordDecline` could not write the ledger — it returns `void`, so the failure is unobservable — and the audit note then asserts the claim is recorded (B3) | blocker | hours | 3 | proposed | new — *a returned failure flag with no reader* |
| 4 | core · UI | **Two of the four retrieval modes can never succeed.** Report 2 drove *"I am lost"* and *"where were the fixed points?"* to a dead end that advises pasting text in a mode with no paste field, and `list-anchors` returns **0 points** beside **684 anchors**; report 5's orphan sweep found `src/core/retrieval/subjects.ts` and `noise.ts` are imported **only by their own tests**, so `list-subjects` has nothing wired and every mission is composed without the measured noise filter. One defect, found at the screen and at the import graph, by two reviews that could not see each other. The parent item lists both files under **DONE** | blocker | a day | **2, 5** | needs a ruling | widen **D42** |
| 5 | UI | The browser shell ends `main()` with no `.catch` and reads `localStorage` unguarded — both defences exist in `lane.js` and `doc.js`, each saying it follows *"the same rule the shell follows"*. With site data blocked the app never boots and reads as a dead server; and pasting the URL while the server is still binding leaves the spent nonce in the address bar (B7) | blocker | hours | 3 | proposed | new — *a failure the code never looks at* |
| 6 | UI | One failed request calls `stopHeartbeat()`, which is re-armed by nothing — then the next 200 hides the banner that explained it, so the page looks healthy with no staleness detection, no drift chip and no occupancy for the rest of its life (B8) | blocker | hours | 3 | inferred — reproduce first | new — *a failure the code never looks at* |
| 7 | MCP | `status_report` filters out every *"I could not measure this"* disclosure and then prints `health: 0 error(s), 0 warning(s), 0 note(s)` — the MCP `doctor` tool makes the same split and prints them; `status_report` never computes them. The doctor saying healthy because it could not look, on the surface an agent uses most (B10) | blocker | hours | 3 | proposed | widen **D46** |
| 8 | store | One `readdir` failure in `auditSegments` returns `[]`, which `projectionState` reads as *diverged*, which makes `syncProjection` `DELETE` the whole projection and re-project from the empty list — `mycontext audit` then reports no records for a workspace holding 45,440 (B6) | blocker | hours | 3 | inferred — reproduce first | widen **D52** |
| 9 | core | An unreadable `items/` subdirectory removes a whole corpus layer with zero `LoadError`s — a broken *symlink* in the same function *is* reported, with a docstring saying *"never skipped in silence"* (B5) | blocker | hours | 3 | inferred — reproduce first | new — *a failure the code never looks at* |
| 10 | CLI | The CLI cannot observe a failed write to stdout at all — one `console.log`, `ignoreErrors: true`, no `EPIPE` handler, no `unhandledRejection` — so `doctor --json > report.json` truncates and exits 0 (B9) | blocker | hours | 3 | proposed | new — *a failure the code never looks at* |
| 11 | tests | `test/ui/icon-sprite.test.ts` has never been able to fail: its regex matches neither of the two `href="#i-` strings in the file it scans, so `used` is `[]` and the assertion is `deepEqual([], [])` — while the real consumers, `index.html` and `parts.js:595`, are unscanned (B11) | blocker | hours | 3 | proposed | new — *a gate that is not a gate* |
| 12 | types · core | **`parseItem` cast `status`/`severity`/`origin` out of frontmatter, so a typo made `GOVERNING_STATUS[status]` answer `undefined` and five gates failed open together.** Found independently at the read boundary (4 §1) and as a silent failure (3 B4). **Landed** at `rulings/69`: `readEnum` + `ENUM_READ`, a pack refusal and a doctor finding. **But the fallback did not re-close the gates** — a laundered local status reads `draft`, `GOVERNING_STATUS.draft` is `false`, and `governsNormatively` still answers false. What closes them against foreign input is the pack refusal; on a corrupt local file the supersede preflight, the guarded-field refusal, `mutate`'s status gate, the contradiction gate and the pack-collision judgement are **still open**. The item is `state: todo` | critical | hours | **3, 4** | fixed — *gates still open, needs a ruling* | **D64** |
| 13 | store | Every consumer install is handed `STD-the-precedence-order-when-four-sources-of-truth-disagree` inside the `PRECEDENCE` paragraph — the block this product says outranks every other source — and that item exists only in this repository. Store v5 was published to fix exactly this class and fixed it on `movedFrom`, three lines below (S1) | critical | hours | 6 | proposed | widen **D6** |
| 14 | store | A Markdown file dropped into `src/rules/entries/` is delivered as a governing constant at every door and no door ever asks the manifest — proved in a scratch copy: `verifyManifest` reports `evil.md` as `unexpected`, `loadRules` delivers it. Nothing runs `rules verify`: not a hook, not a door, not `doctor`, not CI (S2) | critical | hours | 6 | proposed | widen **D41** |
| 15 | gates · core | **The unlisted input takes the benign branch — found by three reviews as one class.** Report 3 named it as pattern P4 with six members; report 4 showed the compiler was ready and a cast walked past it, plus `INVERSE_RELATIONS` failing open on a *write* gate; report 6 found eleven more sites, including `check-text-files.ts` skipping `.tsx`/`.jsonl`/`.svg` and every root file, `check-retired.ts` skipping `reports/` and `README.md`, and `scopePolicyFor` handing an undeclared category the permissive default. The rule the reports converge on: **a scanner enumerates what it will skip, not what it will scan** | critical | a day | **3, 4, 6** | proposed | widen **D64** |
| 16 | gates | Five gates are wired to nothing (`check:needs-cycles`, `check:handover`, `check:dependencies`, `check:cited-items`, and `verify:citations` in release only) and there is no pre-commit hook. `verify:citations` **exits 1 today**, so every tag cut fails at a gate no pull request runs; `check:dependencies` guards `CONST-zero-runtime-dependencies`, the headline promise, and runs in neither workflow (G1) | critical | hours | 6 | proposed | new — *a gate that is not a gate* |
| 17 | gates | `VERIFIED_ON_INTRODUCED_AT = '2026-09-03T12:00:00.000Z'` is this repository's own grandfather cutoff hard-coded into shipped product code, so in an install created today **every** closed task raises `task_unverified` from day one. Here it is 53 of 107 findings; there it is all of them (G3) | critical | hours | 6 | proposed | new — *doctor's findings earn their keep* |
| 18 | UI | **The seven-second cold load.** Report 1 measured 7,046 ms to a usable page and named `app.js` at **4,632 ms** and `styles.css` at **4,618 ms**. Report 2 measured 7,311 ms — *confirmed* — and `app.js` at **21 ms**, `styles.css` at **7 ms**: the stall is `/api/status` (3,829–4,669 ms) and `/api/doctor` (3,812–3,920 ms) on a single-threaded synchronous server, proved by a serial-versus-parallel test where parallel cost the same as serial (8,437 ms against a serial sum of 9,905 ms), and it **recurs on every call** rather than once per load | critical | more | **1, 2** | refuted by 2 — *cause only; the 7 s is confirmed* | new — *the read model blocks the whole server* |
| 19 | core | Outcome unions are the right shape and nothing forces a caller to handle a new member — adding one to `ClearOutcome` or `Upkeep` produces **zero** `tsc` errors; `actClause`'s bare `return ''` swallows a fifth `did`; `TurnAnchors`' `failed` state is report 3's M12, where the anchor pass reports the budget working and hides the defect. One `const _: never` in the whole tree, no `assertNever` (4 §5; 3 M12, M13) | critical | hours | **3, 4** | proposed | widen **D64** |
| 20 | UI | `/api/status`, `/api/doctor` and `/api/sessions` exhaust the browser's six-connection HTTP/1.1 pool, so `geist-mono-400.woff2` sat **5,748 ms before its request was even sent** — the "4.6 s font" report 1 found puzzling | major | hours | **1, 2** | proposed | new — *the read model blocks the whole server* |
| 21 | UI | **The footer overlaps itself and silently drops data below ~1,200 px.** Report 1: 32 overlapping pairs at 900×800, 13 leaf items pushed off-screen, `overflow:hidden` on the row and the body so there is no scrollbar. Report 2, independently: **38 pairs**, the same **13** casualties (`cwd`, `my-context`, `corpus`, `limits`, `5h`, `7d`), row `scrollWidth` 1,440 against `clientWidth` 876. Against `INV-nothing-is-dropped-silently` | major | hours | **1, 2** | proposed | new — *WCAG conformance measured, not assumed* |
| 22 | UI | WCAG 1.4.10 Reflow fails at 320 CSS px (400% zoom on a 1280 px display): the rail keeps **214 px of 320**, `<main>` gets **106 px**, **2,318 text elements** are pushed off the right edge and the page does not scroll horizontally. The entire responsive design is **three media queries**, all `grid-template-columns: 1fr`. Report 1 listed this unassessed and guessed it would fail | major | hours | 2 | proposed | new — *WCAG conformance measured, not assumed* |
| 23 | UI | **Keyboard operation.** No skip link; the first control inside `<main>` is tab stop 23 (report 1) / 24 of 77 (report 2); opening an item does not move focus into the pane, which is 49 tab stops away; **zero `h1`**; `document.title` is `mycontext Console` on all twenty screens. Confirmed unchanged between the two reviews | major | hours | **1, 2** | proposed | new — *WCAG conformance measured, not assumed* |
| 24 | UI | Every new write on Conversations throws focus to `document.body` — measured at every sample from 150 ms to 6 s — so a keyboard user walks 24 tab stops back after mark, after rename and after drop. The *opening* half of the same flows moves focus into a labelled input correctly | major | hours | 2 | proposed | new — *the screen confirms a write landed* |
| 25 | UI | **"Take it back" deletes an anchor immediately** — no confirm, no undo, no announcement — and the sweep's own copy says it never touches a hand-marked anchor, so that is the one class that cannot be recovered. 684 buttons with identical accessible names sit on the page. The app confirms an *Execute* with the best copy in the product and does not confirm this | major | hours | 2 | proposed | new — *the screen confirms a write landed* |
| 26 | UI | `.convmarksaid` is an `aria-live="polite"` element created at `conversations.js:1144` and **written to nowhere in the file** — a dead confirmation slot, confirmed empty in the browser after a successful write | major | hours | 2 | proposed | widen **D50** |
| 27 | UI | 684 anchors render unpaged — 11,996 DOM nodes, **92% of the document** — with no paging control, breaking the app's own bounded-list pattern; the filter costs **1,097–2,017 ms per keystroke** against Google's 200 ms "poor" threshold, and identical labels repeat nine times in the first twelve rows | major | a day | 2 | proposed | new — *the screen confirms a write landed* |
| 28 | UI | 684 rows × 3 controls all compute the same three accessible names — `Open the conversation at this point`, `Rename`, `Take it back` — with no `aria-label` naming *which* anchor | major | hours | 2 | proposed | new — *WCAG conformance measured, not assumed* |
| 29 | UI | **Every screen title carries an internal design verdict.** Nineteen of twenty-one screens open with `✅`, Status and Learn with `⚠️`; the glyph is a bare text node with **no `aria-hidden`** and **no string-table key**, so a screen reader announces *"white heavy check mark"* and a user reads a green tick beside a heading as a health claim. Report 2 adds the mechanism: `screenHead`'s `verdictChip` already exists and the question was already ruled on in 2026-08-26 — *"a real verdict chip is the `.chip` primitive with a meaning hue, not an emoji"* — and Status was migrated while nineteen were left on the default | major | hours | **1, 2** | needs a ruling | **D63** |
| 30 | UI | The Help screen shows 25 English document titles while claiming *"עברית: 24 מתוך 24 נכתבו, נמדד על הדיסק"*, every one right-aligned as RTL with `dir` attribute `null`. Unchanged between the two reviews and one row worse; this is the one element the 1,371 new `dir="auto"` attributes did not reach | major | hours | **1, 2** | proposed | widen **D47** |
| 31 | UI | Copy and Execute confirm into a 1×1 px screen-reader-only span and nothing a sighted user can see; `app.js:5118` calls the visible version *"chrome the owner has not approved"*. **Report 2 found the question already settled the other way**: the new Conversations code ships `conv.recall.copied` — *"Copied. Nothing has been sent anywhere"* — with a refusal path. The finding is now the inconsistency, not the permission | major | hours | **1, 2** | needs a ruling | widen **D50** |
| 32 | core · store | `deliverAtDoor` returns `recorded: boolean` and `delivered.ts:159` documents the contract in so many words — *"the caller discloses, this module does not"* — and **both doors end `}).text;`**. `grep -rn "\.recorded"` finds no consumer. With the rule store's log unwritable the rules *were* delivered and `assertDoor` later prints *"this session has no record of the product rule store being delivered to it"* (3 M2; 6 names it in *What I could not assess* and credits report 3) | major | hours | **3, 6** | proposed | new — *a returned failure flag with no reader* |
| 33 | core | `recordAudit` returns `{ written, error }` and **14 of 16 hook call sites discard it**. Three are load-bearing: `pre-tool-use:388`, whose neighbour justifies its own best-effort posture on *"the audit record above already holds the delivery durably"*; `recordDeny`, called *"the one hook action that CHANGES what a tool call does"*; and `subagent-start:271`, the whole mechanism by which *"a kill becomes evidence rather than silence"* (M1) | major | hours | 3 | proposed | widen **D52** |
| 34 | core | `bumpCounter`'s `written: false` is dropped at its only caller, so with `state/` unwritable every turn prints *"review: no pass — 0 of 25 tool call(s)"* — true of the file, and it reads as "not enough activity yet" when the truth is that the subsystem can never fire again (M3) | major | hours | 3 | proposed | new — *a returned failure flag with no reader* |
| 35 | core | `listStaging` throws away the skip list, against its own twenty-line docblock arguing that *"a status line reading 'three staged lessons' over a directory of five files was indistinguishable from a correct one"* — and both consumers call the lossy wrapper (M4) | major | hours | 3 | proposed | new — *a returned failure flag with no reader* |
| 36 | core | A measured zero standing in for an unmeasured thing, at nine sites: `drifted: false` over a subtree it could not read; a secrets scan reporting `indexed: true` for a session never read, on the one screen where being wrong has a cost outside the screen; `heRollup: {done:0,total:0}` for an unparseable manifest; two doctor checks reporting defects from a silently truncated walk; `sessionsRecorded: 0` for a ledger that would not open; `searchArchive` answering *"the archive does not contain this"* over an empty index (M5–M11). Against `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` | major | a day | 3 | proposed | widen **D46** |
| 37 | core | Failure states that exist in the type and are read by nothing: the anchor pass's `did: 'failed'` has no clause where `stood-down` does; `ConversationRefresh.anchors` is written, returned and **read by nothing in `src/` or `test/`**; `reviewTrigger`'s bug-caused `null` is indistinguishable from "review is switched off"; the handover ask is withheld at 99% occupancy when the latch will not write and nothing says so (M12–M14) | major | hours | 3 | proposed | new — *a returned failure flag with no reader* |
| 38 | core | One unreadable transcript directory empties the conversation index, the search index's `sourcesOf` and every retrieval pointer, and the Stop hook reports *"N indexed session(s) no longer on disk"* — a confident sentence with the wrong cause (M15) | major | hours | 3 | inferred — reproduce first | new — *a failure the code never looks at* |
| 39 | core | A transient read error permanently breaks a conversation mirror under a confidently false explanation: the archive row is rewritten `exported`, **the owner's standing persist mark is deleted**, and `REPLACED_NOTE` is set and is sticky — *"Already broken. It is not retried"* (M16) | major | hours | 3 | inferred — reproduce first | new — *a failure the code never looks at* |
| 40 | core | `readSnapshotMeta` collapses "unreadable" into "absent", and PostCompact then asserts the false version loudly — *"NO PreCompact snapshot for this session … whatever this window held is not coming back"* — sending the operator to their hook config instead of their disk; a malformed `itemIds` yields a *successful* read of an empty snapshot (M18) | major | hours | 3 | proposed | new — *a failure the code never looks at* |
| 41 | core | The PreCompact transcript arm reports the same number for "nothing cited", "could not read", and "read only the last 8 MB" — with a measured session transcript of **65,046,326 bytes**, the tail covers about 12%, and every id cited in the first 57 MB is dropped from the restore snapshot (M19) | major | hours | 3 | proposed | widen **D46** |
| 42 | UI | The anchor write routes answer `200 { indexed: false }` and **not one client call site reads it** — the relabel path reads only `tookOwnership`, so it draws **"Renamed"** for a rename that did not happen, which `conversations.js:1156` says is the thing it exists to forbid. The same module answers `200 { indexed: true, anchor: null }` when the row cannot be read back (M21) | major | hours | 3 | proposed | new — *the screen confirms a write landed* |
| 43 | store | `applyImport` throws mid-loop **after** overwriting `config.json` and creating an arbitrary prefix of the new items, and the refusal reads as though nothing happened; `writeImportRecord` never runs, so `pack list` does not show the pack and `review promote --all --pack` cannot reach the orphaned drafts (M22) | major | a day | 3 | proposed | widen **D41** |
| 44 | store | The rule-store refusal delivered into every model's context window at every door names `mycontext rules verify --restore` as the remedy — and that code path compares `entriesDir()` against `entriesDir()`, so the condition is **always false** and `restoreEntries` is unreachable (M23) | major | hours | 3 | proposed | widen **D45** |
| 45 | CLI | Two exit codes that say "done" for work that was not done: `ingest` returns 0 when **every** candidate was rejected, and `pack import` returns 0 on `overwriteBlocked` — *"item(s) that differ in a field no write path here can reach"* (M24) | major | hours | 3 | proposed | new — *the CLI answers a script honestly* |
| 46 | tests · gates | **Gates that cannot go red.** Report 3 found five with no positive control, each the only one of its siblings without one — `graph-screen`, `corpus-checksums`, `no-bare-rmsync`, `rules/isolation`, `open-readonly-checked` (M25). Report 6 found `sessions-pin.test.ts` scanning raw source with no `maskNonCode`, a single-quote-only import matcher and a literal substring pin, and `check:needs-cycles` with **no test anywhere and in neither workflow — the only gate with no evidence behind it at all** (G4, G6) | major | a day | **3, 6** | proposed | new — *a gate that is not a gate* |
| 47 | CLI | `<command> --help` exits **1 on all 38 commands that take flags** — the output *is* the correct usage block, printed behind `my_context: unknown option "--help"`. Bare `mycontext` exits 1 while `mycontext --help` exits 0 printing byte-identical output (C1) | major | hours | 6 | proposed | new — *the CLI answers a script honestly* |
| 48 | UI | The Glob tester's count line reads `1,558 / 1,558` and the list contains exactly **200** rows, with nothing saying the list is capped — while the sentence directly beneath argues the opposite case, and `palette.js:113` already records the defect in its own words. The clearest silent truncation in the app, and the only bounded list in the product that breaks the pattern the rest hold (2.3) | major | hours | 1 | proposed | widen **D46** |
| 49 | UI | Doctor is **20,180 px tall**, 1,883 nodes, 291 controls, with no filter, no sort, no search, no collapse and no in-page nav, while every other list in the app pages properly (2.8). Report 6's G3 supplies the other half of the cause: 53 of the 107 findings are `task_unverified` noise | major | a day | 1 | proposed | new — *doctor's findings earn their keep* |
| 50 | UI | The Watch table is `table-layout: auto` with no column sizing — Op gets 95 px and wraps `subagent-stop-untyped` onto three lines, making every row 71 px tall, so about seven rows fit where twenty would, on the one screen whose whole point is the feed (2.7) | major | hours | 1 | proposed | widen **D44** |
| 51 | UI | The loading state is the two words *"not read yet"* for as long as the data takes — measured at 796 ms, 345 ms, 272 ms, and ~7 s on first boot. A correct *state* label reading as a terminal condition (3.2) | major | hours | 1 | proposed | widen **D46** |
| 52 | UI | The Composer opens on `ack · write` because `ack` sorts first among thirty options, with `search` and `show` at positions 29 and 28; the Glob tester takes half the screen even when the selected command has no scope argument (2.2). Report 2 confirms the placeholder now exists — the select's first option is empty and nothing is preselected | major | hours | 1 | proposed | widen **D11** |
| 53 | store | 157 of 269 rows in `.my_context/.rules/delivered.jsonl` were written by the test suite into the owner's live workspace, and nothing anywhere reads the file — no CLI, no MCP, no doctor, no UI — so spec §8.2's *"a count instead of a promise"* is unreachable (S3a, S4). **Landed** at `rulings/71`: the recorder now forks a test-written row into a sibling file and the 157 legacy rows were moved rather than deleted. The ruling **answers two of report 6's claims as too strong**: the file *is* read, on nearly every matched tool call, by the assertion — what is missing is a *reporting* surface; and the `session-start` door has not failed — **the event has not happened** in this workspace since before the code landed | major | hours | 6 | fixed — *two claims corrected; the reporting surface is still proposed* | **D52** |
| 54 | UI | **Hebrew bidi: number-and-unit runs split across sibling spans in an RTL context**, so `6%` rendered `%6`, `42%` rendered `%42` — eight instances in the footer alone, the thing the owner glances at constantly — and corpus-authored English took the paragraph's direction, with `dir="auto"` appearing **zero** times in the whole document (1 §4). **Fixed the same day**: `dir="auto"` **0 to 1,371**, `unicode-bidi: isolate` **0 to 6,762**, split number-and-unit pairs **0**, neutral-edged unisolated runs **0**. Report 2: *"the hardest class of finding in round one and it was closed properly, with the mechanism round one recommended"* | major | hours | **1, 2** | fixed | widen **D8** |
| 55 | store | `MYCONTEXT_RULES_DIR` steers every door and is ignored by all three `mycontext rules` subcommands, so with it set the doors deliver directory X while `rules list` and `rules verify` answer about the package's — and `missedDoorLine` tells the reader to run exactly those two commands (S5) | medium | hours | 6 | proposed | widen **D41** |
| 56 | store | The store carries `version: 5`, a `publishedAt` and five changelog rows, and the only readers are inside `src/ui/maintenance/`, which `package.json` excludes from the published package — so in a real install nothing can answer *"which store version do I have"* (S6) | medium | hours | 6 | proposed | widen **D41** |
| 57 | CLI | Diagnostics and data share one stream: `console.log` is the only channel, so `mycontext show X --json > out.json` writes `my_context: no item with id "X".` into `out.json`, and three commands emit prose to stdout with exit 1 while `help cli` says `--json` is *"for a program to read"* (C4) | medium | hours | 6 | needs a ruling | new — *the CLI answers a script honestly* |
| 58 | CLI | 23 of 41 registered commands accept flags their banner never mentions (`audit` omits twelve, `restore` ten, `review` all of them); six advertise a subcommand-scoped flag at command level, so the banner promises something that is then refused (C3). `add` already solved this by deriving `ADD_FLAG_SUMMARY` from `ADD_USAGE` after the hand-kept copy drifted | medium | a day | 6 | proposed | widen **D51** |
| 59 | CLI | "Nothing found" exits 0 in six commands and 1 in three — a defensible split, broken twice: `rules list` exits 1 because a *file* was unreadable while the same damage to a corpus item is a warning at exit 0 in the same binary; and the contract is written down nowhere (C5) | medium | hours | 6 | proposed | new — *the CLI answers a script honestly* |
| 60 | CLI | `edit --distinct` and `edit --supersedes` — the two flags that answer the contradiction gate — are accepted, parsed and honoured, and appear in no `USAGE`, no banner and no `--help` (C2) | medium | hours | 6 | proposed | widen **D33** |
| 61 | MCP | No MCP path to the rule store, while `missedDoorLine` — text written *for a model* — instructs it to run `mycontext rules list` and `mycontext rules verify`. An agent whose Bash tool is denied can do neither. The largest CLI↔MCP gap that is not deliberate (M1) | medium | a day | 6 | proposed | new — *the MCP surface declares what it does* |
| 62 | MCP | No tool carries `annotations`, so a client cannot tell `get_item` from `supersede_item` without parsing English — in a product that has thought harder than most about which acts are approval-worthy and has made none of it machine-readable (M2) | medium | hours | 6 | proposed | new — *the MCP surface declares what it does* |
| 63 | MCP | A request with `id: null` gets no response, ever — `serveStdio` has no timeout and no `error` handler on either stream, so a client that spells its first id that way hangs. `initialize` and `server/discover` also advertise two different `capabilities.tools` (M4, m21) | medium | hours | **3, 6** | proposed | new — *the MCP surface declares what it does* |
| 64 | types | Fifteen-odd value lists that must be **total** over a closed union are typed `T[]`, which checks the wrong direction — `OUTCOMES` is the sharpest: a thirteenth `UpkeepOutcome` written by a new path but forgotten here compiles, writes correctly, and **degrades to `null` on the very next read-back**. `Covers<>` plus `as const satisfies` is two lines per site, ~18 sites, **zero call sites touched, zero behaviour change** (4 §2) | medium | hours | 4 | proposed | widen **D51** |
| 65 | types · CLI · doctor | **The same fact kept by hand in a second place.** Report 4's exhaustive lists (above); report 5's `FIELD_NAME` in `statusline-powerline.ts`, whose own docblock names the hazard and does not close it, and the `runChecks` registry, which the project has already paid for once; report 6's `CommandDef.usage`. The mechanism exists in the tree three times (`port-model.ts`, `read-model-config.ts`) and in a test that says outright *"a hand-kept list of field names inside a parity test IS the defect the test exists about"* | medium | a day | **4, 5, 6** | proposed | widen **D51** |
| 66 | doctor · types | `deletingTheGlob`'s `default:` branch carries a **third policy's real prose**, so a fourth `ScopePolicy` gets a confidently wrong sentence claiming the item is unrestricted and injects on every file. Found as a swallowing switch (4 §5) and as a failure message that is *"worse than no message"* (6 G6), at the same lines | medium | hours | **4, 6** | proposed | widen **D64** |
| 67 | doctor | When a doctor check throws, the finding says `a doctor check threw: <message>` with **no code, no check name and no item**, although the `checks[]` index is in scope — the one finding that means "a gate is broken" is the only one that cannot say which. Found twice at the same lines (3 M24-adjacent, 6 G3) | medium | hours | **3, 6** | proposed | new — *doctor's findings earn their keep* |
| 68 | CLI · store | A refusal that names no route, or names a dead one: five CLI misses against this repo's own `RULE-a-refusal-states-its-unblocking-condition` (6 C7), and the rule-store refusal whose advertised remedy is unreachable (3 M23). **Report 1 measured the opposite for the UI** — 401, budgets, Composer and the scope gate all name what would unblock them — and called the project's reputation for this defect *"out of date"* | medium | hours | **3, 6** *(refuted for the UI by 1)* | proposed | widen **D45** |
| 69 | doctor | Three more consumer-repo traps in `checks.ts`: `citation_form` enforces *this project's* `file · fragment` convention on a stranger's prose; `isServableDocPath` hard-codes `docs/` and `reports/`; `FIXTURE_DIRS` misses `__fixtures__`, `spec/` and `e2e/`, so a consumer's own fixture is reported as a nested corpus (G3) | medium | hours | 6 | proposed | new — *doctor's findings earn their keep* |
| 70 | gates | Five checks print red and exit 0 — `check:handover` (4 naming retired work, 7 carried instructions), `check:cited-items` (106 citations naming 23 retired items, 34 reading as a live ruling), `check:basis` (10 declarations naming a retired item), `check-ask-numbering`, `verify:citations` (57 corpus failures with no flag that gates them). Most have a sound written rationale; **report-only plus never-run equals not a gate** (G5) | medium | a day | 6 | proposed | new — *a gate that is not a gate* |
| 71 | types | Category-specific fields live in `Item.extra: Record<string,string>`, so `taskState(item: Item)` accepts **any** item and answers `''` for a `requirement` — indistinguishable from a task that declares `state` and has not set it. The same measured-zero-versus-unmeasured defect, in a signature. `isWorkCategory` already computes the proof and throws it away (4 §3). The live instance: D57 closed on the map because *"a requirement has no field to close on"* | medium | a day | 4 | proposed | new — *the invariant lives in the type* |
| 72 | types | `Item` has **zero `readonly` modifiers**, no factory and no freeze: `applyUpdate` mutates it field by field and `persist` re-stamps the checksum afterwards, so between those two points an `Item` with a stale checksum is a live, valid, fully-typed value. Ten invariants, ten comments, zero compiler guarantees (4 §4.1) | medium | a day | 4 | proposed | new — *the invariant lives in the type* |
| 73 | types | `HookInput` is one flat interface with ~25 optional fields spanning fifteen platform events, so `input.compact_summary` compiles on a `SessionStart` handler and yields `undefined`; `post-tool-use.ts` declares a **second, divergent `HookInput`** under the same name. The *output* envelope has a proper closed union with the argument written out (4 §4.5) | medium | a day | 4 | proposed | new — *the invariant lives in the type* |
| 74 | types | Two nonces (handoff, execution) are both `string`, so `redeem()` on either store accepts the other's token, on a surface whose own comment says *"the nonce is the credential"*; and four hash kinds are mutually assignable, where a mis-stamp is silent in both directions. Under 20 lines for the nonces (4 §4.3) | medium | hours | 4 | proposed | new — *the invariant lives in the type* |
| 75 | types | The unknown-category default is answered **three different ways** in three files — `tierOf` fails closed and argues why, `isNormative` answers false, `cli/index.ts:638` fails open to `rationale`, which is the exact default `trust.ts` argues against one file over (4 §4.2) | medium | hours | 4 | proposed | widen **D64** |
| 76 | types | Two seams carried a `string` across a fixed 1 MiB **byte** boundary, corrupting one Hebrew character per megabyte at the seam, where `conversation-index.ts:1526` carries a `Buffer` and is correct — *the type of one local variable was the entire difference* (4 §4). **Landed** at `rulings/70`, with a proof that puts a multi-byte character across the boundary | medium | hours | 4 | fixed | **D65** |
| 77 | types | Whether to brand `ByteOffset`/`RecordIndex` across the archive. Report 4 costed it at 60–120 lines and a day and **recommended deferring**; the item's own ruling says *"do not widen this into the general branding question"*. The cheaper alternative proposed with it — `forEachLine`, ~60 lines, four call sites — is also a proposal, not done | medium | a day | 4 | needs a ruling | **D65** |
| 78 | core | `src/ui/read-model.ts` (4,203 lines, the largest file in the repo) is ~20 independent `apiX` handlers with almost no shared state, in a directory that has already split **eight** siblings out by domain — and the test suite is already partitioned the way the source is not (5 §2) | medium | a day | 5 | proposed | new — *a module that grew by accretion* |
| 79 | doctor | `src/doctor/checks.ts` (4,631 lines, ~30–40 independent checks) splits along a boundary its own test suite has already drawn — **but add the `runChecks` registry guard first**, because a hand-kept array is exactly what loses an entry during a mechanical split, and this project has already paid for that once (5 §3) | medium | a day | 5 | proposed | new — *a module that grew by accretion* |
| 80 | store | Replaying the changelog from empty yields 11 entries against a store of 12: `numbered-options-on-a-question-put-to-the-owner` appears under `changed` in v1 and in no `added` list, ever (S7) | minor | hours | 6 | proposed | widen **D41** |
| 81 | store | `rules verify` reads only the manifest and `rules list` reads only the parser, and `writeManifest` deliberately gives a row to a file too broken to parse — so a store can be checksum-intact and unloadable while `verify` says *"intact"* (S8) | minor | hours | 6 | proposed | widen **D41** |
| 82 | store | The delivered block prints `` `id` · kind `` and omits the tier, while the developer-only `rules show` prints it — so the surface where the tier matters is the one that hides it (S9) | minor | hours | 6 | proposed | widen **D41** |
| 83 | MCP | `ERROR_UNSUPPORTED_VERSION` is unreachable through `initialize`, which reads `params.protocolVersion` rather than `params._meta` — observed answering `2026-07-28` to a request for `2099-01-01`. Spec-conformant, so the defect is the module header claiming the opposite branch is the unreachable one (M3) | minor | hours | 6 | proposed | new — *the MCP surface declares what it does* |
| 84 | MCP · core | `src/mcp/tools.ts` (2,728 lines) has ~26 tool specs with handlers inline, where `ingest_document` already had its logic pulled out to `src/mcp/tools/ingest.ts` and the other 25 did not follow; `src/core/handover-ask.ts` (2,050) bundles six distinguishable sub-arcs with no docblock arguing they must be one file (5 Simplify 3, 4) | minor | a day | 5 | proposed | new — *a module that grew by accretion* |
| 85 | docs · UI | Three separate prose claims that `src/ui/` binds no writer — `app.js`'s `post()` docblock, `security.ts`'s header, and `docs/capabilities/08-web-ui.md` — have each drifted behind `RULED_WRITES`, which currently holds **12 bindings across 5 files**. The exact defect `CLAUDE.md` opens with, except the copies restate a fact a test already enforces (5 §1) | minor | hours | 5 | proposed | widen **D51** |
| 86 | core | Three functions with no reference anywhere — `validateUpdatableValue` (whose docblock names two callers that do not call it), `summaryIsStale`, `anchorSubject` — plus six `export` keywords that expose nothing outside their own file (5 §4, Remove) | minor | hours | 5 | proposed | new — *a module that grew by accretion* |
| 87 | core | `supersede` has no inverse: no `unsupersede`, no `reopen`, no `core/mutate.ts` primitive, and **no recorded ruling either way** — where `retire.ts` is one-way by documented design, so the pattern exists on purpose elsewhere (5 §5) | minor | hours | 5 | needs a ruling | widen **D38** |
| 88 | UI | With no credential the bare URL draws the entire twenty-screen app fully empty — every panel "not read", "◌", "—" — around a 401 refusal report 1 calls *"a model refusal"*. The frame reads as "this tool is broken" rather than "you are not signed in" (1.1) | minor | hours | 1 | proposed | widen **D44** |
| 89 | UI | The rail's four groups are `<div class="grp">` headed by a bare `<p>`, with no `role="group"` and no `aria-labelledby` — twenty flat buttons to a screen reader. Unchanged between the two reviews | minor | hours | **1, 2** | proposed | new — *WCAG conformance measured, not assumed* |
| 90 | UI | The rail badge and its own screen report different numbers — rail *Doctor 38*, screen *"findings: 95 · … already ruled on: 49 …"* — both correct, with nothing on the screen reconciling them (1.5) | minor | hours | 1 | proposed | widen **D46** |
| 91 | UI | Nothing is compressed (transfer 2,653,070 B against decoded 2,642,570 B — a ratio of **1.004**), nothing is cached (`no-store` on `/`, `app.js`, `styles.css`, `strings/*`, `fonts/*`) and there is **no `ETag` on anything** — the immutable fonts are re-fetched every load. Report 1 ranked this second; report 2 confirms it and prices it at *tens of milliseconds on loopback*, second-order behind row 18 | minor | hours | **1, 2** | proposed | new — *the read model blocks the whole server* |
| 92 | UI | The DOM only grows — screens are retained with `hidden` and never released. Report 1 measured 3,124 → 35,028 nodes over a session; report 2 measured Conversations alone holding 12,124 of 13,025. `hidden` does keep them out of the tab order and the accessibility tree | minor | hours | **1, 2** | proposed | widen **D44** |
| 93 | UI | Switching language is a full page reload, so the execution context, every cached screen, the scroll position and the open pane are thrown away — and it now costs the seven seconds of row 18 rather than a warm switch | minor | a day | **1, 2** | proposed | widen **D44** |
| 94 | UI | Eleven font sizes on one screen, three of them fractional; the type scale is in absolute pixels so a raised browser default does nothing; 25 distinct button styles across `<main>`; `<main>` has `max-width: none`, so paragraphs run to **1,659 px — roughly 250 characters** at 1,920 px. Report 2 did not re-measure and says nothing it saw contradicts them (1 §4.1–4.4; 2 §5.3) | minor | a day | **1, 2** | proposed | widen **D44** |
| 95 | UI | Twenty screens and no way to jump — exactly two `keydown` listeners in the app and both handle `Escape`; the screen list is already declarative (`data-s`) (1.3) | minor | hours | 1 | proposed | widen **D44** |
| 96 | UI | Configure draws the same "what changes" sentence three times with nothing naming which is which, and `→` means *shipped default → in force* in one table and *old → new* in the plate beside it, with no `<thead>` and no `<caption>`; the config path sits in a 319 px input truncated mid-path under a sentence telling the reader it is the exact file (2.6) | minor | hours | 1 | proposed | widen **D48** |
| 97 | UI | The Composer's required inputs carry `aria-invalid="true"` while empty with no `aria-errormessage`, and "Required inputs are missing" is a plain `<p>` with no `role="status"`, so it is never announced when it appears or clears (3.7) | minor | hours | 1 | proposed | widen **D50** |
| 98 | UI | The version-skew banner is a fixed centred overlay over the content area, dismissible but redrawn on the next re-render — and it was the only thing on screen during the cold load. Report 2 did not reproduce it (no lane was editing `src/ui/public/**`), and its `color-contrast` failure now passes (3.3) | minor | hours | 1 | proposed | widen **D58** |
| 99 | UI | No `Content-Security-Policy` header and no CSP `<meta>`; `x-content-type-options: nosniff` is set. Not a live vulnerability — nothing on the page loads cross-origin — but cheap insurance for a local server that composes and executes shell commands (1.3) | minor | hours | 2 | proposed | widen **D58** |
| 100 | UI | `forced-colors` is **entirely unsupported** — 810 CSS rules, zero `@media (forced-colors: …)`, zero `prefers-contrast` — on a tool whose owner runs Windows 11, and the palette is built on custom properties, which High Contrast does not override. Report 1 listed this unassessed (3.5) | minor | hours | 2 | proposed | new — *WCAG conformance measured, not assumed* |
| 101 | UI | The retrieval mode picker is a correct `radiogroup` with correct `aria-checked` whose keys do not work: all four carry `tabindex="0"` instead of roving tabindex, and ArrowRight/ArrowLeft move neither focus nor selection — a screen reader announces "radio button, 3 of 4" and the keys that announcement promises are inert (2.7) | minor | hours | 2 | proposed | new — *WCAG conformance measured, not assumed* |
| 102 | UI | Rename has no Cancel and ignores Escape — the only way out of a rename editor is to save one (2.5); and filtering the anchor list hides the total, reading `1 marked.` where every other list in the app says "the first N **of M**" (2.9) | minor | hours | 2 | proposed | new — *the screen confirms a write landed* |
| 103 | UI | Selection state on the mode picker differs only in text and border colour — `font-weight` 600 on all four, no shape, icon or underline. `aria-checked` covers assistive tech, so this is sighted users with colour-vision deficiency only (2.8) | minor | hours | 2 | proposed | new — *WCAG conformance measured, not assumed* |
| 104 | UI | The live feed polls `/api/watch/context` and `/api/watch/volume` on top of its own open SSE stream — 3 and 2 requests in a 20-second window — duplicated work against a server that demonstrably stalls (8.3) | minor | hours | 1 | proposed | new — *the read model blocks the whole server* |
| 105 | UI | Command descriptions in the Composer are English-only because they come from the CLI catalogue rather than the string table; and there are no plural rules in either language — `1 פריטים`, `1 items` (6.4, 6.5) | minor | hours | 1 | proposed | widen **D47** |
| 106 | UI | `// TEMPDISABLED void heartbeatPing();` at `app.js:8349` — no item id, no date, no re-enable condition — removes the boot beat that `heartbeatPing`'s own header argues for, and in combination with row 6 it is the only beat some pages ever get (m20) | minor | hours | 3 | proposed | new — *a failure the code never looks at* |
| 107 | UI | `git-info`'s `in-sync` verdict draws **no chip** — and the module's own docblock calls that verdict *"the dangerous one: a wrong answer shaped exactly like a right one"* when the ref is not the upstream. Silence is the benign branch and it is the branch that can be confidently wrong (m16) | minor | hours | 3 | proposed | widen **D64** |
| 108 | UI | `symlinksUnder` — the assertion that `dereference: true` held — reports "no symlinks" for a directory it could not read, and the two snapshot walks silently narrow the confirm dialog, against `execute.ts:751`'s rule that *"a command whose effect cannot be shown does not get a weaker confirm — it does not run"* (m18) | minor | hours | 3 | proposed | new — *a failure the code never looks at* |
| 109 | core | Twenty-one further one-line swallows where the docstring asserts what the code does not do — `readCarryOnce` (*"and says so"* → `error: null`), `ui-sessions` (*"`error` is non-null only when a file EXISTS"* → it is not), `isTorn` returning "not torn" for a file it could not `stat`, `clearFocus` saying "there was nothing to remove" when it could not look, `decay.ts:103` making a renamed category not-normative, and sixteen more (m1–m19) | minor | a day | 3 | proposed | new — *a failure the code never looks at* |
| 110 | core | The `healTornTail` race: `truncateSync` on a stale size bound with no lock, where `audit-db.ts:318` states two concurrent writers is the ordinary case, so a second process's complete records can be truncated away. Derived from the code plus the stated concurrency model; needs a concurrent-append harness (m6) | minor | a day | 3 | inferred — reproduce first | new — *a failure the code never looks at* |
| 111 | core | An install whose sources cannot be walked serves `staleCode: false`, so the owner's server would run stale code indefinitely with the in-tab banner unable to fire — resting on `/api/meta` serving `staleCode` from `CodeIdentity.isStale()` and nowhere else, grep-verified, handler not read (m8) | minor | hours | 3 | inferred — reproduce first | widen **D56** |
| 112 | CLI | Every `mycontext` invocation prints `ExperimentalWarning: SQLite is an experimental feature` — solved at **every other entry point in the project** (all eleven hooks, the statusline installer, the review pass) and not at the one a person types (C9) | minor | hours | 6 | proposed | new — *the CLI answers a script honestly* |
| 113 | CLI | There is no `--version` and no `-v`, and the argued alternative — `status --json` — exits 1 with *"no workspace here"* outside a workspace, so the first fact any bug report needs is unobtainable from a fresh install (C6) | minor | hours | 6 | proposed | widen **D55** |
| 114 | CLI | One concept, several spellings: "remove this" has six (`--clear`, `--off`, `--none`, `--drop`, `--discard`, `--unset`), "category" has four, `--all` means "widen the listing" in two commands and "switch to bulk mode" in two others, and `ingest.ts:387` uses "candidate" and "draft" in one sentence for one concept (C8) | minor | a day | 6 | proposed | new — *the CLI answers a script honestly* |
| 115 | tests · scripts | Four more gates that can report green over a red run: `e2e-gate.ts` guards on `total1 === 0` rather than `failed1.length === 0`; `harness/baseline.mjs`'s `.catch` makes a suite that never spawned produce `failed: 0` and *"baseline matches the pin"*; `library-screen.test.ts` passes a **string** as `assert.throws`'s matcher, where Node treats it as the message; two `composer-staging` e2e specs skip on a property of the developer's working tree | minor | hours | 3 | proposed | new — *a gate that is not a gate* |
| 116 | UI | Rail badge accessible names concatenate: `Doctor38`, `Review queue0`. Partially addressed since report 1 — one button now carries a `title` — but a `title` is ignored for the accessible name when the element has text content | polish | hours | **1, 2** | proposed | new — *WCAG conformance measured, not assumed* |
| 117 | UI | Two-column cards do not balance — `DELIVERED` ends after a third of its column while `WHY NOT` continues, leaving a large empty rectangle at full gradient strength (4.5); and the background gradient competes with the content at full chroma across the whole content area (4.6) | polish | hours | 1 | proposed | widen **D44** |
| 118 | UI | The Capture screen demonstrates `mycontext add` with every flag present at once on a single unwrapped 600-character line — a reference, not an example (7.4) | polish | hours | 1 | proposed | widen **D44** |
| 119 | UI | Date inputs show `dd/mm/yyyy` in the Hebrew UI, because native `<input type="date">` placeholders follow the browser locale (4.4); and one console issue, `A form field element should have an id or name attribute (count: 4)` (3.9) | polish | hours | 2 | proposed | widen **D44** |

## The counts

**119 rows**, from about 177 findings across the six reports. **25 rows were
merged from more than one report** — every one of them is bold in *raised by*,
and those twenty-five are the strongest evidence in this document.

| Severity | Rows | | State | Rows | | Size | Rows |
|---|---|---|---|---|---|---|---|
| blocker | 11 | | proposed | 100 | | hours | 95 |
| critical | 8 | | inferred — reproduce first | 8 | | a day | 23 |
| major | 35 | | needs a ruling | 6 | | more | 1 |
| medium | 25 | | fixed | 4 | | | |
| minor | 36 | | refuted by 2 | 1 | | | |
| polish | 4 | | | | | | |

By surface (a row with two surfaces is counted in both): **UI 49 · core 24 ·
CLI 13 · store 13 · types 11 · MCP 6 · doctor 5 · gates 5 · tests 3 · docs 1 ·
scripts 1**.

**Widening beats minting, and it did.** 57 rows widen one of 21 existing D
numbers — **D44** ×9, **D41** ×7, **D46** ×7, **D64** ×6, **D51** ×4, **D50** ×3,
**D52** ×3, and one or two each on D6, D8, D11, D33, D38, D42, D45, D47, D48,
D55, D56, D58, D63, D65. The remaining 62 rows fall under **eleven proposed new
subjects**, which are proposals and nothing else — **I minted no D number**:

| Proposed subject | Rows | What it would cover |
|---|---|---|
| *a failure the code never looks at* | 12 | report 3's P1 — a `catch` wider than the case it argues — plus the three places with no observation point at all (the shell's `main()`, stdout, the MCP streams) |
| *WCAG conformance measured, not assumed* | 9 | skip link, `h1`, `document.title`, focus order, 1.4.10 reflow, `forced-colors`, identical accessible names, rail groups, the footer's silent drop |
| *the CLI answers a script honestly* | 6 | `--help` exiting 1, exit codes for "nothing found", stdout carrying refusals, flag spellings, the Node warning, `--version` |
| *a returned failure flag with no reader* | 5 | report 3's P2 — `recordAudit`, `deliverAtDoor.recorded`, `bumpCounter`, `listStaging`, `recordDecline` |
| *a gate that is not a gate* | 5 | unwired, report-only, and vacuous gates — three different ways to be green over red |
| *the screen confirms a write landed* | 5 | the new Conversations write flows: focus, confirmation, undo, paging, and a 200 the client does not read |
| *the read model blocks the whole server* | 4 | `/api/status` and `/api/doctor`, the connection pool, the SSE double-poll, compression and caching |
| *doctor's findings earn their keep* | 4 | the hard-coded cutoff, the three consumer-repo traps, the anonymous `check_failed`, and the 20,180 px page |
| *the MCP surface declares what it does* | 4 | annotations, a read-only rule-store pair, `id: null`, the two capability answers |
| *the invariant lives in the type* | 4 | `Item`'s ten invariants in comments, `HookInput`'s fifteen, the two nonces, `Item.extra` |
| *a module that grew by accretion* | 4 | `read-model.ts`, `checks.ts`, `mcp/tools.ts`, `handover-ask.ts`, and the dead exports |


## The contradictions, kept open

| Finding | Report 1 | Report 2 | Row |
|---|---|---|---|
| The cause of the seven-second load | `app.js` **4,632 ms**, `styles.css` **4,618 ms**; recommend compression second | `app.js` **21 ms**, `styles.css` **7 ms**; `/api/status` **3.8–4.7 s** and `/api/doctor` **3.9 s** per call, warm, proved by a parallel-versus-serial test; compression is *"tens of milliseconds on loopback"* | 18 |
| Target size under 24 px | **629 of 1,918** controls, **major**, WCAG 2.5.8 | **710 of 2,117** measured — but **707 are inline links inside a sentence, which SC 2.5.8 exempts**; `button.convhead` ×2 and one `summary` fail. Lighthouse's `target-size` audit passes. **Three** non-compliant controls, **polish** | *(not a row — see below)* |
| Hebrew currency | `$7607.12` renders `7607.12$` — listed beside the genuine `%6`/`%42` defects | `8050.80$` is the **correct** Unicode outcome for a bidi-neutral symbol at the edge of a number in an RTL paragraph, and is acceptable Hebrew typography. *"Round one over-flagged this one"* | *(not a row — see below)* |
| The delivery log | Report 6: *"nothing reads the file"*, and *"the `session-start` door has never once delivered successfully"* | `rulings/71`, landed: the file **is** read on nearly every matched tool call by the assertion — what is missing is a *reporting* surface; and the door **has not failed** — the event has not happened in this workspace since before the code landed | 53 |
| Whether refusals name their unblocking condition | Report 1 measured the UI and found the opposite of the reputation — 401, budgets, Composer and the scope gate all name what would unblock them | Reports 3 and 6 found one dead remedy in the rule store and five misses in the CLI | 68 |

**Two of report 1's findings are refuted outright and therefore carry no row of
their own.** Target size (report 1's 5.3) and the Hebrew currency (part of
report 1's 4) are here, with both measurements, and are not in the table because
report 2 measured them down to *polish* and *no finding* respectively. Report 2
also corrected something it nearly wrote itself — a 4 px gap between Rename and
Take it back that it was about to call a mis-click hazard, and did not, because
both controls are 26 px tall with 89 px between centres.

## What landed since the reviews were written

Each verified in `git log` and in the corpus item, not taken from a report.

| Subject | Ruling | State |
|---|---|---|
| The status cast | `rulings/69`, commits `3175c35d` → `44b3623b` | **Landed, and the gates are still open.** `readEnum`/`ENUM_READ` replaced the cast; `pack/reader.ts` refuses a laundered artefact; `doctor`'s `checkLaunderedEnum` reports the local file. But `ENUM_READ.status.laundered` is `draft`, `GOVERNING_STATUS.draft` is `false`, so `governsNormatively` still answers false and the five gates still let an agent through on a corrupt local file. The item is `state: todo` |
| The byte/character offsets | `rulings/70`, commit `ae4984d7` | **Landed and proved in Hebrew.** The two seams carry `Buffer`. The **branding** recommendation was to defer, with `forEachLine` (~60 lines, four call sites) proposed as the cheaper alternative — **both are proposals** |
| The delivery log pollution | `rulings/71`, commits `040d96fd` → `dc0f14fb` | **Landed.** A test row is marked by the recorder, not by a convention; the 157 legacy rows were moved rather than deleted. It corrected two of report 6's claims as too strong (row 53) |
| Hebrew bidi | commit `ae4984d7` and the same day's UI work | **Largely fixed.** `dir="auto"` **0 → 1,371**; `unicode-bidi: isolate` **0 → 6,762**; split number-and-unit runs **0** (was 8 in the footer alone); runs with a bidi-neutral at either edge left unisolated **0**. The one place it was not applied is the place report 1 found it — row 30 |
| Lighthouse accessibility | — | 95 → **100**, `color-contrast` now passing. **Report 2 states plainly what that does not cover**: of 76 audits, 42 were not applicable and 10 are manual-only — **24 actually ran**, and none of them can see the missing `h1`, the constant title, the absent skip link, 684 identical names, the inert arrow keys, focus thrown to `body`, or the 1.4.10 reflow failure. A 100 here is a floor |

---

# The five things I would do first

**1 · The `config.json` trailing comma (row 1).** One malformed byte removes the
entire product from every session — no rules, no JIT tier, no compaction
restore, no subagent constants — and the audit log keeps writing healthy rows
while it happens, because the recording paths deliberately avoid the same throw
and the delivery paths do not. It is first because **the evidence actively
exonerates the failure**: every other defect here can be found by looking, and
this one makes looking say "fine". The sentence to print already exists and is
already well worded; the fix is a `failure?: string` on `Injection` and a stderr
line per hook.

**2 · `statusline install`'s catch (row 2).** One `catch` covering every errno
turns an unreadable `settings.json` into `{}` and writes a two-key file over the
user's permissions, hooks, env, model and MCP servers — then saves
`previousText: null`, so the backup built for exactly this case cannot restore
it. It is second because it is the only row in this document where **the damage
is unrecoverable and the fix is one line**, and the one-line fix (`if
(err.code === 'ENOENT')`, reusing the parse branch's own wording) is correct
whether or not the Windows trigger is ever reproduced.

**3 · The two dead retrieval modes and the two orphaned modules (row 4).** This
is the strongest evidence in the document: a blocker found at the screen and at
the import graph by two reviews that could not see each other. *"Where were the
fixed points?"* answers **0 points** on a screen showing **684 anchors**, and
the entry point a user reaches for precisely when they have nothing to paste is
the one that tells them to paste something. Meanwhile a closed item lists both
modules under **DONE**. It is third because the current state is the one this
project is least willing to tolerate — a closed item, a green suite, and a
capability that is real in the source and absent from the product.

**4 · The status gates' third answer (row 12).** `rulings/69` landed and made a
laundered status loud on disk and refused at the pack boundary, and it did not
re-close the five gates: `draft` is `false` in `GOVERNING_STATUS`, so the
supersede preflight, the guarded-field refusal, `mutate`'s status gate, the
contradiction gate and the pack-collision judgement still take silence for
permission on a corrupt local file. It is fourth rather than first only because
it **needs your ruling before anyone can write the code** — see the decisions
below. Once ruled it is hours, and the item is already open at `state: todo`.

**5 · Wire the five gates, and settle the two broken citations (row 16).**
`verify:citations` exits 1 today and runs only in `release.yml`, so **every tag
cut today fails at a gate no pull request exercises**; `check:dependencies`
guards `CONST-zero-runtime-dependencies` — the project's headline promise — and
runs in neither workflow. Each of the five ran in seconds. It is fifth because
it is the cheapest row here that changes what the *next* defect costs: four of
the twelve blockers above would have been caught by gates that exist.

**The sixth, said because it is the one you feel every day:** `/api/status` and
`/api/doctor` block the whole server for about four seconds *per call* (row 18).
It is not in the five because report 2 proved *that* it happens and did not
profile *why*, so the first move is half a day of measurement rather than a fix.

---

# Every decision that needs you, and nothing else

**1 · What a laundered `status` should do to the five gates.** Today it reads
`draft`, and `GOVERNING_STATUS.draft` is `false`, so the gates that exist to
refuse a non-human caller keep answering "this does not govern". The options are
(a) leave it, and accept that a hand-edited typo disarms five gates on the
owner's own machine; (b) make the laundered value read `active`, which restores
the gates and makes a typo govern; (c) **a third answer** — keep `draft` for
*selection*, so a corrupt item still does not inject, and give the five gates a
separate predicate that fails **closed** on a value that was laundered, so they
refuse rather than permit. **My recommendation: (c).** It is the only one that
keeps both properties the ruling wanted, `tierOf` already fails closed and
argues the direction, and `launderedEnums` already exists to answer the
question. It needs a field or a flag carried on the item so the gate can ask —
that is the design work, and it is small.

**2 · Whether to reopen D42 and wire `subjects.ts` and `noise.ts`.** Report 5
found two readings and no record choosing between them: either the mission was
always meant to carry pointers and the filtering belongs in the subagent that
reads in the fresh window (so the gap is a missing consumer), or they were meant
to shape the mission and the wiring was missed when Tasks 11–12 rebuilt the
destination as a staged UI write. **My recommendation: reopen D42, and split the
answer.** `list-anchors` is not a design question — the mode is named after the
anchor store, there are 684 anchors on the same screen, and returning 0 points
is provably wrong; ship it. `list-subjects` and the noise filter are the real
question, and the honest interim is report 2's: **until they gather their own
material, the two passage-less modes should not be offered.** A mode that
advises the one thing it does not allow is worse than a mode that is absent.

**3 · The screen-heading verdicts: keep, hide, or reword.** Report 2 recommends
**reword** and is explicit that it is a **precondition**, not a courtesy: `⚠️`
currently means *"Learn is a conditional pass"*, any coherent severity set needs
`⚠️` to mean *warning*, and one glyph cannot mean both — so D63 cannot start
until this is settled. It also found the question was already ruled on:
`parts.js` records a 2026-08-26 verification pass settling that *"a real verdict
chip is the `.chip` primitive with a meaning hue, not an emoji"*, Status was
migrated, and the other nineteen were left on the default because the change was
made opt-in. **My recommendation: reword.** Not keep — it misleads a user into
reading a design note as a health claim, it blocks the set, and with no
`aria-hidden` it makes a screen reader say *"white heavy check mark"* on
nineteen screens. Not hide — that leaves nineteen screens carrying a verdict the
user never asked for. Finish the rollout that was already ruled correct: migrate
the nineteen to `verdictChip`, keep the sentence where it tells the *user*
something (`ask.v`, `conv.v`, `gr.v`), and delete it where it is an internal
design argument (`doc.v`, `cfg.v`, `st.v`, `ln.v`). Four hours.

**4 · `forEachLine` versus branding the offset type (row 77).** Report 4 costed
branding at 60–120 lines and a day across eight files, recommended deferring,
and `rulings/70`'s own text says *"do not widen this into the general branding
question"*. The cheaper alternative it proposed is `forEachLine` — about 60
lines and four call sites — which makes the next seam impossible to write
wrongly without branding anything. **My recommendation: `forEachLine`.** The two
seams are already fixed and proved in Hebrew, so this buys prevention, not a
repair; buy the cheap prevention and leave the brand unpurchased until a third
seam appears.

**5 · Whether `supersede` should have an inverse (row 87).** No
`unsupersede`/`reopen` exists anywhere, and **no ruling either way is recorded**
— while `retire.ts` is one-way by deliberate, documented design, so the pattern
exists on purpose elsewhere. **My recommendation: rule it, either way, and
record the ruling.** If it is one-way like retire, the cost of having asked is
one sentence and the question stops being re-opened by every reader who notices
the asymmetry. If it is not, `supersedeItem`'s shape is most of the design work
already done.

**6 · What `--json` does on a refusal (row 57).** Today `mycontext show X --json
> out.json` writes `my_context: no item with id "X".` into `out.json` and exits
1, while `help cli` says `--json` means *"One JSON document instead of a program
to read"*. Two honest answers: route refusals to stderr (conventional, makes
`2>/dev/null` mean what people expect), or emit `{"error": …, "exitCode": 1}` on
the `--json` path. **My recommendation: the JSON envelope.** It is one helper,
touches no command's prose, and keeps the product's own rule that a refusal is a
message the reader must be able to read — a refusal routed to stderr is a
refusal an agent parsing stdout never sees.

**7 · The Copy confirmation (row 31).** `app.js:5118` says a visible
confirmation would be *"chrome the owner has not approved"* — and the newer
Conversations code already ships one, with a refusal path. **My recommendation:
approve the visible half.** The decision has effectively been taken on one
screen; what is left is an inconsistency between two screens, which is a worse
state than either answer. A 1.5-second text swap on the button costs no new
chrome and no new slot, and the live region stays exactly as it is.

**One decision I am recommending you do *not* take:** turning on
`noUncheckedIndexedAccess`. Report 4 measured it rather than guessing — **2,259
errors**, against a baseline of 0, the bulk in `test/`. That is a project, not a
cleanup, and the number is recorded so nobody has to re-measure it.

---

# What the reports agreed is good

A table of only faults is not calibrated, and the removal review's own headline
was that **the recorded argument usually holds** — of the hypotheses it formed
from file size or name alone, a minority survived reading the code.

**Found good by more than one report**

| What | Who said it |
|---|---|
| **Refusal and empty-state copy** — the 401 names its cause, distinguishes it from an empty corpus, explains why a reload cannot recover it, and prints the command; the budget refusal quotes the hook verbatim and then says who *can* do it | 1 (measured across the UI and called the project's reputation for the opposite *"out of date"*), 6 (`config.ts`'s delete→disable, `export`'s `--pack-name`, `repair`'s four concrete routes, `search`'s category refusal printing the full list and the closest match) |
| **Reduced motion, done in the rare direction** — zero unconditional `transition` or `animation` declarations in 810 rules; all motion opt-in behind `prefers-reduced-motion: no-preference` | 1, 2 (confirmed independently) |
| **Bounded-list honesty** — *"Showing the first 20 of 36 … A display limit. All 36 were in the injection — none were dropped."* Every list in the product but two | 1, 2 (*"the anchors list is the first list in the product to break it, which is itself evidence of how consistently the rest holds"*), 6 (`listOf`'s *"… N more. Narrow the filter"*, `contribution`, `search`, `query`, `audit`) |
| **The measurement vocabulary** — *measured zero* vs *unmeasured* vs *absent*, three states most products collapse into one blank | 1 (*"the project's signature"*), 3 (names `corpus-identity.ts`'s `UNREADABLE = -1` and `context-occupancy.ts`'s missing `percent` field as the template: *make the zero unrepresentable, not merely discouraged*) |
| **Teaching copy that shows the rule, not just the result** — *"the first to fail is the answer: above passed, below never reached"*; *"a guess that resolves is worse than silence"*; *"Safe to press again: it only ever changes points it marked itself… this takes about nine seconds"* | 1 (*"this UI teaches, and that is its real differentiator"*), 2 (*"I do not remember another button that tells you its own idempotency guarantee and its own runtime"*) |
| **Lighthouse Best Practices 100 and Agentic Browsing 100** on both the busiest and the quietest screen | 1, 2 |
| **Fail-closed as a habit** — `tierOf` guarding prototype pollution and arguing the direction; `ui/static.ts` refusing an unknown extension; `config.ts` refusing `"categories": []`; the `'<absent>'` discipline across seven hook files | 3, 4 |
| **The suite's discipline about its own falsifiability** — a house anti-vacuity pattern, planted positive controls, *"a checker is not verified until it has been made red"*; one `assert.ok(true)` in the entire suite, zero floating Playwright assertions across 103 e2e files, zero `expect.soft` | 3, 6 |

**Found good by one report, and worth keeping in view**

- **Contrast** (1): the lowest ratio in the app outside one transient banner is **5.19:1**, typical **6.4–10.2:1**, the focus ring about **10:1**.
- **Execute's confirm** (1): inline rather than modal, the exact argv, and *"The UI can tell it came from your browser — not that you asked."*
- **Print** (2): 21 rules across two `@media print` blocks — full palette inversion, chrome hidden, scrollers unrolled, `break-inside: avoid` on work steps. Report 1 listed it unassessed.
- **The mark flow's opening** (2): focus moves into a labelled, pre-filled input under copy stating where it is stored and that it is reversible. *"Round one found no focus management anywhere; the new code has it."*
- **Zero unlabelled inputs** (2): 14 visible inputs on the busiest screen, 0 without an accessible name — *"I expected to find several; I was wrong, and I would rather say so."*
- **`UPDATE_FIELD_POLICY`** (4): *"the best type in the product"* — a field added to `UpdateInput` without a class does not compile, four `Assert<>` aliases pin the consumer lists in both directions, and the mechanism has already worked in production.
- **`SUMMARY_BASIS`** (4): a partition the compiler enforces, and honest about the boundary of its own guarantee.
- **`resolveConfig`** (4): `unknown` in, `Config` out, thirteen named validators, refuses rather than coerces, one `as` proven on the next line.
- **Escape hatches** (4): across 135,756 lines — 26 `as any`, 13 `as unknown as`, 4 non-null assertions, **0** `@ts-ignore`.
- **The pipe problem is closed structurally** (6): one `isTTY` in all of `src/cli/`, no colour, no spinner, `OUTPUT_WIDTH = 100` with the argument above it — eight commands run redirected and through `| cat` were **byte-identical every time, including a 121 KB `list`**. *"This is the one area I would change nothing."*
- **`provenance.ts`** (6): *"the best-argued file in the four surfaces"* — it exists because a frozen MCP process reported 719 of 736 items as mismatches for an hour, so the footer rides on every successful result, because *"the whole defect is that nobody was suspicious"*.
- **`check:test-glob`** (6): the best gate in the project, built on a measurement (unquoted, 2 of 4 files ran, exit 0) and run *before* `npm test` with the reason in a comment.
- **`doctor`'s acknowledgement model** (6): 102 of 107 acknowledged and **still reported and still counted** — the only acknowledgement design that does not decay into suppression.
- **The store's own refusals** (6): line endings normalised before hashing so a Windows clone's first `rules verify` does not cry tampering; `restoreEntries` copies the package manifest rather than regenerating it, so a restore cannot certify the planted file it just declined to delete.
- **`lock.ts`, `select.ts`, `render.ts`, `pack/*`, `registry.ts`, `ingest/apply.ts`** (3): checked and left alone; every drop recorded, every disclosure outside every budget, every malformed field refused by name.
- **The no-writes guarantee holds** (3): checked against `RULED_WRITES` binding by binding — *"no write in the serving path outside the ruled exceptions."*

## Stays exactly as it is

Report 5's fifteen, recorded so a later pass does not re-open a closed decision.
Each looked, by name or size alone, like duplication or accretion.

1. **The three statusline files** (5,344 lines) — a real three-way split, no duplicated colour or segment logic.
2. **`restore-stage` / `restore-staging` / `restore-store`** — split with a *measured* reason: keeping `node:sqlite` off the injection-critical import path, with a test that walks the runtime import graph.
3. **`audit.ts` / `audit-db.ts` / `audit-tail.ts`** and the `filterAudit`/`filterSelect` pair — three independently justified callers and a 355-line cross-check test. One small named residual cost.
4. **`config.ts`'s hand-kept key lists** — hand-kept *on purpose*, with the derivation risk written beside them and a dated 2026-08-27 incident cited.
5. **`src/ui/maintenance/**` and Task 13's `renderCorrection`** — excluded from the package as the security model, asserted two ways; Task 13 unwired by explicit owner ruling with the revisit condition recorded.
6. **`src/review/prompt.ts`** — correctly unreachable until the model-call phase lands, tested structurally.
7. **The absence of a UI write path for pack import and config changes** — a *named, deliberate* absence: *"the one thing this screen cannot have, named rather than quietly missing."*
8. **`retire.ts`'s `RETIREMENT_RULE = null`** — a state with no transition out, deliberate and self-checking, with `derivability()` recomputing the premises from the live corpus.
9. **`src/plugin/parity.ts`** — the project's own answer to CLI/MCP parity, test-enforced in both directions.
10. **`conversation-secrets.ts` vs `conversation-redaction.ts`** — explicitly argued apart: *"detection proposes, it never acts."*
11. **`search.ts` vs `conversation-search.ts`** — similar names, disjoint jobs.
12. **Hooks boilerplate** — not duplicated; a single dispatcher would route on attacker-controlled input.
13. **Generated slash-command files and derived `TOOL_NAMES`** — neither is a hand-kept second copy.
14. **`src/pack/`** (12 files, ~8,655 lines) — already well factored by concern.
15. **`mutate.ts`, `config.ts`, `command-flags.ts`, `select.ts`, `audit.ts`** — large but cohesive, each the sole writer or sole definer for one concern.

Two more, from the other reports, that belong in this list:

16. **The rule store's correction machinery** (6 S3b) — `renderCorrection`, `correctionAtDoor` and `SESSION_SCOPE_DOORS` have no caller in `src/` **by owner ruling**, and the 8,472-against-23,772 figure describes what *would* happen if it were wired. *"Not a defect, and I would change nothing."* Worth one line in the module header saying three exports have no caller and that is the end state.
17. **`Map<string, Item[]>` for `plan/seq`** (4) — non-uniqueness is modelled correctly and deliberately, with the measurement: *"six live tasks share `ui3/11x` … a reference therefore means all six."*

---

# What nobody assessed

The union of the six reports' own stated limits. Stated plainly, because several
of these are large.

**Never read by anybody**

- **`src/ui/public/screens/conversations.js` is 7,277 lines — larger than the
  largest TypeScript file in the repository — and has been read in depth by
  nobody.** Report 5 says so outright; reports 1 and 2 drove the screens it
  renders and read it only where a finding needed a line number; report 3 read
  `src/ui/public/screens/*.js` *"only where a server contract needed its
  consumer checked"*; report 4 could not read it at all, because `tsconfig`'s
  `include` excludes `src/ui/public/*.js` by construction. The screen it draws is
  the one that grew the blocker, the unpaged 684-row list, the 1.2 s keystroke
  and the dead confirmation slot.
- **The rest of `src/core/retrieval/`.** The orphan sweep answered the one
  question a sweep can answer — which modules nothing reaches. The internals of
  the five wired modules still have not had a full read, and the directory was
  assigned to no lane. Report 5's own conclusion: *"a review partitioned by
  directory cannot find the thing that is wrong with a directory nobody was
  assigned."*
- **`e2e/` (88–103 spec files) and `scripts/` (30+).** Read for falsifiability
  patterns by report 3; not reviewed as code by anybody.
- **`README.md` (456 KB) and `CHANGELOG.md` (115 KB)** for internal staleness.
  Their *examples* are mechanically verified; their prose claims are not, and the
  one cross-check that was done found a stale claim.
- **`src/ui/read-model*.ts` (~15k lines) as a type surface**, `src/ingest/`,
  `src/lesson/`, `src/rules/` and `src/pack/` beyond the specific boundaries
  cited. `read-model.ts` (4,203), `read-model-conversation-document.ts` (2,658),
  `lib/viewmodel.js` (100 KB) and `cli/commands/statusline*.ts` (5,344) were
  swept by pattern rather than read end to end.

**Never executed**

- **The full test suite was not run by any of the six.** Every "evidence it is
  safe" claim rests on import-graph tracing and reading the cited tests' intent,
  not on a green run. So nobody can say which findings are already pinned or
  knowingly accepted.
- **No mutating command was run.** Capture past composition, Review queue
  promote/discard (the queue was empty in both UI reviews, so its populated state
  — the one that matters — was never seen), `pack import` importing,
  Export/import, `Write budgets`, and every MCP tool that writes.
- **The staged-restore approve path.** `/api/retrieval/approve` and its
  `/confirm` exist and the two-step shape is right; `/api/retrieval` reports
  `present: false`, and staging one requires running a helper agent in a fresh
  window. *"The only part of the new work I did not reach."*
- **The Relations graph rendered.** Not reached in either UI review.
- **Whether the plugin's hooks deliver correctly under a live `claude` session**,
  and whether the MCP server behaves correctly under Claude Code specifically —
  this repository's MCP server was disconnected for report 6's whole session, and
  `resolveServerCwd`'s own comment records that `CLAUDE_PROJECT_DIR` has never
  been confirmed for it by a live session.
- **Consumer-repo behaviour end to end.** Nobody ran `mycontext init` on a
  throwaway workspace and drove a door through it, so every consumer-install
  finding (rows 13, 17, 69) is source-and-render derived.
- **Whether the five gates would pass in CI.** Run locally, on Windows only;
  three of them walk paths and Ubuntu could differ.

**Measured with an instrument that cannot see it**

- **Real screen-reader output.** Both UI reviews computed accessible names, roles,
  landmarks, live-region politeness and focus order. Neither ran NVDA, JAWS or
  VoiceOver, so *spoken* order and verbosity are unverified.
- **Lighthouse's performance category** — excluded by the MCP tool in both
  rounds; navigation, resource and long-task timing were measured directly
  instead.
- **Lighthouse's accessibility 100** — **24 of 76 audits actually ran** (42 not
  applicable, 10 manual-only). Quote the score only with that sentence attached.
- **Touch, and pointer-coarse emulation.** No touch device; the brief did not
  prioritise it.
- **The dead-export sweep is a floor, not a ceiling.** It matches substrings, not
  imports, so it can call a symbol "used" when only a comment mentions it —
  which is exactly how the three genuinely dead functions slipped past five
  hand-checking lanes. A ceiling needs a type-checker API, and was not attempted.
- **The tail of ~290 unguarded assertion loops** whose iterable is a local
  literal — non-vacuous by construction and spot-checked, not read exhaustively.

**Known unknowns that block a fix rather than a finding**

- **Why `/api/status` and `/api/doctor` take four seconds.** Report 2 proved
  *that* they do and that they serialise everything else. Neither review profiled
  the server process — it is the owner's and off limits.
- **Whether Claude Code surfaces stderr on each event.** Most of report 3's
  recommendations route a disclosure there, and the hook files assert it
  confidently for SessionStart/PreToolUse/SubagentStart and assert the *opposite*
  for SessionEnd. None of it was verified against a build. Where stderr is
  discarded, the fix must be the audit row instead — **this is a precondition for
  roughly a third of the silent-failure fixes above.**
- **Whether the five gates in row 12 have actually failed open in production.**
  The mechanism was traced link by link and no corrupt item was constructed and
  observed. *"It is worth doing before the behaviour change is chosen."*
- **The demo corpus.** Everything was measured against the live `my-context`
  corpus — 1,107→1,110 items, 684 anchors, 103 MB of transcript. Several
  `KNOWN-` items describe demo-corpus behaviour nobody exercised.
