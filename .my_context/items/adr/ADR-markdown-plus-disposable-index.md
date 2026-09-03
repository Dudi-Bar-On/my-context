---
id: ADR-markdown-plus-disposable-index
type: adr
title: Markdown as source of truth with a disposable SQLite index
status: active
severity: soft
always: false
summary: The knowledge lives in plain text files a person can review, and the fast lookup copy beside them can be thrown away and rebuilt at any time.
summary_of: 09d16e2788f186c8
scope: []
tags:
  - architecture
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 8f4fdc6df8a3ee0d
---

# Markdown as source of truth with a disposable SQLite index

Context: the knowledge base needs both human review in pull requests and fast lookup
inside a latency-budgeted hook.

Decision: Markdown files are authoritative and committed; SQLite is a rebuildable
cache, gitignored.

Consequence: "delete the index" is a safe recovery from corruption, schema mismatch
and migration bugs — which is why byte-identical round-tripping is enforced rather
than assumed, and why a corrupt index self-heals instead of silencing the plugin.
