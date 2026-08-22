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
`mycontext audit --role` accepted a filter it then ignored outside `--items`. `1.0.2` carries
two more, and the first is the sharpest example this file has of why the distinction matters:
an id read from disk was never checked against the id grammar and reached commands the tool
invites you to paste into a shell — reachable in `1.0.0` and `1.0.1` both. Read those as
real, and the `0.9.0` ones as history.

`0.9.0` rather than `1.0.0` is a decision, and `VERSIONING.md` explains what `1.0.0` would
commit to. The three phases before this one closed the trust hole, made the documentation
true and settled the category vocabulary; this one made the two invocation surfaces
parallel. What was left before the surfaces are worth freezing was Linux certification,
session focus, the audit log and the remaining recorded requirements — Part E and D4 of
`docs/ROADMAP.md`. All of it has since landed and is recorded under `1.0.0` below: the
audit log, session focus, Linux certification, and the disposition census that emptied D4.

## [Unreleased] — 2.0.0 when tagged

Seven new commands — `export`, `pack`, `procedure`, `todo`, `inbox-promote`, `session`
and `ui` — a read-only HTTP surface over the corpus, three categories, two hooks that did
not fire before, and the first route this project has for getting a corpus off one machine
and onto another.

**What changes on an installation whose `config.json` you never touch** is named at the
top of `Changed` rather than left to be met: a new session now carries the previous
session's index lines forward and can displace some of its own; the audit log's protocol
moved to `audit@2`, which an older build refuses to read; an unknown top-level config key
is now skipped and disclosed instead of refusing the file, reversing a decision `1.0.0`
recorded as breaking; and an `extra` field is refused on a category that does not declare
it, which is the one entry here that can require you to edit a config before a capture
that worked yesterday works again.

`2.0.0` rather than `1.1.0` is a judgement [`VERSIONING.md`](VERSIONING.md) supports
rather than settles, and it is argued where the entries are. The short form: nothing below
removes a command, a category, a tier, a flag or a config key, no corpus written by
`1.0.2` needs a manual step to be read, and the index schema did not move. What earns the
major is that an install which changes nothing still behaves differently, in the tier this
product exists to fill.

### Added

- **`mycontext export` and `mycontext pack import` — a corpus can now leave this machine
  and arrive on another one, and what arrives governs nothing until you say so.** Until
  now the only way to hand this knowledge to someone was to copy `.my_context/items/` and
  hope. There is a format now, and a receiving side that checks it.

  - **`mycontext export --out <path>`** writes the whole corpus as a plain directory
    (`--format dir`, the default) or one file (`--format zip`), filtered by `--type`,
    `--status` and `--tag`. Four paths and no fifth: `manifest.json`, `history.jsonl`,
    `config.json`, and `items/<type>/<file>.md` taken from each item's own path, so the
    artefact says where an item *was*. `--dry-run` prints the whole plan first, including
    a list of what is **not** travelling — injections, hook actions, focus records, the
    index, session state, revisions, ingest sessions and staged lessons — because an
    allow-list is only half a disclosure to somebody about to hand their corpus to a
    colleague. There is no `--yes`, and the guard is the destination rather than a prompt:
    a directory that already holds anything is refused rather than merged into, and a
    `zip` target that already exists is refused by name, with a link named rather than
    followed. **What is enforced is that nothing is overwritten, not a workspace
    boundary** — the emptiness rule is what makes `--out .my_context` fail, and there is
    no containment check underneath it.
  - **`--as-pack --pack-name <name> --pack-version <text>`** makes it a *pack* rather than
    a whole export: `source_file`, `source_anchor` and `source_checksum` are cleared, and
    the count of each clearing is reported. Left in, they name files in your repository
    and would make the receiver's `doctor` report `source_missing` at error level for
    every imported item, permanently.
  - **The exported history is mutations only, redacted four separate ways.** The other
    five audit kinds describe a *machine* — which session saw what, which hook fired,
    which local path triggered it — so they are never selected rather than filtered out
    afterwards. Each surviving record is rebuilt from an eight-key allow-list, so
    `sessionId`, `hook`, `injected`, `tokens`, `spilled` and `path` cannot travel by
    being forgotten. Records are then joined to the items that actually travelled, because
    an id is a slugified title and a record naming a withheld item republishes its
    subject. Finally the free-text `note` is dropped or cut per operation; a `supersede`
    note travels only if the id it names travelled too. `--no-history` withholds the file
    entirely, which a receiver can tell apart from one that travelled and was empty.
  - **The ZIP container is byte-identical for the same set of files** — stored, never
    deflated (`deflateRawSync` is reproducible only for a fixed zlib build, a condition
    the receiver cannot check from the artefact), a fixed 1980 timestamp, entries re-sorted
    by one UTF-8 byte comparator so the order is a property of the set and not of the call.
    The one value that differs between two exports of an unchanged corpus is
    `manifest.json`'s `createdAt`.
  - **`mycontext pack import <path>` reads an artefact somebody else wrote, and treats it
    as hostile.** The format is sniffed rather than guessed from the extension. The
    directory walk refuses a symlink by name before it can be followed, refuses a path by
    name before the file is opened — drive letters, backslashes, colons (an NTFS alternate
    data stream is invisible to a directory listing), Win32 device names, non-NFC spellings,
    two paths differing only by case — and then checks containment anyway. Every file is
    verified against the manifest's full SHA-256 **before anything is parsed**, because a
    parser is the largest attack surface in reach and running one over unverified bytes
    hands a stranger the first move. A manifest disagreement is a refusal, never a warning:
    there is no partial import and deliberately no flag to ask for one.
  - **A mandatory Unicode screen, with no flag that turns it off.** Eleven ranges are
    refused in every authored field of every item — title, body, observations, tags, scope
    globs, relation targets, `extra` values, steps and the id — plus the pack's own name
    and version, which every surface prints without the item beside them. Bidi controls and
    isolates, zero-width characters, the word joiner, a BOM anywhere but the first byte,
    C0/C1 controls other than tab and newline, unpaired surrogates, and **the Tags block
    (U+E0000–E007F)**, which renders as nothing at all and is the channel the Rules File
    Backdoor smuggles instructions through. The reason is what a corpus *is*: an invisible
    reordering control inside a rule can make that rule read as its opposite to the person
    approving it while the model reads the other one, and neither can tell. Every finding
    is reported, not the first — an author sent round the loop one character at a time
    would believe they had seen the whole of what arrived. Nothing is normalised: the text
    is refused exactly as it came, so the bytes the manifest hashed are still the bytes on
    disk. **The cost, named rather than discovered:** U+200D is on the list, so any
    ZWJ emoji sequence — the family and profession emoji — is refused with it.
  - **Everything lands `draft`, on both write paths, and the report says so before it
    happens.** Incoming items are bucketed into `new`, `changed` and `identical`, the three
    counts sum to the incoming count, and all three sections print even when empty. A
    `changed` item names the fields that actually moved the content hash — derived from the
    hash's own projection, so the warning cannot name a field the hash ignored or stay
    silent about one it did not — and says whether each is overwritable at all. Replacing
    one needs `--overwrite-changed`, which `--yes` deliberately does **not** answer:
    `--yes` is consent to the import you described, not to replacing a rule you wrote.
    Declining continues the rest of the import. An imported item's `valid_from` is
    re-stamped and any ticked step is unticked, both counted; an item carrying
    `valid_until` refuses the whole import, because importing it would turn a claim that
    has expired into one that has not.
  - **A stranger's history is quarantined twice over.** It is filed under
    `.audit/imported/<pack>/`, which the live audit enumerator never lists — not filtered
    out, never named — and every line carries a protocol that is not in the accepted set,
    so a reader that somehow reached it would refuse rather than merge. Rows this build
    cannot validate go to `.audit/imported/unknown/quarantine.jsonl` wrapped verbatim and
    **counted**, and the count is reported at all three surfaces, because a quarantine
    nobody is told about is a silent drop with extra steps.
  - **A pack may name knowledge this build has never heard of, and may not re-describe
    knowledge it has.** A pack's `config.json` projection is merged field-wise into yours,
    never replacing it. `tier` on a category you already have is refused — retiering is
    strictly more power than a `--trust` flag, which this product refuses for the same
    reason. So is `agentEdits` on any name at all, `description` on a known name,
    `enabled` set to anything but `true`, and every top-level key except `categories`:
    `profile` would replace a selection you made, `budgets` is a fact about your machine,
    `watchedDocs` would watch globs you never wrote.
  - **`mycontext init --pack <path>`** creates a workspace *from* an artefact. The pack is
    read and planned before anything is created, so a refused pack leaves nothing behind;
    a failure after creation removes the tree and says which of the two happened. It takes
    no confirmation and that is recorded rather than inferred — there is no corpus yet to
    protect, and every item still lands `draft`.
  - **`mycontext review promote --all --pack <name> [--yes]`** promotes one pack's drafts
    in a single human act, taken after the corpus is visible rather than before — which is
    why there is deliberately no `--promote-all` on the import itself. A forty-item pack
    makes a forty-item review queue on an empty project, and a queue that size is
    bulk-approved unread, which is a worse outcome than no gate. It refuses `--all` without
    `--pack`, an id beside `--all`, and `--scope`/`--severity`/`--always` beside it, which
    would be a bulk edit wearing a promotion's clothes. The preview prints before the
    confirmation on every path, `--yes` included.
  - **`mycontext pack list`** shows what has been imported here, from the import records
    themselves, with the quarantine total across packs.

  **None of this changes anything for a user who never runs it.** `.audit/imported/` is
  created only by an import, and nothing under `src/pack/` is reachable except through the
  commands named above.

