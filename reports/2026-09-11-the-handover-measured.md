# The handover, measured

**2026-09-11.** Item:
`MEAS-the-handover-measured-for-reliability-truth-and-use-and-the`
(filed for this lane; see *The item* at the foot).

The owner asked whether the handover mechanism can be measured for
effectiveness, reliability, and impact on ongoing development, and said it
bears on the self-improvement mechanisms (D36).

This is the measurement. **Three of the four things asked for are measurable and
are measured below. One — impact on development — is not, and no number for it
appears anywhere in this document.**

Every figure here was computed by a command printed beside it. Nothing is
remembered. Where an existing instrument already produced a number, that
instrument was run rather than quoted.

---

## 0. One figure in the dispatch brief did not reproduce, and it is the first result

The brief that dispatched this lane described `reports/V2-HANDOVER.md` as
*"58 dated blocks, 2026-08-21 to 2026-09-11"*. Computed:

```sh
node -e "const fs=require('fs');
const lines=fs.readFileSync('reports/V2-HANDOVER.md','utf8').split(/\r?\n/);
const heads=lines.filter(l=>/^#{2,3}\s*\u23ed/.test(l));
const d=heads.map(h=>(h.match(/2026-\d\d-\d\d/)||[null])[0]).filter(Boolean);
console.log('heads',heads.length,'dated',d.length,'range',d.slice().sort()[0],d.slice().sort().pop());"
```

```
heads 44   dated 41   undated 3   range 2026-08-26 .. 2026-09-11
```

Forty-four block heads, forty-one of them carrying a date, earliest 2026-08-26.
Not fifty-eight, and not 2026-08-21. The brief's other figures — 4,601 lines,
44 blocks, 212 pointers (132 lane, 80 item), 0 dangling, 4 retired, 9 carried —
all reproduce exactly, because they came from `scripts/check-handover.ts`. The
one that did not reproduce is the one no instrument produced.

That is the whole subject of this report in one paragraph: **the figures this
project computes survive being re-derived; the figures it remembers do not.**

---

## 1. THE NINE CARRIED INSTRUCTIONS — each one labelled

`node scripts/check-handover.ts --json` reports nine pointers carried into
three or more blocks with the work still open. Its own header says six carries
and no closure is what the `isServableDocPath` defect looked like from outside,
and that only a person can tell HARD from IMPOSSIBLE. Each of the nine was read
in full, against its own `needs:` chain and against the shipped code.

**The nine do not fall into two classes. They fall into four**, and the two
classes the check does not have are where the defects are.

| lane | blocks | verdict |
|---|---|---|
| `builder/5` | 8 | **DONE — the item is wrong** |
| `builder/17` | 5 | **DONE — the item is wrong** |
| `walk/119` | 7 | **IMPOSSIBLE as written** |
| `library/6` | 10 | HARD — unblocked, large, half-landed |
| `docsys/11` | 10 | HARD — blocked only by `library/6` |
| `budget/15` | 6 | HARD — unblocked, ruled, actionable (running today) |
| `port/93`→`port/98` | 3 | HARD — blocked, blocker in flight |
| `port/98`→`port/99` | 8 | HARD — **and terminal by ruling, so it can never stop being carried** |
| `walk/141` | 3 | HARD — its stated hold is already satisfied |

### 1a. `builder/5` and `builder/17` are BUILT, TESTED and GREEN, and their items say `todo`

This is the most actionable finding in the report and it is not a judgement
call.

`TASK-one-builder-component-rendered-from-a-catalogue-entry` (`builder/5`) and
`TASK-the-id-box-filters-well-and-shows-less-than-half-of-what-you`
(`builder/17`) both carry `state: todo`. Both shipped on 2026-09-07:

```
93920f60 2026-09-07 13:26:05 builder/5: one builder component -- and the mockup half was already dead
1be21693 2026-09-07 14:43:26 builder/6, /8 and /17: the check is wired, the legal values are on
                             screen, and you can read the id you picked
```

The component exists, names its own task in its header, and is imported by two
screens:

```sh
wc -l src/ui/public/lib/builder.js          # 1055
head -8 src/ui/public/lib/builder.js        # names plan:builder seq:5 and plan:walk seq:20
grep -rn "from '/lib/builder.js'" src/ui/public/screens/   # capture.js:180, palette.js:191
```

And the work is pinned by a test that runs green today:

