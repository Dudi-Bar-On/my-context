---
id: REQ-an-item-s-body-can-be-read-as-a-short-numbered-summary-from
type: requirement
title: an item's body can be read as a short numbered summary, from the pane that shows it
status: active
severity: soft
always: false
summary: A long entry can be read as a short numbered summary on the spot, clearly marked as generated so nobody mistakes it for the entry itself.
summary_of: f1e71a4ab4e00a64
scope: []
tags:
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 449a270c4702e549
---

# an item's body can be read as a short numbered summary, from the pane that shows it

> Owner, 2026-08-28: *"items are displayed including their bodies using the right pane, the body is most of the time very long and tedios to read, add to the pane or other place if you think it's the correct place a button that uses the model to display a short summery of the body with numbered lines, english and hebrew symetric as always."*
>
> **The need, measured rather than taken on faith**
>
> The bodies are long, and the corpus can say by how much. Item bodies in `.my_context/items` run to 645 documents and 4,006 blocks; several of this project's own items exceed 5,000 bytes, and the handover reached 88,539 before it was cut to a pointer. The right pane shows all of it. A reader opening an item to answer one question reads a page to find a line.
>
> **Where the button goes, and why**
>
> **On the item pane, beside the body it summarises.** The alternative — a rail entry, or a separate screen — separates the summary from the thing it is about, and the reader's question is always "what does THIS item say". The pane is also where the body's length is felt, which is where the offer to shorten it belongs.
>
> **What a summary must be**
>
> * **Numbered lines**, per the owner. Numbering is not decoration here: it gives a reader something to refer to ("point 3"), which prose cannot.
> * **Short.** A summary the length of the body is not a summary. Whatever bound is chosen should be stated in the item and enforced, not hoped for.
> * **Visibly NOT the item.** This is the constraint that matters most and it is easy to lose. This corpus's whole value is that items are normative — a rule means what it says. A generated summary sitting beside an authoritative item, in the same pane, styled alike, WILL be read as the item by someone in a hurry. It must be unmistakably a derived, fallible view: its own region, its own visual register, and a statement that it is generated. A summary mistaken for a rule is worse than no summary.
>
> **WITHDRAWN by the owner, 2026-08-28** — *"cancel the english hebrew symetry, i see that in hebrew the body is in english so leave it as is, just summerize."*
>
> The reason is measured and correct: item bodies in this corpus are written in ENGLISH, and the Hebrew UI shows them in English because that is what they are. A summary of an English body is English in either language, so there is nothing to make symmetric. The three shapes below are recorded as considered-and-dropped rather than deleted, because the question will look new to the next reader.
>
> **What still follows the usual rule**: the CHROME — the button label, the heading, any refusal — is ordinary UI text with keys in both tables, like everything else. The withdrawal is about generated CONTENT, which has no key and which `strings-parity` could never have seen. If the owner meant the chrome too, that is a one-line correction here.
>
> **The symmetry question, which is not the usual one**
>
> "English and Hebrew symmetric as always" holds straightforwardly for the CHROME — the button label, the heading, any refusal message — and those go in both string tables with `{m:…}` markers where a run needs them, as everything else does.
>
> **It cannot hold the same way for the summary CONTENT, because that content is generated rather than authored.** Three shapes, and one must be chosen:
>
> 1. Generate in the reader's current language; switching language regenerates. Honest, and doubles the cost and the latency.
> 2. Generate once and show it in the language it was made in, labelled. Cheap, and asymmetric in exactly the way this project has refused elsewhere.
> 3. Generate both at once and store both. Symmetric by construction, most expensive.
>
> `strings-parity` compares key sets and cannot see any of this — generated content has no key — so whichever is chosen is a decision nothing will enforce, which is the argument for writing it down here.
>
> **Caching, keyed on something that already exists**
>
> Every item carries a `checksum` of its own content. A summary stored against that checksum is invalidated automatically and exactly when the body changes, with no second mechanism to keep in sync — the failure mode this project has met repeatedly. Do not invent a freshness rule; use the checksum that is already there.
>
> **The unresolved half: how the model is reached**
>
> The button "uses the model", and today nothing in this product does. That is a boundary question, not an implementation detail, and it is captured separately as `OPENQ-how-does-the-ui-reach-a-model-and-what-leaves-the-machine`. **This requirement is not buildable until that is answered**, and the answer changes what is built.
>
> **Done when**
>
> The item pane offers a summary of the open item's body; the summary is numbered, short by a stated bound, and unmistakably marked as generated; the chrome is symmetric across both tables; the content-symmetry shape is decided and recorded; summaries are keyed on the item checksum; and the model-access boundary is settled before any of it ships.
