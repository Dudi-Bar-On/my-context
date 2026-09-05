# The walk re-verify — 11 "ALREADY DONE" items, checked against their own conditions

**Method.** Read each of the 11 items in full (`.my_context/items/task/*.md`), extracted the
item's own "what implemented means" / "what it owes" / "done when" sentence, and checked each
condition separately rather than treating "code landed" as the whole test. Read the source files
each item cites, followed dependency tags (`needs:`, "held open at …") to the item that was
supposed to have settled them, and checked `git log` for the deciding commits. Started my own UI
server (`mycontext ui --port 0 --no-open`, ports 2030 → 3954 → 11548 in sequence; port 58888 was
never touched) and drove it with Playwright, navigating each relevant screen and reading the live
DOM/API responses. No production code changed, no item state changed. My own server was left to
exit; nothing of the owner's was touched.

**A genuine environment hazard, recorded rather than worked around silently.** The Playwright MCP
browser used here is a shared resource. Partway through this pass, "the current tab" repeatedly
flipped to a server on port 13354/5234 that I never started and do not own, and back — another
lane's own verification session, sharing the same browser process. I never clicked, typed into, or
navigated that foreign tab; every interaction was confirmed against `browser_tabs list` immediately
before acting, and I opened a dedicated tab of my own once the collision was clear. This is the
same class of hazard the brief's "four other lanes are writing right now" warning names, one layer
lower than the file system: two independent lanes can share not just the working tree but the
browser instance driving it. Noting it here because a future lane hitting the same symptom should
recognise it immediately rather than lose time diagnosing it as a bug in the product under test.

**A second, expected hazard: the corpus and the code moved under me throughout.** Server restarts
("this page is newer than the server answering it") had to be redone three times as concurrent
commits landed; my own UI token was evicted once by another lane's server restart (the known
`ui-sessions.json` cap-of-8 eviction issue) and I restarted my own server to recover, per the
brief's own instructions. `/api/tutorials` visibly changed shape (six rows → ~30 manifest entries)
between the time item 1's evidence was written and when I re-checked it, live, mid-session.

---

## Per-item verdicts

