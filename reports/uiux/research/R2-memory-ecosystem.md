# R2 — The agent-memory and context-engineering ecosystem, ruled against my_context

**Researcher:** R2 · **Date:** 2026-08-19 · **Method:** read `README.md`, `docs/TUTORIAL-ADVANCED.md`
and `.my_context/items/**` first; then web search and primary-document fetches (Claude Code docs,
modelcontextprotocol.io spec changelog, agents.md); then one local empirical probe against the
installed Node runtime. Every claim below is marked **verified** (I read it in a primary document
or executed it), **reported** (a secondary source said so and I did not confirm it), or
**believed** (my prior knowledge, cutoff May 2026, unconfirmed).

**Environment facts established locally (verified by execution):** Node **v24.14.0**,
SQLite **3.51.2** inside `node:sqlite`, Claude Code **2.1.234**. These matter because three of the
recommendations below have version floors, and this machine clears all of them.

---

## The landscape

Four things have changed in this ecosystem since my_context's architecture was settled, and three
of them are load-bearing for this product.

**1. The path-scoped rule file stopped being my_context's differentiator.** Claude Code now ships
`.claude/rules/*.md` with a `paths:` frontmatter list of globs, loaded "only when Claude works with
matching files" (verified — primary docs, `code.claude.com/docs/en/memory`). Cursor has had
`.cursor/rules/*.mdc` with `description` / `globs` / `alwaysApply` for longer (reported, consistent
across six independent 2026 write-ups). GitHub Copilot has `.github/instructions/*.instructions.md`
with an `applyTo` glob (verified — GitHub Docs). All three are the same idea as my_context's
`scope` and `always`, expressed in the same primitive: YAML frontmatter over Markdown prose.

This is uncomfortable and worth saying plainly: README §1 "Why `CLAUDE.md` alone is not enough"
argues four limits, and the second — *"It is unscoped… every rule applies to every file equally"* —
**is now false for Claude Code as shipped**. A reader on 2.1.234 can answer it with
`.claude/rules/api.md` and a `paths:` list. The other three limits survive intact and are, if
anything, sharper now: `.claude/rules` has no budget, no spill disclosure, no severity ordering, no
draft/active trust boundary, no audit of what was actually delivered, no decay reporting, no
supersession, and — verified from the same page — **path-scoped rules are explicitly not
re-injected after compaction**, which is exactly what my_context's `restored` tier does. The moat
was never the glob. It was the budget, the ledger, and the gate. The document should say so before
a reader finds the gap themselves.

**2. The trust boundary has acquired mechanisms it did not have.** README §7 publishes its own
failure modes with names — the Bash-shaped hole, the commands that cross the gate with no human.
Since then Claude Code has shipped `_meta["anthropic/requiresUserInteraction"]`, which forces a
tool's permission prompt **"even in `acceptEdits`, `auto`, and `bypassPermissions` permission
modes"** and offers no "don't ask again" (verified, verbatim, primary docs), plus MCP elicitation
(form and URL modes, no client configuration required, verified), plus `PermissionRequest` and
`Elicitation`/`ElicitationResult` hooks. §7's honesty is still correct as written — none of these
closes the shell — but the sentence *"enforced by your Bash permissions and by nothing else"* is
now a choice rather than a limit.

**3. The memory-framework market consolidated around a shape my_context deliberately isn't.**
Mem0, Zep/Graphiti, Letta, cognee, Hindsight: hosted or self-hosted services, embeddings, vector
plus graph stores, LoCoMo/LongMemEval leaderboards (reported; the accuracy numbers are vendor
claims and I did not verify any of them). Every one of them is descriptive-episodic memory —
*what happened, what the user said, what the agent learned* — retrieved on similarity. None of them
is normative, none of them has a human-approval tier, and every one is a runtime dependency plus a
network hop plus an embedding cost. `NOGOAL-not-a-claude-mem-replacement` and
`ADR-build-rather-than-adopt` have aged extremely well; nothing in this category is adoptable and
the ADR does not need revisiting.

