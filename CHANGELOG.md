# Changelog

All notable changes to this project are recorded here.

The format is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/) as [`VERSIONING.md`](VERSIONING.md)
applies it — read that first if you are deciding what a change is worth.

**`0.9.0` is the first tagged version, and nothing has been published to a registry.** The
tag is the release. `0.9.0` covers one body of work rather than a history of versions a user
could have been running, so it is recorded as one section; no earlier release sections have
been invented to make it look otherwise.

That has a consequence worth stating, because it is the difference between an honest
changelog and a plausible one: **no `Fixed` or `Security` entry in the `0.9.0` section
describes a regression any user experienced.** Those are defects that existed in this
repository during development and were closed before the first tag. They are recorded
because they are the reason several of the designs above them are shaped the way they are —
not to imply an upgrade anybody needs.

**From `1.0.0` onward that no longer holds, and the distinction is the whole point of
saying it.** A `Fixed` entry under `1.0.0` or later describes a defect that was in a tagged
release, so it may be one you actually hit. `1.0.1` carries two of that kind: the MCP server
reported version `0.1.0` to every client through both tagged releases, and
`mycontext audit --role` accepted a filter it then ignored outside `--items`. Read those as
real, and the `0.9.0` ones as history.

`0.9.0` rather than `1.0.0` is a decision, and `VERSIONING.md` explains what `1.0.0` would
commit to. The three phases before this one closed the trust hole, made the documentation
true and settled the category vocabulary; this one made the two invocation surfaces
parallel. What was left before the surfaces are worth freezing was Linux certification,
session focus, the audit log and the remaining recorded requirements — Part E and D4 of
`docs/ROADMAP.md`. All of it has since landed and is recorded under `1.0.0` below: the
audit log, session focus, Linux certification, and the disposition census that emptied D4.

## [Unreleased]

## [1.0.1] - 2026-08-18

A documentation-accuracy release. Every entry below is `PATCH` under
[`VERSIONING.md`](VERSIONING.md): the program is made to do what it already said it did, and
the documentation is made to say what the program already does. No corpus, config key,
category, tier, command, flag or tool changed meaning.

Found by an exhaustive external test campaign against `1.0.0` — 419 recorded runs across
eight surfaces, a 22-check live pass inside Claude Code, and a line-by-line audit of all
4,625 README lines producing 716 checkable claims.

### Fixed

- **The MCP server reported the wrong version to every client.** `serverInfo.version` was
  the literal `'0.1.0'` at `initialize` and in every `_meta` block, through both the `0.9.0`
  and `1.0.0` releases. It now reads `package.json` through `core/version.ts`. The cause was
  a version transcribed into a `.ts` file — the fourth site this document says must not
  exist — so the fix removes the site rather than adding it to `scripts/set-version.ts`.
  `test/mcp/protocol.test.ts` pinned the same literal in two assertions, so the one test
  positioned to catch the drift was itself a copy of the number and asserted the drift was
  correct; both now read the manifest independently.

- **`mycontext audit --role` was accepted everywhere and read in one place.** It is used
  only by the `--items` rollup; every other form parsed it and dropped it, so
  `mycontext audit --role injected` returned the whole unfiltered log and said nothing about
  it. It also had no validation, unlike `--kind`, `--op` and `--origin`, so `--role subjekt`
  counted nothing and reported nothing.

  **What changes in practice** (the `VERSIONING.md` "honest edge" — a script that passed
  this flag now gets a refusal): `--role` outside `--items` now exits 1 naming what the flag
  means, and an unrecognised value now exits 1 with its closest match. Scripts relying on
  either form were receiving an unfiltered answer to a filtered question; they now fail
  loudly instead. `mycontext audit --items --role subject|injected|spilled` is unchanged.

- **A timing test measured the machine rather than the retry loop.** "the append retry
  budget is wired" asserts an upper bound on wall-clock backoff inside a runner that
  executes test files concurrently, with under 1.5× of headroom. Growing `README.md` and
  `docs/README.he.md` by ~5% each was enough to take it from ~262ms to 461ms against a 400ms
  ceiling and turn the suite red on a documentation-only change. It now samples three times
  and keeps the fastest; the band is unchanged and still catches every drift it caught
  before.

- **Thirty-three verified contradictions between the documentation and the shipped
  behaviour.** Each
re-derived from source, a live run, or arithmetic before being touched, and each corrected
  in both `README.md` and `docs/README.he.md`. Four of them were systematic.

  **Section 8 still described a pre-release project** — it denied git tags that exist and a
  Linux certification recorded in `docs/ROADMAP.md`. Both entries had shipped, and the
  section's own rule is that nothing stays in it once it ships. Removing them also repaired
  the section's opening guarantee that every entry below names something the project does
  not have. `VERSIONING.md` carried the same staleness and is corrected here too.

  **`known_issue` was described as rationale that "lands active".** It has been a
  **normative** category since the tier change that `src/core/categories.ts` explains: an
  agent-captured known issue lands as a **draft** and it **is** injected. Both halves of the
  published justification were inverted for that one category — the most consequential
  documentation defect found, because it described the trust boundary backwards. Its
  specimen block also sat inside the rationale run and has moved to its place in the
  normative order.

  **`tags` and `severity` were called inert with respect to injection, in six places.** Both
  gate injection once a session focus is set: a tag focus withholds an item that matches
  none of its tags, and a `severity: hard` item is exempt from focus hiding entirely. The
  document already stated this correctly elsewhere, and so does the `focus_context` tool
  description. The six sentences are now qualified rather than absolute.

  **"These twenty-five are all of them."** The three flag tables held exactly twenty-five
  rows, and twenty further flags ran at exit 0 and appeared in none of them — six of those
  documented in the same section. The reference is now complete (47 rows, including
  `--role`), six "where it works" cells that were narrower than the CLI are widened, and the
  totality claim is replaced by no number at all, since a count in that position goes stale
  the first time a flag is added.

  The remaining nineteen were individual: wrong counts and measurements, behaviour
  described backwards, guarantees stated without the condition that makes them true, and
  several places where the document contradicted itself — resolved toward whichever half
  was already correct.

## [1.0.0] - 2026-08-17

