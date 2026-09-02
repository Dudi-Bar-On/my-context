# Claims about Claude Code that would change shipped documentation — 2026-08-19

Two research agents independently reported facts that, if true, make sentences in the shipped
`README.md` **false**. Neither was verified by probe, and **neither README sentence has been
changed**, because the first of them is explicitly stated as measured and the project's standard
for an external claim is its own:

> *"Measured, not assumed: a probe hook under a real `claude -p` run…"*

Changing a measured sentence on the strength of an unmeasured report would be the same defect
pointed the other way. Each item below names the probe that would settle it.

---

## P1 — `README.md:4417` — "There is no hook that fires at a subagent's birth"

**The sentence, in context (`README.md` §8):**

> A subagent — the Task tool's separate context window — never sees the pinned tier, the index,
> or a compaction restore. This is a property of Claude Code, established by measurement rather
> than read from documentation: a probe hook under a real `claude -p` run whose prompt dispatched
> a subagent logged no `SessionStart` firing for the subagent at all … **There is no hook that
> fires at a subagent's birth for my_context to answer.**

**What two agents reported independently:** a `SubagentStart` hook event exists, carrying
`session_id`, `agent_id` and `agent_type`.

**Why the sentence may still be defensible, and why that matters.** The *measurement* it cites is
narrower than the sentence it supports. What was measured is that **`SessionStart` does not fire**
for a subagent — which is a different claim, and is not contradicted. The general sentence
("there is no hook") is the part at risk.

**What it would change if true.** More than a correction. A marker written at subagent birth would
let the existing `PreToolUse` deliver the pinned tier and the index on the subagent's **first tool
call** — closing a gap §8 currently documents as unclosable.

**The probe:** a hook registered on `SubagentStart` under a real `claude -p` run whose prompt
dispatches a subagent. Record whether it fires, and whether its `agent_id` matches the one the
subagent's own `PreToolUse` payload carries — because the marker is worthless if the two do not
join.

---

## P2 — `README.md:106` — "`CLAUDE.md` … is unscoped"

**The sentence:**

> **It is unscoped.** There is no way to say "this one applies only to billing code". Every rule
> applies to every file equally, which in practice means every rule is background noise for most
> of the work.

**What was reported:** Claude Code now ships path-scoped rule files — `.claude/rules/*.md` with a
`paths:` glob field — so scoping is available natively.

**Checked locally and inconclusive:** `C:/Users/UserC/.claude/rules` does not exist on this
machine. That proves nothing; it is a directory a user creates.

**Why this one is strategically sharper than a factual slip.** It is the **first** of the four
limits the README uses to justify the product's existence. If native scoping exists, the bullet is
false as written and the comparison needs rewriting — not deleting, because the same agent's
argument is that the remaining differentiators are real and are **not** the scoping: the budget,
spill disclosure, compaction restore, the audit ledger and the draft gate. None of those exists in
a rules file.

**The probe:** create `.claude/rules/x.md` with a `paths:` field in a scratch repository, run
`claude -p` against a file inside and outside the glob, and observe whether the rule text arrives
in each case.

---

## P3 — Reported but not load-bearing

Recorded so nobody re-researches them, and flagged as **unverified**:

- `_meta["anthropic/requiresUserInteraction"]` on an MCP tool is said to prompt the user even
  under permissive permission modes, and to deny under the most restrictive. If true it is the
  first mechanism that would make "a human approved this promotion" **enforceable** rather than a
  convention — which bears directly on R10. **Needs the MCP revision Claude Code negotiates to be
  established first**, which the agent could not determine.
- Whether `PreToolUse`'s deny decision blocks under permissive modes — third-party claim only; the
  agent reported that primary documentation lacks the sentence.
- Whether a rules file exported by mycontext would double-fire alongside mycontext's own JIT hook.

## P4 — Verified by execution, and worth knowing

`node:sqlite` on Node 24.14.0 (SQLite 3.51.2) has `ENABLE_FTS5` with a working `bm25()`. So
zero-dependency relevance ranking **is** available inside the standing constraints. It was not
recommended, on the grounds that `core/search.ts` carries a written decision against ranking —
which is the right way to decline something: on the recorded decision, not on feasibility.
