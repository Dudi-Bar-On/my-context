---
id: TASK-an-export-offers-to-swap-secrets-for-obvious-fakes-and-never
type: task
title: an export offers to swap secrets for obvious fakes, and never decides for you
status: active
severity: soft
always: false
summary: Copying a conversation out offers a list of things that look private, and replaces only what you tick with an obviously fake stand-in.
summary_of: 7fd7306e453d70d7
scope:
  - src/core/conversation-mirror.ts
  - src/cli/commands/conversation.ts
tags:
  - v2
  - archive
  - security
  - "plan:archive"
  - "seq:46"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 672acc2339922b76
plan: archive
seq: "46"
state: todo
priority: "2"
needs: archive/4
---

# an export offers to swap secrets for obvious fakes, and never decides for you

OWNER DESIGN 2026-09-09, replacing plan:archive seq:27 with something narrower and better:

"the Export is mostly borned for the user itself to copy it’s conversation to other place and not
to be shared by others. when user requesting export it should be askd to list private details or
sensitive info from the conversation and uppon it’s selection the exported version will include a
replacement faked place holder for it’s original data like api keys, tokens, passwords etc’, we’ll
show the user a form with checkboxes and user could mark what to be replaced if it required."

WHY THIS IS BETTER THAN THE TWO THINGS I PROPOSED, and the difference is the whole design:
DETECTION PROPOSES, IT NEVER ACTS. I offered automatic scrubbing on the display path or on the
export path. Both put a pattern list in charge of what a reader may see, which means a false
positive silently HIDES his own work and a false negative silently reassures him. His shape has
neither failure mode: a candidate that is wrong simply sits in a list unchecked, and a candidate
that is missed is a gap he can see is a gap, because he is looking at the list.

AND IT PUTS THE JUDGEMENT WHERE THE KNOWLEDGE IS. Only he knows whether a string in his own
conversation is a secret, a fixture, a test probe or a quotation. The scan of 2026-09-08 found
eight matches of which ONE was a real secret, five were deliberate test probes and one was the
identifier `secret` in `secret = cryptoRandomBytes`. A machine cannot tell those apart. He can, at
a glance, from a list.

── WHAT TO BUILD ────────────────────────────────────────────────────────────────────────────

1. ON EXPORT ONLY. Not on display, not on the clipboard, not in the read model. seq:27 is closed
   on the finding that a viewer of files already in the reader’s home adds no exposure at rest;
   this is about a SECOND COPY at a stable path outside the project that no `.gitignore` covers.
   The relevant command is `mycontext conversation persist` (seq:4, re-cut by his own ruling from a
   one-shot export into a standing mirror).
2. SCAN AND OFFER. A list of candidates with enough context to judge each - what it looks like,
   where it appears, how many times. The 2026-09-08 scan covered thirteen credential shapes
   (Anthropic, OpenAI, GitHub, AWS, Slack, Google, PEM blocks, JWTs, bearer headers, key=/secret=
   assignments, export *_TOKEN=, URL userinfo) and is the starting set, not the finished one.
3. A FORM WITH CHECKBOXES, his words. He marks what to replace. Nothing is replaced by default -
   an export he did not read must be byte-faithful, because a silent alteration is worse than a
   silent inclusion when the file’s whole purpose is to be a record.
4. A FAKE PLACEHOLDER, NOT A DELETION. He said "replacement faked place holder", and that is the
   right instinct for a reason worth writing down: a deletion changes the shape of the record and
   can break whatever reads it, while a placeholder of the same shape keeps the file valid AND
   visibly says something was replaced. Make the placeholder unmistakably fake so no reader ever
   tries to use it, and so a diff against the original shows exactly what moved.

── THINGS TO DECIDE RATHER THAN ASSUME ──────────────────────────────────────────────────────

  - WHERE THE FORM LIVES. `persist` is a CLI command and the archive is a screen. A checkbox form
    is natural in the browser and awkward in a terminal; but the export is a write, and
    `test/ui/no-writes.test.ts` holds `src/ui/` write bindings to an exact set of ONE. So either the
    CLI prints a numbered list and takes a selection, or the screen composes a command the CLI runs
    - which is the Composer pattern this product already has. Weigh both.
  - THE MIRROR KEEPS UP. `advanceMirrors` appends new records on the Stop hook. So a choice made
    once must apply to everything appended AFTERWARDS, or the first tail after an export
    reintroduces the secret. That is the hardest part of this item and it is not obvious from his
    sentence: the selection has to persist with the mark, not with the export event.
  - AND A REPLACEMENT MUST BE STABLE ACROSS APPENDS. The same secret appearing twice must get the
    same placeholder, or a reader of the export cannot tell that two occurrences were one value.

WHAT IS EXPLICITLY NOT IN SCOPE: scrubbing the display, the clipboard, or the index. And rotating
anything - that is his, and seq:27 says so.
