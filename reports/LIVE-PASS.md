# Live pass — my_context inside a real Claude Code session

**Date:** 2026-08-17
**Session id:** `9e5b6b17-c186-4c93-a0a5-775b4eccd9e7`
**Plugin:** `mycontext@mycontext` v1.0.0, user scope, enabled
**Claude Code:** 2.1.233 · **Node:** 24.14.0 · **OS:** Windows 11 Pro 26300
**Task:** 15 of 20

Everything in this file was observed inside a live Claude Code session, not
through the harness. Where the harness proved a binary *emits* something, this
pass proves Claude Code *delivers* it.

The corpus used is a real one created for this pass at the repository root
(`test_mycontext_plugin/.my_context/`), never the plugin's own dogfooded corpus.

---

## Summary

**22 of 22 live checks passed.** The last one — the **restored tier**, the only
injection tier that exists solely around compaction — was closed by a real
`/compact` at the end of the session. Result and method in
"[The restored tier — VERIFIED](#the-restored-tier--verified-by-a-real-compaction)".

Two new findings came out of this pass, both new to the campaign:

- **L-F1 (medium)** — the write-deny envelope does not cover `Bash`, so an agent
  with shell access can write into `.my_context/` undenied *and unaudited*.
- **L-F2 (low)** — the audit filter is spelled `actor` on the MCP tool but
  `--origin` on the CLI and `origin` in the record itself.

Nothing observed live contradicted the harness results. The behaviours that
matter most — JIT injection, the deny envelope, the draft trust boundary, and
the audit trail — all held.

---

## What fired, and what it produced

### The restored tier — VERIFIED by a real compaction

This is the check the rest of this report deferred, and it is worth stating why
it was hard to get right. **An earlier draft of this document recorded PreCompact
as "✅ verified" on the strength of an exit-0.** That was wrong. The hook had
fired, but the working directory had no `.my_context/` at the time, so it had
nothing to snapshot and correctly did nothing. An exit-0 from a hook that was
handed no work proves only that it runs — precisely the short-circuit error this
campaign exists to catch. It was downgraded to "wiring only" and left open.

It was then closed properly, as a controlled experiment.

**Method — a no-restoration baseline first.** Running the SessionStart binary
directly with `source: compact` under a *fake* session id (no seen file, so
nothing is restorable) isolates what the corpus produces from tiers other than
`restored`:

```bash
echo '{"session_id":"compact-probe-002","hook_event_name":"SessionStart",
       "source":"compact","cwd":"…/test_mycontext_plugin"}' \
  | node "$PLUGIN/src/hooks/session-start.ts"
```

**13,764 bytes.** `CONST` and `REF` in full (both pinned), `RULE` as a one-line
index entry, `1 lesson · 1 drafts pending review`.

**Then the real `/compact`,** under the true session id whose seen file held
`CONST` and `RULE` at tier `jit`. **13,943 bytes.** The complete diff against the
baseline is:

```diff
+ ### RULE-harness-cases-must-reach-the-behaviour-they-name · rule · Harness cases must reach the behaviour they name
+
+ A case that short-circuits before exercising its target records a plausible result that tests nothing. Verify each case reaches the code path in its name.
+
+ _scope: harness/**_
+
  ## my_context index
- - RULE-harness-cases-must-reach-the-behaviour-they-name · rule · Harness cases must reach the behaviour they name

  1 lesson · 1 drafts pending review
```

One variable changed (a seen file exists), one effect followed: `RULE` was
promoted out of the index into the governing section, in full, with its body and
its `_scope: harness/**_` line. Nothing else moved. **+179 bytes** is the entire
behavioural footprint of the restored tier on this corpus.

**Third, independent confirmation — the plugin says so itself.** The session's
seen file gained a line naming the tier explicitly:

```json
{"id":"RULE-harness-cases-must-reach-the-behaviour-they-name","tier":"restored","at":"2026-08-17T14:47:02.709Z"}
{"id":"CONST-evidence-must-cite-a-captured-record-id","tier":"pinned","at":"2026-08-17T14:49:12.815Z"}
{"id":"REF-campaign-handover-read-this-before-acting-on-any-finding","tier":"pinned","at":"2026-08-17T14:49:12.815Z"}
```

