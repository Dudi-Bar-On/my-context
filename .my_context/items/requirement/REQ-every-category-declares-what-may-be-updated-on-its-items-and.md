---
id: REQ-every-category-declares-what-may-be-updated-on-its-items-and
type: requirement
title: every category declares what may be updated on its items and how, authorable in config
status: active
severity: hard
always: false
summary: Each kind of entry states what may be changed on it and how, in a form a person can write themselves, so guidance and behaviour cannot drift apart.
summary_of: e033807e9ffc954d
scope: []
tags:
  - v2
  - categories
  - dx
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: dd5626641f6c0985
kind: functional
---

# every category declares what may be updated on its items and how, authorable in config

> Every category must declare what may be updated on its items and how, and that
> declaration must be authorable by a human in `.my_context/config.json` — not
> only in the shipped catalogue. A custom category is created by a person, and a
> category that cannot describe its own updates teaches nobody anything.
>
> WHAT A CATEGORY DECLARES TODAY, measured 2026-08-23. `CategoryDef`
> (core/categories.ts) is six fields: name, prefix, tier, defaultEnabled,
> description, extraFields. Across 23 categories only FIVE declare any extra
> fields. Nothing — not the catalogue, not the seven help topics, not
> `mycontext examples` — says what may be changed on an item or by which
> command.
>
> WHAT THAT COSTS, five things learned by trial in one session:
>
> - `state` on a task is a TAG, not a field. Nothing says so.
> - `edit --tags` REPLACES the whole list, so changing one tag silently drops
>   plan, seq and v2 unless every tag is read back first.
> - `--severity hard` on a task is refused, because task is rationale tier and
>   severity governs only on normative. The refusal is excellent and arrives only
>   after the attempt.
> - `always` has two spellings: `edit --always=true` and `mycontext pin`.
> - `source_file` has no command at all. Changing it means hand-editing
>   frontmatter and running `mycontext repair`.
>
> THE LIVE HOLE. The whole task workflow is a tag convention — plan, seq, state —
> and NOTHING VALIDATES IT. Grepped the source: no code reads or checks those
> prefixes. The corpus is clean today by discipline (180 done, 88 todo, 5 blocked;
> zero tasks missing a state tag, zero with two), not by enforcement. A
> `state:donee` typo would remove a task from every progress view and no gate
> would notice.
>
> THE SHAPE THIS REQUIRES, and why it is not prose. Written as a paragraph per
> category, this rots: four separate statements in the design of record were
> measured false in one week — a trust table that said active where the code
> lands draft, a selector behaviour that does not exist, a count of three where
> there are five, and a README claiming a shipped command does not exist. So:
>
> 1. The category DECLARES its updatable surface as data — which fields, by which
>    command, under which constraint.
> 2. The CLI's refusals READ that declaration rather than each hand-writing its
>    own sentence, so guidance and behaviour cannot disagree.
> 3. `mycontext help` and `mycontext examples` RENDER it.
> 4. A test asserts every category — shipped or config-defined — has one.
>
> TWO CONSTRAINTS ON THE DESIGN.
>
> Most update rules belong to the TIER, not the category: severity governs only on
> normative, status is rationale-only. Declaring those per category would put 23
> copies of one fact in the catalogue. Tier declares the general rules; a category
> declares only what is genuinely its own.
>
> And the config must be able to say all of it. `task` is not special-cased
> anywhere in the code — it is a catalogue entry like the rest, and its
> plan/seq/state machine is a convention layered on top by this project. A person
> adding a custom category must be able to declare the same things in
> `config.json`, in a form the loader validates and refuses clearly, or custom
> categories remain second-class and undocumented by construction.