- **`mycontext ui` — a read-only HTTP surface over the corpus, on `127.0.0.1`, behind a
  token. The API is complete; the page it opens is not built yet, and that is the honest
  headline.** Thirty registered read routes — twenty-nine JSON and one server-sent event
  stream — answer questions this tool could previously answer only one command at a time:
  what the hook would select and render for a given file, session and event; the same
  selection under budgets you have not committed to; what a candidate `config.json` would
  do to *this* corpus before you write it; which items govern each path; the ego graph
  around one item; the review and revision queues with their diffs; the sessions this
  workspace has had and what each was actually delivered; a live tail of the audit log;
  and the spill records, which are the only place anywhere that answers *why didn't Claude
  see this item*.

  **The security is the interesting part, and it is worth knowing exactly what it does.**
  The listener binds `127.0.0.1` and refuses to *start* on anything else rather than
  warning. The default port is 0 — the OS picks a free one — because a port silently
  chosen for you is a server you cannot find twice; `--port` with no value is refused for
  the same reason. Every `/api` route requires an `x-mycontext-token` header compared in
  constant time; the header itself is the CSRF defence, since a cross-origin form cannot
  set one and there are deliberately no CORS headers. The token never touches a command
  line. What does is a one-shot nonce in the URL *fragment*, which browsers never transmit,
  and it expires in ten seconds when it rides a command line (on Windows that line is
  readable by every local account for the lifetime of the spawn) against ten minutes when
  it is only printed. `Host` and `Origin` are checked — `localhost` is refused rather than
  aliased — and a refusal sends a status and an empty body, because nothing can render what
  is never sent. CSP is `default-src 'none'` with `frame-ancestors 'none'`, which is the
  framing half of the same DNS-rebinding defence, and it matters because item bodies are
  authored by agents and by ingest and the page renders them. The server exits by itself
  after fifteen idle minutes, where an open stream is not activity.

  **It writes exactly one thing, and the bound is structural rather than promised.** A
  refusal appends one audit record — the check that fired, the status, the method, the
  path (never the query string), and the `Host` and `Origin` as submitted, capped and
  never echoed back. `recordRefusal` will not accept a record that does not describe a
  refusal, so a later call site could not move it onto the success path without first
  inventing a refusal status. Everything else is read-only in two independently checked
  senses: an import-graph proof that the *only* write symbol any module under `src/ui/`
  binds is that one, asserted as an equality so deleting it fails too; and a real
  spawned-server sweep of every registered route that re-hashes every file under
  `.my_context/` afterwards — `.audit/` deliberately included, since a served read writing
  an audit record is exactly what that assertion exists to catch — and separately asserts
  the SQLite WAL is empty, because a write that ended up in frames would slip past a
  content hash. The one non-obvious truth: opening a WAL database read-only *creates*
  `.index.db-wal` and `.index.db-shm`. No corpus byte moves, but two files appear.

  **Three limits, recorded here rather than discovered.** First: `src/ui/public/index.html`
  is a four-line shell with an empty `<body>` and no client script, so today
  `mycontext ui` opens a browser onto a blank page in front of a working API. The screens
  those routes were built for live in `docs/design/web-ui-mockup.html`, which is the
  design of record and not a running application. Second: the command holds the terminal
  until the idle exit or Ctrl-C, and it is the first use of `child_process` in shipped
  `src/` — zero runtime dependencies is intact, "zero moving parts" is not. Third: a
  `ui.enabled` key now exists in `config.json` and is validated strictly — a misspelled key
  or a non-boolean value refuses the whole file, because a permission that fails towards
  "permitted" in silence is not a permission — **but nothing reads it yet.**
  `{"ui": {"enabled": false}}` loads, and `mycontext ui` still starts. That is a gap, and
  it is named here so it is not found by someone relying on it.

