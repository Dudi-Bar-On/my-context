---
id: DEC-the-ui-asks-the-agent-already-running-nothing-leaves-the
type: decision
title: the UI asks the agent already running; nothing leaves the machine
status: active
severity: soft
always: false
summary: When a page needs something written for it, it asks the assistant already running on your machine; nothing is sent out and no account is charged.
summary_of: 8dbece68260743fd
scope: []
tags:
  - v2
  - ui
  - security
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 45d7188215d42260
---

# the UI asks the agent already running; nothing leaves the machine

> Ruled by the owner 2026-08-28, closing `OPENQ-how-does-the-ui-reach-a-model-and-what-leaves-the-machine`. That item holds the three options and what each costs; this one holds the answer.
>
> **The ruling: the UI asks the AGENT that is already in the room. Nothing leaves the machine.**
>
> Not a direct model API call. So:
>
> * **No egress.** The server keeps the property it has always had and states in its own refusal: it binds 127.0.0.1 and throws rather than warns on anything else, because *"a warning is a property claim nobody reads."* No corpus text crosses the machine boundary, and this corpus holds the project's constraints, security rulings and descriptions of its own trust boundaries.
> * **No credential.** The server never reads `~/.claude/config.json`, never holds an API key, and never spends the owner's money. A read surface acquiring the ability to bill someone is a thing that should be arrived at deliberately or not at all.
> * **Nothing new to defend.** The alternative added a first outbound request, a credential path and a rewording of what `mycontext ui` promises. None of that now exists to be got wrong later.
>
> **The cost, accepted and named**
>
> **Latency and liveness.** The summary arrives when an agent runs, not when the button is pressed. A button that sometimes does nothing for a while is a bad button UNLESS it says so — and this project has spent a day on surfaces that were correct and silent. So the control must disclose its own state: asked, waiting, answered, or *"no agent is running to answer this"*. That last one is a real state and must not render as a spinner forever.
>
> **It inverts the direction of an existing relationship.** Today the flow is agent -> corpus -> UI, plus the UI composing commands a HUMAN confirms and runs. This adds UI -> ask -> agent -> answer. The existing machinery is the right road for it: the audit log already records what was asked and what happened, and the execute/confirm boundary already exists. Do not invent a second channel beside them.
>
> **The structural digest is still measured FIRST, and is probably also the fallback**
>
> The recommendation the owner accepted included this, and it is not optional: **measure what a purely local digest delivers before deciding what the model has to add.** Many bodies in this corpus are written with bold section leads and already-numbered points; if a structural extraction gives most of the value, the model is doing less work than assumed and the latency matters less.
>
> It then composes rather than competing — and this is the shape to build unless measurement says otherwise:
>
> 1. Press the button: the **structural digest appears immediately**, locally, with no agent and no wait.
> 2. If an agent is available, the **model summary replaces it** when it arrives, visibly marked as the better answer having landed.
> 3. If no agent ever answers, the reader still has something, and the control says why it is not more.
>
> That turns the accepted cost — latency — into a progressive disclosure rather than a dead button, and it means the feature is useful on a machine with no agent running at all.
>
> **Unchanged by this ruling**
>
> `REQ-an-item-s-body-can-be-read-as-a-short-numbered-summary-from` still governs the rest: numbered lines, short by a stated bound, **visibly not the item**, cached on the item checksum that already exists, chrome in both string tables. The owner withdrew the content-symmetry requirement separately, because item bodies are written in English and a summary of one is English in either UI language.
>
> **The line that does not move**
>
> **No silent egress.** If any future change sends corpus text anywhere, the person knows before it happens. This ruling is what makes that easy to keep: there is no egress path to accidentally widen.

## Observations
- [supersession] Replaces OPENQ-how-does-the-ui-reach-a-model-and-what-leaves-the-machine: Answered by the owner 2026-08-28: option 2, the agent already in the room. No egress, no credential; the accepted cost is latency, and the structural digest is measured first and becomes the immediate fallback rather than a competing option.

## Relations
- supersedes [[OPENQ-how-does-the-ui-reach-a-model-and-what-leaves-the-machine]]