**4. The interoperability layer standardised faster than the memory layer.** AGENTS.md is stewarded
by the Linux Foundation's Agentic AI Foundation and read by 20+ tools (verified — agents.md), but
it is deliberately *not a specification*: **"AGENTS.md is just standard Markdown. Use any headings
you like"** (verified, verbatim). Agent Skills / `SKILL.md` went from Anthropic release to ~32 tools
in three months (reported). MCP reached revision **2026-07-28** with a stateless redesign, an
extensions framework, a twelve-month deprecation policy, and — relevantly — **Roots, Sampling and
Logging all deprecated**, and elicitation folded into a new Multi Round-Trip Request pattern
(verified — the official changelog). my_context's `SUPPORTED_PROTOCOL_VERSIONS` already lists all
five revisions and its dual-era result shaping is correct; on the MCP axis this project is ahead of
almost every server in the registry, and the `tools/list` byte-stability it already implements
became a **SHOULD** in the same revision.

The synthesis: **the ecosystem has converged on Markdown-with-frontmatter as the interchange format
for normative agent knowledge, and on MCP as the transport.** my_context is already native to both.
Almost everything worth doing here is therefore an *emission* or a *protocol affordance*, not an
integration — which is exactly what a zero-dependency product is allowed to do.

---

## Candidates, ruled

