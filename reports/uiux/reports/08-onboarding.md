# Onboarding and first run — the v2.0 console at zero

**Panel seat:** onboarding and first-run design.
**Authority:** `docs/superpowers/specs/2026-08-16-web-ui-design.md` (fifth pass) and
`docs/superpowers/specs/2026-08-18-v2-decisions.md`. Where this document and the spec disagree, the
spec wins.
**Sketch:** `sketches/08-onboarding.html` — the landing screen at zero, the coverage map before and
after the recorded defect, the category census, the recovery ladder, the Configure day-one state,
and the four growth states.

**Every behavioural claim below was verified against the shipped source**, not inferred from the
docs. The verified facts that changed my design are collected at the end of each section rather than
in a preamble, because a fact only matters where it decides something.

---

## Empty states, screen by screen

### First, the thing that makes this a design problem rather than fourteen copywriting problems

The recorded defect — a fresh `init` renders the coverage map as a wall of dashed warning dots — is
usually filed as "we forgot the empty states". It is not. It is an instance of the product's own
invariant, **`INV-nothing-is-dropped-silently`**, applied to the one quantity nobody thought to
apply it to: **zero**.

> An empty region on a screen is a claim. An unlabelled empty region is an *unsourced* claim, and
> the reader supplies the missing cause themselves — always the least flattering one available:
> *"I have nothing"* or *"this is broken"*.

So the design rule is not "write nice empty states". It is: **every empty region names which of five
zeroes it is.** They have different causes, different truths and different next actions, and the
product already distinguishes all five internally — it just does not render the distinction.

| # | Zero | Means | Verified precedent in the CLI |
|---|---|---|---|
| **1** | **Empty corpus** | You have captured nothing. True zero. | `list` → `0 item(s)` |
| **2** | **Empty result** | The corpus is not empty; *this question* has no answer. | `search` → `0 item(s) match` + *"Widen it: drop a filter…"* (`search.ts:196-205`) |
| **3** | **Narrowed** | Something hid it — focus, `seen` dedupe, the session selection, a path filter. | `Selection.focus` → `FocusReport` discloses `hidden[]` and `visible` |
| **4** | **Not yet observed** | The mechanism has not run. No sessions, no audit records, empty ledger. | `status.ts:390` — *"no sessions recorded yet — decay reporting starts once items begin to be injected"* |
| **5** | **Unavailable** | Could not be read. Unreadable seen file, projection behind its log, server exited, stale token. | `seen-file.ts:16-22` — unreadable ⇒ *"inject WITHOUT dedupe and disclose"*, never a silent miss |

Zeroes 3, 4 and 5 are **false empties**: the user's instinct on seeing them is to conclude 1, and
every one of those conclusions is wrong. Zero 5 is the dangerous one — the spec already forbids one
instance of it (a rejected token must never render as an empty corpus, §2) and the same forbidding
generalises to the other four surfaces that can hit it.

**The rendering rule the coverage-map defect actually needs**, stated so it cannot recur elsewhere:

> **Suppress a per-row status marker when the value is uniform across every row *and* its cause is
> global. State the fact once, at the level where it is true.**

1,284 dashed dots are 1,284 correct renderings of one sentence. The fix is not a nicer dot. It is
*no dot*, and one sentence. The same rule protects the gaps list, the decay chart, the audit stream
and the doctor grouping from turning a normal zero into a screenful of alarm.

### The table

Wave per spec §4. "Which zero" is the taxonomy above. Every next action is either a **UI action**
(navigation or a view change — writes nothing), a **composed command** (copied into the user's own
shell, per the mutator-free rule), or **none** — and *none* is a legitimate, designed answer that
must not be papered over with an invented command.

