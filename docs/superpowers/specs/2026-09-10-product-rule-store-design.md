# The product rule store

**Status:** design of record, awaiting owner review.
**Brainstormed:** 2026-09-10, with the owner, over one session.
**Not started.** No code exists. No D number is assigned yet.

---

## 0. Where this came from, and what it is NOT

The owner raised it while ruling on a doctor finding: a stand-down note was
making a retired item's summary read stale, and the fix — excluding lifecycle
notes from the summary basis — is **a fact about how my_context works**, not a
choice this project made. He said it should be *"hardcoded in mycontext itself
and not as a corpus item"*, and then went further:

> *"we need to have such place maybe the skill or other permanent place that will
> be in context from day 1 all the time — we should brainstorm this and look and
> collect relevant rules and instructions that are candidates to be written there
> and also a mechanism that will let us query and maintain this list of constant
> rules instructions declarations — it should be part of the product but not
> accessible to mycontext user but only to me as the owner and developer."*

**It is NOT a second corpus.** The corpus holds knowledge that changes: decisions
get superseded, tasks get done, questions get answered, items decay. This store
holds **constants**. Nothing in it has a lifecycle. That is the whole reason it
is separate rather than a category.

**It is NOT a skill.** A skill is *pulled* — the model reads a description and
decides whether to load it. `2026-09-08-self-improvement-loop-design.md` §13
argues at length that pushed knowledge is what makes my_context different, and
that a pulled artifact is mostly inert when it is wrong. The same argument makes
a skill the wrong shape here.

**It is NOT documentation.** Documentation is read by someone who goes looking.
This is present whether anyone looks or not.

---

## 1. The problem, measured

Three measurements taken during the 2026-09-09/10 run, each independently a
reason for this store to exist.

**① Rules that govern this project spill, and a rule that spills cannot be
obeyed.** `doctor`'s `governing_spill_pressure` reports **twelve governing items
that have each spilled 20+ times**, led by:

    STD-a-summary-is-one-plain-sentence-for-someone-who-does-not      482
    REQ-an-item-s-body-can-be-read-as-a-short-numbered-summary-from   443
    REQ-a-served-page-reflects-the-corpus-as-it-changes-without       432
    RULE-do-not-accept-a-test-that-passes-in-isolation-and-fails      428

The most-spilled item in the corpus is **a rule about the shape of every summary
ever written**. It needs to be present at the moment of writing, every time, and
it is competing for budget against everything else the workspace knows.

**② "Pinned, therefore delivered" is already false.**
`RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none` is pinned,
and `CLAUDE.md` says it is delivered every session. Measured over 36,024 audit
records: **71 deliveries, all `jit` and `subagent-start`, none at
`session-start`** — because only **54 `session-start` records exist in 23 days**,
against **1,082 `subagent-start`**. The rule is reaching delegated workers and
not session starts, and nothing said so until the instrument was built.

**③ 918 of 1,076 items are not injectable by construction**, because `select`
admits only normative-tier categories. The corpus is not the right home for a
fact about the product: most of it can never be delivered at all.

**And the cost is visible in the daily work.** Every lane brief written during
that run carried roughly forty lines of the same constraints — the server on
58888, never `git add -A`, prove by removal, both browser projects, no `##`
headings in an item body. **Lanes still tripped on them**, and the coordinator
still occasionally got one wrong. That repetition is the gap this store closes.

---

## 2. The failure it must not become

**A second place to look that disagrees with the first.**

`CLAUDE.md` opens by describing exactly this defect, measured on 2026-09-07: two
boards each claiming to be the single place, two comment blocks in `e2e/app.ts`
asserting opposite things about which corpus it uses, and **five superseded
instructions being acted on as current** because a document repeated one after it
had been reversed. Its conclusion is the rule this design inherits:

> *A copy cannot be superseded; only the original can.*

So: **an entry lives in exactly one place.** Migration into this store retires
the corpus item it came from (§15). Nothing is duplicated "for now" without an
end date (§8.3).

---

## 3. Two tiers

Each entry is marked **`product`** or **`developer`**.

