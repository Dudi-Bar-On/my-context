# The walk sweep — 46 open items, measured

**Method.** Queried the 46 `walk` tasks not `done`. Read every one (`mycontext show`). Started an own
UI server (`mycontext ui --port 0 --no-open`, never touched 58888) and drove it with Playwright —
navigated to each screen in question, clicked, typed, ran a canned query, dragged the simulator,
read the live DOM — cross-checked against the source (`src/ui/public/screens/*.js`, `read-model.ts`,
the mockup `docs/design/web-ui-mockup.html`, gate scripts, tests). No production code changed, no
item state changed. The own server was killed at the end of the sweep.

**Headline counts (46 items):**

| Verdict | Count |
|---|---|
| ALREADY DONE | 11 |
| PARTLY DONE | 6 |
| STILL OPEN | 27 |
| NOT VERIFIED / not fully measured | 2 |

(Two items — `styles-parity` cascade and the safe-port test guard — land inside STILL OPEN /
PARTLY DONE respectively but their full closure needs a run this sweep did not attempt; see notes.)

One item (`TASK-review-queue-what-the-screen-is-and-what-implemented-means`) closed itself **during
this sweep**, live, by a concurrent lane — its own audit log carries `10:32:01 mutation update
TASK-review-queue…` today. Not this sweep's doing; noted for completeness.

---

## ALREADY DONE — 11, with evidence

1. **`TASK-tutorials-what-the-screen-is-and-what-implemented-means-for`** (the worked example named
   in the brief). `apiTutorials` in `src/ui/read-model.ts:3261`, `test/ui/tutorials-endpoint.test.ts`.
   Live: six job-titled rows, EN columns show ✅ from real per-file measurement, HE columns show
   "▲ to write" rather than a silent fallback. Matches the task's own "what implemented means" line
   for line.

2. **`TASK-review-queue-what-the-screen-is-and-what-implemented-means-for`.** Frontmatter now
   `state: done`, `verified_on: 2026-09-05`. Closed live by another lane during this sweep (see
   above) — not verified further by me since it left the open set mid-sweep.

3. **`TASK-composer-what-the-screen-is-and-what-implemented-means-for`.** Live at `#/palette`:
   real command catalogue (25 entries, write/read badges), id picker populated from the running
   corpus (893 items), and a **live server-side glob tester** — typed `src/**/*.ts` into `#globin`
   and got back `176 / 1,149` with the real matched file list, not a client-side re-match. The
   count line the task worried might be missing is drawn.

4. **`TASK-template-packs-what-the-screen-is-and-what-implemented-means-for`.** Live at `#/packs`:
   all four cards drawn — where it lands (`init --pack` / `pack import`, both → draft), what a pack
   may carry (travels/never table), integrity (digest/version/discovery/updating, with the "what
   the digest does not prove" caveat), and the corpus join ("Showing all 0" on this workspace — a
   measured zero, correctly worded, not an absence).

5. **`TASK-configure-the-three-sentences-that-tell-a-reader-their...`.** `cfg.parseErr` /
   `cfg.resolveErr` exist in both `en.js` and `he.js` and are wired through `errorNote` in
   `config.js:1208-1220`; `skippedNotice` is drawn at `:1237`. The condition this task was waiting
   on (`walk/92`) is recorded as closed in the surrounding comment.

6. **`TASK-doctor-draws-a-card-headed-error-containing-nothing-which-reads-as-an-error`.** Live at
   `#/doctor`: the ERROR card on this corpus reads **"Checked — none here."**, not a bare heading.

7. **`TASK-doctor-cannot-tell-a-finding-a-command-could-clear-from-one-nothing-can`.** Live tally:
   *"findings: 49 · with an automated repair: 0 · yours to settle: 49 · already ruled on: 8 · notes
   about the checks: 5"*. `doctor.js` (~723-1006) has the `repairFor`/chip machinery the owner's
   ruling asked for: a finding with a mechanism gets Execute, one without draws a **named**
   "no automated repair" chip with its own reasoning (not a bare absence), and an acknowledged one
   draws "Already ruled on" with its own `mycontext ack` row. No bulk *fix* control exists (only a
   bulk *ack* for identically-ruled findings, which is a different, permitted thing).

