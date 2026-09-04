---
id: STD-a-screen-explains-itself-in-plain-words-and-depth-hides
type: standard
title: a screen explains itself in plain words, and depth hides behind a question mark
status: active
severity: soft
always: false
summary: Screen text is short, plain and structured, with longer help behind a circled question mark rather than on the page.
summary_of: e48eaa815325d2fd
scope:
  - src/ui/public/screens/**
  - src/ui/public/strings/**
  - src/ui/public/lib/**
tags:
  - v2
  - ui
  - readability
  - i18n
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: decff25ee61a7579
---

# a screen explains itself in plain words, and depth hides behind a question mark

Owner instruction, 2026-09-04, given while reviewing the screens. In his words the screens
currently look complex, hard to read and difficult to understand, and the effect is that a user
does not use the screen. That is the cost being paid: not confusion, abandonment. A screen
nobody opens is worth less than one that does half as much and is read.

What every screen owes. Text that is simple, clear and structured rather than dense. Short
sentences a reader who does not know the codebase can follow. An example where an example makes
it concrete, because one example usually replaces a paragraph.

The convention for depth, which is what makes brevity affordable. Where there is more to say
than the space allows, the page carries a question mark in a circle. Clicking it opens the
longer help. The longer help is ALSO in simple words: this is a place for more, never a place
for denser. A reader who opens it because the short text was not enough is the last reader who
should meet jargon.

This is one convention and not one per screen. It gets a single component, a single icon, a
single interaction and a single set of string keys, so that a reader who learns it on one screen
knows it everywhere. Inventing a second shape for the same idea is the defect this item exists
to prevent.

What it does not license. It is not permission to move an important sentence out of sight: if a
reader needs a fact to understand what they are looking at, it belongs on the page. The question
mark carries what is useful to some readers sometimes, not what is necessary to all readers
always. And a measured zero is still drawn and named where the standard for that applies; brevity
never becomes silence.

Both languages, as everything on these screens must be. Text built in script has no key and is
permanently English on the Hebrew page, which is a defect class already being fixed elsewhere and
must not be added to here.

When this applies: to every screen touched from now on, and to the screen-by-screen walkthrough
in particular, which is the moment each page is looked at anyway. Rewriting the text is part of
the work on a screen rather than a separate task filed for later.
