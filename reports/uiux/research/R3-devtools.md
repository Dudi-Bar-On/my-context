# R3 — Developer tooling and the software-engineering workflow

**Domain:** git, distribution formats, editors and LSP, CI, ADR and issue-tracker conventions, docs
and diagram tooling. **Requirements in scope:** R6 (export/import), R7 (multi-session), R10 (make the
agent use the plugin), R11 (more categories), R13 (shareable ruleset templates).

**Evidence markers used throughout.** `[V]` — verified by executing it on this machine, this session,
against the real repository or a real scratch repository. `[W]` — verified this session against a
primary web source, cited. `[B]` — my belief or inference, argued but not verified. Every ruling below
says which it is.

---

## The three constraints every candidate is measured against

Restated in the sharp form, because two of them are stronger than they first read.

1. **Zero runtime dependencies, no build step** (`CONST-zero-runtime-dependencies`,
   `CONST-node-24-no-build-step`). Non-negotiable for anything shipping in the plugin.
2. **`src/` spawns no subprocess at all.** `[V]` — `grep -rn "child_process" src/` returns nothing.
   Every `child_process` import in the repository is in `scripts/` or `test/`. This is not written
   down as a constraint anywhere, but it *is* the current state, and it means **any candidate that
   shells out to `git`, `ssh-keygen` or `gh` is proposing the first subprocess in shipped code.** That
   is not a package.json dependency, so it does not violate the constraint as written — but it imports
   a new failure class: the binary may be absent, in a broken state, on a slow path, or waiting on a
   credential prompt. Every "integrate with an external tool" ruling below has to pay this.
3. **The hook latency ceiling makes the subprocess question binary, not gradual.** `PreToolUse` is held
   to a **50 ms p95** ceiling (`test/perf/audit-latency.perf.ts`, `focus-latency.perf.ts`) and Claude
   Code kills a hook at 10 s. `[V]` Measured on this machine (Windows 11, git 2.44.0, 15 runs):
   `git rev-parse HEAD` — median **10.3 ms**, p95 **10.7 ms**. `git status --porcelain .my_context` —
   median **13.2 ms**, **max 1080 ms** on the cold first run.

   So the cheapest possible git call is **20 % of the entire PreToolUse budget**, and a realistic one
   blows it by 20× on a cold file cache. **Ruling, applied everywhere below: no external process may
   be spawned from a hook, ever. External tools are a CLI-time affordance only.** That single line
   decides more candidates in this report than the dependency constraint does.

---

## Git, and what R6 actually needs

### What git already carries, verified

`[V]` The tracked surface of `.my_context/` in this repository is exactly three things:

```
.my_context/.gitignore
.my_context/config.json
.my_context/items/**            (46 tracked files total)
```

Everything else self-ignores, and it does so *structurally* rather than by convention: `jsonl-log.ts`
(`ensureLogDir`), `ledger.ts` and `revision.ts` each write `*\n` into a `.gitignore` inside their own
directory, rewritten unconditionally so an emptied one self-heals. `[V]` `git check-ignore -v` confirms
`.my_context/.audit/` and `.my_context/state/` are ignored by their own `.gitignore:1:*`, and
`.my_context/.gitignore` carries `.index.db` and `.index.db-*`, written by `cmdInit`.

**The consequence is the answer to R6's central open question, and it is already true today.** The
addendum reasons that "the honest export is probably *corpus + config*". It is — and **git already
performs exactly that export, on every commit, with no new code.** The four things the addendum lists
as questionable (`.index.db`, `.audit/`, `state/*.seen.jsonl`, `state/focus.json`, the ledger) are
each already excluded by a decision someone made deliberately and documented in the module that owns
it. R6 does not need to re-decide the boundary. It needs to *inherit* it.

Two of those exclusions are worth naming because they are load-bearing and easy to get wrong later:

- **The ledger is not a file.** `[V]` `core/ledger.ts` stores injection history in tables *inside*
  `.index.db`, which is disposable; `audit.ts` reconstructs it from the audit log (`ledgerRows`). So
  "does the export carry the ledger" is not a question about a file — it is the question "does the
  export carry the audit log", and `audit.ts` already answers no, with the consequence disclosed in
  both READMEs.
- **`.revisions/` is gitignored too.** `[V]` A pending revision does not travel through git. A
  colleague who clones your repo sees the item's text in force and no record that a proposal is
  waiting on your machine. That is defensible and it is currently undocumented in the R6 context; an
  export that claims to move "the complete registry" and silently drops the revision queue would be
  the `INV-nothing-is-dropped-silently` failure at the feature level.

### What git gives R6 for free, beyond transport

- **History that survives a clone, and is better than the audit log for the question R6 asks.** The
  audit log answers *what did this machine's sessions see and do*. Git answers *what did this rule say,
  and when did it change, and who changed it* — including the draft→active crossing, which is a
  one-line diff on `status:`. The second question is the one an importer cares about. The first is
  inherently local and should stay local. **Recommendation: state in the design that git is the
  history export, and that the audit log is deliberately not exported.** Do not build a history
  serializer.
- **Per-item history with no format.** `git log --follow .my_context/items/rule/RULE-x.md` is the
  provenance view for one rule, free, offline, in every git UI ever written.
- **Conflict behaviour that is already good.** One file per item means two people adding different
  items never conflict. Two people editing the *same* item conflict inside the body, which is exactly
  where a human should be looking. The one predictable nuisance: the frontmatter `checksum:` line
  conflicts on every concurrent edit of the same item and any resolution produces a checksum matching
  neither side — `doctor` then reports a mismatch indistinguishable from a hand edit. **Cheap fix:
  `doctor`'s checksum finding should name "you may have just merged; `mycontext repair` re-stamps" as
  a cause.** A custom `.gitattributes` merge driver would be the elegant fix and is **INCOMPATIBLE**:
  drivers require a `git config merge.<name>.driver` line on *every clone*, which a plugin cannot ship.
- `[V]` **`.gitattributes` with `*.md diff=markdown`** uses git's built-in markdown userdiff driver and
  puts the enclosing heading in the hunk header: `@@ -3 +3 @@ # Postgres pool capped at 20`. One line,
  no config, improves every item diff in every PR. Verified by execution.
- **R7's third reading — "multiple workspaces open at once" — is already solved by `git worktree`,
  and correctly.** `[V]` I created a worktree of a repo containing `.my_context` with a populated
  `state/` and `.index.db`: the worktree received **the tracked corpus only** — no `.index.db`, no
  `state/`, no `.audit/`. Each worktree is therefore an independent mycontext workspace with its own
  disposable index, its own seen-state and its own audit log, sharing one git history. That is exactly
  the isolation R7(3) wants. `[V]` `findProjectRoot` walks up from cwd and `.git` appears in `src/`
  only as a skip-directory name, so the fact that `.git` is a *file* in a worktree breaks nothing.
  **Recommendation: R7(3) is documentation, not code.** Say that two concurrent sessions in two
  worktrees are already isolated, and that two concurrent sessions in *one* checkout are R7(2) — the
  contention problem — which is a different piece of work.

### What export/import adds that git does not — the honest list

I tested the strongest git-only answer end to end before writing this, because if git can do it,
export should be a documented recipe rather than a format.

`[V]` **The complete git-only recipe works, including for a non-collaborator.**

```bash
# publisher, in the repo whose corpus you want to share
git subtree split --prefix=.my_context -b corpus-only
git bundle create corpus.bundle corpus-only          # one file, e-mailable

# recipient, in a completely unrelated repository
git subtree add --prefix=.my_context corpus.bundle corpus-only
```

Verified by execution: the split branch's root *is* the corpus (`items/rule/A.md`, no `.my_context/`
prefix), it carries the corpus's own history and nothing else from the source repository,
`git bundle verify` reports "the bundle records a complete history", and `git subtree add` grafts it
into an unrelated repo with a merge commit naming the source sha. `git subtree pull` updates it later.
`git archive HEAD .my_context > corpus.tar` is the same thing without history, for a recipient with no
git at all.