Note this **corrects the earlier prediction table**, which expected `CONST` at
`restored`. `CONST` did come back in full, but via `pinned` — it is a pinned
item, so it was never evidence of restoration either way. Only `RULE`
discriminates, and only `RULE` was written at `restored`.

#### The result that matters most: filtering happens on restore, not capture

PreCompact wrote `state/<sessionId>.restore.json`:

```json
{
  "sessionId": "9e5b6b17-…",
  "capturedAt": "2026-08-17T14:47:02.709Z",
  "itemIds": [
    "CONST-evidence-must-cite-a-captured-record-id",
    "CONST-live-pass-probe-of-the-agent-normative-trust-boundary",
    "LESSON-agent-created-items-must-land-as-drafts-not-active",
    "REF-campaign-handover-read-this-before-acting-on-any-finding",
    "RULE-harness-cases-must-reach-the-behaviour-they-name"
  ]
}
```

**All five ids — including the draft and the rationale item.** PreCompact is
deliberately permissive: it records what the session touched and makes no trust
decision. The gate is re-applied at restore time by SessionStart, which granted
exactly one (`RULE`) and refused the draft and the rationale item, both of which
stayed a bare `1 lesson · 1 drafts pending review`.

This is the right way round. A manifest that pre-filtered would freeze the policy
in force at capture time; because the manifest is a superset and the gate runs on
restore, **the policy in force when context is rebuilt is the one that wins** —
retier a category or reject a draft between the two events and the change is
honoured. It also means the manifest is not a leak: it stores ids, never text.

| Item | In manifest | Category tier | Status | Outcome |
|---|---|---|---|---|
| `RULE-harness-cases-…` | ✅ | normative | active | **restored, in full** ← the positive signal |
| `CONST-evidence-must-cite-…` | ✅ | normative | active | in full, but via **pinned** — proves nothing |
| `REF-campaign-handover-…` | ✅ | normative *(retiered)* | active | in full, via **pinned** |
| `LESSON-agent-created-items-…` | ✅ | **rationale** | active | **refused** → bare count |
| `CONST-live-pass-probe-…` | ✅ | normative | **draft** | **refused** → bare count |

The `LESSON` row is the sharp one. Its id *is* cited in the transcript **and it
is in the restore manifest** — so both transcript-scanning and manifest-replay
would have brought it back. Only the rationale exclusion, applied at restore,
keeps it out. That is a negative control that could genuinely have failed.

Two further things fell out of this for free:

- **The bare-count line is a live sighting of the defect the plugin's own source
  cites.** `src/core/categories.ts:50-51` explains that reducing rationale to a
  count meant "a `known_issue` reached a session as the digit … and nothing
  else", which is why that category was promoted to normative. Here it is,
  rendered: `1 lesson`.
- **Byte-identical document reproduction, confirmed a fourth time.** Stripping
  the blockquote prefix from the injected 265-line `REF` body and diffing against
  the live `reports/HANDOVER.md` returns no differences.

#### Methodological caveat for anyone repeating this

The baseline probe is **not read-only** — SessionStart writes a seen file for
whatever session id it is handed. Re-running the same probe id twice does *not*
reproduce the first result, because dedupe suppresses the second delivery. Use a
fresh id per probe and delete the artifacts afterwards (both probe seen files
were removed; `git status` is clean).

Also confirmed by this run: `${CLAUDE_PLUGIN_ROOT}` resolves correctly for an
installed plugin, so the failure mode recorded as **F2** is confined to running
inside the repo clone and does not affect installed users.

### Subagent dedupe — verified, unplanned

Dispatching eight concurrent claim-audit subagents produced eight separate seen
files alongside the parent's:

```
9e5b6b17-….seen.jsonl                        ← parent, 2 ids
9e5b6b17-…__a005e6320496c84e3-a7e0de8cbd89.seen.jsonl   ← one per subagent
… ×8
```

This is the behaviour reasoned out at `src/hooks/io.ts:29-39`: a subagent
inherits the parent's session id, so without the `agent_id` suffix a
subagent's deliveries would be recorded as if the *parent* had seen them, and
the parent would then silently never receive them. Each subagent got its own
key and its own delivery.

Each also received **only** the unrestricted `CONST` — never the
`harness/**`-scoped `RULE`, because they read `README.md` and `src/`. Eight
independent confirmations of scope discrimination, for free.

**The harness could not have produced this evidence**, since it cannot spawn
Claude Code subagents. It is live-only.

### PreToolUse — injection arm, verified

Reading `harness/baseline.mjs`, which matches the scoped rule's `harness/**`
glob, produced:

```
## my_context — these govern this project

### CONST-evidence-must-cite-a-captured-record-id · constraint · ...
### RULE-harness-cases-must-reach-the-behaviour-they-name · rule · ...
_scope: harness/**_
```

Both items delivered; the scoped one annotated with its scope. The audit log
recorded it exactly:

```json
{"kind":"injection","op":"jit","hook":"PreToolUse","path":"harness/baseline.mjs",
 "injected":[{"id":"CONST-...","tier":"jit"},{"id":"RULE-...","tier":"jit"}],"tokens":136}
```

**Scope discrimination verified.** `harness/**` matched the nested
`harness/lib/mcp.mjs` under `query_items --path`, and did not match
`reports/` or repository-root files.

**Per-session dedupe verified.** Subsequent reads injected nothing. This is by
design — `pre-tool-use.ts:182` reads a per-session *seen file* and
`appendSeen` (:302) records what was delivered. An item injects **once per
session**, not once per matching read.

> Worth documenting prominently. "JIT injection stopped working" is the natural
> misreading, and it is the single most likely false bug report from users.

### PreToolUse — deny arm, verified

A `Write` into `.my_context/items/` was refused:

> ``.my_context/items/`` is managed by my_context. Writing the file directly
> leaves the SQLite index and the item checksum stale, and bypasses the review
> boundary that keeps agent-authored normative items out of injection. Create
> items with the `create_item` MCP tool […]

A `Write` to `.my_context/config.json` was refused separately, with a different
and better-judged message:

> Configuration changes to `.my_context/config.json` are the user's to make —
> ask, do not edit.

Both produced `kind:"hook", op:"deny"` audit records. The refusals name the
correct alternative tools rather than just blocking, which is the difference
between a guardrail and an obstacle.

### PostToolUse — verified, both directions

With `watchedDocs: ["docs/**/*.md"]` configured, writing
`docs/superpowers/live-pass-probe.md` produced:

> You edited docs/superpowers/live-pass-probe.md. If it set a new requirement,
> decision or constraint, capture it now with create_item (source_file: the path
> above). Skip if nothing new was decided.

Writing `reports/.live-pass-tmp.md` — same extension, outside the glob —
produced **nothing**, and left **no audit record**. The glob discriminates, and
non-matches generate no audit noise.

---

## The trust boundary

The draft/active boundary is the plugin's central safety claim, and it holds —
with the **category tier** as the discriminator, not the author alone:

| Created by | Category | Tier | Result |
|---|---|---|---|
| Human (CLI) | `constraint` | normative | **active** |
| Human (CLI) | `rule` | normative | **active** |
| Agent (MCP `create_item`) | `lesson` | rationale | **active** |
| Agent (MCP `create_item`) | `constraint` | normative | **draft** |

The draft refusal explains itself and hands over the exact remedy:

> It is a draft because non-human-authored normative items are not injected
> until reviewed — a human can promote it with
> `mycontext review promote CONST-…`

`list_drafts` then returned that item correctly. **This closes a known harness
gap** — Task 11 could not test `list_drafts` meaningfully because its fresh
workspaces contained no drafts.

