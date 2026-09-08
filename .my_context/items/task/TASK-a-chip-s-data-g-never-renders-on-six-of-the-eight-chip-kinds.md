---
id: TASK-a-chip-s-data-g-never-renders-on-six-of-the-eight-chip-kinds
type: task
title: a chip's data-g never renders on six of the eight chip kinds, so five archive glyphs are dead markup
status: active
severity: soft
always: false
summary: A glyph a screen puts on a coloured chip is silently replaced by the glyph its colour class carries, so several states in the conversation archive draw the same mark.
summary_of: ff0c0da2216e0bbd
scope:
  - src/ui/public/styles.css
  - src/ui/public/screens/**
tags:
  - v2
  - ui
  - archive
  - "plan:archive"
  - "seq:20"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: f7b8c86e25d089f8
plan: archive
seq: "20"
state: done
priority: "2"
---

# a chip's data-g never renders on six of the eight chip kinds, so five archive glyphs are dead markup

Found by the archive/14 lane while writing the staleness chip, reported and not fixed; CONFIRMED
IN A REAL BROWSER by the archive/7+19 lane on 2026-09-08, and it is WIDER than the first report.

WHAT THE FIRST REPORT SAID. `styles.css` declares `.chip.warn::before{content:"▲ "}`, which is a
two-class rule and therefore beats `.chip::before{content:attr(data-g)}` whatever the order. So a
`data-g` on a `warn` chip never renders.

WHAT THE BROWSER SAYS, measured rather than read off the specificity. A `<span class="chip X"
data-g="⃠">` was inserted into the running app and `getComputedStyle(el, '::before').content` read
back, for every chip class the stylesheet declares:

    warn     "▲ "        the data-g is overridden
    crit     "■ "        the data-g is overridden
    carry    "◇ "        the data-g is overridden
    ok       "● "        the data-g is overridden
    gov      "◆ "        the data-g is overridden
    unmeas   "◌ "        the data-g is overridden
    index    "⃠ "        the data-g RENDERS
    (plain)  "⃠ "        the data-g RENDERS

SO IT IS NOT A WARN DEFECT, IT IS SIX OF THE EIGHT CHIP KINDS. Every meaning-coloured chip in this
app carries a glyph fixed by its COLOUR CLASS, and any `data-g` a screen writes on one is dead
markup. Only `.chip` with no modifier and `.chip.index` honour it.

THE DEAD CALL SITES FOUND SO FAR, all in `src/ui/public/screens/conversations.js` — cite them by
their `dataset.g` line, not by number:

  - `conv.pruned`      `chip warn`  data-g `⃠`  draws ▲
  - `conv.scanCapped`  `chip warn`  data-g `⋯`  draws ▲
  - `conv.exported`    `chip carry` data-g `⎘`  draws ◇
  - `conv.doc.failed`  `chip crit`  data-g `⚠`  draws ■   (`drawWork`)
  - `conv.unreadable`  `chip crit`  data-g `⚠`  draws ■   (a step that would not parse)
  - `conv.none`        `chip unmeas` data-g `◌` draws ◌   — identical BY COINCIDENCE, because
                       `.chip.unmeas::before` happens to declare the same character

  - and one that WORKS and shows what the rule is for: the synthetic-turn label wears
    `chip index` and its `⌁` renders.

The whole app should be swept before this is fixed; `conversations.js` is only where it was
noticed. `grep -n "dataset.g" src/ui/public/` finds every writer.

WHY IT IS NOT A ONE-LINE FIX, AND WHY THE PREVIOUS LANE WAS RIGHT TO LEAVE IT. Making `data-g` win
would CHANGE GLYPHS THE OWNER HAS ALREADY SEEN on screens outside the archive — a `warn` chip that
has always drawn ▲ would start drawing whatever a screen happened to put in its `data-g`, or
nothing at all where none is set. That is a visual ruling, not a bug fix, and it belongs to him.

THE THREE SHAPES A FIXER SHOULD PUT IN FRONT OF HIM, rather than picking one:

  1. DELETE THE DEAD `data-g` WRITES. The colour classes keep their glyphs, the screens stop
     claiming a glyph they do not get. Smallest, changes nothing on screen, and loses the
     distinction the `⃠` and `⋯` were reaching for.
  2. LET `data-g` WIN WHERE IT IS PRESENT — `.chip[data-g]::before{content:attr(data-g) " "}`,
     which outranks the two-class rules. Every existing `data-g` starts rendering, including the
     six above; every chip without one keeps its class glyph. This is the only option that makes
     the existing markup mean what it says.
  3. GIVE THE ARCHIVE'S STATES THEIR OWN CLASSES rather than reusing `warn`/`crit`, so a pruned
     row and a scan-capped row are told apart by their own glyph without touching any other
     screen.

AND THE GENERAL CLAIM THIS SUPPORTS, which is why it is filed rather than fixed in passing: this
app's own rule is that a distinction is carried by MORE THAN COLOUR — a glyph and a keyed word, so
it survives a monochrome print, a colour-blind reader and the RTL flip. Six chip kinds currently
carry the same glyph for every state that shares a colour, which is that rule half-kept: the pruned
chip and the behind chip and the scan-capped chip are three different facts drawing one ▲ and
differing only in their words.

NO TEST GUARDS THIS TODAY. Whatever is chosen, the guard is a browser assertion on
`getComputedStyle(el, '::before').content` for a chip that carries a `data-g` — the probe above,
kept rather than thrown away.

OWNER RULING 2026-09-08: scope data-g to the NEW chips only. The five dead glyphs come alive on
the conversations screen; every other screen keeps the glyph vocabulary he already reads.

HE WAS SHOWN THE COST OF THE ALTERNATIVE AND CHOSE AGAINST IT. Letting data-g win everywhere is
the cleaner CSS and the single rule, and it would change the glyph on six chip kinds across
Doctor, Decay, Work, Watch and Status - screens he has been reading for weeks. A tidier cascade is
not worth re-teaching a reader symbols they already know.

WHAT THIS RULING COSTS, said plainly so nobody later reads it as free: TWO GLYPH VOCABULARIES NOW
COEXIST. A chip on the conversations screen and a chip on Doctor obey different rules about their
glyph. That is a real inconsistency and it is accepted deliberately rather than overlooked. The
implementation must therefore make the boundary legible in the CSS itself - a scoped selector with
a comment saying WHY it is scoped - or the next reader will "fix" it back.

AND conv.none matches by COINCIDENCE, which the implementation must not preserve by accident: it
draws the right glyph today because the override happens to agree with its data-g, not because
anything made them agree.

CLOSED 2026-09-08, scoped as the owner ruled.

A new rule `.chip.glyphed[data-g]::before` carries the glyph, with `[data-g]` in the selector for
SPECIFICITY (0,3,1 against the colour classes 0,2,1) so it does not depend on source order. Six
call sites opted in. The comment beside it says why it is scoped and that two glyph vocabularies
now coexist deliberately - which this item required, so the next reader does not "fix" it back.

conv.behindRow deliberately stays UNMARKED and keeps the warning triangle: it is the ordinary
warning of the three, and the comment that used to say "no data-g, it would be dead" now says why
it is bare on purpose.

THIS ITEM NAMED THE WRONG CHARACTER, and it took rendering it to find out. The pruned chip glyph is
recorded here as U+20E0 COMBINING ENCLOSING CIRCLE BACKSLASH. Nobody had ever seen it draw, because
data-g never rendered on a warn chip - that is the defect. Rendered for the first time it did what
a combining mark with no base does: swallowed the trailing space that `content: attr(data-g) " "`
supplies and landed ON THE F of "File deleted", eating the leading space too. U+20E0, U+2298 and
U+29B8 were drawn side by side at 3x to be sure.

IT IS NOW U+29B8 CIRCLED REVERSE SOLIDUS - the same picture, a standalone character, correct
spacing. Confirmed on screen in e2e/screens/conversations-glyphs-en.png. The ruling that five dead
glyphs come alive was right; one of the five was not a usable character.

AND conv.none IS NO LONGER A COINCIDENCE. It drew the right glyph before and after this change for
two different reasons, and the comment now records that rather than leaving the next reader to
assume the old behaviour was intended.

TWO OF THE SIX CANNOT BE TESTED END TO END AND THAT IS NAMED RATHER THAN HIDDEN: conv.exported is
UNREACHABLE, not merely dead, because `source` is hard-coded to live in conversation-index.ts until
seq:4-5 ship; and conv.scanCapped needs a 256 MB transcript.