So: **git already does the transport, the single-file spelling, the history, the sub-repository case
and the non-collaborator case.** Nobody knows this recipe, and that is the first thing export adds —
it is the recipe, named, with the sharp edges (unrelated histories, the `--prefix` having to match)
already handled.

The five things export/import adds that git genuinely **cannot** do:

1. **Selection.** Git moves a path, all-or-nothing, at a commit. An export needs a *subset*: active
   items only, these categories, these tags, drop drafts, drop superseded, drop the three items that
   name our internal hostnames. There is no git operation for that short of history rewriting. **This
   is the strongest single argument for an export command.**
2. **Re-grading on arrival — and this is the one that matters.** `git subtree add` copies bytes. An
   item that said `status: active` in the publisher's repo says `status: active` in yours, which means
   **a git-only import makes a stranger's rules govern your project immediately, with no review.**
   That inverts the product's entire trust posture in one command. An import must be able to land
   everything as `draft`. Git cannot do this; a command can. Everything in R13's trust model hangs off
   this sentence.
3. **Identity collision handling.** Git merges by path, so the same id at the same path is a text
   conflict and different ids never interact. The interesting cases are *same id, different content*
   and *different id, identical content*, and mycontext already owns both concepts: the global-layer
   duplicate-id report (project wins, named rather than silent) and `contentHash` in
   `core/content-hash.ts` (content identity, already used for create-dedupe and ingest idempotency).
   An import should report three buckets — **new / identical (same `contentHash`, skipped) /
   conflicting (same id, different content, refused or renamed, both sides named)** — and never
   silently overwrite. That is `INV-nothing-is-dropped-silently` applied to import.
4. **Config semantics rather than config bytes.** §6 says configuration *replaces, it does not merge*.
   So copying a `config.json` in wholesale can disable a category the receiving corpus has items in —
   which `checkUnknownCategory` and the disabled-category path already treat as an error condition.
   Import must diff the two configs, print it, and apply only with consent. Git copies bytes and would
   silently do the wrong thing.
5. **Provenance the receiving side can audit later.** Where did this item come from, at what version,
   verified against what. Git records that in a merge commit message that nothing reads; the item
   should carry it in frontmatter (below).

Two of R6's open questions can simply be closed:

- *"What must the receiving side rebuild and how does it know to?"* — **Nothing, and it does not need
  to know.** `[V]` Every CLI command opens through `openRebuiltStore`, which rebuilds the index from
  Markdown first; and the hooks fall back to serving straight from Markdown when the index is
  unreadable, disclosing that inline. The receiver rebuilds itself. Say so and delete the question.
- *"Moving between workspaces"* — this is the global-layer workaround (`mv ~/global-context/.my_context
  ~/.my-context`), which the README already documents as the one unsupported step, and which
  `mycontext init --global` currently *refuses* because no route exists. **R6's import path is that
  route.** One mechanism closes two recorded gaps; that is worth saying in the design.

### The export artefact, and one hard-won detail

**Do not invent a container format.** The export is a **directory in the workspace shape** —
`items/**`, `config.json`, plus one `manifest.json`. Its single-file spellings are `git bundle` (when
the source is a git repo and the recipient has git) and a plain `tar`/`zip` otherwise. Both already
exist and both are already understood.

`manifest.json` must be **derivable from the items and never authoritative**, or it contradicts
`INV-markdown-is-the-source-of-truth`. It exists so import can report what it did and detect
truncation; if manifest and items disagree, the items win and the disagreement is reported. It should
carry: format version, producing mycontext version, source workspace identity, per-item `{id, path,
sha256}`, a digest over those digests, and the source's resolved category configuration.

`[V]` **`sha256`, not the item's own `checksum` field.** `core/slug.ts` defines
`checksum = createHash('sha256').update(content).digest('hex').slice(0, 16)` — a **64-bit truncation**.
That is entirely adequate for its actual job (noticing a hand edit) and **useless as an integrity
control**: the birthday bound is ~2³², i.e. forgeable on a laptop. Any manifest that reuses the item
`checksum` field as its integrity value would look like a supply-chain control and be none. Full
digests in the manifest, and the two fields must not be confused in the docs.

---

## R13 ruleset packs — prior art and supply chain

### What the prior art actually converged on

`[W]` My researcher surveyed ESLint shareable configs, Renovate presets, EditorConfig, Semgrep,
OPA/Conftest bundles, Terraform's lockfile, Homebrew taps, Nix flakes, Dev Container Features, Vale
style packages, Cursor `.mdc`, Copilot `.instructions.md`, AGENTS.md, Claude Code plugin marketplaces,
and the MCP registry. The conclusion is unusually clean:

> **On format, Markdown plus minimal YAML frontmatter with a glob-scoping key has won. On
> distribution and trust, nothing has converged — it is git repos and copy-paste.**

Cursor's `.mdc` has exactly three frontmatter fields: `description`, `globs`, `alwaysApply` `[W]`.
Copilot's `.instructions.md` has one: `applyTo`, comma-separated globs `[W]`. Those are, field for
field, **mycontext's `title`, `scope` and `always`** — independently arrived at by two other vendors.
That is strong evidence the item schema is right, and it is worth saying so in the README.

AGENTS.md, meanwhile, **has no specification at all** — agents.md states "AGENTS.md is just standard
Markdown. Use any headings you like." `[W]` It is now stewarded by the Agentic AI Foundation under the
Linux Foundation (Dec 2025) `[W]`, which gives it standing but not a schema. It is an **export
target**, never an import source or a source of truth.

The distribution model to copy is **Renovate's**, not npm's. `[W]` Renovate resolves presets as
`github>owner/repo`, `gitlab>`, `local>` or a raw URL; omitting a filename resolves `default.json`;
a version is a **git tag** (`github>abc/foo#1.2.3`) which propagates to nested references; npm-hosted
presets are deprecated and being removed. The runner-up is **Vale's**: `[W]` style packages are plain
zips published as GitHub *release assets*, fetched by a one-line `Packages =` entry in `.vale.ini`,
with no registry at all.

**Recommendation, stated flatly: mycontext must not build, host, or depend on a registry.** The
registry is the entire supply-chain liability in every incident below, and a zero-dependency plugin
has no business operating one. **The URL is the identity, a git tag is the version, and the recorded
commit sha is the pin.** `mycontext init --from github.com/acme/react-flavour@v1.2.0` resolves by
`git clone --depth 1 --branch v1.2.0`, records `git rev-parse HEAD`, and that sha goes into every
imported item's provenance. No index to compromise, no namespace to squat, nothing to run.

### The supply-chain lessons, and the one that is about *this exact artefact*

`[W]` The general lessons are the familiar ones and they all point the same way: **eslint-scope (2018)**
— a poisoned *shareable config* package, credential theft via postinstall; **event-stream (2018)** —
social takeover of a maintainer; **node-ipc (2022)** — the legitimate maintainer *was* the threat;
**xz (2024)** — a two-year social engineering campaign against one maintainer; **Shai-Hulud (2025)** —
a self-replicating npm worm.

And then the one that should decide the design:

`[W]` **@antv / "Mini Shai-Hulud", 2026-05-19.** A maintainer account hijack produced 639 malicious
versions across 323 packages. The payload embedded Sigstore integration and **forged SLSA provenance
attestations when a CI OIDC token was available — the malicious versions passed npm provenance
verification.** (Socket, Microsoft Security Blog, VentureBeat.)

> **A signature proves where bytes were produced. It never proves a human authorised what they say.**

That is the sentence the R13 trust model has to be built around, and it is the sentence that stops the
obvious wrong design — "signed packs import as active, unsigned packs import as drafts". Under that
rule, the strongest attacker in the survey gets the better treatment.