| # | Candidate | What it is | What integrating buys | What it costs | Verdict | Confidence |
|---|---|---|---|---|---|---|
| 1 | **`anthropic/requiresUserInteraction`** (MCP `_meta` tool annotation) | Claude Code-proprietary `tools/list` flag forcing a permission prompt on every call, in every permission mode, with no "don't ask again"; denies in `dontAsk` | A `promote_item` / `accept_lesson` MCP tool that **cannot** be auto-approved — the first mechanism that makes "a human promoted this" a machine fact rather than a shell-permission convention | ~15 lines in `tools.ts`. Anthropic-namespaced, not portable MCP. Needs CC ≥ 2.1.199 (this box: 2.1.234). Does **not** close the Bash hole | **ADOPTABLE** | High — verbatim primary docs |
| 2 | **Emit `.claude/rules/*.md`, `.cursor/rules/*.mdc`, `.github/instructions/*.instructions.md`** | Three path-scoped rule-file formats whose frontmatter (`paths` / `globs`+`alwaysApply` / `applyTo`) is a strict subset of my_context's `scope`+`always` | my_context becomes the *source* the other agents' rule files are compiled from; one corpus governs Claude Code, Cursor, Copilot, Codex. Also neutralises "`.claude/rules` already does this" | A renderer and a `mycontext export` command. Generated files must be gitignored-or-committed deliberately and re-emitted on change; `doctor` must detect drift. Risk of double-injection with the JIT hook — needs measurement | **ADOPTABLE-AS-FORMAT-ONLY** | High on the formats; medium on double-injection |
| 3 | **`SubagentStart` hook** | Claude Code hook firing "When a subagent is spawned", payload carries `session_id`, `agent_id`, `agent_type`; matcher on agent type | Narrows README §8's *"a subagent does not receive the session-start injection"*. A marker written at subagent birth lets the existing `PreToolUse` deliver pinned + index on that subagent's first tool call | A fourth hook, a marker file, and one honest caveat retained (a subagent that touches no file still gets nothing). **It falsifies a published sentence** — §8's *"There is no hook that fires at a subagent's birth"* | **ADOPTABLE** | High that the hook exists; medium on the composition |
| 4 | **MCP elicitation** (`elicitation/create` ≤2025-11-25; `InputRequiredResult` / MRTR from 2026-07-28) | Server-initiated structured request for user input; Claude Code renders a form or URL dialog with no client config | In-session human approval of a draft, without a terminal. The trust boundary stops depending on the user remembering to run `mycontext review` | **Two** implementations, because the server is dual-era by decision. MRTR requires re-issuing the original request with `inputResponses` — real state machine work, hand-rolled | **ADOPTABLE** (with a real cost) | High it exists; **low** on which shape CC 2.1.234 negotiates |
| 5 | **`PreToolUse` `permissionDecision: "deny"` on Bash promotion commands** | my_context already ships a `PreToolUse` deny (writes into `.my_context/`); extending the predicate to `mycontext (review promote\|pin\|add --yes\|edit)` | Would close the Bash-shaped hole §7 publishes | Collides with `INV-hooks-fail-open` posture and with the human, who reaches promotion through the same tool. Needs an escape hatch or it is unusable | **ADOPTABLE, conditionally** | **Low** — the "deny works in bypass mode" claim is third-party only (see §What I could not verify) |
| 6 | **SQLite FTS5 + `bm25()` inside `node:sqlite`** | Full-text index and BM25 ranking, compiled into the Node-bundled SQLite | Ranked `query_items` / `search`; a spill list ordered by relevance rather than alphabetically; better `--path` recall | Contradicts a recorded design note in `core/search.ts` (*"A relevance score would be a claim about which item answers the question best, and there is no signal in a corpus this size to support one"*). Index is disposable so the risk is contained | **ADOPTABLE** (but argue with the existing decision first) | **Verified by execution** on this machine |
| 7 | **OTel GenAI semantic conventions + MCP `_meta` trace context** | `gen_ai.*` spans/events; 2026-07-28 documents `traceparent`/`tracestate`/`baggage` propagation in `_meta` | Audit records that join an external trace; my_context's ledger becomes readable by tooling the user already runs | Recording an inbound `traceparent` is ~5 lines and free. *Emitting* OTLP is a second thing entirely — `fetch` is built in, but it is an egress path in a product that has none | **ADOPTABLE-AS-FORMAT-ONLY** (record only) | High on the `_meta` keys; high that `gen_ai.*` is **not stable** |
| 8 | **AGENTS.md** | Linux-Foundation-stewarded root Markdown file, read by 20+ agents; explicitly no schema, no globs, no frontmatter | Reach into every non-Claude agent, cheaply | Nothing to parse *into*: no scoping, no category, no tier. Ingesting one yields untyped prose; emitting one flattens the corpus to a wall of text. Claude Code does **not** read it (verified) | **ADOPTABLE-AS-FORMAT-ONLY**, low value — emit a *pointer*, not the corpus | High |
| 9 | **Agent Skills / `SKILL.md` open standard** | Anthropic's skill format, adopted across ~32 tools | my_context's existing `skills/mycontext/SKILL.md` is already portable to Codex, Cursor, Gemini CLI, Goose at zero cost | Nothing, if the frontmatter stays to the common subset | **ADOPTABLE-AS-FORMAT-ONLY** — already effectively done | High that the standard exists; medium on the exact common subset |
| 10 | **Basic Memory** (Markdown + `- [category] content` observations + `- relation_type [[Target]]` wikilinks) | The format `ADR-build-rather-than-adopt` already borrowed | Deepening it (Obsidian graph view, `basic-memory` MCP reading the same files) is free interop for users who already run it | Only if the item renderer stays byte-identical through the round trip — `INV-markdown-is-the-source-of-truth` is the gate, not a preference | **ADOPTABLE-AS-FORMAT-ONLY** — already adopted; hold the line | High |
| 11 | **claude-mem** | Descriptive session memory: observation capture, AI summarisation, SQLite + Chroma vectors, local worker on :37777 | Nothing to integrate. It is the complement `NOGOAL-not-a-claude-mem-replacement` already names | A dependency, a daemon, a vector store, and — per one 2026 audit — an unauthenticated localhost API (**reported, single source, unverified**) | **INCOMPATIBLE** as a dependency; keep as a documented neighbour | Medium on the current state; high on the verdict |
| 12 | **Mem0 / Zep / Graphiti / Letta / cognee / Hindsight** | Hosted or self-hosted agent-memory platforms; vector+graph, temporal reasoning, LoCoMo/LongMemEval leaderboards | Similarity retrieval over episodic memory — a different product | Runtime deps, embeddings, a network hop, an API key. Adopting any is a *product identity change*, not an integration | **INCOMPATIBLE** | High |
| 13 | **Anthropic memory tool (`memory_20250818`) + context editing beta** | Client-side `/memories` filesystem tool on the Messages API; server-side clearing of stale tool results | Conceptual validation only: Anthropic's own answer to durable agent memory is *a directory of files the client owns*, which is my_context's answer | Not a plugin surface. Claude Code is the client here, not my_context | **INCOMPATIBLE** (as an integration); **strong supporting citation** for the ADR | Medium-high |
| 14 | **MCP official registry / `server.json`** | Public metadata registry; `mcp-publisher` CLI; namespace + package-ownership verification | Discoverability for the MCP server half of the plugin | A `server.json` and a publish step. Registry rules assume a published package; a plugin-bundled stdio server is an awkward fit | **ADOPTABLE-AS-FORMAT-ONLY**, distribution only, low priority | Medium |
| 15 | **Agent Client Protocol (ACP)** | Zed's JSON-RPC editor↔agent protocol; JetBrains, Neovim, Emacs; 25+ agents | Nothing today — it standardises the *agent-in-editor* seam, not the knowledge seam | An entire second protocol surface for zero current benefit | **INCOMPATIBLE** (out of scope, not hostile) | Medium |
| 16 | **`claude plugin eval`** | Claude Code's own plugin eval suites: JSON test cases, shared runner, regression gate against a committed baseline | The one thing my_context's test suite cannot do today: prove that an *injected* constraint changes what the model writes. Everything currently tested is that the right bytes were selected and rendered | An external tool the user already has; suites live beside the plugin, not inside it. Zero runtime deps | **ADOPTABLE** | Medium — I did not read the primary reference page |

