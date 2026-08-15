# my_context

**A Claude Code plugin that remembers your project's rules, so you stop repeating them.**

You tell Claude how this project works. The next session has never heard of it. my_context
captures those rules as Markdown files inside your repository, and puts the relevant ones
back in front of Claude on its own — pinned at the start of a session, or the moment a file
they apply to is about to be opened.

![Node 24 or newer](https://img.shields.io/badge/node-%E2%89%A5%2024-informational)
![Zero runtime dependencies](https://img.shields.io/badge/runtime%20dependencies-0-informational)
![Markdown is the source of truth](https://img.shields.io/badge/storage-markdown%20in%20your%20repo-informational)

Node 24 or newer, no runtime dependencies and no build step — the TypeScript sources are
executed directly. In a hurry: [installing it](#installing-it).

<div dir="rtl">

**בעברית:** my_context הוא תוסף ל-Claude Code שזוכר את הכללים של הפרויקט שלך. אתה מסביר
ל-Claude איך הפרויקט עובד, והסשן הבא מעולם לא שמע על זה; my_context לוכד את הכללים האלה
כקובצי Markdown במאגר שלך ומחזיר את הרלוונטיים שבהם מעצמו — נעוצים בתחילת הסשן, או ברגע
שנפתח קובץ שהם חלים עליו. **[התיעוד המלא בעברית](docs/README.he.md)** מקביל למסמך הזה
פרק-פרק.

</div>

## Contents

1. [The problem](#1-the-problem)
2. [The idea](#2-the-idea)
3. [How it works, in three steps](#3-how-it-works-in-three-steps)
4. [When it comes back, and what](#4-when-it-comes-back-and-what)
5. [Using it](#5-using-it) — [installing it](#installing-it), [slash commands](#what-you-type-the-slash-commands), [the CLI](#what-you-run-the-cli), [MCP tools](#what-the-model-calls-the-mcp-tools)
6. [Configuration](#6-configuration)
7. [The trust boundary](#7-the-trust-boundary)
8. [Not yet available](#8-not-yet-available)

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

```mermaid
flowchart TB
  A["You explain the rule"] --> B["Claude applies it"]
  B --> C["The session ends,<br/>and the rule ends with it"]
  C -->|"next session"| A
  A -.->|"capture it once"| D["<b>.my_context/</b><br/>Markdown in your repository"]
  D -.->|"pinned at session start, or<br/>when a file it scopes is opened"| B
  linkStyle 3,4 stroke:#2e7d32
```

The solid arrows are the loop you are in today. The dotted ones are what my_context adds:
one capture, and a return path that does not depend on you remembering.

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
approval boundary, and its limits, are described in full in
[section 7](#7-the-trust-boundary).

## 3. How it works, in three steps

```mermaid
flowchart LR
  Y["<b>You</b><br/>mycontext add"] --> MD
  M["<b>Claude</b><br/>create_item"] --> MD["<b>.my_context/items/</b><br/>one Markdown file per item<br/><i>the source of truth</i>"]
  MD -->|"rebuild"| DB[("<b>.index.db</b><br/>derived cache")]
  DB --> SEL["<b>selection</b><br/>what is eligible,<br/>what fits the budget"]
  SEL --> HK["<b>hooks</b><br/>session start · before a file<br/>· before a compaction"]
  HK --> CX["Claude's context"]
```

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

```mermaid
flowchart LR
  S(["A session starts"]) --> Q{"always: true?"}
  Q -->|yes| PIN["<b>pinned</b><br/>injected in full"]
  Q -->|no| IDX["<b>index</b><br/>one line: id · type · title"]
  F(["Claude is about to read<br/>or edit a file"]) --> G{"does the file match<br/>the item's scope?"}
  G -->|yes| JIT["<b>just in time</b><br/>injected in full, once per session"]
  G -->|no| NO["nothing — the item stays<br/>out of the way"]
  C(["The session is compacted"]) --> RES["<b>restored</b><br/>what was in context before"]
  C --> PIN
  C --> IDX
```

### Pinned — the handful that always apply

An item with `always: true` in its frontmatter is injected in full at every session start,
whatever you are working on, whatever files you touch. In the example above, that is
`CONST-postgres-pool-capped-at-20`: a limit that constrains any code that opens a database
connection, so waiting for a matching file would be waiting too long.

Pinning is for the small set of rules that are genuinely unconditional. The pinned tier has
its own budget, and everything you pin competes for it against everything else you pinned.

An item is set to `always: true` by promoting it with
`mycontext review promote <id> --always` while it is still a draft. That is currently the
only route, and the gap is stated in [section 6](#6-configuration) rather than papered over.

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

## 5. Using it

my_context has two surfaces over one corpus. One is for you, one is for the model, and the
split is deliberate rather than historical.

**You** type slash commands inside a Claude Code session, or run the `mycontext` command in
a terminal. **The model** calls the eleven MCP tools. Both surfaces read and write the same
Markdown files under `.my_context/`, so an item you capture in the terminal is in the
model's index the next time it looks, and an item the model captures shows up in
`mycontext list` at once.

Both exist because each is unusable in the other's situation. The model cannot stop
mid-sentence to open a terminal, so it needs tools it can call directly. You need a surface
that works when no model is in the room — in a script, in CI, or when you simply want to
read what the project believes. And a few acts are meant to be yours alone: promoting a
draft, retiring a governing item. How far that separation actually holds is
[section 7](#7-the-trust-boundary), and it is worth reading before you rely on it.

```mermaid
flowchart TB
  U(["<b>You</b>"]) --> SL["<b>/mycontext:…</b><br/>38 slash commands"]
  U --> CL["<b>mycontext …</b><br/>21 CLI commands"]
  A(["<b>Claude</b>"]) --> TL["<b>MCP tools</b><br/>eleven, served over stdio"]
  SL -->|"add-* · search · LoadMyContext"| TL
  SL -->|"list-* · review · status"| CL
  TL --> CO["<b>.my_context/</b><br/>one corpus of Markdown,<br/>in your repository"]
  CL --> CO
```

### Installing it

There are two halves, and they install differently. The `mycontext` command is an npm
package in this repository. The slash commands, the hooks and the MCP server are a Claude
Code **plugin** — declared by `.claude-plugin/plugin.json` and discovered from `commands/`,
`hooks/hooks.json` and `.mcp.json` at the repository root.

**The command.** From a clone of this repository:

```bash
npm install
npm link          # provides the `mycontext` command

cd /path/to/your/project
mycontext init
```

`mycontext init` creates `.my_context/` in the current directory with an `items/`
directory, a `config.json` and a `.gitignore`. Commit it: the corpus is meant to travel
with the code it describes. Without `npm link`, every command also works as
`node /path/to/my-context/src/cli/index.ts <args>`.

**The plugin.** One route is verified to work today, and it is per-session:

```bash
claude --plugin-dir /path/to/my-context
```

To check what that loaded, ask Claude Code itself:

```bash
claude --plugin-dir /path/to/my-context plugin details mycontext
```

It prints the component inventory — the 38 commands and the `mycontext` skill, the four
hooks (`SessionStart`, `PreToolUse`, `PreCompact`, `PostToolUse`) and the one MCP server —
which is how you confirm the plugin is loaded rather than assuming it.

**A persistent install is not available yet, and this is worth knowing before you try it.**
The `/plugin marketplace add` and `/plugin install` route needs a
`.claude-plugin/marketplace.json`, and this repository does not ship one:
`claude plugin marketplace add ./` in this directory fails with
`Marketplace file not found`. Until that manifest exists — [section 8](#8-not-yet-available)
— `--plugin-dir` on each launch is the route. Both statements above were established by
running the commands, not by reading the documentation.

### What you type: the slash commands

Slash commands are namespaced by the plugin's name, so every one of them begins
`/mycontext:`. Grouped by what you are trying to do:

**Capture.** One `add-<type>` per enabled category. The normative ones —
`/mycontext:add-constraint`, `/mycontext:add-invariant`, `/mycontext:add-rule`,
`/mycontext:add-requirement`, `/mycontext:add-standard`, `/mycontext:add-pattern`,
`/mycontext:add-glossary`, `/mycontext:add-instruction`, `/mycontext:add-non-goal`,
`/mycontext:add-open-question` — capture through the `create_item` tool and land as
**drafts**. The rationale ones — `/mycontext:add-adr`, `/mycontext:add-decision`,
`/mycontext:add-lesson`, `/mycontext:add-tradeoff`, `/mycontext:add-assumption`,
`/mycontext:add-edge-case`, `/mycontext:add-risk` — land active, because rationale is never
injected and so cannot silently steer anything.

```
/mycontext:add-constraint  The connection pool is capped at 20
/mycontext:add-decision    We chose Stripe because settlement timing matched payouts
```

**Find.** `/mycontext:search` takes words and calls the `query_items` tool; it is the one
place to start when you do not know an id. One `list-<type>` per enabled category prints
that category's table: `/mycontext:list-constraint`, `/mycontext:list-invariant`,
`/mycontext:list-rule`, `/mycontext:list-requirement`, `/mycontext:list-standard`,
`/mycontext:list-pattern`, `/mycontext:list-glossary`, `/mycontext:list-instruction`,
`/mycontext:list-non-goal`, `/mycontext:list-open-question`, `/mycontext:list-adr`,
`/mycontext:list-decision`, `/mycontext:list-lesson`, `/mycontext:list-tradeoff`,
`/mycontext:list-assumption`, `/mycontext:list-edge-case`, `/mycontext:list-risk`. Each
takes the same detail flags as the CLI.

`/mycontext:LoadMyContext` is the odd one out: it injects the pinned items and the index
into the session right now, without waiting for a session start. Use it when you cleared
the context, or after a compaction — items loaded this way are not snapshotted and are not
restored automatically.

**Review.** `/mycontext:review` walks the queue of drafts and prints, for each, what it
would govern. It deliberately stops there: it tells you the exact
`mycontext review promote <id>` or `mycontext review discard <id>` to run and does not run
it for you.

**Diagnose.** `/mycontext:status` prints the same report as the CLI's `status`, plus at
most two lines saying what needs your attention.

```
/mycontext:search           connection pool
/mycontext:list-decision    --full
/mycontext:review
/mycontext:status
/mycontext:LoadMyContext
```

There is one `add-<type>` and one `list-<type>` per **enabled** category — 34 today, plus
`search`, `review` and `status`. They are generated from the same resolved config
`mycontext help categories` prints, by `npm run gen:commands`, and a test fails if the
committed files and the generator disagree: a disabled category cannot keep a command that
would then be refused.

All 37 of those carry `disable-model-invocation: true`, and it is in effect — they are your
surface, not the model's. `/mycontext:LoadMyContext` is the single exception, and it is the
one command that only reads.

**"In effect" is doing work in that sentence, and here is why.** Until recently it was not.
Nineteen of the 38 files — the 17 `list-<type>` commands plus `review` and `status` — carried
`argument-hint: [--full|--short|--summary] [--json]`, which opens a YAML flow sequence and
then trails a second one: not valid YAML. Claude Code's message for that case is explicit —
*at runtime this command loads with empty metadata (all frontmatter fields silently
dropped)* — so on those 19, `disable-model-invocation` was written down and not in effect,
and the model could invoke commands that said it could not. Every hint is now quoted, all 37
files were regenerated, and `claude --plugin-dir . plugin validate .` passes with zero errors
against this repository. The test in `test/plugin/commands.test.ts` used to check those lines
with a regex, which is why it passed throughout; it now parses the frontmatter and asserts
`disable-model-invocation` comes back as the boolean `true`.

**One asymmetry, stated rather than smoothed over: `/mycontext:search` has no CLI
counterpart.** There is no `search` command in the CLI. The slash command calls the
`query_items` MCP tool directly, and the nearest terminal equivalents are `mycontext list`
for a category and `mycontext query` for SQL over the index. The two surfaces do not cover
the same ground yet.

### What you run: the CLI

Twenty-one commands. `mycontext help` prints the same list from the program itself, and
`mycontext help <topic>` explains one of `categories`, `scope`, `capture`, `workflow`.

**Capture and change.**

| Command | What it does |
|---|---|
| `mycontext init` | create `.my_context/` in the current directory |
| `mycontext add <category> <title>` | create an item — `--body`, `--scope`, `--tags`, `--yes` |
| `mycontext review promote <id>` | turn a draft into an active governing item |
| `mycontext review discard <id>` | retire a draft |
| `mycontext supersede <id> --by <id>` | retire a governing item in favour of a replacement |
| `mycontext repair` | re-stamp the checksum of an item whose file no longer matches it |
| `mycontext rebuild` | rebuild `.index.db` from the Markdown |

`add` takes `--body`, `--scope` and `--tags` (`--scope`/`--tags` are comma-separated), and
refuses any option it does not recognise rather than folding it into the title.
Observations and relations are not expressible as flags — use the `create_item` and
`link_items` tools for those. `--yes` is required for a **normative** category, because
that item governs the project the moment it exists; rationale categories need no
confirmation.

**Find and read.**

| Command | What it does |
|---|---|
| `mycontext list [category]` | the corpus as a table |
| `mycontext show <id>` | one item in full, exactly as it is on disk |
| `mycontext query "SELECT …"` | read-only SQL over the index |
| `mycontext examples <category>` | a complete, correct example item of that type |
| `mycontext help [topic]` | guidance: categories, scope, capture, workflow |

<!-- example: list -->
```text
┌─────────────────────────────────────┬───────────────┬────────────┬─────────────────────────────────┐
│ id                                  │ type          │ status     │ title                           │
├─────────────────────────────────────┼───────────────┼────────────┼─────────────────────────────────┤
│ CONST-postgres-pool-capped-at-20    │ constraint    │ active     │ Postgres pool capped at 20      │
│ DEC-search-with-postgres-full-text  │ decision      │ active     │ Search with Postgres full text  │
│ DEC-use-stripe-for-payments         │ decision      │ active     │ Use Stripe for payments         │
│ INV-prices-are-integer-cents        │ invariant     │ active     │ Prices are integer cents        │
│ LESSON-retry-storms-need-jitter     │ lesson        │ active     │ Retry storms need jitter        │
│ OPENQ-which-search-engine           │ open_question │ superseded │ Which search engine?            │
│ REQ-checkout-completes-in-two-steps │ requirement   │ active     │ Checkout completes in two steps │
│ RULE-cache-keys-include-tenant-id   │ rule          │ draft      │ Cache keys include tenant ID    │
│ RULE-never-log-customer-email       │ rule          │ active     │ Never log customer email        │
│ STD-api-errors-use-problem-json     │ standard      │ active     │ API errors use Problem JSON     │
└─────────────────────────────────────┴───────────────┴────────────┴─────────────────────────────────┘
```
<!-- /example -->

`mycontext show <id>` prints the file itself, frontmatter included — the same output
[section 3](#3-how-it-works-in-three-steps) uses. `mycontext examples <category>` prints a
worked specimen of a type you have not used before, so you can see the shape before writing
one:

<!-- example: examples rule -->
```text
---
id: RULE-never-log-request-bodies-on-auth-endpoints
type: rule
title: Never log request bodies on auth endpoints
status: active
severity: soft
always: false
scope:
  - src/api/auth/**
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: <today>
valid_until: null
checksum: 0040bc230528c1af
directive: dont
---

# Never log request bodies on auth endpoints

Bodies carry passwords and reset tokens; logs are retained for 90 days.
```
<!-- /example -->

`valid_from` reads `<today>` because that field is stamped with the day the command is run.
Every block in this document is produced by actually running the command it sits under and
re-checked by the test suite, so a real date printed there would be a date that is wrong for
everyone who did not run it on the day it was generated.

**Review the queue.**

<!-- example: review list -->
```text
┌───────────────────────────────────┬──────┬────────┬────────┬────────┬──────────────────────────────┐
│ id                                │ type │ origin │ always │ source │ title                        │
├───────────────────────────────────┼──────┼────────┼────────┼────────┼──────────────────────────────┤
│ RULE-cache-keys-include-tenant-id │ rule │ agent  │ no     │ -      │ Cache keys include tenant ID │
└───────────────────────────────────┴──────┴────────┴────────┴────────┴──────────────────────────────┘

1 draft(s) pending. Promote with `mycontext review promote <id>`.
```
<!-- /example -->

`mycontext review show <id>` prints one draft in full. `mycontext review promote <id>`
makes it govern; `--always` pins it at the same time, and that is the only route to
`always: true` (see [section 6](#6-configuration)). `mycontext review discard <id>` retires
it instead.

**Diagnose.**

| Command | What it does |
|---|---|
| `mycontext status` | counts, review queue, ingest progress, decay and health |
| `mycontext doctor` | index freshness, orphans, drift, dead globs, permissions, session ids |
| `mycontext decay` | items that have not been injected lately |

<!-- example: status -->
```text
my_context: 10 item(s), profile "standard"

by category
  ┌───────────────┬───────┐
  │ category      │ items │
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

by status
  ┌────────────┬───────┐
  │ status     │ items │
  ├────────────┼───────┤
  │ active     │ 8     │
  │ draft      │ 1     │
  │ superseded │ 1     │
  └────────────┴───────┘

by origin
  ┌────────┬───────┐
  │ origin │ items │
  ├────────┼───────┤
  │ agent  │ 2     │
  │ human  │ 8     │
  └────────┴───────┘

review queue: 1 draft(s) pending review — walk it with `mycontext review`.

usage: no sessions recorded yet — decay reporting starts once items begin to be injected.
  1 active normative item(s) carry no scope and are never auto-injected.

health: 0 error(s), 0 warning(s), 0 note(s) — details from `mycontext doctor`.
```
<!-- /example -->

`mycontext doctor` is the one to run when something looks wrong. On a healthy corpus it is
one line:

<!-- example: doctor -->
```text
my_context doctor: 0 error(s), 0 warning(s), 0 note(s) across 0 finding(s).
```
<!-- /example -->

`mycontext decay` answers "what have I captured and never used". Its report leads with a
caveat, because the answer is easy to misread — the ledger records *injection*, not reading
or reliance, so a brand-new item and an abandoned one look identical here.

<!-- example: decay --summary -->
```text
my_context decay — items not injected in the last 20 session(s). The ledger holds 0 session(s).
  "cold" means: not auto-injected in the last window of sessions. It does NOT mean unused — the ledger records injection, not reading or reliance, so a new item, and any item consulted via `show`, MCP `get_item`, or the Markdown file directly, look exactly like an abandoned one here.
  Do not supersede or deprecate anything on this report alone — verify real usage first.
  (no sessions recorded yet — nothing here has been measured; "cold" currently means only "never injected")

cold 4, unscoped 1, warm 0. Rows with `mycontext decay` (default) or `--full`.
```
<!-- /example -->

That caveat paragraph is emitted unwrapped at every detail level and is 284 characters
wide, so it will wrap wherever your terminal decides. It is not pleasant to read and is
recorded as a follow-up rather than described as fine.

**Ingest a document.** Turning an existing spec or PRD into items is a two-step
conversation, because my_context has no model of its own: it hands you the text and
validates what comes back.

| Command | What it does |
|---|---|
| `mycontext ingest <path>` | emit an extraction request for one chunk of a document |
| `mycontext ingest-apply <id> --anchor <a>` | apply the extracted candidates as drafts |
| `mycontext ingest-status` | list ingest sessions and their progress |

`mycontext ingest docs/prd.md` prints a chunk of the document plus instructions and a JSON
schema; you (or the model) return a JSON array of candidates to
`mycontext ingest-apply <session-id> --anchor <anchor> --stdin`, and the next chunk's
request comes back automatically. Every candidate must quote its source span verbatim —
a paraphrase is rejected — and everything applied lands as a **draft**. The model's
equivalent is the `ingest_document` tool, which does both legs in one place.

**Turn a lesson into rules.** The same shape, for incidents rather than documents.

| Command | What it does |
|---|---|
| `mycontext lesson "<text>"` | record a lesson and request candidate rules |
| `mycontext lesson-stage <id>` | stage the returned candidates for approval |
| `mycontext lesson-accept <id> <key>` | approve one candidate and create the rule |
| `mycontext lesson-discard <id> <key>` | permanently reject one candidate |

`mycontext lesson` records the lesson (rationale tier — indexed, never injected) and prints
a rule-derivation request: convert this description of what happened into directives about
what must happen. The candidates come back through
`mycontext lesson-stage <LESSON-id> --stdin`, where they wait. Nothing is applied until
`mycontext lesson-accept` names one, and `mycontext lesson-discard` rejects one for good.
Note that `lesson-accept` creates an **active** rule directly — it is on the list in
[section 7](#7-the-trust-boundary) for that reason.

### Detail levels, and `--json`

Every reporting command — `status`, `list`, `decay`, `review list`, `doctor`,
`ingest-status` — takes `--full`, `--short` (the default) and `--summary`, and `--json`.
Text output is column-aligned with headers; `--json` is the only faithful rendering of the
hierarchical reports (an ingest session's per-anchor progress, a draft's body), and it
carries any corpus load errors inside the document so it stays parseable. An option none of
them recognises is refused, not silently ignored — all six, checked against the command
registry by `test/cli/unknown-flag-refusal.test.ts` rather than command by command.
`review promote` and `review discard` are checked against their own flag sets, so a
`--json` meant for the queue does not pass silently on a subcommand that writes.

`--summary` is the one to reach for when you want the shape rather than the rows. The same
report as above, at one level down:

<!-- example: status --summary -->
```text
my_context: 10 item(s), profile "standard"

review queue: 1 draft(s) pending review — walk it with `mycontext review`.

usage: no sessions recorded yet — decay reporting starts once items begin to be injected.
  1 active normative item(s) carry no scope and are never auto-injected.

health: 0 error(s), 0 warning(s), 0 note(s) — details from `mycontext doctor`.
```
<!-- /example -->

Tables are drawn with box characters where the terminal supports them and plain ASCII where
it does not; detection fails toward ASCII, so an unrecognised Windows terminal gets the safe
rendering. Set `MYCONTEXT_ASCII=1` to force it, or `MYCONTEXT_UNICODE=1` to force the other
way.

`mycontext query` is **not** one of them. It takes `--json` and `--limit <n>` only, and
refuses anything else: a SQL result set has no detail levels, because its columns are the
ones your own `SELECT` names. Its `--json` is a document — `{ rows, rowCount, truncated,
limit, loadErrors }` — not a bare array: results are capped at 1000 rows by default, and
`truncated` is how a machine learns the answer was cut. Put a `--` before SQL that begins
with a `--` comment.

### What the model calls: the MCP tools

Eleven tools, served over stdio by `src/mcp/server.ts`. The model reaches them without a
shell, and every item write it makes through them is stamped as an agent write — which is
what makes the draft rule in [section 7](#7-the-trust-boundary) enforceable at all on this
surface.

| Tool | What the model uses it for |
|---|---|
| `create_item` | capture a new typed item. Idempotent: calling it twice reports the existing item rather than duplicating it |
| `update_item` | revise an existing item's title, body, scope, tags, severity, `always`, extra fields or status, by id |
| `supersede_item` | retire an item in favour of a replacement, recording both relation directions. It **refuses** to retire a governing normative item — that decision is a human's |
| `link_items` | record a typed relation between two items, such as `derived_from` or `constrains` |
| `get_item` | fetch one item in full, as Markdown, when the id is already known |
| `query_items` | search and filter by type, status, tag, relation, text or file path. This is what `/mycontext:search` calls |
| `list_drafts` | list what is waiting for human review, newest first — not to promote it, which it cannot do |
| `load_context` | inject the pinned items and index now, exactly as a session start does. This is what `/mycontext:LoadMyContext` calls |
| `mycontext_help` | read guidance on one topic: categories, scope, capture, workflow |
| `mycontext_examples` | show a complete example item of a given type, to copy the shape from |
| `ingest_document` | extract normative items from a document, in the same two-call shape as the CLI's ingest commands |

The tool list is sorted and byte-stable across calls, which is what lets Claude Code cache
the prompt that carries it.

## 6. Configuration

Configuration lives in one file, `.my_context/config.json`, created by `mycontext init`:

```json
{
  "profile": "standard",
  "categories": {},
  "budgets": {}
}
```

Everything below is optional. The examples that follow were each run against the example
Bookstore API corpus, and the output quoted is what actually changed.

### `profile` — which categories exist at all

Three profiles: `minimal` (8 categories), `standard` (17, the default) and `full` (all 20).
A profile decides which categories are **enabled**; an unknown profile name is an error at
load time, not a silent fallback.

Switching the example project to `"profile": "minimal"` disables `decision`, `requirement`
and `standard`, among others. Their items do not vanish — they stop being listed
individually in the index and are counted as disabled instead:

```text
1 lesson · 1 drafts pending review · 1 retired · 2 decision (disabled/unknown category) · 1 requirement (disabled/unknown category) · 1 standard (disabled/unknown category)
```

That is the whole point of the label. Turning a category off never makes its items
disappear without a trace.

### `categories.<name>.enabled` — turning one category off

```json
{ "categories": { "standard": { "enabled": false } } }
```

With that set, `mycontext add standard "…"` is refused rather than accepted:

```text
my_context: category "standard" is disabled in this project, so no new standard items are accepted. Enable it in .my_context/config.json under categories.standard.enabled, or pick another type — see mycontext_help("categories").
```

The existing `STD-api-errors-use-problem-json` still appears in `mycontext list`, and the
session-start index counts it as `1 standard (disabled/unknown category)` rather than
listing it. `npm run gen:commands` also stops generating `/mycontext:add-standard` and
`/mycontext:list-standard`, and a test fails if the committed command files disagree.

### `categories.<name>.tier` — what governs, and what merely informs

A category's tier decides whether its items can be injected. Moving `standard` from
`normative` to `rationale`:

```json
{ "categories": { "standard": { "tier": "rationale" } } }
```

changes the session-start index from listing the item by name to counting it. Before:

```text
- STD-api-errors-use-problem-json · standard · API errors use Problem JSON
```

After, the same item appears only inside the rationale counts:

```text
2 decision · 1 lesson · 1 standard · 1 drafts pending review · 1 retired
```

This is the most consequential option in the file. Moving a category to `rationale` means
its items stop steering the model; moving one to `normative` means they start.

### `budgets` — how much context each tier may spend

```json
{ "budgets": { "pinned": 1500, "jit": 500, "restored": 2000, "index": 150 } }
```

Those are the defaults, in estimated tokens (characters divided by four — there is no
tokenizer here, so it is an approximation in both directions). Lowering one does not drop
anything silently. With `"index": 30`, the example project's four index lines become one
plus a count:

```text
- INV-prices-are-integer-cents · invariant · Prices are integer cents
- … +3 more (fetch with mycontext show <id>)
```

and with `"jit": 40`, a file-triggered injection carries no full text at all, only the
disclosure of what did not fit:

```text
_2 item(s) omitted from full text for budget: INV-prices-are-integer-cents, RULE-never-log-customer-email. Fetch with mycontext show <id>._
```

A value that is not a finite number greater than or equal to zero is ignored and the
default kept.

### `watchedDocs` — where a nudge to capture comes from

After you edit a file matching one of these globs, my_context adds one line to the
session suggesting you capture what the edit decided. The defaults are
`docs/superpowers/specs/**`, `docs/superpowers/plans/**` and `docs/prd/**`. Editing
`docs/prd/checkout.md` under the defaults produces:

```text
You edited docs/prd/checkout.md. If it set a new requirement, decision or constraint, capture it now with create_item (source_file: the path above). Skip if nothing new was decided.
```

Set `"watchedDocs": ["docs/rfc/**"]` and the same edit produces nothing at all, because
**the list you give replaces the defaults**. It is not added to them. Writes inside
`.my_context/` never nudge, whatever the globs say.

### Scope globs — the per-item switch

`scope` is a property of an item rather than of the config file, and it is the setting that
decides most of what you see. It is a list of POSIX globs, repo-relative, matched against
the file Claude is about to read or edit.

A rule scoped to `src/billing/tax/**` does not fire when Claude opens
`src/billing/prices.js`:

```text
### INV-prices-are-integer-cents · invariant · Prices are integer cents
### RULE-never-log-customer-email · rule · Never log customer email
```

and does fire the moment it opens `src/billing/tax/vat.js`:

```text
### INV-prices-are-integer-cents · invariant · Prices are integer cents
### RULE-never-log-customer-email · rule · Never log customer email
### RULE-vat-rates-come-from-the-tax-table · rule · VAT rates come from the tax table
```

(Headings only, above; each of those arrives with its full body.) Narrowing a scope is how
you stop an item spending context on work it has nothing to do with. Widening it to `**` is
how you undo the whole design, which is why the ingest path rejects `**`, `*` and `**/*`
outright.

`--scope` on `mycontext add` is comma-separated. An item with no scope at all is indexed and
retrievable but never auto-injected.

### `always` — pinning an item to every session

An item with `always: true` is injected in full at the start of every session, regardless of
scope. Other **normative** items appear as a one-line index entry; rationale items
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

### Configuration replaces; it does not merge

Two rules, and the first surprises people:

- **`watchedDocs` replaces the defaults.** Give it one glob and you have one glob. If you
  want the defaults plus your own, write all of them out. There is no "extend".
- **`categories` and `budgets` merge per key.** `{"budgets": {"index": 30}}` leaves
  `pinned`, `jit` and `restored` at their defaults, and
  `{"categories": {"standard": {"enabled": false}}}` changes nothing about any other
  category. Within one category, only the keys you name are overridden.

A category name that is not built in must declare both `tier` and `description`, or the
config is rejected. That is deliberate: a typo in a category name would otherwise create a
new, empty category that quietly accepted nothing.

## 7. The trust boundary

### Draft and active, and why review exists

The mechanism is a status field. `draft` and `active` are both ordinary items on disk, and
the difference between them is that a draft is not selected for any injection tier.
Promotion is what makes an item `active`, and active is what makes it govern.

```mermaid
stateDiagram-v2
  direction LR
  [*] --> draft: Claude captures a normative item<br/>(create_item, origin stamped agent)
  [*] --> active: you capture it yourself<br/>(mycontext add, with an explicit yes)
  draft --> active: mycontext review promote<br/>a human decision
  draft --> deprecated: mycontext review discard
  active --> superseded: mycontext supersede, naming a replacement<br/>a human decision
  note right of draft
    Not selected for any tier.
    Counted in the index, injected nowhere.
  end note
  note right of active
    Injected: pinned, just in time, or restored.
  end note
```


The reason is the reach described in [section 2](#2-the-idea). Normative text is injected in
full, unprompted, phrased as an instruction. Something with that reach, written by something
that can be confidently wrong, is worth one human glance before it becomes standing
instruction for every future session. Being wrong about *why* costs a misleading
explanation; being wrong about *what must hold* costs wrong code, written confidently.

Rationale is not gated, and should not be. A `decision` or a `lesson` captured by the model
lands `active` immediately, because rationale is never auto-injected — it can be retrieved,
but it cannot steer anything on its own.

### What the tools allow, and what a shell adds

An agent holding only the MCP tools can: create items (normative ones as drafts), revise an
item's title, body, tags and extra fields, link items, read anything, list the review queue,
and load context. It cannot promote a draft, and `supersede_item` refuses outright to retire
a normative item that currently governs. `update_item` refuses `scope`, `always` and
`severity` on a governing normative item. No tool takes an `origin` argument:
`create_item`, `update_item` and `supersede_item` each stamp `agent` themselves, so an
agent cannot claim to have been a human. (`link_items` carries no origin at all, because a
relation touches nothing the boundary is about — not status, severity, scope, `always` or
the body.)

An agent that also holds `Bash` has all of that plus the CLI, and the CLI is the human
surface. That is where the boundary actually is, and the rest of this section is about how
much it holds.

### The approval boundary — read this before trusting it

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

### Never hand-edit an item file

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

## 8. Not yet available

**This is the only section of this document where unbuilt behaviour appears.** Everything
above describes what the code does today. Every capability described below is one this
project does not have — either never built, or declared somewhere and verifiably not in
effect — and no sentence below claims otherwise. Where a present-tense sentence appears, it
states what is missing or broken today, never what is planned.

That separation is deliberate rather than tidy. A tool whose entire premise is that
injected knowledge is true cannot afford a README describing a feature it does not have,
and this project has a recorded history of exactly that defect, which is why the rule is a
rule rather than an intention.

These are planned, not promised. Each entry names what it will do, why it matters, and the
**wave** that would deliver it. The waves come from this project's production-readiness
sequencing: Wave 1 the trust boundary and the machine-readable contracts (complete),
Wave 2 reconciling shipped text with shipped behaviour, Wave 3 pinning each security
mechanism under a test that reddens when the mechanism is removed, Wave 4 the mechanics the
spec promised, Wave 5 structural consolidation, Wave 6 the recorded requirements that are
still absent. Items marked *unscheduled* are recorded and not yet placed in a wave.

### Editing an item — the missing corner (Wave 4)

**What is missing.** There is no update route for a human at all. `mycontext help` lists 21
commands and none of them edits an item: there is no `edit` command, no `update` command,
and no slash command that revises one. The model's `update_item` tool covers title, body,
tags and extra fields, but refuses `scope`, `always`, `severity` and `status` on an item that
currently governs — correctly, because every MCP write is stamped with a non-human origin.
So the only route to those four fields today is the one
[section 7](#7-the-trust-boundary) describes and warns about: hand-edit the Markdown, then
`mycontext repair --yes`.

**What will exist.** A gated `edit` command, taking an id plus `--scope`, `--always`,
`--severity` and `--status`, with human origin and the preview-then-confirm shape
`mycontext supersede` already uses. It will close the pinning gap named in
[section 4](#4-when-it-comes-back-and-what) and [section 6](#6-configuration) — that
`review promote --always` is currently the only route to `always: true`, and it only works
while an item is still a draft.

**What will not be added: deletion.** `NOGOAL-no-agent-hard-delete` is an active item in
this repository's own corpus, recording that as a deliberate non-goal. Retirement is
supersession — `mycontext supersede <id> --by <id>`, which exists — and it keeps the item,
its body and its history on disk where a reviewer can still read them.

### One surface for every operation (Wave 5)

**The requirement, in the user's words:** anything the model can do through a tool, you
should be able to do through a command. Today the two surfaces are not parallel, and the
asymmetry runs in both directions.

- `/mycontext:search` calls the `query_items` tool and has **no CLI counterpart**. There is
  no `search` command in the CLI at all.
- 17 of the 21 CLI commands have **no slash command**: `init`, `show`, `rebuild`, `help`,
  `examples`, `doctor`, `decay`, `query`, `repair`, `supersede`, the three `ingest*`
  commands and the four `lesson*` commands. Only `add`, `list`, `review` and `status` have
  one.
- 8 of the 11 MCP tools have **no slash command**: `update_item`, `supersede_item`,
  `link_items`, `get_item`, `list_drafts`, `mycontext_help`, `mycontext_examples` and
  `ingest_document`.

**Why it matters.** The gap is not cosmetic. A user inside a Claude Code session who wants
to retire a governing item, read one item, or check the corpus's health has to leave for a
terminal, and the two surfaces drifting apart is how one of them quietly becomes the real
one.

**What will exist.** A generated command per operation, from the same registry that already
generates the 34 `add-`/`list-` commands and the CLI's usage table. It sits in Wave 5
because that wave consolidates the CLI's dual dispatch into one registry, which is what
gives the generator a single list to work from; generating commands against two
hand-maintained lists would reproduce the drift the generation exists to prevent.

### Choosing a value instead of remembering it (Wave 5, and one defect in Wave 2)

**The requirement:** wherever a field has a fixed set of values — category, status,
severity, detail level, relation type — you should pick from the set rather than recall the
spelling.

**Part of this already exists, by naming rather than by widget.** The 17
`/mycontext:add-<type>` and 17 `/mycontext:list-<type>` commands *are* the category
selector: the closed set is spelled out in the command names, and Claude Code's own
command completion narrows them as you type. That is why they are generated per category
rather than taking a `<type>` argument.

**Be accurate about the rest.** A slash command's `argument-hint` frontmatter field supplies
placeholder text on the argument line — it is a hint, not a menu, and a plugin has no way to
ship a picker for `--severity` or `--status`. What will change is the shape of the surface:
the same generation that gives every operation a command (above) can give each fixed-value
argument its own command, the way `add-<type>` does today.

**One defect that was here and is now fixed**, found by running `claude plugin validate .`
against this repository: 19 of the 38 command files carried an `argument-hint` that was not
valid YAML, so *all* of their frontmatter — including `disable-model-invocation: true` — was
dropped when Claude Code loaded them. The generator now quotes it, the files are
regenerated, and validation passes. [Section 5](#5-using-it) tells that story in full,
including why the test that guarded those files never saw it.

### Domain grouping, session focus, and a run-time audit log (Wave 6)

These three are different from everything else in this section, and the difference deserves
to be said plainly rather than softened.

**All three are recorded in this repository's own corpus as `severity: hard`, `status:
active` requirements, and none of them is implemented.** Because they are active, scoped and
normative, this plugin injects them into any session that touches the files they name — so
mycontext is currently injecting requirements it does not satisfy, as binding instructions.
That is the honest version, and it is the reason these are listed here rather than left out.

| Recorded requirement | What it will do | State today |
|---|---|---|
| `REQ-items-carry-a-domain` | every item will carry one declared domain above its category — a closed set in `config.json`, one indexed column, filters on the commands and the reports | there is no `--domain` option anywhere, no column, and a `domains` key in `config.json` is ignored without a word |
| `REQ-session-focus-controls-what-loads` | a session will be able to focus on domains, and injection will narrow to them, disclosing what it hid rather than hiding it silently | nothing implements it, deliberately: `OPENQ-how-do-filters-respect-dependencies` is active in the same corpus and says to design this before implementing it |
| `REQ-changes-are-timestamped-and-audited` | an append-only operation log, written at the mutation boundary, with timestamps that stay out of the checksum so the Markdown round trip remains byte-identical | there are no `created_at`/`updated_at` fields, and the session ledger lives inside `.index.db`, which is disposable by design — delete the index and the injection history goes with it |

Each of the three needs a product decision before it needs an implementer, which is why they
sit in the last wave rather than the first.

### Reports that fit on a screen (Wave 5)

`mycontext list --full` renders every column of every item on one row. On this repository's
own corpus the widest row measures **over 800 characters**, which no terminal wraps
usefully; [section 5](#5-using-it) features the narrower detail levels for that reason and
says so. `mycontext decay` emits a fixed caveat paragraph, unwrapped, at *every* detail
level — 284 characters, quoted in full in section 5 precisely because hiding it would
misrepresent what running the command is like.

Both will be fixed by deciding which columns earn their place at `--full` and by wrapping
the caveat to the terminal width. Neither is a rendering accident: the box-drawing table
does not truncate, on purpose, because a truncated 63-character id is worse than a wide
one.

### Smaller gaps, each already recorded

- **`mycontext add` cannot set `severity`.** Only `review promote` and the `create_item`
  tool can, so a human capturing a `hard` constraint from the terminal has no way to say it
  is hard at the moment of capture. A `--severity` flag will land alongside the `edit`
  command above. *(Wave 4)*
- **`create_item` accepts a `relations` argument and drops it.** The tool's schema declares
  no such property, so a relation passed at creation is silently discarded — no relation
  written, no message. `link_items` is the working route. It will either be accepted or
  refused, and either is better than the current silence. *(Wave 2)*

### A persistent plugin install (unscheduled)

`claude --plugin-dir /path/to/my-context` loads the plugin for one session and is verified
to work — [section 5](#5-using-it) shows how to confirm it. What does not exist is an
install that survives a restart: `/plugin marketplace add` requires a
`.claude-plugin/marketplace.json`, and this repository ships none. A marketplace manifest
naming this repository as a single plugin will make `/plugin install mycontext@…` work; it
is small, and it is the first thing a new user needs, so it will not stay unscheduled long.

### Linux, versioning, and a changelog (unscheduled)

- **Linux is covered by CI and not certified by a run this project has seen.**
  `.github/workflows/ci.yml` runs the test suite and the performance suite on
  `ubuntu-latest` as well as `windows-latest`. No result of a real Linux run has been
  verified here, and Windows is the first-target platform — the ASCII table fallback exists
  because legacy `cmd.exe` is a real user. Certification means running it and saying what
  happened, not asserting that the matrix implies it.
- **There is no versioning scheme and no changelog.** `package.json` and
  `.claude-plugin/plugin.json` both say `0.1.0`, there are no git tags, and there is no
  `CHANGELOG.md`, so there is no way to tell which build of this plugin you have beyond a
  commit hash. Both will exist before anything is published anywhere.

### How to tell whether something here has shipped

Do not trust this section to have been updated. Run `mycontext help` for the real command
list, `claude --plugin-dir . plugin details mycontext` for the real component inventory, and
`mycontext help categories` for the categories actually enabled. Two tests keep
[sections 1–7](#contents) honest: every CLI command, slash command and MCP tool must be
named here and nothing may be named that does not exist, and every worked example is
re-executed against a committed fixture and diffed against what the command prints. **No
test checks this section**, because no test can know what was intended. It is the part of
this document to distrust first.

---

Design: `docs/superpowers/specs/2026-08-12-my-context-design.md`