1. **`TASK-tutorials-what-the-screen-is-and-what-implemented-means-for`** — **NOT DONE** (regressed
   live, mid-flight). Condition: *"the six job-titled rows … drawn from something a gate can
   check … and the owner's answer to whether tutorials are in scope at all."* The scope question
   IS now answered — `REQ-the-ui-serves-and-browses-the-tutorials-and-the-tutorials`
   (`docs/superpowers/specs/2026-09-05-tutorials-are-served-and-browsed-design.md`), an owner
   requirement dated today, settles it: tutorials are in scope, one-per-feature, served through a
   manifest and a real reader. But that decision triggered a live rebuild (`plan:tuts`, seq 1
   `state: doing`, seq 3 `state: todo`) that is **actively breaking this exact screen** as I
   watched: `GET /api/tutorials` now answers ~30 manifest rows (all `unmeasured` — the new
   per-feature `.md` files don't exist on disk yet), and `screens/tut.js` still hard-expects
   exactly six. Live result on `#/tut`: *"Refused. tut: /api/tutorials answered without a six-row
   tutorials array."* The item's OWN worked-example status (named as PARTLY DONE in the brief) is
   confirmed, but the ground has shifted under it since the brief was written — it is worse than
   "prior question unanswered," it is "prior question answered, and the rebuild it authorized has
   not caught up with the screen that reads it yet."

2. **`TASK-review-queue-what-the-screen-is-and-what-implemented-means`** — **PARTLY DONE — the work
   looks complete, the board disagrees.** Condition: *"both queues drawn, all four settlements
   reachable, per-field staleness expressed as the row's own shape, and the word-level diff … either
   built ONCE … or the promise corrected."* Live on `#/work` (empty queues on this corpus): both
   "Drafts awaiting a decision" and "Revisions proposed" sections draw honest zero-sentences ("None
   — everything captured is already settled" / "None — nothing has been proposed yet"), and the
   field table's caption now reads *"a line-level diff, not a paragraph to compare by eye"* — the
   promise was **corrected** (word-level → line-level), matching the condition's second option.
   `work.js` code confirms all four settlements are catalogue-backed (`SETTLEMENT.revision[verdict]`
   / `SETTLEMENT.draft[verdict]`, both Accept/Reject). Commit `a18b804` ("the Review queue was
   already built…") describes exactly this being verified by a person, bilingually, with RTL. **But
   that same commit set the item's own `state` from `done` back to `doing`**, and no later commit
   moved it forward — current committed state is `state: doing`. Per this corpus's own
   `RULE-a-task-is-not-done-until-its-state-says-done`, the board itself says this is not finished,
   even though every condition the item names appears satisfied. Flagging the state/reality mismatch
   rather than resolving it — that is the owner's call, not mine to edit.

3. **`TASK-composer-what-the-screen-is-and-what-implemented-means-for`** — **DONE.** Condition:
   *"every catalogue entry reachable through pickers … the glob tester answering from the server …
   no control that can compose a withheld flag … the count line and the dead-scope sentence … held
   open at plan:screens seq:10s."* Live on `#/palette`: real catalogue picker (id/finding inputs,
   argument chips), and a live glob tester — typed `**` → `1,165 / 1,165` with the real file list and
   the keyed sentence `pal.globn` ("Uses the `globToRegExp` cache, over `listRepoFiles`" — a stated
   server mechanism, not a browser re-match); typed a nonsense pattern → `0 / 1,165` and the
   **dead-scope sentence rendered live**: *"An item scoped to this pattern would govern nothing — it
   matches no file in the repository. `doctor` reports that as `dead_scope`."* Both `pal.globn` and
   `pal.globDead` are real keys in both `en.js`/`he.js`, not literals. The "held open at seq:10s"
   clause is resolved: seq:10s's own text says these two facts were reconciled and now DO have
   words (`pal.globn`/`pal.globDead`) — the "held open" was a forward pointer that has since landed.

4. **`TASK-template-packs-what-the-screen-is-and-what-implemented-means`** — **DONE.** Condition:
   *"the four cards served … isolation … and the three counts … quarantined, dropped and missing …
   given words, held open at plan:screens seq:10s."* Live on `#/packs` (Hebrew, this corpus has 0
   imported packs): all four cards render — where it lands (`init --pack`/`pack import`, both
   → draft, no `--trust` flag), what a pack may carry (travels/never table), integrity (fingerprint/
   version/discovery/update + "what the fingerprint does not prove"), and the corpus join, correctly
   reading *"Showing all 0"* — a measured zero, not a silent absence. `packs.js`'s own header
   explains, with reasoning, that `missing`/`quarantined`/`dropped` are **deliberately** drawn as the
   endpoint's own field-path names in a `.m` cell rather than invented English sentences — "inventing
   a key is forbidden" — which is the "given words" bar this item asks for, just not in prose form.
   That is a documented, reasoned choice (not an oversight left over from seq:10s).

5. **`TASK-configure-the-three-sentences-that-tell-a-reader-their`** — **DONE, on code; not
   re-forced live (by design).** Condition: three sentences (`config.parseError`,
   `config.resolveError`, `skippedNotice`) keyed rather than raw English. `cfg.parseErr` /
   `cfg.resolveErr` exist in both `en.js`/`he.js`; `config.js:1208-1237` wires them through
   `errorNote`, which frames the loader's own message (untranslated, on purpose — "WHAT the loader
   found is the loader's to say and is shown as it arrived") beneath a translated frame sentence.
   `skippedNotice` is drawn at `:1237` whenever `skippedKeys.length > 0`. The blocking dependency,
   `walk/92` ("thirteen modules still refuse to key a string"), is `state: done`. I did not corrupt
   `.my_context/config.json` to force the live error state — that would be a write this pass is
   barred from making, the same restraint the original sweep took.

6. **`TASK-doctor-draws-a-card-headed-error-containing-nothing-which`** — **DONE.** Condition: an
   empty level says so in a keyed sentence rather than a bare heading. Live on `#/doctor` (Hebrew),
   this corpus's ERROR card: *"נבדק — אין כאן ממצאים"* = **"Checked — none here."** — not a bare
   "error" heading. Confirmed live, matching the sweep's earlier finding.

7. **`TASK-doctor-cannot-tell-a-finding-a-command-could-clear-from-one`** — **DONE.** Owner ruling's
   "done when": `Finding` carries `fix`; findings with a mechanism offer Execute; findings without
   one state why in a keyed sentence; no bulk fix control. Live tally (corpus moved slightly since
   the sweep, now): *"findings: 50 · with an automated repair: 0 · yours to settle: 50 · already
   ruled on: 9 · notes about the checks: 5."* Every finding row I read carries its own "why no fix"
   reasoning inline (e.g. a `reference_no_source` row explains why no command can clear it and names
   `mycontext add reference … --file` as the human fix), and acknowledged findings draw "Already
   ruled on" with their own `mycontext ack` row. This corpus currently has **zero** findings with an
   automated repair, so I could not see a live Execute button on a fixable finding — same gap the
   sweep noted, still true, and stated here rather than assumed away. The disclosure half (the "why"
   sentence, the "already ruled on" treatment, the tally's own breakdown) is fully confirmed live.

8. **`TASK-one-doctor-message-does-two-jobs-so-58000-characters-of-the`** — **DONE.** Condition: the
   per-item message states the finding alone; the shared explanation is drawn once per code group.
   Live `citation_form` rows now read as short, per-item sentences (*"1 citation(s) point by line
   number and carry no fragment — docs/TUTORIAL-ADVANCED.md:216."*) with no repeated teaching
   paragraph attached to each row — a sharp contrast with the item's own measurement (943 identical
   characters × dozens of rows). Code (`doctor.js` ~525-560) confirms the mechanism is general
   (computed backward from the shared suffix, cut at a sentence boundary, applied to **any** code
   with ≥2 messages sharing ≥`SHARED_MIN` characters) rather than special-cased to `citation_form` —
   exactly what the item asked ("measure the others, don't assume this one is special"). This
   corpus's live `citation_form` count has fallen to 2 rows (the backlog the task itself predicted
   would shrink as `plan:walk seq:69` lands), too few to see the shared-tail disclosure box trigger
   live in this exact session; the mechanism and its guards are confirmed in code.

9. **`TASK-proc-scatter-the-disclosures-back-beside-the-cards-they`** — **DONE.** Condition: each
   disclosure sits beside its own card; only the screen-wide one may stay collected at the foot.
   Live on `#/proc` (Hebrew): the section holds exactly **4** `.card.pane` elements total (1 states
   table + 2 inside a two-column wrapper ["who may check a box" and the lifecycle card] + 1 at the
   foot) — down from the 5 the item names as the defect. The 4th, foot card's entire content is:
   *"Progress is recorded per workspace, not per session — two terminals on this environment share
   one set of records"* — exactly, word for word, the one disclosure the item names as the only one
   allowed to stay collected. Nothing else remains piled at the bottom.

10. **`TASK-the-mockup-s-hebrew-contradicts-its-english-in-two-places`** — **PARTLY DONE — the
    named fixes landed, the named open question did not get answered, and it got worse.** Both
    contradictions are fixed: `docs/design/web-ui-mockup.html`'s Hebrew `port.sub` now reads "נבנה,
    והמסך הזה מדווח על כך" (matches EN "Built, and this screen reports it"); `pk.trustn` now argues
    the corrected claim instead of the superseded one. Both extensions landed too, in the **shipped
    app tables**: `cfg.nocmd` Hebrew now carries the actual quoted deny-hook sentence; `dv.mdnote`
    Hebrew now carries the raw-HTML/image/unknown-URL-scheme refusal clause, matching English in
    full. But the item's explicit "also open" question — *"the `preview.whyn` / `work.diffn`
    question is answered rather than left"* — is **not** answered, and the underlying gap has
    widened: the mockup's Hebrew `work.diffn` still asserts the diff is **{b: at the word level}**,
    while the shipped app's `work.diffn` (verified live under item 2, above) now correctly says
    **line-level** — a real, substantive disagreement between the design of record and the product,
    not just an emphasis question anymore. I found no decision or ruling item settling this. A
    related but separate open item (`TASK-the-mockup-catches-up-with-preview-whyn-and-work-diffn-
    needs-a-ruling`) already carries this as still-open work.

11. **`TASK-anchor-the-simulator-on-the-real-context-window-from-the`** — **DONE, and seen rendering
    live** (the one gap the original sweep explicitly could not close). `GET /api/watch/context`
    answered a real, `state: "known"` sample this session (`usedTokens: 951325`, `windowSize:
    1000000`) — reachable this time, unlike the sweep's attempt. On `#/simulate` the window line
    drew live with real numbers: *"70,000 tokens in the five budgets together, out of a window of
    1,000,000 tokens — 7% — and 930,000 tokens remain to work in, above the 25% work reserve this
    screen keeps"* (● chip, `sim.winOk`), and directly beneath it the full-window disclosure:
    *"This cannot take effect in the window you have right now. 951,325 of 1,000,000 tokens already
    used, 48,675 remain, and the five budgets are requesting 70,000. Run `/compact` or `/clear`
    and the 29 items at `jit` level will arrive."* Screenshot captured
    (`sim-window-marker.png`). All three honesty constraints hold in what rendered: the marker is
    absent-and-named when unmeasured (code, `win === null` → `sim.winNone`, unchanged and
    unexercised here since a sample WAS available); the message keeps `usedTokens` (whole session)
    visibly distinct from `myctx`'s own share and from the candidate budget total; and the budget
    total and the free-window figure are stated as two different numbers, never merged.

---

## Summary

**Survive as genuinely DONE: 6 of 11** — #3 (Composer), #4 (Template packs), #6 (Doctor empty
card), #8 (Doctor message split), #9 (Proc disclosures), #11 (Simulator window anchor, now also
*seen* rendering live).