---

## The three worth doing

### 1. Make "a human approved this" a mechanism, using the two affordances that now exist

README §7 is the most honest section in this document set and it costs the product something on
every read: the review gate is real on the MCP surface and evaporates the moment an agent has a
shell. §7 says so. `STD-guarantee-claims-carry-their-condition-in-the-same-sentence` exists because
somebody tried to compress that gap away and was right to be stopped.

Two mechanisms now let the gap *shrink* rather than be re-worded.

**(a) `_meta["anthropic/requiresUserInteraction"]`.** From the Claude Code MCP reference, verbatim:

> If you're building an MCP server, you can mark a tool as requiring explicit approval on every
> call by setting `_meta["anthropic/requiresUserInteraction"]` to `true` in the tool's `tools/list`
> response entry. … Claude Code shows that tool's permission prompt on every call, even in
> `acceptEdits`, `auto`, and `bypassPermissions` permission modes, and doesn't offer a "don't ask
> again" option for it. Allow rules that match the tool don't skip the prompt either. In `dontAsk`
> mode, which never prompts, Claude Code denies the call instead.
>
> Use this for tools whose permission prompt is itself the point, such as a consent or access-grant
> step where auto-approval would mean no human ever agreed.

That last sentence is a description of my_context's promotion gate written by someone who had never
heard of my_context. It is also the first thing in this ecosystem that *fails closed*: in the one
mode that never prompts, the call is denied. And there is a second clause that matters for a
distributed team — Remote Control and Agent-SDK surfaces are denied their one-tap approval for such
a tool and must render the full prompt.

This makes a genuinely new item possible: **a `promote_item` MCP tool that the model may call but
cannot self-approve.** Today the model can only print the human's command and hope; with this
annotation it can *offer* the promotion, and the human's answer to a permission dialog is what
promotes it. That is strictly better than the status quo on both axes — the human is asked in the
session where the draft was written, at the moment context is highest, and the gate is enforced by
the client rather than by the user's Bash allowlist.

