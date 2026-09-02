---
id: KNOWN-1-0-1-interpolates-an-unvalidated-disk-read-id-into-copyable
type: known_issue
title: 1.0.1 interpolates an unvalidated disk-read id into copyable commands
status: active
severity: soft
always: false
summary: A name read straight off disk is never checked, so text hidden inside it can end up in a command a person is told to paste into their own terminal.
summary_of: 6ccb25f9a7be64e9
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-18
valid_until: null
checksum: e46e7da85e7e88c5
---

# 1.0.1 interpolates an unvalidated disk-read id into copyable commands

Demonstrated on 1.0.1. validateExplicitId has one call site (mutate.ts, the explicit-mint path); item.ts loads ids from disk verbatim. A file written directly into .my_context/items/ with id: DEC-$(echo PWNED) and NO checksum field loads with no error at all — the checksum guard only fires on files the CLI wrote and someone later edited, so against README section 7's documented shell-redirect route it does nothing.

mycontext supersede then printed: promote it with `mycontext review promote DEC-$(echo SUBSTITUTED)`. The substitution runs in the user's own interactive shell, where none of the fourteen deny rules apply — they govern the agent's Bash tool, not the human's terminal.

Needs no quoteArg; that is a v2.0 construct absent from src/ and test/. Fixed by DEC-the-id-grammar-is-applied-at-the-disk-load-boundary-refusing, shipping in 1.0.2.