`[W]` And the attack that targets *precisely* mycontext's artefact type: **the "Rules File Backdoor"**
(Pillar Security, 2025-03-18). Malicious instructions hidden in `.cursor/rules`, `.cursorrules` and
`.github/copilot-instructions.md` using **zero-width joiners, bidirectional text markers and Unicode
Tags-block characters** — invisible in the editor and in the GitHub PR diff, fully tokenised by the
model, causing it to write backdoors into generated code. It survives forking and propagates to every
downstream contributor. Cursor and GitHub both initially called it user responsibility; **GitHub
shipped a hidden-Unicode warning on github.com on 2025-05-01** citing "code can appear one way and be
interpreted another way, especially by AI." `[W]` The underlying primitives are **Trojan Source**,
CVE-2021-42574 (bidi overrides `U+202A–202E`, `U+2066–2069`, `U+061C`) and CVE-2021-42694
(homoglyph confusables).

An imported normative item is text authored by a stranger that will be injected into an agent's
context window phrased as a standing instruction. That is the Rules File Backdoor's exact target.

### The trust model, in three layers, in this order

**Layer 1 — quarantine by construction, with no exemption.** Every imported item lands
`status: draft`, whatever the pack file says, whatever signature it carries. Not "unless signed" —
*always*. The argument is the one §7 already makes about agent-captured items, unchanged: something
with that reach, written by something that can be confidently wrong, is worth one human glance. A
stranger is at least as confidently wrong as the model, and the @antv finding says a signature does
not upgrade them.

The cost is honest and should be stated: importing "the React flavour" gives you a review queue of
forty drafts, not forty working rules. **Do not add `--promote-all` to soften it** — that flag *is*
the hole, spelled in one token, and §7's list of eight commands that cross the gate with no human
would become nine. What the review surface should gain instead is a **pack view**: the drafts grouped
by their pack, each showing its provenance, promoted individually, with a running count of how many of
the forty you have actually read.

**Layer 2 — a mandatory content screen at the door, before anything is written or displayed.** Refuse
— not warn — any item whose text contains characters outside a declared allow-list, and print the
offending codepoints and their positions. Minimum set: C0/C1 controls other than `\n` and `\t`, bidi
controls `U+202A–202E`/`U+2066–2069`/`U+061C`, zero-width `U+200B–200F`, `U+FEFF`, and the Unicode
Tags block `U+E0000–E007F`. That is roughly ten lines of code, zero dependencies, and it is **the
highest value-per-line item in this entire report**. It also generalises: the same screen belongs on
`ingest` (which reads documents someone else wrote) and arguably on `create_item`.

Note the existing precedent — the 1.0.2 id-grammar fix exists because corpus text already reached
somewhere it should not have. This is that lesson, applied to the one input that is *designed* to come
from outside.

**Layer 3 — optional cryptographic attribution, honest about what it buys.** `[V]` I verified the
mechanism end to end on this machine:

```
ssh-keygen -Y sign -f ./k -n mycontext MANIFEST        → MANIFEST.sig
ssh-keygen -Y verify -f allowed -I pack-signer -n mycontext -s MANIFEST.sig < MANIFEST
  → Good "mycontext" signature for pack-signer with ED25519 key SHA256:…
tamper one byte of MANIFEST, re-verify                 → exit non-zero, "incorrect signature"
```

`[V]` And the tool is present with no install: `C:\WINDOWS\System32\OpenSSH\ssh-keygen.exe` on this
stock Windows 11 machine supports `-Y sign`; Git for Windows carries OpenSSH 9.6p1. `[W]` `-Y` requires
OpenSSH 8.8+, which is universal on current macOS and Linux. The `allowed_signers` file *is* the trust
policy and it is human-readable, which suits this product. `[W]` If the pack is a git repo — and it
should be — `git verify-commit` / `git verify-tag` with `gpg.format=ssh` and
`gpg.ssh.allowedSignersFile` (git ≥ 2.34) gives the same guarantee with no new file format at all, and
that is the spelling to recommend first.

**But say what it buys, in the same sentence, per
`STD-guarantee-claims-carry-their-condition-in-the-same-sentence`:** a verified signature means the
bytes are the ones that key signed. It means nothing about whether the rules are correct, safe, or
appropriate for your project — and it does not shorten the review queue by one item.

**Rejected outright:** `minisign` and `cosign` (not preinstalled anywhere — a runtime dependency under
another name `[W]`); OCI/ORAS distribution (needs a client binary and a registry); npm; Sigstore/SLSA
provenance as a *gate* (@antv). `gh attestation verify` is fine as an optional extra for
GitHub-Actions-built packs but must never be required — `gh` is common, not universal.

### Packs and `PROFILES`

`[V]` `PROFILES` in `core/categories.ts` is `minimal` (8 categories) and `standard` (every
`defaultEnabled` category), and `resolveConfig` refuses an unknown profile *by name*, listing the valid
set, precisely so a stale `"profile": "full"` is not silently resolved. A pack must not be able to
extend that set implicitly.

**Opinion: keep the two concerns apart.** A profile names a set of *built-in* categories and stays in
code. A pack is a set of *items* plus a *proposed* category configuration. A pack that declares a
category the receiving project does not have would otherwise create items with an unknown `type`,
which `checkUnknownCategory` already reports as a defect. So: a pack's config is printed as a diff
against the resolved config and applied only on explicit consent, never merged silently.

### The item-level provenance, and one integration cost to budget

An imported item is neither `human` nor `agent` nor `ingest`. `origin` is what the whole trust boundary
is built on, and no tool lets a caller set it — so stamping `human` would be a lie the format tells,
and `ingest` loses "written by a stranger".

**Add a fourth `origin` value: `import`.** Then reuse the existing provenance triple rather than adding
fields: `source_file` = the pack's identity (`github.com/acme/react-flavour@<sha>`), `source_anchor` =
the item's path inside the pack, `source_checksum` = the pack digest. No schema growth, and it renders
and round-trips through machinery that already exists.

**The cost, named rather than glossed:** `checkSourceDrift` and `checkSnapshotDrift` in
`doctor/checks.ts` resolve `source_file` *against the repository*. A pack URL is not a repo path, so
those checks would report every imported item as broken. They need an explicit "provenance is external,
drift is not checkable here" branch — which is a real change to two checks and a new finding kind, not
a free ride. `origin` is also a `Status`-adjacent enum in `core/types.ts` and reaches the index schema,
the render path and the round-trip test; `INV-markdown-is-the-source-of-truth` means the new value must
survive parse → render → parse, proven by a raw-fixture test.

---

## Editors and LSP

### The question is real; the answer is not a language server

"What governs this file, as you type" is a good question and mycontext **already computes the answer**:
`[V]` `mycontext search --path <file>` is documented as returning "what governs a file … including the
unscoped items, because an item with no scope applies everywhere". The payload exists. The only
question is transport.

### Four independent costs, any one of which is enough

**1. LSP has no channel for the thing being expressed.** `[W]` The document-wide, non-diagnostic
features are `documentSymbol`, `foldingRange`, `semanticTokens`, `inlineValue`, `inlayHint` — all
range- or position-anchored. There is **no file-level information channel**. The options are: a
diagnostic at 0:0 with `severity: Information` (which pollutes the Problems panel and every "0 problems"
check the user has), an `inlayHint` (position-anchored, wrong for a list), or a **CodeLens whose range
is line 0** — which renders above the first line and is the de-facto file-header slot, but is not
blessed by the spec; it just falls out of range-at-line-0 `[W]`. So the best available surface is an
idiom, not a feature.

