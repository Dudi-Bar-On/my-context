---
id: TASK-the-app-shell-what-it-is-and-what-implemented-means-for-it
type: task
title: "The app shell: what it is, and what implemented means for it"
status: active
severity: soft
always: false
summary: The page frame every screen is drawn inside, which owns the navigation, the one connection to the server, and the two dense information bars.
summary_of: 6c021987fd9557b4
scope: []
tags:
  - v2
  - ui
  - mockup
  - "plan:walk"
  - "seq:132"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-02
valid_until: null
checksum: 0939bd0c6d9890de
plan: walk
seq: "132"
state: done
priority: "2"
source: "plan:walk seq:27, from the header docblocks of src/ui/public/app.js on 2026-09-02"
---

# The app shell: what it is, and what implemented means for it

WHAT THE SHELL IS, so it can be built without opening the mockup. Not a screen -- the page every screen is drawn inside, and the only thing in this product that talks to the server. FOUR ROWS in a grid: a header, a provenance bar, the screen body, and a status strip; the three fixed rows are reserved from first paint, so an answer that lands late does not jump the layout.

IT OWNS THE REGISTER. Twenty-one screens, each a dynamic import so one module's error cannot take the shell down, and a rail listing all twenty-one in four groups BY TENSE. The rail is spelled out rather than derived from the register, deliberately: derived, a screen would silently leave the rail the moment its import broke, and the rail is how a person learns what exists.

IT OWNS THE DOOR. Routing is on a hash of the form hash-slash-name; the shell clears the body and hands the module a context object that is the ONE way to the server -- a token-headered read and write that throw on any refusal, ONE live stream every screen subscribes to rather than opening its own, and the string lookup that makes the language toggle reach every word. A dead credential is announced ONCE, not once per pane: twenty screens each reporting the same thing is noise, and the state is one fact.

IT OWNS THE TWO DENSE ROWS. The provenance bar carries four groups -- repo, corpus, session, audit -- and each carries a glyph AND a colour AND a name, because two of the meaning colours are the same state to a dichromat, the same grey on a monochrome printer and one system tone under forced colours: colour is the fast channel, the word is the one that always survives. The status strip is filled after the shell exists, in halves that retry independently, and refilled per group when the live stream says that group's source moved.

WHAT IMPLEMENTED MEANS: every row of the grid SAYS something at every viewport, not merely occupies its box; the rail's counts and badges drawn; the header's own controls opening what they name; and no screen reaching the server or the stream except through the context object.

Filed under plan:walk seq:27, condition 3. The shell has a build record and many defect tasks, and had no task saying what it IS.