**DONE on code, not forced live by design (same restraint the original sweep took):** #5
(Configure error sentences) — the live trigger would require corrupting `config.json`, a write this
pass is barred from making.

**PARTLY DONE — 3:**
- #1 Tutorials — the scope question this item was waiting on IS now answered (owner requirement,
  today), but that answer triggered a live rebuild that currently leaves the screen **refusing**
  ("answered without a six-row array") rather than closer to done. Not a stale finding — reproduced
  live, this session.
- #2 Review queue — every stated condition appears met (live + code + the closing commit's own
  testimony), but the item's own `state` tag reads `doing`, not `done`, as of the current commit.
- #10 Mockup Hebrew — the two contradictions and two translation gaps named are all fixed, in both
  the mockup and the shipped tables; the item's own "also open" question about `preview.whyn`/
  `work.diffn` was left unanswered, and the underlying fact (word-level vs. line-level diff) now
  actively disagrees between mockup and app.

**Needs an owner ruling — 1:**
- #10's second half: *does the shipped English table gain new emphasis to match the mockup's
  pre-approved Hebrew placements on `preview.whyn`/`work.diffn`, or does the mockup's Hebrew (and
  English) get reworded down to match the shipped, unemphasised app strings — and separately, since
  the app's diff is now line-level, does the mockup's `work.diffn` get corrected from "word level"
  to "line level" as part of the same pass?* No item answers this; it is explicitly still open,
  named by its own sibling task.