**2. The client attach problem is fatal where the users are.** `[W]` **VS Code has no built-in generic
LSP client** — microsoft/vscode#137885 is closed and labelled `*extension-candidate`. Neovim 0.11+
(`vim.lsp.config` + `root_markers = {'.my_context'}`), Emacs eglot, and Sublime LSP each attach a
generic binary in a few lines of user config; Helix requires listing the server under *every*
`[[language]]`; Zed needs a Rust/WASM extension. **So the LSP surface serves the users who could
already have run the CLI, and does not serve the users who cannot.** Shipping a VS Code extension to
close that gap means a `.vsix`, a marketplace identity, and a bundling step — a build step and a second
distribution channel, both refused.

**3. There is a structural mismatch with scope globs.** Language servers register per language.
mycontext's scopes cut across every file type in the repository, so the server must attach to
effectively all of them — cheap in Neovim, tedious in Helix, impossible without an extension in VS
Code.

**4. The transport is not free, though it is the smallest of the four costs.** `[V]` mycontext's MCP
server frames messages as **newline-delimited JSON** (`serveStdio` scans for `\n`); `[W]` LSP requires
`Content-Length: N\r\n\r\n` headers. The JSON-RPC dispatch in `mcp/protocol.ts` is reusable; the framing
is not. More importantly, LSP is bidirectional and stateful — `initialize`/`initialized`,
`shutdown`/`exit`, `didOpen`/`didChange`/`didClose`, and server→client notifications — whereas
`session.handle(message)` today returns a response synchronously and never initiates. Pull diagnostics
(3.17) would let a server stay request/response `[W]`, which fits the existing shape far better, at the
cost of requiring 3.17-capable clients.

### Ruling

**INCOMPATIBLE as a shipped surface. ADOPTABLE-AS-FORMAT-ONLY as a contract.**

The opinionated version: **publish the query, not the server.** Specify and freeze
`mycontext context --path <file> --json` — ids, categories, tiers, which scope glob matched, and
whether the item is pinned — as a documented, versioned output contract. Then an LSP server is about
200 lines that **somebody else** can write, in **their** repository, with **their** editor's
peculiarities, and it costs this project nothing but a promise not to break the JSON. That promise is
the valuable artefact; the server is not.

Two smaller notes worth carrying forward. `[W]` LSP 3.18 adds `workspace/textDocumentContent`, letting a
server back a virtual URI with generated text — `mycontext:governs/src/db/pool.ts` opened via
`window/showDocument` would be a genuinely elegant surface, and it is the one thing that would tempt me
back. And `[W]` **CODEOWNERS is the closest shipped precedent for the whole idea**: gitignore-style path
globs mapping to a responsible thing, surfaced per file in the forge UI ("Owned by … from CODEOWNERS
line N"). It is worth studying as an interaction model — including its limits (no `!` negation, no
character ranges) — even though mycontext cannot ride the file itself.

---

## CI

### The strongest argument in this report

§7 states, in the project's own words: `mycontext repair --yes` after a hand edit "changes what governs
this project and leaves no evidence it happened. Verified by execution." And more broadly: "the gate
holds if and only if the agent's Bash surface excludes the `mycontext` binary entirely, in every
spelling, *and* direct writes into `.my_context/`" — with the acknowledgement that permission rules are
prefix matches on a command string and cannot be complete.

**All of that is true locally, and all of it is false in a pull request.** A hand edit plus `repair`
leaves no *machine-local* evidence — but it leaves a diff. An agent composing a command line can add
`--yes`; it cannot add its own approving review to a PR under branch protection.

> **CI is the only enforcement point in this product that an agent holding a shell cannot reach.**

That reframes R10. R10 asks for a mechanism that makes the agent use the plugin, and notes correctly
that a mechanism which merely asks will be ignored under load while one that blocks must fail open.
Hooks must fail open (`INV-hooks-fail-open`). **A CI check is the one place that may fail closed**,
because failing closed there costs a red check and a human decision, not a broken session.

### What belongs in CI, and the distinction that makes it work

`[V]` `doctor/checks.ts` runs eleven checks. They are **not** one population, and running `doctor` in
CI unmodified would produce noise and false failures:

