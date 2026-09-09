---
id: TASK-an-export-offers-to-swap-secrets-for-obvious-fakes-and-never
type: task
title: an export offers to swap secrets for obvious fakes, and never decides for you
status: active
severity: soft
always: false
summary: Copying a conversation out offers a list of things that look private, and replaces only what you tick with an obviously fake stand-in.
summary_of: a9a5026a70d8829a
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
checksum: 3f9a5402bee2a245
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

── STEPS 1, 2 AND 4 LANDED 2026-09-09 (commit 290023b7). THE FORM IS WHAT REMAINS ───────────

STOPPED AT THE FORM ON PURPOSE. This lane was given the browser-free half so that a second lane
could hold `src/ui/public/screens/conversations.js` at the same time. Nothing under `src/ui/` was
touched, no UI string was added, and no browser was run.

WHAT WAS BUILT, file by file:

  - `src/core/conversation-secrets.ts` - PURE, no filesystem write, deliberately absent from
    `test/ui/no-writes.test.ts`' WRITERS table. NINETEEN shapes: the thirteen this item names, plus
    six added - Stripe keys and webhook secrets, npm tokens, Google OAuth client secrets, SendGrid
    keys, A CREDENTIAL NAMED BY ITS JSON FIELD (primaryApiKey / accessToken / refreshToken /
    clientSecret / private_key, which is the shape that would have caught the key seq:27 actually
    found, because it matches the FIELD rather than the value), and a 32/40/64-char hex token gated
    on an auth-ish word within 24 characters before it - the shape of the ONE true positive of
    2026-09-08, gated because this corpus is full of 16-char checksums and 40-char git shas that an
    ungated hex shape would propose one by one. Every shape carries `added: true|false`, so the set
    can say which members are the thirteen; the item calls them a starting set, and a widened
    detector that forgot to mark its additions is indistinguishable from one that misremembered the
    original scan. Shapes are declaration-ordered and overlaps resolved narrowest-first, so
    `Authorization: Bearer sk-ant-...` is proposed ONCE, as an Anthropic key.
  - `src/core/conversation-redaction.ts` - the filesystem half, a new WRITERS key.
  - `src/cli/commands/conversation.ts` - the two command lines.
  - `src/core/conversation-mirror.ts` - `advanceMirrors` now projects the appended tail through the
    choice, and `MirrorReport` gained `redacted` / `redactedBytesWritten`.
  - `src/hooks/stop.ts` - `refreshNote` gained one clause, so the audit row says when a choice was
    re-applied to an appended tail. A redacted copy that quietly stopped being projected would put
    a ticked value back into the file on the next turn and nothing else in the row would differ.
  - tests: `test/core/conversation-redaction.test.ts` (23) and
    `test/cli/conversation-secrets.test.ts` (12).

A CANDIDATE'S ID IS A HASH OF ITS VALUE, and that is a security property rather than a naming
convention. The report, the `--json` a form renders, the accepted list handed back, and the plan on
disk are ALL free of credential material - the redactor recovers the values by scanning the file
again. It also answers this item's two hardest requirements for free: one value is one id is one
placeholder, in every record and in every tail appended afterwards. The receipt for why that
matters is in this project's own history: the lane that REPORTED the 2026-09-08 finding wrote a
complete bearer token into a corpus item, and corpus items are committed and pushed.

WHAT THE CLI NOW EXPOSES FOR THE FORM, which is the thing the next lane builds against:

  `mycontext conversation secrets [<session>] [--json]`

It writes nothing and takes no `--yes`, because detection proposes. `--json` carries, per candidate
- and the unit is the distinct VALUE, not the occurrence, because that is the question a person is
being asked:

    id            the checkbox's value, and the only handle the redactor needs
    shape         which of the nineteen, and `added` says whether it is past the thirteen
    shapeTitle    what a person calls it
    preview       first four and last four characters, with the length of the middle. NEVER the value
    length        characters, which a mask cannot carry
    occurrences   how many times, across the session
    records       which record indexes, capped, with `recordsOmitted` saying how many are not listed
    firstRecord / lastRecord
    paths         where inside the record - `message.content[0].input.command`
    contexts      the text around it, with every match in the window masked. THIS is what tells
                  `secret = cryptoRandomBytes` from a credential, and it is the field that does the
                  actual work of the form
    placeholder   what it becomes if ticked, shown BEFORE the choice
    accepted      whether it is already ticked. `false` for everything until somebody chooses

