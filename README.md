# my_context

Captures the normative knowledge of a project — constraints, invariants, rules,
requirements — as Markdown in `.my_context/`, indexes it in a disposable SQLite
database, and injects the relevant parts back into Claude Code sessions.

Requires Node 24 or newer. No runtime dependencies.

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