| Check | Property of… | In CI? |
|---|---|---|
| `checkSourceDrift`, `checkSnapshotDrift` | the committed files + the repo tree | **yes — this is the best CI check there is**: drift happens *in the PR that edits the source file* |
| `checkDeadScopes` | the committed items + the repo tree | **yes** — a scope glob matching nothing is a constraint that quietly stopped activating |
| `checkOrphanRelations`, `checkUnknownCategory`, `checkScopePolicy` | the committed corpus alone | **yes** |
| checksum mismatch (via `repair`'s condition) | the committed files | **yes** — the hand-edit route, caught where it cannot be repaired away |
| `checkPermissions` | `.gitignore` content | **yes** — it is literally a repo property |
| `checkIndexFreshness` | `.index.db`, which is not committed | no — must degrade cleanly, not fail |
| `checkAuditSize`, `checkSessionIdMismatch` | this machine's `state/`, `.audit/` | no |
| `checkCorpusSize` | corpus size | advisory only |

**Recommendation: `Finding` gains a `realm: 'repo' | 'machine'` field, and CI runs the `repo` realm.**
That is a small, honest change that makes "what does CI check" answerable by reading a type instead of
by reading eleven functions — and it also improves the local report, which currently mixes "your rule
is broken" with "your machine's cache is stale".

**And one check that does not exist yet and is the point of the whole exercise:** a diff-aware report
naming, for the PR, **every normative item whose text changed and every item whose `status` crossed
into `active`**. That is §7's list of eight gate-crossing commands, observed from outside, in the one
place the agent cannot edit. It needs `git diff --name-status <base>..<head> -- .my_context/items` plus
a parse of both sides — a CLI-time subprocess, which is allowed.

### The GitHub Action, ruled

`[W]` **Composite action, not JavaScript.** Supported `runs.using` values are `node20`, `node24`,
`composite`, `docker`. A JavaScript action **cannot** run without vendored dependencies — the runner
executes the entry file with no install step, and GitHub's own tutorial directs you to bundle with
`@vercel/ncc` or rollup. That is a build step, refused. A composite action is pure YAML `run:` steps
shelling out to `node …/src/cli/index.ts`, and Node 24's type-stripping applies unchanged. Costs: every
composite `run` needs an explicit `shell:`, and composite steps run in the *caller's* workspace, so the
action must check out or locate the plugin itself — `${{ github.action_path }}` handles it since a
`uses: owner/my-context@v1.0.3` reference checks out the action's own repository. Since VERSIONING.md
says nothing is published to a registry and a tag is the release, `uses: owner/repo@tag` is the natural
and *only* distribution shape. It requires publishing nothing new.

`[W]` **SARIF: INCOMPATIBLE, and for a decisive reason rather than a stylistic one.** GitHub accepts
SARIF 2.1.0 and non-security tools are explicitly legitimate — but *"you only see alerts in a pull
request if all the lines of code identified by the alert exist in the pull request diff."* A drift
finding pointing at `.my_context/items/rule/RULE-x.md`, which the PR did **not** touch, gets **no
annotation** — and that is the exact case CI exists to catch. Add that private and internal repos need
GitHub Code Security (the GHAS SKU) for code scanning at all, and SARIF costs money to deliver the
wrong behaviour.

`[W]` **Workflow annotations plus the step summary: ADOPTABLE, and they are the right pair.**
`::error file=…,line=…,title=…::message` for findings that point at a line; `$GITHUB_STEP_SUMMARY` for
the human-readable table. Budget them: **10 errors + 10 warnings + 10 notices displayed per step, 50
per job, 50 per run**; step summary **1 MiB per step, 20 summaries per job**. A corpus of 5,000 items
can generate more than 10 findings, so the action must emit a *summary* annotation plus the full table
in the step summary, never 200 annotations of which 190 vanish — which would be
`INV-nothing-is-dropped-silently` broken by a platform limit rather than by code.

`[W]` **reviewdog: ADOPTABLE-AS-FORMAT-ONLY.** It consumes `rdjsonl` (trivial to emit, dependency-free)
and its `github-pr-review` reporter posts real review comments, escaping the 10-annotation cap. It is a
Go binary the *user* installs in *their* CI, never a mycontext dependency. Emitting `rdjsonl` behind a
flag is a few dozen lines and buys a whole PR-feedback surface for free. `[W]` **Danger JS** is the
right *pattern* — one idempotent PR comment with four severity levels — and the wrong *dependency*;
copy the pattern.

`[W]` **Pre-commit: the framework is INCOMPATIBLE** (Python runtime on every dev machine); husky needs
Node and works by setting `core.hooksPath`; lefthook is a binary to install. **The zero-dependency
spelling is `git config core.hooksPath .githooks` with a committed `.githooks/pre-commit` that runs the
CLI** — which is what husky does, minus husky. It is one config line the user must run once, so it is
**documentation, not a shipped feature**, and the honest framing is that it saves a CI round trip and
enforces nothing an agent with a shell cannot bypass with `--no-verify`.

`[W]` **Corpus-adjacent linters — optional, CI-only, never shipped:** `lychee` (Rust binary, checks
Markdown links including fragments) is the strong one; `markdownlint-cli2` ignores frontmatter by
default; `remark-lint-frontmatter-schema` validates frontmatter against JSON Schema but drags in the
whole unified/remark tree and is not worth it when `parseItem` already validates every field.

**One internal convergence worth noticing.** `scripts/verify-citations.ts` carries a citation as
`` `file` · `verbatim fragment` · ~line ``, where the fragment is the identity and the line is a
disposable hint. That is *exactly* what `source_file` / `source_anchor` / `source_checksum` do for
items. `[B]` The project has invented the same solution twice in two places, and they should eventually
be one mechanism — `verify:citations` becoming a mode of `doctor` — but that is a tidy-up, not a
priority.

---

## ADR and issue-tracker conventions vs the tier model

### Where the model already agrees, in more detail than expected

`[W]` MADR 4.0.0 (2024-09-17) frontmatter is `status: {proposed | rejected | accepted | deprecated | …
| superseded by ADR-0123}`, `date`, `decision-makers`, `consulted`, `informed`. Against mycontext's
`draft | active | superseded | deprecated | validated`, that is **near-isomorphic**: `draft`≈`proposed`,
`active`≈`accepted`, and `superseded`/`deprecated` match outright. The gap is `rejected`, which
mycontext expresses as `review discard` → `deprecated`.

`[W]` Nygard (2011) requires monotonic, never-reused numbering and says a reversed decision is *kept*
and marked superseded. `[W]` `adr-tools`' `adr new -s 9` writes the new record **and** flips ADR 9 —
which is precisely `supersede_item` recording the pair in both directions (`superseded_by` /
`supersedes`). `[W]` AWS Prescriptive Guidance states the immutability rule explicitly: an accepted ADR
is not edited, it is superseded.

`[W]` And no ADR tool in the ~32 listed at adr.github.io implements anything like `origin` +
draft-gating. mycontext's governance layer is genuinely novel in this space. Also worth knowing: the two
most-cited CLIs are dormant (`npryce/adr-tools` last pushed 2024-04-25; `log4brains` 2024-12-17) while
the *specification* is alive (`adr/madr` pushed 2026-08-03). **The format is the durable thing; the
tools are not.** That is an argument for format compatibility and against tool integration.

### Where it disagrees, in the sharpest form

An accepted ADR is authoritative and binding — immutable, imperative voice, "We will…". mycontext files
`adr` on the **rationale** tier, which is never injected in full and is not even named in the session
index (`buildIndex` reduces rationale types to a bare count). Stated as bluntly as it deserves:

> **The most authoritative artefact in the repository is the one the agent is structurally forbidden
> from reading.** If an ADR says "we will use Postgres" and no `constraint` was ever derived from it,
> the agent is free to reach for MySQL, and mycontext's own tier model is what prevented it from
> knowing better.

`[W]` The literature is on mycontext's side, and specifies the missing piece. Enterprise-architecture
practice separates **principles** (settle arguments), **standards** (practical interpretations),
**guardrails** and **gates**; adr.github.io's own definition is that "an ADR captures **a single AD**
and its rationale" — an *instance-level event*, where a standard is *class-level and standing*.
Practitioner guidance says an ADR should **link to** principles and standards, not contain them.
Zimmermann's SOAD literature makes the same cut between "decisions required" (reusable guidance models)
and "decisions made" (records), and reports the maintenance cost of guidance models as the known risk —
which is exactly mycontext's exposure: **a derived rule can silently outlive the ADR it came from.**

`[W]` And the strongest counter-evidence, which the design should answer rather than ignore:
actual.ai's "agent-optimized ADRs" argues that human-shaped ADRs fail coding agents because "a coding
agent reads all of them, every session, under a token budget, and acts on them literally", and proposes
ADRs with an `applies_to` **glob in frontmatter**, imperative **MUST/MUST NOT** language, stable rule
**IDs**, and verification commands. That is mycontext's normative schema — `scope`, `severity`, `id`,
`always` — independently reinvented, but reached by **collapsing the tiers and injecting the ADR**.
The industry agrees an agent needs scoped, imperative, identified rules. The live disagreement is only
*one file or two*. Two is more defensible — it preserves ADR immutability while letting the rule be
scoped, edited and retired — **but only if the derivation actually happens.**

### The concrete recommendation

**A `derives` relation from a rationale item to the normative items that carry its force, plus a doctor
lint for its absence.** `[W]` Nothing in the ADR ecosystem does this. mycontext has both halves already:
typed `relations` on every item, and a working precedent in the `lesson` → `lesson-stage` →
`lesson-accept` flow, which is exactly "derive rule candidates from a rationale item and have a human
accept them". **Give `adr` and `decision` the flow `lesson` already has**, then:

- `doctor` reports an `active` ADR with **zero normative descendants** — "this decision governs nothing;
  did a rule follow from it?"
- superseding an ADR **cascades a warning** to its descendants rather than retiring them, because
  retiring a rule is a human decision and cascading it would be a silent one.
- `[W]` **RFC 8174's uppercase-only rule** (BCP 14 keywords are normative *only* in ALL CAPS; lowercase
  is ordinary English) is a free, exact, greppable detector: an `adr` or `lesson` body containing a
  capitalised MUST / MUST NOT / SHALL is strong evidence a normative item should have been extracted.
  A `PostToolUse` nudge or a doctor advisory built on that is a dozen lines and needs no NLP.

### R11's five categories, ruled

`[W]` The evidence is unusually decisive and it says **no new categories, and three of the five are
already answered by machinery that exists.**

