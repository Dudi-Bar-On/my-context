# Type design of my_context, reviewed at HEAD (5515ed2)

Scope: types only. Silent failures, dead code and the CLI/MCP/gates surface are other
lanes' and are left alone except where a type is the cause.

Method: read `src/core/types.ts`, `categories.ts`, `config.ts`, `trust.ts`, `content-hash.ts`,
`needs.ts`, `item.ts`, `persist.ts`, `paths.ts`, `select.ts`, `hooks/io.ts` directly; four
read-only sweeps over ids/offsets, outcome unions, parse boundaries and hand-kept exhaustive
tables. `npm run typecheck` is green at HEAD (0 errors). Nothing was written but this file.

**The headline is not "this codebase is loosely typed."** It is that this codebase has
independently invented the right idiom — a total `Record<ClosedUnion, T>` pinned with
`satisfies`, plus `Assert<>` aliases that fail the build — has applied it in twenty-odd
places with the reasoning written out at length, and has *not* applied it at the three or
four boundaries where the union it depends on is created. The strongest type in the product
(`GOVERNING_STATUS: Record<Status, boolean>`) is defeated by the weakest line in the product
(`as Status`, 200 lines away). That is the review in one sentence.

---

## The five changes I would make first

### 1. `parseItem` casts `Status`, `Severity` and `Origin` out of frontmatter with no check — and that defeats the supersede gate

**Type:** `Item.status: Status`, `Item.severity: Severity`, `Item.origin: Origin`
(`src/core/types.ts:2`, `:3`, `:26`).

**Where it is broken:** `src/core/item.ts:545`, `:546`, `:584`

```ts
status:   (optString(fm, rawBlock, 'status')   ?? 'active') as Status,
severity: (optString(fm, rawBlock, 'severity') ?? 'soft')   as Severity,
origin:   (optString(fm, rawBlock, 'origin')   ?? 'human')  as Origin,
```

`optString` returns `string | null`. The `as` is a bare assertion. Nothing between the YAML
and the `Item` narrows it.

**What it currently permits:** an `Item` circulating through the whole product whose
`status` is `'activ'`, `'Active'`, `'done'`, or any other string, while the compiler and
every reader believe it is a member of a five-member union.

**The concrete bug.** `governsNormatively` (`src/core/trust.ts:350`) is:

```ts
return tierOf(ctx, item) === 'normative' && GOVERNING_STATUS[item.status];
```

`GOVERNING_STATUS` is `Record<Status, boolean>` (`trust.ts:368`) — a total table, deliberately
so, with the reasoning spelled out at `:364`: *"`Record<Status, boolean>` and not `Status[]`:
a sixth member added to the union fails to compile here, where a list would keep compiling
and quietly answer `false` for it."* The table is right. But indexed with `'activ'` it
returns `undefined`, which is falsy, so `governsNormatively` answers **false** — and with it:

- `preflightSupersede` does not refuse a non-human caller (`trust.ts`, via `governsNormatively`);
- `guardedChange`'s refusal of `scope` / `always` / `continuity` / `severity` does not fire;
- `mutate.ts:1797-1799` reads the same table for the status-change gate;
- `overlap.ts:83` reads it for the contradiction gate;
- `pack/collide.ts:323` reads it to decide whether approving an overwrite stops an item governing.

**Five gates fail open together, and the table each one reads is the compiler-enforced one.**
The table's guarantee is conditional on `Status` being true, and `item.ts:545` makes it false.

Separately, the item silently stops being injected (`isEligible`/status filters in
`select.ts`), which is the exact failure `validate.ts:40-44` documents — *"`status: 'activ'`
… persists happily — the item is then never actually `'active'`, so it is never selected or
injected, while `createItem`'s own return message still reports success."* The validator that
says this, `validateEnums`, is called **three times, all on the write path**
(`mutate.ts:744`, `:1387`, `:2340`) and **zero times on the read path**.

The read path is reached from untrusted input: `src/pack/reader.ts:310` runs `parseItem` over
bytes from an imported pack archive.

**The codebase already made this exact argument ten lines earlier and only applied it to the
id** (`item.ts:530-535`):

> *"The read boundary. `validateExplicitId` guards the mint path; nothing guarded this one,
> so an id arriving from disk reached ~15 sites that interpolate it into a command a human
> is invited to paste."*

Substitute "status" for "id" and "five gates that decide whether an item governs" for "~15
sites", and the sentence is unchanged.

**Recommended shape.** Add three type guards beside the vocabularies they already live next
to, in `src/core/validate.ts:25-38`:

```ts
export function isStatus(v: string): v is Status { return (STATUSES as string[]).includes(v); }
export function isSeverity(v: string): v is Severity { return (SEVERITIES as string[]).includes(v); }
export function isOrigin(v: string): v is Origin { return (ORIGINS as string[]).includes(v); }
```

Then at `item.ts:545` etc., read through the guard. **A decision is needed on what an
unreadable value does**, and it is not the same answer at both call sites:

- **`pack/reader.ts` (untrusted archive)** — refuse the import, naming the file and the value.
  This is the posture `validateLoadedId` already takes and the posture the manifest check
  beside it takes.
- **local disk (`rebuild.ts`, `mutate.ts`, `persist.ts`)** — do *not* throw. `loadLayer`
  deliberately still indexes items whose category vanished from config, and one hand-edited
  file must not take `rebuild` down. Fall back to the *conservative* member — `status: 'draft'`
  (does not govern, and appears in the draft queue where a person sees it) rather than
  today's `'active'` — and emit a `doctor` finding. That keeps the corpus loadable while
  making the corruption loud, which is this project's own stated preference.

**Cost: small, plus one behaviour decision.** Three functions added, three lines changed, one
branch at the pack boundary, one doctor check. It touches no call site of `Item`. The
behaviour change (a bad `status` now reads `draft` instead of `active`) needs the owner's
ruling and a note in the changelog; I would not land it silently.

Also fix the same shape in two SQLite reads that launder an `Origin` with no membership
test: `src/core/verdict-store.ts:121` (`(row.ruledBy ?? 'human') as Origin`) and
`src/pack/history.ts:555` (`row.origin as Origin | undefined` — from an imported pack's
history).

---

### 2. Fifteen-odd value lists that must be total over a union are typed `T[]`, which checks the wrong direction

**Type:** the pattern `export const XS: X[] = [...]` where `X` is a string-literal union.

`readonly UpkeepOutcome[]` constrains every element to *be* a `UpkeepOutcome`. It does not
constrain the array to *contain* every `UpkeepOutcome`. Dropping or forgetting a member
compiles clean. This is the same "a set that must be exhaustive over a domain, expressed as
a hand-kept list" shape as `isWriter`, one level up: here the domain *is* a closed union, so
unlike `isWriter` the compiler genuinely could catch it.

**The sharpest instance.** `src/core/ui-server-upkeep.ts:522`:

