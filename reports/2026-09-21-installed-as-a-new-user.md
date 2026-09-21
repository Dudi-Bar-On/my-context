# Installed as a new user — 2026-09-21

**A first-run walk-through of `my_context` `1.0.2` at `62315f0`, done the way a stranger would
do it: the README's own install path, into a brand-new project that had never seen the tool, on
a machine that is not the owner's.** Every command below was run on 2026-09-21; every quoted
line is what the tool printed. Companion to `reports/2026-09-21-external-status-review.md`,
which reads the repository; this one uses the product.

Nothing in this repository was changed by the walk-through. The throwaway projects live in
this session's scratch directory and are gone with it. Two things were installed on this
machine to do it and are named so nobody is surprised: `npm link` from the clone, and
`claude plugin install mycontext@mycontext` at user scope, both exactly as the README says.

---

## 0. Setup

| Step | What the README says | What happened |
|---|---|---|
| Node | `engines: >=24` | The machine has Node 22.22; Node 24.21 was fetched with `npx node@24`. **Every command below ran on 24.** (The CLI and the hooks also ran on 22 without complaint; the `engines` field is not enforced by anything a user meets.) |
| `npm install && npm link` | "provides the `mycontext` command" | Worked. `mycontext` resolved on PATH to a symlink into the npx cache. |
| `claude plugin marketplace add ./` | — | `√ Successfully added marketplace: mycontext (declared in user settings)` |
| `claude plugin install mycontext@mycontext` | — | `√ Successfully installed plugin: mycontext@mycontext (scope: user)` |
| `claude plugin details mycontext@mycontext` | "Skills (N) is the command count plus one" | `Skills (92)`, `Hooks (18)`, `MCP servers (1)`, `Always-on: ~2,238 tok`. 91 commands + 1 skill = 92. **The README's arithmetic is right.** |
| The project | — | A small git repository: `src/api/upload.ts`, `src/billing/price.ts`, `docs/ARCHITECTURE.md`, a `CLAUDE.md`. |
| `mycontext init` | "creates `.my_context/` with `items/`, a `config.json` and a `.gitignore`" | Created `config.json` and `.gitignore`. **No `items/` directory** until the first capture; the README's sentence is one directory ahead of the tool. Harmless. |

`config.json` as written by `init`: `{"profile": "standard", "categories": {}, "budgets": {}}`.
No `watchedDocs`, no `handover`, no `ui`. `mycontext status` on the empty corpus is clean;
`doctor` reports one informational line — `cli_path_unverifiable` — because the `npm link`
symlink the README told me to create is not a shape the check recognises (§4, F9).

---

## 1. Capture — the README's Step 1, followed literally

The four README examples and the tutorial's constraint all landed on the first try, with the
exact output the README shows:

```
about to create constraint "Uploads capped at 10 MB" — active, and governing this project at once.
my_context: created CONST-uploads-capped-at-10-mb (active) at items/constraint/CONST-uploads-capped-at-10-mb.md.
```

A `decision` landed without `--yes`, as documented. A `todo` landed in the inbox. `mycontext
lesson "…"` recorded the lesson and printed a rule-derivation request with a JSON schema and a
callback command — the "you are the extractor" design, and it reads clearly.

**The three mistakes a new user makes, and what the tool said:**

| Mistake | Response | Verdict |
|---|---|---|
| Forgot `--yes` on a normative item | `refusing without confirmation — stdin is not interactive. Rerun with --yes…` | Good. Short, names the fix. |
| Forgot `--summary` | A **150-word** paragraph explaining `summary_stale`, `summary_unanchored`, `mycontext edit`, that "there is no model in this product", and `--summary-omitted`. | Correct, and the right decision to refuse. But this is the first refusal most users will ever see, and it is an essay. The one sentence that matters — *add `--summary "<one plain sentence>"` or pass `--summary-omitted`* — is the last one. |
| Typed a category that does not exist (`bug`) | **The summary essay again**, because the summary gate runs before the category check. Only after supplying a summary did the tool say `"type" must be one of: constraint, invariant, …`. | Wrong order. The category check is cheaper and the user cannot fix a summary for an item that will never exist. |

`mycontext lesson` has no `--summary` flag, so a lesson recorded the documented way is
immediately a `doctor` warning (`summary_absent`) that only `mycontext edit --summary` clears.
The tool files a finding against the item it just created.

---

## 2. Read back