- **`bug` and `defect` are synonyms.** ISTQB's glossary defines *bug*, *defect* and *fault* with
  identical text ("a flaw in a component or system that can cause it to fail to perform its required
  function"), sourcing the taxonomy to **IEEE 1044** — which has been *Inactive-Reserved since
  2020-03-05*. Shipping both would encode a distinction the only governing standard denies. The real
  ISTQB axis is **error → defect → failure**, and only *failure* (observed behaviour) and *disposition*
  are contextually useful to an agent.
- **The world's largest tracker shipped three types.** GitHub issue types went GA 2025-04-09 with
  exactly **task, bug, feature**, a cap of 25 org-defined types, and **at most one type per issue**.
  After a decade, three, mutually exclusive.
- **`known_issue` already occupies the useful slice, for the right reason.** Release-note practice
  defines a known issue by **disposition plus workaround** — triaged to "not now", with behavioural
  guidance ("don't do X, it breaks"). That is normative, which is why the category's comment in
  `categories.ts` is right that placing it on the rationale tier defeated its entire purpose. An
  untriaged bug backlog is **work, not knowledge**; it needs a state machine, assignees and sync, which
  is what `git-bug` (10k stars, alive) and Fossil's ticket system exist for, and what
  `NOGOAL-not-a-claude-mem-replacement` refuses.
- **`todo` cuts against a healthy, alive ecosystem.** `leasot`, `todocheck`, `todo-to-issue-action` and
  `todo-tree` all rest on one premise: a TODO lives **in the code**, annotated with an issue id, and is
  **linted for staleness**. Google's style guides say the same. Duplicating TODOs as corpus items
  guarantees drift with no linter to catch it — and an item whose correct end state is *deletion* does
  not belong in a corpus whose items are versioned forever and whose lifecycle is
  draft→active→superseded.
- **`prerequisite`** is a `requirement` or `constraint` plus a `depends_on` relation. **`comment`** has
  no precedent in any format surveyed — MADR, Nygard, GitHub Issue Forms and git-bug all model
  commentary as a thread or a field on an object, never as a peer object type — and mycontext already
  has the field: the four-part `Observation` record, written by `mycontext add --note`.

**What is genuinely missing is a field, not a category: a tracker reference.** `known_issue` should be
able to name the ticket — `TRACKER-1234`, or a URL — so the corpus points at the tracker instead of
becoming one. mycontext never talks to Jira or GitHub Issues; it stores the id and a human clicks it.
Zero dependencies, and it is the join the whole R11 request is actually reaching for. A `disposition`
field on `known_issue` (`accepted` / `deferred` / `wontfix`, plus an optional workaround) is the other
defensible addition — and both are `extraFields` on an existing category, which `categories.ts` already
supports (`rule` has `directive`, `risk` has `likelihood`/`impact`).

---

## Documentation and diagram tooling

A1 has already ruled the in-app renderer: a DOM-building subset renderer, refusing raw HTML, images and
non-allow-listed URL schemes, rendering its own refusals; Mintlify refused on four grounds; the five
mermaid diagrams NOT AS PROPOSED. **I agree with all of it and will not relitigate it.** What I add is
one structural idea and its consequences.

### Emit, do not render — and put every format adapter on the export side

`[W]` GitHub renders exactly four diagram languages natively in Markdown: **Mermaid, GeoJSON, TopoJSON
and ASCII STL**, in issues, discussions, PRs, wikis and `.md` files. Everything else — D2 (Go binary),
Graphviz (C binary), PlantUML (Java), Kroki (an HTTP server) — needs infrastructure and is
**INCOMPATIBLE** for anything shipped.

But mycontext does not need to *render* mermaid to *benefit* from it. A `--format mermaid` on a
relations or coverage query emits a fenced block that renders in a pull request, in a GitHub issue, in
the README, and in every editor with a mermaid preview — with **no renderer anywhere in the product**.
That sidesteps A1's refusal entirely, because A1 refused rendering, not emitting. `--format dot` is the
same trick for the users who have Graphviz. Both are a few dozen lines.

`[W]` One caveat to write down: GitHub does not publish its Mermaid version and lags upstream releases.
Emit only long-stable diagram types — flowchart, sequence, class, state, ER — and never mindmap,
sankey, timeline or architecture.

**The general principle, and it organises the whole report:** the source of truth is fixed by
`INV-markdown-is-the-source-of-truth` and must not absorb other tools' conventions. **Export is a
projection, and a projection is exactly where format adapters belong.** So:

- `--format madr` renders an `adr` item into a MADR-shaped document → consumable by Structurizr's
  `!adrs` importer (which natively supports the `adrtools`, `MADR` and `Log4brains` formats `[W]`) and
  Backstage's ADR plugin (which parses MADR v2/v3 `[W]`).
- `--format agents-md` renders the pinned tier as an `AGENTS.md`, for the tools that read one.
- `--format obsidian` renders relation targets as `[[ID]]` wikilinks for a vault viewer.

Every one of these is **ADOPTABLE-AS-FORMAT-ONLY** and costs a renderer function each. And critically,
**none of them may run in reverse**: an import path that parses MADR or AGENTS.md would make a foreign
format authoritative over the corpus, which is the invariant's whole point.

**What must *not* be adopted inward:** MADR's numeric `NNNN-title.md` filenames (a monotonic sequence is
state mycontext does not keep and would have to, for no gain over slug ids), and wikilinks *inside*
item bodies (they change stored bytes and therefore the round trip). What *should* be adopted inward,
because it is free: **MADR's body section shape** — Context and Problem Statement / Considered Options /
Decision Outcome / Consequences — as the specimen `mycontext examples adr` prints. That is Markdown in
the body. It costs nothing and makes every ADR item recognisable to anyone who has seen one.

### The single-file viewer, and the wall it avoids

`[W]` A "one HTML file that renders a folder of Markdown" **cannot work over `file://`**: Firefox 68+
gives every `file:///` document a unique opaque origin (`privacy.file_unique_origin`, from
CVE-2019-11730) and Chrome blocks file→file fetches — MDN's error is literally "CORS request not HTTP".
Docsify's own quickstart says it needs a server. There is also no directory listing over `file://`.

`[W]` The precedent that *does* work is **Markdeep**: it works because the content is in the same file.
`[B]` The transferable conclusion is precise and useful: **a self-contained `mycontext export --html >
corpus.html`, with the corpus inlined at emit time, is buildable and is the right artefact for the R6
recipient who has nothing** — no git, no Node, no plugin. It is a second escaping surface, so it must
reuse the same allow-list discipline A1 specified, and it must be pinned by the same "what did it
refuse" footer. Rate it worth doing *after* the three below, not instead of them.

`[W]` Finally: the browser-native `Element.setHTML()` sanitizer is **not adoptable** — Firefox 148
(2026-02-24) was the first to ship the safe form, Safari has not, and it is not Baseline. With no
dependency permitted there is no DOMPurify fallback, which is precisely why A1's create-element +
`textContent` architecture is the only correct answer.

---

## Candidates, ruled