8. **`TASK-one-doctor-message-does-two-jobs-so-58000-characters-of-the-same-paragraph-print-sixty-one-times`.**
   `doctor.js:540`: *"the repeat is factored out and drawn ONCE per code, under the table it..."*.
   Live: the shared 945-character teaching sentence for `citation_form` occurs **once** across the
   whole 69,570-character doctor page text, confirming grouping rather than per-finding repetition.

9. **`TASK-proc-scatter-the-disclosures-back-beside-the-cards-they-qualify`.** Live at `#/proc`:
   4 top-level `.card.pane` elements (was 5). The 4th and last is *only* the one disclosure the task
   named as allowed to stay collected: *"progress is recorded per workspace, not per session"*. The
   others have been scattered back to their own cards.

10. **`TASK-the-mockup-s-hebrew-contradicts-its-english-in-two-places-and-abridges-it-in-two-more`.**
    Both halves fixed in `docs/design/web-ui-mockup.html`: `port.sub` HE now reads "נבנה, והמסך הזה
    מדווח על כך" (matches EN "Built, and this screen reports it"); `pk.trustn` HE now argues the
    corrected line rather than the superseded "choosing a pack at init is itself the act of trust";
    `cfg.nocmd` HE now carries the actual quoted deny-hook sentence (was a promise with nothing
    after it); `dv.mdnote` HE now carries the raw-HTML/image/unknown-URL-scheme refusal clause.

11. **`TASK-anchor-the-simulator-on-the-real-context-window-from-the-status-line`.** Code evidence
    only (`simulate.js:2149-2192`, `drawWindow()`): fetches `/api/watch/context`, requires
    `sample.state === 'known'` before drawing anything, falls back to a named `sim.winNone` refusal
    on any failure or on `not-yet-known`/`unknown`, and is fetched once rather than per drag. This
    satisfies all three "honesty constraints" the task named. **I could not see the marker itself
    live** — the sweep's own session carried no live statusline sample reachable from
    `/api/watch/context` at the moment tested, so the screen correctly fell back to "no window
    measured" rather than drawing anything. Marking done on code strength; the visual has not been
    seen rendered.

---

## PARTLY DONE — 6