`list`, `show`, `search "log"`, `status`, `doctor`, `list --json`, `examples constraint`,
`show <missing id>` all behaved and printed what a person would expect. `search` says how it
ranked and how many it searched. `status` warned that one normative item carries no scope and
"competes for the jit budget on every file operation" — true, informative, and a little
alarming on a corpus of seven.

`mycontext help lesson` fails: `"topic" must be one of: categories, scope, capture, workflow,
cli, tools, slash`. **README §3 Step 1 says `mycontext help <command>` prints the authoritative
usage for any command.** It does not; `help` takes a topic, and there is no per-command help on
the CLI (`OPENQ-help-takes-a-topic-and-not-a-command-so-per-command-help-exists-in-the-web-ui`
already records this). The README sentence is false.

`mycontext --version` is "unknown command" (`hooks/35` is open on this). `mycontext link`
takes positional `<from> <relation> <to>`, not `--type/--to` — fine, but the bare `link` usage
line is the only place that says so. `mycontext focus --clear` when no focus is set says
"clearing changes nothing" and then **refuses without `--yes`** anyway.

---

## 3. The hooks, driven with the payloads Claude Code sends

`CLAUDE_PLUGIN_ROOT` pointed at the clone; each hook fed a JSON payload on stdin.

| Event | Result |
|---|---|
| `SessionStart` (`startup`) | Delivered the **index only** — four governing items as title lines — plus one "product rule" block. Its own preamble: *"4 governing item(s) below carry a title only — the body was not delivered… Delivering every one of them in full this session would cost ~192 estimated tokens."* See §5, the main finding. |
| `PreToolUse` `Read src/billing/price.ts` | Injected the two `src/billing/**` items and the unscoped rule, in full, with their scopes shown. **Exactly right.** |
| Same file again | Nothing. The seen-file dedupe works. |
| `PreToolUse` `Write .my_context/items/rule/RULE-x.md` | `permissionDecision: "deny"` with a reason naming `create_item`. **Exactly right.** |
| `PreToolUse` `Edit src/api/upload.ts` | Injected the `src/api/**` constraint only. Right. |
| `PostToolUse` `Write docs/ARCHITECTURE.md` | Nothing. The default `watchedDocs` is `docs/superpowers/specs/**`, `docs/superpowers/plans/**`, `docs/prd/**` — this project's `docs/` is not watched, `init` wrote no list, and nothing said so. The capture nudge the README describes never fires for a project that does not use those three directories. |
| `SubagentStart` | Injected the index again, framed for a subagent, with the lines marked `· carried` from the parent session. Right. One cosmetic defect: the parent was named as ``session `sess-new` `` — the id `sess-new-user-0001` cut at its second hyphen. With real UUIDs the label is the first eight characters; with any other id it is wrong. |
| `SessionEnd` (`reason: exit`) | Removed nothing, said why in the audit row. Right. |

Every hook wrote its audit rows; `.audit/`, `state/`, `.rules/` and `.index.db` were all
gitignored by the files the tool wrote. `git status` shows exactly `items/`, `config.json`
and `.gitignore` as the things to commit. **That part is clean.**

---

## 4. The MCP server, over stdio

`initialize` → `serverInfo {"name":"mycontext","version":"1.0.2"}`, protocol `2025-06-18`.
`tools/list` → **28 tools**, matching the README. `query_items {path: "src/billing/price.ts"}`
answered with the six items and their scopes. `create_item` of a `rule` landed as a **draft**
with a sentence saying why and how to promote it; a `decision` landed active. `status_report`
and `load_context` returned the same text the CLI prints. An unknown tool name got a proper
JSON-RPC `-32602`. Nothing to report: this surface behaves.

`mycontext review` then showed the agent's draft; `review promote <id> --yes` made it active
and said, correctly, that with no scope it "is injected on the first file touched in a
session". `decay` and `contribution` both read sensibly on a nine-item corpus, and both say at
length what their numbers do not mean.

---

## 5. The main finding: a new user's rules arrive as titles only

The first `SessionStart` delivered no bodies. The README's Step 1 never mentions `--always`;
the four items I captured following it are exactly what a new user has after ten minutes; and
the session-start block Claude actually receives for that corpus is four title lines and a
note that the bodies would have cost ~192 tokens.

Isolated in a fourth throwaway project, one variable at a time:

| Corpus | `budgets` | Session start delivers |
|---|---|---|
| 1 pinned (`--always`) + 2 unpinned governing items | `{}` (as `init` writes) | **all three in full** |
| same | `pinned: 5000` | all three in full |
| 0 pinned + 3 unpinned | `pinned: 5000` | **titles only** |
| 0 pinned + 3 unpinned | key removed | titles only |
| 0 pinned + 3 unpinned | `{}` | titles only |