Two entries below are **breaking** for an existing install, both under **Changed**: a
`config.json` carrying unknown keys, unknown budget keys or invalid budget values is now
refused at load instead of silently ignored, and
`mycontext review promote-revision <id> --yes` now refuses when the item has more than one
pending revision and requires `--revision`.

### Added

- **Never-miss injection — the hooks no longer write to the SQLite index, and an
  injection survives a held write lock.** The write lock was the standing threat to the
  product's one promise: a hook opening the index writable under a held lock measured
  16.9 s against the 10 s `hooks.json` timeout, so the hook was killed and the injection
  vanished with no disclosure anywhere. Closed structurally rather than tuned:

  - **The just-in-time hook opens the index read-only** — no busy wait, no DDL, zero
    failures in 18,300 contended trials — **and a failed open serves the injection from
    the Markdown itself** (`src/core/markdown-fallback.ts`): the corpus is the
    atomically-published source of truth, so an absent, stale-schema or corrupt index
    degrades to a slower read of the truth, not a miss. The fallback is disclosed in the
    injected block and in the audit record, and an item file the fallback cannot parse
    is disclosed too, never dropped.
  - **Session dedupe moved out of SQLite** into a per-session seen file
    (`.my_context/state/<session>.seen.jsonl`, pruned after 30 idle days). An unreadable
    seen file means "inject without dedupe and disclose" — a re-injection, never a miss.
    The ledger table is now a projection of the audit log: `mycontext audit
    replay-ledger` rebuilds it, and `decay`/`status` top it up before reading.
  - **PreCompact performs zero SQLite writes.** The restore snapshot is built from the
    per-session seen file plus a best-effort, read-only known filter — skipped and
    disclosed when the index is unavailable or empty — so an id delivered from Markdown
    while the write lock is held survives into the snapshot, lock still held.
  - **The hooks that still open the index writable bound their wait** — 2 attempts ×
    500 ms instead of the default patience — so a contended `SessionStart` fails open in
    ~1.3 s measured and says so, as one line in the session and an audit record, instead
    of being killed at 10 s with nothing said.
  - **The guarantee is conditional on corpus size, and `mycontext doctor` says so in the
    same sentence**: from 5,000 items it warns that the Markdown fallback — measured at
    9,903 ms for 10,000 items on a cold file cache — can exceed the 10 s hook kill, at
    which point a fallback-served injection degrades to a disclosed miss.


- **Session focus** — `REQ-session-focus-controls-what-loads`, the second of this project's
  own `active`, `severity: hard` requirements that nothing implemented. A large corpus
  injects everything relevant to the file you touch; focus narrows that to what you are
  actually working on, so a session about billing is not carrying the auth rules.

  **It discloses and allows.** It hides exactly what it was asked to hide and reports the
  cost — *"N item(s) hidden by focus, M load-bearing relation(s) now dangling"* — in the
  injected block itself, not only in a command's output. It never refuses a hide because
  something still visible points at the item: a focus that refuses gets weaker the more
  connected the corpus is, and "why is this still here" becomes the question nobody can
  answer. A **dangling** relation is an edge with one end hidden and the other on screen —
  the hidden `open_question` that `blocks` a requirement still being shown. That number is
  what makes hiding safe to allow, and it settles
  `OPENQ-how-do-filters-respect-dependencies`, which is retired by supersede in the same
  change.

  `mycontext focus <tag>…` with `--tag`, `--category`, `--scope`, `--preview`, `--show`,
  `--clear` and `--relations`; `/mycontext:focus`; and the `focus_context` MCP tool, so a
  model can narrow its own context — with `severity: hard` items never hidden by any caller,
  the disclosure in the very text the model reads, and every focus change audited with its
  origin.

  A focus belongs to the **workspace**, not to one session, and lives in the gitignored
  `.my_context/state/focus.json` — so it never narrows a teammate's injection, and a
  forgotten one announces itself at the next session start. A hidden item is hidden, not
  gone: still listed, still shown, still searchable.

- **The run-time audit log** — `REQ-changes-are-timestamped-and-audited`, which was `active`
  and `severity: hard` in this project's own corpus and satisfied by nothing but git plus a
  frontmatter date, which is precisely what the requirement excludes.

  It records **mutations and hook actions, including injections — and for an injection the
  SCOPE, not the content**: which items, at which tier, and what the budget spilled, never
  the injected text. Small enough to keep indefinitely, complete enough to answer "what did
  this session actually see", and it puts no second copy of a governing item into a file no
  checksum covers.

  `.my_context/.audit/audit.jsonl` is the record — append-only, one JSON object per line,
  with the three read outcomes the revision log established (absent is empty, unreadable
  throws, a damaged line throws unless it is a torn tail). `.my_context/.audit/audit.db` is
  a **derived, disposable** SQLite projection over it, the same relationship the Markdown
  files have to `.index.db`: delete it and it rebuilds. That separation is what stops
  `mycontext rebuild` — which the product tells users to run freely, and which every `query`
  runs implicitly — from destroying audit history.

  Read it with `mycontext audit` (filters for time, item, session, kind, op and origin, plus
  `--summary`, `--items`, `--sessions`, `--files`, and `--json` on all of them),
  `/mycontext:audit`, or the `audit_log` MCP tool, which is how a model inspects its own
  effects.

- **`mycontext doctor` reports the audit log's size** past 32 MiB, naming the rotated
  segments as the user's to archive. The live log rotates at 8 MiB so no single file grows
  without bound; nothing is ever deleted, so the total is still unbounded — which is exactly
  what that check exists to disclose.

- **Linux certification.** CI ran on `ubuntu-latest` from the start; what was missing was
  a verified green run and an account of what actually executes there. Both exist now:
  the full suite and the performance suite pass on Linux, the symlink coverage runs as
  real symlinks (POSIX ignores the `'junction'` type argument), the POSIX
  case-sensitivity test executes for the first time, and every remaining Linux-side skip
  is deliberately platform-specific with its reason in the skip message. The performance
  ceilings on the GitHub *Windows* runner are relaxed ×10 — measurement showed runner
  noise larger than the budget being asserted — while the Linux job and development
  machines still certify the real product budgets. macOS remains unverified and is not in
  the CI matrix.

### Changed

