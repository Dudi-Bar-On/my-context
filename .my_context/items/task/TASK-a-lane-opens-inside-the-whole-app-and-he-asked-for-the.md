---
id: TASK-a-lane-opens-inside-the-whole-app-and-he-asked-for-the
type: task
title: a lane opens inside the whole app, and he asked for the transcript alone in a window
status: active
severity: soft
always: false
summary: Opening a helper agent gives you just the transcript in its own window, without the rails and bars of the surrounding application.
summary_of: 7d81b3e62e6e58fa
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/server.ts
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:51"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: c252d09382eab7c2
plan: archive
seq: "51"
state: done
priority: "1"
needs: archive/15
verified_on: 2026-09-10
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
LANDED 2026-09-09.

WHAT WAS BUILT: `/lane.html` and `/lane.js`, a page beside `index.html` with no shell on it - no
`.app` grid, no `#topbar`, no `.rail`, no `#screen`, no `#prov`, no `.strip`, no pickers, no item
pane, no icon sprite, no heartbeat and no live stream. `lane.js` loads the string table, applies
`lang`/`dir`, builds the four-field `ctx` the document actually reaches for (`t`, `tFlat`, `api`,
`navigate` - measured over the whole file) and then calls `mountDocument`, which is now exported
from `screens/conversations.js` for this one caller. The renderer is not forked and neither is
anything `seq:7` through `seq:50` built: the virtualised scroll, the byte-offset windowing, the
landing at the end, the follow timer, the folds, the copy bar, the lane links and the agent type are
the same code on both pages by construction.

THE SEAM IS TWO FUNCTIONS, WHICH IS THE RULING SPENT RATHER THAN RESTATED. `laneHref` names
`/lane.html?id=<agentId>`; `sessionHref` names `/#/conversations/<id>`. No mode, no preference and
no parameter selects a shape - and because the ADDRESS must not be the authority either, `lane.js`
re-asks the read model on arrival: a session id handed to `/lane.html` is `location.replace`d back
to the app, so a hand-typed or stale bare address cannot take his instruments away from him.
Widening it later is still one line: `sessionHref` stops being a separate answer.

`sessionHref` IS ROOT-ABSOLUTE, AND THAT IS THE ONE THING THE ITEM DID NOT FORESEE. `a.tvlanehome`
is now written on `/lane.html` as well as inside the app, and a bare `#/conversations/<id>` there
resolves against the lane window itself - it would have pointed the reader at the page they were
already on. Same for a lane link INSIDE a lane window, which 43 of this workspace's 264 lanes make
reachable; both are driven in the browser rather than reasoned about.

THE ITEM'S TRAP WAS REAL AND IS AVOIDED BY REUSING THE PAGE AND NOT THE RENDERER. What the item did
NOT say, and what follows from it, is that this page must therefore LOAD `/styles.css` exactly where
`doc.html` refuses it: that refusal is `DEC-the-document-page-wears-github-styling-lists-the-readmes-
and`, whose instruction is that a rendered Markdown file "should look exactly as it is displayed in
github". The instruction reaching here is the opposite one - this is the same viewer - and every
`.tv*` rule, every fence hue, every ANSI colour and the `.m` run itself live in this product's own
sheet.

WHAT REPLACED THE CHROME: four layout rules in `styles.css` under `body.lanewin`, no colour or face
restated. `.tvscroll` is `min(70vh,860px)` inside the app, which is right there - the well sits
under a 46px header and above a 26+38px band - and wrong on a page whose whole content is one
document, where it would leave a third of the window empty. So the window is a flex column and the
well takes what is left. The app's own rule is untouched.

EVIDENCE THAT THE SESSION DOCUMENT IS UNCHANGED, which the item called the guard: the whole of
`e2e/conversations.spec.ts` - 152 tests, on chromium AND on chrome - and the only assertions that
needed changing were three `href` strings and nothing else. The new test measures the session's own
chrome BEFORE the lane window is opened and again AFTER it is closed, in the same act, because a
bare lane window is visible to anyone who looks while a session that quietly lost its strip would
only be noticed by the one person who uses those instruments. The full browser suite is 783 passed,
exit 0, both projects; `npm test` is 7,237 of 7,239 with 0 failed.