**Could not verify live, with reasons stated rather than guessed:**
- #5's actual error rendering (`cfg.parseErr`/`cfg.resolveErr` triggered by a malformed
  `config.json`) — would require a write this pass is barred from making. Judged on code wiring.
- #7's Execute-button path on a *fixable* finding — this corpus currently has zero findings with an
  automated repair (`with an automated repair: 0`), so no live example exists to click through. The
  "no automated repair, and here is why" path IS confirmed live, on every row.
- #8's shared-disclosure box rendering for `citation_form` specifically — the live `citation_form`
  count on this corpus has fallen to 2 rows since the item was filed (the backlog it names is
  genuinely shrinking, per its own prediction), which may be below the mechanism's practical
  trigger threshold in this exact session. The mechanism and its three guards are confirmed in code.
- #1's downstream implementation quality — the concurrent `plan:tuts` rebuild is mid-flight; this
  report describes the state as observed at one point in time and it will be stale by the time it
  is read, by construction.

Screenshots taken during this pass, under `reports/2026-09-05-walk-reverify-screenshots/` (not
committed): `work-screen2.png` (Review queue, item 2), `palette1.png` and `palette-deadscope.png`
(Composer, item 3), `packs4.png` (Template packs, item 4), `proc1.png` (Procedures, item 9),
`sim1.png` and `sim-window-marker.png` (Budget simulator, item 11).