1. **`TASK-injection-preview-the-screen-literals-ledger-names-twelve-unkeyed-sentences-as-Filed`.**
   9 of the original 12 are now keyed and gone from `test/ui/screen-literals.test.ts` (`preview.notReached`,
   `preview.gEligible`…`gBudget`, `preview.rbTo`, `rbInOut`, `rbRange`, `rbFit`, `rbIndex`, `rbSpill`).
   **3 remain unkeyed**, confirmed still in the ledger: the helpbox tail (" — all five, or this
   previews a different question."), the no-path sentence ("path — none (…) takes none"), and the
   ghost tooltip ("… · … tokens · budget exceeded").

2. **`TASK-nothing-translated-the-shell-markup-ten-data-t-labels-were-english-on-the-hebrew-page`.**
   `applyStatic(document)` is implemented and called at boot (`app.js:7175-7191`). The fix is real.
   **No regression test exists** anywhere in `test/ui/` or `e2e/` for "no `[data-t]` element in the
   shell still holds English after boot in Hebrew" — the one thing this task said the fix still owed.

3. **`TASK-the-event-picker-s-four-are-right-subagent-start-and-the-tool-jit-rename-are-undisclosed`.**
   The verification half was already correct (confirmed live: exactly `session-start | tool |
   compact | manual`, matching `SelectEvent`). **The disclosure half is not built** — no sentence on
   `#/preview` says a subagent's delivery previews as `session-start`, and the `tool`/`jit` name
   mapping is written nowhere a reader would meet it. Grepped `preview.js` for "subagent" and
   "SelectEvent": no hits.

4. **`TASK-the-simulator-opens-on-the-tier-that-shows-nothing-and-div-at-needs-a-behaviour-test`.**
   Half 1 is fixed by a mechanism the task didn't anticipate: `ensurePath()` (`simulate.js:1645`)
   auto-picks the repository's first file as the default path on `jit`, so the screen **no longer
   opens blank** — confirmed live, the staircase and ladder both draw real data on first paint.
   Half 2: `test/ui/simulate-screen.test.ts` (~790-807) does assert `.at` lands on the correct rung
   for a fixed budget. I did not find an assertion that the highlight **moves** when the slider
   drags, which the task's "Done when" explicitly asks for.

5. **`TASK-verify-citations-must-scan-the-corpus-and-the-corpus-should-cite-by-anchor-not-by-line`.**
   Half 1 (the blind spot on `e2e/`) is fixed: `SOURCE_ROOTS = ['src', 'test', 'scripts', 'e2e']`
   (`scripts/verify-citations.ts:308`), with a comment recording exactly when and why `e2e` joined.
   Half 2 (scan `.my_context/items/`) is **deliberately not done** — line 630 explicitly skips the
   `.my_context` directory, and the surrounding comment argues the corpus's citation form
   (`path#task-N at line L`) would need normalising first, which is a corpus-side change this
   script's own header declines to make unilaterally. That is a reasoned deferral, not an oversight,
   but it is not yet a recorded ruling either — it lives only in a code comment.

6. **`TASK-tests-that-bind-a-port-without-the-safe-port-guard-fail-with-bad-port-under-load...`.**
   `startOnSafePort` usage is now widespread — 56 occurrences across 13 test files, including the
   files the task named as victims (`execute-route`, `execute-budgets-route`, `live-config`). I could
   not confirm zero remaining bypasses without doing what the task itself says is the only real
   test — a full `npm test` run under deliberate concurrent load — which this sweep did not run.
   Marking partly done on the strength of adoption; not closed.

---

## STILL OPEN — 27 (selected evidence; all were checked, not just asserted)

- **`TASK-ask-the-four-canned-reports-cannot-take-the-fetch-cap-ladder`** — verified live: pressed
  "Operations by count" on `#/ask` (34 rows returned), and the "Rows to fetch" select stayed sitting
  at 200 with no sentence saying it does not govern the canned report just shown.
- **`TASK-status-and-export-import-the-em-dash-is-correct-and-cannot-say-why`** — verified live on
  both screens: `#/status`'s "Staged lessons" / "Unfinished ingests" rows and `#/port`'s three
  import-bucket rows are plain `<td class="small">—</td>` with **no title attribute and no key**,
  exactly the defect described.
- **`TASK-injection-preview-rung-4-of-the-gate-ladder-can-never-be-measured...`** — verified live:
  rung 4 ("scope") on `#/preview` literally reads *"How many the event path excludes is unmeasured:
  matchesScope has no endpoint... Not a zero — no list can be drawn."*
- **`TASK-decay-deccaveat-is-undrawn...`** — verified live and in code: no "cold means N sessions"
  sentence anywhere on `#/decay`; `deccaveat` does not exist outside `decay.js`'s own header comment.
- **`TASK-learn-the-categories-row-cannot-draw-the-cross-link...`** — verified live: the
  `categories` row on `#/learn` reads "which are normative" with no trailing id, while `scope` and
  `capture` both carry one.
- **`TASK-no-screen-has-hover-or-click-help-and-most-buttons-carry-none-at-all`** — re-measured the
  counts the task itself cited: unchanged. `config` 9 buttons/0 titled, `simulate` 6/0, `graph` 4/0,
  `ask` 2/0, `preview` still the best at 4 of 6.
- **`TASK-the-provenance-bar-is-empty-on-every-screen...`** — `grep -r provparts
  src/ui/public/screens/` returns zero files. Bar is still built empty by `renderChrome()` alone.
- **`TASK-drive-capture-into-its-composed-state-and-close-four-ledger-entries-at-once`** —
  `e2e/screen-parity.spec.ts`'s own comment still reads *"`plan:walk seq:55` closes the remaining
  three"* (future tense); `KNOWN_GAPS.capture` still lists `div.cmd`, `code`, etc.; `capture` is
  still in `button-contrast.spec.ts`'s `EXPECTED_EMPTY`.
- **`TASK-search-matches-only-an-unbroken-phrase...`** — `src/core/search.ts`'s `searchableText`
  is still a plain case-insensitive substring match; no per-word AND, no reorder tolerance.
- **`TASK-serve-markdown-documents-to-the-ui-behind-a-decided-boundary`** — no `/api/doc/:id` (or
  equivalent) route anywhere in `read-model.ts`. Still blocked on the owner's security ruling.
- **`TASK-research-a-documentation-tool-then-build-the-full-application-documentation`** — same
  boundary; no documentation tool adopted, no route to serve arbitrary repo docs.
- **`TASK-watcheddocs-is-the-one-config-subject-nothing-prints-and-nothing-checks...`** — no
  `watched_docs_no_match` in `src/doctor/checks.ts`.
- **`TASK-build-init-rewrite-watched-and-offer-it-from-the-doctor`** — no `--rewrite-watched` in
  the CLI; correctly still blocked (`needs: walk/106`, the item above, which is also open).
- **`TASK-the-ledger-projection-is-behind-by-construction...`** — `topUpLedger` is still called
  only from `audit.ts`, `decay.ts`, `status.ts` (CLI commands); no write-path/hook call; the
  "current vs batch" decision the task asks for is not recorded anywhere.
- **`TASK-the-stale-projection-refusal-names-a-command-and-will-not-hand-it-over`** — no
  `mycontext audit` command/copy row in `watch.js`, `ask.js`, or `decay.js`.
- **`TASK-the-projection-refusal-says-everything-twice-and-leaks-an-absolute-filesystem-path`** —
  the exact old message text is gone from the codebase (wording changed since filing), but I could
  not force a live stale-projection state in this sweep's server to see the current rendering, and
  found no dedup logic in the screens' error-rendering code. Treating as still open on the absence
  of evidence of a fix, not as confirmed unfixed.
- **`TASK-draw-the-builder-once-in-the-mockup-as-the-pattern-every-command-site-uses`** — no
  "builder" pattern/class anywhere in `docs/design/web-ui-mockup.html`.
- **`TASK-the-parity-gates-must-understand-a-screen-that-instantiates-a-pattern`** — `state: blocked`
  in its own frontmatter, blocked on the item above (also open). Not a screen item.
- **`TASK-the-tree-walker-must-ignore-the-design-s-own-PROPOSED-annotation`** — no skip logic for
  `span.prop`/`div.phd > span.verdict` found in `e2e/tree-walk.ts` or `e2e/tree-parity.spec.ts`.
- **`TASK-procedures-export-import-and-template-packs-are-the-only-three-screens-that-state-no-verdict`** —
  verified live: `#/packs` and `#/port` both render their titles with **no** verdict glyph/sentence
  after them (compare every other screen, which opens with "✅ …" or "⚠️ …"); no `pr.v`/`port.v`/`pk.v`
  keys in `en.js`.
- **`TASK-the-mockup-catches-up-with-preview-whyn-and-work-diffn-needs-a-ruling`** — mockup's
  `preview.whyn` (EN, line 2523) still reads *"Composing the fix **needs** a stable code..."*, the
  pre-app wording; the app's own string says "**binds to**". Not caught up.
- **`TASK-the-mockup-gains-a-command-block-per-procedure-card`** — app side already correct (proc.js
  comment: *"The `.cmd` block is in THIS card and the mockup draws it in the other"*). Mockup's
  sample scene still holds exactly one procedure and one `.cmd` block; genuinely can't show the
  difference until `port/94` gives it more than one. Effectively blocked, not done.
- **`TASK-documentation-two-answers-the-design-of-record-owes-the-renderer...`** — no `.md td.end`
  / `.md td.center` classes anywhere; `docs.js` comments still describe the CSP conflict as
  unresolved. Both of the two owner questions remain unanswered.
- **`TASK-styles-parity-must-compare-what-the-cascade-resolves-to-not-just-the-blocks`** — no
  specificity/declaration-order comparison logic found in `test/ui/styles-parity.test.ts`.
- **`TASK-enumerate-every-standing-refusal-in-the-ui-and-drive-the-list-to-zero`** — this is a
  process deliverable (a list + per-row rulings), not a single code change; no evidence a
  comprehensive current list exists as a corpus artifact. Not a screen item — judged on absence of
  a deliverable.
- **`TASK-every-item-everywhere-needs-a-trigger-that-explains-it-in-one-place...`** — no "Explain"
  affordance anywhere in `screens/parts.js`'s pane code (`linkId`/item-detail rendering has no
  summary trigger). Large feature, not started.
