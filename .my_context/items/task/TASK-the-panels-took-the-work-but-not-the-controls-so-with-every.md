---
id: TASK-the-panels-took-the-work-but-not-the-controls-so-with-every
type: task
title: the panels took the work but not the controls, so with every panel shut the card is exactly as big as it was
status: active
severity: soft
always: false
summary: Remove from the card and the right-click menu everything the three panels now own, disclose counts only when something is hidden, and stop the outer scroll so the card stays on screen.
summary_of: e0e0af6c06012dee
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/lib/panel.js
  - src/ui/public/styles.css
  - src/ui/public/strings/**
  - test/**
  - e2e/**
tags:
  - v2
  - recall
  - ui
  - "plan:semantic"
  - "seq:15"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 6d08b4daccf67b1a
plan: semantic
seq: "15"
state: done
priority: "1"
---

# the panels took the work but not the controls, so with every panel shut the card is exactly as big as it was

THE OWNER, 2026-09-17, LOOKING AT THE THREE PANELS ON HIS OWN SCREEN: *"1 - the right menue should
be updated, remove any option that is already implemented on the dialog it will leave there almost
only the open dialogs and maybe 1 or 2 more commands - check and tell me, 2 - the card itself is
still big and contains all the buttons and controls that should be removed because the functions
now works from the floating dialogs"*. Then, ruling on the counts: *"1 and bring the text under the
\"Back to all sessions\" button, then under it open the viewer and make the card area fixed so only
the viewer area will be scrollable not the card itself that should remain static and always
viewable"*. And: *"on the right menu put a horizontal separation line between openning the dialogs
and other actions"*.

THIS ITEM COMPLETES `semantic/12` AND `/13`. Those built the panels and LENT the controls, so with
every panel shut the card is exactly as big as it was. He is now asking for the other half: the
controls LEAVE the card. Every figure below was measured by the main session driving his own server
at 1280x1000 after the restart, not taken from a lane report.

── 1. THE MENU — 12 ITEMS TODAY, 7 GO, 5 STAY ──────────────────────

REMOVE — each is now in a dialog:
  — `Previous mark Shift+N`, `Next mark N`               → the step-through panel
  — `Your previous message Shift+U`, `Your next message U` → the step-through panel
  — `Marked points of every kind`, `a ruling`, `a table`   → the "Step to" picker in that panel

KEEP — five:
  — `Search in this conversation /`
  — `Step through this conversation`
  — `Copy what you have marked`
  — `Rename M` and `Take it back`, which read `Mark this point M` on an unmarked turn

THE PRINCIPLE THAT DECIDES IT, AND USE IT FOR ANYTHING I MISSED: **the survivors are the only items
that act on THE TURN YOU RIGHT-CLICKED. A floating panel has no "this turn"** — it does not know
where the pointer came from. An item acting on the DOCUMENT belongs in a panel; an item acting on
the thing under the cursor belongs in the menu.

A HORIZONTAL SEPARATOR between the three panel openers and the anchor actions — his words, *"a
horizontal separation line between openning the dialogs and other actions"*. Two groups, one rule
between them. Give it the right role for a menu (`<hr>` inside a `role="menu"` needs
`role="separator"`, or use a group with an accessible name); do not draw a bare styled `div` that a
screen reader cannot see.

**THE KEYS MUST NOT DIE WITH THE MENU ITEMS.** `N`, `Shift+N`, `U`, `Shift+U`, `K` and `/` are drawn
on the controls and a reader uses them without opening anything. Removing the MENU ROW must not
remove the KEY BINDING: every one of those keys must still act with EVERY PANEL SHUT. That was
already a standing rule for `semantic/12`/`13` and it is the single easiest thing to break here.
Prove each key with a panel shut, one proof per key.

── 2. THE CARD — 298.9 px ABOVE THE VIEWER, ~199 OF IT REMOVABLE ──────────

Measured with every panel shut — the state he is looking at:

    .tvhead                       28.6   KEEP — session identity
    .help.convsecrets             24.8   KEEP — a collapsed disclosure
    .tvbar                        62.6   Top / End → step panel; the four copy buttons and
                                         `Reconstruct a subject` → copy panel. Should reach 0.
    .tvnav                        99.2   GOES ENTIRELY — Step-to picker, Prev/Next mark,
                                         Prev/Next your message, Prev/Next match, and the counts
    .tvnote.tvmenuhint            18.6   "Right-click any turn below…" — a line read once
    .tvcount                      18.6   see §3
    .tvnote.tvcopyhint            18.6   "Mark part of the document below…" — the copy panel
                                         says this better and in context

`.tvbar` also holds one `input` with no visible label — identify it before deleting anything around
it. DO NOT delete a control you cannot name.

── 3. THE COUNTS — HE RULED "ONLY WHEN THEY HAVE SOMETHING TO DISCLOSE" ────

He chose option 1 of three, and added where it goes: **UNDER THE "Back to all sessions" BUTTON**,
with the viewer opening under that.

SO: the card carries NO count line in the ordinary case. The moment a search or a kind filter is
ACTUALLY HIDING SOMETHING, one line appears under `Back to all sessions` saying so. When nothing is
hidden, nothing is drawn.

THIS IS `INV-nothing-is-dropped-silently` AND IT IS THE REASON THE RULE IS SHAPED THIS WAY. The
sentences in question today are `641 marked point(s) here.`, `605 message(s) of yours here.` and the
clauses that say how many an active search is hiding. `semantic/12` LENT rather than moved these
precisely so there was never a state where the disclosure was nowhere; his ruling replaces that
protection with a better one — a disclosure that appears exactly when it has something to disclose.
IMPLEMENT THE CONDITION ON "IS SOMETHING HIDDEN", NEVER ON "IS A PANEL OPEN". A count that hides
because a panel happens to be open is the same defect wearing a different trigger.

The plain totals (`641 marked point(s) here.` with nothing filtered) are NOT disclosures — nothing
is being hidden — and belong in the step panel only. Say which sentences you classified which way.

── 4. THE CARD MUST STAY ON SCREEN — ROOT CAUSE ALREADY FOUND ──────────

**DO NOT RE-DIAGNOSE THIS. THERE ARE TWO NESTED SCROLLERS AND THE OUTER ONE IS THE BUG.** Measured
on his server:

    .tvroot    overflow-y visible   scrollH 1026  clientH 1026   not a scroller
    section    overflow-y visible   scrollH 1151  clientH 1151   not a scroller
    .body      overflow-y AUTO      scrollH 1183  clientH  817   *** THE SCROLLER, scrollTop 323
    .app       overflow-y visible   scrollH 1000  clientH 1000   not a scroller
    BODY       overflow-y hidden                                  not a scroller

`.tvscroll` (the transcript, `overflow-y: auto`, 700 px) already behaves: scrolling it does NOT move
`.tvhead`, and the page itself cannot scroll at all. A LANE ALREADY REPORTED "nothing above the well
scrolls — it is already static" AND THAT REPORT IS TRUE AND USELESS: the card is static RELATIVE TO
THE VIEWER while `.body` scrolls the card itself out of the window. At the moment of measurement
`.tvhead` sat at **top: -135.3 px** — already above the top of the viewport. That is precisely what
he means by *"should remain static and always viewable"*.

THE FIX IS TO STOP THE OUTER SCROLL ON THIS SCREEN, not to pin the card with `position: sticky`.
Sticky would paper over a layout that still overflows and would fight the panels’ stacking. Make
`.tvroot` fill the height `.body` gives it — a flex column, card at its natural height, `.tvscroll`
taking `flex: 1` and `min-height: 0` — so `.body` has nothing left to scroll and `.tvscroll` is the
only scroller on the screen. `min-height: 0` is not optional: without it a flex child refuses to
shrink below its content and the overflow moves back out to `.body`, which is this exact bug.

PROVE IT THE WAY IT WAS FOUND: set `.body.scrollTop = 400` and assert `.tvhead`’s
`getBoundingClientRect().top` DOES NOT MOVE, and that `.body.scrollHeight <= .body.clientHeight + 2`.
An assertion that only checks `.tvscroll` would have passed against the broken build — it did.

── 5. THE VIEWER SHOULD BE ABLE TO TAKE THE WHOLE SCREEN ────────────

HIS WORDS: *"moro over you can make the viewer to apear on the whole screen in a simmilar way you
did it for the items in the right pane"*.

**HE IS NAMING AN EXISTING PATTERN, SO FIND IT AND REUSE IT — DO NOT INVENT A SECOND ONE.** The main
session looked and could not identify the specific control he means: there is no `fullscreen`,
`maximize`, `widemode` or rail-toggle symbol in `src/ui/public/`. What WAS found is the shell’s
shape and one precedent, and both are probably the material:

  — The app is a CSS GRID with named areas — `hdr`, `rail`, `pane`, `prov`, `strip`
    (`styles.css:328` for the shared glass, `:801` for `.rail{grid-area:rail}`).
  — `styles.css:3441` ALREADY HIDES THE WHOLE CHROME in one line for print:
    `.hdr,.rail,.prov,.strip,.pop,.banner,.noprint{display:none!important}`. That is the existing
    proof that this shell can drop to the pane alone without the layout collapsing.

SO: LOOK FOR WHAT HE MEANS FIRST — search the items/board screens for anything that widens a pane or
hides the rail — and if it exists, follow it exactly, naming the file and line in your report. IF
IT DOES NOT EXIST, SAY SO PLAINLY rather than quietly building a new thing and implying it matched;
`nothing-to-do-and-could-not-look-are-different-answers` applies to a pattern you could not find.

IT MUST BE REVERSIBLE AND OBVIOUS — a reader who expands must be able to get back without guessing,
and the control that expands should be the control that restores. Remember what the panels are:
`<dialog>` opened with `show()`, stacked on z-indices 42–44. THEY MUST SURVIVE THE EXPANSION — stay
open, keep their dragged place, stay inside the window — or be deliberately re-placed, and say
which you chose. A panel stranded off-screen by a layout change is the clamp bug `panel.js` already
solves; reuse its clamp rather than writing another.

AND THIS INTERACTS WITH §4: expansion changes the height `.body` gives `.tvroot`, which is exactly
the dimension the outer-scroll bug lives in. Run the §4 proof AGAIN in the expanded state —
`.body.scrollHeight <= .body.clientHeight + 2` must hold in BOTH states, or you have fixed the
scroll for one layout and left it broken in the other.

── WHAT MUST NOT REGRESS ─────────────────────────────────

  — EVERY KEYBOARD SHORTCUT SURVIVES, with every panel shut. One proof per key.
  — The three panels keep working exactly as they do now — cascade 24/56/88 in English, the stored
    place measured from the RIGHT edge in Hebrew, drag, bring-to-front, Escape, close button.
  — BOTH LANGUAGES, DRIVEN. Hebrew reflects the menu separator and the header line too.
  — Report the chrome above the viewer before and after, in both languages, by BOTH metrics — from
    `.tvhead` and from `.tvbar` — because the two lanes before you used different ones and their
    numbers could not be compared. 298.9 px from `.tvhead` is today’s English figure.
  — Held by removal proofs, one per assertion, each reddening at its own line. A proof that reddens
    NOTHING is a finding to record, never to hide.
  — RUN NO GIT COMMAND THAT CHANGES REPOSITORY STATE. Leave the tree dirty; the main session commits.
  — THE SERVER ON 58888 IS THE OWNER’S. Do not kill, restart or rebind it. Start your own on another
    port and kill only that.

## Request

ok i am looking at AS work, the dialogs exists and it looks correct, what need work is 1 - the right menue should be updated, remove any option that is already implemented on the dialog it will leave there almost only the open dialogs and maybe 1 or 2 more commands - check and tell me, 2 - the card itself is still big and contains all the buttons and controls that should be removed because the functions now works from the floating dialogs
