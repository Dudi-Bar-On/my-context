---
id: DEC-the-help-card-keeps-the-sentences-that-explain-how-its
type: decision
title: the help card keeps the sentences that explain how its example was built
status: active
severity: soft
always: false
summary: Explanatory lines on the help screen are approved as written, including the one that says the example was checked.
summary_of: 07073bffaba7b94e
scope:
  - src/ui/public/strings/en.js
  - src/ui/public/strings/he.js
tags:
  - v2
  - ui
  - help
  - copy
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: ef654f845bf5a082
---

# the help card keeps the sentences that explain how its example was built

Owner ruling 2026-09-07. The D24/D25/D26 lane added fifteen string keys, and flagged eight of them
as making CLAIMS rather than labelling controls - product copy, his under
DEC-claude-drafts-the-mockup-and-the-owner-approves. He read them and kept them as written.

THE THREE SUBSTANTIAL ONES, and what each is for:
  clih.composedhow  says the line was built on this request from the same declarations the table
                    shows, that a refused pairing puts one switch on the line and names the other
                    below it, and - the load-bearing clause - that the line was put through the
                    same parser the CLI refuses with, and was accepted.
  clih.asks         says an angle-bracket slot names something in the reader own project, so no
                    value there would be right in every repository.
  clih.nopos        says what a command takes before its switches is not written down anywhere the
                    page can read, so the line is switches only and may be short of an operand.

THE OTHER FIVE are the omission notes - why a switch was left off a composed line - and they exist
because INV-nothing-is-dropped-silently would otherwise be broken by a line that quietly spends
some flags and not others.

THE PARSER-ACCEPTANCE CLAUSE IS WHAT MAKES THE LINE TRUSTWORTHY and is not to be cut for brevity.
A generated example is a composition; without that sentence a reader has no reason to believe it is
a command rather than a plausible-looking string. It is also true rather than aspirational: all 58
composed lines were run through builder/4 own checker and accepted.

RECORDED SO A LATER TIDYING PASS DOES NOT UNDO IT: these were considered for shortening and kept.