```ts
const OUTCOMES: readonly UpkeepOutcome[] = [
  'alive', 'port-already-serving', 'spawned', 'spawn-failed',
  'restarted-stale', 'restart-failed', 'restart-unconfirmed', 'replaced-elsewhere',
  'stood-down', 'stood-down-stale', 'stood-down-lifted', 'too-soon',
];
```

read back at `:622`:

```ts
lastOutcome: OUTCOMES.find((known) => known === value['lastOutcome']) ?? null,
```

`UpkeepOutcome` (`:322-355`) has twelve members and gained two this week. **A thirteenth
member added to the union and written by a new code path, but forgotten here, compiles,
writes to disk correctly, and then degrades to `null` on the very next read-back** — the
state file silently forgets what happened, which is precisely what the hundred-line docblock
at `:270-321` exists to prevent. There is no test on `OUTCOMES`;
`test/core/ui-server-upkeep.test.ts:748` tests the *foreign-value* direction (a newer build's
word degrading to null), not the *forgotten-own-member* direction. `STAND_DOWN_CAUSES`
(`:529`) has the same shape.

**The repo already has the fix, three times, with the reasoning written out.**
`src/ui/port-model.ts:179-181`:

```ts
type FormatsExhaustive = Exclude<ArtefactFormat, 'dir' | 'zip'> extends never ? true : never;
const formatsExhaustive: FormatsExhaustive = true;
void formatsExhaustive;
```

also `port-model.ts:201-204` and `src/ui/read-model-config.ts:43-45`, whose docblock says it
outright: *"a hand-typed pair that silently stops matching the union is the drift this
project treats as a defect class."*

**Recommended shape.** One generic helper, once, so the idiom stops being retyped:

```ts
// src/core/exhaustive.ts — type-only, erases to nothing.
export type Covers<U extends string, L extends readonly U[]> =
  Exclude<U, L[number]> extends never ? true : never;
```

then at each site make the list `as const` and add two lines:

```ts
const OUTCOMES = [ /* … */ ] as const satisfies readonly UpkeepOutcome[];
const outcomesCover: Covers<UpkeepOutcome, typeof OUTCOMES> = true; void outcomesCover;
```

**Sites to convert** (grep `^export const [A-Z_]+: [A-Za-z]+\[\] = \[`): `OUTCOMES` and
`STAND_DOWN_CAUSES` (`ui-server-upkeep.ts`), `STATUSES` / `SEVERITIES` / `ORIGINS`
(`validate.ts:25,30,38`), `AGENT_EDITS` / `SCOPE_POLICIES` / `UPDATE_STORES`
(`config.ts:154,155,163`), `ARTEFACT_FORMATS` (`command-flags.ts:709`), `AUDIT_OPS` /
`AUDIT_KINDS` (`audit.ts:636,729`), `SECRET_SHAPES` (`conversation-secrets.ts:191`),
`POINT_CATEGORIES` (`session-summary.ts:188`), `HELP_TOPICS` (`teach.ts:16`),
`UI_HELP_TOPICS` (`read-model.ts:3160`), `KINDS` / `TIERS` (`rules/schema.ts:46,47`),
`SESSION_SCOPE_DOORS` / `TIERS_THAT_DISCLOSE_PROVENANCE` (`rules/deliver.ts:533,179`).

**Cost: very small — the cheapest real win here.** Two lines per site, ~18 sites, **zero call
sites touched, zero behaviour change**. If any site fails to compile on the first attempt,
that is a bug found, not a cost. I would land this one first because it is the only item on
this list that cannot break anything.

---

### 3. Category-specific fields live in an untyped bag, so "a requirement has nowhere to record completion" is unaskable of the compiler

**Types:** `Item.extra: Record<string, string>` (`types.ts:275`),
`CategoryDef.extraFields: string[]` (`categories.ts:150`),
`ResolvedCategory.extraFields: string[]` (`config.ts:130`),
`CATEGORIES: Record<string, CategoryDef>` (`categories.ts:156`), `Item.type: string`
(`types.ts:101`).

**What it currently permits.** Every category-specific field — `state`, `plan`, `seq`,
`directive`, `kind`, `likelihood`, `waives`, `done_when` — is a `string` under a `string` key
in a bag every `Item` carries. The compiler cannot distinguish a `task` from a `requirement`,
cannot know `state` is declared by `plan` and `task` and not by `requirement`, and cannot ask
whether a category's declared fields are the ones its readers read.

The dead end you hit today is the direct consequence, and it has two halves:

- **The write half.** `unknownExtraFieldError` (`trust.ts:214-247`) refuses `--extra state=done`
  on a `REQ-` item by doing `category.extraFields.includes(key)` on a `string[]` at runtime.
  Correct refusal, but it arrives at the terminal, not at the keyboard, and it is unanswerable
  by anything but editing `config.json`.
