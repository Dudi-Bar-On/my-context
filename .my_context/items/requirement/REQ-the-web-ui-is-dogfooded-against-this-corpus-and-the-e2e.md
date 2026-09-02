---
id: REQ-the-web-ui-is-dogfooded-against-this-corpus-and-the-e2e
type: requirement
title: The web UI is dogfooded against this corpus, and the e2e tests run on real data
status: active
severity: soft
always: false
summary: The application is used and tested against this project's own real data, at the size that really occurs, rather than against a small sample.
summary_of: 559829fedac045c0
scope: []
tags:
  - v2
  - ui
  - dogfooding
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 648e6d1028180252
---

# The web UI is dogfooded against this corpus, and the e2e tests run on real data

Instruction from the owner, 2026-08-22, for the moment the real frontend renders.

The UI is used exactly as the plugin is used: this repository's own corpus - the campaign corpus, 200-plus items with real tasks, rules, lessons and a live audit log - is what it displays and manipulates. Not a fixture, not a seeded demo workspace.

Two consequences that are the point rather than a side effect:

1. Every screen is exercised against data that actually exists, at a size that actually occurs. A coverage view over four fixture items proves nothing about a coverage view over two hundred, and the tier and budget screens only mean something against a corpus that really spills.

2. The Playwright tests run on that data. e2e today drives the mockup, which carries hand-written sample markup; the product's own screens must be driven against the served corpus, so a screen that renders an empty state when the data is there fails rather than passes.

What this does NOT license: the UI is a read surface. Manipulation is composed as a command the user pastes into their own shell - lib/command.js exists for that and is proved unable to run, send or navigate. Dogfooding the display does not make the UI a writer.

One thing to settle when it lands: an e2e suite that reads the live corpus is a test whose fixtures change under it. Either the tests assert shapes rather than values, or a snapshot of the corpus is pinned for them. That is a design decision, not a detail.