It is not free of caveats and they belong in §7 the moment it ships: it is Anthropic-namespaced,
not portable MCP; it requires CC ≥ 2.1.199; a permission prompt is a weaker artefact than a typed
command (a fatigued human clicks yes); and **it does nothing about the shell**. §7 keeps its
Bash-shaped hole. What it loses is the sentence "the review gate is enforced by your Bash
permissions and by nothing else" — because on the MCP surface it would then be enforced by the
client, in every permission mode, unconditionally.

**(b) Elicitation, for the case where a prompt is not enough.** A permission dialog is yes/no.
Elicitation gives a form. `create_item` on a normative category could, instead of silently landing a
draft, elicit *"promote now, or leave as draft?"* with the rendered item shown — which converts the
review queue from a chore the user must remember into a decision offered at the moment of capture.
Claude Code renders these with no configuration on the user's side (verified).

The cost here is real and I will not undersell it: `DEC-the-mcp-server-speaks-every-revision-from-2024-11-05-to-2026-07-28`
commits the server to five revisions, and elicitation changed shape in the newest one. Pre-2026-07-28
it is a server-initiated `elicitation/create` request; from 2026-07-28 it is the Multi Round-Trip
Request pattern — return `resultType: "input_required"` with an `inputRequests` array, and the
client **retries the original request** carrying `inputResponses`, with any cross-retry correlation
encoded in the server's own `requestState` (verified — official changelog, items 7, 8 and minor 11).
That is two code paths and a resumable request, hand-rolled over stdio with no SDK. It is the most
expensive recommendation in this report. Do (a) first; it is fifteen lines and delivers most of the
value.

