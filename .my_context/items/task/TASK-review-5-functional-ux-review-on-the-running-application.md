---
id: TASK-review-5-functional-ux-review-on-the-running-application
type: task
title: "review 5: functional UX review, on the running application"
status: active
severity: soft
always: false
summary: Judge whether the built application actually lets someone get things done, rather than whether it matches the design.
summary_of: a80d861b8cb25e8e
scope: []
tags:
  - "plan:review"
  - "seq:5"
  - "state:done"
  - v2
  - review
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: d634281e502acfc1
plan: review
seq: "5"
state: done
priority: "2"
---

# review 5: functional UX review, on the running application

**Blocked until `mycontext ui` runs — ui1 task 15.**

The owner's first question was whether the UI is functionally the best it can be. That cannot be answered today: `src/ui/public/index.html` is a 253-byte shell with an empty body, and all 21 e2e specs load the **mockup**, not the app.

Once the server serves a real shell, this is a task-completion review rather than a design review: can a user find what governs a file, promote a draft, see why a search returned nothing, and recover from a stale projection. Driven through Playwright against the real server, in both languages.

Distinct from review 1, which judges the design of record. This one judges what was built from it.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, AND IT IS UNBLOCKED -- sixth stale blocker, and of everything this reconciliation has cleared it is the one that most directly answers the owner s own words.

It is "Blocked until `mycontext ui` runs -- ui1 task 15". UI1 TASK 15 IS DONE. The server runs, 22 screens ship, and both the app and the mockup have been rendered side by side and walked screen by screen.

WHY IT MATTERS NOW. The owner said, 2026-08-25, that he cannot tell where v2.0.0 stands and that "subjective my feeling is that many things does not work". Every gate in this project measures SHAPE -- tree parity compares element trees, styles-parity compares blocks, screen-parity compares sorted sets. NOTHING MEASURES WHETHER A SCREEN WORKS. This task is the only item in the corpus that does, and it has been sitting behind a dependency satisfied days ago.

AND THE RECONCILIATION HAS ALREADY FOUND THREE THINGS IT WOULD CATCH, none of which any gate can see: the status strip announcing the bridge is not installed without asking; ui.enabled accepted, validated and read by nothing; the retiming transition declared and inert because every segment is rebuilt from scratch. All three are behaviours. All three are green under every gate.

RECOMMEND IT AS THE FIRST TASK AFTER THE RECONCILIATION, ahead of new building.

DONE 2026-08-25. Run through Playwright against the running server over `.demo-corpus`,
headed, in both languages, exactly as this task specified. Full account:
NOTE-the-functional-ux-review-21-screens-both-languages-four.

THE FOUR JOURNEYS IT NAMED, answered:
  find what governs a file           WORKS
  promote a draft                    WORKS -- correct command on the clipboard;
                                     nothing acknowledges the copy
  see why a search returned nothing  the composer works; `is not` is correctly
                                     disabled and never says why
  recover from a stale projection    the refusal is honest and correct; the
                                     recovery is prose only

AND THE ANSWER TO THE QUESTION BEHIND THE TASK -- "is the UI functionally the
best it can be" -- is that IT RUNS. 21 screens, two languages, zero console
errors, zero uncaught page errors, zero failed network requests, zero screens
that failed to draw. The owner's "many things does not work" is not what the
evidence shows. Six specific things do not, and they are filed as plan:walk
seq:31 through seq:36.

SIX TASKS FILED, none of which any existing gate could have found, because every
gate in this project measures SHAPE and all six are BEHAVIOUR:

  seq:31  a Copy button acknowledges nothing, and the app has no aria-live
          region anywhere -- so a screen reader is never told that anything
          happened, on any screen
  seq:32  the stale-projection refusal names `mycontext audit` and will not hand
          it over: zero .cmd rows, zero copy buttons, on all three refusing
          screens
  seq:33  that refusal says everything twice and leaks an absolute path into
          .audit/audit.db
  seq:34  doctor draws a card headed "error" containing nothing, which reads as
          an error rather than as the absence of one
  seq:35  Injected now lands on the one session with no lines, while
          /api/sessions says that session has six items
  seq:36  `is not` is disabled correctly and silently

TWO THINGS CONFIRMED LIVE that had until now only been reasoned about: the watch
filter row collapses to `All` alone on a behind projection (plan:ui3 seq:11x,
AUDIT_KINDS -- it offers All plus all six kinds when fresh), and the Capture
screen ships the sentence "no similarity metric exists in this product" whose
reason is false (plan:ui2 seq:5r).

TWO THINGS CHECKED AND CLEARED rather than assumed, both of which looked like
defects first:
  - the coverage tree's labels have a real 7px gap between count and filename;
    they only LOOK run together in a textContent dump. Measured geometrically.
  - `#screen` accumulating one hidden <section> per visited screen is
    DELIBERATE, documented in app.js's route(), bounded at 21, and mirrors how
    the mockup keeps all 21 -- and every revisit calls replaceChildren() and
    re-renders, so no stale data is ever shown.

AND ONE CORRECTION MADE BEFORE IT WAS WRITTEN DOWN. I first had Ask saying
NOTHING about a behind projection while watch refused honestly, and was about to
file "two screens reading the same projection disagree about whether to tell the
user". My probe had truncated the screen text at 900 characters and cut the
message off. Ask reports it, with the same sentence, as does decay.

THE INSTRUMENTS WERE TEMPORARY and are removed: two spec files dropped into
`e2e/`, run, deleted. Both trees clean, all seven gates green.
