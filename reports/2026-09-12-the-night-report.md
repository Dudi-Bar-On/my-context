# The night report — 2026-09-11 18:25 to 2026-09-12 03:06

Nineteen commits. Three lanes, two landed and committed, one still running as this is written.
Every number below is computed from the corpus or from `git`; nothing here is remembered.

## Where the count stands

| | last night | now |
|---|---|---|
| tracked tasks | 732 | **738** |
| done | 654 | **660** |
| open | 78 | **76** (75 `todo`, 1 `blocked`) |
| percentage | 89.3% | **89.4%** |

Six closed, six filed. That is the shape of every week this month and it is why the percentage is
a throughput measure, not a distance: **the open count has moved 89 → 78 → 76 since 2026-09-05**
while five D numbers closed.

## What landed

**D41 closed** — `store/1`–`5`, all five done. The product rule store ships whole.

**`plan:rulings` triaged: 11 open → 6.** Five items closed, one partly done, five left with a
stated reason. Committed in `6c1026f8`.

**The UI server stays up.** `restartStaleServer` no longer kills before it knows a replacement
will listen. Committed in `1843e067`. Server is up now: **58888, pid 122516**.

**Twelve new D numbers, D44 to D55**, plus nine widenings, so most of the open work now sits under
a subject. Committed in `4bb0b3cd`.

**`walk/119` settled** four days late — the item stands, `ABSENT IS ABSENT` falls. **Four builder
items** closed that had shipped 2026-09-07 and never had their state set. **The anchor ruling** was
recorded in three commits, including the three creation paths and the seventh capability.

## The findings — the part worth reading

1. **A lane's uncommitted tree was reverted mid-run.** The `plan:rulings` lane lost a 25-site
   sweep, a guard test, plan corrections and five corpus closures — items back at `state: todo`.
   Not committed: reverted. It was caught only because its own guard test dropped from 24 tests to
   23. Its observation is the one that matters: **a lane that had already reported success would
   have reported a tree that no longer existed.** Root cause not established.

2. **`rulings/66` was false the day it was filed.** It says the `ui` slash command is hand-written
   against the ruling that generates them. The generator has emitted it since `cbc9c9a7` on
   2026-08-21 — fifteen days before the item was written. Third expired premise this week, first
   that never held at all.

3. **An assertion was vacuous under a rename.** `test/core/vocabulary-graph.test.ts` filters its
   mutator list against exported symbols, so renaming a mutator makes the filter match nothing and
   the test passes over an unchecked function. Proved by planting one.

4. **`PASSIVE_RELATIONS` had no guard at all**, while its own item states that a guard test asserts
   its members are exactly two. The item's belief about its own protection was false.

5. **Three things I said about the server were wrong.** Lanes were not reaping it (`stopUpkeep`
   already declines on `agent_id`; all 15 `stop` rows carry one sessionId). Staleness is measured
   against the working tree, not HEAD, so committing changes nothing. It was not a stampede — the
   restarts were 6 to 14 minutes apart and the floor held. The race is real and was reproduced;
   **the race is not what lost the server, the ordering is.** A fourth cause nobody had named: a
   `stale` stand-down gates the cold spawn, so a server that later dies is never put back.

6. **`ui --nonce` printed a redeemable credential for somebody else's corpus**, exit 0, silently.

7. **All three banners share `#exited`**, and `request()` hides it on the first ok response after a
   disconnect — so the sentence explaining a fault is wiped for up to 60 s after every reload.
   That is why the skew explanation was never seen.

8. **Automatic capture of the user's request is impossible in principle**, not merely hard: the
   request must be recorded before the body exists, and every extraction scores against the body.

9. **Left unfiled and named here:** `test/cli/statusline-chain.test.ts` showed 5 failures on one
   full run and was green alone and on the next. A pre-existing flake under full-suite concurrency.

## Still running

`recall/2` — the retrieval screen, D42's last item. Nine files in the tree, last touched 02:43.
When it lands, **D42 closes.**

## Queued behind it

`REQ-every-anchor-capability-is-reachable-from-the-screen-and-a` (hard, owner ruling 2026-09-12).
It is queued only because it touches the same four files `recall/2` holds.

---

# The grand D table — 2026-09-12, all 55 numbers

**30 of 55 closed. 25 open.** Of the 25 open, 23 carry items, one is deferred by owner ruling
(D39) and one has no item filed at all (D40). Every row below is resolved from the `state` field
of the items the map names — nothing is kept by hand.

## Closed

| D | subject | items | done |
|---|---|---|---|
| D1–D5 | doctor perf · a cancelled dependency discharged · builder re-cut · the 24 Hebrew tutorials | — ratified in conversation, never filed | ✓ |
| D7 | the audit projection index | — never filed | ✓ |
| D8 | the Hebrew RTL convention | `docsys/12` | 1/1 |
| D9 | the ins/del markers | ruled: the grammar stays at five markers | ✓ |
| D10 | four Composer pickers | — never filed | ✓ |
| D13a/b | the CLI help browser | `library/1` | 1/1 |
| D15 | the ASK display | — never filed | ✓ |
| D16 | the dependency budget | `governance/5` | 1/1 |
| D17 | the handover lag | `handover/17` | 1/1 |
| D18 | on-demand handover update (CLI, slash command, MCP) | — never filed | ✓ |
| D19 | the handover checked for truth | — never filed | ✓ |
| D20 | an id in a result opens the item pane | `builder/13` | 1/1 |
| D21 | the result card names the command | `builder/14` | 1/1 |
| D22 | Run removed from the Composer | `builder/15` | 1/1 |
| D24–D26 | the help skeleton · the worked lines · the cross-references | — never filed | ✓ |
| D29 | code citing a retired item is named | `governance/6` | 1/1 |
| D31 | the 42 walk items measured and ruled | `walk/140` | 1/1 |
| D33 | the contradiction gate | `contra/1`–`3` | 3/3 |
| D34 | restoring a session from its transcript | `restore/1`–`2` | 2/2 |
| D35 | a test declares what it rests on | `basis/1`–`2` | 2/2 |
| D36 | the agent self-improvement loop | `loop/1`–`5` | 5/5 |
| D37 | the conversation archive rebuilt | `archive/1`–`54` | 54/54 |
| D41 | the product rule store | `store/1`–`5` | **5/5 — closed tonight** |
| D43 | a lifecycle note stops making a summary stale | `governance/10` | 1/1 |