WHERE THE ITEM WAS WRONG, or at least wider than the truth:
  - `scope` names `src/ui/server.ts`. NO SERVER CHANGE WAS NEEDED. `serveStatic` resolves any
    `.html`/`.js` under `src/ui/public/` on every request, with no route table and no registration,
    so the page was served the moment it was written.
  - the item says the credential "is the one thing already free" and it is exactly right: the
    `HttpOnly SameSite=Strict` cookie reached the second page with no handoff, verified by the
    window fetching its outline, its roster, its node bodies and its `/tip` ticks.
  - the item asks for "i18n AND the theme" including "the language toggle". The toggle is NOT
    carried onto this page, deliberately: a toggle is chrome, `localStorage` is per-origin so the
    choice made in the app already reaches here, and `doc.html` shipped on the same bargain. What
    the item names as the cost - English drawn into an RTL reader's window - does not arise, and
    both languages are driven in the browser.
  - the item's count of "132 assertions" over the session document is now 152 tests in that file;
    the dispatch brief said ~140. Neither number was load-bearing - the file was run whole.

ONE THING FOUND AND LEFT, REPORTED RATHER THAN FIXED: `styles.css` still carries eleven dead rules
from the doc page's move to GitHub styling - `body.docpage`, `.docshell`, `.dochead`, `.backrow`,
`.docwhere`, `.docwhere .m` and `.docfoot`. Nothing in `src/`, `e2e/`, `test/`, `docs/` or
`scripts/` references any of those class names. This is the same residue as the twenty `.ghdoc`
rules deleted on 2026-09-09 and is a two-minute deletion for whoever owns that block next; it was
left because it is nothing to do with this item and this is closing mode.

AND ONE BOUNDARY DRAWN ON PURPOSE: the roster's own rows (`drawLaneRow`, reached from
`button.tvlanes`) still open a lane IN THE APP, in the same tab, because they are a list's rows and
not a link that spends a tab. So a lane can still render inside the shell - which is what
`button.tvlaneshut`'s `history.length === 1` gate and two existing specs already depend on, and what
the item's own body anticipates ("a reader who reached this lane WITHOUT a new tab"). If he wants
the roster row bare too, that is a one-line change to what `openLane` does and it is his to ask for.

HE ASKED FOR THE ROSTER ROW TOO, 2026-09-09, AND THE BOUNDARY ABOVE IS NOW CLOSED. drawLaneRow's rows open a lane at /lane.html, through laneHref, which stays the only code that knows a lane's address — a second spelling written at the roster would be exactly the defect plan:archive seq:48 is about, one fact recorded twice with nothing comparing them.

AND THE ARGUMENT FOR LEAVING IT WAS ANSWERED RATHER THAN OVERRULED. This item's reason was that a list's rows are not links that spend a tab, and that half is kept: openLane calls window.location.assign, so the CURRENT window goes bare, no tab is spent, and the browser's own Back returns to the roster. What changed is the SHAPE a lane arrives in and nothing else. location.assign rather than ctx.navigate because /lane.html is a different document and the app's router only moves a hash — the same move lane.js already makes in the other direction with location.replace(sessionHref(id)).

THE IN-APP LANE ROUTE IS NOT REMOVED, AND THAT IS DELIBERATE. #/conversations/<agentId> still renders a lane inside the shell; rowFor resolves either kind; and button.tvlaneshut's history.length === 1 gate is written for precisely this reader — "a reader who reached this lane WITHOUT a new tab ... has somewhere to go back to". CHECKED RATHER THAN ASSUMED, in both browsers: a reader arriving from a roster row has a history entry behind them, so tvlaneshut correctly does NOT draw, and a.tvlanehome — drawn either way — is the route out. No gate was changed.

NO NEW STRING. The row hands over an agent id and says nothing new; conv.lanes.sub's "Open one to read it in the same viewer a session uses" stays TRUE and stays as it is, because lane.js imports mountDocument and forks no renderer — the viewer really is the same one, and what differs is the chrome around it.

THE TWO SPECS THAT RESTED ON THE OLD BEHAVIOUR WERE UPDATED, NOT DELETED. e2e/conversations.spec.ts' roster test asserted "a row opens the lane in the same viewer a session uses" and now asserts the row lands on /lane.html in the same window, that body.lanewin is set, that #app/#topbar/.rail/#screen/#strip have COUNT ZERO rather than merely being hidden, that tvlaneshut is absent and tvlanehome present, and that Back returns to the roster. The sibling test that reaches a lane by address gained the assertion the first one gave up: at #/conversations/agent-outer the rail and the strip are visible and body is NOT lanewin — so the in-app route that still exists is still covered by something.

NON-VACUOUS, PROVED BY REMOVING THE FIX. Pointing renderRoster back at the in-app opener turns the roster test red in BOTH projects; flipping the surviving in-app assertion to its opposite turns the sibling test red in both. Both were then restored. Green after: 184 of 186 across conversations, conversations-kept, lane-link-face, archive-chrome-face and screen-parity in chromium AND chrome — the two reds being screen-parity's mockup ledger, which fails identically on the pre-session sources and names only screens this work never touched (preview, coverage, injected, watch, graph, learn, work, packs).