**(c) The `PreToolUse` deny, ruled conditionally.** The obvious third leg — extend the existing
`.my_context/` write-deny to Bash command lines that cross the gate — I am **not** recommending
without a local experiment first. The claim it rests on ("a hook returning `permissionDecision:
"deny"` blocks the tool even in `bypassPermissions` mode") appears only in third-party writeups; I
fetched the primary hooks page twice asking for verbatim text and it does not contain that sentence.
It also fights the product: the human promotes through the same Bash tool the agent does, so the
predicate cannot distinguish them, and `INV-hooks-fail-open` describes a plugin whose hooks never
stand between the user and their work. If it is built, it should be **opt-in configuration**, not
default, and §7 should describe it as narrowing the hole rather than closing it.

### 2. Compile the corpus into every other agent's rule format

This is the strategic recommendation, and it starts from an unwelcome fact: `.claude/rules/*.md`
with `paths:` globs ships in the Claude Code the user is running. The primary docs are explicit —

> Rules can be scoped to specific files using YAML frontmatter with the `paths` field. These
> conditional rules only apply when Claude is working with files matching the specified patterns.

— with brace expansion, recursive discovery, symlink support, and user-level `~/.claude/rules/`
that mirrors my_context's global layer almost exactly. A prospective user who reads README §1's
"it is unscoped" objection and then reads that page will conclude the README is out of date, and
they will be right about that one bullet.

The response is not to argue. It is to **become the thing that generates those files.** Three
targets, all of them frontmatter-over-Markdown and all of them a strict subset of what an Item
already carries:

| Target | Path | Frontmatter | Maps from |
|---|---|---|---|
| Claude Code | `.claude/rules/mycontext-<id>.md` | `paths: [glob, …]` | `scope`; absent ⇒ unconditional, which matches my_context's default `scopePolicy` exactly |
| Cursor | `.cursor/rules/mycontext-<id>.mdc` | `description`, `globs`, `alwaysApply` | `title`, `scope`, `always` — a one-to-one mapping with no lossy field |
| Copilot | `.github/instructions/mycontext-<id>.instructions.md` | `applyTo: "glob,glob"` | `scope`, comma-joined |

The renderer is Markdown string-building. There is no parser, no dependency, no build step, and no
new storage — it is `render-item.ts` with three frontmatter shapes instead of one. Everything that
makes this hard is policy, not code, and the policy questions are the interesting part:

- **Which items?** Active + normative only. A draft must never reach a file that another agent
  loads unconditionally — that is `ADR-normative-vs-rationale-tiers` and the whole trust boundary,
  and an export that leaked drafts would be the single worst bug this product could ship.
- **Double injection.** Inside Claude Code, an exported `.claude/rules` file and my_context's own
  `PreToolUse` hook would both fire on the same file touch. Either the export is off by default for
  the `.claude/rules` target (my recommendation: my_context's own tier is strictly better — it
  budgets, it discloses spill, it restores after compaction, it audits), or `select.ts` learns that
  an exported item is already in context. **This needs measuring before it is designed.**
- **Drift.** Generated files go stale the moment an item changes. `doctor` already detects drift on
  `reference` items via `source_checksum`; the same machinery applies in reverse — stamp the
  generated file with the item's checksum in a comment and let `doctor` report a stale export. This
  is `STD-documentation-is-regenerated-not-edited-to-match` applied to a second output.
- **AGENTS.md** gets a pointer, not a dump. Something like *"This project's normative rules live in
  `.my_context/items/`; run `mycontext list` to read them"* — three lines. Flattening 40 scoped
  items into an unscoped root file recreates precisely the problem §1 was written about, and
  AGENTS.md has no frontmatter to prevent it (verified: **"AGENTS.md is just standard Markdown"**).

What this buys is disproportionate to its size. Today my_context's value proposition ends at the
Claude Code boundary. With an exporter it becomes the **single authored, reviewed, budgeted,
audited corpus that every agent in the repository reads** — and the pitch changes from "a better
CLAUDE.md" to "the one place your rules are written, from which every agent's rule file is
generated". That is a much harder position to commoditise, and it is reachable with a renderer.

### 3. Take the `SubagentStart` hook, and correct §8

README §8 contains this, stated as established by measurement:

> There is no hook that fires at a subagent's birth for my_context to answer.

**There is now.** From the current Claude Code hooks reference: `SubagentStart` — *"When a subagent
is spawned"* — matched on agent type, with an input payload carrying `session_id`, `transcript_path`,
`cwd`, `hook_event_name`, `agent_id` and `agent_type`.

The measurement was honest and is now stale, which is exactly the failure mode
`LESSON-declared-but-never-consumed` and the §8 discipline exist to catch — and it cuts both ways: a
section that quarantines false capability claims must equally quarantine false *incapability*
claims, or it starts vouching for limits that vendors have removed. I would treat this as the most
urgent factual correction in the document set, ahead of any feature.

What it does **not** do, verified: `SubagentStart` cannot inject. *"SubagentStart does not support
decision control… The hook can only provide informational messages through `systemMessage` or
`terminalSequence`."* So this is not a one-line fix. But a hook is a shell command, and my_context
already has every other piece:

1. `SubagentStart` fires; the hook writes a marker keyed on `session_id` + `agent_id` — the same
   composite key the per-subagent dedupe record already uses (README §4).
2. The subagent's first `PreToolUse` — which the project has already measured as carrying both
   `session_id` and `agent_id` — finds the marker, and delivers the **pinned tier and the index**
   alongside whatever the JIT tier selected for that path, inside the same budget arithmetic, once.
3. The marker is cleared; the delivery lands in the audit log with the `agent_id` recorded, so
   `mycontext audit --session` can finally answer "what did *that subagent* see", which today it
   cannot.

The honest caveat survives and should stay in §8, narrowed: **a subagent that touches no file still
receives nothing.** But the current gap is worse than that — a subagent that touches ten files still
never sees the index or an unscoped pinned process directive unless it happens to fit the `jit`
budget. That is the part this closes, and it closes it with a marker file and a fourth hook. The
matcher is a bonus: `SubagentStart` matches on agent type, so a project could pin different items to
`Explore` than to a custom `reviewer` — a scoping axis on the *agent* rather than the file, and the
first one that would not merely duplicate what `scope`, `tags`, categories and SQL already slice
(`NOGOAL-no-domain-axis-on-items` is safe; this is a delivery condition, not an item field).

**Runner-up, named because it nearly made the list:** FTS5 with `bm25()` is compiled into the
SQLite inside `node:sqlite` on this machine — I verified it by creating a virtual table and reading
a rank back (`ENABLE_FTS5` in `pragma_compile_options()`, SQLite 3.51.2, Node 24.14.0). Zero
dependencies, disposable index, and it would let the spill list and `query_items` order by relevance
instead of by id — which is the exact defect `LESSON-alphabetical-id-became-the-priority` records.
I left it off the podium only because `core/search.ts` carries a deliberate, written argument against
ranking, and overturning a recorded decision deserves its own round rather than a paragraph in
someone else's report. But the empirical premise of that decision — *there is no signal in a corpus
this size* — is testable now, and the corpus has grown.

---

## Standards worth tracking, not adopting

- **OpenTelemetry GenAI semantic conventions.** As of mid-2026 every `gen_ai.*` attribute, span,
  metric and event still carries the *Development* stability badge, and the conventions were moved
  out of the main semconv repository into a dedicated one in June 2026 (reported, consistent across
  sources; I did not read the registry itself). Adopting a moving vocabulary into an append-only
  log that promises never to drop a record is a bad trade. **Do adopt the one stable-enough piece:**
  the 2026-07-28 spec documents W3C trace-context propagation through MCP `_meta`
  (`traceparent`, `tracestate`, `baggage`) — verified. Recording an inbound `traceparent` on an
  audit record is additive, costs nothing, and makes the log joinable later without committing to
  `gen_ai.*` naming now.
- **MCP 2026-07-28's deprecations.** Roots, Sampling and Logging are all Deprecated with a
  twelve-month minimum window. my_context uses none of them — but the *reason* matters: the
  suggested migration for Logging is "log to `stderr` (stdio) or use OpenTelemetry", which is
  already what this plugin does. Nothing to change; something to not accidentally add.
- **The MCP tasks extension** (`io.modelcontextprotocol/tasks`, moved out of core into an official
  extension). Relevant only if `ingest` ever becomes long-running. It is not today.
- **AGENTS.md.** Track its stewardship, not its schema — if the Agentic AI Foundation ever adds
  frontmatter with globs, that becomes a fourth export target overnight and the calculus changes.
- **Agent Skills / `SKILL.md`.** my_context already ships one and it is already portable. The thing
  to track is whether the common cross-tool subset of frontmatter drifts away from what
  `skills/mycontext/SKILL.md` uses.
- **The official MCP registry.** A distribution decision, not an architecture one. Worth a
  `server.json` when the plugin is published more widely; worth nothing before then.
- **ACP (Agent Client Protocol).** Adopted by JetBrains, Zed, Neovim, Emacs, 25+ agents. It
  standardises editor↔agent, a seam my_context does not sit on. Watch only for the day an ACP client
  standardises *context provisioning*, at which point this list changes.
- **`claude plugin eval`.** Not a standard, but the right external tool: it can answer the one
  question the test suite structurally cannot — *does an injected constraint change what the model
  writes?* Every existing test proves the right bytes were selected, rendered, budgeted and
  disclosed. None proves the injection worked. That is the highest-value untested claim in the
  product, and a regression-gated eval suite against a committed baseline is how it gets tested.

---

## What I could not verify

Listed because this project holds unverified external claims in contempt, and because three of the
recommendations above have a soft joint.

1. **Which MCP revision Claude Code 2.1.234 negotiates with a stdio server.** This is the open
   question `DEC-the-mcp-server-speaks-every-revision…` retired as no-longer-blocking, and it is
   *un*-retired by candidate #4: whether elicitation must be implemented as `elicitation/create` or
   as MRTR `InputRequiredResult` depends entirely on the answer. It is cheaply observable — log the
   negotiated value in the server's own audit record on first contact — and should be observed
   before any elicitation work starts.
2. **Whether `PreToolUse` `permissionDecision: "deny"` blocks in `bypassPermissions` mode.** Claimed
   by two third-party sources. I fetched the primary hooks page twice asking for verbatim text and
   it does not contain the sentence. Candidate #5 rests entirely on this; test it locally before
   designing anything on top of it. (The equivalent claim for `requiresUserInteraction` **is**
   verbatim in the primary docs — that one is solid.)
3. **Whether `PreToolUse` inside a subagent carries the same `agent_id` that `SubagentStart`
   emitted.** README §8 records that `agent_id` distinguishes subagents in the hook payload, and
   `SubagentStart`'s documented payload contains `agent_id` — but I did not observe the two side by
   side. Recommendation #3's step 2 depends on the values matching.
4. **Whether an exported `.claude/rules` file and my_context's `PreToolUse` injection double-fire on
   the same tool call.** Purely empirical, and it decides whether the Claude Code export target
   ships enabled, disabled, or at all.
5. **Every adoption and popularity number in this report.** "60,000 repositories" for AGENTS.md,
   "~32 tools" for Agent Skills, "89,753 skills" on a marketplace, claude-mem's star count and
   version — all secondary-source, all uncorroborated, none load-bearing for any verdict.
6. **claude-mem's security posture.** One February 2026 community audit reportedly rated it HIGH
   risk over an unauthenticated worker on port 37777. Single source, not confirmed. It does not
   change the verdict (INCOMPATIBLE either way), but it should not be repeated as fact — and if
   README ever cites claude-mem as a neighbour, it should cite what claude-mem *does*, not what an
   unverified audit said about it.
7. **Every memory-framework benchmark number** (Zep's LoCoMo/LongMemEval figures, Mem0's ECAI
   comparison, cognee's retrieval-mode count). Vendor and vendor-adjacent claims. None affects the
   INCOMPATIBLE ruling, which rests on the dependency constraint alone.
8. **The exact `.cursor/rules` frontmatter schema.** Six independent 2026 write-ups agree on
   `description` / `globs` / `alwaysApply`; I did not reach Cursor's own documentation. Confirm
   against the vendor before shipping that export target.
9. **`claude plugin eval`'s current interface.** I know the capability exists in this Claude Code
   installation's skill surface; I read secondary descriptions of suite shape, not the reference.

---

## Headline

The ecosystem settled on my_context's two bets — Markdown-with-frontmatter as the format for
normative agent knowledge, and MCP as the transport — which means almost nothing here needs
integrating and several things need *emitting*, and a zero-dependency product is uniquely free to do
that. Three concrete moves: annotate a new `promote_item` tool with
`_meta["anthropic/requiresUserInteraction"]`, which is the first mechanism in this ecosystem that
makes "a human approved this" enforceable in every permission mode and fails closed in the one mode
that never prompts; ship an exporter that compiles active normative items into `.claude/rules`,
`.cursor/rules` and Copilot instruction files, which is a renderer with no new dependency and turns
the corpus into the source every agent's rule file is generated from; and take the `SubagentStart`
hook, which narrows README §8's subagent gap and — more urgently — falsifies its published sentence
that no such hook exists. The uncomfortable finding is the same one that makes the exporter
valuable: Claude Code now ships path-scoped `.claude/rules` with `paths:` globs, so README §1's
"`CLAUDE.md` is unscoped" bullet is no longer true, and the differentiator was never the glob — it
is the budget, the spill disclosure, the compaction restore, the audit ledger and the draft gate,
none of which the native mechanism has.