```sh
node --import ./test/helpers/pin-rendering.ts --test --test-timeout=60000 test/ui/builder.test.ts
# tests 24  pass 24  fail 0   duration_ms 2376
```

Among those 24 are *"the echo is a full-width paragraph and the suggest box
keeps its cap"* and *"the echo isolates the id and infers the direction of the
title"* — `builder/17`, clause for clause, asserted against `styles.css`.

**It is not two items. It is four.** The same two commits landed `builder/6` and
`builder/8`, and all four are still open:

```sh
# plan/seq -> state, read straight from the item frontmatter
builder/5    [todo/active]  ONE builder component, rendered from a catalogue entry
builder/6    [todo/active]  copy is refused until the command passes, and the refusal is readable
builder/8    [todo/active]  each builder shows what is legal, without leaving the screen
builder/17   [todo/active]  the id box filters well and shows less than half of what you picked
builder/11   [done/active]  the composer is tested as a user would use it …
walk/20      [done/active]  draw the builder once in the mockup …
```

`builder/11` and `walk/20`, landed in adjacent commits by adjacent lanes, were
closed. These four were not.

**What that costs, today, mechanically:**

```sh
node src/cli/index.ts ready --plan builder --short
```

```
│ builder/17 │ 2 │ todo │ the id box filters well and shows less than half of what you picked │
│ builder/12 │ 3 │ todo │ ack offers 951 items to acknowledge a finding on …                  │
│ builder/5  │   │ todo │ ONE builder component, rendered from a catalogue entry              │
3 ready of 5 open task(s)
```

**Two of the three tasks `mycontext ready` offers as the next work in
`plan:builder` are already built, tested and shipped.** A lane dispatched from
that list would rebuild them. This is the same defect class as
`isServableDocPath` — a faithful lane doing exactly what it was told and
producing nothing — arriving through the corpus rather than through the
handover.

**And it corrupts the CARRIED metric at its root.** `check-handover` derives
"still open" from the item's `state`, so `builder/5` is reported as
*"carried in 8 of 44 blocks and still open"* when it has been finished for four
days. Two of its nine findings are false, and they are false in the direction
that manufactures alarm.

**The handover itself was not at fault, and this is worth stating precisely.**
`builder/5` landed at 13:26 and `builder/17` at 14:43 on 2026-09-07. The last
block that names either is block 18, introduced by `8b4a314b` at **08:02 that
morning** — before both. The next block written after the landings
(`5dcbf864`, 20:06) names `library/6`, `docsys/11`, `port/99`, `walk/119` and
`walk/141`, and names neither builder lane. **The handover stopped carrying them
the moment they landed.** The residual counts of 8 and 5 are fossils of blocks
written before the work was done, and the checker has no way to know that.