So the spare band — the mechanism that delivers unpinned governing items in full when the
pinned tier leaves room (`plan:budget seq:16`) — **is gated on the pinned tier being
non-empty**. Zero pinned items means zero spare band, whatever the budget. A corpus captured
by following the README has zero pinned items.

Everything after that first session works as designed: the just-in-time tier delivers the
right items on the first file touched. But the README's §4 promise — "Pinned — the handful
that always apply" and the index "so nothing is invisible" — reads to a new user as *my rules
will be there*, and for the first session they are there as a list. Pinning one item (`mycontext
pin <id> --yes`) fixes it for all of them, and nothing in the first-run path says so.

**What would close it:** either the spare band runs when the pinned tier is empty (the budget
is there and unspent), or `init`/the first capture says in one line that nothing is pinned yet.
The first is a selector change with a test; the second is a sentence.

---

## 6. Export, packs and import

| Command | Result |
|---|---|
| `export --out <dir> --dry-run` | The plan, the counts, and a "not travelling" list. Good. |
| `export --out <dir>` | 12 files. |
| `export --out <file>.zip --format zip` | Worked. |
| `export --out <dir> --as-pack --pack-name acme-rules --pack-version 2026-09` | Worked; `manifest.json` carries a SHA-256 per file. |
| Second project: `mycontext init --pack <pack>` | Verified 11 of 11 digests, listed nine `new`, imported all nine **as drafts**, merged six categories, refused nothing. Then `review promote --all --pack acme-rules --yes` made all nine active with a paragraph on what `--all` means. **This path is excellent.** |
| Third project: `mycontext pack import <full export dir>` | **Refused, and nothing imported.** The export's own `config.json` "declares `profile`, and a pack never carries one", then `budgets`, then `watchedDocs`, then **five refusals per category** (`tier`, `description`, `agentEdits`, `extraFields`, `updates`) for every one of the 29 built-in categories — roughly 150 lines of refusal, each a paragraph. `mycontext list` afterwards: `0 item(s)`. |

The changelog (`[Unreleased]`, `mycontext pack import`) says the importer "reads a full export
and not only a pack", and the 2026-09-11 progress report records R6 as "SHIPPED on the CLI" on
the same sentence. **On `1.0.2` at `62315f0`, `export` followed by `pack import` of its own
output does not import.** The refusals are each individually defensible — a full export carries
the exporting machine's config on purpose, and the importer refuses machine config on purpose —
but the two commands disagree about what the artefact is, and the tool never says "you exported
a whole corpus; import it with X" because there is no X. There is no `mycontext import`, and
`init --pack` refuses the same file for the same reasons.

This is also the answer to `OPENQ-does-export-import-ever-import-or-is-a-third-of-that-screen`:
today, a pack does; a full export does not.

---

## 7. Ingest and the lesson loop

`mycontext ingest docs/ARCHITECTURE.md` printed an extraction request: the chunk, the schema,
the rules (verbatim quote required, one-line title, plain-prose body, summary required, scope
restricts), and the callback. I answered it as the extractor with three candidates on stdin;
`ingest-apply` created three drafts, each carrying `source: docs/ARCHITECTURE.md` in the review
queue, and said every chunk was applied. `lesson-stage` staged one candidate rule from the
lesson and printed the accept/discard commands. **Both loops work end to end and the prompts
they emit are good.** Two notes: the request says narrative "is claude-mem's job, not this one"
— a name a new user has never heard; and `ingest` on a document the tool did not watch works
fine, which makes the silent `watchedDocs` default in §3 more of a documentation gap than a
product one.

---

## 8. The web UI

`mycontext ui --no-open --port <n>` printed the URL with the credential in the fragment, and a
warning that the server does not pick up code changes. Opened in a real browser (Chromium,
1280×900), from the new project:

- The console rendered: rail of twenty screens in four groups, the repository and session
  named in the header, Hebrew/English toggle, a status bar. Injection preview, Status, Doctor
  and Learn opened and drew. Seventeen `/api/*` calls, all `200`. One console error: a `404`
  for a resource the page requested (not identified; the server log records nothing).
