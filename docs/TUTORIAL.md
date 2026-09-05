# my_context — the tutorials, basic tier

**This page moved.** It used to be one long "first twenty minutes" chapter. The
tutorials are now **one file per feature**, listed in
`docs/tutorials/manifest.json` and served by the product itself — open the web
UI (`mycontext ui`) and read them on the **Tutorials** screen, or read the
Markdown directly in `docs/tutorials/`.

This page stays so that an existing link or search lands somewhere useful. It is
an index, not a dead end.

Every tutorial has the same four sections: what it is for, how it works, how to
use it **from the CLI**, and how to use it **from the UI** — with each surface
saying what it can and cannot do, because they are not the same.

---

## Start here — the basic tier

Six features a new user reaches in the first session, in the order they come up:

1. [Capture what you just decided, before you forget it](./tutorials/capturing-an-item-and-the-categories.md)
   — items, the 29 categories, and the trust boundary that decides what governs.
2. [Load this project's context at the start of a session](./tutorials/loading-context-into-a-session.md)
   — the payoff: what a session opens with, and what arrives when you touch a file.
3. [Find the item you're thinking of, from the CLI or the UI](./tutorials/reading-and-searching-the-corpus.md)
   — list, show, search by path, and read-only SQL.
4. [Check whether your corpus is healthy, and what's ready to work on](./tutorials/checking-on-the-corpus.md)
   — `status`, `doctor`, `ready`, and acknowledging a finding.
5. [Triage quick captures out of the inbox](./tutorials/the-inbox.md)
   — `todo`, `note`, and promoting one into the category it really was.
6. [Open and use the web UI](./tutorials/the-web-ui-itself.md)
   — twenty screens, four rail groups, and what "composed, never run" means.

Then [the advanced tier](./TUTORIAL-ADVANCED.md).

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

You want its own `Hooks (18)` line and a `MCP servers (1)` line — the eighteen
names are listed and explained in [README §5's hook table](./../README.md#5-using-it).
Slash commands and the one skill are still folded into one `Skills (N)` line, so
read N loosely: it moves the moment a command is added, and the command above is
how you get today's real number rather than trusting this page for it.

That installs the plugin — the slash commands, the hooks, the MCP server. It
does not put `mycontext` on your PATH: that command is a separate npm package,
in the same repository. From a clone of it:

```bash
npm install
npm link          # provides the `mycontext` command
```

Without `npm link`, every `mycontext …` command in these tutorials also works as
`node /path/to/my-context/src/cli/index.ts …`.

Then, from the root of a real project:

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

## The two ideas the whole tool rests on

**Knowledge has tiers.** A constraint is *normative* — it tells Claude what must
hold. A decision is *rationale* — it records why you chose something. Normative
items are injected. Rationale items are not; they are searchable history.

- **Normative** categories (16 of them: `constraint`, `invariant`, `rule`,
  `requirement`, `standard`, `pattern`, `glossary`, `instruction`, `non_goal`,
  `open_question`, `runbook`, `procedure`, `environment`, `known_issue`,
  `exception`, `contract`) — an agent capture becomes a draft, because these
  steer future work.
- **Rationale** categories (13 of them: `adr`, `decision`, `lesson`, `tradeoff`,
  `assumption`, `edge_case`, `risk`, `measurement`, `reference`, `plan`, `task`,
  `todo`, `note`) — an agent capture lands active, because rationale is never
  injected and so cannot steer anything.

**Authorship decides trust, through the tier.** You write a constraint, it
governs immediately. *Claude* writes a constraint, it lands as a **draft** and
governs nothing until you promote it. That boundary is
[Review a pending change before it governs](./tutorials/revisions-and-the-review-queue.md).

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
   items compete for budget on every file touch. See
   [Scope and coverage](./tutorials/scope-and-coverage.md).
2. **Capture the constraint, not the task.** "Card numbers never reach the logs"
   is a rule that holds in a year. "Fix the logging in charge.ts" is a to-do.
3. **Walk the review queue.** Drafts that pile up unread are the failure mode
   this design invites: Claude keeps proposing, nothing governs, and you get the
   cost of the tool with none of its benefit.
