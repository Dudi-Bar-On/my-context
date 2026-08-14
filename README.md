# my_context

**A Claude Code plugin that remembers your project's rules, so you stop repeating them.**

You tell Claude how this project works. The next session has never heard of it. my_context
captures those rules as Markdown files inside your repository, and puts the relevant ones
back in front of Claude on its own — pinned at the start of a session, or the moment a file
they apply to is about to be opened.

Requires Node 24 or newer. No runtime dependencies.

## 1. The problem

You are working on a checkout flow. You tell Claude: *prices are integer cents, never
floating-point dollars — the rounding error at each conversion is why the total did not
match the line items last quarter.* Claude agrees, fixes the code, and the session ends.

Two days later you open a new session and ask for a discount feature. Claude writes
`price * 0.9`, and the rounding error is back.

Nothing malfunctioned. A session's memory ends when the session does. Everything you
explained — the reasoning, the corrections, the "no, not like that" — went with it.

### Why re-pasting does not fix it

The obvious workaround is to paste your rules in again at the start of each session. It
fails in three ways at once.

- **You forget.** Not always — just on the session where it mattered.
- **It drifts.** Pasted from memory, the rule comes out slightly different each time.
  "Integer cents" becomes "avoid floats", which is advice rather than a rule, and the next
  session interprets it more loosely than the last one.
- **It costs on every session.** Your rules are re-read and re-charged each time, and by
  the time you have a dozen of them, most of what you paste has nothing to do with the file
  you are about to touch.

### Why `CLAUDE.md` alone is not enough

`CLAUDE.md` is a real improvement over pasting: Claude Code loads it automatically, so at
least the rules arrive without you doing anything. It has four limits that show up as soon
as a project is more than small.

- **It is static.** It says the same thing in every session, whatever you are doing.
- **It is unscoped.** There is no way to say "this one applies only to billing code". Every
  rule applies to every file equally, which in practice means every rule is background noise
  for most of the work.
- **It is undifferentiated.** "Use two-space indentation" sits next to "never write a
  customer's email address to a log", with nothing marking one as a preference and the other
  as a legal exposure.
- **It grows until it is skimmed.** Every rule you add makes the file longer, and a long
  file competes with itself for attention. Nothing in it is ever retired, because nothing in
  it records when it was last relevant.

### The cost you actually feel

It is not really about tokens. It is that you give the same correction over and over and it
never sticks — and that after the third time you stop trusting the work and start checking
it. The time goes into re-explaining decisions you already made instead of making new ones.

my_context closes that loop: you capture a rule once, and the relevant part of what you have
captured comes back on its own, when it applies.

## 2. The idea

my_context divides what a project knows into two kinds, and treats them differently.

**Normative knowledge** is what must hold. Constraints, invariants, rules, requirements,
standards, patterns, glossary terms, instructions, non-goals, open questions. *Prices are
integer cents.* *Never log a customer's email address.* *The connection pool is capped at
20.* These answer the question **"what am I not allowed to get wrong here?"**

**Rationale** is why the project is the way it is. Decisions, ADRs, lessons, tradeoffs,
assumptions, edge cases, risks. *We chose Stripe over Adyen because the settlement timing
matched our payout schedule.* *Retry storms need jitter — we learned that the hard way in
March.* These answer **"why is it like this?"**

Both are worth keeping. Only the first governs.

<!-- example: list --summary -->
```text
┌───────────────┬───────┐
│ type          │ items │
├───────────────┼───────┤
│ constraint    │ 1     │
│ decision      │ 2     │
│ invariant     │ 1     │
│ lesson        │ 1     │
│ open_question │ 1     │
│ requirement   │ 1     │
│ rule          │ 2     │
│ standard      │ 1     │
└───────────────┴───────┘

10 item(s)
```
<!-- /example -->

That is a small example project — a fictional Bookstore API — used throughout this document.
Seven of its ten items are normative and three are rationale. `mycontext help categories`
prints the full list of types with the tier each one belongs to.

### Why the split is load-bearing, not filing

It would be easy to read this as a taxonomy: a tidy way to sort notes. It is not. The split
decides **which text is allowed to silently change how an agent behaves.**

Normative text is injected into Claude's context in full, unprompted, and it is written in
the imperative. That is the point — a rule that has to be asked for is a rule that gets
forgotten. But text with that reach is text that steers, so it has to be text somebody
approved.

