---
id: TASK-documentation-the-markdown-renderer-s-four-refusal-labels
type: task
title: "Documentation: the markdown renderer's four refusal labels have no key, and since walk/37 they appear on every item body"
status: active
severity: soft
always: false
summary: The notices saying an image or a link was refused are stuck in English, and they now appear inside ordinary item text everywhere.
summary_of: ae9fe4dd90abbaa7
scope: []
tags:
  - v2
  - ui
  - i18n
  - walk
  - "screen:docs"
  - "plan:walk"
  - "seq:93"
  - "state:todo"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 9a552f161873b638
plan: walk
seq: "93"
state: todo
priority: "2"
progress: "0"
needs: walk/92
source: "plan:walk seq:27, measured against src/ui/public/screens/docs.js on 2026-08-29"
---

# Documentation: the markdown renderer's four refusal labels have no key, and since walk/37 they appear on every item body

WHAT THE SCREEN IS, so it can be built without opening the mockup. `nav.read` -- **Documentation**, `<section data-p="docs">`. A **Contents** card listing five sections by ordinal beside a card that renders ONE of them, and the markdown is turned into NODES, never into an HTML string. `dv.mdnote` is the specification and it is drawn on the screen it describes: "Rendered by a hand-written subset renderer: no HTML string is ever produced, so there is nothing to sanitise. Raw HTML, images and unknown URL schemes are refused and shown as refusals, not silently dropped."

WHAT IT OWES: **the refusal labels are hard-coded English and nothing can translate them.**

`markdownNodes` in `screens/docs.js` writes four user-facing strings itself:

    `${alt} (image refused)`      -- inlineNodes, the image branch
    `${label} (link refused)`     -- inlineNodes, the unknown-URL-scheme branch
    `raw HTML block refused`      -- blocks(), the fenced/raw-HTML branch
    the `refusal` span's class is the styling; the WORDS above are its content

No `dv.*` key declares any of them, in either table. On the Hebrew page a refusal reads in English inside RTL prose -- and a refusal is precisely the sentence a reader must be able to read, because `INV-nothing-is-dropped-silently` is what it exists to satisfy.

IT IS NO LONGER ONE SCREEN'S PROBLEM. `plan:walk seq:37` pointed `screens/preview.js`'s `bodyNodes()` at this same `markdownNodes`, so these four labels now render inside ITEM BODIES on the injection preview and anywhere else a corpus body is drawn -- which is agent-authored and human-authored text, in either script, far more often than the four help topics are.

THE REASON THE FILE GIVES FOR NOT KEYING THEM HAS EXPIRED. `screens/docs.js` says declaring a key "would fail `strings-parity` in the direction that names it". That direction was dropped on 2026-08-26 -- see plan:walk seq:92, which this task waits on. There is no gate stopping this.

AND ONE DECISION TO TAKE WITH IT, not to inherit silently. `markdownNodes` RETURNS a `refusals` list and this screen deliberately does NOT draw the mockup's trailing `refused: ...` summary line, on the reasoning that it is a second telling of refusals already shown inline and would put untranslated English on the Hebrew page. Once the labels are keyed, half that reasoning is gone: decide whether the summary is drawn, and record which, rather than leaving a returned value with no caller and a comment that no longer argues for it.

DO NOT close this by deleting the labels. A refusal drawn as an empty span is the silent drop the whole renderer exists to end.
