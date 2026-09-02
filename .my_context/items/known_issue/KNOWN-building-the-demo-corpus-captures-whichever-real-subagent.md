---
id: KNOWN-building-the-demo-corpus-captures-whichever-real-subagent
type: known_issue
title: building the demo corpus captures whichever real subagent happens to be running
status: active
severity: soft
always: false
summary: Building the sample data picks up stray traces of whatever else was running at the time, and those then empty a screen that should show rows.
summary_of: 475638bdd1b402e7
scope: []
tags:
  - v2
  - fixture
  - e2e
  - demo-corpus
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: d476584171918b4c
---

# building the demo corpus captures whichever real subagent happens to be running

MEASURED 2026-08-27, after `screen-parity` went red on the `injected` screen in both browsers and stayed red when run alone.

WHAT WAS RULED OUT FIRST, each by measurement rather than by reasoning: not load (it failed alone too); not the endpoint (`apiInjected` returned 103 lines called directly); not the session list (19 sessions, newest first, itemCount 56); not the seen file (103 lines on disk); not a JavaScript error (a browser probe captured zero console errors and zero page errors).

THE CAUSE. `.demo-corpus/.my_context/state/` held 26 seen files: 25 synthetic `demo-session-*` and **one belonging to a real SUBAGENT of the live session** -- `9e5b6b17-…__a12cc1ab80a1043a0-…`, written 2026-08-26 19:25, the moment the fixture was last built.

The demo corpus is built BY RUNNING THE REAL HOOKS -- that is its whole point, and `DEC-the-ui-is-developed-against-a-simulated-corpus` records the owner rejecting a fabricated alternative in those words. So a subagent alive at build time writes its own seen file into the fixture.

WHY THAT EMPTIES A SCREEN. A subagent's ledger key is `<session>__<agent>`, so the session list derives the PARENT id from it and offers `9e5b6b17-…`. Being the newest, it becomes the default. The demo corpus has no BARE parent seen file for it, so `/api/session/<id>/injected` answers zero lines and the table draws no rows at all.

THE SCRIPT ALREADY KNEW, WHICH IS THE SHARP PART. `scripts/demo-corpus.ts` prints, every time it runs: *"25 seen files kept -- the newest session keeps its history, so Injected now lands on rows rather than on a bare table head."* It is a guarantee the script makes about its own output, and a stray file from a real session silently defeats it by becoming newer than everything the script wrote.

REBUILDING FIXES IT and the suite went 170/2 -> 172/0. But it will recur on the next build that happens while an agent is running, which is most of them.

WHAT WOULD CLOSE IT: the build should refuse or clean any seen file whose session id is not one it wrote. It knows its own ids -- they are `demo-session-*` -- so this is a filter over a set it already owns, not a new concept. And the guarantee the script prints should be ASSERTED before it is printed: it currently states a property it does not check.
