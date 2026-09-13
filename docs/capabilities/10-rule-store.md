# Chapter 10 — The product rule store

> "THE PRODUCT RULE STORE — do not skip it." This is the one capability that ships *with the tool itself*, not with any project that installs it, and it is the most architecturally deliberate corner of the codebase: a second, completely isolated store of normative text living beside — and never touching — the corpus described in [Chapter 1](./01-items-and-corpus.md).

## What it is, and why it is not a corpus category

The corpus (`.my_context/items/`) holds what a *project* knows. The product rule store, `src/rules/`, holds what my_context knows **about itself** — the things every install needs to be told, or that this repository specifically needs to be told, regardless of which project's corpus is sitting next to it.

It would have been easy to make this "just another category" the way `rule` or `standard` already exist ([Chapter 1](./01-items-and-corpus.md)). The store's own schema file (`src/rules/schema.ts`) and its loader (`src/rules/store.ts`) explain, in a long header comment, exactly why that was rejected — quoting the design document directly:

> *"if the corpus knows about it, then `list`, `ready`, `doctor`, the tier budgets, decay, supersede and the injection selector each need an exception, and every exception is a place to leak. A store the corpus has never heard of needs no exceptions anywhere. `doctor` walks directories; it simply never walks this one."*

This is enforced, not just argued: `src/rules/` is permitted to import exactly one thing from `src/core/` — the frontmatter parser (`core/frontmatter.ts`) — and nothing else, checked by `test/rules/isolation.test.ts`, which walks the import graph and also asserts (per the `def-the-corpus` entry's own `check` field) that `doctor`, `list`, `ready` and the injection selector each return **nothing** from `src/rules/entries/`. The corpus and the store cannot see each other.

**Use case:** a consumer installs my_context in their own project. Their corpus is empty on day one. The rule store still delivers one entry — the one fact every install needs regardless of project content (see "Tiering" below) — without that fact having to be seeded into every new project's corpus by hand, and without corpus tooling ever needing to know the store exists.

## The measured facts

Run directly against this repository:

```
$ wc -c src/rules/entries/*.md | tail -1     # 2026-09-13; it was 23,101 on 2026-09-12
32516 total
$ ls src/rules/entries/*.md | wc -l
15
```

**Fifteen entries, 32,516 bytes, as of 2026-09-13** — one `product` and fourteen `developer`. The store grew by three that day (`72584fd0`, 20:21, "three lessons enter the product"): `a-fixture-must-not-be-what-makes-a-proof-pass`, `a-gate-that-cannot-be-shown-to-fail-is-not-a-gate` and `a-scanner-names-what-it-skips-not-what-it-scans`, all `standard`/`developer`. `mycontext rules list` confirms fifteen live. Read the count as a dated reading: this store is small enough that one owner ruling moves it.

`src/rules/store.ts` (136), `src/rules/deliver.ts` (659) and `src/rules/delivered.ts` (384) are **1,179 lines** of loader/renderer/ledger code around those fifteen small Markdown files; `manifest.ts` (645) and `schema.ts` (432) bring the directory to 2,256.

## The schema: five kinds, and the template *is* the schema

`src/rules/schema.ts` defines a closed set of five entry **kinds**, each with its own required parts — and the file's own header states the design intent precisely: *"the template is the schema, the check AND the form — one thing, not three that can drift: a `prohibition` without a `why` does not load, does not validate, and cannot be saved in the maintenance UI."*

| kind | its own required parts | every kind also requires |
|---|---|---|
| `fact` | `truth`, `breaks` | `example`, `check` |
| `prohibition` | `prohibition`, `why` | `example`, `check` |
| `procedure` | `steps` (a list), `proof` | `example`, `check` |
| `standard` | `trigger`, `shape` | `example`, `check` |
| `definition` | `term`, `means`, `confusedWith` | `example`, `check` |

`example` exists because, in the schema's own words, it "is what stops an entry being arguable" — *"never `git add -A`"* is weak; *"never `git add -A` — on 2026-09-09 a bare `git commit` swept another lane's staged work into a commit about a table border"* is not. `check` must be `preventive:<name>`, `detective:<name>`, or `none - <reason>` — a **preventive** check refuses the bad action before it happens (only possible where the store owns the write path); a **detective** check reports it after the fact from the audit/conversation archive (the only kind available for a rule about the assistant's own output, since nothing can refuse a model's own text before it is produced); `none` is legal but must carry a reason, exactly like this project's `@basis none - <reason>` convention for tests ([Chapter 13](./13-testing-discipline.md)).

**Four** corpus-lifecycle fields are explicitly **excluded** by the parser (`parseEntry`'s "stray field" check): `status`, `supersedes`, `always`, `valid_until`. The schema's comment states why: *"these are constants, not items with a life."* An entry that leaked one of these would look like it had a lifecycle it does not have.

`parseEntry` never throws on a bad file — it returns a typed refusal naming the file and the missing part, citing the same discipline named elsewhere in this project as `INV-nothing-is-dropped-silently`: a throw would take the whole store down for one bad file; a named refusal keeps the rest loading and tells you exactly what's missing.

## Tiers: `product` and `developer`, and exactly what decides which applies

```ts
// src/rules/schema.ts
export type Tier = 'product' | 'developer';
```

`product` entries reach **every** user who installs my_context. `developer` entries apply only when **the workspace being worked on is my_context's own source repository** — this repository. That is the entirety of the "in a consumer repo ONE entry applies; in this repo all of them do" claim, and it is worth stating precisely because the **tier** is not a config flag, a marker file, or an environment variable a stranger's project could accidentally acquire:

```ts
// src/rules/deliver.ts
export function workspaceIsMyContext(projectRoot: string): boolean {
  return path.resolve(path.dirname(projectRoot)) === packageRoot();
}
```

`packageRoot()` (`src/rules/store.ts:51–53`) resolves `dirname(store.ts) + '..' + '..'` — **two** levels, `src/rules` → `src` → the package root — i.e., "is the `.my_context` I'm running against literally sitting next to the source of the plugin package that shipped these rules." The code comment states the reasoning directly: a marker file "is something a stranger's project acquires by copying a file, and what hangs on the answer is whether rules about how THIS repository works are law somewhere else." Path identity can't be copied by accident; a marker file can.

**But the store's *source* is environment-settable, and that deserves the same prominence as the tier.** `MYCONTEXT_RULES_DIR` (`RULES_DIR_ENV`, `src/rules/deliver.ts:332`) replaces the **entire** store: `resolveStoreDir` (`:417–421`) returns the named directory in preference to `entriesDir()`, and both `deliverAtDoor` and `assertDoor` go through that one resolution — deliberately, "because a second one would let the assertion count a different store from the one the door delivered."

It is not silent. `substitutedStoreLine` (`:341–347`) emits, into the delivered block itself:

> *"**These constants were NOT read from the installed package.** `MYCONTEXT_RULES_DIR` points at `<dir>`, so what follows is whatever that directory holds — verified against its own manifest, which is not the one that shipped. Unset the variable to read the installed store."*

The line is non-empty **only** when the variable is actually in effect, for the reason every note in `core/inject.ts` is gated the same way: "a sentence that appears every time is a sentence nobody reads." Note what the disclosure concedes rather than hides: the substituted store is verified against **its own** manifest, not the shipped one — so the seal below is a seal on whatever directory is in play, not on what my_context published.

The filter itself lives in the loader:

```ts
// src/rules/store.ts, loadRules()
if (parsed.tier === 'developer' && !workspaceIsMyContext) continue;
```

Of the fifteen shipped entries, **exactly one** (`an-unknown-category-means-a-possible-wrong-corpus`, a `fact`) is `product`; the other **fourteen** are `developer`. So in any ordinary consumer project, exactly one entry is ever in force; in this repository, all fifteen are. Confirmed live, 2026-09-13:

```
$ node src/cli/index.ts rules list
my_context rules — 15 entry(s) in force here. This workspace IS my_context, so developer-tier
entries apply too.
```

The one-`product` figure has held through every store version so far; the `developer` count is what moves.

## The checksum seal: what it protects, and what it deliberately does not refuse

The seal lives in `src/rules/manifest.ts`, entirely separate from the schema/loader (the module header notes this is the *only* file in `src/rules/` that writes — "reads only" is true of `store.ts`). Each entry file has a SHA-256 checksum recorded in `src/rules/entries/manifest.json`, computed with line endings normalized (`\r\n` folded to `\n`) so that a Windows checkout with `core.autocrlf` on doesn't report every entry as "altered" the moment it's cloned — the file's own comment calls out that a verification command whose first answer on a clean install is "your rules have been tampered with" is a command people turn off.

`verifyManifest` checks three kinds of damage (`Damage = 'missing' | 'altered' | 'unexpected'`) and reports **every** problem found, not just the first — again `INV-nothing-is-dropped-silently`: naming one of three damaged entries would make a repair look complete when two-thirds of the damage remains.

Live, on this repository right now:

```
$ node src/cli/index.ts rules verify
my_context: the rule store is intact — every entry matches the checksum that shipped with it.
  D:\Users\UserC\source\repos\my-context\src\rules\entries
```

**What the seal refuses, and what it explicitly does not.** `assertStoreWritable` throws `StoreDamagedError` on any write attempt while the store disagrees with its manifest — but the error class's own doc comment draws a sharp line: *"it refuses WRITES ONLY. `loadRules` never calls this and must never call it: blocking reads punishes a user for a damaged install they can still recover from, and a tool that has stopped answering is one they cannot recover from at all. This is a safety catch, not a hostage."* A damaged store still delivers whatever it can parse; it just won't accept edits through the maintenance path.

### The seal is not live tamper-evidence, and `--restore` is unreachable

Two limits, both of them load-bearing for anyone reading this section as a security property.

**Nothing consults the manifest unless a person asks it to.** `verifyManifest` has exactly one caller in `src/` outside the maintenance-only `assertStoreWritable`/`writeEntry` pair: `cmdRulesVerify` (`src/cli/commands/rules.ts:228`) — a CLI command a person chooses to run. **No hook, no door, no `doctor` check and no CI step consults it.** And `loadRules` (`src/rules/store.ts:85`) `readdirSync`s the entries directory and never asks the manifest at all, so **any `.md` dropped into `src/rules/entries/` is parsed and delivered as a governing constant**, manifest or no manifest. The seal is a thing you can check; it is not a thing that is checked for you.

**`rules verify --restore` cannot reach `restoreEntries`.** `cmdRulesVerify` (`src/cli/commands/rules.ts:189–190`) assigns both names from the same function:

```ts
const packageStore = entriesDir();
const store = entriesDir();
```

and then guards the restore on `path.resolve(packageStore) !== path.resolve(store)`, which is **always false**. What the command prints instead is the honest answer, and the source labels it as such — *"a finding rather than a feature"*:

> `nothing was restored: the store being verified IS the installed package (<dir>), so there is no second copy here to restore from. Reinstall the package to put back what shipped.`

`restoreEntries` is real and does the work; what is missing is a second copy to restore *from*, which the spec defers to a workspace-side store (Phase 2). The two names exist rather than one precisely so that day changes where `store` comes from and nothing else.

**The consequence for the paragraph above:** `StoreDamagedError`'s remedy names `mycontext rules verify --restore`, a branch whose condition is always false — a remedy that cannot fire. That is a corpus-filed defect, and reproducing it here as instruction would be repeating it. The working remedy today is **reinstall the package**.

There is a second, *different* refusal the manifest module implements and is careful to distinguish from the damage refusal: a **budget** refusal at publish time (`planPublish`/`publishStore`), which checks the `product` tier's total byte size against a 20,000-byte default (`DEFAULT_BUDGET_BYTES`) and refuses to publish a new store version that overshoots it — because, per spec, *"everything in the store is injected, no exception"* on a user's install, so a user must never see a budget refusal caused by this project's own store growing. That gate exists only in the (currently uncalled-in-production) publishing path, not in anything a consumer ever runs.

## Delivery vs. assertion — the doors, precisely

The brief states: delivered at `session-start` and `subagent-start`; asserted at `pre-compact` and `pre-tool-use`. Verified exactly, by grep and by reading each hook:

```
$ grep -rn "deliverAtDoor\|assertDoor" src/hooks/*.ts
src/hooks/pre-compact.ts:217:    const missedStore = assertDoor(ws.projectRoot, sessionId);
src/hooks/pre-tool-use.ts:684:    return assertDoor(root, key);
src/hooks/session-start.ts:130:    return deliverAtDoor({...
src/hooks/subagent-start.ts:316:    const store = deliverAtDoor({...
```

**Delivery** (`deliverAtDoor`, `src/rules/deliver.ts`) renders the full, tier-filtered rule text and hands it to the model. It is called from exactly two hook files:
- `session-start.ts` — for a brand-new or resumed session (`door: 'session-start'`), *and* for the session that follows a compaction (`door: 'compact-restore'`, when `options.source === 'compact'`). Both are the same hook file; the door label just changes with the trigger.
- `subagent-start.ts` — every subagent gets its own full delivery, `door: 'subagent-start'`.

The `Door` type itself (`src/rules/delivered.ts:165`) is a closed union — `'session-start' | 'compact-restore' | 'subagent-start' | 'manual'` — and its comment states outright: *"`pre-compact` is NOT here, and its absence is a measurement rather than an oversight."*

**`'manual'` is a member of the type that nothing in the product ever writes.** `deliverAtDoor` has exactly two callers in `src/` and neither can emit it: `session-start.ts:131` emits `'compact-restore' | 'session-start'`, `subagent-start.ts:318` emits `'subagent-start'`. No delivery row in `.rules/delivered.jsonl` has ever carried `door: 'manual'` from a product path. (The `'manual'` that *does* fire is `core/inject.ts`'s **corpus injection event** — a different mechanism, a different type, and the `/LoadMyContext` skill reaches that one, not this.) The union member is reserved surface, not a described behaviour.

**Assertion** (`assertDoor` → `assertDelivered`, `src/rules/delivered.ts`) does not deliver anything. It checks whether the current session/subagent key already has a recorded delivery row in the ledger, and if not, produces a "missed door" sentence. It is called from exactly two places:
- `pre-compact.ts:219` — right before a compaction, to catch a session that somehow never got its opening delivery.
- `pre-tool-use.ts:703` — the earliest hook that runs *after* every door. **Not on every tool call**: `PreToolUse` is registered in `hooks/hooks.json` with matcher `Read|Edit|MultiEdit|Write|NotebookEdit|Agent`, so it fires on six tool names. A `Bash` call does not reach it.

**Where the "missed door" sentence goes is not into the model's context.** `pre-tool-use.ts:741` writes it with `process.stderr.write` — it is addressed to the person at the terminal, not to the agent, which is why a missed door is a thing a human notices rather than a thing a session is told.

**Two things about the ledger file itself**, both new on 2026-09-13 (`dc0f14fb`) or previously unstated:

- **A test's rows go to a sibling file.** `deliveredFile(root)` returns `.rules/delivered.test.jsonl` when `isTestProcess()` — a predicate, not a parameter, "because a parameter is something a caller passes, and every caller that forgets it writes a production row that is a lie." `recordDelivery`, `deliveries`, `wasDelivered` and `assertDelivered` all fork the same way. It keys on Node's `NODE_TEST_CONTEXT`, which the test runner sets and every child inherits, so no test can opt out of being marked and no hook Claude Code runs can be marked by accident. What it deliberately does **not** cover is stated out loud: a non-`node --test` harness (the Playwright suite under `e2e/`, or a hand-run probe) is not marked. 157 polluting rows were measured on 2026-09-13 and all but one were `node --test`.
- **The log is capped.** `MAX_ROWS = 5000` (`delivered.ts:233`) trims the file; it is append-only and read by counting, with `.audit/` as its precedent, including the `*` .gitignore.

`pre-compact.ts`'s own comment resolves what could look like a contradiction: it does not itself deliver, because the session that follows the compaction (`SessionStart(source: 'compact')`) already is a door and already delivers — asserting at `pre-compact` and delivering at the *next* `session-start` are two different moments serving the same guarantee, not two deliveries of the same thing.

The `def-a-door` entry itself gives the reason this distinction exists at all — nothing can inspect a model's context window, so *"what is verifiable is that we injected at every door and none was missed — a count rather than a promise."* Delivery writes a row; assertion reads for the row's absence. `deliver.ts`'s own extended comment (a large, deliberately-kept-but-uncalled block around a hypothetical mid-session "correction" mechanism) explains three separate concrete costs of making `PreToolUse` a delivery door instead of an assertion point — closed model channel, holding stale "before" bytes on the hot path, and corrupting the very "missed door" count `assertDoor` exists to produce — and settles on assertion being the right shape, backed by a measured `p50 0.371 ms / p95 0.503 ms` cost for the assertion path on this repository.

**Use case:** a subagent is dispatched mid-session. It gets a fresh context window with no memory of what its parent session was told — `subagent-start` re-delivers the full rule text into that fresh window, because (per `def-a-door`, quoting its own measurement) *"1,082 subagent-starts against 54 session-starts in 36,024 records — so a design guarding only session start guards the rarest event."*

## Precedence over the corpus, and conflict detection

Every delivered block carries a fixed preamble stating what it is (`PREAMBLE` in `deliver.ts`) and a fixed precedence sentence (`PRECEDENCE`), delivered whether or not a conflict is found:

> *"a product constant outranks every other source, including this project's own corpus — it states how the tool behaves, which is true whatever anybody records about it. Where one disagrees with an item you are also holding, the constant governs and the disagreement is named below rather than settled in silence (`STD-the-precedence-order-when-four-sources-of-truth-disagree`)."*

**The parenthesis is not decoration, and it is the reason this quote is reproduced in full.** `PRECEDENCE` (`src/rules/deliver.ts:143–148`) ends by citing a **corpus item id** — inside the block the product says outranks every other source, shipped to every install, where no consumer's corpus holds that id and no command can fetch it. It is a citation that resolves to nothing, in exactly the place a dangling one costs most. That is the same class of defect the version-5 provenance strip below was ruled on to fix, which is why the next section's claim needs the qualification it now carries.

`findConflicts(entries, itemIds)` checks whether any delivered rule-store entry id collides (by "slug," i.e. id with any `PREFIX-` category prefix stripped) with an item id already being delivered from the corpus that session — the caller passes in the corpus item ids being delivered; the rule store module itself never reads the corpus, consistent with the isolation rule above.

## Provenance disclosure: `movedFrom`/`movedOn`, tier-gated

Several entries here were *migrated out of the corpus* — three were formerly corpus `RULE-`/`LESSON-` items that the owner promoted into the store on 2026-09-11 (visible in `manifest.json`'s changelog, reproduced below). A migrated entry carries `movedFrom`/`movedOn` fields, but **whether that provenance is shown to the reader depends on tier**:

```ts
export const TIERS_THAT_DISCLOSE_PROVENANCE: readonly Tier[] = ['developer'];
```

The reasoning, from `deliver.ts`'s comment: a `developer`-tier entry is only ever read inside *this* repository, where the retired corpus item it names is still on disk and one `mycontext show <id>` away — so the footer is real provenance. A `product`-tier entry ships to *every* install, where the same id names an item that reader's corpus never had, cannot fetch, and has no way to verify was ever real — a dangling citation inside the very block that claims to outrank every other source. The owner was offered three options on 2026-09-11 (strip it for product, keep-and-document, or isolate the fixture) and chose to strip it for `product` only — visible directly in the manifest changelog's own note for version 5.

**This did not close the class of defect, only one instance of it.** The `PRECEDENCE` constant delivered in the same block still ends with a corpus id (`STD-the-precedence-order-when-four-sources-of-truth-disagree`) that no consumer install can resolve — see the section above. The v5 strip fixed provenance footers; the preamble was not part of it.

## The full manifest changelog (real, from `src/rules/entries/manifest.json`)

| version | date | what moved |
|---|---|---|
| 1 | 2026-09-11 06:15 | seed: the numbering standard, plus 8 `def-*` definitions |
| 2 | 2026-09-11 06:26 | definition titles rewritten to full sentences ("a common word cannot double as a leak fingerprint") |
| 3 | 2026-09-11 06:27 | `def-lane` → `def-a-lane` ("an eight-character id is not distinctive enough to serve as a leak fingerprint") |
| 4 | 2026-09-11 08:40 | three corpus items retired and promoted into the store: the unknown-category fact, the never-write-the-shared-tree prohibition, and the commit-by-pathspec prohibition |
| 5 | 2026-09-11 09:50 | provenance moved from prose in the body into the dedicated `movedFrom`/`movedOn` fields, and disclosure restricted to the developer tier (the ruling described above) |

**The changelog does not reconstruct the store, and the gap is not a rounding error.** Replaying every `added` list from empty, in order, yields **11** entries against a directory of **15**. Four entries appear in no `added` list, ever:

- `numbered-options-on-a-question-put-to-the-owner` — present under v1's `changed`, never under an `added`. (The row-1 gloss "the numbering standard, plus 8 `def-*` definitions" is what conceals this: the numbering standard is the entry, and it is not in v1's `added`.)
- `a-fixture-must-not-be-what-makes-a-proof-pass`, `a-gate-that-cannot-be-shown-to-fail-is-not-a-gate`, `a-scanner-names-what-it-skips-not-what-it-scans` — added by `72584fd0` on **2026-09-13**, which updated `manifest.json`'s `entries` (and therefore its checksums — `rules verify` passes) but added **no changelog row**. The store still publishes itself as version 5.

So `manifest.json` has two halves that answer different questions, and only one of them is current: `entries` (15, checksummed, correct) and `store.changelog` (5 versions, 11 reconstructible entries, behind). A reader treating the changelog as the store's history will be missing four entries and one version bump.

## `mycontext rules verify|list|show` — the CLI surface

All three are read-only.

```
$ node src/cli/index.ts rules list
```
prints the table already reproduced above — id, kind, tier, title, for every entry currently in force in this workspace, with a header line stating the count and whether the developer tier applies here.

```
$ node src/cli/index.ts rules verify
my_context: the rule store is intact — every entry matches the checksum that shipped with it.
```
runs `verifyManifest` and reports pass/fail. **`--restore` cannot currently do anything** — the guard it sits behind is always false, so `restoreEntries` is never reached and the command says so by name ("nothing was restored… Reinstall the package"). See "The seal is not live tamper-evidence" above. `restoreEntries` itself, when a second copy exists to restore from, copies the shipped entries back and names — never deletes — any file the package doesn't recognize.

```
$ node src/cli/index.ts rules show <id>
```
renders one entry in full. **The header order is `id · kind · tier` first, title on the second line** — verified live against `rules show an-unknown-category-means-a-possible-wrong-corpus` — then every part in template order, then the body prose, and — only for entries that have one and only on the developer tier — the provenance footer. It also prints the `request` field when present, labelled "asked for as (verbatim, never injected)" — the owner's own words, kept for documentation but, per the schema comment, "never injected" into any actual delivery.

## The entries in full

Each with its `rules show` output, **abridged**: the blocks below drop the `check:` tail and most body prose to keep the chapter readable, so read them as a shape rather than as the whole entry. Run `rules show <id>` for the complete text. The three entries added on 2026-09-13 (`a-fixture-must-not-be-what-makes-a-proof-pass`, `a-gate-that-cannot-be-shown-to-fail-is-not-a-gate`, `a-scanner-names-what-it-skips-not-what-it-scans`) are **not reproduced here**; they are listed in the `rules list` table above.

### 1. `an-unknown-category-means-a-possible-wrong-corpus` — `fact` · **product**

The *only* entry every consumer install ever sees.

```
an-unknown-category-means-a-possible-wrong-corpus · fact · product
an unknown-category error may mean the wrong corpus, not a misspelled flag

  truth: categories are per-corpus configuration, so a name valid in one corpus is invalid in
  another. The refusal names the accepted list and never names the corpus it consulted, so one
  message carries two meanings.
  breaks: the flag gets respelled until something is accepted, against a corpus that was never the
  intended one — and the write lands somewhere nobody is looking.
  example: check which `.my_context` answered before changing the spelling of the flag.
  check: none - the refusal would have to name the corpus it consulted for this to be checkable,
  and it does not.
```
Moved from corpus item `RULE-read-an-unknown-category-error-as-a-possible-wrong-corpus` on 2026-09-11 (provenance not shown here since this is the product tier).

**Use case:** you `mycontext add badcategory "..."` and get a refusal listing accepted categories. Before respelling the category name, check *which* `.my_context` directory answered — you may be in the wrong project's nested workspace, and no amount of correct spelling fixes that.

### 2. `commit-with-a-pathspec` — `prohibition` · developer

```
commit-with-a-pathspec · prohibition · developer
the dispatching session commits by explicit path, never by the shared index

  prohibition: with a lane running, never `git commit` bare and never stage the whole index — use
  `git commit -- <paths>`, or read `git diff --cached` first and know what is in it.
  why: the index is shared with every lane on the machine. A bare commit takes whatever is staged,
  including work a lane staged for a different subject, and the commit message then describes a
  change it does not contain.
  example: a bare `git commit` on 2026-09-09 swept another lane's staged work into a commit about
  a table border.
  check: none - git offers no hook that can tell a deliberate pathspec from a lucky one.
```
This is exactly the memory the user session already carries (`commit-stages-the-shared-index-not-my-paths`) — it is the same rule, now shipped as a product-store `developer` entry rather than living only as a personal memory note. Moved from corpus item `LESSON-stage-what-an-agent-reported-touching-not-what-you-told-it`.

**Use case:** while writing this very documentation task, four other lanes were reportedly active in this repository. Staging with `git commit -- docs/capabilities/10-rule-store.md` rather than a bare `git commit` is this rule applied directly.

### 3. `def-a-door` — `definition` · developer

Already quoted above in full ("The doors: precisely"). It is the entry that defines the vocabulary the delivery/assertion mechanism itself is built on.

### 4. `def-a-lane` — `definition` · developer

```
def-a-lane · definition · developer
a lane is one delegated subagent, with its own context window and its own brief

  means: one delegated subagent, dispatched with a written brief, that owns one unit of work and
  reports back. It runs in its own process with its own context window, it is told which files it
  may touch, and it commits nothing — the dispatching session commits, staging by explicit path.
  confusedWith: a thread, and a task. ... A task is the corpus ITEM that says what is to be done;
  a lane is who does it, and one task may be worked by several lanes over several days.
  example: measured in this workspace on 2026-09-11, the archive holds 304 lane transcripts
  against 2 session transcripts.
```
**Use case:** this very chapter was written by a fork/lane dispatched with a brief naming exactly one file it owns (`docs/capabilities/10-rule-store.md`) — this entry's own definition describes the mechanism that produced it.

### 5. `def-known-red` — `definition` · developer

```
def-known-red · definition · developer
known-red means already failing at HEAD, counted, and recorded with a reason

  means: a test or gate that was ALREADY failing before your change — verified at HEAD, counted,
  and recorded with the reason it is red. The point of the label is the count: if the baseline is
  eleven, any twelfth failure is yours.
```
Cross-reference: [Chapter 13](./13-testing-discipline.md) covers the testing discipline this term belongs to.

### 6. `def-prove-by-removal` — `definition` · developer

```
def-prove-by-removal · definition · developer
proving by removal breaks the line an assertion rests on and watches that assertion go red

  means: proving one assertion by BREAKING exactly the line it rests on, watching THAT assertion
  go red — identified by the failing stack's line number, not by the test's name — and then
  writing the original bytes back. One mutation per assertion.
  example: on 2026-09-10 a harness reported the `test(...)` declaration line for helper-wrapped
  tests, so three separate mutations all looked like one line.
```
This is the precise definition behind [Chapter 13](./13-testing-discipline.md)'s "removal proofs one per assertion."

### 7. `def-spill` — `definition` · developer

```
def-spill · definition · developer
a spill is a candidate that did not fit its budget, and is recorded with the reason

  means: an item that was an eligible candidate for injection and did not fit its tier's budget.
  It is RECORDED with the reason that refused it (`Selection.spilled`), never dropped.
  example: the pinned tier oversubscribed by twelve items, one of which spilled 482 times.
```
This is the exact term [Chapter 2](./02-injection.md) documents mechanically as part of the injection budget/first-fit algorithm — read this entry for the vocabulary, that chapter for the mechanism.

### 8. `def-stand-down` — `definition` · developer

```
def-stand-down · definition · developer
standing an item down clears the fields that make it reach a context window

  means: retiring an item also clears the fields that make it reach a context window — `always`
  back to false, `severity` back to soft — in the SAME act as the retirement, and writes an
  observation on the item recording what moved and why it is quiet now.
  example: `supersedeItem` computes `standDownFields` BEFORE it assigns the new status.
```
This is the mechanism behind [Chapter 3](./03-creation-and-gates.md)'s supersession edges — a retired item cannot keep governing by accident.

### 9. `def-the-corpus` — `definition` · developer

```
def-the-corpus · definition · developer
the corpus is the Markdown under .my_context/items, and it is the source of truth

  means: this project's knowledge as Markdown files under `.my_context/items/**` — one file per
  item, frontmatter plus body. The FILES are the source of truth; the SQLite index beside them is
  derived, and can be thrown away and rebuilt from disk without losing anything.
  example: INV-markdown-is-the-source-of-truth, and 1,085 item files in this workspace on
  2026-09-11.
```
This is the canonical, terse restatement of [Chapter 1](./01-items-and-corpus.md)'s opening claim — and it is itself the proof that the store's isolation from the corpus is deliberate: the corpus's own defining sentence is shipped as a *product-store* entry, not a corpus item.

### 10. `def-the-ration` — `definition` · developer

Already quoted above in full. This is the term [Chapter 11](./11-self-improvement-loop.md)'s built-but-off self-improvement loop is built around: `maxProposalsPerPass` (currently 0) and `queueCeiling` (15).

### 11. `never-a-git-command-that-writes-the-shared-tree` — `prohibition` · developer

Already quoted in full above; the widest-blast-radius rule in the whole store, and the corpus-item ancestor of this repo's own "never `git add -A`" convention (visible in the top-level CLAUDE.md-adjacent tooling guidance quoted elsewhere in this project).

### 12. `numbered-options-on-a-question-put-to-the-owner` — `standard` · developer

Already quoted in full above. Notable as the store's own self-measurement: over 2,657 assistant turns in this workspace's transcripts, 108 questions were put to the owner, and **zero** followed the numbered-option/marked-recommendation shape before this standard existed — a real number about the gap between "written down as a preference" and "actually obeyed," which is presented in the entry itself as the argument for the whole store existing.

## What's NOT built / built but off

- **The maintenance UI form** the schema comment describes ("Phase 3... required to derive its fields from [`TEMPLATE`]") is referenced throughout `schema.ts` as a planned consumer of the template table, but nothing in this exploration found a shipped, wired maintenance screen for authoring rule-store entries by hand outside directly editing the Markdown files — author new entries by writing a `.md` file matching the schema and updating the manifest, not through a UI.
- **The mid-session "correction" mechanism** (`renderCorrection`, `correctionAtDoor`, `SESSION_SCOPE_DOORS` in `deliver.ts`) is fully built and has its own test file (`test/rules/update-correction.test.ts`, twelve assertions per the comment) but is called by **nothing** in production. The owner's ruling, quoted directly in the code, is that this is a deliberate end state, not an unfinished step — it exists so that *if* the maintenance tool ever ships and a store changes mid-session, the mechanics are already tested and don't need to be re-derived. Until then, a store update under a running session is simply not surfaced mid-session; the next fresh door (a new session, or a subagent) picks it up.
- **Publish-time budget refusal** (`DEFAULT_BUDGET_BYTES = 20_000`, `planPublish`, `publishStore`) exists and is tested but, per its own comment, "nothing a user runs ever consults it" — it is a maintenance-time-only gate on the `product` tier's size, invisible to any consumer install.
- The corpus's own tooling (`doctor`, `list`, `ready`, decay, the injection selector) is *deliberately* built to know nothing about this store at all — this is not a gap, it is the isolation the whole design argues for, and `test/rules/isolation.test.ts` exists specifically to keep it that way.
- **Nothing verifies the seal automatically**, and `loadRules` never asks the manifest — so an unlisted `.md` in `entries/` is delivered as a governing constant. See "The seal is not live tamper-evidence" above. This is a real gap, not a design choice like the one directly above it.
- **`rules verify --restore` is unreachable code**, and `StoreDamagedError`'s remedy names it.
- **There is no MCP path to the rule store at all** — `rules verify|list|show` are CLI-only. That matters more than it sounds, because the "missed door" sentence is text written *for a model* and it tells the reader to run `mycontext rules list`; an agent that only has tool calls cannot follow its own remedy. (And that sentence goes to **stderr**, to the person, not into the model's context — `pre-tool-use.ts:741`.)
- **The delivered block omits the tier that `rules show` prints** (`deliver.ts:200`), so a reader of a delivery cannot tell a `product` constant from a `developer` one.
- **Store version and changelog are readable only from `src/ui/maintenance/`, which `package.json` excludes from the published package.** This chapter reproduces the changelog as though an install could consult it; an install cannot. And the changelog is itself four entries and one version behind the directory — see above.
- **`RuleSet.refused` rendering** — what a consumer actually sees when an entry fails to parse — is not described in this chapter.
- **`def-a-door`'s own `means` names `PreCompact` as a door**, and the code excludes it from `Door` and asserts there instead. This chapter cites `def-a-door` twice as the authority for the delivery/assertion split it contradicts. That is a constant and an implementation disagreeing about the product's own vocabulary; it needs an owner ruling, and [chapter 2](./02-injection.md) names it too rather than either chapter picking a side.

## See also

- [00 — Index](./00-index.md)
- [01 — Items and the corpus](./01-items-and-corpus.md) — the parallel-but-isolated store this chapter's store deliberately does not touch
- [02 — Injection](./02-injection.md) — the budget/spill mechanism that `def-spill` names, applied to corpus items rather than rule-store entries
- [09 — CLI and MCP](./09-cli-and-mcp.md) — `rules list|verify|show` in the context of the full command reference
- [11 — The self-improvement loop](./11-self-improvement-loop.md) — built around `def-the-ration`'s vocabulary
- [13 — The testing discipline](./13-testing-discipline.md) — `def-prove-by-removal` and `def-known-red` are this project's own vocabulary for the practices documented there
