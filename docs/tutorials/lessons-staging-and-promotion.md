# Turn an incident into a lesson, staged before it governs

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

Something went wrong, you understood why, and the understanding is worth
keeping. But *"the 3DS sandbox declines valid cards at random"* is a description,
and what you actually want in every future session is a **rule**: something a
person who was not there can act on.

This feature is the path between the two, with a deliberate stop in the middle.

## How it works

**A lesson is rationale.** It is recorded, indexed and searchable, and it is
never injected. Writing one costs a session nothing.

**Deriving rules from it is a request, not a computation.** my_context has no
model of its own; `mycontext lesson` prints a rule-derivation request — the
lesson, its observations, a JSON schema and the rules for a good candidate — and
whoever is reading (you, or the agent in the session) produces the candidates.

**Nothing returned is applied.** Every candidate is *staged*, pending explicit
human approval, "because a subtly wrong invariant would be injected into every
future session indefinitely."

**A rule candidate has exactly five fields** — `title`, `directive`, `body`,
`scope`, `severity` — and anything else is rejected by name rather than dropped.

**Accepting one creates a real rule, linked back.** The new item carries
`derived_from` the lesson, so the provenance survives.

**The slash command deliberately stops short.** `/mycontext:lesson-stage` prints
the accept and discard commands and does not run either. A slash command that
ran `lesson-accept` would be the model settling a rule on your behalf, which is
the act this flow exists to preserve.

## From the CLI

Record the lesson, and get the derivation request:

```console
$ mycontext lesson "The 3DS sandbox declines valid cards at random"
my_context: lesson LESSON-the-3ds-sandbox-declines-valid-cards-at-random recorded as origin: human (rationale tier — indexed, never injected).

my_context RULE DERIVATION REQUEST — LESSON-the-3ds-sandbox-declines-valid-cards-at-random

- You are deriving rules. my_context has no model of its own — it stages what you return and waits for a human.
- A lesson is descriptive ("this is what happened"); a rule is normative ("this is what must happen from now on"). Convert, do not restate.
- Emit a JSON array of rule candidates matching the schema. Two or three is usually right; return [] if the lesson supports no general rule.
- Each rule must be actionable by someone who was not present for the incident. Drop the dates, names and ticket numbers.
- Do not invent scope. Scope RESTRICTS where a rule applies, so omitting it leaves the rule applying everywhere — which is the right answer for a rule that is not about particular directories, and the honest answer when you cannot name them. A human can narrow it during review.
- NOTHING you return is applied. Every candidate is staged pending explicit human approval, because a subtly wrong invariant would be injected into every future session indefinitely.
- Call back with: mycontext lesson-stage LESSON-the-3ds-sandbox-declines-valid-cards-at-random --stdin
```

Hand candidates back on stdin. A candidate with a field the schema does not
declare is rejected, and the rejection names the field and the whole legal set:

```console
$ echo '[{"title":"…","summary":"…","body":"…","directive":"dont"}]' | mycontext lesson-stage LESSON-… --stdin
my_context: 0 rule candidate(s) staged for LESSON-the-3ds-sandbox-declines-valid-cards-at-random. None of them exists as an item yet.

1 candidate rejected:
  [0] A retry must not create a second authorisation: unknown field(s) "summary". A rule candidate has exactly these fields: title, directive, body, scope, severity.
```

A well-formed one stages, and gets a key:

```console
my_context: 1 rule candidate(s) staged for LESSON-the-3ds-sandbox-declines-valid-cards-at-random. None of them exists as an item yet.
  ┌──────────┬───────────┬────────────────────────────────────────────────┐
  │ key      │ directive │ title                                          │
  ├──────────┼───────────┼────────────────────────────────────────────────┤
  │ a6e20d13 │ dont      │ A retry must not create a second authorisation │
  └──────────┴───────────┴────────────────────────────────────────────────┘

Accept with:  mycontext lesson-accept LESSON-the-3ds-sandbox-declines-valid-cards-at-random <key> [--title "…"] [--scope "a/**,b/**"]
Discard with: mycontext lesson-discard LESSON-the-3ds-sandbox-declines-valid-cards-at-random <key>
```

Accepting prints the rule for review and then creates it:

```console
$ mycontext lesson-accept LESSON-the-3ds-sandbox-declines-valid-cards-at-random a6e20d13
my_context: about to create this rule — review before it becomes active:
  title:     A retry must not create a second authorisation
  directive: dont
  severity:  hard
  scope:     src/billing/**
  body:      Reuse the original authorisation reference on retry rather than opening a new one.

my_context: created RULE-a-retry-must-not-create-a-second-authorisation (active) with derived_from [[LESSON-the-3ds-sandbox-declines-valid-cards-at-random]].
```

`--title`, `--scope`, `--severity` and `--directive` on `lesson-accept` let you
narrow a candidate as you accept it. `mycontext lesson-discard <lesson> <key>`
rejects one permanently.

**The slash commands.** `/mycontext:lesson` records one; `/mycontext:lesson-stage`
stages candidates and stops.

**From an agent**, `create_lesson` records the lesson and `stage_rule_candidates`
stages what it derived. There is deliberately no accept tool.

**What the CLI can do here that the UI cannot.** The whole flow.
`lesson` and `lesson-stage` are not in the browser's command catalogue, and no
screen draws a staged candidate.

## From the UI

**There is no lesson screen.** Two of the four verbs are reachable —
`lesson-accept` and `lesson-discard` are in the **Composer**'s catalogue, both on
the trust boundary — but you would need the lesson id and the candidate key from
a terminal first, because nothing on screen lists them.

What the browser does show is the result: the rule an accepted candidate created
appears on the **Relations** screen with its `derived_from` edge back to the
lesson, and in **Ask** and **Status** like any other item.

**What the UI can do here that the CLI cannot.** Draw the provenance. The
`derived_from` edge from a rule back to the incident that produced it is a line
on the ego-graph, and that is the fastest way to answer "why does this rule
exist?"

**What the UI cannot do here.** Record a lesson, request candidates, stage them,
or list what is staged. Staged candidates do not travel with an export either —
they are proposals in a workspace, not knowledge about a domain.
