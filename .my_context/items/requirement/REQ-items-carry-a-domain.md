---
id: REQ-items-carry-a-domain
type: requirement
title: Items carry a domain — a declared grouping above category
status: superseded
severity: hard
always: false
summary: Every entry names one area of concern, drawn from a fixed list, so a whole area can be switched off at once instead of hidden one entry at a time.
summary_of: 56cbaaa78e9b3022
scope:
  - src/core/types.ts
  - src/core/config.ts
  - src/core/store.ts
  - src/cli/**
tags:
  - schema
  - roadmap
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: 2026-09-03
checksum: 656c3b9e7118d858
kind: functional
---

# Items carry a domain — a declared grouping above category

Categories answer "what kind of statement is this". A domain answers "what area of
concern" — development, research, applicative, system. One domain per item, drawn
from a closed set declared in config.json the way categories are.

It earns a real field rather than being a tag because it does mechanical work a tag
cannot: disabling a domain in config removes its items from injection entirely, so
research notes need not reach the window during implementation work. It also filters
commands and reports.

## Observations
- [decision] Stored as an indexed column on items — not a new table, and not separate database files
- [rationale] Separate DB files were rejected: the index is disposable and rebuilt from Markdown, so splitting it multiplies rebuild cost and makes cross-domain queries a manual union, while partitioning something that was never the source of truth
- [rationale] A join table was rejected because domain is single-valued. Multi-domain would make "which budget applies" ambiguous, and ambiguity in the budget path is where silent truncation lives
- [rationale] Domain metadata belongs in config.json beside the category declarations — human-editable and reviewable in a pull request, which a DB table is not
- [decision] Domains do NOT own token budgets. That would add a dimension to every spill decision; the budget matrix stays one-dimensional
- [fact] Directory nesting is nearly free already: loadLayer walks items/ recursively, parseItem reads type from frontmatter rather than the path, and computeItemChecksum does not hash filePath — so items/<domain>/<category>/x.md loads today and re-domaining a file does not invalidate its checksum
- [boundary] Orthogonal to layer, which is about where an item lives, and to scope, which is path-based activation. Domain is conceptual grouping for items with no natural path
- [edge_case] Existing items have no domain. A default domain must absorb them, or every item written before this lands needs migrating

## Relations
- superseded_by [[NOGOAL-no-domain-axis-on-items]]
- constrains [[REQ-cli-output-is-tabular-with-detail-levels]]
