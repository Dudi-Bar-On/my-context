---
id: TASK-the-word-every-composed-command-starts-with-resolves-on-a
type: task
title: the word every composed command starts with resolves on a real PATH
status: active
severity: soft
always: false
summary: Every command the product tells you to run starts with a word the shell does not know; install it so that copying actually works.
summary_of: 4cf861eab9424bdf
scope: []
tags:
  - v2
  - cli
  - ui
  - packaging
  - usability
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: a5de394de909c1c7
valid_from: 2026-08-27
valid_until: null
checksum: e45eac0340c60e1a
state: done
priority: "1"
source: owner, 2026-08-27 ruling
---

# the word every composed command starts with resolves on a real PATH

> Every command this product composes begins with the word `mycontext`, and that
> word is not on the owner's PATH. All 24 palette entries build
> `['mycontext', ...]`, so the Copy button copies a string the shell rejects,
> and the 262 `mycontext ...` invocations across the READMEs, the skill and the
> recommended deny block are all wrong as written. This is the defect recorded
> in KNOWN-every-command-the-product-tells-a-user-to-run-begins-with-a.
>
> Owner ruling 2026-08-27: add a `bin` entry and link the package, so
> `mycontext` resolves for real. Chosen over composing `npx mycontext ...`
> (slower, noisier in every copy and screenshot) and over an absolute
> `node <repo>/src/cli/index.ts ...` (always correct, never portable, so it
> cannot appear in committed docs).
>
> This is not only a docs fix: it is what makes Copy honest. Execute bypasses
> the shell entirely — `execFile` with an argv array — so Execute has never had
> this problem, which is precisely why it went unnoticed for so long on the
> Copy path.
>
> Done when: `mycontext` runs from a fresh shell after the documented install,
> a test asserts the `bin` entry resolves to the CLI entry point, and the
> zero-runtime-dependency constraint is still satisfied.