*(Derivation: `scratchpad/block-provenance.mjs` — block counts are monotonic
across all 47 committed states of the file, verified, so the block introduced by
the commit whose state held `B` blocks is today's index `44 - B`.)*

### 1b. `walk/119` is IMPOSSIBLE as written — and this is the `isServableDocPath` shape, live

`TASK-every-item-everywhere-needs-a-trigger-that-explains-it-in` (`walk/119`,
priority 1, no `needs:`, carried into 7 consecutive blocks, 2026-09-07 to
2026-09-08) requires, in its own Done-when:

> **A summary can be missing**, and a missing one is a measured absence, not a
> blank. Where it is absent the trigger composes the command that would
> generate it … *Done when* … a missing summary is **drawn and named rather
> than blank**.

The shipped code rules the opposite, deliberately, under its own heading
(`src/ui/public/app.js`, `fillPaneSummary` docblock, `ABSENT IS ABSENT`):

> `summary` is optional on `Item` and always will be … So `null` **hides all
> three elements rather than drawing an empty paragraph, a blank line or a
> dash.**

Both were read directly. They cannot both be satisfied. A lane that executed
`walk/119` faithfully would reverse a ruled, documented, tested behaviour
without knowing it had, every gate would pass, and the reversal would look like
the feature.

This is not a new discovery — `reports/2026-09-07-walk-review.md` (anchor
`#walk119`) named it and put it to the owner:

> **A direct contradiction between the item and shipped code, and only you can
> settle it.** … One of the two is wrong and neither knows about the other.

and the item's own tail says *"AND ONE CONTRADICTION INSIDE THIS ITEM STILL
NEEDS THE OWNER'S RULING … Do not start the four gaps assuming it away."*

**What the measurement adds** is that this is invisible to every instrument the
project has. `walk/119` has no `needs:`, so `mycontext ready` lists it as
dispatchable. `check-handover` resolves it, so it is not dangling. It is
reported only as *carried 7 times and still open* — the same sentence it prints
for `library/6`, which is merely large. **Seven carries and no closure is what
this looks like from outside, and the checker's own header says so.** It was
right.

**Verdict: IMPOSSIBLE as written.** It becomes possible the moment the owner
rules on which of the two is wrong, and not before. It is the one of the nine
where a lane dispatched today would do damage rather than nothing.

### 1c. The six that are HARD, and why each is still open

- **`library/6`** (10 blocks, the most-carried). All three `needs:` —
  `library/3`, `library/4`, `library/5` — are `done`. Nothing machine-readable
  blocks it. Its own body records that it PARTLY LANDED on 2026-09-07: the
  render half is done and committed at 14/14, and *"the remaining work is the
  truth half"* — every one of 166 subjects opened and every claim compared
  against the derivation it came from. That is large and laborious, not
  impossible. Its body also carries a `HELD until D24, D25 and D26` clause
  written on 2026-09-06 that I did not resolve and do not claim either way.
- **`docsys/11`** (10 blocks). Blocked by exactly one open thing in its
  transitive chain: `library/6`. `builder/11`, its other dependency, is `done`.
  Its first instruction is to read D12's and D27's results before writing
  anything, which is correct and is why it waits. HARD, honestly blocked.
- **`budget/15`** (6 blocks). No `needs:`. Owner-ruled 2026-09-07 with the
  conflict measured rather than argued, the costs measured (append p95 0.55 ms
  against a 50 ms hook ceiling), and the scope narrowed to CLI and MCP only.
  Unblocked and actionable for four days. **A lane is executing it today.**
  Note that its own body records two corrections to its own `scope:` field that
  were never applied — it names `src/cli/commands/context.ts`, which holds no
  read command.
- **`port/98`** (3 blocks) and **`port/99`** (8 blocks). One chain:
  `port/99 → port/98 → port/93`, and `port/93` (PIXEL parity) is the only open
  link. A lane is on it now — `e2e/pixel-diff.ts` and `e2e/pixel-parity.spec.ts`
  are untracked in the working tree. HARD and correctly sequenced.
  **`port/99` deserves a separate note**, because it is the one carry the metric
  can never clear: it is `LAST UI TASK` by owner ruling, *"nothing supersedes it
  and nothing may be sequenced after it"*. An item designed to be last is
  guaranteed to accumulate carries for the life of the plan. Its repetition
  count is a fact about the schedule, not about the work, and the CARRIED tier
  cannot tell those apart.
- **`walk/141`** (3 blocks). Its `needs: builder/11` is `done`, and its body's
  stated hold — *"HELD UNTIL THE COMPOSER IS PROVEN — builder seq:11 (D12) is
  the proof"* — is therefore **already satisfied and the text was never
  updated**. It is dispatchable now and reads as held.

### 1d. What the nine, taken together, say about the CARRIED tier

Nine findings. **Two are false** (the work is done). **One is a genuine
impossible-as-written** and is the highest-value thing in this report. **One
can never be cleared by anyone** (`port/99` is terminal by construction). Five
are honest HARDs.

So the tier's precision today is 7 of 9 for "still open" and 1 of 9 for the
thing it was built to catch. That is not an argument against it — it found the
`walk/119` contradiction's *shape* at the seventh carry, which is what its
header promised. It is an argument that **the tier's "still open" comes from the
item's `state` field, and this corpus has four tasks whose `state` field is
four days stale.** The handover was not wrong about any of them.

---

## 2. RELIABILITY — 0-dangling is NOT recent, and it has NOT always held

### Method

`reports/V2-HANDOVER.md` has 47 committed states. For each, the corpus **as it
stood at that commit** and the handover as it stood at that commit were
extracted to a scratch directory and today's checker was run against the pair.
No git state was changed; `git archive` writes nothing.

```sh
git log --reverse --format='%H %ci' --follow -- reports/V2-HANDOVER.md > commits.txt
n=0; while read -r sha date rest; do
  n=$((n+1)); d="$SP/hist/$(printf '%03d_%s' $n ${sha:0:8})"; mkdir -p "$d"
  git archive "$sha" .my_context reports/V2-HANDOVER.md | tar -x -C "$d"
  ( cd "$d" && node "$REPO/scripts/check-handover.ts" --json "$d/reports/V2-HANDOVER.md" > out.json 2> err.txt; echo $? > code.txt )
done < commits.txt
```

One instrument, 47 states. **The instrument is today's; the data is each day's.**
That answers "did every pointer resolve against the corpus of the day it was
written", which is the question that matters.

### Result

```
state  commit    date        lines  blocks  pointers        DANGLING  retired  carried
  1    2485e738  2026-09-03   1986     5    57 (25L/32I)       1         0        0
  2    cb1cbbaf  2026-09-03   2069     5    58 (25L/33I)       1         0        0
  3    54bea32a  2026-09-03   2167     6    85 (40L/45I)       0         0        2
 …
 35    8e91cbd8  2026-09-08   4128    35   178 (103L/75I)      0         4       15
 36    4f61921f  2026-09-09   4220    36   189 (113L/76I)      1         4        9   <- live/23
 37    6a6a35f2  2026-09-09   4227    36   189                 1         4        9
 38    bc370e42  2026-09-09   4248    37   191                 1         4        9
 39    a9e32785  2026-09-09   4285    38   192                 1         4        9
 40    b1c3233c  2026-09-09   4317    39   192                 1         4        9
 41    cef42b20  2026-09-09   4350    40   194                 1         4        9
 42    460866a7  2026-09-09   4384    41   194                 1         4       10
 43    663ac8dd  2026-09-09   4385    41   193                 0         4       10   <- repaired
 …
 47    3313c8d2  2026-09-11   4601    44   212 (132L/80I)      0         4       10
```

**40 of 47 states resolve everything. Nine do not — two episodes, and only one
of them is a defect.**

**Episode 1 — states 1 and 2, 2026-09-03 01:02 to 15:21 (14 hours).**
`DEC-focus-discloses-and-allows` resolved to nothing. Diagnosed rather than
counted:

```sh
git log --diff-filter=A --format='%h %ci %s' -- '.my_context/items/decision/DEC-focus-discloses-and-allows*'
# 54bea32a 2026-09-03 15:21:17  corpus: the nested forty-four come home, and the board stops lying
# bb8a77b7 2026-08-16 18:15:23  docs(corpus): retire the open question …
```

The item was written on 2026-08-16 and lived in `.my_context.nested-44`. The
pointer was TRUE when written and dangled only against the relocated corpus,
for the fourteen hours between the repository becoming the single home
(`2485e738`) and the nested forty-four coming home (`54bea32a`). **This is an
artefact of a migration, not a false claim**, and it is counted here as one
because the instrument cannot tell the difference — which is itself worth
knowing about the instrument.

**Episode 2 — states 36 to 42, 2026-09-09 14:51 to 16:42.** `live/23`. This one
is a real false claim, and the record of it is exemplary:

> The 91% block said live/23 had been researched, FILED and put to him. The
> research happened; the item never did … Fixed by correcting the sentence
> rather than by creating the item to match it. Filing a task whose content is
> "this was moot" to satisfy a pointer would make the gate green by feeding it
> exactly the thing it exists to detect.
> — `663ac8dd`

**And the commit that repaired it understates its own duration.** It says *"This
was red at HEAD since 460866a7"*. Measured:

```sh
git rev-list --count 4f61921f..663ac8dd     # 13
git log -1 --format='%ci' 4f61921f          # 2026-09-09 14:51:23
git log -1 --format='%ci' 663ac8dd          # 2026-09-09 16:42:02
```

**HEAD was red for 13 commits and 1 hour 51 minutes, not one commit.** The
pointer entered at `4f61921f` (the 91% block) and stood through `460866a7` (the
96% block). **Five further handover blocks were written over the top of it**
(block counts 36→41), each by a session that had the false claim in its context,
and none of them checked. `npm run check:handover` existed since 2026-09-06 and
would have said so in under two seconds on any of those thirteen commits.

### The answer to the question as asked

- **0-dangling has not always held.** It was false in 9 of 47 measured states
  (19%).
- **It is not merely recent, either.** The current unbroken run of zeros is
  states 43–47, four days — but states 3–35 are also an unbroken run of 33
  zeros across five days.
- **Both episodes were repaired**, one by the corpus arriving and one by a lane
  correcting the sentence rather than inventing the item.
- **Only one of the two was ever detectable at the time.** `check-handover.ts`
  was created on 2026-09-06 (`bd249ecf`). Episode 1 is visible only in
  retrospect, by exactly the method used here.

**The reliability of the artefact is high and improving. The reliability of the
practice is the weaker half:** the instrument was correct on all thirteen of
those commits and was run on none of them.

---

## 3. EFFECTIVENESS — what could and could not be established

### The limit, stated before the numbers

The brief said the archive covers 2026-09-02 onward, so roughly 40 of the
blocks have no transcript. **Measured, the limit is worse than that and worse in
a way that changes the question.**

```sh
node scratchpad/archive-coverage.mjs
```

```
transcript dir: C:\Users\UserC\.claude\projects\D--Users-UserC-source-repos-my-context
session transcripts: 2   bytes = 98,758,852
  595db3b1-…  98,366,408 bytes · 41,162 records · 2026-09-02T23:17:40Z .. 2026-09-11T15:02:52Z
  bfba37a2-…     392,444 bytes ·     38 records · 2026-09-04T14:44:25Z .. 2026-09-04T14:45:50Z
subagent transcripts: 324   bytes = 827,547,751
```

**The session archive holds one substantial session.** Not forty sessions with
eighteen visible — ONE, running continuously from 2026-09-02 to now, plus a
38-record stub. So the proxy the brief proposed — *does the NEXT SESSION
re-derive what its handover told it* — **has no population.** There is no next
session in the archive. There never was one.

**Anything in this section that reads as a rate over sessions would be
manufactured. None is offered.**

### What IS in the archive, and it is the right unit anyway

The wall the handover exists to bridge is not the session boundary; it is the
**compaction** boundary, and those are recorded:

```sh
node scratchpad/compact-use.mjs      # counts type:"system", subtype:"compact_boundary"
```

```
compact boundaries: 8
  2026-09-03T13:24:21Z   2026-09-04T12:00:42Z   2026-09-05T10:43:41Z   2026-09-06T13:43:43Z
  2026-09-07T04:54:40Z   2026-09-08T14:16:34Z   2026-09-09T12:55:37Z   2026-09-11T00:44:01Z
records mentioning V2-HANDOVER: 279   (141 tool calls that read or name the file,
                                       118 on the user side, 12 assistant prose, 8 compact summaries)
```

**Result 1 — the handover is read, a lot, and every compact summary carries it.**
All 8 compact summaries mention the handover, and 141 tool calls in this
session open or grep it. Whatever else is true, the file is not write-only.

**Result 2 — the handover is rewritten about five times more often than the wall
it bridges is crossed.** 39 blocks were written inside the archived window
(44 today, 5 already present when the file entered git on 2026-09-03) against
**8 crossings**. Mapping each crossing to the block that was newest at that
moment:

```
crossing 1  2026-09-03T13:24Z  newest = block 43  (⏭ THE NEXT TASK, AGREED WITH THE OWNER BEFORE THIS COMPACTION)
crossing 2  2026-09-04T12:00Z  newest = block 38  (⏭ READ THIS FIRST — 2026-09-04)
crossing 3  2026-09-05T10:43Z  newest = block 36  (⏭ READ THIS FIRST — 2026-09-05)
crossing 4  2026-09-06T13:43Z  newest = block 36  (same block, second crossing)
crossing 5  2026-09-07T04:54Z  newest = block 23  (⏭ READ THIS FIRST — 2026-09-07, at 90%)
crossing 6  2026-09-08T14:16Z  newest = block 17  (⏭ 2026-09-07 evening, PAUSED ON HIS WORD)
crossing 7  2026-09-09T12:55Z  newest = block  9  (⏭ 2026-09-08, at 96%)
crossing 8  2026-09-11T00:44Z  newest = block  3  (⏭ 2026-09-09, at 96%)
```

**Seven distinct blocks of forty-four were ever the READ-THIS-FIRST block at an
actual compaction.** The other thirty-seven were superseded by a newer block
before any wall was reached.

**This is a measurement, not a verdict.** Those thirty-seven were still in the
file, still read (141 times), and still the record of what happened. What it
establishes is narrower and sharper: **the percent-threshold write schedule is
not calibrated to the event the mechanism exists for.** Writing at 86, 87, 88,
89, 90, 92, 93, 95 and 96 percent on 2026-09-07 produced eleven blocks that day
and one crossing.

**Result 3 — the file is opened quickly after most crossings, and that is weak
evidence.** Time from each boundary to the first tool call that opens the
handover: 1111, 159, 70, 7, 1, 19, 16, 540 minutes. **This does not mean much
and should not be quoted as if it did**, because the compact summary already
carries the handover into the new context — so *not* reading the file is not
evidence of not using it, and reading it early is as consistent with "writing
the next block" as with "following the last one".

### Result 4 — the one hard instance of delivered-and-not-used, and it is the `live/23` window

The `live/23` episode in §2 is the cleanest fact in this report about use.

- The instrument existed (`npm run check:handover`, since 2026-09-06).
- It was correct, and it fired within two seconds the moment it was eventually
  run.
- It was **not run on any of the thirteen commits it was red at**, across 1h51m.
- **Five handover blocks were written during that window**, by a context that
  held the false claim, and each one propagated it.

**That is delivery without use, measured, at the level of an instrument rather
than an item.** It is the same wall `budget/15` is being built to close, one
layer up, and it is the strongest single argument in this report for closing it.

---

## 4. IS THERE A SIGNAL THAT DISTINGUISHES *USED* FROM *MERELY DELIVERED*?

**Yes — one, weak, and it does not generalise to items in its current form.
Both halves of that sentence matter for D36.**

### The signal

**The handover's carry-list responds to the state of the work, and the response
has an OFF state.**

`builder/5` was named in 8 consecutive blocks up to 08:02 on 2026-09-07. It
landed at 13:26. **The next block written, at 20:06, does not name it** — nor
`builder/17`, which landed at 14:43. Meanwhile `port/99`, which did not land,
keeps being named across 8 blocks spanning a week, and `library/6` across 10.

So the handover's repetition is not a habit. It is a state variable that goes to
zero when the work is done, and it did so **without the corpus being updated** —
all four of those tasks still say `todo`. The writer knew; the corpus did not.

That is a real used-signal, and it is stronger than delivery because it has a
cause for its OFF state. It is what D36a's 0-of-158 lacks entirely: delivery has
no OFF state, so it discriminates nothing.

### Why it does not generalise to items as it stands

**The handover has this signal because its writer is also its reader.** One
mind repeats a pointer, and stops repeating it when the thing is done. The
repetition is a *reader's* behaviour recorded in a *writer's* artefact, which is
the only reason the signal exists at all.

Item injection has no such loop. The corpus does not decide what to repeat on
the strength of what a reader did with it — `SessionStart` injects the pinned
set unconditionally, every time, to everyone. There is nothing that can stop.
**A metric over unconditional delivery cannot have an OFF state**, which is
exactly D36e's fifth refusal restated: a delivery rate ranks items by which door
they came through.

### The generalisable form, stated exactly

The transferable shape is **not** "count deliveries". It is:

> *A delivered item is being USED if the reader's own subsequent output stops
> restating what the item says, once the item's content is satisfied.*

That needs two things this project does not have:

1. **A record that the item was fetched** — which is `budget/15`,
   `TASK-reading-an-item-is-not-audited-so-nobody-can-tell-whether-an`, one of
   the nine carried instructions in §1, owner-ruled, unblocked, costed, and
   being executed today. Its own closing sentence is the D36 question verbatim:
   *"of the items that arrived as index lines, how many were ever read."*
2. **A measure of restating** — and the archive now supports it. The FTS5
   index over 98 MB of transcript is the corpus of what the assistant actually
   said; `scripts/check-ask-numbering.ts` is the worked example of walking it
   for a behavioural pattern rather than a keyword.

**So the honest answer to D36 is: the signal exists, it is visible in the
handover, it is not available for items today, and the single item that would
make it available is `budget/15` — which has been carried in six handover
blocks waiting to be dispatched.** That coincidence is not decoration; it is the
measurement's own recommendation about which of the nine to finish.

---

## 5. IMPACT ON ONGOING DEVELOPMENT — not measurable, and no number is offered

Impact means: *how much worse would development have gone without the
handover?* That is a counterfactual over a single, continuous, un-replicated
process. There is one session, one corpus, one owner, and no control arm.

Everything that presents itself as a proxy fails on the same ground:

- **Velocity before and after the mechanism improved.** Confounded by
  everything else that changed on those days, and there is no "before" — the
  handover predates the archive.
- **Work landed per compaction.** There are 8 compactions. Eight points with no
  control, over a period in which the number of parallel lanes, the model, the
  corpus size and the gate set all changed.
- **Time-to-first-useful-action after a crossing.** Measurable (§3, Result 3)
  and uninterpretable: the compact summary carries the handover, so the two
  channels cannot be separated by anything in the archive.
- **"The handover prevented N defects."** Unfalsifiable. Every defect it
  prevented is by definition absent from the record.

**One thing that is NOT impact but is close to it, and is real:** the handover
*caused* at least one defect to be caught, because `live/23` was caught by a
gate that reads the handover, and it caused at least five blocks of propagation
of a false claim before that. Both directions are documented in §2. Netting them
into a number would be manufacturing.

**Stated plainly: the impact of the handover on ongoing development is not
honestly measurable with what exists, and this report does not estimate it.**
That is a finding about what can be known, not a failure to look.

---

## 6. What I refused to measure, and why

- **Any rate over "sessions".** There is one session in the archive (§3). A
  denominator of one is not a rate.
- **Any before/after on the handover's own improvements.** The improvements
  landed inside the same continuous session as the thing they improved.
- **Whether the 37 blocks that were never READ-THIS-FIRST were wasted.** They
  were read 141 times and they are the historical record. "Never the newest at a
  crossing" is what was measured and is all that was claimed.
- **A threshold, a rule, a gate or a schedule change.** None is proposed.
  `src/core/retire.ts` refuses to invent a rule without evidence; this is the
  evidence, and four days of one file is not enough to set a number on.
- **Whether `library/6`'s `HELD until D24, D25 and D26` clause is still live.**
  Not resolved; stated as unresolved rather than assumed either way.
- **The 2026-08-26 and 2026-08-27 blocks' pointers at the time they were
  written.** The file entered git on 2026-09-03 with five blocks already in it;
  there is no committed state of the corpus contemporaneous with them.

## 7. What this measurement did NOT change

No item was edited. No gate was added. No threshold was set.
`reports/V2-HANDOVER.md` was read, never written. No `.my_context/items/**.md`
was hand-edited. No git command that writes was run.

**Four corpus repairs are indicated and none was made, because closing another
lane's task on a measurement's say-so is the failure this project spent
2026-09-07 correcting.** They are, in the order a person should take them:

1. **Rule on `walk/119`'s contradiction** — `ABSENT IS ABSENT` in
   `app.js` against the item's *"drawn and named rather than blank"*. Until this
   is settled `walk/119` is dispatchable and would do damage.
2. **`builder/5`, `builder/6`, `builder/8`, `builder/17` are built, tested and
   green and should be closed.** Two of them are the top of
   `mycontext ready --plan builder` today.
3. **`walk/141`'s hold is satisfied** (`builder/11` is `done`); its body still
   says held.
4. **`budget/15`'s `scope:` names a file that holds no read command**, recorded
   in its own body on 2026-09-07 and never applied.

---

## The item

`MEAS-the-handover-measured-for-reliability-truth-and-use-and-the`, category
`measurement`, created through `mycontext add` with the findings in its body —
with `--body`, never `--file`, so it carries `source_file: null` and no pointer
that can drift away from this report.

**It carries no `state`, and that is the category's answer rather than an
omission.** A `measurement` is a record of what was found, not a piece of work
with a lifecycle; there is nothing to move to `done`. The finding is complete
and in the corpus, which is what `RULE-no-lane-without-an-item` asks for. The
four repairs it names are other lanes' tasks and are theirs to close.

## Files

- `reports/2026-09-11-the-handover-measured.md` — this report. **The only file
  added to the repository by this lane.**
- Scratchpad, not shipped, listed so every figure can be re-derived:
  `hist/` (47 extracted states + their JSON), `hist-summary.json`,
  `block-provenance.mjs`, `carry-detail.mjs`, `archive-coverage.mjs`,
  `compact-use.mjs`, `crossings.mjs`.

No test was added, so no removal proof is owed. The one test run was
`test/ui/builder.test.ts`, run with `--test-timeout=60000` as evidence that
`builder/5` and `builder/17` are green; it passed 24 of 24 and nothing was
spawned that outlived the run.