- **Breaking: a `config.json` that `resolveConfig` cannot honour now fails loudly at load
  instead of being silently patched over.** An unknown top-level key (e.g. `"budget"`), a
  typo'd or invalid `budgets` entry, a non-array or non-string-element `watchedDocs`, or a
  malformed `categories` section used to be dropped, filtered or replaced with defaults —
  the limit you set was simply never in force, and nothing said so. Each class is now
  refused by name, with the valid set in the message. A config that loaded yesterday and
  quietly did less than it claimed will refuse today until the offending key is fixed.

- **Breaking: `review promote-revision <id>` / `review discard-revision <id>` no longer
  silently settle the oldest pending revision when the item carries several.** The bare
  form used to pick the oldest — so reviewing the second diff and typing the documented
  command settled the first, stamped `origin: 'human'`, with nothing saying so. With more
  than one revision pending the bare form is now refused, listing the pending revision ids
  and requiring `--revision`; with exactly one pending it still works unchanged.

- The append-only JSONL machinery moved out of `src/core/revision.ts` into
  `src/core/jsonl-log.ts`, shared by both logs. Behaviour is unchanged. The torn-tail check
  is now `O(1)` rather than a read of the whole file: on the hook path, which writes a
  record on every tool call, the full-read version measured 11.28 ms p95 against an 8 MiB
  log and would have roughly doubled the just-in-time injection's cost.

- `link_items` and `mycontext edit --unlink` now carry an `origin`. It gates nothing — an
  added edge cannot change what governs, which is why it was absent — but "who" must not be
  unknown in an audit record for an operation an agent can reach.

- Structural consolidation, behaviour unchanged with one exception worth naming: the six
  copies of open-then-rebuild are one implementation with the retry policy an explicit
  per-caller parameter, the seven switch-dispatched CLI builtins are ordinary registry
  entries, and the 2,487-line `mutate.ts` is split by responsibility. The exception:
  `focus_context`'s report path was the only MCP rebuild without its caller class's
  SQLITE_BUSY retry, and now takes it.

### Fixed

- **A subagent is no longer served nothing because its parent had already seen it.** A
  subagent — the Task tool's separate context window — arrives at the hooks with the
  parent's `session_id` verbatim, so the shared dedupe key meant an empty context window
  was served nothing the session had already seen, while the record claimed delivery. The
  just-in-time dedupe key now carries `agent_id` when present, so each subagent is its own
  dedupe scope. What remains is a property of Claude Code, recorded in §8 of both READMEs:
  no `SessionStart` fires for a subagent, so it never receives the pinned tier, the index,
  or a compaction restore.

- **PreCompact snapshots are no longer silently lost on Windows.** On NTFS, renaming the
  snapshot over its predecessor fails `EPERM` whenever any other process merely holds the
  target open for reading — measured at 654 of 2,000 renames under a concurrent reader,
  and the realistic holder is an antivirus or indexer. There was no retry, and the throw
  was swallowed: the hook reported success while the session's restore state was gone. The
  rename now retries with a bounded backoff, and a final failure writes an audit record
  naming the captured-but-unpersisted ids plus one stderr line — compaction is still never
  blocked.

- **The Hebrew README's categories section is now Hebrew.** Its
  `<!-- example-md: help categories -->` block was filled with `mycontext help categories`'
  English stdout — the same bytes as the English README's — so the mirror's largest section
  was English prose inside a Hebrew document, and `test/docs/parity.test.ts` passed because
  it compares structure, never meaning (its recorded limitation). The topic now has a Hebrew
  source (`src/help/topics/categories.he.md`) that the documentation generator selects per
  document; the CLI itself still speaks English on every terminal. The table's machine facts
  — type, tier, id prefix — are derived from the catalogue in code in both languages, and
  `test/help/categories-he.test.ts` fails the suite when the two sources drift: a category
  entry in one and not the other, a differing table row, a diverged section structure, or a
  catalogue category with no Hebrew description. `test/docs/examples.test.ts` now also
  verifies the Hebrew document per block kind — fenced transcripts byte-equal to the English
  document's (a terminal prints English), the one document-body block re-executed under its
  locale and asserted to actually be Hebrew.
- Nothing else user-facing. Two defects were found and closed inside the new code before it
  shipped, both by tests rather than by reading: a projection that reported a log rotation
  as "behind" instead of "diverged" would have recorded every entry around the rotation
  twice, and a failed SQLite handle left open pinned the file on Windows so a corrupt
  projection was never actually discarded.

## [0.9.0] - 2026-08-16

### Added

- **The corpus.** Typed normative and rationale items stored as Markdown inside the user's
  own repository — 21 categories across two profiles (all 21 enabled by the `standard`
  profile), a restricted frontmatter parser that refuses rather than guesses, deterministic
  ids and content checksums, and byte-identical round-tripping between the Markdown and the
  index.
- **The index.** A SQLite index derived entirely from the Markdown, rebuildable with
  `mycontext rebuild`, with schema versioning and in-place migration. The Markdown is the
  source of truth; the index holds nothing that cannot be reconstructed from it.
- **Four injection tiers.** Pinned items (`always`) at session start; just-in-time items
  when a file they apply to is about to be opened — the files matching their scope glob, or
  every file for an item that declares none; restored items after
  a context compaction; and a bounded index of everything else, so nothing in the corpus is
  invisible. Per-tier budgets, with spill and truncation disclosed in the injected text
  rather than silently dropped.
- **Four hooks** — `SessionStart` (startup, clear, resume and compact), `PreToolUse`,
  `PreCompact` and `PostToolUse` — which is how injection happens without the user asking
  for it.
- **A 28-command CLI**: `init`, `add`, `edit`, `pin`, `unpin`, `harden`, `soften`, `list`,
  `search`, `show`, `examples`, `help`, `rebuild`, `status`, `doctor`, `decay`, `query`,
  `review`, `repair`, `supersede`, `refresh`, `ingest`, `ingest-apply`, `ingest-status`,
  `lesson`, `lesson-stage`, `lesson-accept`, `lesson-discard`. Detail levels (`--summary`,
  `--short`, `--full`) and `--json` on the reporting commands.
