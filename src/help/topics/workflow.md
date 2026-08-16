# Workflow

## Lifecycle

`draft` → reviewed by a human → `active` → later `superseded` or `deprecated`.

Only `active` items are injected. `draft`, `superseded`, `deprecated` and
`validated` remain indexed and searchable forever — supersession is how the
corpus stays small without losing history.

Nothing is ever deleted through these tools. There is no delete. An item that is
wrong is superseded or deprecated, both of which are reversible and both of
which leave a trail.

## Relations

Relations live in the Markdown file, so they survive a rebuild and merge like
text. The vocabulary is closed:

| Relation | Meaning |
|---|---|
| `derived_from` | This item came out of that one — a rule from a lesson, a constraint from an ADR |
| `constrains` | This item limits what that one may do |
| `supersedes` | This item replaces that one; written automatically by supersede_item |
| `superseded_by` | That item replaced this one; the mirror of `supersedes`, written automatically by supersede_item onto the item being retired. Not available to link_items — see below |
| `blocks` | That item cannot be settled until this one is — mainly for open_question |
| `mitigates` | This item reduces that risk |
| `refines` | This item makes that one more specific |
| `relates_to` | Weak association, when nothing more precise fits |
| `links_to` | A bare mention |

A relation may point at an item that does not exist yet. It resolves when that
item is created.

Neither retirement relation can be added with `link_items`. Both assert a
lifecycle change, and `link_items` never touches `status` — writing one by hand
would leave a file claiming a supersession that never happened. `supersede_item`
writes both directions itself, and it is the only thing that does.

An answered `open_question` is the common case: set it `superseded` and point it
at whatever answered it. That is one `supersede_item(id: <the question>, by:
<the answer>)` call — the question is the item being RETIRED, so it is the `id`.
A human does the same thing with `mycontext supersede <the question> --by <the
answer>`.

## A typical sequence

1. Something is established in conversation or in a document.
2. `create_item` with a type, a title, a body giving the reason, and a `scope`
   if it should activate on particular files.
3. If it came from a document, pass `source_file` and `source_anchor` so the
   capture is idempotent and traceable.
4. `link_items` to whatever it derives from or constrains.
5. Later, when it changes: `create_item` for the new version, then
   `supersede_item` pointing the old one at the new one. As an agent, this
   only succeeds when the old version is a draft, deprecated, already
   superseded, or rationale-tier — superseding an `active` or `validated`
   normative item is refused; a human retires it instead, with
   `mycontext supersede <old id> --by <new id>`. Print that command for them;
   never run it yourself.

## Reviewing

`list_drafts` shows what is waiting. Promotion is a human action — and it is a
human action **by convention and by permission settings, not by enforcement**:
`mycontext review promote`, `mycontext review discard`, `mycontext lesson-accept`,
`mycontext edit` and `mycontext add <normative category>` are ordinary CLI
commands, and anything that can run a shell can run them — `add` creates an
`active` governing item outright, with no draft step, and `edit` changes any
field of one that already governs. `--yes` is an audit trail, not a lock. Nor is the
CLI the only route: the `PreToolUse` write-deny on `.my_context/` matches the
file tools, not `Bash`, so a shell redirect plus `mycontext rebuild` goes around
it. Alternate spellings of the directory itself are closed: the deny matches
`.my_context`/`.my-context` case-insensitively and then canonicalizes the path,
so a Windows 8.3 short name (`MY_CON~1`), a symlink or junction pointing into
the directory, a `subst` drive and a `\\?\` prefix are all denied by what they
resolve to. A hard link to an existing item file is not — a hard link has no
target to resolve — but creating one needs the same shell the redirect above
does. The gate holds if and only if the agent's Bash surface excludes the
`mycontext` binary entirely, in every spelling, **and** direct writes into
`.my_context/`; a plugin cannot ship permission rules, so that is the user's
`.claude/settings.json` to write (see the README). As an agent: print the
command, never run it for them.

A human runs `mycontext review promote <id>` (or `mycontext review discard <id>` to
reject it) — `mycontext review` also has `list`/`show` subcommands to walk
the queue. An agent cannot promote its own draft or change a normative item's
status through `update_item`. `supersede_item` is narrower still: an agent may
supersede its own normative draft (that sets its status to `superseded`), but
not a normative item that is currently `active` or `validated` — retiring
something that is still governing is a human decision, made with
`mycontext supersede <id> --by <id>`. That command is an ordinary CLI command
too: like `promote`, `discard`, `add`, `edit` and `repair`, it is a human
decision by convention and by permission settings, not by enforcement.

A human changes a field of an item that is already governing with
`mycontext edit <id>` — the command `update_item`'s refusals defer to. It gates
what it can: no confirmation on a rationale item, or on a draft edit that leaves
it a draft; a preview and a confirmation whenever the item governs before OR
after the edit, so `--status active` on a draft is confirmed too; and a preview naming what governs before
and after when the change is to `scope`, `always`, `severity` or `status`. As an
agent: print it, never run it for them.

`mycontext pin <id>`, `unpin`, `harden` and `soften` are that same command with
one flag already filled in — `--always=true`, `--always=false`,
`--severity=hard`, `--severity=soft` — so they carry the same gate, the same
preview and the same refusals. Everything above about `edit` is about them too,
including "print it, never run it for them".

## The revision queue

`update_item` is not the whole story for an agent either. Each category carries
an `agentEdits` setting, and it is `review` by default for every normative
category: a non-human caller's change to an item's **title, body, tags or extra** is
then **staged as a pending revision** rather than applied. The item is untouched
on disk and keeps governing the text it already had. The response says so in its
first words — read it, and do not go on reasoning as if the proposed text were
in force. Under `allow`, which is the default for every rationale category, the
same edit applies immediately.

A staged revision is never injected, never appears in `list`, and moves no count
of what governs. It is settled only by a human, with a second set of verbs:

- `mycontext review revisions [<id>]` — the pending ones, each as a full diff
  against the text its item governs now.
- `mycontext review promote-revision <id>` — apply the proposal.
- `mycontext review discard-revision <id>` — reject it. The proposal itself is
  not deleted; it stays in the append-only log and `review revisions <id>
  --full` reads it back.

When an item carries **more than one** pending revision, both settlement verbs
require `--revision REV-...` and refuse the bare form — an item id alone does
not say which proposal the human reviewed, and settling one they were not shown
is the wrong write both verbs exist to prevent.

`promote` and `promote-revision` are different verbs on purpose: a normative
draft can sit in both queues at once, and `promote` makes the draft govern the
text it already has while `promote-revision` rewrites that text.

If a human edits the item underneath a pending revision, that revision goes
stale in the fields it rewrites and promoting it is refused; `--force`
overrides, and what it destroys is the human's newer text. All of these are
ordinary CLI commands on the same terms as everything above — `promote-revision`
in particular applies a rewrite **you** proposed, which makes it the one on this
page you have the clearest reason not to run. Print it; never run it for them.
