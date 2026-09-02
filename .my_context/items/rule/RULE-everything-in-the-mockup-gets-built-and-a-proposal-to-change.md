---
id: RULE-everything-in-the-mockup-gets-built-and-a-proposal-to-change
type: rule
title: Everything in the mockup gets built, and a proposal to change it needs a screenshot
status: active
severity: hard
always: false
summary: Anything the design shows has to be built rather than quietly skipped when it is hard, and anyone proposing to change the design must show a picture of it.
summary_of: 67f8a4c0ed799a1f
scope: []
tags:
  - v2
  - ui
  - governance
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 89f5201e32efc22f
---

# Everything in the mockup gets built, and a proposal to change it needs a screenshot

Owner ruling, 2026-08-22.

The mockup is approved. The owner ruled it screen by screen in a live browser, and docs/design/web-ui-mockup.html says of itself that it is THE SPECIFICATION FOR THE UI and that where it and a spec disagree about appearance, the file wins.

Two consequences, and neither is optional.

FIRST: if something appears in the mockup and the implementation cannot draw it, that is not permission to skip it. Find the way to build it. When an endpoint does not carry what a view needs, the answer is to extend the endpoint, not to ship a weaker chart or an absence. Four charts were skipped this way on 2026-08-22 - the gate ladder, the tier ribbon, the admission staircase, the spill ratio - and the owner ruled that all four get their data rather than staying absent. Stopping to ask is right; treating the absence as the answer is not.

SECOND: a proposal to change the mockup must carry a SCREENSHOT. The owner's words: just text is not enough for me. A described change is a change nobody has seen. Render it, capture it, and show the before and the after - then the owner decides. This applies to an agent that believes the mockup is wrong, and to a reviewer proposing a better treatment.

Practical note for anyone doing this: file:// is blocked for the MCP browser tool, so serve the file over a local static server, or drive the project's own @playwright/test directly - both are established practice here and both are in the repaint agents' reports.

STILL TRUE, and now it is the mockup s MAIN job rather than one of two. `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap` keeps exactly this direction -- something the design drew that the app has not built is still a gap and still fails a suite -- while dropping the requirement that the app be drawn in the mockup first. The one qualification the ruling adds: a difference is a gap only where the mockup was RIGHT. The PROPOSED badges are the owner s own example of a difference that is a decision.