- **`mycontext search`** — find items by text, `--type`, `--tag`, `--path`, `--status` or
  `--relation`. It runs the same predicate as the `query_items` MCP tool, from one place in
  the source rather than two, which is what makes "the same search on either surface" a
  structural fact instead of a promise. A filterless invocation is refused rather than
  answered with the whole corpus, and a truncated result always says so.
- **`mycontext edit --unlink <relation> <target>`** — the first supported way to remove a
  relation. `link_items` only ever added one. There is deliberately no `unlink_items` tool:
  adding an edge cannot change what governs, but removing one from a governing item takes
  away part of what that item asserts. `supersedes` and `superseded_by` cannot be removed at
  all, because a supersession is written together with the retired item's status and
  removing the edge alone would leave an item marked as replaced by nothing. A relation from
  outside the closed vocabulary can be removed, because that vocabulary governs what may be
  written.
- **Twelve MCP tools** over a hand-written JSON-RPC stdio server: `create_item`,
  `update_item`, `refresh_item`, `supersede_item`, `link_items`, `get_item`, `query_items`, `list_drafts`,
  `load_context`, `mycontext_help`, `mycontext_examples`, `ingest_document`. The tool list
  is sorted and byte-stable across calls, so the prompt carrying it can be cached.
- **A 64-command slash surface**, generated from the same resolved configuration the help
  topics read: `/mycontext:add-<category>` and `/mycontext:list-<category>` for every
  *enabled* category, plus `search`, `show`, `doctor`, `decay`, `query`, `status`, `review`,
  `promote`, `discard`, `edit`, `pin`, `unpin`, `harden`, `soften`, `supersede`, `refresh`,
  `link`, `unlink`, `ingest`, `lesson`, `lesson-stage` and `LoadMyContext`. A disabled
  category loses its command rather than offering a capture the program would refuse.
  **Every write command previews by running the CLI command without `--yes`** — which
  prints the real preview and then declines, writing nothing — shows you that output, and
  hands you the `--yes` form to type yourself. The preview is therefore never a paraphrase,
  and the confirmation is never the model's. The two stateful flows, ingest and lessons,
  each advance one step and hand control back rather than guessing at the next chunk or
  accepting a rule on your behalf.
- **Parity between the two surfaces, enforced by a test.** `src/plugin/parity.ts` declares
  which command answers which MCP tool and `test/plugin/parity.test.ts` checks it against
  the running program: every tool must have a CLI command or a slash command, every
  one-sided row carries its reason, and every CLI command with no slash command is listed
  with one. The asymmetries that remain are listed deliberately rather than discovered.
- **An asking flow for fixed-value fields.** Claude Code has no picker — `argument-hint` is
  placeholder text, not a control — but a slash command runs through Claude, so
  `/mycontext:edit`, `/mycontext:link` and `/mycontext:unlink` present the values as a
  numbered list and wait. Every list is generated from the enum in the source, so none of
  them can come to offer a value the program refuses.
- **The trust boundary.** Normative items authored by an agent land as drafts and do not
  govern until a human promotes them; `mycontext review` is the queue walker that does it.
  `supersede_item` refuses to retire a governing normative item — that decision is a
  human's.
- **Document ingest.** Chunking with stable, content-addressed provenance anchors; a
  candidate schema with a grounding validator that rejects paraphrase; resumable sessions
  with a workspace-scoped apply lock; dedupe and supersession on apply.
- **Lessons to rules, behind an approval gate.** A recorded lesson produces staged rule
  candidates; nothing generated is active until a human accepts it.
- **Diagnostics.** `doctor` (index freshness, orphans, drift, dead globs, permissions,
  session ids), `decay` (items not injected lately, reported with the caveat that the ledger
  records injection rather than use), and `query`, a read-only SQL passthrough over the
  index, capped and guarded twice over.
- **Configuration** in one file, `.my_context/config.json`: `profile`, per-category
  `enabled` and `tier`, per-tier `budgets`, and `watchedDocs`. Configuration replaces rather
  than merges.
- **Documentation** — a full README covering the problem, the mechanism, all three
  invocation surfaces, configuration and the trust boundary, with every worked example
  generated by running the command against a committed fixture; a complete Hebrew mirror in
  `docs/README.he.md`; and four tests that hold both documents to the program: every CLI
  command, slash command and MCP tool must be named and nothing may be named that does not
  exist, every example is re-executed and diffed, and the two languages must keep the same
  section structure and the same examples in the same order. Both documents also define
  every category: the definitions are the generated output of `mycontext help categories`
  rather than a second copy of it, and a fifth test pins what that block cannot carry — the
  profile arithmetic, the membership of `minimal`, and the claim that nothing ships disabled
  — against `src/core/categories.ts`.
- **MIT licence**, declared in `package.json`, `.claude-plugin/plugin.json` and the
  marketplace entry, with the full text in `LICENSE`.
- **A versioning scheme and this changelog.** `VERSIONING.md` decides what `MAJOR` means for
  this product rather than leaving it to be re-argued: the compatibility surface is the
  corpus on disk, the config format, what gets injected and when, and the three invocation
  surfaces — and explicitly *not* the SQLite index, which is derived and rebuildable.
  `package.json` owns the version; `scripts/set-version.ts` writes all four sites;
  `test/release.test.ts` fails when any of them drift or when the changelog does not account
  for the version being prepared.
- **`mycontext status` reports the version**, on its headline at every detail level and as
  the first field of `--json`, so a bug report can say what it was filed against. Before
  this there was no answer but a commit hash.
- **A marketplace manifest**, so `claude plugin marketplace add ./` and
  `claude plugin install mycontext@mycontext` give a persistent install. Previously only
  `--plugin-dir` worked, and that lasts one session.
- **CI on Windows and Linux**, running the test suite and a separate performance suite with
  p95 ceilings for just-in-time injection and session start.
- **`mycontext edit <id>`, and a gate that scales to what the change can do.** Until this
  there was no update route for a human at all: the only way to a governing item's `scope`,
  `always`, `severity` or `status` was to hand-edit the Markdown and run `mycontext repair`,
  which the plugin's own write-deny blocks the model from doing and which this project's
  documentation is not allowed to instruct. `edit` takes `--title`, `--body`, `--scope`,
  `--tags`, `--severity`, `--always` and `--status`, passes a human origin, and gates by
  what is actually at stake: nothing on a draft or a rationale item, a preview and a
  confirmation on an item that governs, and a preview naming what governs *before and
  after* when the change is to reach or force. `--status superseded` is refused — a
  retirement names its replacement, which is `mycontext supersede`.