- **`procedure`, `todo` and `note` — three categories, and the two commands that work
  them.** The catalogue is twenty-four now; `minimal` is unchanged and enables none of the
  three.

  **`procedure` is the one-shot sibling of `runbook`, and the pair is the point.** A
  runbook is performed again every time its operation comes up and governs for as long as
  the operation exists. A procedure — a migration, a data fix, a one-time correction — is
  performed once and then finished, which is why it is the one that carries a lifecycle
  and stops being injected when it is done. The test an author applies is the same sentence
  everywhere it is asked: will you do this again next time the situation arises?
  `mycontext procedure list|show|activate|done|step <id> [<n>] [--undo]` walks it, grouped
  by stage. **Progress is recorded in the audit log, never in the item** — the Markdown on
  disk still reads `- [ ]` on every step, which matters if you quote a tick — and it is
  per workspace, so two terminals share one record set. `list`, `show` and `step` cross no
  trust boundary and take no write lock; `activate` and `done` claim `origin: "human"` and
  are `--yes`-gated, because a procedure left active forever is a real failure and a
  procedure retired because a model decided it looked finished is the other one.

  **`todo` and `note` are the inbox, and their tier is the feature.** Both are `rationale`,
  which means the selector never admits them to a full-text tier and the index reduces them
  to a bare count — so twenty unbuilt things do not arrive in every session as twenty
  things the model is told to care about and cannot act on. It also means an agent's
  capture is *not* forced to `draft`: a todo asserts nothing, and draft-gating the one
  operation that must have no friction would defeat the reason it exists.
  `mycontext todo [--tag] [--all]` lists them, hiding retired ones and counting them, and
  says in its own output that it is not the review queue. `mycontext inbox-promote <id>
  --to <category> [--title] [--yes]` turns one into a real item with the link back
  recorded.

- **`## Steps` is a first-class item field, and no existing item's checksum moved.**
  `mycontext add procedure "…" --step "…" --step "…"` takes them one at a time in
  command-line order, never comma-split, because a step is a sentence; `create_item` takes
  a `steps` array. They round-trip through the Markdown and are covered by the content
  hash, so two procedures differing only in their steps no longer dedupe onto each other.
  **The recorded frontmatter `checksum` adds the key only when there are steps.** That
  condition is load-bearing and it is the compatibility guarantee: a stepless item hashes
  byte-identically to how it hashed before this field existed, by construction, so nothing
  in any existing corpus reports drift and the stale-checksum signal — the only evidence
  a file was edited outside this tool — survives. An injected procedure carries its steps
  and the budget is charged for them. **The limit, stated:** steps cannot be edited or
  ticked afterwards through any command; correcting one means editing the Markdown and
  running `mycontext repair`.

- **A subagent now receives this project's pinned items and its index — `SubagentStart`
  is registered, and the block says where it came from.** `1.0.2`'s changelog closed on
  *"Nothing is built on it"*; this is what was built. The hook is registered with no
  matcher, because a matcher would silently exclude some dispatches from the only knowledge
  they get, and it delivers the same selection a session start does: the pinned tier in
  full plus the index. It is framed by a preamble saying the block was added by this
  plugin before the subagent's first turn, that it is not part of the message that
  dispatched it, that the items are Markdown files it can read itself, and that nothing
  there governs on an agent's say-so. That frame exists because a real subagent reported
  an unframed block to its parent as a possible out-of-band attack. The preamble is not
  charged to the token total.

  **What it costs, and how the cost is bounded.** `SubagentStart` *blocks* the dispatch it
  fires for — a 3,018 ms hook was measured delaying the subagent's first tool call until it
  returned — and nothing in-process can cut short synchronous work, so the only bound is
  the `timeout` in `hooks.json`, set to **5 seconds**. Measured end to end, a 500-item
  corpus returns in 338–413 ms across eight consecutive runs, an order of magnitude inside
  that; in-process it is cheaper than `SessionStart` on the same corpus at the same moment,
  which is what skipping the index refresh predicts. The bound is paid for in disclosure:
  the attempt record is written **before** the work, so a kill leaves one
  `delivery=attempted agent=<id>` row with no matching `delivery=complete` rather than
  leaving nothing at all. Both rows carry the parent's session id, so
  `mycontext audit --session <parent>` shows the pair.

  **What a subagent does not get.** No compaction restore and no `source` — a
  `SubagentStart` payload carries neither. Its dedupe state is keyed on `session::agent`,
  never the parent's, so it can never suppress the parent's own just-in-time tier. It does
  not carry from its own parent. A payload with no `agent_id` injects nothing and records
  nothing, and says so on stderr. `SessionStart` still does not fire for a subagent; what
  changed is that the gap has a hook of its own now.

