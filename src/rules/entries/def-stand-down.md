---
id: def-stand-down
kind: definition
tier: developer
title: standing an item down clears the fields that make it reach a context window
term: stand down
means: retiring an item also clears the fields that make it reach a context window — `always` back to false, `severity` back to soft — in the SAME act as the retirement, and writes an observation on the item recording what moved and why it is quiet now.
confusedWith: "deleting, and deprecating. Nothing is removed: a retired item keeps its body, relations and observations, and a retired item still exists. And `status` is the LIFECYCLE where the stand-down is the INJECTION — an item can be superseded and still be pinned if nobody stood it down, which is exactly the defect that had five superseded instructions being acted on as current on 2026-09-07."
example: `supersedeItem` computes `standDownFields` BEFORE it assigns the new status, because the note it writes has to name the values the item HAD.
check: "preventive:src/core/mutate.ts supersedeItem stands the retiree down in the same act, so retirement through any door — supersede, add --supersedes, edit --supersedes, MCP, ingest — cannot leave an item retired and still binding."
---

It is one act, deliberately. A retirement that left the pin in place would make the corpus keep
teaching a rule its own record says was replaced, and "remember to unpin it" is a human gate on a
machine problem.

The observation is the other half. A field cleared with no trace is the silent drop
`INV-nothing-is-dropped-silently` forbids, and an item somebody once pinned deserves an answer to
"why is this quiet now?" on the item itself rather than only in the audit log.
