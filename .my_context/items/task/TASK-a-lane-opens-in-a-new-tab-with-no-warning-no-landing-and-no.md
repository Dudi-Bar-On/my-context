---
id: TASK-a-lane-opens-in-a-new-tab-with-no-warning-no-landing-and-no
type: task
title: a lane opens in a new tab with no warning, no landing and no way back
status: active
severity: soft
always: false
summary: Following a helper agent tells you a new tab is opening, takes you there, and gives you a way back to where you were reading.
summary_of: ffefb2432887f765
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/styles.css
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:40"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 3ce4d07c5bc757db
plan: archive
seq: "40"
state: done
priority: "1"
needs: archive/15
---

# a lane opens in a new tab with no warning, no landing and no way back

OWNER RULING 2026-09-09, accepting the new tab and asking for three things it does not do: "ok
accept your decision about new tab just: give the user a message about that and jump to the tab you
have opend and give the user a button on the new tab to close it so he could return to the main
viewer, another possible solution like popup is to open a new browser with it window on top - you
decide."

THE TAB STANDS. He accepted it and the reason it was chosen holds: plan:archive seq:15 opens a lane
through a real anchor, so the reader’s document is never unmounted and their place is NOT RESTORED,
IT IS NEVER LOST - measured on his own corpus at scrollTop 299,226 before and after, same 18 rows,
the same fold still open.

AND THE "NEW BROWSER WINDOW ON TOP" ALTERNATIVE IS DECLINED, since he left it to me. A window
opened on top is a popup by another name and carries every cost seq:15 rejected the popup for: it
needs script so a blocker can stop it, it has no address a reader can copy or bookmark, and a lane
that opens a lane stacks one on another. The tab plus the three affordances below gets what he is
actually asking for - knowing it happened, landing there, and getting back - without reintroducing
any of that.

THREE THINGS TO BUILD:

  1. SAY THAT IT OPENS A NEW TAB, BEFORE IT DOES. Today the link gives no warning, and a reader who
     does not expect a new tab reads the jump as their document having been replaced. One keyed
     sentence on the link or beside it; both string tables.

  2. LAND IN THE NEW TAB. Chrome usually focuses a `target="_blank"` tab already, so THIS MAY
     ALREADY WORK - measure it in both engines before writing anything. If it does, say so and
     build nothing; a line of code that duplicates browser behaviour is a line that will disagree
     with it later.

  3. A CONTROL ON THE LANE PAGE THAT CLOSES IT AND RETURNS HIM. This is the one that needs a
     measurement rather than an assumption: `window.close()` is permitted only for a window the
     script opened, and the rules for a tab opened by an ANCHOR with an opener differ by engine and
     have changed across versions. MEASURE IT in chromium and chrome. If close is refused, do NOT
     ship a dead button - the honest fallback is the back-link that already exists
     (`a.tvlanehome`, the provenance line’s route to the owning session), relabelled so it says
     what it does. A button that silently does nothing is worse than no button, and this project
     has just removed two disclosures for being unreachable.

AND WHATEVER THE CONTROL IS, IT SETS ITS OWN COLOUR, BACKGROUND AND BORDER. A Clear button shipped
at contrast 1.0 on 2026-09-08 with a browser test clicking it by class, and it was the third
instance of the defect `styles.css` documents "for the next person adding a button anywhere in this
codebase". Measure the contrast; the transcript ground is `--paper #0f0f12` and `--edge` is 1.71:1
against it, which is why plan:archive seq:38 exists.