Rationale never enters a session that way. At the start of a session it contributes a count
— "2 decision · 1 lesson" — and nothing more. It is indexed and searchable and retrieved on
request, but it does not arrive uninvited and it does not phrase itself as an order.

That difference in reach is why the two tiers have different rules about who may add them.
When Claude captures a normative item, it lands as a **draft** and governs nothing until a
human promotes it. When Claude captures a rationale item, it is simply recorded. Being wrong
about *why* costs you a misleading explanation; being wrong about *what must hold* costs you
wrong code, written confidently, by something you were trusting to know the rule. The
approval boundary, and its limits, are described in full further down.

## 3. How it works, in three steps

### Step 1 — you capture it

You state the rule once, on the command line or by asking Claude to record it.

<!-- example: add constraint "Uploads capped at 10 MB" --body "The API gateway rejects a larger body before it reaches us, so accepting one only produces a timeout the customer cannot explain." --scope "src/api/**" --tags uploads --yes -->
```text
about to create constraint "Uploads capped at 10 MB" — active, and governing this project at once.
my_context: created CONST-uploads-capped-at-10-mb (active) at items/constraint/CONST-uploads-capped-at-10-mb.md.
```
<!-- /example -->

Three things in that command matter.

- `--scope "src/api/**"` is what makes the rule targeted rather than ambient. It is a file
  pattern: this constraint concerns the API layer, so it will come back when API code is
  being touched and stay out of the way otherwise. A rule with no scope is stored, indexed
  and searchable, but never injected on its own — see [section 4](#4-when-it-comes-back-and-what).
- `--yes` is required because this is a normative category. The item governs the project the
  moment it exists, and the flag is the explicit acknowledgement of that. Rationale
  categories need no confirmation.
- The id, `CONST-uploads-capped-at-10-mb`, is derived from the title. You will see it in
  Claude's context, in `mycontext list`, and in the filename.

Claude can capture items too, using the `create_item` tool. A normative item captured that
way lands as a draft and waits for you.

### Step 2 — it is stored as Markdown you can read, diff and review

Every item is one file under `.my_context/items/<type>/<id>.md`, in your repository, in
plain Markdown.

<!-- example: show CONST-postgres-pool-capped-at-20 -->
```text
---
id: CONST-postgres-pool-capped-at-20
type: constraint
title: Postgres pool capped at 20
status: active
severity: hard
always: true
scope: []
tags:
  - database
  - capacity
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: a81dff73a154242e
---

# Postgres pool capped at 20

The managed Postgres plan allows 120 connections. Five API instances at 20 each
leaves 20 for migrations, backups and the admin console. Raising the pool past 20
does not buy throughput; it buys `remaining connection slots are reserved` during
the next deploy.
```
<!-- /example -->

The block between the `---` lines is the frontmatter: the fields my_context uses to decide
when this item comes back and how much to trust it. Everything below it is the body, and the
body is what Claude actually reads.

This shape is deliberate. Your project's rules live in git, so they show up in a pull
request diff, they get reviewed like code, they branch and merge with the code they describe,
and you can read them without running anything. There is no database you have to query to
find out what your own project believes.

There *is* a database — `.my_context/.index.db`, SQLite — but it is derived, never authored.
It exists so that a lookup during a session is fast. Delete it and `mycontext rebuild`
recreates it from the Markdown. The Markdown is the source of truth; the index is a cache.

One consequence worth knowing early: do not hand-edit an item file. Every write path
recomputes the item's `checksum` field, and a hand edit does not, so the recorded checksum
stops matching the content. `mycontext doctor` reports that mismatch from then on.

### Step 3 — it comes back on its own

When a session starts, Claude Code runs my_context's *hooks* — small programs Claude Code
runs at fixed moments, before anything else happens. The session-start hook selects the items
that apply and hands them to Claude as context. This is what the model receives, verbatim:

```text
## my_context — these govern this project

### CONST-postgres-pool-capped-at-20 · constraint · Postgres pool capped at 20

The managed Postgres plan allows 120 connections. Five API instances at 20 each
leaves 20 for migrations, backups and the admin console. Raising the pool past 20
does not buy throughput; it buys `remaining connection slots are reserved` during
the next deploy.

## my_context index
- INV-prices-are-integer-cents · invariant · Prices are integer cents
- REQ-checkout-completes-in-two-steps · requirement · Checkout completes in two steps
- RULE-never-log-customer-email · rule · Never log customer email
- STD-api-errors-use-problem-json · standard · API errors use Problem JSON

2 decision · 1 lesson · 1 drafts pending review · 1 retired
→ use mycontext list or mycontext show <id> to browse these
```

One item arrived in full, because it is pinned. Four arrived as a single line each, so Claude
knows they exist and can fetch any of them by id. The rationale items arrived as a count.
Nothing was left out without being mentioned.

A second hook runs before Claude reads or edits a file, and that one is where scope pays off.
The next section is about which of these fires when.

## 4. When it comes back, and what

There are four tiers. Each one has a condition that fires it and a rule about what it
contains.

| Tier | Fires | Contains |
|---|---|---|
| **pinned** | every session start, and again after a compaction | every active normative item marked `always: true`, in full |
| **just in time** | Claude is about to read or edit a file matching an item's `scope` | that item, in full |
| **restored** | after a compaction | the items that were in context before it |
| **index** | every session start, and after a compaction | one line per remaining normative item, plus counts for the rest |

### Pinned — the handful that always apply

An item with `always: true` in its frontmatter is injected in full at every session start,
whatever you are working on, whatever files you touch. In the example above, that is
`CONST-postgres-pool-capped-at-20`: a limit that constrains any code that opens a database
connection, so waiting for a matching file would be waiting too long.

Pinning is for the small set of rules that are genuinely unconditional. The pinned tier has
its own budget, and everything you pin competes for it against everything else you pinned.

An item is set to `always: true` by promoting it with
`mycontext review promote <id> --always` while it is still a draft. That is currently the
only route; the gap is described further down rather than papered over.

### Just in time — the ones that apply to what you are touching

`scope` is a list of file patterns. When Claude is about to read or edit a file, my_context
looks for active normative items whose scope matches that path and injects them, in full,
before the tool runs.

`INV-prices-are-integer-cents` carries `scope: src/billing/**`:

<!-- example: show INV-prices-are-integer-cents -->
```text
---
id: INV-prices-are-integer-cents
type: invariant
title: Prices are integer cents
status: active
severity: soft
always: false
scope:
  - src/billing/**
tags:
  - billing
  - money
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: b9c3d588c634c8cc
---

# Prices are integer cents

Every price crossing a module boundary is an integer number of cents.
Floating-point dollars re-introduce a rounding error at each conversion, and the
total a customer approves at checkout must equal the sum of its line items exactly.
```
<!-- /example -->

So the moment Claude opens `src/billing/prices.js`, this is what it receives first:

```text
## my_context — these govern this project

### INV-prices-are-integer-cents · invariant · Prices are integer cents

Every price crossing a module boundary is an integer number of cents.
Floating-point dollars re-introduce a rounding error at each conversion, and the
total a customer approves at checkout must equal the sum of its line items exactly.

_scope: src/billing/**_

### RULE-never-log-customer-email · rule · Never log customer email

Log the customer id instead. Access logs are shipped to a third-party aggregator
that our data-processing agreement does not cover, so an email address in a log
line leaves the boundary the checkout flow promises the customer.

_scope: src/**_
```

Two items matched: the billing invariant, and a rule scoped to `src/**` that applies to that
file too. Open `src/catalogue/search.js` instead and only the second one arrives — the
billing invariant is not relevant there, so it is not spent.

Three details a developer will want:

- **Scope is inert by default.** An item with no scope patterns is never injected by this
  tier. That is deliberate: defaulting an unscoped item to "matches everything" would refill
  the context window as the corpus grows, which is the failure this design exists to avoid.
  An unscoped, unpinned item is indexed and retrievable, and nothing more. `mycontext status`
  counts them for you.
- **Each item arrives once per session.** my_context records what it has already injected, so
  editing ten billing files does not deliver the same invariant ten times.
- **This tier carries no index.** A file-triggered injection contains matching items and
  nothing else. The index is a per-session cost, not a per-file one.

### Restored — after the context window is compacted

A long session eventually runs out of context window, and Claude Code *compacts* it:
summarises the conversation so far and continues from the summary. The summary is much
shorter than what it replaces, and the rules that were injected earlier are usually among
what it drops.

my_context takes a snapshot immediately before that happens, recording which items were in
play — both the ones it injected and any that were referenced by id in the transcript. When
the session resumes after compaction, those items are re-injected, alongside the pinned tier
and the index.

Two honest limits. The snapshot is keyed on the session id that the hooks receive, so items
you loaded manually with `/mycontext:LoadMyContext` are not recorded and are not restored —
that surface has no trustworthy session id to record against. And restoration is bounded by
its own budget, like every other tier.

### The index — so nothing is invisible

Whatever the tiers above did not deliver in full, the index lists. One line per remaining
active normative item: id, type, title. Enough for Claude to know the rule exists and to
fetch it by id when it turns out to matter, and cheap enough to include every time.

Rationale items are not listed individually. They are counted by type — `2 decision`,
`1 lesson` — along with the number of drafts waiting for review and the number of retired
items. An item whose category has been disabled in configuration is counted too, labelled as
such, so turning a category off never makes its items disappear without a trace.

An item that was already delivered in full gets no index line. Claude has the whole rule
already, and spending index space on a repetition would push something genuinely unseen out
of the list.

### The budget, and what happens when it does not fit

Each tier has a size limit, so that a growing corpus cannot quietly take over the context
window. The defaults:

| Budget | Default | Governs |
|---|---|---|
| `pinned` | 1500 | the pinned tier at session start |
| `jit` | 500 | one file-triggered injection |
| `restored` | 2000 | the re-injection after a compaction |
| `index` | 150 | the index list |

The unit is estimated tokens, and "estimated" is meant literally: it is the character count
divided by four. my_context ships with no runtime dependencies and therefore no tokenizer, so
this is an approximation that can err in either direction, not a guaranteed ceiling.

Items are admitted hardest-first — `severity: hard` before `severity: soft`, project layer
before global, then by id so the result is deterministic. An item too large for the remaining
space is skipped rather than ending the pass, so a smaller item behind it can still be
admitted.

**What does not fit is listed, never dropped in silence** — the project's own
`INV-nothing-is-dropped-silently`. Concretely, an item that a full-text tier could not fit
appears twice: named in a one-line note under the injection,

```text
_1 item(s) omitted from full text for budget: CONST-postgres-pool-capped-at-20. Fetch with mycontext show <id>._
```

and again as an ordinary line in the index, because it was not delivered in full and so is
still worth listing.

There is one place where a specific id is not named, and it is worth stating plainly: when
the *index itself* runs out of budget, the lines that do not fit are replaced by a count.

```text
- … +2 more (fetch with mycontext show <id>)
```

The count is never wrong, and `mycontext list` shows the whole corpus from the terminal — but
inside that session Claude sees the number rather than the names. Everywhere else, what was
excluded is named where it was excluded.

## Quick start

```bash
npm install
npm link          # provides the `mycontext` command

mycontext init
mycontext add constraint "Postgres pool capped at 20" \
  --body "RDS permits 25; 5 are reserved for migrations." \
  --scope "src/db/**" --yes
mycontext status
```

`add` takes `--body`, `--scope` and `--tags` (`--scope`/`--tags` are comma-separated), and
refuses any option it does not recognise rather than folding it into the title. Observations
and relations are not expressible as flags — use the `create_item` tool for those.

`--yes` is required for a **normative** category, because that item governs the project the
moment it exists (see the approval boundary below). Rationale categories (`decision`,
`lesson`, `adr`, …) need no confirmation.

Without `npm link`, every command also works as `node src/cli/index.ts <args>`.

## Two surfaces, one corpus

**The model** uses the eleven MCP tools (`create_item`, `query_items`, `get_item`, …).

**You** use slash commands, namespaced by the plugin's name:

```
/mycontext:add-requirement  Sessions expire after 30 minutes
/mycontext:list-decision    --full
/mycontext:search           connection pool
/mycontext:review
/mycontext:status
/mycontext:LoadMyContext
```

There is one `add-<type>` and one `list-<type>` per **enabled** category — 34 today,
plus `search`, `review` and `status`. They are generated from the same resolved config
`mycontext help categories` prints, by `npm run gen:commands`, and a test fails if the
committed files and the generator disagree: a disabled category cannot keep a command
that would then be refused. Every one of them is `disable-model-invocation: true` — they
are your surface, not the model's.

## Output

Every reporting command — `status`, `list`, `decay`, `review list`, `doctor`,
`ingest-status` — takes `--full`, `--short` (the default) and `--summary`, and `--json`.
Text output is column-aligned with headers; `--json` is the only faithful rendering of the
hierarchical reports (an ingest session's per-anchor progress, a draft's body), and it
carries any corpus load errors inside the document so it stays parseable. An option none of
them recognises is refused, not silently ignored — all six, checked against the command
registry by `test/cli/unknown-flag-refusal.test.ts` rather than command by command.
`review promote` and `review discard` are checked against their own flag sets, so a
`--json` meant for the queue does not pass silently on a subcommand that writes.

`mycontext query` is **not** one of them. It takes `--json` and `--limit <n>` only, and
refuses anything else: a SQL result set has no detail levels, because its columns are the
ones your own `SELECT` names. Its `--json` is a document — `{ rows, rowCount, truncated,
limit, loadErrors }` — not a bare array: results are capped at 1000 rows by default, and
`truncated` is how a machine learns the answer was cut. Put a `--` before SQL that begins
with a `--` comment.

## The approval boundary — read this before trusting it

A normative item captured by a model lands as a `draft` and governs nothing until a human
promotes it. A rule derived from a lesson is inert until a human accepts it. That is the
design.

**What actually enforces it: your Bash permissions, and nothing else.**

Six CLI commands change what governs this project with no human in the loop. Five put an
item past the draft gate — three of them were documented at one point, then four, and the
fifth (`repair`) was shipped in the same round that wrote the list. The sixth,
`supersede`, goes the other way: it takes a governing item *out*.

| Command | What it does with no human in the loop |
|---|---|
| `mycontext review promote <id>` | turns a draft into an `active` governing item |
| `mycontext review discard <id>` | retires a draft |
| `mycontext lesson-accept <lesson> <key>` | creates an `active` rule from a staged candidate |
| `mycontext add <normative category> "…" --yes` | creates an `active` governing item **directly** — it passes `origin: 'human'`, so the draft demotion never applies. It requires `--yes`, on the same terms as `promote`: anything that can run `mycontext` can pass `--yes`, so the gate buys an explicit token in the transcript, not protection |
| `mycontext supersede <id> --by <id> --yes` | retires a governing item, setting it `superseded` so it stops being injected, and records the pair in both directions (`superseded_by` on the retiree, `supersedes` on the replacement). It passes `origin: 'human'`, which is precisely what the `supersede_item` MCP tool refuses to do for an `active` or `validated` normative item — so this command is the route around that refusal for anything holding a shell. It prints what is being retired, on what terms it is injected today, and what governs afterwards (including "nothing") before asking to confirm |
| `mycontext repair --yes` | re-stamps the checksum of any item whose file no longer matches it. That is the *point* of the command, and it is also what completes a route nothing else offers: `update_item` refuses `always`/`severity`/`status` on a governing item, and a hand edit of those fields leaves a permanent mismatch that `doctor` reports and `rebuild` never clears — until `repair` clears it. So hand edit + `repair --yes` changes what governs this project and leaves no evidence it happened. Verified by execution |

They are ordinary CLI commands. The rule-derivation request this plugin prints *instructs
the model to shell out to this CLI*, and the same shell reaches every one of them. The
`--yes` confirmation on `promote`, `discard`, `add` and `supersede` is
**not** a security boundary — an agent composing the command line can add `--yes` itself.
What it buys is legibility: a governing item cannot be created or retired without an
explicit, greppable token in the transcript.

**There is a second route that bypasses the CLI entirely.** The `PreToolUse` hook denies
writes under `.my_context/`, but its matcher is `Read|Edit|MultiEdit|Write|NotebookEdit` —
**`Bash` is not matched**, and the hook only inspects a `file_path` argument, which a Bash
call does not carry. A shell redirect into `.my_context/items/…` followed by
`mycontext rebuild` is therefore not seen by it at all. Adding `Bash` to that matcher would
not close this on its own: the hook would have to parse arbitrary command strings to find
the write, which is the same unbounded problem the permission rules below have.

**Alternate spellings of the managed directory are closed, including the ones that share no
characters with it.** The write-deny matches the `.my_context` and `.my-context` path
segments case-insensitively, and then canonicalizes the path — resolving the longest prefix
that already exists, since a `Write` names a file that does not — so a spelling the string
match cannot see is still caught by what it resolves to. On this machine that covers a
Windows **8.3 short name** (`MY_CON~1`, generated whenever `fsutil 8dot3name query <volume>`
reports enabled), symlinks and NTFS junctions pointing into the directory, `\\?\` prefixes,
`\\localhost\C$` admin shares, `subst` drives, and `..` traversal — each probed by
execution against the real hook, before and after. A symlink or junction pointing *into*
`.my_context` is denied for the same reason: it is another name for the same directory.

**What canonicalization cannot close is a hard link.** A symlink has a target; a hard link
is a second, equal directory entry for the same file, and nothing can say which entry is
the real one. A hard link placed outside `.my_context` that points at an existing item file
is a path the hook cannot recognize, and a `Write` through it edits the item in place. That
is not a separate route so much as a corollary of the Bash route above — creating the link
needs a shell in the first place — but it is the one spelling this hook looks like it
should catch and does not.

**The honest statement, and it is broader than the one this file used to make: the gate
holds if and only if the agent's Bash surface excludes the `mycontext` binary entirely, in
every spelling, *and* direct writes into `.my_context/`.**

**A plugin cannot ship permission rules.** Claude Code's plugin `settings.json` supports
only the `agent` and `subagentStatusLine` keys, so this repository cannot close the gap on
your behalf. If you want the boundary enforced, put it in your own
`.claude/settings.json`:

```json
{
  "permissions": {
    "deny": [
      "Bash(mycontext lesson-accept *)",
      "Bash(mycontext review promote *)",
      "Bash(mycontext review discard *)",
      "Bash(mycontext add *)",
      "Bash(mycontext supersede *)",
      "Bash(mycontext repair *)"
    ]
  }
}
```

**These rules are not complete coverage, and nothing here can make them so.** They are
prefix matches on a command string. `node .claude/plugins/…/src/cli/index.ts add …`, an
`npx` invocation, a shell variable holding the path, or any other spelling of the same
program is a different string and is **not** denied — and none of them touch the
`.my_context/` redirect route above. The rules raise the cost of an accidental promotion;
they do not make one impossible.

## Pinning an item to every session

An item with `always: true` is injected in full at the start of every session, regardless
of scope. Other **normative** items appear as a one-line index entry; rationale items
(`lesson`, `adr`, `decision`, `tradeoff`, …) are never listed individually — they
contribute only an aggregate count. See `mycontext help categories`.

There is exactly one route: **`mycontext review promote <id> --always`, while the item is
still a draft.** Once it is governing, nothing sets `always` on it — `review` acts only on
drafts, and `update_item` refuses `scope`/`always`/`severity` on a governing normative item
because every MCP write hardcodes a non-human origin. That gap is real and is recorded as a
follow-up, not papered over here.

`update_item` does accept `always` on a **rationale** item (`lesson`, `adr`, `decision`,
`tradeoff`, …) — but it is inert there, and it now says so instead of reporting a bare
"updated": selection admits only normative items to the pinned tier, so a rationale item
with `always: true` is never injected. It is stored rather than refused, because it would
take effect if the category's tier changed.

**Do not hand-edit `always:` (or any other field) in an item's
Markdown frontmatter.** Every write path recomputes the item's `checksum`; a hand edit does
not, so the recorded checksum stops matching the content and `mycontext doctor` reports
the mismatch and exits 1, from then on. `mycontext rebuild` does **not** recompute it —
verified by execution: edit `always:` by hand, run `rebuild`, and the `checksum:` line is
byte-identical to what it was before. Worse, the mismatch is then indistinguishable from
the one real corruption case: doctor can only say the content no longer matches the
recorded checksum, and a hand edit and a write-time round-trip failure that silently *lost*
text produce the same finding.
`mycontext repair` re-stamps the checksum after a deliberate hand edit; it makes the
recorded checksum agree with the file, and it cannot recover anything the edit removed.

Design: `docs/superpowers/specs/2026-08-12-my-context-design.md`
