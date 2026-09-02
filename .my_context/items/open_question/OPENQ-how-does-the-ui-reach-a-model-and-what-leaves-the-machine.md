---
id: OPENQ-how-does-the-ui-reach-a-model-and-what-leaves-the-machine
type: open_question
title: how does the UI reach a model, and what leaves the machine
status: superseded
severity: soft
always: false
summary: An unsettled question about whether the local interface may call out to a language model, and whether project content may leave the machine.
summary_of: b983d1a0ad400687
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
valid_until: 2026-08-28
checksum: c4bbb83a193b4ee3
---

# how does the UI reach a model, and what leaves the machine

> Raised by `REQ-an-item-s-body-can-be-read-as-a-short-numbered-summary-from` (owner, 2026-08-28), which asks for a button that "uses the model". **That requirement cannot be built until this is answered, and the answer changes what gets built.**
>
> **Why this is a boundary question and not an implementation detail**
>
> Everything this product does today happens on the machine it runs on. The UI server binds 127.0.0.1 and refuses anything else — `startUiServer` throws rather than warns, because *"a bind beyond loopback exposes the corpus to the network, and a warning is a property claim nobody reads."* It has zero runtime dependencies. Its CSP forbids fetching from any external host. **It has never made an outbound request, and no corpus content has ever left the machine through it.**
>
> A summary button asks it to do all three: reach the network, carry corpus text off the machine, and authenticate while doing so.
>
> **The corpus is not ordinary text.** It holds this project's constraints, its security rulings, its known issues, and items describing exactly how its own trust boundaries work. Whatever is decided here decides where that goes.
>
> **Three ways, with what each actually costs**
>
> **1. The server calls a model API directly.**
> Fastest to build and fastest to use. It needs a credential the server does not have — the obvious source is `~/.claude/config.json`, which holds a live API key, and a read surface reading the user's API key to spend their money is a decision no one should arrive at by accident. It also makes the first outbound request in the product's history, so the loopback-only property stops being true in the way a reader currently understands it, and `mycontext ui`'s own promises would need rewording.
>
> **2. The UI asks the AGENT, which is already in the room.**
> Claude Code is running, has the corpus, and already has a relationship with this UI: the app composes commands and a person confirms them, and the audit log records what ran. A summary request could travel the same road — the UI records the ask, the agent answers it, the answer lands in the corpus or a cache. **No egress, no credential, nothing new leaves the machine.** The cost is latency and liveness: the summary appears when an agent is running, not when the button is pressed, and a button that sometimes does nothing for a while needs to say so. It also inverts the current direction of that relationship, which flows agent -> corpus -> UI and not back.
>
> **3. No model at all.**
> A structural summary — first sentence per section, the bolded leads, the numbered items already present — computed locally. Not what was asked for, and worth pricing anyway: many bodies in this corpus are written with bold section leads, so a purely structural digest may deliver most of the value at none of the cost. If it does, that is worth knowing before spending the boundary.
>
> **What must be decided, precisely**
>
> * Does corpus text leave this machine — ever, or under what conditions?
> * If yes: which credential, whose, and is the person told each time or once?
> * If no: is option 2's latency acceptable, or is option 3 enough?
> * Either way: is the summary stored in the corpus, or held outside it? A generated, fallible artefact inside a corpus whose value is that its contents are authoritative is its own small hazard — `REQ-…summary…` already requires that it be visibly not the item.
>
> **The one thing that must not happen**
>
> **Silent egress.** If corpus content is ever sent anywhere, the person must know before it happens, not discover it afterwards. This project has spent a day finding surfaces that were correct about what they measured and silent about what they missed; a surface that quietly ships the corpus to a third party would be the most expensive instance of that pattern rather than a new kind of mistake.

## Relations
- superseded_by [[DEC-the-ui-asks-the-agent-already-running-nothing-leaves-the]]