| tier | applies | reaches a user |
|---|---|---|
| `product` | always, in any workspace | yes |
| `developer` | only when the workspace being worked on IS my_context | no |

**Why two rather than one.** A fact like *"an item body stops at the first `##`
heading"* is true for anyone who installs the tool. A rule like *"never
`git add -A`"* is how this repository chose to work; in a stranger's project it
may be wrong. Shipping the second kind as the tool's law is indefensible;
withholding the first kind leaves the manual unwritten.

**New entries default to `developer`.** The blast radius of a misfiled developer
rule is one workspace; a misfiled product rule ships to everyone.

**Both directions are supported.** The maintenance tool moves an entry between
tiers, so a misfiling is a correction rather than a migration. Owner ruling
2026-09-10: *"there should be an option to move rules back and forth between
developer and product tiers"*.

**Tier is also the removal mechanism** (§10): demoting a `product` entry to
`developer` takes it out of the shipped set without deleting it or losing its
history.

---

## 4. Five kinds, and a template for each

| kind | answers | required parts |
|---|---|---|
| `fact` | how the tool behaves | what is true · what breaks if you assume otherwise |
| `prohibition` | what must not be done | the prohibition · **why** |
| `procedure` | how something is done | ordered steps · how you know it worked |
| `standard` | how something must LOOK | **trigger** (§5) · the shape · an example |
| `definition` | what a word means here | the term · its meaning · what it is confused with |

**A template per kind, not one template for all five.** Each kind carries a
different obligation, and a single shared template is either loose enough to
enforce nothing or forces empty fields — and an empty required field teaches
people to write filler.

**The `why` on a prohibition is load-bearing.** An unreasoned prohibition gets
rationalised away the first time it is inconvenient. This is not theoretical:
`archive/47`'s lane recorded that four separate lanes worked around a red gate
because it was labelled "known-red" with no reason attached.

**The template is the schema, the check AND the form** (§11). One thing, not
three that can drift: a `prohibition` without a `why` does not load, does not
validate, and cannot be saved in the maintenance UI.

**And a template makes the store checkable rather than advisory**, which is the
central finding of the self-improvement design (§4 there): TRACE compiled
corrections into runtime checks and cut preference violations from 100% to
**37.6%**, where memory-style prose capture left **57.5%** violated. The
difference was not capture or approval — it was that the artifact was
**executable and enforced**.

**Rejected kinds, and why:** *anti-pattern* (it is a prohibition with a reason —
one idea in two places), *boundary* (also a prohibition), and mirroring the
corpus categories (imports a lifecycle these entries do not have, plus categories
that would always be empty).

---

## 5. A standard names when it applies

A `standard` declares its **trigger** — the act it governs. *"Reporting task
progress."* *"Writing an item summary."* *"Asking the owner to decide."*

Everything in the store is present at all times (§8); the trigger does not gate
delivery. It answers a different question: **which of several format rules
applies to what I am doing right now.**

Owner ruling 2026-09-10: it *"defines when it applies and gives us the freedom to
define different standards that relate to similar subjects but are applied
differently according to a case or a state"*.

**And it is what makes obedience measurable** (§14): a trigger names the moment,
so a check can ask whether the shape held at that moment. Without it, "was this
standard obeyed?" has no anchor.

**Not path scope.** Corpus items scope by file glob. A format standard governs an
ACT, and most of these acts touch no file.

---

## 6. The owner's own words, recorded verbatim

Every entry carries a **`request`** field: the free text the owner wrote when he
asked for it, **before** any body or summary was derived from it.

Owner requirement 2026-09-10:

> *"the user request prompt in free text should be also documented in the item
> before it's body and summary created, it will ease the user understanding about
> what the rule or instruction or other item type is because it was written by
> it's own words — this property is for documentation only and should not be
> injected to the context."*

**Rules for it, and each one matters:**

- **Verbatim, including the mess.** The value is that it is *his* words. Tidying
  it destroys the point. This project already quotes him verbatim in item bodies
  for the same reason, and twice during the 2026-09-09 run an item was saved by
  having the exact phrasing rather than a paraphrase.