plus `shapes` (the legend, ids/titles/added/notes, never the patterns), `records`, `unreadable`,
`scannedBytes`, `truncated`, `occurrences`, `total`, `chosen` (the standing choice, or null), and
`replaceCommand` - the Composer's payload, which is the exact line the screen hands back.

  `mycontext conversation persist <session> --replace <id,id,...> [--yes]`

The substitution's call site, on the command that already exports, because his design puts it ON
EXPORT ONLY. `--replace=` with nothing after it TAKES THE CHOICE BACK and removes the derived copy;
without that there is no way to untick a box. `--off` and `--replace` together are refused rather
than half-applied.

THE PLACEHOLDER IS `FAKE-<shape>-<id12>-NOT-A-REAL-VALUE`. Two readers are served at once: `FAKE-`
in front for a person skimming, `-NOT-A-REAL-VALUE` at the end so it survives a middle truncation,
and both made of characters JSON never escapes, so the stand-in occupies exactly the bytes it
appears to and a diff against the original is readable. It is never proposed as a candidate itself,
so a redacted copy cannot redact itself.

ONE DESIGN DECISION TAKEN IN-LANE, AND IT IS REVERSIBLE. The redacted output is a SECOND FILE
beside the mirror - `<session>.redacted.jsonl`, with an id-only plan at `<session>.redaction.json`
- and the mirror itself stays byte-for-byte the transcript. Rewriting the mirror in place would
have ended all three of seq:4's guarantees at once: the copy would stop being a prefix of anything,
`PersistedRow.bytes` would stop being its length, and `stillPrefix` would report every mark as
broken on the next turn. This is NOT the "two copies to disagree about" that seq:4 refused when it
declined a separate `export` verb - those would have been two answers to one question; these are
two different things, one derived from the other by a plan on disk. If he wants the mirror itself
redacted instead, that is a change to this one module, not a rebuild.

THE PLAN IS A SIDECAR FILE AND NOT A COLUMN ON `persisted`, deliberately: `openReadOnlyChecked`
treats a missing column as an index built by an older build, so adding one would put every existing
workspace through a rebuild in order to ship a feature nobody has turned on. `persist --off` leaves
both the copy and the plan, exactly as it already leaves the mirror.

NOTHING IS REPLACED BY DEFAULT, proved rather than argued. A copy of a file FULL of candidates with
none of them accepted is asserted BYTE-IDENTICAL with `Buffer.equals`, and `redactString` returns
its argument on an empty set. `advanceRedaction` answers null for a session nobody chose anything
for, so the ordinary path costs one `existsSync` and produces no file.

WHAT REMAINS - and it is ONE step, which is why this item is left open rather than split:

  1. THE FORM. A checkbox list on the Conversations screen, drawing `conversation secrets --json`
     and composing `persist --replace` back through the Composer. `test/ui/no-writes.test.ts` holds
     `src/ui/` write bindings to an exact set of one, so the screen COMPOSES and the CLI RUNS -
     that is the answer to this item's "where the form lives", and it is settled by that test
     rather than by preference. Its catalogue row is already written in
     `test/ui/palette-lib.test.ts`' UNCATALOGUED, naming the form as what it waits for.
  2. Not blocking, and reported rather than filed: SUBAGENT TRANSCRIPTS ARE NOT SCANNED, because
     they are not mirrored. The one true positive of 2026-09-08 was in a subagent transcript, so
     that is a real gap in the coverage of this feature - it just is not a gap in the export, which
     is what this item is about.
  3. Also reported: the detector reads a session at `MAX_SCAN_BYTES` and says so when it stops
     there, and a `truncated` list is a FLOOR. On the owner's 65 MB session that bound is not
     reached; it is named because a list a reader believes is complete is worse than one that
     admits it is not.

FULL UNIT SUITE at the time of the commit: 7228 tests, 4 failures, all four known-red at HEAD and
none of them this lane's - two `diagram-gate` (they need `npm run gen:docs`) and two
`statusline-chain` (the pair that rotates with `ingest-lock` under contention and passes alone).
`palette-lib`'s two were red before this lane and are GREEN now: one of them was the command
catalogue, which this lane closed by writing the row above. `tsc --noEmit` is clean and
`npm run check:basis` reports nothing outside the baseline.