- **`PostToolUseFailure` is registered, so a failed tool call is counted.** One audit row
  per failure, carrying the tool name and — when the payload holds one — a capped reason.
  **Never the tool input**, which is on no list and must never join one. Nothing is
  injected and nothing reaches the model; counting is the whole feature, because a hook
  that swallows a failure cannot say how often it swallowed one. Read it with
  `mycontext audit --op post-tool-use-failure`. **Honest caveat:** no probe has established
  that Claude Code fires this event at all, or what its payload calls the failure reason.
  If it never fires, nothing is written and nothing breaks. `PostToolUse`'s timeout also
  drops from 10 s to 5 s, matching what it actually does.

- **`mycontext session list` and `mycontext session name <session-id> <name>` — the
  sessions this workspace has had, and a handle you can type.** `list` prints the session
  id, its short prefix, its name, its activity and whether anything is left to carry.
  `name` takes an **explicit** session id and never guesses which session you are in,
  because the CLI is handed none: picking one would attach a name to a session you did not
  mean and report success, and nothing in the output would let you notice. Names are
  refused rather than normalised — empty, over 64 characters, any control character, or a
  duplicate of another session's name — because a name that is nearly what you asked for is
  worse than a refusal: you will type the one you meant and it will not match. The store is
  `.my_context/state/session-names.json`, workspace-scoped, gitignored on every write, and
  deliberately **not** swept by the 30-day prune that clears the rest of `state/`; names
  outlive the sessions they describe on purpose. A name becomes the label inside the carry
  disclosure below.

- **`categories.<name>.extraFields` in `config.json`: a category can now declare its own
  category-specific frontmatter fields.** A custom category could carry none at all — the
  resolved list was hardcoded empty with no key to set it — so a project category could not
  name the fields its items actually use. It can now, and a built-in can be given more:

  ```json
  { "categories": { "security_control": { "tier": "normative", "description": "…", "extraFields": ["control_id"] } } }
  ```

  **On a built-in the list EXTENDS the catalogue rather than replacing it.**
  `{ "rule": { "extraFields": ["owner"] } }` resolves to `directive` *and* `owner`, and there
  is no config spelling that removes `directive` — it is part of what `rule` means, not a
  preference. That is the opposite of `watchedDocs`, deliberately: there the hazard is
  silently gaining globs you never wrote, and here it is silently losing a field your items
  already carry. Under replace, adding `owner` to `rule` would drop `directive` and every
  existing rule item carrying it would then be refused by the validation in `Changed` below
  — the change would break the corpus it exists to protect.

  Each declared name must be one frontmatter can hold, checked by the same function an
  item's `extra` keys go through, when the config loads rather than at the first capture that
  tries to use it. This key was previously refused **by name**, and the reason it gave —
  that nothing validated a field against the item's own category — is what the `Changed`
  entry on undeclared `extra` fields answers. The two shipped in one commit for exactly
  that reason: validation alone would have refused every item a custom category was already
  using these fields for.

- **Three more `mycontext help` topics — `cli`, `tools` and `slash` — and the MCP tool now
  serves the ones it can render.** `cli` is the command surface, `tools` the MCP surface,
  `slash` the committed slash commands; each is generated from the thing it describes
  rather than written beside it. `mycontext_help` advertised four topics because its enum
  was the only one on that surface written by hand instead of derived; it now advertises
  six. `cli` stays withheld there and that is correct rather than an omission — its command
  list is built from a registry the CLI fills by side effect, so in an MCP server process
  the topic would come back complete-looking and empty, and it refuses to render rather
  than do that.

- **Smaller surfaces, each one flag or one command:** `mycontext add --extra key=value`,
  sharing `edit`'s parser and its error text, so a mistyped `--extra` on `add` gets the
  sentence it would have got on `edit`; `mycontext lesson --agent`, which records a lesson
  as `origin: agent` — allowed because a lesson is rationale tier and governs nothing, and
  refused on `lesson-accept`, which creates an active rule and is the approval gate itself;
  and a generic `/mycontext:add <category> …`, which is how a category defined in your
  `config.json` or enabled by a pack is reachable at all, since every other capture command
  carries its category in its own generated name.

- **Three more checks in the gate, and the reason each exists is a defect that got
  through.** `npm run check:text-files` refuses a source file git would classify as binary:
  a raw NUL byte inside a string fixture happened twice, in two files, by two hands, and it
  costs the whole file's diff and makes a merge conflict in it unresolvable. The first
  instance was found only by reading a diff *stat*, because the diff itself could not be
  rendered. `npm run check:retired` enforces the
  half of a correction that is invisible: a plan whose §0 records what is no longer true,
  while four passages downstream still say the old thing. `npm run test:e2e` is a
  Playwright suite over the web-UI mockup, kept in `e2e/` rather than `test/` so
  `node --test`'s glob and `check:test-glob` stay honest about each other. It needs
  `npm run test:e2e:install` first — `@playwright/test` declares no install hook, so
  `npm ci` fetches the package and not the ~275 MB of browser binaries — and it runs with
  `retries: 0`, because a browser test that passes on the second attempt has told you
  something and burying it is how a flake becomes permanent.

- **The web UI's visual direction, decided and drawn.** Four competing directions were
  built and argued against, one was chosen, and `docs/design/web-ui-mockup.html` is now the
  design of record for twenty-one screens in dark glass, with typography (Geist for Latin,
  IBM Plex Sans Hebrew for Hebrew, all vendored), a six-glyph icon set, a motion pass gated
  behind `prefers-reduced-motion`, and English and Hebrew string tables whose parity is
  enforced in both directions across three attributes — `data-t`, `data-t-aria` and
  `data-t-title`, the last two having previously stayed English in the Hebrew UI. **None of
  this changes the program**; it is recorded here because the tag points at a tree
  containing it, and because it is what the `mycontext ui` entry above means when it says
  the API has no page yet.

### Changed

