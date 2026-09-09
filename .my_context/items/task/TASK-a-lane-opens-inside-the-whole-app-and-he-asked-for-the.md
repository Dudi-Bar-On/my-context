---
id: TASK-a-lane-opens-inside-the-whole-app-and-he-asked-for-the
type: task
title: a lane opens inside the whole app, and he asked for the transcript alone in a window
status: active
severity: soft
always: false
summary: Opening a helper agent gives you just the transcript in its own window, without the rails and bars of the surrounding application.
summary_of: 672c4f6b137d944f
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/server.ts
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:51"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 4a6ff6b542ca5974
plan: archive
seq: "51"
state: todo
priority: "1"
needs: archive/15
---

# a lane opens inside the whole app, and he asked for the transcript alone in a window

Owner ruling 2026-09-09, correcting what he meant by a new tab: "you did opened it on a new tab but
what you did is actually another tab of mycontext with focus on the viewer where the linked
transcript was opened, what i meant is to only see the viewer with the transcript in it as a single
window without all the app arround it".

SO seq:15 SOLVED A DIFFERENT PROBLEM FROM THE ONE HE WAS DESCRIBING. It made the reader position
impossible to lose by never unmounting the document - measured, scrollTop 299,226 before and after -
and that reasoning stands. But the tab it opens is THE WHOLE APPLICATION at a lane address: the rail,
the status strip, the header, every screen kept hidden in #screen. He wants the transcript and
nothing else.

AND THE PRECEDENT EXISTS, WHICH IS WHY THIS IS SMALL. src/ui/public/doc.html is already a separate
page beside index.html, and seq:19 own item records his earlier permission for exactly this shape -
"you can use a different browser tab as we did for readme".

BUT THERE IS A TRAP IN THAT PRECEDENT AND IT MUST BE SAID FIRST: doc.html IS DRAWN BY A DIFFERENT
RENDERER. seq:38 lane found it - githubNodes draws /doc.html while the archive is drawn by
markdownNodes, and the two differ in exactly the way that matters: markdownNodes emits span.m for
inline code and githubNodes emits a bare code element. So a lane transcript rendered through
doc.html path would silently lose the inline hue, the fence colouring, the folds and the terminal
rendering. REUSE THE PAGE SHAPE, NOT THE RENDERER.

WHAT A BARE PAGE STILL NEEDS, and forgetting any of them ships a broken window:
  - THE CREDENTIAL. Measured 2026-09-09: it is an HttpOnly SameSite=Strict cookie, so it travels to
    a second page on the same origin without a nonce handoff. This is the one thing already free.
  - THE RENDERER AND EVERYTHING seq:7 THROUGH seq:49 BUILT: the virtualised scroll, the byte-offset
    windowing, opening at the end, the follow timer, the folds, the copy bar, the lane links. A page
    that forks any of it becomes a second viewer, which is what seq:15 refused and what rowFor
    exists to prevent.
  - i18n AND THE THEME. Both string tables and the language toggle live in the shell; a page without
    them draws English into an RTL reader window.

AND DECIDE WHAT REPLACES THE CHROME RATHER THAN DROPPING IT SILENTLY. A window with no rail still
needs to say WHICH lane it is and offer a way back - p.tvlaneof and a.tvlanehome already do both and
are the minimum that must survive. What he is asking to lose is the application, not the provenance.

ONE THING THAT IS HIS TO RULE: whether the SESSION document keeps opening inside the app while only
a LANE opens bare, or both do. He asked about a lane; the same argument reads either way, and
guessing would change how he reads his own session.

── RULED 2026-09-09: ONLY A LANE OPENS BARE. THE SESSION KEEPS THE APP. ─────────────────────

Asked to choose after the distinction was explained plainly, he ruled: a helper agent opens as a
bare window; his own session keeps the rail, the status strip and the header exactly as today.

AND THE RULING MATCHES HOW HE USES EACH, which is why it is the right seam rather than merely the
narrow one. A SESSION IS WHERE HE WORKS: the strip carries the context reading, the corpus drift,
the size and the lane count he asked for only this morning, and the rail is how he leaves. A LANE IS
SOMETHING HE VISITS - reached from a link, read, and closed. Stripping the chrome from the thing he
works in would take away the instruments; stripping it from the thing he visits takes away nothing
he was using.

SO THE SEAM IS THE DOCUMENT KIND, AND `rowFor` ALREADY KNOWS IT. It resolves a session, a lane or a
kept copy - so "is this a lane" is a fact the read model answers already, not a new flag. Do not
add a mode, a preference or a query parameter: the shape follows from WHAT is being opened.

AND THAT MEANS THE SESSION PATH MUST NOT CHANGE AT ALL. This item now touches only the route a lane
is opened through. If a session document renders one pixel differently after this lands, that is a
regression rather than a side effect - the browser suite has 132 assertions over the session
document and they are the guard.

HE WAS SHOWN AND DECLINED TWO ALTERNATIVES, recorded so neither is re-proposed. Both bare: one
consistent shape, at the cost of losing the strip and the rail while reviewing his own work. And a
toggle he chooses per reading: most flexible, and it costs a control on the screen plus a preference
that has to be remembered or it becomes annoying. He took neither, and the reason both lost is the
same - they treat the two documents as one thing when he uses them differently.

WIDENING IT LATER IS ONE LINE, which is the property that made this the safe choice: if he decides
his session should open bare too, the branch that asks "is this a lane" simply stops asking.