D36 is closed but shipped with `maxProposalsPerPass: 0` — it reads and writes nothing until the
owner raises it. That is a decision of his that is still outstanding, not unfinished work.

## Open

| D | subject | open items | done | note |
|---|---|---|---|---|
| D6 | the citation gate | `rulings/38`, `47`, `67` | 1/4 | |
| D11 | long pickers | `builder/12` | 2/3 | |
| D12 | the Composer tested as a user | `walk/129`, `screens/25` | 1/3 | |
| D14 | the handover re-asks at every percent | `handover/19` | 0/1 | |
| D23 | pointers not claims | `handover/16` | 0/1 | **the widening is an inference — worth your eye** |
| D27 | the help tested for truth | `library/6` | 0/1 | browser work, queued |
| D28 | both READMEs | `docsys/11` | 0/1 | needs D27 |
| D30 | the browser suite off the demo corpus | `port/99`, `port/101`, `rulings/63` | 1/4 | |
| D32 | Ask and Capture reviewed, not merged | `walk/141`, `76`, `100`, `ui3/15` | 0/4 | |
| D38 | the corpus lifecycle is enforced | `rulings/65` | 2/3 | |
| D39 | Export / import: make the screen true | — | — | **DEFERRED by owner**, below every open D |
| D40 | a contrast ratio computed against a colour that is not painted | — | — | **NO ITEM FILED.** Ruled to start when D37 closed; D37 closed yesterday |
| D42 | conversation retrieval | `recall/2` | 5/6 | **lane running now** |
| D44 | the app matched against its design of record | `port/93`, `98`, `walk/4`, `15`, `55`, `ui-gates/1`, `ui2/5r` | 0/7 | largest open subject |
| D45 | every standing refusal says what would unblock it | `walk/11`, `12`, `32`, `33`, `ui2/10p` | 0/5 | `ui2/10p` is the recorded exception, not work |
| D46 | absent is not zero — a blank says why it is blank | `screens/24`, `walk/57`, `89`, `139` | 0/4 | |
| D47 | an English sentence reaches the screen with no key | `walk/43`, `102`, `105` | 0/3 | |
| D48 | Configure composes a change, and something confirms it took | `budget/6`, `ui2/13`, `walk/14`, `18`, `106` | 0/5 | |
| D49 | the budget simulator measures the real window | `walk/8`, `59`, `ui1/17b` | 0/3 | |
| D50 | a surface built to carry an explanation, and nothing fills it | `screens/23`, `walk/39`, `119` | 0/3 | `walk/119`'s four gaps unblocked yesterday |
| D51 | a fact kept by hand in a second place, derived instead | `repaint/12` | 6/7 | five closed tonight |
| D52 | what reaches the audit record, and whether its stores are current | `walk/66`, `live/24` | 1/3 | **fold into D7? your call** |
| D53 | a delegated lane is stopped by a mechanism, not an instruction | `live/20` | 0/1 | needs your `Bash` matcher decision |
| D54 | what a skill is, and whether our 39 are skills | `review/4` | 1/2 | promote `review/3`'s draft contract first |
| D55 | mycontext helps from the first second, unconfigured | `hooks/22` | 0/1 | |

## Open tasks that still sit under no D — nineteen, not seven

The assignment commit reports seven left out deliberately, each "one task with no subject around
it". The corpus now resolves **nineteen** open tasks to no D number. The gap is not explained by
the two citation blockers the lane named, and it is reported here rather than closed quietly.

| task | state | |
|---|---|---|
| `docsys/5`, `docsys/6`, `docsys/9`, `docsys/10` | todo | four documentation-screen tasks — plausibly the D24–D26 subject, but nothing says so |
| `walk/95`, `walk/131`, `walk/134`, `walk/16`, `walk/24` | todo | Documentation, Tutorials, search, mockup, a documentation tool |
| `walk/2`, `walk/3` | todo | Procedures: disclosures, command blocks |
| `walk/82`, `walk/108`, `walk/21` | todo / **blocked** | safe-port guard · three unreached screens · the parity gates |
| `walk/142` | todo | **names two different open tasks — not a citable reference** |
| `tuts/4`, `rulings/21`, `hooks/12q`, `port/15` | todo | |

One further open task carries `plan: walk` with **no `seq` at all**, so it cannot be cited as
`plan/seq` by anything.

## Waiting on you

1. **The scale widening** — reducing a seeded twin's scale is a widening of the testing exception
   you approved, not a use of it. It took the parity walk from 7 comparable screens to 11.
2. **`OPENQ-does-a-missing-mockup-string-key-stay-a-finding-under-the`** — recommendation: keep.
3. **`port/98`, the screen review** — 33 tasks close only when you look.
4. **Fold D52 into D7?** D7 has no item reference and no recorded scope, so widening it would
   silently redirect "do D7". D52 was minted to be plainly distinct.
5. **Raising `maxProposalsPerPass` above 0** (D36) — yours, after a week of
   `state/review-last-pass.json`.
6. **`live/20`'s `Bash` matcher decision.**
7. **The nineteen un-numbered tasks above** — whether to mint, fold, or leave.