- **`mycontext pin`, `unpin`, `harden` and `soften`** — `edit` with one flag already filled
  in, so they carry the same preview, the same gate and the same refusals rather than being
  a second editing mechanism. They exist because the command list is the picker and because
  `--always` is a switch, so `--always true` is a mistake the named form cannot make. One
  test enumerates all four against their `edit` equivalents and compares exit code, stdout
  and the resulting file.
- **`categories.<name>.agentEdits`, and staged revisions.** An agent could already not
  change a governing item's `scope`, `always`, `severity` or `status`; it could still
  rewrite the body, which on a normative item *is* the instruction. This makes that a
  per-category policy. Under `allow` an agent's change to title, body or tags applies
  immediately; under `review` — the default for every normative category, `allow` for every
  rationale one — it is staged as a pending revision, the item keeps governing its current
  text, and the agent is told in the response's first words that nothing was applied.
  `allow` does not widen the reach-and-force gate, which the policy check is placed after
  and which never consults it.

  Revisions live in an append-only log under `.my_context/.revisions/`, never under
  `items/`, so nothing in the selection path can see one. `mycontext review revisions`
  shows each as a full diff against the text in force; `review promote-revision` applies
  one and `review discard-revision` rejects one, both behind the existing confirmation. A
  discard never rewrites the line that recorded the proposal, so the proposed text stays
  readable. A human edit underneath a pending revision makes it *stale* in the fields it
  rewrites rather than silently losing to it: promotion is then refused, and `--force`
  overrides after printing what it destroys. `mycontext status` and `mycontext review`
  count pending revisions in one shared sentence.
- **`categories.<name>.scopePolicy`** — what an empty scope means, per category. `global`
  (the default) applies to every file; `required` refuses at capture, on `add`,
  `create_item` and ingest apply alike, and on an edit that removes the last glob; `inert`
  applies to no file and renders as `(inert)` wherever a scope is shown. Changing the
  setting rewrites nothing already captured, and `doctor` reports how many items a policy
  change is currently changing the behaviour of.

### Added

- **`reference` — a category whose body is a snapshot of a file, with drift reported and a
  command to resolve it.** There was no way to get a file — a roadmap, a runbook, a progress
  log — into a session's context; the workaround was pasting its text into an item's body,
  where it went stale with nothing watching.

  `mycontext add <category> "<title>" --file <path>` reads the file and stores it as the
  item's body, recording `source_file` and `source_checksum`. `mycontext doctor` compares
  the two and raises `source_drift` naming the item, both checksums and the command that
  resolves it. `mycontext refresh <id>` re-reads the file, previews the size change, and
  asks before it writes; the `refresh_item` MCP tool is the same operation for an agent,
  taking an id and no body so the new text is necessarily a copy of the file, and staged for
  review rather than applied wherever `agentEdits` says so.

  **It is a snapshot, never a live read, and that is a trust decision.** A normative item
  read from disk at injection time would let whoever can edit the file change what governs
  the project — an agent included — which is the boundary staged revisions exist to hold. It
  would also break byte-identity (the rendered item would not round-trip) and make the
  injection budget unpredictable, since a tracked file can grow without bound. So the file
  is read at capture and at each refresh, and nowhere else.

  `reference` is **rationale**, which closes the same problem by construction for the
  default configuration: `select` filters normative items before it reads `always` or
  `scope`, so a snapshot cannot govern. Retiering it to `normative` is a supported config
  change and the documentation states its cost in as many words rather than softening it —
  the file's content becomes governing knowledge, and whoever can edit the file can change
  what governs, subject to the snapshot-and-review cycle and to nothing else.

  Three smaller decisions, each recorded because it could otherwise look arbitrary. The
  snapshot is stored **quoted** (`> ` per line): an item's body is the prose before its
  first `## ` section, so a Markdown heading in a raw body would take everything after it
  out of the body on the next write — quoting is what makes the file round-trip, and the
  recorded checksum is still taken over the file rather than over the quoted form. Capture
  **refuses above 256 KiB**, and the message says the limit is not about the injection
  budget but about the snapshot being re-read and re-parsed by every command that rebuilds
  the index. And below the limit nothing is silent: every capture prints the size in lines,
  bytes and estimated tokens, every refresh prints the before-and-after in lines and
  estimated tokens, and both then print what this project's tier does with that size — which on the rationale tier is "costs the injection budget nothing", because
  claiming a budget cost there would be false.

- **`mycontext add --note "<text>"`**, repeatable, adding a `[note]` observation. A
  snapshot's body is somebody else's text, so *why* the file is in this corpus had nowhere
  to live but the title. One fixed observation category rather than a flat spelling for all
  four observation fields; `create_item` remains the route for the rest, and `add`'s
  unknown-flag message now says that instead of "not expressible here".

### Changed

