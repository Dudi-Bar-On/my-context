---
id: KNOWN-the-bare-server-url-renders-the-whole-app-and-never-says-it
type: known_issue
title: the bare server URL renders the whole app and never says it has no credential
status: active
severity: hard
always: false
summary: Visiting the plain address shows the whole application with every panel empty and never says the visitor has no key or how to get one.
summary_of: 8a1eeccc4687db86
scope: []
tags:
  - v2
  - ui
  - usability
  - security
  - owner-blocking
origin: human
source_file: null
source_anchor: null
source_checksum: d708349050033b5f
valid_from: 2026-08-28
valid_until: null
checksum: de5543683c697ee2
---

# the bare server URL renders the whole app and never says it has no credential

> `http://127.0.0.1:58888/` — the address a person bookmarks, types from memory,
> or picks out of history — is a dead end. It renders the whole application and
> never says that it has no credential or how to get one.
>
> ## What a bare visit actually shows, measured 2026-08-28
>
> Driven in a real browser against a live server, with no fragment:
>
> * the full rail — Capture, Composer, Configure, Procedures, Export / import,
>   Template packs, Documentation, Tutorials, Learn, Injection preview;
> * section headings and explanatory prose, including *"exactly what Claude gets"*
>   and *"What the most recent session was given at its start"*;
> * every data region empty.
>
> Searched for the words that would let a reader act: `nonce`, `mycontext ui`,
> `token`, `restart`, `terminal`, `expired`. **None present.**
>
> So the page reads as a working product with an empty corpus. That is a state
> this project has a standard about — `STD-a-measured-zero-is-drawn-and-named`:
> "nothing is here" and "I cannot see anything" look identical and must not.
>
> ## Why this is the important half of the 401 family
>
> The owner hit this three times in one day. Each time the diagnosis went to the
> server, the token store, the nonce, the boot ordering — and each time those were
> FINE. Proven the same day: the nonce redeemed by hand with `curl`, the full URL
> driven in a real browser (handoff POST, no 4xx, page rendered), the boot path's
> recovery listener confirmed installed before the first call that can reject.
>
> The whole failure is that **the only working entry point is a URL carrying a
> secret, and nothing on the page says so.** The owner's words:
> *"only using the URL with the fragment solved it, but user does not have this
> url only server and port."*
>
> An earlier fix made this worse in one specific way, and it was the right fix.
> Before it, a page with no credential threw during boot and rendered a chrome
> around an empty rail — visibly broken. Now it renders completely. Visibly
> broken invites a question; visibly fine does not.
>
> ## What it needs
>
> When the page has no usable credential, it must SAY so where the reader is
> looking, and name the command that produces one. That command is arriving
> separately (`mycontext ui --nonce`, owner-ruled 2026-08-28) precisely so the
> answer is a sentence a person can act on rather than "restart the server".
>
> Not a banner on every screen and not a modal: one unmistakable statement in the
> place the reader is already looking, in both languages, drawn from the same
> `sess.cold` state the shell already models rather than a new one.
>
> ## The residual after that
>
> A bookmark still lands on a locked page — it just stops lying about why. Making
> the bare URL WORK would mean the server handing a credential to any GET, which
> is the thing the whole gate exists to refuse. The dead end is by design; only
> its silence is the defect.