- `Doctor` drew "findings: 0" with three empty levels — correct for this corpus.
- The **Injection preview** for `session-start` drew "DELIVERED — 0 items, 96 of 9,200 tokens"
  and a "WHY NOT" strip naming the first gate each item failed. That is the §5 finding drawn
  on a screen: three items fail at `eligible`, four at `normative tier`. The screen is right
  and it is the only place the product shows a new user why their rules did not arrive.
- The status bar reads `MODEL not read · CWD not reported · CORPUS not read · no status-line
  bridge · no handover configured`. Five "not"s on a healthy install, because the bridges they
  report on are opt-in. A new user reads them as five things wrong.
- Screenshots: `ui-landing.png` and `ui-doctor.png` in this session's scratch directory,
  not committed (the repository already holds too many).

Over `curl`, the bare `/` served the full 25 KB app with no credential (the active
`KNOWN-the-bare-server-url-renders-the-whole-app-and-never-says-it-has-no-credential`), every
`/api/*` answered `401` without the token and **`403` with it** — because the gate also checks
`Host` and `Origin`, and a `curl` sends neither the way the page does. That is the CSRF design
working; it also means the API is unreachable from a script or a second tool, and the `403`
does not say which of the three checks refused (`security.ts` says so itself).

---

## 9. What a new user meets, ranked

| # | Finding | Kind | Where it is already recorded |
|---|---|---|---|
| **F1** | **Session start delivers titles only until one item is pinned** (§5). The spare band is gated on a non-empty pinned tier; the README's first-run path pins nothing. | product | not recorded as this; `plan:budget seq:16` is the mechanism |
| **F2** | **`pack import` refuses a full `export`** (§6). The changelog says it reads one. 150 lines of refusal, nothing imported, no other command to use. | product + docs | `OPENQ-does-export-import-ever-import…` is the UI half; the CLI half has no item |
| **F3** | `--summary` refusal is a 150-word essay, and it fires **before** the category check, so an unknown category gets the essay first (§1). | UX | `walk/11`-adjacent; the ordering has no item |
| **F4** | `mycontext lesson` cannot take a summary, so every lesson is born as a `doctor` warning (§1). | product | none found |
| **F5** | README §3 says `mycontext help <command>` works; it does not (§2). | docs (false claim) | `OPENQ-help-takes-a-topic-and-not-a-command…` |
| **F6** | `watchedDocs` default watches three directories most projects do not have; `init` writes no list; the nudge silently never fires (§3). | product + docs | `walk/106` (Configure pane), not the default |
| **F7** | Status bar on a healthy fresh install reads as five things wrong (§8). | UX | `semantic/17` (the status bar) |
| **F8** | `focus --clear` with no focus set refuses without `--yes` after saying it would change nothing (§2). | UX | none found |
| **F9** | `doctor` calls the README's own `npm link` shim `cli_path_unverifiable` (§0). | product | none found |
| **F10** | Subagent block names the parent session by cutting the id at the second hyphen (§3). | cosmetic | none found |
| **F11** | `init` says it creates `items/`; it does not until the first capture. `mycontext --version` does not exist. | docs / missing | `hooks/35` |
| **F12** | The extraction request names "claude-mem" to a user who has never heard of it (§7). | copy | none found |

**What worked without a note:** plugin install and inventory; every capture that followed the
docs; `list`/`show`/`search`/`status`/`doctor`/`examples`; the just-in-time tier and its
dedupe; the write deny; the subagent framing; the audit log and its gitignores; all 28 MCP
tools tried; the draft boundary on agent captures; `review` and `promote`; `decay` and
`contribution`; pack export, `init --pack`, and `promote --all --pack`; `ingest` and
`ingest-apply`; `lesson` and `lesson-stage`; `link`, `pin`, `focus --preview`, `config --set`
(with a `.bak` written first), `supersede`; the UI's rail, doctor, preview and learn screens.

That is most of the product, and it held. The two findings that matter (F1, F2) are both cases
where the parts are each right and the whole is not: a selector that only spends the spare
budget when something is pinned, and an exporter and an importer that disagree about the one
file that travels between them.

---

## 10. What this walk-through did not do

- It did not run a slash command inside an interactive Claude Code session: no model
  credentials here. `claude plugin details` proves the components loaded; it does not prove
  `/mycontext:add-constraint` reaches `create_item`.
- It did not test the compaction path (`PreCompact` → `SessionStart(compact)`), the `Stop`
  and `PostCompact` hooks, or the conversation archive — all need transcripts on disk that a
  fresh install does not have.
- It did not test on Windows or macOS.
- It did not test the UI beyond four screens and a real browser's first load.
