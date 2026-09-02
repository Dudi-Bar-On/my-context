---
id: KNOWN-four-timing-sensitive-tests-each-went-red-once-under-load
type: known_issue
title: four timing-sensitive tests each went red once under load after the dry-run landed
status: active
severity: soft
always: false
summary: Several time-sensitive checks each failed once when too much was running at the same time, and the extra parallel work bought no speed at all.
summary_of: 0208fd1129e39b50
scope: []
tags:
  - v2
  - testing
  - execute
  - performance
origin: human
source_file: null
source_anchor: null
source_checksum: e8e8107c4396d952
valid_from: 2026-08-27
valid_until: null
checksum: e09b2efae493864b
---

# four timing-sensitive tests each went red once under load after the dry-run landed

> **RESOLVED 2026-08-28, and both of my hypotheses were wrong.**

The cause is CONTENTION, and it was found by varying the one thing nobody had
varied: the worker count. Measured on the same code, the same machine, minutes
apart:

    default (10 workers on 20 cores)  ->  5 failures
    --workers=4                       ->  186 passed, 0 failed
    repeated through npm at the cap   ->  186 passed, 0 failed
    wall clock                        ->  2.7 min vs 2.8 min

The extra workers bought no speed at all. The machine was already saturated at
four, and workers five through ten added only timing noise. Fixed by
`workers: '20%'` in `e2e/playwright.config.ts`.

**What this cost, and why it is worth keeping the wrong turns written down.**
Seven different specs went red across two days. Each passed in isolation. Twice
I wrote down a mechanism and twice it was wrong:

  1. "the dry run spawns child processes" — plausible, untested, and it survived
     because it explained the timing without being checked.
  2. "a UI server was running, which the plan's Global Constraints forbid" — this
     one had a QUOTE from the plan behind it, which made it feel established.
     Stopping every server made the run WORSE: five failures against one.

Both were reasoning from a plausible story to a conclusion. The measurement that
settled it took four minutes and could have been run at any point on either day.
The rule this project already holds — do not call a test flaky until it has been
measured — was followed to the letter and still produced two wrong causes,
because "measure it" was read as "run it again" rather than "vary something".

The original observation follows, unedited, as the record of what was seen
before it was understood.

---

Four timing-sensitive tests have gone red once each under full-suite load and
> passed in isolation every time, all on 2026-08-27, all after `plan:execute
> seq:5b` landed:
>
>     test/core/seen-file.test.ts   the append retry budget is wired
>     e2e/app-restart.spec.ts       a page open across a server restart recovers
>     e2e/app-refresh.spec.ts       a dead token is dropped in memory
>     e2e/app-layout.spec.ts        delivered row labels begin at one left edge
>
> Measured: each passed alone (3/3 for seen-file, 6/6 for the two app specs,
> 17/17 for app-layout), and each full run that showed one also showed the rest
> green — the full node suite went 12 fail, then 2, then 0 across three runs
> with the same code.
>
> A FIFTH joined them on 2026-08-28, and it is the most informative because its
mechanism is visible: `e2e/button-contrast.spec.ts` failed its anti-vacuity
guard with `drewNothing = ["doctor"]` — the Doctor screen drew no buttons, so
nothing on it was judged. It passed alone twice, immediately after. Doctor's
command block is built from a fetch, and the walk reads the screen at rest with
no barrier for that block: it waits for the screen, not for the thing the next
line reads. Under load the fetch has not resolved and the screen is measured
empty.

That is a real defect in the gate rather than in the app, and it is the shape
this corpus already names — waiting for a proxy instead of for the exact value
the next line consumes. Fixing it means giving the walk a step that fails as
itself when Doctor's block never arrives, the way `composeOnPalette` already
does for the Composer.

**This is NOT filed as flakiness.** "Flaky" is a verdict and nobody has
> established one. What is filed is the shape plus a plausible mechanism that
> has not been tested: `seq:5b` makes the confirm endpoint SPAWN A CHILD
> PROCESS per boundary confirm, about 1.2 s each against a 594-item corpus, and
> the suites now start measurably more processes than they did the day before.
> A machine with more processes competing has narrower timing windows, and
> every one of these four tests asserts something about time — a backoff, a
> reload, a restart, a layout settling.
>
> **A candidate cause nobody had checked, found 2026-08-28.** The plan's own
Global Constraints say: "Run the whole suite with `npm test` and the browser
suite with `npm run test:e2e`. Never run either from a subagent, and **stop
every server you have running before the e2e gate**."

Every e2e run today was made with a UI server up on 58888, serving the owner's
real corpus. That is the condition the constraint exists to forbid, and it was
not considered while attributing the failures to child processes from the dry
run. Two candidate mechanisms now stand unmeasured rather than one, and the
second was written down in the plan the whole time.

Not a verdict either. It is one more thing to vary in the comparison below.

What would decide it: run the full suite N times on the pre-5b commit and N
> times on this one, and compare how often each of the four goes red. Until
> somebody does that, the honest record is "seen once each, under load, after a
> change that added child processes", not a verdict either way.
>
> The cost is real regardless of the cause: a confirm that spawns a node
> process and copies a corpus is a second of latency on a click, and it is paid
> every time a person opens a confirm rather than once per session. If that
> proves too slow in use, the fix is not to abandon the dry run — it is to cache
> the copy per corpus generation, which nothing has needed yet.