- **A new session now carries the previous session's index lines forward, and this is on
  before you configure anything.** This is the change most likely to be noticed by someone
  who upgrades and changes nothing else. At every session start, the ids the most recent
  *other* session actually had delivered to it are hoisted to the front of the index and
  marked ` · carried`. There is no new budget: they are costed inside `budgets.index`
  (default 1200), marker included, and because they sit at the front they can push some of
  this session's own lines out.

  **What you see, and why each clause is there.** One italic line above the index says how
  many were carried and from which session — by its name if you have given it one, its
  eight-character prefix if not, and never an invented description like "the session from
  Tuesday", because that string goes into a block whose reader cannot check it. If any
  carried id got no line, every one is named with the reason: delivered in full this
  session, unknown id, not a normative category, no longer eligible, hidden by the active
  focus, or over the index budget. If any of this session's own lines were displaced, they
  are named too — this is the only place a reader learns of it, because an index-only spill
  is not otherwise rendered. The disclosure sits outside `budgets.index` and outside the
  token total, because a disclosure a budget could drop is not a disclosure.

  **The cost, named rather than left to be found.** The ids come from the source session's
  seen file, which records deliveries, so **an item that session only ever saw as an index
  line is not carried** — what travels is what it actually had in context, which is the
  stronger evidence anyway. And `state/` is swept at 30 days while the audit log still
  names the session, so a session this tool can list can have nothing left to carry;
  `session list`'s `carryable` column says which.

  **Turning it off is `mycontext session carry --none`**, and it is honoured as an explicit
  answer rather than an absence — a user who turned the carry off and got the default back
  would have no way to turn it off at all. `mycontext session carry <session-id>` picks a
  specific source and refuses an id with nothing to carry rather than storing one that
  silently delivers nothing; `--show` reads back the current answer and says whether it is
  the default or your choice. The setting lives in `.my_context/state/continuity.json`, not
  in `config.json`. It applies at session start and at a subagent's start, never on a
  compaction restore and never on a manual load.

- **The audit log is `my_context/audit@2`, and the step is one-way.** Three vocabulary
  widenings land in one bump rather than three: a `progress` kind for procedure step
  records, an `access` kind for the web UI's refusals, and the `subagent-start` and
  `post-tool-use-failure` ops. **Upgrading costs nothing** — the read set accepts `@1` and
  `@2`, checked per line, so an existing log reads unchanged and a live file that gains
  `@2` lines after `@1` ones reads cleanly. Widening the read set was not optional:
  bumping without it would have made this build refuse every log a current user already
  has, on the first command after the upgrade, which is a failure that lands on upgrade
  rather than on downgrade.

  **Downgrading does cost something, and it is not silent.** Once any `2.0` command has
  written one row, a `1.0.2` build refuses the whole log — not one segment, the whole read
  — saying the line declares a protocol it did not expect and that a skipped line could be
  the record of a mutation. On that build `mycontext audit`, the ledger replay, `doctor`'s
  audit checks and the `audit_log` tool all fail until the segment is moved aside
  (`mycontext audit --files` names them). Nothing is lost and nothing is corrupted; the old
  build simply cannot read a log newer than itself, and it says exactly that rather than
  blaming a vocabulary for a version difference.

- **An unknown *top-level* key in `config.json` is skipped and disclosed rather than
  refusing the file — reversing what `1.0.0` recorded as breaking.** That decision closed a
  real hole (`"budget"` for `"budgets"`: the file loaded, every limit stayed at its default,
  and the only symptom was items quietly missing from sessions), and the hole stays closed
  — the key is still not silently dropped. What changed is the verdict for a name that is
  not on the list, and only at that one level: the key is carried as data, the rest of the
  config loads, and the surface that has somewhere to print a sentence to a human prints
  one naming the key and the accepted set. The reason is that a config may legitimately
  come from a newer build, and refusing the whole file over a key from the future is a
  worse failure than skipping it loudly. **This is carried rather than printed at the point
  of refusal deliberately**: a hook's stdout *is* the model's context and the MCP server's
  stdout is JSON-RPC framing a stray byte corrupts, so the module that finds the key cannot
  pick a channel and does not try. The consequence is a duty — a surface that shows config
  to a human and does not print the notice has re-created the silent drop.

  **Inside a known block the old verdict stands, and the boundary is deliberate.**
  `{"ui": {"enabld": false}}` and `{"ui": {"enabled": "false"}}` both refuse the file,
  because both are a user trying to switch something off and, under any lenient reading,
  left with it on while believing otherwise. Budgets and categories are unchanged.

- **An `extra` field is now refused on a category that does not declare it.** `directive` is
  a `rule` field and `likelihood`/`impact` are `risk` fields, but nothing enforced that:
  `create_item`'s schema is the union of what every category declares, and no check narrowed
  it to the item's own category, so `directive` — the field that decides whether a rule
  prohibits or prescribes — was accepted on a `risk`, stored, and read by nothing.

  ```text
  my_context: extra field "directive" is not declared by "risk" … A "risk" declares: likelihood, impact. "directive" is declared by rule.
  ```

  **What changes in practice, and who has to do anything.** Almost nobody: a survey of all
  118 items in this machine's two corpora found the shipped categories clean — `rule` uses
  only `directive`, `requirement` only `kind` — so no existing built-in-category item is
  affected. What was affected was every item of a *custom* category, which could declare
  nothing; that is why `extraFields` in `Added` landed in the same commit. If a capture is
  now refused, the message names the offending key, the category, what that category does
  declare, which category does declare the key, and the config line that would declare it
  here. Items already on disk are untouched and keep rendering: the rule refuses a new
  assertion, it does not strand an item behind a field it already carries. **This is the
  one entry in this release that can require you to edit your `config.json` before a
  capture that worked yesterday works again**, which is why it is recorded with the
  migration in full rather than left to a version number.

  The reserved-frontmatter-key refusal still comes **first** — `--extra status=x` fails
  because it would overwrite a real field on disk, not because `status` is undeclared, whose
  remedy would be to declare it and cannot work. The ingest pipeline's own `content_hash`
  and `ingest_key` are exempt by name: they are provenance the product writes and reads on
  every category, and declaring them would advertise the dedupe key to every model.

  `create_item`'s schema still advertises the union — it must stay byte-identical across
  calls for prompt caching — so every extra field's description now says which categories it
  is for and that it is refused elsewhere, rather than "Typically". One consequence follows
  from the same fixity: a field you declare in config works through `mycontext add --extra`,
  `mycontext edit --extra`, `update_item` and ingest, but is not among `create_item`'s flat
  arguments and is refused there by name.