- **BREAKING — the category catalogue: `policy`, `postmortem` and `taxonomy` are removed;
  `known_issue`, `runbook` and `environment` take their places.** Twenty categories before,
  twenty after, and every one of them now enabled by the `standard` profile rather than
  three shipping switched off. [`VERSIONING.md`](VERSIONING.md) names removing a category as
  `MAJOR`, and this is recorded here as breaking for that reason; nothing has been released,
  so no installation has to act on it today.

  Why the three went. Each duplicated a category that was already on — `policy` ↔
  `rule`/`constraint`, `postmortem` ↔ `lesson`, `taxonomy` ↔ `glossary` — which is why they
  shipped disabled. Since an item's `type` is fixed at creation, two overlapping types
  enabled at once means the same fact filed twice with no way to reconcile them; a catalogue
  entry that ships disabled, duplicates a clearer sibling and is documented as "turn this on
  only if…" is a decision left half-made. They were also the only place the tool shipped
  filler: `mycontext examples policy` printed *"Replace this body with the real content and
  reason."*

  What the three new ones do that no existing category can. `known_issue` (rationale)
  records a **present** fact about the system — this is broken, flaky or a dead end — where
  `lesson` is retrospective and `risk` is prospective; its job is to stop effort rather than
  steer it. `runbook` (normative) is **conditional and procedural** — the steps for one
  operation in the order they must be taken — where `instruction` is a standing directive
  that applies always. `environment` (normative) is conditional on **where the code runs**,
  where a `constraint` is a limit that holds everywhere; an agent reasoning correctly about
  a constraint can still be confidently wrong for having assumed local matched production.

  **What happens to items you already have.** Nothing is dropped. `loadLayer` indexes an
  item whose category is absent from config on purpose, so an existing `policy` item stays
  on disk, stays indexed, and stays visible to `list`, `show` and `query_items`. What it
  loses is the ability to govern: no tier admits an unknown category, so it is never
  injected and the session index counts it (`1 policy (disabled/unknown category)`) rather
  than naming it. Every command that opens the corpus prints a load error naming the file,
  and **`mycontext doctor` now reports a new `unknown_category` warning per item**, naming
  the item and both routes out. There is **no retype** — `type` is fixed at creation and
  decides where the file lives — so the routes are: declare the category in
  `.my_context/config.json` with a `tier` and a `description`, which makes it a first-class
  category of your project again; or capture a replacement under a live category and
  `mycontext supersede <old> --by <new>`.

  Also changed by this: `standard` and `full` resolve to the same twenty categories today
  (they still mean different things, and a test fails if a future category ships disabled
  while the documentation says otherwise); `commands/` gains six generated slash commands
  and loses none; and both READMEs carry a worked `--short` specimen for all twenty
  categories, where three previously had none.

- **`scope` is a restriction, not an enabler: an item with no scope now applies to every
  file.** This is the largest behaviour change in the repository and it corrects a
  misimplementation of the original requirement rather than reversing a decision. The
  requirement was that scope restrict injection where restriction is wanted, so that an
  item needing no restriction costs its author nothing to write; `matchesScope` was
  implemented as `scope.length > 0 && matchesAnyGlob(...)`, which made an unscoped item
  match nothing, never JIT-inject, and reach a session only as a one-line index entry.
  Spec §3.2 was amended, with the superseded wording quoted in place.

  What changes for an existing corpus: every active, normative, unscoped item becomes
  eligible for just-in-time injection on every file operation. `always: true` is
  unaffected and keeps its own meaning — pinned in full at session start, before any file
  — and the ledger's once-per-session dedupe is what stops a pinned unscoped item
  arriving twice. Items that are already scoped behave exactly as before. The cost is
  real and bounded by the `jit` budget: what does not fit spills and is disclosed, as
  ever. If a corpus has large unscoped items that were only ever meant to be
  index-entries, give them a scope.

  Consequences elsewhere: the `query_items` MCP tool's `path` filter returns unscoped
  items for any path, where it used to hide them. `decay`'s `unscoped` bucket is replaced
  by `unrestricted`, and its meaning inverts — unscoped items are no longer held out of
  the cold/warm partition as unmeasurable, they are measured like everything else, and
  `unrestricted` is an additive breadth view over the same rows that recommends nothing.
  **`decay --json` breaking change:** `counts.unscoped` and `unscoped` become
  `counts.unrestricted` and `unrestricted`, and unlike the bucket it replaces it overlaps
  `cold`/`warm`, so summing all three double-counts. `**`, `*` and `**/*` are still
  refused by the ingest and lesson paths, but as redundant spellings of omitting `scope`
  rather than as "too broad".

- **Every surface renders an empty `scope` with the same words: `(unrestricted)`.** Four
  surfaces gave three answers for the same field of the same item — `list --full` and
  `review list --full` printed `-`, `decay --full` printed something else, and the two
  approval-gate previews printed a third wording. `-` was also actively misleading under
  the corrected rule, reading as the narrowest possible setting for what is the widest.
  There is now one definition (`SCOPE_UNRESTRICTED` in `core/render-item.ts`) and no site
  spells its own; `test/cli/scope-rendering.test.ts` executes every surface and asserts
  they agree, and scans the sources so a new site inlining its own literal fails even
  though nothing enumerates it.

  The MCP list line (`query_items`, `list_drafts`) now always shows the scope, where it
  used to omit the field for an unscoped item. That was survivable while an unscoped item
  was never injected; it is not now, because `query_items({path})` returns unscoped items
  for every path, so the items governing EVERY file were the ones whose reach was left
  unstated. `(unrestricted)` rather than `(every file)` because these surfaces list
  rationale items too, and a rationale item is never injected on any file whatever its
  scope says.

- **`--full` is a record view, not a wider table, and every report is laid out to a
  100-column budget.** `list --full` measured 280 columns against this repository's own
  corpus and `decay` printed a fixed 284-character caveat unwrapped at *every* detail level
  including `--summary`, so any narrower terminal rewrapped rows mid-cell and destroyed the
  columns the borders were drawn to show — the widest detail level was the least readable
  one. `--full` now prints one labelled stanza per item with hanging-indent wrapping: the
  same fields in the same order, nothing dropped, and no truncated id that still looks
  whole. Tables narrow and wrap to the budget but never below a column's longest single
  token, so an id, glob or URL is never broken. Measured after: `list --full` 95,
  `decay --full` 97, `decay --summary` 97, `status` 95, `status --full` 100. The budget is a
  constant rather than the terminal width, so piped and watched output are the same bytes —
  which is what lets the documented examples be generated by running the commands.
  The default `list` table was left out of that fit — it is never squeezed below its own
  longest token, and ran to 192 columns on a real corpus — until the entry below closed it.
- **The scanning tables no longer carry a `title` column.** An id is a slug of its title, so
  `list`'s two widest columns held one fact between them: `CONST-node-24-no-build-step`
  beside "Node 24 or newer, and no build step". Dropping the duplicate took the default
  `list` from 192 columns to 97 and `decay` from 170 to 97, both now inside the 100-column
  budget, on this repository's own corpus. The cold table in `status --full` lost the same
  column for the same reason. `review list` did not — it was inside the budget either way,
  and the width is the whole reason the column went. No id changed and nothing is
  truncated: the title is still printed whole by `show`, by `--full` and by `--json`. Nothing replaced the column —
  at a 64-character id there are about thirty columns left, and `origin`, `scope`,
  `severity` or `layer` would each have put the table back over the budget it had just
  reached.
