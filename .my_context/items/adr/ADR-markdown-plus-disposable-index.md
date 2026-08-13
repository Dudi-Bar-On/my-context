---
id: ADR-markdown-plus-disposable-index
type: adr
title: Markdown as source of truth with a disposable SQLite index
status: active
severity: soft
always: false
scope: []
tags:
  - architecture
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 2eea171d801bf066
---

# Markdown as source of truth with a disposable SQLite index

Context: the knowledge base needs both human review in pull requests and fast lookup
inside a latency-budgeted hook.

Decision: Markdown files are authoritative and committed; SQLite is a rebuildable
cache, gitignored.

Consequence: "delete the index" is a safe recovery from corruption, schema mismatch
and migration bugs — which is why byte-identical round-tripping is enforced rather
than assumed, and why a corrupt index self-heals instead of silencing the plugin.