- **`SessionStart` sweeps stale files out of `state/` after it has written its output.**
  `state/` gains a file per session — and, with `SubagentStart`, one per subagent — while
  `rebuild` was its only sweeper, so a project whose corpus is stable never rebuilt and
  therefore never pruned. A survey measured 15 files one day and 47 the next. Snapshots,
  seen files and temporary files older than 30 days now go; session names and the carry
  choice do not. The sweep runs *after* the injection is written, so it cannot delay the
  thing it follows, and it says on stderr when dedupe state went — a resumed idle session
  will re-receive items it already saw, which is a duplicate and never a miss. A session
  started from a cleared window now clears that window's dedupe state and its restore
  snapshot first, and says in the injected block what it cleared; running it afterwards
  would have handed the rest of the session the delivery state of a window that no longer
  exists.

### Fixed

- **A search matched an item's title and body and nothing else, so a phrase recorded in an
  observation was unfindable.** `mycontext search "silently drop"` returned nothing while
  this project's own corpus held exactly that phrase — inside an `## Observations` section,
  which the predicate never looked at. The miss was read as evidence that substring matching
  was too literal and nearly bought a full-text index; an index over title and body would
  have reproduced it exactly, because the cause was field coverage rather than matching.
  An item's `extra` values sat outside the predicate for the same reason and are now inside
  it: a custom category's distinguishing field is precisely what you would search for.

  **Recorded as `Fixed` rather than `Changed`, and the call is arguable.** What the flag is
  called did not change and no filter was added; a selector was dropping items that matched
  the question asked of it, which is `VERSIONING.md`'s `PATCH` and specifically the class its
  "honest edge" paragraph names — *"fixing a selector that silently dropped an eligible
  item"* — and that paragraph is the one that requires an entry here rather than a version
  number. The argument for `Changed` is that both READMEs described `--text` as *"a
  case-insensitive substring of the title or body"*, so the documented surface did move. It
  moved because it was narrower than the program's own intent; that sentence is corrected in
  both languages rather than defended.

  **What changes in practice.** A search that returned nothing may now return results, and
  one that returned three rows may return five. Nothing that matched before stops matching —
  the filter only widened — and there is **no ranking**: the recorded decision against
  relevance scoring at the top of `src/core/search.ts` is untouched, because widening what is
  matched is not ordering what matched. One predicate serves both surfaces, so
  `mycontext search`, `query_items` and `/mycontext:search` moved together, and `search` still
  works through the Markdown fallback, where an index-backed search could not.

- **A hook payload that could not be read injected a normal-looking block and lost three
  things silently.** `parseHookInput` swallowed every stdin failure into `{}`, and the
  session-start hook fell back to the process working directory — usually the right one, so
  the workspace resolved, the corpus loaded and the pinned tier injected exactly as it
  should. What vanished with the payload was `source` and `session_id`: `source=compact`
  never arrived, so a compaction restored nothing; `session_id` never arrived, so the
  just-in-time tier delivered nothing for the rest of the session and `PreCompact` wrote no
  snapshot. Three symptoms, one invisible cause, and the injected block that would have named
  it was the part that looked most convincing — it cost a full diagnostic pass that concluded
  the selection logic was at fault.

  **What changes in practice.** All three hooks now write one line to stderr naming what was
  lost and what will not fire, and the session-start hook discloses inside the injected block
  as well, next to the note it already carries when a focus cannot be read — so the model
  reading that block knows the session is missing features it cannot otherwise see are
  missing. **Empty stdin stays silent.** That is an interactive run with no payload at all:
  nothing was malformed and nothing was lost, and a fix that made every interactive run noisy
  would be a worse defect than the silence it replaced. `INV-hooks-fail-open` is untouched —
  a garbage payload still injects, it just says so.

- **Every hook invocation printed a Node `ExperimentalWarning` to stderr, on a channel Claude
  Code shows you.** *"SQLite is an experimental feature and might change at any time"*, on
  every session start, every file-touching tool call and every MCP server start, in
  production — a hook telling you something is wrong when nothing was. `hooks.json` and
  `.mcp.json` now pass `--disable-warning=ExperimentalWarning`, and deliberately no wider than
  that: the one warning class, on the entry points that emit it, so a deprecation this project
  would want to see still arrives.

  **What changes in practice.** A valid hook run now writes **0 bytes** to stderr. That is
  worth more than quiet, and it is why this belongs beside the entry above rather than after
  it: a disclosure written to an already-noisy channel is invisible. It also returned eleven
  tests to green — nine hook, two MCP, all of them asserting a clean stderr. Widening those
  assertions to tolerate the warning was tried and reverted, because the assertion was right
  and loosening it would have discarded the only thing that had noticed.

- **`mycontext lesson` accepted any flag you gave it and acted as though you had given
  none.** It was the one command still reading its positionals without asking what the
  rest of the line was, so `mycontext lesson "…" --anything` recorded the lesson and said
  nothing about the flag. It now refuses an unrecognised flag by name, like every other
  command. **What changes in practice:** a script that passed a flag this command never
  read now gets a refusal and exit 1 instead of a silent success — correct, and still a
  surprise on a Tuesday, which is the class `VERSIONING.md`'s "honest edge" paragraph
  requires be named here rather than left to a version number. The flag that prompted it,
  `--agent`, is now real and is in `Added`.

- **The one document this plugin loads into every session named eight commands on a
  boundary that had more.** `skills/mycontext/SKILL.md`'s two lists of what a model must
  never run on your behalf were hand-kept and stale. Two members were missing that were
  reachable in `1.0.0`, `1.0.1` and `1.0.2` — `refresh` and `review discard-revision` —
  and both were already on the deny block both READMEs recommend, so `commands/refresh.md`
  was telling the same model that `refresh` is on that list while the skill was not. The
  test that looked like protection pinned the sentence as a literal regex written when it
  named eight, and went on passing while the real boundary grew underneath it, on the one
  surface a model acts from. Both lists are now computed from the real argument parser —
  which commands actually accept `--yes` — by one shared derivation that the READMEs' §7
  count, table and deny block are checked against too, and they resolve to ten commands
  now that `inbox-promote` is one of them. Two derivations of one boundary would have
  drifted exactly as the two prose lists did.

