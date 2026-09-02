---
id: OPENQ-is-m-corpus-syntax-or-an-accident-and-should-the-item-pane
type: open_question
title: "is {m:...} corpus syntax or an accident, and should the item pane render it"
status: active
severity: soft
always: false
summary: Is a piece of markup running through many entries a real convention worth displaying, an accident to clean up, or something to simply leave alone?
summary_of: dc24f329e87aca94
scope: []
tags:
  - v2
  - ui
  - corpus
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 10428cffffe18133
---

# is {m:...} corpus syntax or an accident, and should the item pane render it

> Found by `plan:walk seq:37` while building the one markdown renderer, 2026-08-28. Measured, not estimated.
>
> **The measurement**
>
> **`{m:…}` appears 1,541 times across 186 of 645 item bodies — 29% of the corpus.** It reaches the item pane as literal text: braces, prefix and all.
>
> `seq:37` deliberately did not render it, and the reasoning is sound enough that it should be the owner's to overturn rather than an implementer's to assume:
>
> * **It is not markdown.** It is this project's own string-table slot syntax (`{m:…}` monospace, `{v:…}` value, `{b:}`/`{i:}` emphasis), borrowed by whoever wrote those items as a convention for "this is an identifier". The ruling that governs `seq:37` says ONE renderer for markdown, and this is not markdown.
> * **Rendering it would corrupt real content.** Items in this corpus DISCUSS the string-table syntax — `bidi.spec.ts`, `live-invalidation.js` and the i18n grammar are all subjects here. An item explaining what `{m:…}` means would lose its braces to a renderer that treated them as a marker, and the explanation would become unreadable in exactly the items where it matters most.
>
> **The question**
>
> Three answers, and the middle one is probably right but is not the assistant's to choose:
>
> 1. **Render it.** The item pane treats `{m:…}` as monospace like the string tables do. Cleanest reading for 186 items, and it breaks every item that talks about the syntax — the classic markup-versus-mention problem, with no escape convention in the corpus today.
> 2. **Leave it, and stop writing it.** The braces are a habit that leaked from the string tables into item bodies where nothing consumes them. Backticks already mean monospace in markdown and now render correctly. Convert the 1,541 occurrences to backticks, and the item pane is right with no renderer change and no mention problem.
> 3. **Leave it entirely.** Accept literal braces on 29% of items. Cheapest, and it means the most-read surface in the product displays authoring syntax as prose — which is the same defect `seq:37` just spent a day fixing for `>`.
>
> **What makes this worth a decision rather than a task**
>
> Answer 2 is a corpus-wide edit of 1,541 occurrences in 186 items — mechanical, but it rewrites a third of the corpus's bodies, and `upkeep/8` records what happened the last time item bodies were rewritten in bulk without care.
>
> Answer 1 is a renderer change with a known, unsolved failure mode.
>
> Either way the choice determines whether `{m:…}` is a THING THIS CORPUS WRITES or a thing it merely inherited by accident, and that is a statement about the project's own conventions.
>
> **Not in question**
>
> Backticks work correctly now, in every surface, after `seq:37`. Anything written from here on can use them and needs no decision.