- **Never injected.** Documentation only.
- **Never in the summary basis.** It is not part of what the entry says.
- **Never edited after the fact.** A correction is a new request, appended.

---

## 7. The store itself

**A separate directory inside the package, with its own loader.** Not a category
in the corpus.

**Why not a category.** If the corpus *knows* about it, then `list`, `ready`,
`doctor`, the tier budgets, decay, supersede and the injection selector each need
an exception — and every exception is a place to leak. A store the corpus has
never heard of needs no exceptions anywhere. `doctor` walks directories; it
simply never walks this one.

**Same file shape, narrower schema.** Markdown with frontmatter, as items are:
one parser, one renderer, one discipline, and the existing tooling already reads
it. But no `status`, no `supersedes`, no `always`, no decay, no `valid_until` —
these are constants, not items with a life.

**Not encrypted.** Encryption protects secrets from readers; these are rules, not
secrets, and the product ships as readable source with no build step. Encrypting
the rules while shipping the code that obeys them is theatre, and it costs
reviewability — the exact property whose loss made a NUL byte in
`conversation-secrets.ts` dangerous on 2026-09-09 (git classified the file as
binary: no diff, no review, unresolvable merge).

**Invisible by absence, not by obscurity.** A user does not see these entries
because they are not in the user's corpus, not in the user's lists, and not
spending the user's budget — not because they are hidden from someone who looks.

---

## 8. Delivery, and proving it arrived

### 8.1 The doors

Injected at **every door an agent starts through**:

- session start — new, resumed, **and compact-restore**
- `PreCompact`
- **subagent start**

Owner's instinct, confirmed by measurement: *"every relevant hook that occurs
after a context window change"*. The correction the measurement adds is which
door carries the weight — **1,082 subagent-starts against 54 session-starts**
(§1②). A design guarding only session start would be guarding the rarest event.

### 8.2 "Verify it is in memory" is not possible — and what is

Nothing can inspect a model's context window. **What is verifiable is that we
injected at every door and none was missed.**

So: each injection is **recorded**, and a later hook **asserts** the current
session has had one. That yields a count instead of a promise, which is precisely
the instrument that exposed §1②. A store that claims to be always present without
a number behind it is making the same unmeasured claim `CLAUDE.md` makes today.

### 8.3 Lane briefs

The store replaces the repeated constraint block in dispatch briefs — **but not
yet**. Owner ruling 2026-09-10: keep injecting AND keep writing them for now,
because *"maybe there are relevant pinned items that should be injected to
subagents and especially if there are jit and scoped items"*. The store does not
replace those.

**The duplication has an end date**, because §2 forbids a second copy without
one: when the store is production-grade (§15) and injection is proven to arrive
(§8.2), the repeated block comes out of the briefs. Until then, a brief must be
written against the store and **must not repeat what the store already says**.

---

## 9. Precedence

**A product entry wins, and the conflict is reported.**

A product fact is not negotiable — *"a body stops at the first `##`"* is true
whatever a user believes. But losing silently teaches a user their rule is being
obeyed when it is not, so the disagreement is surfaced.

This adds a fifth source to
`STD-the-precedence-order-when-four-sources-of-truth-disagree`, and that item
must be updated in the same act rather than left to disagree with the product.

---

## 10. Budget: governed at maintenance, enforced at publish

The owner's design, and it is better than the first proposal.

- **Production never refuses.** In a user's install, **everything in the store is
  injected, no exception.** A user's install failing because *our* store grew is
  a self-inflicted outage they can do nothing about.
- **The maintenance tool shows the numbers**: total size of the `product` tier
  against a recommended budget, the `developer` tier's total shown but **not
  counted** (it never reaches a user, so counting it measures the wrong thing).
- **Per-entry size is computed on the fly, never persisted.** A persisted size is
  a cache that goes stale silently. Same lesson as `archive/37`, where the day is
  derived once so the filter and the printed stamp cannot disagree.
- **The budget is changeable** by the owner, not a constant in the code.
- **Removal is demotion**: moving an entry from `product` to `developer` takes it
  out of the shipped set, reversibly.