- **Both READMEs said no hook fires at a subagent's birth. `SubagentStart` fires.** Section 8
  ended on *"There is no hook that fires at a subagent's birth for my_context to answer"* —
  true when it was measured, and false by the time you read it in `1.0.2`. Re-measured against
  Claude Code **2.1.234** by the method the sentence itself invokes, a probe hook under a real
  `claude -p` run whose prompt dispatched a subagent: `SubagentStart` fires, and its
  `agent_id` is identical to the one the subagent's own `PreToolUse` payload carries, so the
  two join. Corrected in both languages, in place and dated. The section's own claim is
  unchanged and still true — `SessionStart` still does not fire for a subagent, so a subagent
  still does not receive the session-start injection. What moved is that the gap now has a
  known shape rather than being a property of the platform — and it is built on: see the
  `SubagentStart` entry in `Added`.

## [1.0.2] - 2026-08-19

Three changes to the program and a body of documentation work. Every entry is `PATCH` under
[`VERSIONING.md`](VERSIONING.md) — the program is made to do what it already said it did —
but **two of them change what you will see, and one can refuse a file that loads today.**
Both are named under `Fixed` with what changes in practice, because a version number cannot
carry that.

### Added

- **A release is now produced by the tag, and its notes come from this file.**
  `.github/workflows/release.yml` fires on `v*`, runs the full matrix plus
  `verify:citations`, and only then creates the GitHub release. Two guards it will not
  publish without: the tag and `package.json` must agree — skipping
  `scripts/set-version.ts` is the release step that otherwise fails *quietly*, leaving
  `mycontext status` reporting a version that was never released — and the changelog must
  actually have a section for the tag. `scripts/changelog-section.ts` extracts it, so the
  release page and this file are the same words rather than two descriptions that drift.
  `ci.yml` no longer fires on tags; `release.yml` owns that ref, and listing it twice was
  the duplicate-run defect one ref further along.

- **`npm run check:test-glob`, which makes a green suite mean the whole suite.**
  `RULE-quote-the-test-glob` records the measurement: unquoted, the test glob runs through
  `sh` on Linux and expands `**` as `*` without globstar — **2 of 4 files executed, exit
  code 0.** On this repository the same failure would run **3 of 147**. Nothing in the
  output says files were skipped, because from the runner's view they were never named. The
  check asserts the glob is double-quoted (the actual control) and that it reaches every
  `*.test.ts` under `test/` (the corroboration), and both workflows run it **before**
  `npm test` — a check that runs afterwards tells you the suite you already trusted was
  wrong.

- **`npm run verify:citations`, so a documentation citation cannot go stale in silence.**
  The three web-UI plans were written on branches whose base commits are not ancestors of
  `master`, and 186 `file:line` citations drifted with them — the first two sampled were off
  by 136 and 42 lines, landing mid-comment in unrelated code. The citation form is now
  `file` · a **verbatim source fragment** · a `~line` hint: the fragment is the identity, so
  code that merely moves updates the hint under `--fix`, and code that is deleted or
  rewritten turns the citation red. That is the failure worth surfacing, and the one a line
  number cannot tell apart from a harmless shift. 189 citations across 22 documents resolve.

- **The v2.0 web-UI corpus, re-verified and amended.** Ten specialist reviews, seven owner
  decisions recorded in `2026-08-18-v2-decisions.md`, a fifth amendment pass on the design
  spec, all three plans re-verified against `master`, and a regenerated mockup. Six of the
  plans' "verified facts" were false rather than merely stale — among them the row naming
  the eight mutating functions, which is the input to the test that enforces the web UI's
  no-writes guarantee. None of this changes the program; it is recorded here because the
  tag points at a tree containing it.
- **Two guides under `docs/`, for the two audiences the READMEs serve less well.**
  [`TUTORIAL.md`](docs/TUTORIAL.md) is the first twenty minutes: install, initialise,
  capture one constraint, then add two more so the difference is visible — ending on what a
  new session actually opens with, the trust boundary, the five commands you will really
  use, and three habits. [`TUTORIAL-ADVANCED.md`](docs/TUTORIAL-ADVANCED.md) is fourteen
  sections for someone already running it: the four injection tiers, scope and the
  `scopePolicy` that inverts it, focus, budgets and what happens when they bind,
  configuration, ingest, incident-to-rule, revisions and the review queue, the audit log,
  decay, integrity, the trust boundary precisely, the MCP surface, and a worked
  configuration. Both READMEs point at them.

  **Neither is generated, so neither is pinned by the four documentation drift tests.**
  Every example block in the READMEs is regenerated by `npm run gen:docs` and diffed, which
  is why those documents survived thirty-three corrected contradictions in `1.0.1`. These
  two files have no such net and can go stale silently. That is a known gap, recorded here
  rather than discovered later.

- **Plan 4's pre-flight ledger, which existed in no commit.** `.gitignore` excludes
  `.superpowers/`, so an SDD ledger lives only on disk inside its plan's worktree; this one
  was found in a second worktree with forty-one worktrees live, one `git worktree prune`
  away from being lost. It is not a copy of the execution ledger already tracked beside it:
  that one records sixteen tasks being carried out, this one records the scan that ran
  **before Task 1** and concluded the plan could not be executed as written — eleven
  rulings, five blockers, each with its cost-if-wrong. `docs/superpowers/ledgers/README.md`
  gains a row saying which is which, so the shorter file is not mistaken for a duplicate and
  deleted.

### Changed
- **A glob is compiled once, not once per path examined.** `matchesAnyGlob` — what
  `matchesScope` runs on, and therefore what answers "does this item govern this path" — 
  recompiled a fresh `RegExp` for every question. The access shape is many subjects against
  few patterns, so the cost was `O(files × patterns)` compilations for an answer needing
  `O(patterns)`.

  Measured on a monorepo-shaped input, 4,000 paths against 12 authored scope globs, median of
  12 runs: **28.0 ms → ~2.7 ms**. `mycontext doctor` benefits today; the v2.0 coverage map is
  why it was measured. No behaviour changes — a test pins that the cached `RegExp` carries no
  `g`/`y` flag, so it holds no per-call state, and that the sweep returns the same answers.

