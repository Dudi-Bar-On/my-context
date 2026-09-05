# EXECUTION BOARD — the single place

**Opened 2026-09-03. Rewritten 2026-09-05 to carry the whole open backlog.**

This is the one answer to *"where are we"*. Everything open lives here, grouped into
waves by what unblocks what — not by priority number, and not by who filed it.

## How to keep this document

**Every new task goes in here when it is filed.** A task that exists in the corpus and
not on this board is invisible to the only place anyone looks, which is exactly how the
project ended up with two stale boards and a report nobody trusted.

- Put it in the wave whose work it depends on, or Wave 6 if it needs the owner.
- When a lane lands, move the row and say so in the Running log at the bottom.
- The corpus is the source of truth for STATE (`mycontext ready`, `doctor`, the item
  files). This board is the source of truth for ORDER. Where they disagree about state,
  the corpus wins and this board is stale — fix it rather than arguing with it.
- Earlier waves 1–11 (2026-09-03/04) are in git history; every row in them is closed.

## Where we are — 2026-09-05

| | count |
|---|---:|
| Tasks done | **481** |
| Open | **89** |
| — needing the owner | **48** (46 `walk` + `port/98` + `port/99`) |
| — lane-able | **41** |
| In flight right now | 9 |

**v2.0 is every open task.** The in/out cut of 2026-09-04 proposed excluding 46; the owner
declined it on 2026-09-05 (`DEC-v2-0-is-everything-still-open-and-the-in-out-cut-s-forty-six`).
Nothing was ever applied to the corpus, so the exclusions existed only in that report's prose.

Health: suite 6419 tests / 0 failures · `tsc` 0 · doctor 0 errors, 2 acknowledged warnings.

---

## In flight — 9 tasks, three lanes

| ref | what it is |
|---|---|
| `live/12` | The page can load newer code than its server, so a working feature looks broken |
| `live/13` | A broken config is disclosed on one screen, not the others a reader meets it on |
| — | The zero-data view: an empty ledger renders as though it were unmeasured |
| `ui2/11` + `walk/127` | The Review queue screen — draft-queue half unbuilt, `writeBlock` missing. **Same screen, two ids** |
| `ui3/11x` | The provenance strip never renders its projection group |
| `ui3/11x` | A cost bar measured against a total no row can reach |
| — | The tier ribbon needs per-line index costs and an ordered view |
| `ui1/17b` | A required chart cannot be drawn — two facts never reach the page |

---

## Wave 1 — the conversation archive, in its own stated order

The largest genuinely new capability left. Steps 1 and 2 are worth landing alone: they make
the data reachable and testable **before any pixel is drawn**.

| ref | what it is |
|---|---|
| `archive/1` | Index one row per conversation, rebuildable by scanning transcripts on disk |
| `archive/2` | Two read-only endpoints — the list, and one transcript. Bounded |
| `archive/3` | The screen: list → transcript → folding and search, prompts distinct from answers |
| `archive/4` | `mycontext conversation export`, on the approval boundary |
| `archive/5` | An export opens in the viewer, **marked as exported** |

## Wave 2 — things that lie, or cannot be checked

| ref | what it is |
|---|---|
| `rulings/64` | **Citation rot** — 862 of 1,198 citations moved, 5 broken. The red gate blocks other work |
| `rulings/38` | Changing what a plan quotes breaks its quotations — the *cause* of `rulings/64` |
| `rulings/47` | Design-file references are not checked at all; six code references are wrong |
| `rulings/65` | `lesson-accept` creates a rule with **no summary** — the one creation path that never asks |
| `rulings/53` | A test states a hand-counted number for a set now derived automatically |
| `rulings/55` | A two-member set retyped by hand instead of derived |
| `port/15` | `/api/packs` and `/api/port` both expose `carries` — **same name, two types** |
| `ui2/5r` | A design note gives a correct decision a reason that is no longer true |
| `rulings/33d` | Two plan sentences are wrong about what can be recovered |

## Wave 3 — measurement and disclosure

| ref | what it is |
|---|---|
| `budget/15` | Item fetches leave no record, so whether an index line is ever followed is unmeasurable |
| `budget/16` | The pinned-tier item — **premise was false**, needs re-scoping or retiring |
| `budget/6` | While changing a setting, show what it is now and one control to put it back |
| `hooks/12q` | Five speed measurements report worse figures than the ones they name |
| `rulings/26` | When history was never summarised, say so and name the command that builds it |
| `rulings/21` | Prove the web view being on changes nothing about what the tool does |
| `handover/11` | The only way to stop handover prompts is switching the whole feature off |
| *(no plan)* | A UI fixture reuses one item id across deliveries, so a token total lies |

## Wave 4 — consolidation

The six `builder` rows were proposed OUT of v2.0 and taken back in on 2026-09-05. Every site
already works once; this replaces hand-built forms with one shared component.

| ref | what it is |
|---|---|
| `builder/4` | Let the page ask whether a composed command would be accepted |
| `builder/5` | One reusable set of command inputs, drawn the same way everywhere |
| `builder/6` | When a command is not valid to copy, say why in plain words |
| `builder/7` | Every command site uses the shared builder — three do not |
| `builder/8` | Show what a command does and what it accepts, with a worked example, in place |
| `screens/23` | Move the remaining hand-built `?` disclosures onto `lib/disclosure.js` |

## Wave 5 — needs a ruling before a lane starts

| ref | what it is |
|---|---|
| `ui3/15` | Let people type their own queries on Ask — **reverses an earlier decision** |
| `ui2/10p` | Bulk approval deliberately left out because approving is a person's act — confirm or overturn |
| `review/3` | Establish from official documentation what a skill is *for* |
| `review/4` | Judge every skill written against that standard |
| `rulings/63` | Move the demo corpus out of the working tree — **ruled**, touches 102 references |
| `hooks/22` | Survey every editor integration surface and ship sensible defaults |
| `repaint/12` | Re-derive visual expectations from what is actually drawn |
| `port/93` | Compare real screenshots against the design for spacing, colour and size |

## Wave 6 — the owner, and nobody else

By `RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done`, no lane can close these.

| ref | count | what it is |
|---|---:|---|
| `walk/*` | 46 | The screen-by-screen walkthrough |
| `port/98` | 1 | Walk every screen against the design side by side |
| `port/99` | 1 | Point the finished screens at real data and look at each |

---

## Running log

**2026-09-05.** Board rewritten to carry the whole backlog. v2.0 redefined as every open
task. Landed: the resumed-session epoch fix (86%→33% accounting), the counts plate, path-echo
elision, three MCP tools (`list_items`, `create_lesson`, `read_procedure`), and all five ASK
questions settled. Three lanes dispatched on the nine above. `RULE-a-delegated-worker-runs-no-git-command-that-touches-the`
accepted after a lane ran `git stash` on the shared tree.

**2026-09-04.** Enforcement gate on. Governing bodies delivered or named. Live per-step audit
recording. Scope coverage rebuilt and Coverage gaps merged. MYCTX corrected from 320% to 26%.
Summary basis lost its workflow fields; 563 summaries re-stamped. The v2.0 cut written.

**2026-09-03 and earlier.** Waves 1–11, all closed. See git history.