- **`TASK-a-refusal-must-state-its-unblocking-condition-where-a-gate-can-test-it`** — no condition
  checker script exists under `scripts/`. Not a screen item.
- **`TASK-carry-a-successful-simulation-to-config-as-a-pending-budget-change`** — no carry-forward
  code (URL param, "take forward" control) in `simulate.js` or `config.js`. The pending-diff-looking
  rows I initially saw on `#/config`'s Budgets pane ("6000 → 22000" etc.) are the current committed
  values vs. this repo's own live config, unrelated to any carried simulation.

---

## Duplicates

None found among the 46. Each targets a distinct file/screen/behavior; several share a root cause
(e.g., the two projection-refusal tasks, `walk/32` and `walk/33`, are two different defects in the
same message) but neither subsumes the other. No pair should be merged.

## Something broken that nobody filed

While using the screens as a person (per the owner's standing rule), two things stood out that have
no open item:

1. **The Ask screen's canned-report cap defect (`walk/100`, confirmed open above) has a twin the
   filed item doesn't mention: the canned-report result table has no "Rows to fetch"-equivalent
   truncation signal of its own either** — running "Operations by count" returned exactly 34 rows
   with a "Showing all 34" line, which happens to be honest here only because 34 is under every cap.
   Nothing on screen would tell a reader if a canned report itself got capped somewhere upstream
   (e.g., inside `apiAskSummary`'s own row limit) — a different silent-cap risk from the one `walk/100`
   already names for the *filter* cap.
2. **The Composer's glob tester counted 1,149 total repository files against a corpus of 894 items**
   — a large gap (paths outside `.my_context/items/`, e.g. this repo's own source, docs, tests). That
   is almost certainly correct behavior (the tester globs the whole repo, not the corpus), but the
   screen never says which universe the count is against, and a reader could plausibly read
   "176 / 1,149" as "176 of my corpus's 894 items" — a candidate for the same disclosure class the
   Ask/audit-cap items are about. Worth a look, not filed.

## Screens I could not reach or fully verify

- **The stale-projection refusal's live rendering** (`walk/33`) — I did not force `.audit/audit.db`
  to fall behind its log inside my own server's short-lived corpus snapshot, so I could not see the
  current wording live; judged from absence of dedup code only (see STILL OPEN above).
- **The context-window marker on the Budget simulator** (`walk/8`, marked ALREADY DONE on code) —
  no live statusline sample was reachable from my own server session at test time, so the marker
  itself was never seen drawn, only its refusal path.
- **Malformed-config error states on Configure** (`walk/105`, marked ALREADY DONE on code) — did not
  corrupt `config.json` to trigger `cfg.parseErr`/`cfg.resolveErr` live, since that would touch a
  file this sweep is barred from writing to (even transiently, on a corpus this server was reading
  live). Judged from code wiring only.
- **Hebrew-language rendering** was not toured screen-by-screen (the `א/A` toggle) beyond what code
  evidence already covers for the specific items above; a full Hebrew walk of all 21 screens was out
  of scope for the time available and would be a sensible next sweep.