- Tables render with box-drawing characters where the terminal supports them and plain ASCII
  where it does not. Detection fails toward ASCII, so an unrecognised Windows terminal gets
  the safe rendering.
- The plugin is named `mycontext` throughout — the CLI binary, the MCP server key, the
  plugin manifest and the `/mycontext:…` command namespace, which previously would have
  disagreed.

### Fixed

Grouped, because most of these are one class: **something was supplied, accepted, dropped,
and success reported.** That class is this project's characteristic defect and is named as
such in the README.

- **Three commands told you to run a flag that does not exist.** `edit`, `supersede` and
  `refresh` answered an unknown id with "find it with `mycontext query --text "..."`" — a
  flag `query` has never accepted and refuses as unknown. They now name `mycontext search`,
  and the test runs the command each message names rather than comparing it to a string,
  because a message that teaches a refusal is worse than one that teaches nothing.
- **Both READMEs said "eleven MCP tools" in three places each**, from before `refresh_item`
  landed. The count is computed from the tool list now, in both languages.

- **"Items loaded via `/LoadMyContext` are not restored after a compaction" was false, and
  said so on eight surfaces at once.** Executing the real pipeline — a manual `load_context`,
  then `PreCompact`, then `SessionStart(compact)` — re-injects the manually-loaded item in
  full: the pre-compaction snapshot unions the ledger with a scan of the transcript, and a
  manual load writes its ids into the transcript by delivering them, so the transcript arm
  catches what the missing ledger arm drops. The claim shipped in `commands/LoadMyContext.md`,
  `skills/mycontext/SKILL.md`, the `load_context` tool description, `src/help/topics/capture.md`,
  a comment in `src/core/inject.ts` and both READMEs, and **two tests asserted the false text
  was present**, which is why nine months of readers each assumed some other copy had been
  checked. Every copy now states the same conditional claim — restored after a compaction
  **only if** the snapshot still sees the id — and carries the three cases where it does not:
  rationale items never restore, an id last mentioned beyond the final 8MB of the transcript
  is not seen, and the restore tier's own budget can spill it to an index line. The two
  pinning tests were repointed rather than deleted, and `test/hooks/manual-load-restore.test.ts`
  is the behavioural half the suite never had: it drives the real hooks end to end, so it
  fails if restore stops working rather than if a sentence is reworded.
- **`disable-model-invocation` is in effect on every slash command, having been written down
  and not in effect on nineteen of them.** The 17 `list-<type>` commands plus `review` and
  `status` carried `argument-hint: [--full|--short|--summary] [--json]`, which opens a YAML
  flow sequence and then trails a second one — not valid YAML. Claude Code's message for that
  case is explicit: *at runtime this command loads with empty metadata (all frontmatter fields
  silently dropped)*. So the model could invoke the very commands whose frontmatter said it
  could not. Found by running `claude plugin validate .` against this repository. The
  generator quotes every hint now, all 37 generated files were rewritten, and validation
  passes with zero errors. The test that guarded those files matched the lines with a regex,
  which is exactly why it passed throughout: it now parses the frontmatter with
  `parseFrontmatter` and asserts `disable-model-invocation` comes back as the boolean `true`.
- **`review list --full` was the last report outside the 100-column budget, and outside the
  test that enforces it.** As a table of eight columns it measured 210 columns on a draft
  whose id is as long as `slugify` will mint — the same arithmetic as `list --full`, on the
  one command the earlier pass had not measured. It is a stanza per draft now, like every
  other `--full`, comfortably inside the budget on the same draft, and the budget test walks
  it too. The scanning levels are a different matter and are not a column-set problem: a
  67-character id alone takes more than two thirds of the budget, so those tables overflow it
  with or without a title column — dropping the column would not rescue them. README section 8 records that as a property rather than a
  gap.
- **`--always`, `--severity` and `--scope` on a rationale item are refused rather than
  stored and ignored.** `select` filters the normative tier *before* it filters `always`,
  and nothing outside that tier gates on severity, so both fields were accepted on a
  `decision` or a `lesson` and then did nothing at all. The refusal explains that the field
  exists on every item but governs only on the normative tier, and names both ways forward
  — retier the category, or capture the fact as a normative item. It fires on the
  *assertion*, so `--always=false` stays accepted and an item whose category was retiered
  underneath it stays editable. `scope` is deliberately **not** refused there: it is inert
  for injection but `query_items({path})` reads it on every item, and refusing it would
  have made `scopePolicy: "required"` on a rationale category unsatisfiable.
- **`review promote` no longer previews a lie.** It reported a rationale draft carrying
  `always: true` as "pinned — injected in full at every session start". It never is.
- **Two agent-facing refusals no longer send a human to hand-edit the Markdown.** Both of
  `updateItem`'s trust-boundary refusals told a non-human caller that no command makes the
  change on an already-governing item, then named hand edit plus `mycontext repair` as what
  a human could do. `mycontext edit` made the first clause false and the second
  unnecessary. Both now name the supported command and its flag, keep the prohibition
  (`edit` passes a human origin, the one claim an agent cannot make), and mention no hand
  edit at all. Found by driving the real MCP server under `agentEdits: "allow"`.
- **A repeated CLI flag is refused or collected, never silently reduced to its first
  occurrence.** `--scope "src/api/**" --scope "src/db/**"` created an item scoped to the
  first glob alone and reported success; eleven other call sites shared the behaviour. Found
  by dogfooding, after it had already mis-scoped a real item in this repository's own
  corpus. Single-valued flags now refuse a repeat, `--scope` and `--tags` collect every
  occurrence, and a contradictory boolean is refused rather than resolved.
- **An MCP argument a tool does not declare is refused, not dropped.** `create_item` with a
  `relations` array reported the item created and wrote no relations, saying nothing. No
  tool on the surface closed its schema: `origin` was accepted and ignored by all three
  write tools, and `update_item({sevrity: "hard"})` reported "updated" while changing
  nothing. Every advertised schema now closes, at the one boundary every call crosses.
  `relations` is refused rather than implemented, because forwarding it would route around
  both the relation vocabulary and the retirement-direction guard.
