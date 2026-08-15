---
id: OPENQ-which-mcp-revision-does-claude-code-speak
type: open_question
title: Which MCP protocol revision does Claude Code actually negotiate?
status: superseded
severity: soft
always: false
scope:
  - src/mcp/**
tags:
  - mcp
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: 2026-08-14
checksum: 26fd1815a98cb35a
---

# Which MCP protocol revision does Claude Code actually negotiate?

Three revisions are live, and the newest reportedly removes `initialize` entirely in
favour of `server/discover`. That claim postdates the assistant’s knowledge cutoff
and has not been confirmed against a client. Capture what Claude Code actually sends
before implementing, and build that revision — do not build a dual-era server on an
unverified spec claim, in the riskiest hand-written code in the project.

## Observations
- [unknown] Whether a dual-era server is needed at all

## Relations
- superseded_by [[DEC-the-mcp-server-speaks-every-revision-from-2024-11-05-to-2026]]
