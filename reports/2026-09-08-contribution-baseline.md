# The contribution baseline — 2026-09-08

**What this is.** The first measurement of how often each item in this corpus has
actually been **delivered** into a session, split by who authored the item. It was
taken with `mycontext contribution`, a pure reader over `.my_context/.audit/`
added by `plan:loop seq:1`
(`TASK-measure-which-items-are-actually-delivered-before-anything`).

**What it is FOR, and why it had to be taken now.** Library drift — accumulated
knowledge pushing a session *below* the no-knowledge baseline — is silent by
construction and only ever detectable as a **change**. No self-improvement
capture exists in this product yet: nothing proposes an item, nothing promotes
one, and every `origin: 'agent'` item in the corpus today was written through a
hand-driven MCP call. So these numbers are the **control**. A measurement taken
after the first automatic promotion would have nothing to be compared against,
and could only be believed.

**The instrument was already recording.** `recordAudit` has always written one
`kind: 'injection'` record per delivery carrying `injected: InjectedRef[]` and
`spilled: SpilledRef[]`, so this needed no new write path, no change to any hook,
and it answers for history that already happened.

---

## How it was taken

```
node src/cli/index.ts contribution
node src/cli/index.ts contribution --json
```

Snapshot taken **2026-09-08T12:13:06Z** (the `measuredAt` field of the JSON
document). The log is live — it grew by 84 records and 9 injections while this
report was being written, because the machine was running other work — so every
figure below is one reading of a moving log, not a constant. That is what a
baseline is; the point is that the reading is dated and written down.

| | |
|---|---|
| Corpus size | **1,021 items** |
| Audit records, all kinds | **29,123** |
| Of those, `kind: 'injection'` | **2,140** |
| Distinct ids the log names (injected or spilled) | **179** |
| Earliest injection record | 2026-08-17T13:42:09Z |
| Latest injection record | 2026-09-08T11:59:13Z |
| Window the log covers | **22 days** |

---

## The cohort table, as the command prints it

```
  ┌────────┬───────┬─────────────────┬────────────────┬──────────────────┐
  │ origin │ items │ never delivered │ always spilled │ median delivered │
  ├────────┼───────┼─────────────────┼────────────────┼──────────────────┤
  │ agent  │ 38    │ 32              │ 0              │ 0                │
  │ human  │ 983   │ 810             │ 0              │ 0                │
  │ ingest │ 0     │ 0               │ 0              │ 0                │
  └────────┴───────┴─────────────────┴────────────────┴──────────────────┘
```

**Read the next section before quoting any number in that table.** Taken at face
value it says 82% of this corpus has never been delivered, and that is a true
count of a question nobody should ask on its own.

---

## The correction that makes the table mean something

**830 of the 842 never-delivered items are ineligible by construction, not
unused.** `isNormative` (`src/core/select.ts`) admits only items whose category
sits in the **normative** tier; a `task`, `decision`, `lesson`, `note` or `adr`
is never a candidate for injection at all, and `explainIneligible` says so in
those words — *"not a normative category"*. This workspace's `config.json`
promotes `reference` to normative, so its five `REF-` items are candidates and
the other rationale categories are not.

Split on that line, the same measurement reads:

| tier | items | delivered ≥ once | never delivered |
|---|---|---|---|
| **normative** (eligible for injection) | 191 | 179 | **12** (6.3%) |
| **rationale** (never a candidate) | 830 | 0 | 830 (100%, by construction) |

Never-delivered, by category — `(N)` normative, `(R)` rationale:

```
task(R)        669/669     rule(N)            1/55
decision(R)     94/94      known_issue(N)     2/32
lesson(R)       40/40      requirement(N)     1/31
note(R)         24/24      open_question(N)   7/27
adr(R)           3/3       standard(N)        0/14
                           instruction(N)     0/11
                           constraint(N)      1/7
                           invariant(N)       0/6
                           reference(N)       0/5
                           non_goal(N)        0/3
```

**The twelve normative items the log has never delivered**, listed because a
count with no names is not checkable:

`CONST-live-pass-probe-of-the-agent-normative-trust-boundary` ·
`KNOWN-the-injected-endpoint-collapses-a-missing-seen-file-into-a` ·
`KNOWN-the-session-names-lock-lost-three-of-six-concurrent-writers` ·
`OPENQ-does-sessionstart-injection-actually-work` ·
`OPENQ-how-do-filters-respect-dependencies` ·
`OPENQ-how-does-the-ui-reach-a-model-and-what-leaves-the-machine` ·
`OPENQ-should-the-jit-tier-rank-a-path-scoped-item-above-one-that` ·
`OPENQ-where-may-foreign-store-look-given-it-reads-outside-the` ·
`OPENQ-which-mcp-revision-does-claude-code-speak` ·
`OPENQ-which-screen-hosts-the-markdown-viewer-and-what-may-the` ·
`REQ-items-carry-a-domain` ·
`RULE-master-is-the-resting-state-work-on-branches-always-return`

---

## The comparison, which is the actual measurement

§15 asks whether items promoted through a self-improvement path are delivered
differently from human-authored ones. Restricted to the eligible set, that is:

| origin | normative items | delivered ≥ once | never | median deliveries *among those delivered* | total deliveries | total spills |
|---|---|---|---|---|---|---|
| **human** | 183 | 173 | 10 | 543 | 86,981 | 23,309 |
| **agent** | 8 | 6 | 2 | 631 | 3,393 | 1,993 |

**n = 8 for the agent cohort. Nothing may be concluded from that comparison
today, and saying so is the finding.** All eight were captured by a person
driving an MCP tool; none came from an automatic loop, because there is no loop.
That is precisely what makes this reading a control rather than a result: the
experiment's treatment has not been applied yet.

The one thing the table does support is that being agent-authored has not so far
kept an item out of the tiers — the six agent items that are delivered are
delivered at a *higher* median than the human median (631 vs 543).

---

## Two findings the command surfaced that were not asked for

**1. `always spilled` is zero everywhere, and the reason is sharper than the
column.** 25,302 spill events are recorded across 150 items, and **not one item
in this corpus was ever spilled without also being delivered at least once**. So
"chosen and then cut for budget, every single time" describes nothing here. The
842 never-delivered items were never *candidates* — they were not squeezed out by
the budget, they were never in the running. The failure mode this column was
written to catch does not currently exist, and that is worth knowing before §9's
retirement thresholds are derived from anything.

**2. The delivery distribution is extremely flat at the top.** The nine
most-delivered items sit between 799 and 818 deliveries over 2,140 injection
records — roughly 38% of all injections each — and the median among delivered
items is 543. This corpus is not being sampled; a large, near-constant block of
it is being handed over on almost every injection. Whether that is the pinned
tier working as designed or the pinned tier being over-subscribed is not a
question this measurement answers, and it is not one to answer by guessing.

---

## The honest caveat, from §15, recorded so nobody overstates any of this

**The research behind the idea this measures is contested.** Effects flip by
model (+2.72pp on one, −3.70pp on another); results depend on task order to the
point where prior work's orderings *"impose an implicit curriculum"*; and
repository context files showed **no general improvement at +20% inference cost**
in the strongest-provenance study found (arXiv:2602.11988). **Nobody has measured
a durable-lesson loop in a real long-running coding workflow.** This build is
therefore an experiment, and this file is what makes it one rather than an act of
faith.

**And the two limits the command prints on every run, which apply to every number
above:**

1. **The log records INJECTION, never reading or reliance.** An item opened as
   Markdown, fetched with `show`, or read through MCP `get_item` leaves no record
   here and is indistinguishable from one nobody has ever touched. Every
   "delivered" figure is a floor on use, and every "never delivered" figure is
   not evidence of disuse.
2. **The counts are not normalised for age.** The log covers 22 days. An item
   created last week has had fewer chances to be delivered than one created on
   day one, and nothing here corrects for that.

**Nothing in this file is a reason to retire, supersede or edit any item.** It is
a reading to be compared against a later one.

---

## How to take the next reading

```
node src/cli/index.ts contribution              # the report
node src/cli/index.ts contribution --full       # every item, with first and last delivery
node src/cli/index.ts contribution --json       # the machine form, per item, with `type`
```

The `--json` document carries `measuredAt`, `corpusItems`, `auditRecords`,
`injectionRecords`, `idsSeenInLog`, the cohort rows, and one row per item with
its `type` and `origin` — which is what makes the normative/rationale correction
above reproducible rather than a claim in prose.

**Compare a later reading against this one on the normative-tier rows.** The
whole-corpus percentage moves whenever somebody files a task, and a number that
moves for a reason unrelated to the thing being measured is the number a drift
report must not be built on.
