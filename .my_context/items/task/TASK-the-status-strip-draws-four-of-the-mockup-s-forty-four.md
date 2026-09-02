---
id: TASK-the-status-strip-draws-four-of-the-mockup-s-forty-four
type: task
title: the status strip draws four of the mockup's forty-four elements, in one colour
status: active
severity: soft
always: false
summary: The bottom information strip shows four of the forty-four things the design puts there, all in a single colour.
summary_of: 5b7ca9091b591d7d
scope: []
tags:
  - v2
  - ui
  - strip
  - "plan:walk"
  - "state:done"
  - "seq:29b"
origin: human
source_file: null
source_anchor: null
source_checksum: 3c42bbd9bc67365e
valid_from: 2026-08-28
valid_until: null
checksum: 06788b66d1e764bb
plan: walk
seq: 29b
state: done
priority: "1"
source: owner, 2026-08-28
---

# the status strip draws four of the mockup's forty-four elements, in one colour

> Owner, 2026-08-28: *"implement the status bar at the bottom of the screen as it
> demonstrated in the mockup, many properties are currently missing and also the
> font should be bigger to be readable, also use colors to differentiate between
> properties."*
>
> ## Measured 2026-08-28, both surfaces driven in the same browser
>
> |                  | mockup | app |
> |------------------|--------|-----|
> | elements         | **44** | **4** |
> | distinct colours | **5**  | **1** |
> | font size        | 13px   | 13px |
>
> The mockup's strip carries: branch and short SHA, upstream sync state, item
> count, injections today, context percentage with used-of-window, how much of
> that window my_context itself put there and in how many injections, and audit
> append p95.
>
> The app's strip carries an item count and the noBridge sentence. That is it.
>
> ## Three distinct pieces of work, and they are not the same kind
>
> **1. The missing segments — forty of forty-four.** `plan:port seq:6` records this
> as "two segments the mockup carries are absent: the injections-today count and
> the audit append p95". That was an undercount by a factor of twenty. Its stated
> reason still holds for those two — they need an audit aggregate the read surface
> does not expose — but it does not explain the git group, the context group, or
> the project-knowledge figure, which have other sources. Establish per segment
> what it needs before assuming any of them share a blocker.
>
> `plan:ui3` tasks 4 and 5 build the statusline, which is what lets the context
> group leave its noBridge state. Check whether they have landed before treating
> the context group as blocked.
>
> **2. Colour, and it does not exist in the app at all.** Five distinct colours in
> the mockup, one in the app. This is not a missing feature so much as an unbuilt
> half of a built one: the mockup uses colour to separate provenance groups —
> where a number came from — and a strip whose entire job is provenance, rendered
> in one colour, makes the reader parse a sentence to learn what a glance should
> say. The mockup's own palette tokens are the source; do not invent new ones.
>
> **3. Font size is a DESIGN change, not a parity gap.** Both surfaces render at
> 13px, so the app is faithful and the design is what the owner finds unreadable.
> That makes the mockup the thing to edit FIRST, with the app following — the
> order this project uses for every design-of-record change, and the reason
> `cap.warn` and `cfg.nocmd` were edited in the mockup before the screens moved.
> Changing only the app would make `styles-parity` fail in the direction that
> means "the app invented something", which is the correct failure and the wrong
> fix.
>
> ## Note the interaction with `plan:walk seq:29`
>
> That task records a defect in what the strip DOES draw: it appends the noBridge
> sentence unconditionally, with no check, so it tells every user the bridge is not
> installed including those who installed it. Fixing the strip's contents without
> fixing that would build forty true segments beside one false one.
>
> ## Done when
>
> Every segment the mockup draws is either drawn by the app or absent for a stated
> reason recorded here; colour distinguishes the groups the mockup distinguishes;
> the font size is the mockup's, after the mockup changes; and a browser test
> drives the strip and asserts the segment count against the mockup's own, so the
> next divergence is caught rather than measured a month later.

> ## HANDED HERE FROM `plan:walk seq:62`, 2026-08-28 — "the status line is not constantly showing" is THIS gap, not an intermittent renderer
>
> `seq:62` was asked to establish whether the owner's *"the status line is not
> constantly showing"* is an intermittent rendering bug it owns, or this
> partial-strip gap. Measured against the source rather than folded in:
>
> **Nothing hides or removes the strip after boot, so it cannot flicker.**
> `renderChrome()` (`src/ui/public/app.js` ~1277-1283) creates `footer.strip#strip`
> once, appends it to `#app`, and no code path anywhere removes it, sets
> `hidden` on it, or rebuilds `#app` around it. It is called exactly twice — at
> boot before the first data call (*"so the 56px band never exists, not even for
> a frame"*) and again after a pasted nonce redeems. `.strip` is its own grid
> row in `.app`'s `grid-template-areas`, and `.pane-float #pane`'s block insets
> (`52px 62px`) are chosen expressly so the floating pane cannot cover it. The
> three sibling grid rows (`.rail`, `.body`, `#pane`) are all `overflow-y:auto`,
> so each is a scroll container with an automatic minimum size of zero and
> cannot push the `1fr` row into growing and shoving the strip past `100vh`.
>
> **What DOES vary is the strip's CONTENT, and every varying segment is one this
> item already owns.** `fillChrome()` (~1376-1422) fills the git group from
> `/api/meta` and the item count from `/api/status`. Both are one-shot at boot,
> neither is ever retried, and both catch blocks leave their span EMPTY on
> purpose — *"the strip says nothing rather than guessing"* and *"leave the count
> empty rather than show a wrong one"*. So between boot and the fetches
> resolving, and permanently after a transient failure of either, the strip
> renders with its git group and/or its count blank and only the `noBridge`
> sentence left. That reads exactly like "sometimes it is there and sometimes it
> is not", and it is this item's four-of-forty-four, not a second defect.
>
> **One mechanism this item does not currently name, added here rather than
> filed separately:** the two built segments can go blank silently and never
> come back, because `fillChrome()` has no retry and no "unmeasured" state. That
> is `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` unmet on the
> strip — a blank segment cannot tell a reader whether the fact is absent or
> whether the call failed. Whatever builds the missing forty should give the
> existing four a named unmeasured state and a retry, or the completed strip
> inherits the same silence on forty-four segments instead of four.
>
> `seq:62` therefore claims none of this and changed nothing in `app.js`.
