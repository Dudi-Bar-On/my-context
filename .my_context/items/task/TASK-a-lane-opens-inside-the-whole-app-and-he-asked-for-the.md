---
id: TASK-a-lane-opens-inside-the-whole-app-and-he-asked-for-the
type: task
title: a lane opens inside the whole app, and he asked for the transcript alone in a window
status: active
severity: soft
always: false
summary: Opening a helper agent gives you just the transcript in its own window, without the rails and bars of the surrounding application.
summary_of: c1b57f7696566003
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
checksum: 0d228ce83d6eed13
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
