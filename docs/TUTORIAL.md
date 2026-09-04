# my_context — the first twenty minutes

Every command and every block of output below was run against a fresh workspace
while writing this page. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24.14.0, Windows 11, Claude Code 2.1.233.

When you finish this page you will have a corpus of three items, you will have
watched one of them reach Claude automatically, and you will know why the other
two did not. That last part is the whole idea.

---

## What problem this solves

You tell Claude "card numbers never go in the logs." Two hours later, in a new
session, Claude writes `logger.info(card.number)`.

The usual fixes don't hold. `CLAUDE.md` gets long, and everything in it is
loaded every session whether or not it is relevant. Re-explaining works until
the context window turns over. Neither one can answer "what governs this file?"

my_context stores that sentence as a **file in your repository**, attaches it to
the paths it is about, and hands it to Claude the moment Claude touches one of
them.

Two ideas carry the whole tool:

**Knowledge has tiers.** A constraint is *normative* — it tells Claude what must
hold. A decision is *rationale* — it records why you chose something. Normative
items are injected. Rationale items are not; they are searchable history.

**Authorship decides trust.** You write a constraint, it governs immediately.
*Claude* writes a constraint, it lands as a **draft** and governs nothing until
you promote it.

---

## Install

```bash
claude plugin marketplace add Dudi-Bar-On/my-context
claude plugin install mycontext@mycontext
```

Confirm it loaded:

```bash
claude plugin details mycontext@mycontext
```

