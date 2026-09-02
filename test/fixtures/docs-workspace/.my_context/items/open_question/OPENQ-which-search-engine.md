---
id: OPENQ-which-search-engine
type: open_question
title: Which search engine?
status: superseded
severity: soft
always: false
summary: A settled question about which search technology to use, kept because the reasoning behind the answer still matters.
summary_of: 24c5e85e11d96b04
scope:
  - src/catalogue/**
tags:
  - search
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: 2026-08-14
checksum: f4cdc7d6cd892be8
---

# Which search engine?

Catalogue search is a `LIKE` query over the titles table today, and it already takes
over a second at 40,000 titles. Decide before the autumn catalogue import doubles it.

## Relations
- superseded_by [[DEC-search-with-postgres-full-text]]