Provenance in the audit log is accurate throughout: CLI creates recorded
`origin:"human"`, MCP creates recorded `origin:"agent"`.

---

## L-F1 — the write-deny envelope does not cover Bash

**Severity:** medium · **Surface:** `hooks/hooks.json:18` · **Scope:** all platforms

The `PreToolUse` matcher is `Read|Edit|MultiEdit|Write|NotebookEdit`. `Bash` is
absent. An agent with shell access therefore writes into the corpus freely:

```bash
printf '{...}' > .my_context/config.json      # succeeded, no refusal
printf -- '---\nid: CONST-rogue...' > .my_context/items/constraint/CONST-rogue-smuggled.md
```

Both succeeded. Neither produced an audit record, because the hook never ran.

**Detection is partial.** `mycontext doctor` caught both item-level problems,
and its checksum message is exemplary:

> checksum mismatch […] recorded `78f6ed3d…`, content hashes to `6bc8949c…`.
> What is known is only that the file's content no longer matches the checksum
> recorded in it — an edit outside my_context is one cause, but so is content
> my_context itself could not round-trip, in which case part of this item's text
> may already have been lost. Compare it against git history before rewriting it.

That is `INV-nothing-is-dropped-silently` working exactly as intended: it
separates what is *known* from what is *inferred*, and warns of possible loss.

But `config.json` carries no checksum, so a shell edit to it is **undenied,
unaudited, and undetected**. Since `config.json` controls `budgets` and
`watchedDocs`, it controls what gets injected.

**This is not "the guardrail is broken."** Intercepting `Bash` would mean
parsing arbitrary shell — fragile and trivially evaded via `tee`, `python`,
heredocs or redirection. Prevention is the wrong layer.

**Suggested fix — documentation, not code.** README:2291-2295 says *"Every
mutation is recorded"* and describes *"the write-deny that stops a tool writing
into `.my_context/` directly."* Both are true for my_context-mediated
operations and for file tools. Neither is true for shell writes. State the
envelope's actual boundary so users calibrate their trust:

> The write-deny covers Claude Code's file tools. It cannot cover `Bash`;
> out-of-band writes are caught after the fact by `mycontext doctor`'s checksum
> check, which is why `doctor` is worth running after unusual sessions.

Optionally: have `doctor` warn when `config.json`'s mtime is newer than the
newest audit record, which flags out-of-band config edits without preventing
the hand-editing the plugin explicitly asks users to do.

---

## L-F2 — `actor` on MCP, `origin` on CLI and in the record

**Severity:** low · **Surface:** MCP `audit_log` schema vs `audit.ts` · **Scope:** all platforms

One concept, two names across three surfaces:

| Surface | Name |
|---|---|
| MCP `audit_log` parameter | `actor` |
| CLI flag (README:2302) | `--origin` |
| Audit record field | `"origin"` |

`audit_log(actor: "agent")` works and filters on the `origin` field. Because
every tool declares `additionalProperties: false`, a model that reads `origin`
in the records — the natural inference — and passes `origin` gets refused.

**Suggested fix:** rename the MCP parameter to `origin` for consistency with
both the record and the CLI. If the name must stay for compatibility, accept
both and document the alias.

---

## Verified-correct, live

Recorded so the tutorial can rely on them.

