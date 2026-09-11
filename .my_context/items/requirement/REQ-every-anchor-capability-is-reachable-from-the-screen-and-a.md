---
id: REQ-every-anchor-capability-is-reachable-from-the-screen-and-a
type: requirement
title: every anchor capability is reachable from the screen, and a copied command is not a capability
status: active
severity: hard
always: false
summary: Everything you can do with a bookmark must be doable in the viewer itself — including setting the automatic marking going — not only by copying a command out to a terminal.
summary_of: 751b6554ca45e4b1
summary_was:
  - 2026-09-11 Everything you can do with a bookmark must be doable in the viewer itself, not only by copying a command out to a terminal.
scope:
  - src/ui/**
  - src/core/anchors.ts
  - e2e/**
tags:
  - v2
  - recall
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: 1835a11ecd8bded7
---

# every anchor capability is reachable from the screen, and a copied command is not a capability

OWNER RULING 2026-09-12, in his own words: "i want that everything relating to anchors will be
available through the ui, cli is ok, mcp too but they are not a substitution for the ui
capabilities."

WHAT IT SETTLES. Every capability the product has around anchors is reachable FROM THE SCREEN. The
CLI and the MCP surface are peers, not the place a capability lives with a screen pointing at it.
A composed command the reader must copy into a terminal is NOT the UI having the capability — it
is the UI describing one.

WHY IT NEEDED SAYING. Anchors shipped 2026-09-11 with the capability split across surfaces and the
split was never a decision: `mycontext conversation anchor` can create, label, find, list and drop
them, and the viewer can only OFFER A COMMAND TO COPY, only on a search hit, never while reading a
document. He found that by using it — he asked how to create one in the viewer and the honest
answer was that you cannot.

WHAT THIS COVERS, so nobody reads it narrowly as "add a Mark button". Every one of these is a
capability that exists today somewhere and must exist on the screen:
  — CREATE, from a search hit AND from inside a document while reading it
  — SEE, with the details an anchor carries: label, kind, origin, when, session, lane, byte
  — FIND, across the set
  — GO TO, opening the document at the marked point
  — RELABEL
  — DROP

AND THE WRITE IS THE VIEWER’S OWN, by his earlier ruling 2026-09-11. He asked why a bookmark needed
a confirm dialog and a subprocess when an anchor never touches the session file: it is a row in a
rebuildable index and an overlay, not a corpus mutation and not a shell command. So the screen
writes the row itself, through `markAnchor`/`unmarkAnchor`, and the no-writes gate takes a NARROW
exception held to a test — the shape `src/ui/maintenance/**` already uses.

WHAT THIS DOES NOT SAY. It does not say every surface must be equal in every product, and it does
not retire the CLI or the MCP path — both stay, and a lane or a script still uses them. It says a
reader must never have to leave the screen to do something the screen is about.

A SEVENTH CAPABILITY, ADDED 2026-09-12 IN THE SAME BREATH AS THE RULING, and it is the one that
was missed: "i need a trigger in the ui to initiate anchores creations if can’t do it
automatically which you told me you can."

  — RUN THE AUTOMATIC PASS, from the screen.

The distinction he is drawing is exact and the answer is that BOTH halves are true. Anchors ARE
created automatically: `markAutomaticAnchors` marks two kinds by grammar — a ruling he typed naming
a normative id, and a GFM table — and it produced 564 of the 565 anchors in this workspace. What is
missing is not the automation. IT IS THAT THE AUTOMATION ONLY EVER STARTS FROM A TERMINAL:
it runs on `mycontext conversation rebuild`, deliberately not on the Stop hook, and nothing on the
screen can set it going.

So a reader who wants his archive marked has to leave the screen to ask for it — which is this
requirement’s own defect in its purest form, and it was easy to miss because the capability is not
absent, only unreachable.

THE PASS IS SAFE TO RE-RUN AND THAT IS WHY A BUTTON IS HONEST HERE. It sweeps only what it owns:
every `origin: automatic` row is read back at its own byte, put to today’s grammar, and relabelled
or taken back; `origin: owner` rows are NEVER READ. A second run immediately after a first reports
0 new, 0 taken back, 0 relabelled — idempotent in both directions, measured 2026-09-11.

WHAT THE TRIGGER MUST SAY RATHER THAN HIDE. The pass is a whole-archive walk, so it is not free and
its cost belongs on the control: cold fill measured at 8.6 s over 307 transcripts, and the
disclosure `INV-nothing-is-dropped-silently` already requires — how many were newly marked,
relabelled and taken back — is what the screen should show when it finishes. A button that runs a
nine-second walk and says nothing is a button nobody presses twice.
