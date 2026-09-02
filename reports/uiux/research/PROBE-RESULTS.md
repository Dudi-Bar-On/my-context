# Probe results — 2026-08-19, Claude Code 2.1.234

Both claims in `NEEDS-A-PROBE.md` were measured rather than reasoned about. They resolve in
**opposite directions**, which is why running them was worth it: one falsified a shipped sentence,
the other defended one.

Method for both: a scratch directory with its own `.claude/settings.json`, a real
`claude -p` run, and hooks that append their raw stdin payload to a log. Nothing touched the
owner's own configuration.

---

## P1 — `SubagentStart` fires. `README.md` §8 was false. **Corrected.**

**The claim under test:** *"There is no hook that fires at a subagent's birth for my_context to
answer."*

**Result: false as of 2.1.234.** Hooks registered on `SessionStart`, `PreToolUse`,
`SubagentStart` and `SubagentStop`; the prompt dispatched one general-purpose subagent. Five
events fired, in this order:

| # | Event | `agent_id` |
|---|---|---|
| 1 | `SessionStart` | absent |
| 2 | `PreToolUse` (tool: `Agent`) | absent — this is the **parent** dispatching |
| 3 | **`SubagentStart`** | `a154ed8dcafedf44d` |
| 4 | `PreToolUse` (tool: `Bash`) | `a154ed8dcafedf44d` — the **subagent's** own call |
| 5 | `SubagentStop` | `a154ed8dcafedf44d` |

The `SubagentStart` payload, verbatim:

```json
{
  "session_id": "64a66a7e-10ee-4d10-b512-71da8d9bbfca",
  "transcript_path": "…/64a66a7e-….jsonl",
  "cwd": "…/scratchpad/probe1",
  "prompt_id": "f018103a-4c33-4557-9543-c2284ec15c1f",
  "agent_id": "a154ed8dcafedf44d",
  "agent_type": "general-purpose",
  "hook_event_name": "SubagentStart"
}
```

**The join holds, and it is the whole point.** `SubagentStart`'s `agent_id` is *identical* to the
one the subagent's own `PreToolUse` carries. A marker written at birth is findable on the
subagent's first tool call — which is the mechanism that would let the pinned tier and the index
reach a subagent, closing a gap §8 documented as a property of the platform.

**Corrected in both READMEs**, English and Hebrew, with the measurement and the version recorded.
The section's *title* is unchanged and still true: `SessionStart` still does not fire for a
subagent, so a subagent still does not receive the session-start injection. What changed is that
there is now a hook at which my_context *could* answer. **Nothing is built on it.**

### Two things this probe found that nobody asked for

**`prompt_id` exists**, on `PreToolUse`, `SubagentStart` and `SubagentStop`. The web-UI spec's §4b
once asserted no `prompt_id` existed anywhere; the fifth pass narrowed that to *"mycontext declares
no prompt identifier"* and left the upstream question explicitly open. **It is now closed, and the
narrowing was worth doing** — the original wording would now be false.

**`PreToolUse` carries `permission_mode`, `effort` and `tool_use_id`**, none of which mycontext's
`HookInput` declares. Not defects; unclaimed surface.

---

## P2 — path-scoped rules did not apply. `README.md` §1 stands.

**The claim under test:** *"`CLAUDE.md` … is unscoped. There is no way to say 'this one applies
only to billing code'."* Research reported that `.claude/rules/*.md` with a `paths:` glob field
provides exactly that natively.

**Result: not reproducible on 2.1.234.** Three runs, one variable:

| Run | Rules present | File read | Token observed |
|---|---|---|---|
| A | one rule **with** `paths: ["billing/**"]` | `billing/prices.ts` — **inside** the glob | **none** |
| B | one rule, **no** `paths:` | `billing/prices.ts` | **present** |
| C | **both**, distinct tokens | `billing/prices.ts` | **only the unscoped rule's** |

Run B is the control and it matters: **`.claude/rules` is read by this build.** An unscoped rule
loaded and was obeyed. So the failure in A and C is specific to the `paths:` form, not to the
directory.

**What this does and does not establish.** It establishes that a rule carrying a `paths:` field did
not apply to a file inside its own glob, in this build, with this syntax. It does **not** establish
that the feature is absent — the key name or the glob form could be wrong, and I was testing an
undocumented shape reported second-hand.

**So the README bullet stands and was not changed.** Had it been rewritten on the research report
alone, a true sentence would have been replaced with a false one — which is the same defect as
leaving a false one in place, pointed the other way.

---

---

## P3 — `SubagentStart` **can inject**, not merely observe

**The claim under test:** research assumed it *"cannot inject, but a marker written at subagent
birth lets the existing `PreToolUse` deliver on the subagent's first tool call."*

**Result: it injects.** A hook returning the same envelope `PreToolUse` uses —

```json
{"hookSpecificOutput":{"hookEventName":"SubagentStart","additionalContext":"…"}}
```

— placed the text in the subagent's own context. Confirmed in the subagent's transcript, not by
asking the model:

```
"type": "hook_additional_context",
"content": ["PROJECT KNOWLEDGE (injected at subagent birth for agent_type=general-purpose): …"]
```

**So the marker workaround is unnecessary.** Pinned items and the index can be delivered directly,
**before the subagent's first tool call**, closing the gap `README.md` §8 documents.

**It can be dynamic.** The hook receives `agent_type`, `agent_id`, `prompt_id`, `cwd` and
`session_id` *before* the subagent runs — the probe text named `agent_type=general-purpose` because
the hook read it from the payload. Selection tailored per agent type is available.

**One behavioural finding worth designing around.** The subagent **noticed the injection and
flagged it as suspicious**, reporting to its parent that a hook had modified its instructions
out-of-band and suggesting the settings be checked. That is the model behaving correctly, and it is
a constraint: **injected text that reads as a bare imperative from nowhere is treated as an
attack.** mycontext's existing injections avoid this by being framed as project knowledge with
visible provenance; anything sent at `SubagentStart` needs the same framing.

---

## P4 — it blocks, and the existing dedupe key already covers it

**Blocking — measured.** A `SubagentStart` hook made to take 3,018 ms delayed the subagent's first
tool call until after it returned:

| | |
|---|---|
| hook duration | 3,018 ms (3,000 deliberate) |
| hook exit → subagent's first tool call | 3,657 ms |
| verdict | **blocking** — the subagent did not act before the hook returned |

So it sits on the critical path of **every subagent dispatch**. There is no 50 ms ceiling here —
dispatch already costs seconds — but `INV-hooks-fail-open` applies at full force: a hook that hangs
stalls every subagent, and one that throws must not prevent the dispatch.

**Double delivery — does not occur, with no change to the keying.** `ledgerKey` run against the two
*real captured payloads*:

```
SubagentStart       -> 64a66a7e-…::a154ed8dcafedf44d
subagent PreToolUse -> 64a66a7e-…::a154ed8dcafedf44d
```

Identical. A seen entry written at birth **is** read at the first tool call, so items delivered by
`SubagentStart` are correctly skipped by `PreToolUse`. The `session_id::agent_id` keying — added
for a different reason — already covers this case exactly.

---

## What is still unprobed

- **`source === 'clear'`.** `SessionStart`'s payload carries `source`, confirmed present in run 1
  (value `startup`). Observing the value `clear` needs an interactive `/clear`, which `claude -p`
  cannot produce.
- **Whether `PostCompact` fires.** Needs a real compaction.
- **Whether an exported rules file double-fires** alongside mycontext's own JIT hook — the reason
  `.claude/rules` is behind a flag in the exporter decision.