| # | Behaviour | Result |
|---|---|---|
| L1 | MCP server connects via Claude Code's own client | ✅ |
| L2 | All 14 MCP tools exposed with full schemas | ✅ |
| L3 | 66 slash commands registered | ✅ |
| L4 | `mycontext` skill + `LoadMyContext` skill registered | ✅ |
| L5 | JIT injection delivers correct items with scope annotation | ✅ |
| L6 | Scope globs match nested paths, reject non-matches | ✅ |
| L7 | Per-session seen-file dedupe | ✅ by design |
| L8 | Deny on `.my_context/items/` | ✅ |
| L9 | Deny on `.my_context/config.json` | ✅ |
| L10 | PostToolUse nudge on watched doc | ✅ |
| L11 | PostToolUse silent off-glob, no audit noise | ✅ |
| L12 | PreCompact writes a restore manifest of every id the session touched | ✅ |
| L25 | Every subagent gets its own dedupe key | ✅ |
| L13 | Agent normative capture → draft | ✅ |
| L14 | Agent rationale capture → active | ✅ |
| L15 | `list_drafts` returns the draft | ✅ |
| L16 | Audit provenance human vs agent | ✅ |
| L17 | Audit records every hook action | ✅ |
| L18 | `doctor` detects checksum tampering | ✅ |
| L19 | `doctor` detects malformed smuggled items | ✅ |
| L20 | `focus_context --preview` reports cost, changes nothing | ✅ |
| L21 | `pin` preview shows before/after and consequence | ✅ |
| L23 | Checksums survive a CRLF git round-trip on Windows | ✅ |
| L24 | `.my_context/.gitignore` excludes only the derived index | ✅ |
| L22 | SessionStart(`compact`) restores a seen normative item in full | ✅ |
| L26 | Restore gate refuses a draft and a rationale item **present in the manifest** | ✅ |
| L27 | Restore manifest stores ids only, never item text | ✅ |

### L23 in detail — a near-miss worth recording

This machine has `core.autocrlf=true`, and our repository has no
`.gitattributes`. Deleting an item and restoring it with `git checkout` brought
it back with **22 CRLF lines and 0 LF lines** — the bytes on disk genuinely
changed.

`mycontext doctor` still reported **0 errors**. The checksum is computed over
line-ending–normalized text (`normalizeEol`, applied in `core/mutate.ts:199`
before hashing, with the reasoning spelled out at `mutate.ts:193-228`).

This was on its way to being reported as a high-severity Windows defect —
"every item's checksum breaks after a clone." It is the opposite: a deliberate,
commented design decision that makes a committed corpus survive cross-platform
round-trips. `doctor` demonstrably does catch real content changes, having
flagged an appended line minutes earlier, so the pass is meaningful rather than
vacuous.

Worth stating positively in the README: **a `.my_context/` corpus is safe to
commit and share across Windows, macOS and Linux.** That is a real selling
point for a tool whose whole premise is a git-tracked Markdown corpus, and it
currently goes unclaimed.

---

## Smaller observations

- **No `init` slash command.** The 66 commands contain no `init`; bootstrapping
  a corpus is CLI-only. The tutorial must open with the CLI, not a slash command.
- **`plugin details` counts commands as skills.** It prints `Skills (67)` —
  66 commands plus the one real skill — and has no commands line. A Claude Code
  display conflation, not a plugin defect. It does confirm **README:1780's
  "the 38 commands" is wrong**; there are 66 (finding D22).
- **`add <category> --help` is refused** with `unknown option "--help"`, though
  the usage line prints anyway, so the user is not stranded.
- **`doctor`, `status` and `query` all exit 1** on corpus load errors. The
  README makes no exit-code claim, so this is undocumented behaviour rather
  than a contradicted one — worth documenting for scripting users.
- **Always-on cost measured at ~1,643 tokens** per session.
- **The MCP command path contains a doubled separator** —
  `…/my-context//src/mcp/server.ts` — cosmetic only; the server connects.

---

## Corpus state left behind

Created at `test_mycontext_plugin/.my_context/` during this pass:

| Id | Status | Why it exists |
|---|---|---|
| `CONST-evidence-must-cite-a-captured-record-id` | active, **pinned** | SessionStart test after restart |
| `RULE-harness-cases-must-reach-the-behaviour-they-name` | active, scope `harness/**` | JIT injection test |
| `LESSON-agent-created-items-must-land-as-drafts-not-active` | active | rationale-tier boundary test |
| `CONST-live-pass-probe-of-the-agent-normative-trust-boundary` | **draft** | normative-tier boundary test |

`config.json` carries `watchedDocs: ["docs/**/*.md"]`. All tampering was
reverted and `doctor` reports **0 errors, 0 warnings**. Removal is part of
Task 20, and only with the user's agreement.