### Fixed
- **An id read from disk was never checked against the id grammar, and reached commands this
  tool invites you to paste into your shell.** `validateExplicitId` has always guarded the
  path that *mints* an id — the surface that turns one into a filename — and its own comment
  states the principle: insurance *"taken at the boundary rather than at whichever future
  call site first does it"*. The boundary ids **arrive** on was never guarded. `parseItem`
  took `id` from frontmatter verbatim.

  **Demonstrated, not inferred.** A file written straight into `.my_context/items/` — the
  shell-redirect route `README.md` §7 documents as open to an agent — carrying
  `id: DEC-$(echo PWNED)` and **no `checksum:` field at all** loaded with no error. The
  checksum field is not a barrier here: it only catches files this tool wrote and something
  later edited. That id then reached roughly fifteen sites that interpolate it into a
  command, and `mycontext supersede` printed

  ```
  promote it with `mycontext review promote DEC-$(echo SUBSTITUTED)`
  ```

  The substitution runs in **your own interactive shell**, where none of the fourteen deny
  rules apply — those govern an agent's Bash tool, not your terminal.

  **What changes in practice.** An item whose id falls outside
  `[A-Za-z0-9][A-Za-z0-9._-]*`, or contains `..`, **now fails to load**, naming its file and
  saying why; the rest of the corpus loads around it, and the file is not modified. If you
  have such an item today it will disappear from queries and injection until you rename the
  id in the file. That is correct and it is still a surprise on a Tuesday, which is what the
  "honest edge" paragraph in `VERSIONING.md` exists for.

  **What does not change.** The grammar accepts uppercase, `_` and `.`, so hand-authored or
  older ids — `UPPER_CASE_ID`, `has.dots.in.it` — still load. It rejects `$`, backticks,
  spaces, parentheses, path separators and `..`. A test asserts that the read boundary and
  the mint boundary accept **exactly the same set**, over 38 candidate ids: a read check that
  refused an id `createItem` mints would make this tool write files it can never load again.

- **`mycontext audit` recorded five degradation disclosures and rendered none of them.** A
  record carrying a `note` now ends `— note`, with a legend printed under the table when any
  row is marked. Among the notes that were being written and shown nowhere a person reads:
  *"N item file(s) dropped by the fallback"* — which is `INV-nothing-is-dropped-silently`'s
  own case, disclosed into a log and then dropped silently on the way out.

  The note itself is not appended to the table. Three real note shapes push the table's floor
  to 113–123 columns against a 100-column budget, past the point where `table()` stops
  narrowing, so the terminal would rewrap and the table would become unreadable.
  `mycontext audit --json` prints notes in full.

- **The changelog's own "no regression" claim had outlived its scope.** This document's
  intro said, of every `Fixed` and `Security` entry below it, that none "describes a
  regression any user experienced". That was true while `0.9.0` was the only tag — those
  were development defects closed before anything was released — and it stopped being true
  at `1.0.0` without anything saying so. The claim is now scoped to the `0.9.0` section, and
  the consequence is stated where a reader meets it: from `1.0.0` onward a `Fixed` entry
  describes a defect that was in a tagged release, so it may be one you actually hit. The
  two in `1.0.1` are named rather than left to be worked out — the MCP server reporting
  `0.1.0` to every client through both tagged releases, and `mycontext audit --role`
  accepting a filter it then ignored. Left alone, that sentence would have told every future
  reader that nothing in this file could ever have affected them.

## [1.0.1] - 2026-08-18

A documentation-accuracy release. Every entry below is `PATCH` under
[`VERSIONING.md`](VERSIONING.md): the program is made to do what it already said it did, and
the documentation is made to say what the program already does. No corpus, config key,
category, tier, command, flag or tool changed meaning.

Found by an exhaustive external test campaign against `1.0.0` — 419 recorded runs across
eight surfaces, a 22-check live pass inside Claude Code, and a line-by-line audit of all
4,625 README lines producing 716 checkable claims.

### Added

Recorded after the fact, on 2026-08-18. Both commits landed on `master` before the tag and
so are inside this release, but neither was described here when it closed — the section was
written around the test campaign and these came in beside it. They are a different kind of
change from everything else in `1.0.1`: the intro's "the documentation is made to say what
the program already does" covers the `Fixed` entries below, and does not cover a design for
something that is not built.

- **The design artifacts that lived only on feature branches.** Eight documents, and the
  first two matter most because they are the record of work that shipped **in this release
  line**: [`2026-08-16-never-miss-an-injection-design.md`](docs/superpowers/specs/2026-08-16-never-miss-an-injection-design.md)
  and its [fourteen-task plan](docs/superpowers/plans/2026-08-16-never-miss-an-injection.md).
  The code was on `master` from `1.0.0`; the argument for it was not, which left the
  repository holding the change without its reason — including the measurements that ruled
  out three alternative designs, and a `§4.4` durability claim that an adversarial review
  refuted and that is retracted in place.

  The other six are **v2.0, specified and planned but not built**: the local web UI design,
  three implementation plans totalling 47 tasks, the reviewed
  [mockup](docs/design/web-ui-mockup.html), and a
  [companion note](docs/design/web-ui-mockup.md) recording what the mockup is not — the spec
  outranks it, its data is fabricated, and its CSS uses physical properties where the spec
  requires logical ones for the Hebrew mirror.

- **A `docs/ROADMAP.md` row (E22) recording that tagging `1.0.0` changed the price of a
  decision nobody had revisited.** Q4's reasoning for deferring the first tag was that
  "nothing is released, so removing a category costs nobody anything today". Once `1.0.0`
  shipped, that stopped holding: removing the `runbook` category is now a breaking catalogue
  change and a `MAJOR` by this project's own rule. The recommendation is unchanged — keep it
  — but the cost of the other answer moved without a decision being taken, so it is written
  where the decision gets made rather than left to be discovered after it.

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