- **The read half, which is worse.** `taskState(item: Item): string` (`needs.ts:177`) accepts
  **any** `Item` and returns `(item.extra.state ?? '').trim().toLowerCase()`. Handed a
  `requirement` it answers `''` — indistinguishable from a task that declares `state` and has
  not set it. `select.ts:776` calls it, `doctor/checks.ts:2061`, `:2366`, `:2682` call it. The
  type says "this item has no state"; the truth is "this category has no state field". Those
  are different facts and the signature collapses them, which is the same
  measured-zero-versus-unmeasured-thing defect the corpus names elsewhere
  (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`).

**The category domain is genuinely open** — users define custom categories in
`.my_context/config.json` — so a closed `CategoryName` union is *not* available and I am not
recommending one. But "is this item one whose category declares work fields?" is already a
computed, config-derived predicate (`isWorkCategory`, `needs.ts:157`), and its answer is
thrown away instead of carried.

**Recommended shape — carry the proof, do not invent a union.** In `needs.ts`:

```ts
/** An Item whose category declares plan, seq and state. Minted only by `asWorkItem`. */
export type WorkItem = Item & { readonly __workItem: unique symbol };

export function asWorkItem(config: Config, item: Item): WorkItem | null {
  return isWorkCategory(config, item.type) ? (item as WorkItem) : null;
}
```

then narrow `taskState(item: WorkItem)`, `taskKey(item: WorkItem)`, `readNeeds(item: WorkItem, …)`.
`workItems()` already filters by `isWorkCategory` and would return `WorkItem[]` for free, so
`doctor`'s three call sites and `readyReport`'s loop change not at all. The one site that
would now fail to compile is `select.ts:776` — which is exactly the site that today asks a
`requirement` for its state. It already hardcodes the answer badly (see §4.6 below), so
failing there is the point.

A branded type is legal under `erasableSyntaxOnly`: it is type-only syntax and erases to
nothing. `CONST-node-24-no-build-step` is not an obstacle.

**Separately, and this is the modelling question rather than the type question:** if a
completed requirement should be able to record completion, the answer is a decision about
`requirement.extraFields`, not about types. The type change above does not make it, it makes
the *absence* visible at compile time instead of as `''`.

**Cost: small-to-moderate.** `needs.ts` is 400 lines with ~19 consumer sites in `src/` and
~71 across `src/` + `test/`. Most are already downstream of `workItems()`. I would expect
under 20 edited lines and one deliberate breakage. Changing `Item.extra` itself, or
introducing per-category `Item` subtypes, would touch 111 `.extra` sites and is **not**
recommended.

---

### 4. A byte offset is not distinguishable from a character offset, and two files already get it wrong

**Types:** `byteOffset: number` (`conversation-index.ts:652`, `:664`, `:704`;
`anchors.ts:44`), `recordIndex: number` (`:649`), `startByte` / `startIndex` / `cap`
(`:1475-1491`), and `DocOutlineNode`'s `n` / `c` / `f` / `s` / `o`
(`read-model-conversation-document.ts:382-406`).

**Answer to the question as asked: both are `number`.** There is no `ByteOffset`, no
`CharOffset`, no branded type, and no brand of any kind anywhere in `src/` — searches for
`__brand`, `unique symbol`, `& { readonly` and template-literal id types all return zero.
The invariant is carried entirely by doc comments, and the comments are emphatic and correct:
*"Bytes from the start of the transcript. Never characters."* (`conversation-index.ts:705`,
`anchors.ts:45`); *"this corpus is half Hebrew, and a character offset would be wrong from
record 5 onward and wrong silently"* (`read-model-conversation-document.ts:88-90`).

**What it currently permits, worst first.**

`DocOutlineNode` (`read-model-conversation-document.ts:382-406`) is five `number`s under
one-letter names mixing three units: `n` = document ordinal, `c` = **character** count,
`f` = record index, `s` = record count, `o` = **byte** offset. The construction sites
interleave the units in a single object literal — `:1713`:

```ts
c: shape.read.said.length, f: step.index, s: 1, o: step.byteOffset,
```

`.length` is UTF-16 code units; `.byteOffset` is bytes. Same type, adjacent, one line.
`OutlineResume` and `NodeWindowRequest` (`:1641`, `:1769`) then carry `at` (byte) / `from`
(record) / `node` (ordinal) as three bare `number`s, populated by three adjacent `as number`
casts at `:2124`. Any permutation of those three type-checks.

`read-model-conversations.ts` declares `readWindow(file, offset: number, limit: number)` at
`:1128` where `offset` is a **record ordinal**, and `passageAt(file, byteOffset: number, …)`
at `:1857` where it is a **byte offset** — seven hundred lines apart in one file, same type.

**The measured bug — and here the type of a local variable is the whole difference.**
`src/core/conversation-index.ts:1526` reads its chunk carry correctly:

```ts
/** Bytes of a line the last chunk ended in the middle of. */
let carry: Buffer | null = null;
```

Two other walkers of the same JSONL carry a **`string`** across a fixed 1 MiB byte boundary:

- `src/ui/read-model-conversations.ts:1207` — `const parts = (carry + buffer.toString('utf8', 0, read)).split('\n');` with `carry` a string
- `src/core/session-summary.ts:910` — byte-for-byte the same loop

A multi-byte UTF-8 character straddling the chunk boundary is decoded to U+FFFD and its tail
bytes are lost. On a corpus that is Hebrew from record 5 (two bytes per character) that
corrupts roughly one character per megabyte, and if the split lands inside a JSON string the
whole record fails to parse and is reported `unreadable`. **These are correctness bugs, not
merely type smells, and I verified both by reading the three loops side by side.** I did not
run them; another lane owns runtime verification. They are the strongest available argument
that the unit distinction is load-bearing: one file typed the carry `Buffer`, two typed it
`string`, and nothing connected them.

**Recommended shape.** Brand the two units at the archive boundary only:

```ts
// src/core/conversation-units.ts
export type ByteOffset = number & { readonly __byte: unique symbol };
export type RecordIndex = number & { readonly __record: unique symbol };
export const byteOffset = (n: number): ByteOffset => n as ByteOffset;
export const recordIndex = (n: number): RecordIndex => n as RecordIndex;
```

Apply to `TranscriptRecord.byteOffset` / `.byteLength` / `.index`, `AnchorRow.byteOffset`,
`AnchorSpec.byteOffset`, `TranscriptWalkOptions.startByte` / `.startIndex`,
`OutlineResume` / `NodeWindowRequest`, and `DocOutlineNode.o` / `.f` / `.n`. Rename
`DocOutlineNode`'s single letters while you are there — `c` is the one that should stay a
plain `number` and be named `characters`, because it genuinely is one.

Fix the two `carry` variables to `Buffer` regardless of whether the branding lands; that is
independent and should not wait.

**Cost: moderate, and contained.** The brand touches the conversation archive and the anchor
path — roughly `conversation-index.ts`, `anchors.ts`, `anchor-file.ts`, `anchor-pass.ts`,
`conversation-search.ts`, `read-model-conversations.ts`,
`read-model-conversation-document.ts`, `cli/commands/conversation.ts`. Arithmetic on a
branded number needs the mint function at each producer, which is where the real churn is;
I would expect 60-120 edited lines and a day. It does **not** spread to the rest of the
product. The payoff is that `cli/commands/conversation.ts:1655-1701` — which today refuses a
character offset with a digits regex and then *reads the record back to see whether it
landed inside one* — stops being probabilistic for every internal caller. It stays necessary
for the human-typed argument, which no type can guard.

---

### 5. Outcome unions are the right shape, and nothing forces a caller to handle a new member

You are right that `{did: …}` is the good shape. The declarations are good. The **consumption**
is not: adding a member to either union you named produces **zero** `tsc --noEmit` errors
across `src/`, `test/`, `scripts/` and `e2e/`.

**`ClearOutcome`** (`src/core/ui-server-record.ts:283-289`) — `'removed' | 'no-record' |
'names-another-server'`. Three production call sites, **all three discard the return value**:
`ui-server-probe.ts:105`, `:113`, `ui/server.ts:1104`. The last is deliberate and says so
(*"The outcome is discarded … there is no one to tell"*). The consequence is that the type
is a documentation device with no enforced consumer anywhere: it could be replaced by `void`
today without a single type error. Six test assertions compare it against a literal.

**`Upkeep`** (`src/core/ui-server-upkeep.ts:221-268`) — one production consumer file,
`src/hooks/stop.ts`. `actClause(upkeep: Upkeep): string` (`:547-574`) is three sequential
`if`s on `did` followed by `return '';` at `:573`. That bare return is *correct* for
`did: 'nothing'`, which is exactly why a fifth `did` will never be noticed: a new act that
should be logged produces an empty clause and no audit row mentions it.

Note also that `replaced-elsewhere` landed on the **nested** `why` union of the
`did: 'nothing'` arm (`:226`), and **nothing reads that `why` at all** — the only
`upkeep.why` read (`stop.ts:568`) is guarded by `did === 'stood-down'` and reads the other
arm's `why`. It is currently a value with no consumer.

**This is a repo-wide shape, not two instances.** `Liveness` (`ui-server-probe.ts:38`) is
consumed by `=== 'alive'` / `=== 'dead'` ifs at `cli/commands/ui.ts:493, 496, 523, 728, 803`
— and `:728`/`:803` are ternaries whose false branch *asserts the `no-record` wording*, so a
fourth state would print "no liveness record" about a state that has one. The comment at
`ui.ts:716-719` shows the author already hit that bug once with `foreign`. Same for
`HandoverRead`, `LastAuditRead`, `Occupancy`, `TurnAnchors` (`stop.ts:851`, where `'failed'`
is the implicit residue), `Remedy`, `Citation`, `SummaryRange`, `RouteHandler`.

And one swallowing `switch` worth naming on its own:
`src/doctor/checks.ts:736-743` switches on `scopePolicyFor(...)` with `case 'required'`,
`case 'inert'`, and a `default:` that **carries the third policy's real prose**. A fourth
`ScopePolicy` silently gets the sentence claiming the item is unrestricted and injects on
every file — a wrong claim, no compile error.

**Recommended shape.** The repo has exactly **one** `const _: never =` in the whole tree
(`src/ui/read-model.ts:3293-3300`, and its comment is the right argument verbatim) and **no**
`assertNever` helper. Add one:

```ts
// src/core/exhaustive.ts, beside `Covers` from §2.
export function assertNever(value: never, context: string): never {
  throw new Error(`my_context: ${context} has no branch for ${JSON.stringify(value)}`);
}
```

Convert the if-chains that *decide* something to `switch` + `default: assertNever(...)`:
`actClause` (`stop.ts:547`), `ui.ts:728`/`:803`, `checks.ts:736`. Leave the ones that merely
report. For `ClearOutcome`, either give it a consumer or narrow the return to `void` at the
two probe call sites — a union nobody reads is a claim no test can hold up.

**Cost: small.** One new file, ~8 sites converted, each a mechanical rewrite of an if-chain
into a switch. Expect two or three of them to fail to compile immediately, which is the
finding. No call-site signatures change.

---

## Full findings

Ratings are 1-10 on the four axes. They are calibrated *against this codebase*, which argues
its designs unusually carefully — a 7 here is better than a 7 in most repositories.

### 4.1 `Item` (`src/core/types.ts:96-346`)

**Invariants identified**

1. `checksum === computeItemChecksum(item)` — derived field stored beside its own inputs.
2. `summaryOf === itemSummaryBasis(item)` at the moment `summary` was written; disagreement
   means stale, which is the feature.
3. `summaryOf` is null exactly when `summary` is null (except in a hand-written file, where
   the mismatch is *defined* as `unanchored`).
4. `summaryWas.length <= SUMMARY_HISTORY_MAX` (3).
5. `acknowledged` values are `itemContentHash` results keyed by `Finding.code`.
6. `origin: 'review'` implies `status: 'draft'`, on every tier, with no exception.
7. `origin !== 'human' && tier === 'normative'` implies `status: 'draft'`.
8. `filePath` is POSIX and relative to the layer root.
9. `severity: 'hard'` and `always: true` are inert on the rationale tier.
10. `extra` keys are declared by the item's own category (plus two pipeline keys).

**Encapsulation: 3/10.** `Item` is a bare `interface` with **zero `readonly` modifiers**
(`grep -c readonly src/core/types.ts` → 0), no constructor, no factory that is the only way
to make one, and no `Object.freeze`. `applyUpdate` (`mutate.ts:1858-1944`) mutates it in
place field by field; `persist` (`persist.ts:131`) then re-stamps `item.checksum`. Between
those two points an `Item` with a stale checksum is a live, valid, fully-typed value. The
guarantee is "every write path funnels through `persist`", which is true today, argued well
at `persist.ts:103-112`, and invisible to the compiler. Invariants 1, 2 and 3 are maintained
by convention across module boundaries — the textbook definition of a type that relies on
external code.

**Invariant expression: 4/10.** The documentation is genuinely outstanding — `types.ts` is
346 lines of which perhaps 60 are declarations, and the prose is precise, dated, and cites
its evidence. But that is the finding: **ten invariants, ten comments, zero compiler
guarantees.** Nothing in the shape of `Item` says `summaryOf` is null exactly when `summary`
is, and `{ summary: null, summaryOf: 'abc123' }` is a legal value. Nothing says
`origin: 'review'` implies `draft`; `{ origin: 'review', status: 'active' }` is legal and
`trustedStatus` merely never produces one. The conditional-frontmatter rules (`continuity`,
`summary`, `summaryWas`, `acknowledged` written only when non-default, so old checksums do
not move) are a real and well-argued design, expressed entirely in `renderItem` and
`computeItemChecksum`.

**Invariant usefulness: 9/10.** Every one of the ten is load-bearing and each prevents a
named, measured bug. The `summaryOf`-as-basis design (invariant 2) is the best idea in the
type: storing the identity of what was summarised rather than a boolean "is stale" flag
means staleness is *computed*, never stored, never drifts. `acknowledged` reuses the same
mechanism one field out and the docblock explains why. These are not defensive checks; they
are the product.

**Invariant enforcement: 5/10.** Strong where it is centralised — one `persist`, one
`stampSummary`, one `trustedStatus`, one `computeItemChecksum` reused twice rather than
implemented twice. Nil at the read boundary (§1), and nil against in-place mutation.

**Recommended, cheapest first**

- Mark the derived fields `readonly` on `Item` and introduce a separate `ItemDraft` (or
  `Mutable<Item>`) that `applyUpdate` takes. `readonly` is erasable syntax and costs nothing
  at runtime. Expect breakage at `mutate.ts:1858-1944`, `content-hash.ts:646`,
  `persist.ts:131`, `help/index.ts:1523` — five files, and the breakage *is* the audit.
  This makes "who is allowed to invalidate the checksum" a typed question.
- Do **not** try to make `{origin: 'review', status: 'active'}` unrepresentable by turning
  `Item` into a discriminated union on `origin`. `.id` alone appears at 908 sites; the union
  would spread through all of them for an invariant one 3-line function already enforces at
  the only place it can be violated.

### 4.2 The category model (`categories.ts`, `config.ts`, `Item.extra`)

Covered as top-five item §3. Ratings:

- **Encapsulation: 5/10.** `ResolvedCategory` is built field-by-field by validated
  constructors in `resolveConfig` and is never cast from parsed JSON — genuinely good. But
  `Item.extra` is a public mutable `Record<string, string>` and `applyUpdate` merges into it
  directly (`mutate.ts:1944`).
- **Invariant expression: 3/10.** `extraFields: string[]` and `updates: Record<string, …>`
  make every category-specific field a runtime fact. `CATEGORIES: Record<string, CategoryDef>`
  has key type `string`, so the compiler cannot form the proposition "this table is missing a
  category", which is the same structural reason `isWriter` could not be checked.
- **Invariant usefulness: 8/10.** The `UpdateStore = 'field' | 'tag'` distinction and the
  one-sentence test that goes with it (*"if you would ever want to update it, it is a field"*)
  is excellent, and the measurement behind it — 276 task items, 213 with both, thirteen
  disagreeing — is exactly how this decision should have been made. `TIER_UPDATES:
  Record<Tier, CategoryUpdates>` is total and compiler-checked.
- **Invariant enforcement: 6/10.** `unknownExtraFieldError` and `requireUpdates` are thorough
  at runtime. The gap is that the read side has no equivalent and no type carries the answer.

**One concrete defect found here that is not about `extra`:** the unknown-category default is
answered **three different ways**.

| Site | Missing category resolves to | Direction |
|---|---|---|
| `trust.ts:303-307` `tierOf` | `'normative'` | fail **closed**, argued at `:291-302` |
| `select.ts:539-541` `isNormative` | `false` (not normative) | restrictive for injection |
| `cli/index.ts:638-640` | `'rationale'` | fail **open** |

Each is individually justified in its own comment. The divergence itself is the risk: three
answers to one question about the same input. `cli/index.ts:638` feeds a disclosure message
rather than a gate, so its blast radius is a wrong sentence — but it is the exact default
`trust.ts:291-302` argues against, one file over. Route all three through `tierOf`'s
convention, or give the question one name.

### 4.3 Identifiers (`string` everywhere)

**There is no branded, opaque or nominal type anywhere in `src/`.** Confirmed by searches for
`__brand`, `unique symbol`, `Brand<`, `Opaque<`, `& { readonly`, and template-literal id
types — all zero. `erasableSyntaxOnly` is **not** the reason: branding is type-only syntax
and erases to nothing.

Distinct concepts that share the type `string`: item id; relation target (an item id);
relation verb; session id; agent/lane id; three composite session keys with three different
separators (`a::b` in `ledgerKey`, `a/b` in `read-model-retrieval.ts:179`, `a:b:n` in
`anchorIdFor`); conversation anchor id; ingest heading anchor; `Item.sourceAnchor`; doc
heading anchor; plan name; seq; `plan/seq` key; task state; handoff nonce; execution nonce;
content hash; summary-basis hash; file checksum; source checksum; absolute native path;
absolute POSIX path; relative POSIX path; glob pattern.

**Encapsulation: 2/10. Invariant expression: 2/10. Usefulness: n/a. Enforcement: 4/10**
(runtime regexes are thorough where they exist: `ID_GRAMMAR`, `isUsableId`,
`validateLoadedId`, `REF_SHAPE`).

**On the three `plan/seq` collisions you found this week.** The type is not the cause, and I
want to be precise about that because it is the one place the model is *better* than it
looks. `buildTaskIndex` returns `Map<string, Item[]>` — a **list**, not an item — and the
docblock at `needs.ts:200-207` says why, with the measurement: *"six live tasks share
`ui3/11x` and two share `probe/0`. A reference to `ui3/11x` therefore means all six, and is
satisfied only when every one of them is done."* Non-uniqueness is modelled correctly and
deliberately. What the type does *not* do is stop a plan name, a seq, a composed key, a task
state and an item id from being interchangeable, or distinguish `NeedsReading`'s four
`string[]` buckets (`malformed` / `satisfied` / `pending` / `unresolved`, `needs.ts:274-283`)
— a refactor that pushes onto the wrong one compiles and silently changes dispatchability.

`parseNeeds` is the sharpest small example: it validates against `REF_SHAPE` and hands back
`refs: string[]`, discarding the proof it just established. `refStatus(ref: string, …)` will
accept an item id or a malformed entry and answer `'unresolved'` — a real-looking answer to
a question that was never valid.

**Recommended, ranked by what a swap actually costs.** I would **not** brand item ids or
session ids: 908 and 596 sites respectively, in a 135k-line tree with a 523-file suite, for
a distinction that has not yet produced a measured bug. Three are worth it:

1. **The two nonces** (`ui/server.ts:966` handoff, `ui/execute-nonce.ts` execution). Both
   `string`; `redeem()` on either store accepts the other's token. `server.ts:1266-1268` says
   *"the nonce is the credential"*. This is a security distinction and the surface is tiny —
   two stores, one mint and one redeem each. **Cost: under 20 lines.**
2. **The four hashes** — `checksum` (file tamper), `summaryOf` (summary basis),
   `acknowledged` values (content hash), `sourceChecksum`. All 16 hex chars from one
   `checksum()` helper, all mutually assignable. A mis-stamp compiles, and its symptom is a
   summary permanently reported stale or permanently reported current — silent in both
   directions. `content-hash.ts:172-186` argues at length that *the value is the mechanism*;
   branding is that argument in the type. **Cost: moderate**, concentrated in
   `content-hash.ts`, `item.ts`, `persist.ts`, `acknowledge.ts`.
3. **`AbsNativePath` / `AbsPosixPath` / `RelPosixPath`** in `paths.ts`. Today
   `relPosix(root, target)` takes two bare strings and transposing them compiles into a path
   of `..` segments; `managedSplit(absPosix)` and `canonicalizeNearestExisting(absNative)`
   take opposite conventions under the same type. `paths.ts` is already the single choke
   point every conversion passes through, which is what makes it feasible at all — but
   `filePath` is on `Item` and paths are everywhere. **Cost: large. Defer** unless a path bug
   is actually costing time.

### 4.4 Parse boundaries

Two are exemplary, one is shared, one is partial, two are scattered. Verdict table:

| Boundary | Verdict |
|---|---|
| **Config** (`core/config.ts:1825` `resolveConfig(raw: unknown): Config`) | **Single validated gateway.** Thirteen named `require*`/`isValid*` validators, refuses rather than coerces (`"categories": []` is refused, not defaulted, `:1911-1917`), one `as` proven on the very next line (`:1871-1872`). Every `JSON.parse` of a config feeds it. **The reference implementation.** 9/10. |
| **MCP tool args** (`mcp/tools.ts:74`) | **Single validated gateway.** `Args = Record<string, unknown>` plus eight throwing readers; `optEnum` checks against the *same* `STATUSES`/`SEVERITIES` the writer uses, so there is no second vocabulary; `refuseUnknownArgs` closes the world. 9/10. |
| **JSONL logs** (`core/jsonl-log.ts:211`) | **Shared spec-driven parser.** Parses to `unknown`, refuses non-objects, refuses an unknown `protocol`, runs `spec.validate`, tolerates only a torn final line. `parseAudit` is one line on top. 8/10. |
| **Hook stdin** (`hooks/io.ts:309`) | **Partial.** Proves object-ness only, then `value as HookInput`. Every field optional, so the cast asserts nothing — which is the problem, not the mitigation: `session_id: 42` types as `string \| undefined`. `ParsedHookInput.parseError` (`:275-292`) is a genuinely good design argued against a real nine-day silent failure. But `post-tool-use.ts:27` declares a **second, divergent `HookInput`** and parses it itself at `:360`; two types, one name, different modules, invisible to the compiler. 5/10. |
| **CLI argv** (`registry.ts` + per-command) | **Correct but scattered.** The same three-line check-then-cast written out nine times (`edit.ts:742-772`, `cli/index.ts:1100`, `audit.ts:87`, `search.ts:112`, `export.ts:181`, `review.ts:1165`, `ask-model.ts:182,186,301`, `read-model-work.ts:204`), always against the right constant. No `isStatus`/`isSeverity`/`isOrigin` predicate exists, so the trailing `as` means a site that forgets the `if` compiles identically. The three guards from §1 collapse all nine. 6/10. |
| **SQLite rows** (`store.ts`, `audit-db.ts`) | **Scattered casts.** ~14 row-shape assertions, zero row validation, including `as unknown as SourceRow[]` (`audit-db.ts:179` — the compiler refused the single cast and was overruled). Mostly defensible: the schema is owned by the same file. Not defensible: `as Item` (`store.ts:507,513,538`) launders §1's unvalidated enums a second time with no chance to catch them, and two `as Origin` from row data (`verdict-store.ts:121`, `pack/history.ts:555`). `Store.raw()` returning `Record<string, unknown>[]` is the honest one. 4/10. |
| **Frontmatter → `Item`** (`item.ts:487`) | **Pure casts.** §1. 2/10. |

`isObject(v: unknown): v is Record<string, unknown>` is declared **eight times**,
character-identical, across `config.ts:1174`, `restore-staging.ts:173`, `ingest/schema.ts:170`,
`lesson/staging.ts:282`, `mcp/protocol.ts:97`, `pack/config-io.ts:206`, `pack/import.ts:407`,
`pack/manifest.ts:228`. That is not a defect, but it is eight chances for one of them to drift.

Twenty-one `JSON.parse(...) as <DomainType>` sites in `src/` assert a domain type with no
check. The sharpest is `SessionHeader` × 4 in `ingest/session.ts` (`:250`, `:579`, `:649`,
and `:289`/`:326` as `Partial`): the `catch` handles invalid JSON, never valid JSON of the
wrong shape, so a `session.json` holding `[]` passes through as a fully-typed `SessionHeader`.

### 4.5 `HookInput` should be a discriminated union

`hooks/io.ts:9` is one flat interface with ~25 optional fields spanning roughly fifteen
platform events, and the docblocks carefully say which field belongs to which event —
*"SessionStart only"*, *"`SessionEnd` only"*, *"`PreCompact` and `PostCompact` only"*,
*"`FileChanged` only"*, *"`PostCompact` only"*. That is fifteen invariants in comments.

Today `input.compact_summary` compiles on a `SessionStart` handler and yields `undefined` —
the benign default for an input the type was never meant to describe. The docblock at
`:38-43` shows the author reasoning about exactly this hazard one level down (*"one field
spelling both would let a `PostCompact` matcher silently accept a `SessionEnd` word"*) and
solving it by not sharing key names — which prevents the collision but not the cross-event
read.

Note the asymmetry: the *output* envelope has a proper closed union, `HookEventName =
'PreToolUse' | 'PostToolUse' | 'SubagentStart' | 'Stop'` (`:474`), with a one-builder
argument at `:476-485` that is exactly right. The *input* has `hook_event_name?: string`.

**Recommended:** discriminate on `hook_event_name`, keep the flat type as
`type AnyHookInput = SessionStartInput | PostCompactInput | …`, and let `parseHookInput`
return the union undiscriminated (it cannot know) while each hook narrows once at its entry
point. Merge `post-tool-use.ts:27`'s duplicate into it — the `tool_response?: { agentId?: string }`
field it adds is real and belongs on the `PostToolUse` arm.

**Cost: moderate.** Twenty-two files in `src/hooks/`, but each touches a handful of fields
and the narrowing is one line per hook. The payoff is that each hook's type states which
event it handles, which is currently knowable only by reading `hooks.json`.

**Encapsulation: 4/10. Invariant expression: 3/10. Usefulness: 8/10. Enforcement: 5/10.**

### 4.6 Hand-kept lists keyed by a loose type

Your framing is right: *a set that must be exhaustive over a domain, expressed as a hand-kept
list*, is the shape. The type system could have caught it **when the domain is a closed union**
(§2 — eighteen sites, cheap). It could **not** have caught `isWriter`, and it is worth being
exact about why.

`WRITERS: Record<string, string[]>` (`test/ui/no-writes.test.ts:138`) has key type `string`.
TypeScript checks object-literal completeness only when the index type is a *closed* union;
with `string` as the key, **every possible object literal is a complete
`Record<string, string[]>`**. The compiler cannot form the proposition "this table is missing
`src/core/anchors.ts`" because there is no type-level entity naming that module. Then
`(WRITERS[module] ?? []).includes(symbol)` (`:550-551`) converts "never heard of it" into the
neutral element of the domain rather than into a refusal. Both halves had to be true for the
four misses.

**So: not a type problem in the sense of "a better type would have caught it" — a domain
problem.** The right mechanism is the one the file already adopted: derive the domain from
the filesystem and assert coverage (`derivation()` at `:1519-1545`, the coverage test at
`:1676-1702`, with unusually good anti-vacuity guards — `>=150` files read, `>=20` writers
found, `>=1200` declarations checked). **The residue is named in the file itself and is where
three of the four misses live:** `review/trigger.ts`, `core/anchors.ts`,
`core/restore-stage.ts` and `core/retrieval/return-stage.ts` contain no `node:fs` call at all
— they write *through* another module, so the scan cannot see them and they are keys by
judgement only. A second derived check ("a module that imports a `WRITERS` symbol is itself a
`WRITERS` key") would close it in the same direction `reachesADerivedWriter` (`:1585`) closed
the orphan direction. The symbol lists remain hand-kept (`:197`), so a newly-exported writer
inside a listed module is still a silent hole.

**Other loose-key tables, with their unknown-key answer:**

- `INVERSE_RELATIONS: Record<string, string>` (`vocabulary.ts:239`), read by
  `inverseOf(type): string | null` (`:254`) with `?? null`. This gates `linkItems`' refusal
  of a stored mirror edge — so a relation type missing from the table answers "no inverse",
  the mirror is **not** refused, and a duplicate row becomes writable. **Fail-open on a write
  gate.** `RELATION_TYPES` (`:102`) is a plain `string[]` with no `as const`, so no
  `RelationType` union exists to key anything by. Fix: `as const`, derive the union, key the
  three tables with `satisfies Partial<Record<RelationType, …>>`. Mitigated today by a
  runtime cross-check in `help/index.ts` and by `test/core/relation-inverses.test.ts`.
- `config.ts:1956` — `enabled: override.enabled ?? true` for a custom category. Defensible
  (the user wrote the category deliberately) but it is a `?? true` on an injection gate.
- `select.ts:742` — `GOVERNING_TYPES: ReadonlySet<string>` hardcoding six category names, and
  `select.ts:775` — `if (item.type !== 'task' && item.type !== 'plan') return false;`. Both
  are hardcoded category *names*, in the ranking that decides what reaches a session, in the
  same product where `needs.ts:57-67` argues at length that a hardcoded name is wrong
  *precisely because another project may call the same idea `story` or `ticket`*. A project
  that does will find `isOpenWork` always false and every custom normative category silently
  ranked below the six. `select.ts`'s own comment explains why `isNormative` was rejected as
  the alternative (it would rank sixteen categories identically), so this is a deliberate
  trade — but it is a hand-kept list over an open domain with a benign default, and it
  belongs in the same inventory as the others.
- `renderItemBlock` (`render-item.ts:231-249`) emits a **hand-written list** of `Item` fields
  — id, type, title, body, steps, observations, scope — with nothing tying it to `Item` or
  `ContentShape`. Since `itemCost` is defined as `estimateTokens(renderItemBlock(item))`, a
  new `Item` field is silently free in every budget. Worth flagging because `trust.ts:496-500`
  justifies classifying `request` as `documentation` partly on the grounds that its absence
  from the injected surface is *"structural rather than a filter list somebody maintains"* —
  that half of the sentence is not quite true; the classification is sound for the *other*
  reason given (absence from `ContentShape`, which **is** structural).
- `WORKFLOW_EXTRA_KEYS` (`content-hash.ts:411`) is keyed by `string` over a genuinely open
  domain (user-defined `--extra` keys) and its unknown-key default is **conservative by
  design** — an unlisted key stays content and keeps counting toward the summary basis
  (`:394-401`). This is the correct treatment of an open domain and the model for the others.

### 4.7 `noUncheckedIndexedAccess` — measured, and I do not recommend it now

This is the one compiler flag that addresses the whole `Record<string, T>`-answers-`T` class
at once, so I measured it rather than guessing. With the flag on and everything else
unchanged: **2,259 errors** (baseline with the same probe config: 0). The bulk lands in
`test/` — `test/ingest/schema.test.ts` alone contributes 86.

That is not a cleanup, it is a project. **Do not turn it on as part of any of the five
changes above.** If it is ever wanted, the only sane route is `src/core/` first behind a
second tsconfig, which is itself a build-configuration decision this project has deliberately
kept minimal. I record the number so nobody has to re-measure it.

### 4.8 Escape hatches, for calibration

Across 135,756 lines of `src/`: **26** `as any`, **13** `as unknown as`, **4** non-null
assertions, **0** `@ts-ignore` / `@ts-expect-error`. That is unusually disciplined and it
matters for reading everything above: the casts this review objects to are not a habit, they
are a handful of specific, locatable decisions.

---

## What is genuinely well-typed

This is not a courtesy section. Several of these are better than what I would expect to find
in a codebase with a build step and a type-checking CI budget.

**`UPDATE_FIELD_POLICY` (`trust.ts:474-600`) is the best type in the product.** It classifies
every field of `UpdateInput` that names item data into `content` / `gated` / `documentation`,
pinned with `as const satisfies Record<Exclude<keyof UpdateInput, 'id' | 'origin' |
'summaryUnchanged' | 'distinct' | 'supersedes'>, FieldPolicy>` — so **a field added to
`UpdateInput` without a class does not compile**. Then four `Assert<>` aliases pin the two
consumer lists to it *in both directions*: `content` must be stageable and stageable must be
content; `gated` must be guarded and guarded must be gated. The docblock states the bug it
closes rather than the fix — `extra` was in neither list, so it was silently the one writable
field with no policy, and an agent holding only the MCP tools could rewrite `rule.directive`
on a governing, active, hard rule and have it apply at once. And the mechanism has already
worked in production: the comment at `:544-549` records that adding `distinct` and
`supersedes` to `UpdateInput` **broke this line**, which is exactly what it is for. Derived
types are then read *off* the table (`FieldOfPolicy<P>`, `:574-578`) rather than re-listed,
so `pack/collide.ts:167` can ask `Object.hasOwn(UPDATE_FIELD_POLICY, field)` and be right by
construction. **Encapsulation 9, expression 10, usefulness 10, enforcement 10.**

**`SUMMARY_BASIS` (`content-hash.ts:291-304`)** does the same thing for the other partition:
`satisfies Record<keyof ContentShape, SummaryBasis>` means a field added to `ContentShape`
does not compile until somebody decides whether it invalidates a summary. The docblock says
why in one sentence worth quoting back: *"A hand-kept list beside the hash is the defect this
repository has measured seven times; a partition the compiler enforces is not one."* And it
is honest about its own limit — it names `WORKFLOW_EXTRA_KEYS` and
`LIFECYCLE_OBSERVATION_CATEGORIES` as things the `satisfies` **cannot** notice, and points at
the migration scripts that handled the last two reclassifications. A type that documents the
boundary of its own guarantee is rare.

**The total-`Record` convention, twenty-plus instances, argued three times.** `GOVERNING_STATUS`
(`trust.ts:368`), `GATE_RUNG` (`select.ts:1426`), `KIND_OF` (`audit.ts:734`), `TIER_UPDATES`
(`categories.ts:104`), `PROFILES` (`:540`), `NOTE_RULE` and `ORIGINS` (`pack/history.ts:298`,
`:265`), `FILTER_FLAGS` (`pack/bundle.ts:204`), `TEMPLATE` (`rules/schema.ts:76`),
`EXECUTION_RESIDUAL` (`ui/execute.ts:152`), `WHY_SAYS` (`review/input.ts:433`),
`QUESTION_REASON` (`cli/commands/ready.ts:95`), `UNMEASURABLE_TEXT`
(`statusline-powerline.ts:983`), and more. The reasoning is written out at `trust.ts:364`,
`select.ts:1420` and `pack/history.ts:255` — three independent statements of the same
principle, which is how you know it is a convention and not an accident.

**`resolveConfig` (`config.ts:1825`).** `unknown` in, `Config` out, thirteen named validators,
refuses rather than coerces, and the one `as` in it is proven on the next line. Every
`JSON.parse` of a config document in the product routes through it — I checked all eight —
and the one function that returns raw config (`mcp/tools.ts:419`) types its return as
`unknown` and explains why. This is the model the frontmatter boundary should copy.

**`mcp/tools.ts`.** `type Args = Record<string, unknown>` and eight throwing readers, with
`optEnum` validating against the *same* exported `STATUSES`/`SEVERITIES`/`ORIGINS` the write
path uses, so there is no second vocabulary to drift. Plus `refuseUnknownArgs` closing the
world on every dispatch.

**`needs.ts` as a whole, and specifically its refusal to collapse questions.**
`Map<string, Item[]>` models the non-uniqueness of `plan/seq` **deliberately and with the
measurement** rather than asserting a uniqueness the corpus does not have — which is directly
responsive to the collisions you found this week. `RefStatus = 'satisfied' | 'pending' |
'unresolved'` is three-valued where a boolean would have lost the distinction between "the
blocker exists and has not landed" and "nothing answers to that name". `ParsedNeeds` splits
`refs` from `malformed` rather than dropping the malformed. `HeldReason` is an enumerated
reason rather than a boolean, *because* a ready list has to disclose what it left out.
`readyReport` derives readiness and stores it nowhere, with the reason stated: a stored
`ready` state would be a second copy to keep in sync. The module is pure — no I/O, no clock —
which is what makes every case in its test a plain function call. **Expression 6 (the ids are
all `string`), usefulness 10, enforcement 8.**

**`Upkeep` (`ui-server-upkeep.ts:221-268`) is a real discriminated union**, not a struct with
optional fields: `port` exists only on the arms that have one, `failures` only on
`stood-down`, and the intersected `stateWriteDiscarded?: true` is correctly factored out as
orthogonal to the discriminant. The consumption is the problem (§5); the declaration is right.

**`ParsedHookInput` (`hooks/io.ts:275-292`)** carries `parseError` rather than returning `{}`,
and the docblock is a model of how to justify a type: it names the nine-day failure the old
shape caused, lists the three features that silently vanished, and states the principle —
*"A plausible, complete-looking injection that has quietly lost three features is worse than
a visibly broken one."*

**`tierOf` (`trust.ts:303-307`) fails closed**, with `Object.hasOwn` guarding prototype
pollution, and argues the direction: *"Defaulting to `'rationale'` would silently hand an
agent status control over an item whose governing category just vanished from config — the
opposite of what a security check should do when its input goes missing."* Several other
sites do the same (`ui/static.ts:99-101` refuses an unknown extension rather than serving
octet-stream; `config.ts:1911-1917` refuses `"categories": []` rather than ignoring it;
`ingest/schema.ts:293`). The fail-closed instinct is present and well-distributed; §4.6 lists
where it is missing, not where it is absent as a habit.

**`Origin`'s fourth member.** The 24-line argument at `types.ts:9-25` for why `'review'` is a
member rather than a flag beside `'agent'` — because every guard is written `origin !==
'human'` rather than as an enumeration, so a new member inherits every refusal the moment it
exists — is the best piece of union design reasoning in the repo, and `trustedStatus`
(`:267-288`) implements it as a separate first line *so that removing it is a visible removal
rather than an edited boolean*.

**The documentation itself is a type-design artifact.** `types.ts` is 346 lines of which
perhaps 60 are declarations. Every non-obvious field says what it means, what `null` means,
why it is conditional in the frontmatter, and which measured defect produced it. I have
rated invariant *expression* low throughout because expression means "in the type"; by any
other standard this is the best-documented type surface I have reviewed.

---

## What I could not assess

- **Runtime behaviour.** I did not run the test suite (three lanes running, load-sensitive),
  did not drive a browser, and did not start or touch any server. Every claim above is from
  reading source at HEAD plus `npm run typecheck`, which is green.
- **Whether the five gates in §1 have actually failed open in production.** I traced the
  mechanism — cast → `'activ'` → `GOVERNING_STATUS['activ']` → `undefined` → falsy — and
  verified every link by reading the code. I did not construct a corrupt item and observe it,
  which is what would turn this from a demonstrated mechanism into a demonstrated incident.
  It is worth doing before the behaviour change in §1 is chosen.
- **The two UTF-8 chunk-carry bugs** (`read-model-conversations.ts:1207`,
  `session-summary.ts:910`). I verified by reading the three loops side by side and confirming
  that `conversation-index.ts:1526` carries a `Buffer` where the other two carry a `string`.
  I did not execute them against the Hebrew corpus. They are correctness bugs rather than type
  bugs and may belong to the silent-failure lane; I include them because the *type of the
  carry variable* is the entire difference between the correct and incorrect versions, which
  is the strongest evidence in this report that the byte/character distinction is load-bearing.
- **`harness/` and `src/ui/public/*.js`.** `tsconfig.json`'s `include` is
  `["src/**/*.ts", "test/**/*.ts", "scripts/**/*.ts", "e2e/**/*.ts"]`, so these are outside
  type checking by construction. I confirmed the exclusion; I did not read them. Any union
  consumed there is unchecked and no finding above covers it.
- **Triage of the 2,259 `noUncheckedIndexedAccess` errors.** I counted them and checked the
  file distribution. I did not sample them to judge what fraction are real holes versus
  mechanical `?? ''` additions — so §4.7's recommendation to defer rests on the cost, not on
  a claim that the errors are uninteresting.
- **The UI read model** (`read-model*.ts`, ~15k lines). I sampled it for the offset and
  outcome-union questions. Its own type surface — `DocNodesBody`, `DocRawBody`, the route
  handlers, the read-model return shapes — is large enough to deserve its own pass and did not
  get one.
- **`ingest/`, `lesson/`, `rules/` and `pack/` type surfaces** beyond the specific parse
  boundaries and tables cited. `ingest/session.ts`'s four unchecked `as SessionHeader` casts
  are flagged; the rest of those trees was not systematically reviewed.

---

## Change inventory, by cost

| # | Change | Files | Call sites | Behaviour change? |
|---|---|---|---|---|
| 2 | `Covers<>` helper + `as const satisfies` on ~18 value lists | ~14 | **0** | **No** |
| 5 | `assertNever` helper + convert ~8 if-chains to switch | ~6 | 0 | No (unless a branch is missing, which is the point) |
| 1 | `isStatus`/`isSeverity`/`isOrigin` + guarded read at `item.ts:545,546,584` | 3 | 0 | **Yes — needs a ruling** |
| 4a | `carry` → `Buffer` in the two broken walkers | 2 | 0 | Yes (a fix) |
| 3 | `WorkItem` brand in `needs.ts` | ~5 | ~19 in `src/` | No |
| 4b | `ByteOffset`/`RecordIndex` brands across the archive | ~8 | 60-120 lines | No |
| 4.5 | `HookInput` → discriminated union | ~22 | one line per hook | No |
| 4.3 | Brand the two nonces | 2 | <20 lines | No |
| 4.3 | Brand the four hash kinds | ~6 | moderate | No |
| 4.3 | Brand path flavours | many | **large — defer** | No |
| 4.7 | `noUncheckedIndexedAccess` | all | **2,259 errors — do not** | No |

Land 2 and 5 first: together they are a few hours, touch no call site, change no behaviour,
and every compile failure they produce is a bug found. Then 1, which is the one with real
consequences and the one that needs your ruling on what a corrupt `status` should read as.