- **An unrecognised option is refused on all six reporting commands.** The README claimed
  this of six; it was true of one. `status --ful`, `doctor --jso`, `decay --bogus`,
  `review list --ful` and `ingest-status --ful` each printed the default report and exited
  0 — the wrong report, delivered confidently. The guard is now registry-driven, so a
  seventh reporting command cannot skip it.
- **An unknown `list` category is refused instead of answered with silence.**
  `mycontext list constraintt` printed nothing and exited 0, which is indistinguishable from
  "you have no constraints". A valid but empty category now prints `0 item(s)`. Disabling a
  category is still not an error, because disabling is non-destructive.
- **`decay --json` stays parseable exactly when it matters.** It emitted its JSON document
  and then plain-text error lines on the same stream, so stdout was unparseable in precisely
  the situation a consumer most needs to parse it — while exiting 0 with an empty stderr. It
  was the only deviant among the JSON surfaces; all of them are now held to carrying load
  errors *inside* the document by one test.
- **An item in a category the config does not recognise is reported rather than indexed
  invisibly.** The category lookup was a bare index, so an item typed `constructor` resolved
  against `Object.prototype`, raised no load error, and was indexed with no integrity signal
  at all.
- **A successful command no longer exits non-zero because of an unrelated load error**, and
  the inverse: `status` and `doctor` are the only commands whose exit code reflects corpus
  health, which is a contract a CI pipeline can gate on.
- **Concurrent `create_item` calls no longer lose content silently.** Measured with eight
  racing processes: six items lost across eight runs, with every racer reporting
  `created: true`. Item creation is now exclusive.
- **Text written through the MCP surface can be read back.** A sentence-ending double space
  produced a permanent checksum mismatch on an item the tool had just reported as written.
- **A ledger write failure can no longer discard a rendered injection**, and a v1 database
  migrates rather than bricking — including the case where the schema-version row is absent
  entirely rather than merely stale.
- **Item ids are validated as filename segments.** An explicit id of `../../../evil` wrote
  outside `.my_context/` and past the write-deny hook, which matches on a path segment and
  never saw a managed path. Not reachable from any current surface; closed at the boundary
  anyway.
- **`always`, `severity` and normalized `scope` are inside the content hash**, so an item's
  recorded checksum reflects the fields that decide whether it governs.
- **Documentation that asserted properties the code did not have.** Several model-facing
  surfaces — loaded into every session — claimed a universal draft rule that did not hold
  for rationale categories, described a compaction behaviour that did not exist, and
  instructed the reader to hand-edit an item's frontmatter, which permanently poisons its
  checksum. Each correction is now pinned by a test, because a doc paragraph with no test is
  how this project has lost claims before.

### Security

- **The deny list the README recommends gained six rules, and the reason it needs them
  rather than fewer is now written down.** A Claude Code permission rule matches the
  command *string*, so `Bash(mycontext edit *)` does not match `mycontext pin …` and
  `Bash(mycontext review promote *)` does not match `mycontext review promote-revision …` —
  the pattern wants a space where the real command has a hyphen. A deny list that stopped at
  `edit` and `review promote` therefore left six working routes to exactly the writes it was
  denying, invisibly to anyone reading it. `pin`, `unpin`, `harden`, `soften`,
  `review promote-revision` and `review discard-revision` each have a rule of their own, in
  both READMEs, and the non-match is demonstrated by a test rather than asserted in prose.
- **The approval-gate list is eight commands, not seven.** `mycontext review
  promote-revision` applies a change *an agent proposed* to the text of an item that is
  already governing, which makes it the entry on that list an agent has the clearest reason
  to run. It is named in the README's gate table, in `SKILL.md`'s prohibition and in the
  `workflow` help topic — the `SKILL.md` size ceiling was raised for it and for the fact
  that an agent's own content edit may be staged rather than applied, both of which a model
  reasoning from stale text would otherwise get wrong.
- **The `.my_context/` write-deny is matched case-insensitively.** The guarded path segment
  was compared case-sensitively while NTFS and default APFS are not, so a write to
  `.MY_CONTEXT/items/constraint/…` named the same file and passed the deny with empty output
  and exit 0. Reproduced against the real hook binary: written through and rebuilt, the
  forged file indexed as an `active`, `always: true`, `origin: human` constraint — a pinned
  governing item injected into every session, defeating the draft-and-review gate entirely,
  on the first-target platform.
- **The write-deny canonicalizes the path, closing the 8.3 short-name bypass.** The
  case-insensitive fix explicitly did not close `MY_CON~1`, and no regex can. The deny now
  checks the raw spelling *or* the canonical one, resolved with `realpathSync.native` —
  Node's JavaScript implementation leaves an 8.3 short name as written, measured on this
  machine — and walks to the longest existing prefix, because a `Write` names a file that
  does not exist yet. The two checks are a union rather than a replacement: a canonical-only
  check would *allow* a write the string check denies when `.my_context` is itself a
  junction pointing out of the repository. A link pointing *into* `.my_context` is now
  denied, which is a deliberate widening. Verified by probing 8.3 names, symlinks,
  junctions, `\\?\` prefixes, admin shares, `subst` drives, `..` traversal, trailing dots
  and `::$DATA` suffixes.
- **Two residuals remain, and are documented and test-pinned rather than implied closed.**
  The `PreToolUse` matcher does not include `Bash`, so a shell redirect into `.my_context/`
  followed by `mycontext rebuild` is not seen by the hook at all; and a *hard* link to an
  existing item file cannot be resolved away, because a hard link is a second equal
  directory entry with no target for a realpath to find. Creating one requires a shell, so
  it is a corollary of the first. The approval boundary is stated honestly in all three
  places a reader arrives from — the README, the always-loaded skill, and the workflow help
  topic — including that a plugin cannot ship permission rules, that the offered deny list
  is prefix matching on a command string and is not complete coverage, and that the gate
  holds only if the harness's Bash surface excludes the `mycontext` binary entirely, in
  every spelling, and direct writes into `.my_context/`.
- **The lesson-to-rule approval gate no longer accepts a forged staging file**, including
  one whose filename disagrees with the lesson id inside it.
- **`supersedeItem` is no longer an unguarded second route to the demotion `updateItem`
  refuses.** The refusal message had been advertising the bypass.
- **Prototype-pollution holes closed** in the `extra` field and in the category lookup, and
  path traversal closed in ingest session handling.
