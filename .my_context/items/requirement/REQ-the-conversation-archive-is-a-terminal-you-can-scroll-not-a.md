---
id: REQ-the-conversation-archive-is-a-terminal-you-can-scroll-not-a
type: requirement
title: the conversation archive is a terminal you can scroll, not a page of records
status: active
severity: hard
always: false
summary: "A saved session is read the way it was lived: one continuous scrollable view that looks like the terminal did, with the prompts and answers marked."
summary_of: fca0dd35a0365219
scope:
  - src/ui/**
  - e2e/**
tags:
  - v2
  - ui
  - archive
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: f17c28179d540e86
---

# the conversation archive is a terminal you can scroll, not a page of records

OWNER DEFINITION, restated by him on 2026-09-07 after looking at what shipped. It is recorded here
because it was given in conversation and the spec never carried it - which is exactly
LESSON-a-requirement-given-in-conversation-and-never-captured-is-a, and this item is the fix for
that, not a summary of it.

HIS WORDS, in his order, because the order is the design:
  1. "the intent was to record ALL THE TERMINAL ACTIVITIES of a session" - the subject is the
     terminal, not a list of message objects.
  2. "you said that the session has its own file so it’s simple" - the transcript on disk is the
     source, and that is why this was scoped as small.
  3. "i requested to MARK A PROMPT AND AN ANSWER" - marking, on a continuous view. Not splitting.
  4. "i also requested to have a BROWSER that would allow to look at DIFFERENT SESSIONS".
  5. "because a session is not promised to be available for long period we decided to implement an
     EXPORT to a file so we could use THE SAME BROWSER to go over a session even if the original
     file is not available anymore" - one viewer, two sources. This is archive/4 and archive/5, and
     it is also the answer to the pruned-row contradiction: an export is what survives a prune.
  6. "render the content AS CLOSE AS IT COULD BE TO WHAT WAS SEEN ON THE TERMINAL ... a VIEWER that
     would support FORMATTED AND COLOR supporting to SIMULATE AS POSSIBLE TUI".
  7. "view the session on a SEQUENTIAL DOCUMENT with markers for prompts and answers AND NOT BROKEN
     TO PIECES - user should have a similar experience like SCROLLING OVER A TERMINAL."

WHAT THAT RULES OUT, stated plainly so it is not re-argued: a fifty-record page is not this. Nor is
a paged one. A pager is a way of not being a terminal. What he asked for is one continuous
scrollable document over the whole session, which for his own 51 MB session is 24,757 records - so
the engineering problem is VIRTUALISED SCROLLING, not paging, and the spec already said "page OR
VIRTUALISE" and only the paging half was attempted, then not built either.

AND THE COUNTING CONTRADICTION IS HIS SYMPTOM, NOT A SEPARATE BUG: on his session the list reports
460 asked, 1,717 answered, 6,792 tool steps - 8,969 - against 24,757 records. The code claims twice
that those three columns account for every record. They do not: 15,788 records carry no `message`
object and are counted in none of the three. Those 15,788 ARE "the terminal activities" of clause 1.
A terminal view does not have this problem, because it does not classify before it draws.

PERMISSIONS HE GAVE, and they are permissions rather than instructions:
  - "if required BUT NOT NECESSARY you can use a DIFFERENT BROWSER TAB as we did for readme".
  - "if you find it helpful you could look for PRE MADE UI COMPONENTS that will make the
    implementation more reliable, good looking and shorter to implement."
  - "DO NOT USE THE CSS STYLE OF THE APP CARDS, it should not be limiting you - you can use the
    cards to EMBED IN THEM components."

THE PRE-MADE COMPONENT PERMISSION HAS A PATH AND IT IS ALREADY BUILT, so nobody needs to weigh it
against the constraint: `src/ui/public/lib/vendor/` holds third-party code committed UNMODIFIED,
pinned by size and SHA-256 in VENDOR.md and gated by `npm run check:vendor`, which also proves the
file cannot fetch, eval or import anything outside its own pinned set.
CONST-zero-runtime-dependencies is NOT bent by that - `dependencies` stays empty and a vendored file
is a static asset, the same category as the nine committed .woff2 faces. So: vendor it, pin it, and
it must render offline. An npm dependency is still refused.

THE CARD RULING IS A RELEASE, NOT A BAN. The app’s card styles must not constrain this viewer. A
card may still CONTAIN it. Whoever builds this should expect to write CSS that looks unlike the rest
of the app and should not be corrected for it.
