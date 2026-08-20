---
description: Record something learned, and derive candidate rules from it
argument-hint: "[what was learned, in one or two sentences]"
disable-model-invocation: true
---

Record a lesson in this project's my_context knowledge base.

What the user typed: $ARGUMENTS

1. If nothing was typed, ask what was learned and stop. A lesson is a specific thing that
   happened and what it cost — not a maxim.
2. If the USER learned it, print this command for the user to run, filled in, and stop:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" lesson "<the lesson in one sentence>"`

   Do not run that one yourself. With no flag it claims `origin: "human"`, which is the
   one claim you cannot make.
3. If YOU learned it, record it yourself. There are two honest routes, and this file used
   to say there were none:

   - **Preferred: the `create_item` tool** on the `mycontext` MCP server, with
     `type: "lesson"`. The handler stamps `origin: "agent"` itself and refuses to take an
     origin from the tool call at all, so the claim is not yours to make, to mistype or to
     forget.
   - If the MCP server is not available, the same claim from a shell:

     `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" lesson --agent "<the lesson in one sentence>"`

     `--agent` records `origin: "agent"`. This route is **weaker** than the tool: the flag
     is self-declared, so an agent that omits it is back to claiming human and nothing can
     tell. Weaker is not dishonest — it is the only shell spelling that is not.

   Either way the lesson lands **active** rather than as a draft, and that crosses no
   boundary: a lesson is **rationale** tier, and rationale is never injected into a
   session. The draft gate is for normative captures, because those are the ones that
   govern.
4. With the id in hand — from the tool's reply, or from what the user reports — the flow
   continues at `/mycontext:lesson-stage`, which is where candidate rules are derived from
   the lesson and staged for approval. Recording a lesson and approving what it obliges are
   different acts: `lesson-accept` creates a rule that governs this repository, claims
   `origin: "human"`, and has no `--agent` spelling. That one is the user's and stays the
   user's.

A lesson is worth recording on its own, even if no rule ever comes out of it. Rationale
items are never auto-injected — they are there to be found later — so recording one costs
nothing that a session has to carry.