| Screen | W | Which zero | What renders at zero | The ONE next action |
|---|---|---|---|---|
| **Injection preview** *(landing)* | 1 | **1** for content, **4** for the session | Four tier sections with their one-line definitions and budget bars at `0/6,000`, `0/1,200`, `0/6,000`, `0/8,000`. A panel reading **"No block is sent — not an empty block, none"**, because with nothing eligible `renderSelection` returns `''` and `SessionStart` writes nothing at all (`render.ts:159`, `session-start.ts:44`). Session selector offers only *cold session*, and says why (spec §3.4). | **UI:** *"Preview a file instead"* — a real `event=tool` answer from the real selector, labelled **predicted, not observed** |
| **Scope coverage map** | 1 | **1** | The tree with **no markers at all** and one sentence: *"Nothing governs this project yet. 1,284 files, 0 items — every one of them is ungoverned, which is what a repository initialised four minutes ago looks like."* Plus the bootstrap scan (below). | **Command:** `mycontext ingest <the densest candidate doc>` — with the sentence that made it a candidate shown beside it |
| **Coverage gaps** | 1 | **1** | The directory half is **suppressed** — with nothing covered there is no difference to show, and "everything is a gap" is true and useless. It degrades into the half that is still informative: **the 21-category census**, split 13 normative / 8 rationale, with what each tier means. | **Command:** `mycontext add <category> …` composed from the census row the user picks — because `type` is fixed at creation and cannot be retyped |
| **Budget simulator** | 1 | **1** | The four budgets as configured, each in tokens *and* in a physical unit (6,000 ≈ 24,000 characters ≈ a 370-line document — `config.ts:13-16`), and the one sentence that matters: *an item that does not fit spills whole and is named.* **No fabricated items to drag.** Names its own threshold: useful at ~40 items. | **UI:** Configure → budgets. (A simulator that invents items to look alive teaches a false number — the mockup's own audit is the cautionary tale.) |
| **Injected now** | 1 | **4**, and it must not read as **1** | *"No session has been recorded."* Renders the three-way distinction explicitly: seen file **absent** (never ran) vs **unreadable** (disclosed, injected without dedupe) vs **empty** (ran, got nothing). A fresh `init` creates no `state/` directory at all. | **None.** *"Open Claude in this project."* No command produces a session; the UI must not compose one |
| **Review queue** | 2 | **2** | *"Nothing is waiting. That is the healthy state, not a missing feature."* Then the trust boundary in two sentences, with this project's live per-category `agentEdits` beside it. Precedent for the wording exists: `revision.ts:688` already prints *"0 pending revision(s) on 0 item(s) — nothing is waiting for a human here."* | **None** — empty is correct. Link to Configure's `agentEdits` column for the reader who wants to know why |
| **Configure** | 2 | **not empty** | **The only screen with a complete subject on day one.** `init` writes `config.json`; the profile, 21 categories, four budgets and `watchedDocs` are all real. The *impact* column is the empty half, and it reads **"affects 0 items today, and everything you capture from now on"** | **Command:** the composed `config.json` diff. Specifically `watchedDocs` — see the finding below |
| **Audit stream** | 3 | **4** | The four record kinds as headers with their definitions and zero rows, plus the log's own facts: path, `0 bytes`, `0 records`, projection at position 0. *"The log is append-only and this is its beginning."* Worth stating here that appending costs **0.55 ms p95, flat in log size** — real, measured, shipped — because that is what makes watching free | **None.** Wait, or open Claude |
| **Ask** | 3 | **1** (corpus) / **4** (audit) | The builder stays **fully enabled**. Running a predefined query returns **"0 rows — the query ran"** with the generated SQL shown. A disabled builder teaches nothing; a builder that runs and returns zero teaches the shape of the corpus | **UI:** run the predefined *everything* query and read the SQL |
| **Status** | 3 | **1** + **4** | All counts zero, each linked to what would make it non-zero. **Do not port the CLI's bug:** at zero, `mycontext status` prints the headings `by category`, `by status`, `by origin` with *nothing under them*, because `table()` returns `[]` for zero rows (`format.ts:235`). Three bare headings is exactly the unsourced-blank failure | **None**, unless doctor found something. At zero this is arguably the most useful of the two ⚠️ exception screens, which slightly strengthens a case §4 leaves open |
| **Learn** | 3 | **2** | **The screen whose entire justification evaporates at zero.** §4 passes it *only* because every help topic cross-links to your own corpus; with no corpus there are no cross-links and it is the documentation viewer the spec says to cut. Honest handling: each topic renders, with its corpus panel reading *"your items will appear here; you have none yet"* | **None.** **And the first-run path must not route through it** — teaching happens in place (below), not here |
| **Relation graph** | 3 | **1** | An ego graph needs a focus item. Renders a *"not yet useful"* state naming when it becomes useful — when items begin to supersede and reference each other — not an empty canvas | **None** |
| **Doctor** | 3 | **5-capable** | The one screen that can carry **real findings at zero**: `not_writable`, `index_unreadable`, `index_stale` (it compares against `config.json`'s mtime too, so it fires with no items), `index_not_ignored`, `check_failed`, `audit_log_size`. If genuinely clean it must say **what it checked**: *"0 errors, 0 warnings, 0 notes across 0 findings — over 0 items and 0 relations."* Clean over zero is a weaker claim than clean over 100 and must not be rendered identically | **Command:** the repair for the top finding — or **none**, stated as *checked and clean*, with its sample size |
| **Decay** | 3 | **4** | The caveat **first**, as the CLI already does. At zero items the CLI short-circuits to *"nothing to report — no active normative items in this project yet"* (`decay.ts:177-185`); at zero sessions it prints *"(no sessions recorded yet — nothing here has been measured; 'cold' currently means only 'never injected')"*. The chart renders axes and no series | **None.** The screen names its own minimum: readable at ~20 recorded sessions, which is the default window |

**A rule falling out of the last row, worth generalising:** *a screen whose statistic needs a minimum
sample states the minimum and the distance to it.* `decay` already does this in the CLI and it is the
best honesty precedent in the product. Every chart in the UI should inherit it — including the
injection-volume series in the status strip.

**And a rule about the rail:** **never hide a screen because it has nothing to say.** The rail is how
a new user learns what the product *is*. A screen with nothing to say says what would put something
in it. Badges show `0` in neutral type; **only the review queue's badge ever turns amber**, so it
cannot be tuned out.

### What zero-zero looks like — no `.my_context/` at all

`mycontext ui` in an uninitialised repository is a **CLI-level refusal, not a screen**. `init` already
has the precedent: it refuses arguments rather than ignoring them, and it warns when an ancestor
workspace would be shadowed. `ui` should print `mycontext init` and exit non-zero. A server that
opens a store in a directory that does not exist is doing something mutation-shaped to answer a read,
and §2 spent four paragraphs on exactly that class of mistake.

---

## The first five minutes

The user runs `mycontext ui` on a repo with an empty corpus. Here is the design, minute by minute.

### 0:00 — the terminal names the zero before the browser does

```
mycontext ui: http://127.0.0.1:7333 — 0 items, 0 sessions, profile "standard".
              opening the injection preview.
```

One line, and it does real work: the user is *told* the corpus is empty by the command they ran, so
the empty page is confirmation rather than a surprise or a suspected bug. (Today `mycontext init`
prints exactly `my_context: initialized <root>` and nothing else — no next step. A one-line addition
there is the cheapest onboarding improvement available anywhere in this product, and it is outside
the UI.)

### 0:05 — first paint: the real landing screen, empty, not a splash

`route()` lands on the injection preview at `event=session-start`, per Decision 5. **No modal, no
overlay, no coach-marks, no tour.** The screen renders its true structure — four tier sections, four
budget bars at zero, and the block panel saying *"No block is sent."*

This is the single most valuable second in the whole experience, and it is free: **with zero items,
structure is the only thing on the screen, which makes the empty preview the best explanation of the
four injection tiers the product will ever get to give.** At 40 items the tiers are inferred from
where rows happen to land. At zero they are the entire content.

It is also the product's core claim, demonstrated against the user's own repository before they have
invested anything: *this is what Claude currently gets from this project — nothing.* Most users
believe `CLAUDE.md` is already doing this. Seeing the empty block is the argument.

### 0:20 — "Start here": four steps, and none of them is a step

A strip under the page header, on every screen. Four lines. And the design that keeps it from being a
wizard is not restraint — it is **the mutator-free constraint, turned into a feature**:

> **The UI cannot write, so the checklist cannot have state of its own. Every step is therefore a
> predicate over observed state, not a thing the user marks done.**

| Step | Its predicate | Ticks when |
|---|---|---|
| 1. See what this repository looks like to mycontext | `true` | immediately — *"you are looking at it"* |
| 2. Capture one, or find one you already wrote down | `items ≥ 1` | the corpus is non-empty |
| 3. Promote one draft | `queue` decreases | the trust boundary has been exercised |
| 4. Watch one arrive in a real session | an injection record names an item | the audit log says so |

Five properties make this not a wizard, and each is load-bearing:

1. **It never blocks.** The complete application is present and navigable at paint one. The strip is
   a strip; nothing is behind it.
2. **There is nothing to skip, because there is nothing to complete.** Each line is a fact. You
   cannot falsely finish it and it cannot falsely finish you.
3. **It cannot be permanently dismissed — and that is correct.** A "don't show again" would need a
   write the UI does not have. Hiding is per-tab (`sessionStorage`, already in use for the token).
4. **It retires by growth, not by dismissal.** Once step 4 ticks, or the corpus reaches five items,
   it stops rendering at all. A user who never reads it is un-nagged within their first working
   session.
5. **It never points at a control.** Every line is a sentence about state plus one composed command
   or one honest *"this needs Claude, not this page."*

**Step 4 is the honesty test of the whole design.** There is no command that produces an injection —
it requires opening Claude and touching a matching file. So the strip says exactly that, and adds the
thing only this UI can add: **it names the file in your repo that will make your item fire**, because
it holds both the tree and the scope. That is a genuine capability, offered at the exact moment it is
worth something.

### 1:00–3:00 — the door most users should go through: what they already wrote down

The empty coverage map carries a read-only scan for documents that read like they contain rules.
`mycontext ingest` accepts **any regular file under the repo root** — no extension or path
restriction — so `CLAUDE.md`, `CONTRIBUTING.md`, an ADR directory and a runbook are all fair game.

Three honesty constraints on the scan, because it is a guess:

- **Label it a guess.** *"These read like they contain rules"*, never *"we found 12 rules."*
- **Show the evidence sentence** that triggered each match, so the user judges rather than trusts.
- **Count nothing.** A number implies extraction has already happened. It has not.

**And the arc this opens is better than anything I could have designed, because it already exists:**
every candidate `ingest` writes lands as a **draft**. So the bootstrap path is

> `ingest` → the review queue becomes non-empty → the user walks it → promotes one → *sees it arrive*

which means **the newest possible user meets the normative/rationale trust boundary on their own
prose, before an agent ever tests it on them.** That is the concept the product is hardest to explain
and it teaches itself here for free. It is why Step 3 in the strip is *promote a draft* rather than
the more obvious *capture an item*.

### 3:00–5:00 — two things that are true and useful with zero items

- **The glob tester over the real tree.** Type `src/**`, watch 412 files light up in *your*
  repository. Needs no corpus, teaches scope before the user has paid for getting it wrong, and is
  the cheapest true statement the product can make about a stranger's repo.
- **The cold-session preview on a real file.** Capture one item, pick a file, and the real selector
  returns the real answer with the real token cost — labelled **predicted, not observed**.

### What five minutes cannot deliver, stated rather than faked

**You cannot see a real injection in five minutes without opening Claude.** Do not simulate one. Do
not animate one. The preview is the honest substitute and it carries its label everywhere it appears.
This is the same discipline `STD-guarantee-claims-carry-their-condition-in-the-same-sentence` applies
to prose, applied to a screen.

---

## Teaching in place

The rule: **a concept is taught where it has a visible consequence, at the moment the user is looking
at that consequence.** Not a tooltip, not a docs page, not Learn — which is W3, and whose own
justification is empty at zero.

| Concept | Taught where | Why *there* | Its zero-state form |
|---|---|---|---|
| **The four injection tiers** | The injection preview's Delivered panel — four sections, each with a one-line definition and its own budget bar | The tiers are not a taxonomy to memorise, they are four different *arrival times*; the panel is where arrival is visible | **Best at zero.** Four headers, four empty bars, four sentences — the structure is the whole screen. This is the strongest teaching moment in the product and it exists only before the user has data |
| **Scope** | The coverage map's detail pane, and the live glob tester in the palette | Scope is a claim about the file tree, and the file tree is on screen | Fully working at zero: the tester matches globs against the real tree with no corpus at all |
| **The normative / rationale trust boundary** | Three places, deliberately: **(a)** the category picker at capture — choosing a category shows *"normative: an agent's capture lands as a draft; yours governs at once"* vs *"rationale: never injected, so an agent's capture lands active"*; **(b)** the empty review queue; **(c)** the gaps census split 13/8 | `type` is fixed at creation and there is no retype, so the picker is the last honest moment. And the queue is *most* teachable when empty, because there is nothing to do and everything to read | The census teaches it with zero items, including why `known_issue` is normative despite reading like a fact |
| **Budgets and spill** | The budget simulator; the spill list under every preview | Spill is only comprehensible as *"this one did not fit and here is its name"* | Budgets shown in tokens **and** characters and lines; the sentence *"spills whole, and is named"*; and a stated threshold — useful at ~40 items — instead of invented rows |
| **Focus** | The header control, always visible; and `Selection.focus`'s disclosure inside the preview whenever a focus is active | Focus is the product's most dangerous concept because its failure mode is *silence* — a smaller delivered set with no visible cause | *"No focus is set — every eligible item is injectable"*, borrowed verbatim from the CLI (`focus.ts:135-139`) |

**One more, unlisted in the brief but earned by the verification:** `watchedDocs` is taught by being
*wrong on arrival*. Its three defaults are the plugin author's own paths, the list **replaces rather
than merges**, and on a typical repository **zero documents match any of them** — so the PostToolUse
capture nudge never fires for the docs that actually hold the rules. Configure's day-one job is to
notice that and compose the globs that match the user's real tree. A setting that silently does
nothing is the exact shape of defect this project has paid for repeatedly.

---

## Growth states

| Corpus | What changes | What the UI should proactively surface |
|---|---|---|
| **0** | Structure is the only content | *What Claude gets today: nothing.* The three documents that already read like rules. The `watchedDocs` mismatch |
| **1** | The whole product is legible from one item. Aggregates are noise; everything is a detail view | **The exact file in this repo that will make it fire**, named. And if it is unscoped, that it will be weighed on **every** file operation forever — `status` already nags this, and it is the single most useful habit the tool teaches |
| **10** | Coverage acquires a shape; gaps become a real difference rather than "everything". Two items can now say the same thing | **Overlap at capture, before the second is filed.** `type` is fixed at creation, so a duplicate under the wrong category can only be superseded. The gaps screen switches from the census to real directory gaps |
| **100** | Budgets begin to bind; spill becomes routine. Decay becomes readable once ~20 sessions exist | **From the audit log, not the corpus:** *"7 items spilled at least once in the last 20 sessions"* and *"4 items have never been injected"*. Neither is derivable from the corpus, which is precisely why they justify the screen. The coverage map begins aggregating by directory |
| **5,000** | The tree stops being renderable per file; the ego graph is capped at 60 nodes with explicit `+N more`; **cost becomes the subject** | The count of unscoped normative items — the tax on every file operation — and `doctor`'s `corpus_size_fallback_ceiling`, which only exists above 5,000 and is the one finding a corpus earns for being large. At this size **gaps and decay matter more than the map**, and the rail should say so rather than letting the user scroll a tree that can no longer be read |

**The transition nobody plans for is 0 → 1.** Every screen changes character: the tier sections stop
being a lesson and start being a report; the coverage map's suppressed markers must reappear; the
gaps census must yield to real gaps; the Start-here strip loses a line. Design the 0→1 transition
explicitly, because it is the only one every single user experiences.

---

## Recovery

### One mechanism, not three fixes: **"Why isn't this here?"**

`select()` applies its filters in a fixed order, so for any (item, path, event, session) there is
always exactly **one *first* reason** an item is absent. Naming the first is honest; listing six
suspects is noise. One component, six rungs, and it re-implements nothing:

| # | Rung | Composed fix when it binds |
|---|---|---|
| 1 | **eligible** — draft, retired, superseded, past `valid_until`, category disabled | `mycontext review promote <id> --yes` |
| 2 | **normative tier** — rationale is never injected | none: this is correct behaviour, explained |
| 3 | **focus** — hidden by an active focus (never a `severity: hard` item) | `mycontext focus --clear`, or the UI's *focus off* toggle |
| 4 | **scope** — unscoped under `scopePolicy: inert`, or scoped and not matching this path | `mycontext edit <id> --scope "…" --yes` |
| 5 | **seen** — already delivered this session; not a fault | none |
| 6 | **budget** — spilled whole, with `select()`'s own reason | Configure → budgets, or scope it tighter |

Rungs 1–4 are `injection()`, which already composes `isEligible`, the normative-tier test, `always`,
`scope` and `emptyScopeInjection(scopePolicyFor(...))` **in `select`'s own order**. Rung 5 is the seen
file. Rung 6 is `select()`'s spill reason. Nothing is re-derived — and the ladder is the same
component behind the spill list on the preview, the *"governs nothing"* line under a stale draft, and
every *"I captured it and nothing happened"* support question the product will ever receive.

### The three named cases

**An item that never injects.** The ladder, invoked from any item row. At the end, the composed fix
for the *binding* rung only.

**A scope matching nothing.** `doctor` already has `dead_scope`, but it fires in a report the new user
has no reason to open. Surface it **at the item**, and — because the UI holds the file tree — do the
one thing a terminal cannot: *"`src/payments/**` matches 0 files. `src/` matches 412 and
`src/billing/` matches 38. There is no `src/payments/` in this repository."* Nearest-matching-prefix
is a pure tree computation: no dependency, no shelling out. Compose `mycontext edit --scope`.

**A draft stuck in review.** Age it — *"pending 14 days"* — and attach the **consequence**, not the
count: *"Claude keeps proposing, nothing governs, and you pay the cost of the tool with none of its
benefit."* The queue badge is the only amber badge in the rail, which is what makes it un-tunable-out.
The tutorial names unread drafts as the failure mode this design invites; the UI's job is to make
that specific number impossible to miss.

### The fourth case, which nobody lists and which will happen most often

**The false empty: the user is looking at a narrowed view and concludes the corpus is empty.**

> **Rule:** when any screen renders zero rows *and* a narrowing input is active — a focus, a
> non-cold session with a non-empty `seen` set, a path filter, a category filter — the empty state
> **names the narrowing** and offers to remove it. Removing it is a UI-local view change, not a write.

This is zero #3 from the taxonomy, it costs nothing to build, and it is the highest-frequency recovery
in the product. `Selection.focus` already carries `hidden[]`, `visible` and `exemptHard[]` precisely
so this can be said.

### The fifth case: unavailable, never rendered as empty

Already forbidden once by the spec — a rejected token renders the reconnect state, *"this page was
opened by a server that is no longer running"*, and never an empty corpus. **Generalise the
prohibition to every zero-#5 source:** an unreadable seen file (the hook's own contract is *disclose,
never miss*), an audit projection behind its log, a missing or stale index, a corpus load error. Five
surfaces, one rule: **a read that failed is never rendered as a read that returned nothing.**

---

## Headline

The first-run problem here is not missing empty states, it is an unapplied invariant: `INV-nothing-is-dropped-silently` was never applied to zero, and a blank region is a claim the reader completes with the least flattering cause available — so every empty region must name which of five zeroes it is (empty corpus, empty result, narrowed, not yet observed, unavailable), and the wall of dashed dots is simply one true sentence rendered 1,284 times. The mutator-free constraint, which looks like the obstacle to onboarding, is what makes it good: the UI cannot store wizard state, so the guided path can only be a set of predicates over observed state — nothing to skip, nothing to falsely complete, and it retires itself by the corpus growing rather than by being dismissed. And the shortest honest path to first value runs backwards through the product: the empty injection preview is the best explanation of the four tiers that will ever exist, the glob tester tells a stranger something true about their repo with zero items captured, and `ingest` on a document they already wrote fills the review queue with drafts — so the newest possible user meets the trust boundary on their own prose, before an agent ever tests it on them.
