---
id: TASK-watcheddocs-is-the-one-config-subject-nothing-prints-and
type: task
title: watchedDocs is the one config subject nothing prints and nothing checks, so Configure's Watched pane composes a change no receipt can confirm
status: active
severity: soft
always: false
summary: One setting can be changed and then never seen, because nothing in the tool will print it back to confirm the change took.
summary_of: 34164574edea56fd
scope: []
tags:
  - v2
  - ui
  - walk
  - "screen:config"
  - "screen:doctor"
  - cli
  - "plan:walk"
  - "seq:106"
  - "state:todo"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: c47cd5fbd9f8c92d
plan: walk
seq: "106"
state: todo
priority: "1"
progress: "0"
source: "plan:walk seq:27, measured against screens/config.js, screens/doctor.js and src/doctor/checks.ts on 2026-08-29"
---

# watchedDocs is the one config subject nothing prints and nothing checks, so Configure's Watched pane composes a change no receipt can confirm

FOUND 2026-08-29 under plan:walk seq:27, reading `screens/config.js` and `screens/doctor.js` together. Each names its own half and neither can see the other's.

CONFIGURE'S CONTRACT IS THAT EVERY PANE ENDS IN A SETTLE STEP WITH THREE PARTS: the exact bytes, the absolute path, and ONE composed command that confirms the edit took -- `plan:config seq:4`'s "what to run afterwards to confirm it took". Three of the four panes have a real receipt: Profile is `mycontext status`, whose first line prints `profile "<name>"`; Categories is `mycontext list <category>`, which refuses BY NAME if the paste left the category unresolvable.

**WATCHED DOCUMENTS HAS NO RECEIPT AND ITS COMMAND IS NAMED NARROWLY BECAUSE OF IT.** The pane composes `mycontext doctor`, and `config.js` says exactly what that buys: it re-reads `config.json` and refuses by name if the paste broke it. "It does NOT report the globs themselves -- nothing in the CLI does". Measured 2026-08-29: `watchedDocs` is read by `src/hooks/post-tool-use.ts`, written by `init`, validated by `src/core/config.ts`, and PRINTED by no command in the registry.

**AND THE CHECK THAT WOULD HAVE MADE `doctor` A REAL RECEIPT DOES NOT EXIST.** `watched_docs_no_match` appears in the mockup's doctor table wearing the design's own `PROPOSED` badge, and `screens/doctor.js` names it as "one of the three PROPOSED checks this build does not have" -- it is why the mockup's warning card carries a `.cmd` that the real screen correctly does not draw. `src/doctor/checks.ts` has no such check. So a `watchedDocs` list every glob of which matches nothing is a configuration that is valid, loads, passes `doctor`, and does nothing at all.

**AND THE THIRD SURFACE IS BLIND FOR THE SAME REASON.** The Watched pane's blast panel draws NO governing count and wears the `unmeasured` face, because `watchedDocs` is read by nothing `POST /api/config/preview` runs -- not `injection`, not `agentEditsFor`, not `scopePolicyFor`, not `select`. Posting a candidate that differs only here answers `0` changed and every item unchanged: a true zero about a question nobody asked, which `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` forbids drawing. That refusal is correct and it leaves the subject unmeasured on all three surfaces at once.

SO ONE CONFIGURATION KEY IS INVISIBLE TO THE CLI, TO THE SELF-CHECK AND TO THE PREVIEW ENDPOINT, and it is the one whose whole purpose is to fire a nudge later, in a hook, when a document is edited -- the failure is silent by construction and arrives days after the paste.

WHAT THE WORK IS, and the first part is the one that unblocks the other two:

1. BUILD `watched_docs_no_match` in `src/doctor/checks.ts` -- the design of record already draws the row. A glob in `watchedDocs` matching no file in the repository is a finding, in the shape `dead_scope` already has for item scopes, whose message the doctor screen can then isolate and whose count the Watched pane can then quote.
2. THEN plan:walk seq:18 is buildable as written. It gives `repairCommandFor` the code `watched_docs_no_match` and builds `mycontext init --rewrite-watched` as its repair -- and it presumes the finding exists. It does not. Sequence this before it.
3. DECIDE whether the Watched pane's blast panel quotes that check rather than staying `unmeasured`. It is a different kind of number from the other three panes -- files matched, not items governed -- so it needs its own key and its own sentence, or an explicit ruling that `unmeasured` is the permanent honest answer for this subject.

DO NOT close this by having the Watched pane compose a different command. There is no command to compose; that is the finding.
