---
id: TASK-the-find-options-the-owner-asked-for-twice-in-a-floating
type: task
title: the find options the owner asked for twice, in a floating panel that gives the screen its room back
status: active
severity: soft
always: false
summary: The conversation search now opens as a floating panel you can drag aside, with case, whole word and regular expressions, and the bar above the viewer gives back a third of its height.
summary_of: 116e13c11f63ef1e
summary_was:
  - 2026-09-16 Give the conversation search a proper options panel you can drag aside, with case, whole word and regular expressions.
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/lib/**
  - src/ui/public/styles.css
  - src/ui/public/strings/**
  - src/core/conversation-search.ts
  - src/ui/read-model-conversation-document.ts
  - test/**
  - e2e/**
tags:
  - v2
  - recall
  - search
  - "plan:semantic"
  - "seq:9"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: e39337db7d2959e6
plan: semantic
seq: "9"
state: done
priority: "1"
---

# the find options the owner asked for twice, in a floating panel that gives the screen its room back

DONE 2026-09-16, lane AM. `reports/2026-09-16-the-find-panel.md` is the record.

THE OWNER ASKED FOR THIS TWICE AND DID NOT GET IT, AND THAT IS THE FIRST THING TO UNDERSTAND
BEFORE READING THE RESEARCH.

2026-09-16, first ask: "specifically look at the notepad++ and similar and find the best
feature reach search implementation". Second, after it did not arrive: "i asked you to look at
notepad++ search because they have a search dialog with various options that i wanted you to
implement in a similar way, there are many options there including lower case, upper case,
whole word, regex and much more, thats why i have asked you to search the internet for the best
open source implemented search including the ui component but you ignored and brought the first
simple implementation you found".

`reports/2026-09-16-the-search-grammar.md` §5 RECOMMENDED AGAINST EXACTLY THIS and the main
session endorsed it. **HE OVERRULED IT, AND ALL THREE OPTIONS SHIPPED.**

── WHAT LANDED ──────────────────────────────────────────

A floating **Search** panel — `<dialog class="mcpanel">`, opened with **`show()` and never
`showModal()`**, so the viewer behind it stays live. Opened from the right-click menu in the
conversation viewer or with `/`. Closed by its own button AND by Escape, which `show()` does not
give you and which is therefore wired by hand. Dragged by its header, remembered per viewer in
`localStorage`, clamped back onto a narrower screen, brought to the front on a click. Several may
be open at once.

It holds the find box, the match stepper and the count line — MOVED in while it is open and put
back when it closes, so there is one query field rather than two states for one query.

THREE OPTIONS, EVERY ONE IMPLEMENTED IN THE SERVER SCAN:
  — **Match case**, a second axis OVER the NFKD folding, never conflated with it.
  — **Whole word**, `\p{L}\p{N}_`, required only at an end that is itself a word character — so
    a reader who ticks it and types `...` does not get zero for ever.
  — **Regular expression**, over the text as written, with the cost printed on the screen.

── THE MEASUREMENTS THAT MATTER ─────────────────────────

**THE STRIP GAVE ITS ROOM BACK.** Live 139 MB session, 1280x1000, same query in the box:
`.tvnav` 162.75px -> 128.36px, `.tvbar` 62.58px -> 26.39px, and the whole chrome between the top
of the bar and the top of the viewer 372.69px -> 230.53px. **38% less.** In Hebrew the strip
returns to exactly its idle height. The browser suite ASSERTS the shrink in both languages.

**REGEX IS FASTER HERE, WHICH IS THE OPPOSITE OF WHAT THE RESEARCH PREDICTED.** `byte offset` as
a literal costs 48 ms over 4,582 prose spans; the same words as a pattern cost **3 ms**. §6
refused regex because it "cannot use the index" — true, and this box never used the index.

**AND ONE DEFECT NO BUDGET CAN FIX.** `^(\w+\s?)+$` froze the scan for **108,785 ms**. The time
budget is checked between spans; the freeze is inside one, in V8's regex engine, which cannot be
interrupted from JavaScript. A runtime canary was written and MEASURED TO BE UNSOUND — `(a*)*b`
does not return on twelve characters. So the `(X+)+` shape is now refused statically, before
anything is read, as its own answer on the wire (`refused`, not `error`, not an empty result).

── WHAT IS LEFT, AND IT IS HIS ──────────────────────────

  1. The strip is 128px and not 61px with the panel open, and the residue is the MARK and YOU
     counts, which belong to the NAVIGATION panel — the second of his three. Report §2.3.
  2. `(a|a)+` — ambiguous alternation inside a repeat — is still reachable and still exponential.
     The real fixes are a killable child process or a linear-time engine (a dependency, which is
     his to relax). Report §7.1.
  3. Search-in-selection, extended escapes, backward search, wrap-around, mark-all, `.` matches
     newline and prefix `*` were each REFUSED WITH A REASON AND A NUMBER. Report §6. Each is a
     paragraph he can overrule.
  4. The panel frame is `src/ui/public/lib/panel.js` and report §3 says exactly what the second
     and third callers supply. Navigation and copy are two items, not two builds.

## Request

ok now navigating over the search works correct including the scroll, 1 - measure and tell me what about searching everything, 2 - i asked you to look at notepad++ search because they have a search dialog with various options that i wanted you to implement in a similar way, there are many options there including lower case, upper case, whole word, regex and much more, thats why i have asked you to search the internet for the best open source implemented search including the ui component but you ignored and brought the first simple implementation you found, 3 - after everithing will work i mean the search - smart search, i want you to get the best ui ux tools you have and refactor completely the conversations screen with all it's controls, currentlly it looks like a mess very unorderd and very dificault to work with it so we need professional consult and implementation of the screen (the viewer is under this section), it is very load with very long text staetments in a small font that is actually unreadable. Say your opinion and then recommend and ask me how to proceed