| # | Candidate | Verdict | Buys | Costs |
|---|---|---|---|---|
| 1 | **git as the corpus transport** | **ADOPTABLE** (already true, unacknowledged) | R6's whole transport, history, review, branching — free | Nothing; only that the design must *say* so |
| 2 | **`git subtree split` + `git bundle`** as the export spelling | **ADOPTABLE** `[V]` | Corpus-only single file, with history, for a non-collaborator | First subprocess in shipped code; CLI-time only |
| 3 | **`git subtree add/pull`** as import | **ADOPTABLE** `[V]` | Graft + later update, into an unrelated repo | Copies `status: active` verbatim — must be followed by a re-grade pass |
| 4 | **`git archive`** (tar, no history) | **ADOPTABLE** `[V]` | The zero-history export, for a recipient with nothing | None |
| 5 | **git submodule** for a shared corpus | **INCOMPATIBLE** | — | Detached HEAD, per-clone `submodule init`, and the corpus must be editable in place |
| 6 | **`.gitattributes` `*.md diff=markdown`** | **ADOPTABLE** `[V]` | Heading in every item diff hunk header | One line |
| 7 | **Custom `.gitattributes` merge driver** | **INCOMPATIBLE** | Would fix checksum merge noise | Needs `git config` on every clone; a plugin cannot ship it |
| 8 | **`git worktree`** as R7(3) | **ADOPTABLE** `[V]` | Fully isolated concurrent workspaces, today | Documentation only |
| 9 | **`git notes`** for injection history | **INCOMPATIBLE** | — | Not fetched by default, conflicts badly, wrong grain |
| 10 | **git (or any binary) spawned from a hook** | **INCOMPATIBLE** `[V]` | — | 10.3 ms median / 1080 ms cold vs a 50 ms p95 ceiling |
| 11 | **`git verify-commit` / `verify-tag`, `gpg.format=ssh`** | **ADOPTABLE** (optional) `[W]` | Pack attribution with no new file format, git ≥ 2.34 | Optional path; must never gate import |
| 12 | **`ssh-keygen -Y sign/verify` (SSHSIG)** | **ADOPTABLE** (optional) `[V]` | Detached signature over the manifest; present on stock Win 11 + all macOS/Linux | Proves authorship, not safety — must be said in the same sentence |
| 13 | **minisign / cosign** | **INCOMPATIBLE** `[W]` | — | Not preinstalled anywhere; a runtime dependency renamed |
| 14 | **`gh attestation verify`** | **ADOPTABLE-AS-OPTIONAL** `[W]` | Build provenance for Actions-built packs | `gh` not universal; @antv proved attestations forgeable |
| 15 | **Sigstore / npm provenance / SLSA as a gate** | **INCOMPATIBLE** `[W]` | — | 639 malicious @antv versions **passed** provenance verification (2026-05-19) |
| 16 | **A registry (npm, OCI/ORAS, or our own)** | **INCOMPATIBLE** `[W]` | — | The liability in every incident surveyed; needs a client binary and an operator |
| 17 | **Renovate-style `github>owner/repo#tag` addressing** | **ADOPTABLE** `[W]` | Registry-free pack identity + versioning, proven at scale | Unpinned sources are mutable — record the resolved sha |
| 18 | **Vale-style release-asset zip packs** | **ADOPTABLE-AS-FORMAT-ONLY** `[W]` | The non-git fallback distribution | A second path to test |
| 19 | **OPA `.signatures.json` `files[{name,hash,algorithm}]` shape** | **ADOPTABLE-AS-FORMAT-ONLY** `[W]` | A proven manifest shape to copy rather than invent | — |
| 20 | **`flake.lock` / `.terraform.lock.hcl` pin-what-you-reviewed** | **ADOPTABLE-AS-FORMAT-ONLY** `[W]` | Content-addressed pinning so a mutable source cannot change under you | A lockfile to maintain |
| 21 | **Unicode screen at import (bidi / ZW / Tags block)** | **ADOPTABLE — mandatory** `[W]` | Defeats the one attack aimed at exactly this artefact (Rules File Backdoor, Trojan Source) | ~10 lines, zero deps. Highest value per line in this report |
| 22 | **Reusing the item `checksum` as an integrity value** | **INCOMPATIBLE** `[V]` | — | 16 hex chars = 64-bit truncated SHA-256; looks like a control, is not one |
| 23 | **`origin: 'import'` + provenance in `source_*`** | **ADOPTABLE** | Honest trust grading for stranger-authored items, no schema growth | Round-trip test; `checkSourceDrift`/`checkSnapshotDrift` need an external-provenance branch |
| 24 | **Cursor `.mdc` / Copilot `.instructions.md` frontmatter** | **ADOPTABLE-AS-FORMAT-ONLY** `[W]` | Export adapters; and validation that `scope`/`always` are the converged fields | Adapters only — never an import source |
| 25 | **AGENTS.md** | **ADOPTABLE-AS-FORMAT-ONLY** `[W]` | An export target with real reach (Linux Foundation stewardship, Dec 2025) | Has **no spec at all** — cannot be authoritative over anything |
| 26 | **An LSP server, shipped** | **INCOMPATIBLE** `[W]` | — | No file-level channel in LSP; VS Code needs an extension (= build step); per-language attach vs cross-cutting globs |
| 27 | **A frozen `mycontext context --path <f> --json` contract** | **ADOPTABLE** | Lets *someone else* write the LSP server, at zero cost here | A promise not to break the JSON |
| 28 | **A VS Code extension** | **INCOMPATIBLE** | — | `.vsix` packaging + marketplace identity = build step + second channel |
| 29 | **EditorConfig as a carrier** | **INCOMPATIBLE** `[W]` | — | Fixed key set; nothing to hang items off |
| 30 | **CODEOWNERS** | **ADOPTABLE-AS-PRECEDENT** `[W]` | The interaction model for path-glob → responsible-thing, already shipped by a forge | Study it; cannot ride the file |
| 31 | **Composite GitHub Action** | **ADOPTABLE** `[W]` | CI with no build, no vendored deps, distributed by tag | Explicit `shell:` per step; runs in the caller's workspace |
| 32 | **JavaScript Action (`node24`)** | **INCOMPATIBLE** `[W]` | — | Cannot run without vendored `node_modules` or `ncc` — a build step |
| 33 | **SARIF upload** | **INCOMPATIBLE** `[W]` | — | PR annotations only appear for lines *in the diff* — the drift case gets none; GHAS required on private repos |
| 34 | **Workflow annotations + `$GITHUB_STEP_SUMMARY`** | **ADOPTABLE** `[W]` | Free, immediate PR feedback | Hard caps: 10/step/level, 50/job; 1 MiB summary — must summarise, not truncate |
| 35 | **reviewdog (`rdjsonl` emission)** | **ADOPTABLE-AS-FORMAT-ONLY** `[W]` | Real PR review comments, no annotation cap | User installs the binary in their CI |
| 36 | **Danger JS** | **INCOMPATIBLE** (adopt the pattern) `[W]` | The one-idempotent-comment, four-severity model | An npm dependency tree |
| 37 | **`pre-commit` / husky / lefthook** | **INCOMPATIBLE** `[W]` | — | Python / Node / a binary. Use `core.hooksPath` + a committed script, as documentation |
| 38 | **`lychee`, `markdownlint-cli2`** in CI | **ADOPTABLE-AS-OPTIONAL** `[W]` | Link and Markdown hygiene over docs | User-installed, CI-only, never shipped |
| 39 | **A `realm: 'repo'\|'machine'` field on `Finding`** | **ADOPTABLE** | Makes "what does CI check" answerable by reading a type | Small change across eleven checks |
| 40 | **MADR body section shape in `examples adr`** | **ADOPTABLE-AS-FORMAT-ONLY** `[W]` | Instant recognisability; alignment with the one spec still alive | Wording only |
| 41 | **MADR/adr-tools `NNNN-` numeric filenames** | **INCOMPATIBLE** `[W]` | — | A monotonic counter is state mycontext does not keep, for no gain over slug ids |
| 42 | **Structurizr `!adrs` / Backstage ADR plugin as export targets** | **ADOPTABLE-AS-FORMAT-ONLY** `[W]` | Corpus visible in an architecture tool | A renderer per target |
| 43 | **RFC 8174 ALL-CAPS keyword detector** | **ADOPTABLE** `[W]` | Exact, greppable "there is a rule hiding in this rationale item" signal | A dozen lines; no NLP |
| 44 | **`derives` relation + doctor lint for ADRs with no descendants** | **ADOPTABLE** `[W]` | Closes the tier tension; nothing in the ADR ecosystem does it | A relation type, a check, and a flow modelled on `lesson-accept` |
| 45 | **New categories `bug` / `defect` / `todo` / `comment`** | **INCOMPATIBLE** `[W]` | — | ISTQB defines bug=defect=fault identically; GitHub shipped 3 exclusive types; TODOs belong in code with an issue ref; `comment` = the existing `Observation` |
| 46 | **A tracker-reference field on `known_issue`** | **ADOPTABLE** | The join R11 is actually reaching for, with no integration | An `extraFields` entry |
| 47 | **git-bug / Fossil tickets** | **INCOMPATIBLE** | — | Would make mycontext an issue tracker; `NOGOAL` refuses it |
| 48 | **`--format mermaid` emission** | **ADOPTABLE** `[W]` | Graphs render in every PR, issue and README with no renderer shipped | Restrict to long-stable diagram types; GitHub's version is unpublished |
| 49 | **`--format dot` emission** | **ADOPTABLE-AS-FORMAT-ONLY** `[W]` | Graphviz users get layouts for free | Trivial |
| 50 | **Mermaid / D2 / PlantUML / Kroki rendering in-product** | **INCOMPATIBLE** `[W]` | — | A parser + layout engine, or a binary, or an HTTP server. A1 already ruled this |
| 51 | **MkDocs / Docusaurus / Quartz / mdBook / Docsify / Mintlify** | **INCOMPATIBLE** `[W]` | — | Build step + dependency, and `NOGOAL` says "not a documentation site generator" |
| 52 | **Markdeep-style single-file HTML export** | **ADOPTABLE-WITH-CARE** `[W]` | The R6 artefact for a recipient with no tooling; dodges the `file://` CORS wall by inlining | A second escaping surface — must reuse A1's allow-list and refusal footer |
| 53 | **`Element.setHTML()` sanitizer API** | **INCOMPATIBLE** `[W]` | — | Not Baseline; Safari has not shipped it, and no DOMPurify fallback is permitted |
| 54 | **Obsidian `[[wikilinks]]` inside item bodies** | **INCOMPATIBLE** | — | Changes stored bytes; breaks the round trip. Fine as an *export* adapter only |

