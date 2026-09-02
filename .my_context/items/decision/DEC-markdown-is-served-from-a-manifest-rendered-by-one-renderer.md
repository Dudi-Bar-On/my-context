---
id: DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer
type: decision
title: markdown is served from a manifest, rendered by one renderer, and the renderer comes first
status: active
severity: soft
always: false
summary: "How written documents get shown: only from a list the program builds itself, never a path the page asks for, and by a single renderer used everywhere."
summary_of: 9c130fb7e3b9035e
scope: []
tags:
  - v2
  - ui
  - security
  - markdown
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 05312e34af2844e4
---

# markdown is served from a manifest, rendered by one renderer, and the renderer comes first

> Ruled by the owner 2026-08-28, answering the open question that had `plan:walk seq:25` blocked. Two questions were put; both are answered here.
>
> **1. What may the server serve? A SERVER-BUILT MANIFEST. No client-supplied path ever reaches the filesystem.**
>
> The owner's words: *"1 and every place a markdown content is or should be displayed including viewing files in the corpus."*
>
> So the server globs a document set at start, gives each a stable id, and answers `/api/doc/:id`. The client never sends a path.
>
> **Why this and not a contained subtree.** It preserves the exact property that makes today's route safe rather than defending against its loss. `registerReadRoutes` serves markdown for `/api/help/:topic` over a closed set of four, and *that closed set is why no traversal check was ever needed*. A manifest keeps the closed set and merely makes it larger and generated. The `../`, absolute-path and symlink tests `seq:25` enumerates are not passed — they become unreachable, because there is no path to traverse. A defence that is never needed cannot rot.
>
> Two things fall out for free: the Contents list the mockup already draws IS the manifest, and stable ids give the deep link (`#/docs/4`) that `seq:25` records as its unlanded half.
>
> **The accepted cost, stated so it is not discovered:** a document the manifest's globs do not match is invisible, with no error. The glob set becomes a thing to maintain, and "why can I not see this file" will be asked. The manifest should therefore be inspectable — the Contents list showing what it covers is the disclosure, and a document count beside it is cheap.
>
> **2. Scope: every place markdown is or should be displayed, INCLUDING corpus item files.**
>
> This is wider than `seq:25` alone and is the more consequential half of the ruling. There are two renderers in this product today and both are partial:
>
> * `markdownNodes` — the help/document renderer, measured 2026-08-25: pipe tables, block quotes, ordered lists, horizontal rules, setext headings and h4+ all fall through to paragraphs carrying their own source, and single-asterisk emphasis reaches the screen as literal asterisks.
> * `bodyNodes` (`screens/preview.js`) — item bodies. Its own header says *"Not a markdown renderer"*: two shapes, prose and `-`/`*` bullets. `plan:walk seq:37` records what the owner actually sees — blockquote markers printed as prose, landing mid-sentence.
>
> **One renderer, used everywhere markdown is shown.** Two partial renderers is two places for the same defect, and the corpus is written in markdown that neither handles.
>
> **3. The renderer is fixed BEFORE the route ships.**
>
> The owner chose this over shipping the route first. The reasoning is measurable rather than aesthetic: this project's own documents use tables, lists, block quotes and rules throughout — `reports/V2-HANDOVER.md` uses all of them — so the first document anyone opened would print its own markdown source in the middle of the page. A viewer that mangles the documents it exists to show is not worth opening on the day it ships, and "temporarily" is how a subset becomes permanent.
>
> **Ordering consequence:** `plan:walk seq:25` now `needs: walk/37`. Its block was a question for a person and is now a dependency on a task, which is the form a machine can track — `mycontext ready` will surface it the day the renderer lands.
>
> ## What this does not decide
>
> * **Which screen hosts the viewer.** `seq:25` names that as part of its open question and it is a design question, not a security one; the mockup's Contents list is the obvious candidate and the design of record is edited first either way.
> * **How far the renderer goes.** "Fix it" is not a specification. The measured gap list above is the floor; whether to reach for a full CommonMark subset or stop at what the corpus actually uses is `walk/37`'s to settle, with the same rule that has held all day — measure the corpus, do not guess at it.