You want its own `Hooks (18)` line and a `MCP servers (1)` line — the eighteen names are
listed and explained in [README §5's hook table](../README.md#5-using-it). Slash commands
and the one skill are still folded into one `Skills (N)` line, so read N loosely: it moves
the moment a command is added, and the command above is how you get today's real number
rather than trusting this page for it.

That installs the plugin — the slash commands, the hooks, the MCP server. It does not put
`mycontext` on your PATH: that command is a separate npm package, in the same repository.
From a clone of it:

```bash
npm install
npm link          # provides the `mycontext` command
```

Without `npm link`, every `mycontext …` command on this page also works as
`node /path/to/my-context/src/cli/index.ts …`.

---

## 1. Initialise

From the root of a real project:

```console
$ mycontext init
my_context: initialized /your/project/.my_context
```

It creates two files and nothing else:

```
.my_context/.gitignore      ← excludes the derived SQLite index only
.my_context/config.json     ← your profile and any overrides
```

**Commit `.my_context/`.** That is the point — the knowledge travels with the
repository. Only the index is ignored, because it is rebuilt from the Markdown
on demand.

---

## 2. Capture your first constraint

```bash
mycontext add constraint "Card numbers never reach the logs" \
  --scope "src/billing/**" \
  --severity hard \
  --summary "A rule against ever writing a full card number to a log file." \
  --body "Log the last four digits and the processor's reference. A full PAN in a log file is a reportable incident, and the logs are replicated to three places we do not control."
```

Notice there is no `--yes`. Run it that way first and it refuses:

```console
about to create constraint "Card numbers never reach the logs" — active, and governing this project at once.
my_context: refusing without confirmation — stdin is not interactive. Rerun with --yes to confirm, or run this from an interactive terminal.
```

That sentence is doing real work. It tells you the item will be **active**, and
that active means *governing this project at once*. Add `--yes`:

```console
my_context: created CONST-card-numbers-never-reach-the-logs (active) at items/constraint/CONST-card-numbers-never-reach-the-logs.md.
```

### What it wrote

```markdown
---
id: CONST-card-numbers-never-reach-the-logs
type: constraint
title: Card numbers never reach the logs
status: active
severity: hard
always: false
summary: A rule against ever writing a full card number to a log file.
summary_of: 4d3a38155b7d055c
scope:
  - src/billing/**
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: bf403b3d2370f9bc
---

# Card numbers never reach the logs

Log the last four digits and the processor's reference. A full PAN in a log file
is a reportable incident, and the logs are replicated to three places we do not
control.
```

Plain Markdown. It diffs, it reviews, it survives the tool being uninstalled.

Three fields to notice now:

- **`summary`** — one plain sentence for a reader who does not know this codebase. `add`
  refuses to create an item without one (or an explicit `--summary-omitted`).
- **`scope`** — the globs this item attaches to. Empty means every file.
- **`origin: human`** — you wrote it. No tool lets a caller set this field, which
  is what the trust boundary is built on.

---

## 3. Add two more, to see the difference

```bash
mycontext add rule "Every price is an integer of minor units" --summary "Prices are stored and compared as whole minor units (cents), never fractional dollars." --yes
mycontext add lesson "The sandbox declines 3DS cards at random" --summary "The payment sandbox randomly declines 3D Secure test cards, so a decline there does not mean the integration is broken." --yes
```

```console
$ mycontext list
┌─────────────────────────────────────────────────┬────────────┬────────┐
│ id                                              │ type       │ status │
├─────────────────────────────────────────────────┼────────────┼────────┤
│ CONST-card-numbers-never-reach-the-logs         │ constraint │ active │
│ LESSON-the-sandbox-declines-3ds-cards-at-random │ lesson     │ active │
│ RULE-every-price-is-an-integer-of-minor-units   │ rule       │ active │
└─────────────────────────────────────────────────┴────────────┴────────┘
```

Three items, all `active`. Watch what happens to each.

---

## 4. The payoff

Ask Claude to read `src/billing/charge.ts`. Before the read runs, this arrives
in Claude's context:

```markdown
## my_context — these govern this project

### CONST-card-numbers-never-reach-the-logs · constraint · Card numbers never reach the logs

Log the last four digits and the processor's reference. A full PAN in a log file is a
reportable incident, and the logs are replicated to three places we do not control.

_scope: src/billing/**_

### RULE-every-price-is-an-integer-of-minor-units · rule · Every price is an integer of minor units
```

**Read that carefully — three separate things just happened.**

1. The constraint arrived because the file matched `src/billing/**`.
2. The rule arrived too, because it has **no scope**, and no scope means it
   applies everywhere.
3. The lesson **did not arrive**. It is rationale. It is never injected — it is
   there for you to search, and for Claude to look up deliberately.

Now ask Claude to read `README.md` in the same session:

```
(nothing)
```

Nothing, for two reasons worth telling apart. The constraint doesn't match that
path. The rule *does* match — but it was already delivered, and my_context does
not repeat itself within a session. It tracks what each session has seen.

---

## 5. What a new session opens with

Every session start, my_context sends a short index rather than the corpus:

```markdown
## my_context index
- CONST-card-numbers-never-reach-the-logs · constraint · Card numbers never reach the logs
- RULE-every-price-is-an-integer-of-minor-units · rule · Every price is an integer of minor units

1 lesson
→ use mycontext list or mycontext show <id> to browse these
```

Ids and titles for the normative items — enough for Claude to know they exist
and fetch one — and rationale reduced to a bare count.

**If you want an item in full at every session start**, pin it:

```bash
mycontext pin CONST-card-numbers-never-reach-the-logs --yes
```

Use this sparingly. A pinned item costs tokens in every session forever. Scope
is the cheaper tool: it delivers the item exactly when it is relevant.

---

## 6. The trust boundary

This is the part to understand before you let Claude capture anything.

Ask Claude to record a constraint. It uses the `create_item` MCP tool, and the
item lands as a **draft**:

```
created CONST-refunds-are-never-issued-automatically (draft — pending your review)
```

Drafts are injected into nothing. Review the queue:

```bash
mycontext review              # walk the pending drafts
mycontext review promote <id> # accept one
mycontext review discard <id> # reject one
```

Ask Claude to record a *decision* and it lands **active** immediately. That is
not a bug. The discriminator is the **category's tier**, not who typed it:

- **Normative** categories (16 of them: `constraint`, `rule`, `requirement`,
  `invariant`, `standard`, `pattern`, `glossary`, `instruction`, `non_goal`,
  `open_question`, `runbook`, `procedure`, `environment`, `known_issue`,
  `exception`, `contract`) — an agent capture becomes a draft, because these
  steer future work.
- **Rationale** categories (13: `adr`, `decision`, `lesson`, `tradeoff`,
  `assumption`, `edge_case`, `risk`, `measurement`, `reference`, `plan`,
  `task`, `todo`, `note`) — an agent
  capture lands active, because rationale is never injected and so cannot steer
  anything.

`known_issue` is on the normative side even though it reads like a fact. Its
whole job is "this is broken, don't spend effort on it", and it cannot do that
job from a tier Claude never reads.

`todo` and `note` are on the rationale side for the mirror-image reason: they
are the inbox, and neither asserts anything. A list of things nobody has built
yet, injected in full at the start of every session, is noise Claude cannot act
on. `procedure` is normative because it is `runbook`'s one-shot sibling — the
steps for an operation you perform once and then retire, where a runbook is the
steps for one you perform every time it comes up.

### The same boundary, from the other side

Claude cannot edit item files directly. Try it and the write is denied:

```json
{"permissionDecision":"deny","permissionDecisionReason":"my_context: `.my_context/items/` is managed by my_context. Writing the file directly leaves the SQLite index and the item checksum stale, and bypasses the review boundary that keeps agent-authored normative items out of injection. Create items with the `create_item` MCP tool, and read them with `get_item` or `query_items`."}
```

**One limit worth knowing now:** this covers Claude's file tools, not `Bash`. An
agent with shell access can write into `.my_context/` and that write is neither
denied nor audited. `mycontext doctor` will catch a tampered item afterwards by
checksum. Treat the boundary as a strong default, not a sandbox.

---

## 7. Checking on it

```console
$ mycontext status
my_context 1.0.2: 3 item(s), profile "standard"
...
review queue: 0 draft(s) pending review — walk it with `mycontext review`.

usage: 1 session(s) recorded. 0 normative item(s) not injected in the last 20 session(s)
  1 active normative item(s) carry no scope, so they apply to every file and compete for the
  jit budget on every file operation.

health: 0 error(s), 1 warning(s), 0 note(s) — details from `mycontext doctor`.
```

That warning is the unscoped rule from step 3, and it is the single most useful
habit this tool teaches: **scope your items**. An unscoped normative item is
weighed on every file operation forever.

Run `mycontext doctor` whenever something feels stale. It verifies every item's
checksum against its file and reports drift without silently fixing it.

---

## The five commands you will actually use

| Command | For |
|---|---|
| `mycontext add <category> "<title>" --scope "..." --yes` | capture something |
| `mycontext list` | what is in here |
| `mycontext search --text "words"` | find one |
| `mycontext review` | approve what Claude proposed |
| `mycontext doctor` | is anything stale or broken |

`mycontext help` lists the rest. Every slash command has a `/mycontext:` prefix
and previews before it writes.

---

## Three habits that decide whether this works

1. **Scope everything you can.** The default is unrestricted, and unrestricted
   items compete for budget on every file touch.
2. **Capture the constraint, not the task.** "Card numbers never reach the logs"
   is a rule that holds in a year. "Fix the logging in charge.ts" is a to-do.
3. **Walk the review queue.** Drafts that pile up unread are the failure mode
   this design invites: Claude keeps proposing, nothing governs, and you get the
   cost of the tool with none of its benefit.

---

## Where to go next

`TUTORIAL-ADVANCED.md` covers the four injection tiers and how the budget is
spent, scope policies, session focus, pulling items out of an existing design
document, turning an incident into a rule, revisions and the review queue, the
audit log, and per-category configuration.