**And one machine gate, which is this design's own addition: publishing refuses.**
If the only thing preventing spill is discipline at maintenance time, that is a
human gate on a machine problem — the shape that already failed for the corpus,
where items were pinned one at a time, each reasonably, until twelve of them
spill and one does so 482 times. So **the publish step (§11.3) fails when the
production tier is over budget and names what to move.** It can never hurt a
user, because a user never runs it.

---

## 11. The maintenance tool

### 11.1 It does not ship

`package.json`'s `files` already keeps `scripts/` out of the published package;
the same mechanism keeps this out. **A user does not fail to access the tool —
they do not have it.** That is why §11.2 can skip authentication honestly.

### 11.2 Its own server

- Its own process, **its own port**, never 58888 (the owner's UI server), a free
  port chosen at start.
- **Bound to loopback only.** This is not a security investment; it is one
  argument that prevents the tool being reachable from the network.
- **No authentication.** Owner ruling: it is used for a short time and then
  closed. Safe *because* §11.1 means the surface does not exist anywhere else.
  **If it ever ships, this section is void and must be revisited.**

### 11.3 What it does

- **CRUD over entries**, as a real editing surface: structured fields,
  selections, and **text areas large enough to write prose in** — entries here
  are paragraphs, and a one-line input produces one-line thinking.
- **The form is the template** (§4). A `prohibition` form has a `why` field and
  will not save without it. Schema, check and UI are one thing.
- **Fields the owner writes** (request, ruling, tier, kind) and **fields the
  assistant generates** (summary, checksum, identity) — the division items
  already use, pointed at a different store.
- **Move between tiers**, both directions.
- **Query**: list, show and search, in the tool and from a developer-only CLI.
  **Not queryable by an agent at runtime** — that would make the store *pulled*,
  which §0 rejects.
- **Publish** (§12).

The Composer is the UI precedent, with one difference: the Composer *composes a
command for a person to run* because it lives in a shipped UI under
`test/ui/no-writes.test.ts`'s one-writer rule. This tool does not ship and writes
directly.

---

## 12. Versioning, publishing, and updating a live corpus

### 12.1 The store is versioned independently of the product

Owner requirement: publish an update **from the maintenance tool**, without
cutting a product release. So the store carries **its own version and its own
changelog**, and a store update is an artifact a user's install can take on its
own.

*(The general product-update mechanism — how an install receives any update — is
a related subject the owner has explicitly parked. §16.)*

### 12.2 Publishing

- Shows a **diff** of what changes, and **asks** before it goes. Publishing is
  outward-facing and hard to reverse.
- **Regenerates the integrity manifest** (§13).
- **Refuses when the production tier is over budget** (§10).

### 12.3 A store update under a running session

A subagent starts fresh and simply receives the new store. **Only a long-running
session holds a stale copy** — and text cannot be removed from a context window.

So the remedy is a **correction injected as a replacement**:

- **Session-scope doors only.** A subagent does not need it.
- **The diff only**, never the whole store — a second full copy wastes the window
  and creates two versions to reconcile.
- **Phrased as supersession, naming what it replaces.** An update that reads as
  an *addition* produces exactly the defect `CLAUDE.md` opens with: superseded
  instructions acted on as current.
- **Recorded**, so §8.2 can measure that it arrived.

---

## 13. Integrity

The rules ship inside the package, so restoring them is a **local** operation:
if the package is intact, they are intact. The network is not a dependency.

- A **manifest with a checksum per entry**, regenerated at publish.
- **Verified at load.** On mismatch, say **which** entry is missing or altered.
- **Refuse writes, not reads.** Blocking reads punishes a user for a damaged
  install they can still recover from. This is a safety catch, not a hostage.
- **And this is not the refusal §10 forbids, which is worth stating because the
  two look alike.** §10 says a user's install never refuses **on BUDGET** — the
  store being large is our problem and never theirs. A **damaged** store is a
  different fact: it means the rules governing the write are unknown, and writing
  anyway would be acting under rules nobody can name. One refuses because we
  overspent; the other because we cannot say what is true.
- **`mycontext rules verify --restore`** — restores from the installed package
  first, the network only as a fallback.

---

## 14. Telemetry: measure obedience, not delivery

For the corpus, *"was it delivered"* is a real question, and
`2026-09-08-self-improvement-instrumentation` answers it. **For this store it is
trivially yes**: the set is small and always injected.

**So the interesting measurement is whether it was OBEYED** — and standards make
that checkable, because §5 gives each one a trigger that names the moment.

- Did the progress report put the title before the table?
- Was the summary one plain sentence?
- Did a decision put to the owner carry a recommendation?

**A rule violated repeatedly is either badly written or wrong**, and that is the
signal that improves the store's contents — which is the whole point of measuring
it at all.

**The raw material already exists.** The conversation archive (D37) indexes the
sessions, 274 lane transcripts, and the spilled tool results, and the reader that
walks them is built. Reports run over that.

**And the honest limit, inherited from D36a and restated here:** the log records
what was injected and what was written; it cannot record attention. Every figure
is a floor. A quiet run is not obedience.

---

## 15. Migration

**Once, and only when the store is production-grade.** Owner ruling 2026-09-10:
*"it should happen only once when we have the store as production grade and not
before, so we could be sure it will not mess our corpus and project; it should be
done carefully and tested that the migration process is correct, and if not it
should be reversible until what is required is fixed."*

- Each migrated rule **moves**; the corpus item it came from is **retired with a
  pointer** to its new home. One copy of the rule (§2), and the history survives.
  Retiring now also stands the item down correctly — `governance/8` and
  `contra/4` fixed that on 2026-09-10.
- **Reversible** until proven.
- **Definitions are seeded at migration** from this project's working vocabulary:
  *lane*, *spill*, *stand down*, *the corpus*, *known-red*, *the ration*, *a
  door*, *prove by removal*.
- **Candidate product entries** (facts, not choices): a body stops at the first
  `##` heading · `progress` is not a declared task field · a retired item still
  exists · `createItem`/`updateItem` are the only write paths · an unknown
  category means a possible wrong corpus.
- **Candidate developer entries**: never `git add -A` · commit with a pathspec ·
  one lane at a time when a lane drives a browser · prove a test by removal · run
  both browser projects · 58888 is the owner's.

---

## 16. What the loop may not do, and what is parked

**D36's pass may NOT draft into this store.** A product rule ships to everyone
and cannot be un-shipped; that is a higher bar than one workspace, and the
owner's approval on a corpus draft is not the same act as changing the product.
The pass drafts into the user's corpus only.

**But it may surface a candidate.** Owner ruling: if something really is a
product rule, **show it to the user**, who can send it to the owner — by email or
otherwise — for him to consider. That path is a user-facing courtesy, not a
write.

**Parked, by the owner, as its own subject:** the general product-update
mechanism — how an install receives an updated ruleset (or any update) without
reinstalling from scratch. §12.1 depends on it existing but does not design it.

---

## 17. Testing

- **The template is enforced**: an entry missing a required part for its kind
  does not load, and that is asserted per kind.
- **Tier isolation**: a `developer` entry is absent when the workspace is not
  my_context — asserted by loading against a foreign workspace, not by reading
  the flag.
- **The corpus never sees the store**: `doctor`, `list`, `ready` and the
  injection selector are each asserted to return nothing from it.
- **Integrity**: a planted mismatch refuses writes and names the entry; reads
  still work.
- **Delivery**: injection is recorded at each door, and the assertion in §8.2
  fails when a door is removed.
- **Budget**: publishing refuses over budget and names what to move.
- **The update correction**: a diff injected into a running session is phrased as
  a replacement and names what it supersedes.
- **Every assertion is proved by REMOVAL** — take the mechanism out, watch the
  test go red, restore it. Nine lanes did this on 2026-09-09/10; three caught
  their own first drafts passing with the defect deliberately reinstated.

---

## 18. Not building

- No encryption.
- No authentication on the maintenance server.
- No runtime query API for agents.
- No lifecycle: no supersede, no decay, no `valid_until`, no `status`.
- No second parser or file format.
- No cap enforced in a user's install.