---

## The three worth doing

### 1. CI as the second approval boundary — a composite action that watches the gate

**Why this one first.** §7's honest statement is that the draft/active gate is enforced by Bash
permissions and nothing else, that the permission rules are prefix matches which cannot be complete,
that a shell redirect into `.my_context/` bypasses the `PreToolUse` matcher entirely, and that hand
edit + `repair --yes` "leaves no evidence it happened." Every one of those holds on one machine. **None
of them holds in a pull request.** An agent can compose `--yes`; it cannot approve its own PR under
branch protection. And `INV-hooks-fail-open` means hooks may never block — while a CI check is the one
place in this product that **may fail closed**, because the cost of failing closed there is a red check
and a human decision, not a broken session.

**What to build.** A composite action (`runs: using: composite`, `uses: owner/my-context@v1.0.3`, no
publishing, no build) running three things:

1. **`doctor`, repo-realm only** — source drift, snapshot drift, dead scopes, orphan relations, unknown
   or disabled categories, scope-policy violations, checksum mismatches, and the `.gitignore` check.
   Requires the `realm: 'repo' | 'machine'` split on `Finding`, which improves the local report too.
2. **A gate-crossing report** — every normative item whose text changed in this PR, and every item
   whose `status` became `active`, rendered into `$GITHUB_STEP_SUMMARY` as a table with the before/after
   text. This is §7's eight-command list, observed from outside.
3. **Annotations for the findings that point at a line**, within the platform's caps (10/step/level,
   50/job) — with a single summary annotation plus the full table in the step summary when there are
   more, because silently displaying 10 of 200 findings is `INV-nothing-is-dropped-silently` broken by
   a platform limit.

Refuse SARIF: verified, it only annotates lines inside the diff, which is the wrong half of the cases.
Offer `--format rdjsonl` behind a flag for users who run reviewdog and want real review comments.

**This is also the best available answer to R10.** R10 asks for a mechanism that makes the agent use the
plugin, and correctly observes that a mechanism which merely asks gets ignored under load. CI does not
ask. It reports, in a place the agent cannot edit, to a human who has to click.

### 2. One import mechanism for R6 and R13 — pinned git source, quarantined arrival, screened text

R13 is R6's import with different provenance; building them twice would produce two trust models and
one of them would be weaker. Build one.

- **Export** = the workspace shape (`items/**` + `config.json` + a derivable `manifest.json` with full
  SHA-256 digests), plus `--select` (status, category, tag, id). Its single-file spellings are
  `git subtree split | git bundle` (verified working end to end, history intact, into an unrelated
  repo) and `git archive`. **Document the git recipe as the primary route and say plainly that git
  already does the transport** — the export command exists for the four things git cannot do:
  selection, re-grading, collision reporting, and config-as-semantics.
- **A pack is a git repo**, addressed Renovate-style (`github.com/acme/react-flavour@v1.2.0`), version =
  tag, pin = the resolved commit sha recorded in every imported item's `source_checksum`. **No
  registry, ever.**
- **Arrival is quarantine, with no exemption.** Every imported normative item lands `draft`,
  `origin: import`, regardless of signature. No `--promote-all`. The review surface gains a pack view
  instead.
- **The Unicode screen is mandatory and refuses rather than warns** — bidi controls, zero-width, Tags
  block, C0/C1 — with the offending codepoints and offsets printed. This is the cheapest and most
  important ten lines in the report, because the Rules File Backdoor is the one published attack aimed
  at exactly this artefact and **no signature scheme prevents it.**
- **Signatures are optional and honestly described.** `git verify-tag` with `gpg.format=ssh` first,
  `ssh-keygen -Y verify` over the manifest second (verified available on stock Windows 11). The
  sentence to write, and to hold to: *a verified signature means the bytes are the ones that key
  signed; it says nothing about whether the rules are correct, and it does not shorten your review
  queue by one item.*
- **Collisions report three buckets** — new / identical by `contentHash` / conflicting — and never
  overwrite silently. **Config is diffed and consented to, never copied.**

Two closed questions to record while you are there: the receiver rebuilds its own index automatically
and needs to be told nothing; and this import path is also the missing route that `mycontext init
--global` currently refuses.

### 3. Make the rationale tier earn its keep — a `derives` relation, and a lint for its absence

The tier model's sharpest weakness is that its most authoritative category is structurally unreadable
to the agent. The fix is not to move `adr` to the normative tier — that would inject prose written to
be read once by a human, under a token budget, which is exactly the failure agent-optimised-ADR
advocates describe. The fix is to make the derivation **first-class and checkable**:

- a `derives` relation from a rationale item to the normative items carrying its force;
- `mycontext adr-stage` / `adr-accept` modelled exactly on the existing `lesson-stage` /
  `lesson-accept` flow, so the human approval that already guards lesson→rule guards decision→rule too;
- a `doctor` finding for an `active` ADR with **zero normative descendants** — "this decision governs
  nothing";
- a cascade **warning** (never an automatic retirement) to descendants when an ADR is superseded, which
  is the answer to the known failure mode in this literature: a derived rule silently outliving the
  decision it came from;
- and the RFC 8174 ALL-CAPS detector as the cheap nudge — a rationale body containing a capitalised
  MUST is a rule that has not been extracted yet.

This also disposes of R11 without adding a single category. `bug`/`defect` are one concept by the only
standard that defines them and both are `known_issue` with a **disposition**; `todo` belongs in the code
with an issue reference, where four maintained tools already lint it for staleness; `prerequisite` is a
relation; `comment` is the `Observation` record that already exists. What is missing is a **tracker
reference field**, so the corpus can point at the issue tracker instead of slowly becoming one.

---

## Headline

Git already performs R6's honest export on every commit — `items/**` plus `config.json`, with `.audit/`,
`state/`, `.revisions/` and `.index.db` each self-ignoring — and `git subtree split | git bundle |
git subtree add` moves that corpus, with its history, into a stranger's unrelated repository, verified
end to end here; so an export command earns its place only through the four things git cannot do, of
which one — **re-grading a stranger's `status: active` down to `draft` on arrival** — is the whole
trust story. R13 should therefore be R6's import with a pinned git source in Renovate's address form,
no registry of any kind, an optional `ssh-keygen -Y`-verifiable signature that is described as proving
authorship and never safety, and a **mandatory, non-bypassable Unicode screen**, because the one
published attack aimed at exactly this artefact — the Rules File Backdoor — hides instructions that are
invisible in a diff and that no signature scheme would have caught. The three integrations worth
building are a **composite GitHub Action** that watches the draft→active gate from the one vantage point
an agent holding a shell cannot reach, **one import mechanism** serving R6 and R13 with quarantine and
screening at the door, and a **`derives` relation with a lint** that stops the most authoritative
category in the corpus from being the one the agent is structurally forbidden to read.
