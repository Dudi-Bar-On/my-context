# Categories

Every my_context item has a type. The type decides two things: whether the item
can be injected into a future session, and the prefix of its id.

- **Normative** types govern future work. With `always: true` they are injected
  in full at every session start. Otherwise they are injected when a file they
  apply to is touched: the files matching their `scope`, or every file if they
  declare none — see `help("scope")`.
- **Rationale** types explain past reasoning. They are never injected. They
  appear in the session index as counts and are retrieved with `query_items`.

Because a rationale item is never injected, `always` and `severity` do nothing
on one — the pinned tier admits only normative items, and nothing outside that
tier gates on severity. Setting either on a rationale item is therefore
**refused** rather than stored and ignored, on every write surface. Two things
work instead: change the category's tier (`categories.<name>.tier` in
`.my_context/config.json`), or capture the fact in a normative category.
`scope` is not refused there — it is inert for injection on the rationale tier,
but `query_items({path})` reads it on every item, which is how "what was
decided about this file?" is answered.

Only the types below are accepted in this project. Anything else is refused.

{{CATEGORY_TABLE}}

## What each type is for, and its nearest neighbour

One entry per type: what it is for, and the single type it is most often
confused with, with the test that separates the two. The neighbour relation is
not symmetric — `rule` names `standard` while `standard` names `pattern` — so
the type you are looking for may also be discussed in an entry other than its
own.

The table above is what *this project* accepts; the entries below describe the
catalogue's own types. A project that has turned one off, or declared a
category of its own, will find rows in the table with no entry here, and
entries here with no row in the table.

Run `mycontext examples <type> --short` for a worked specimen of any of them.

### `constraint`

A limit you did not choose and cannot trade away: a platform, a budget, a
regulation, a contractual SLA. If someone could argue you out of it with a good
enough reason, it is a `standard` and not a constraint.

**Nearest neighbour: `non_goal`.** A constraint limits *how* something is built
("must run on Node 24 with no dependencies"); a non_goal excludes the thing
itself ("we are not building offline sync").

### `environment`

How the environments differ — what production does that local does not, and
where staging tells you something that is not true of either. It exists because
an agent that reasons correctly from the code still gets the answer wrong when
it assumes the environment it is running in is the one the code will run in.

**Nearest neighbour: `constraint`.** A constraint is a limit on what you may do
and holds everywhere ("no runtime dependencies"); an environment item is
conditional on *where the code runs*, and its content is a difference rather
than a limit ("local mocks the payment API, staging calls it in test mode,
production calls it live"). If removing the words "in production" or "locally"
leaves the sentence still true, it is a constraint.

### `glossary`

The agreed word for a thing, and the words not to use for it. One item per
term, so the corpus can answer "what do we call this?" rather than leaving each
session to invent its own vocabulary.

**Nearest neighbour: `rule`.** Both can be phrased as a prohibition, and the
phrasing is not the test: a glossary item is about what a thing is *called*, a
rule about what is *done*. "Never say account, say tenant" is a glossary entry
even though it starts with "never".

### `instruction`

How the agent should work: which checks to run, what to do before claiming
something is finished, when to stop and ask. It governs the process, not the
artifact — and because a process directive does not depend on a path, it is the
type most often worth pinning with `mycontext pin`. Nothing pins it for you:
an instruction is created with `always: false` like every other item.

**Nearest neighbour: `rule`.** An instruction governs how the agent works ("run
the test suite before claiming a change is complete"); a rule governs what it
produces. Ask whether the sentence would still make sense to a human
contributor with no agent involved: if it would, it is a rule.

### `invariant`

A condition about the running system that must hold at every moment, phrased so
that a test or an assertion could in principle check it. It is the type to
reach for when a violation is a bug rather than a lapse in style.

**Nearest neighbour: `rule`.** An invariant is a property of the system ("an
order total equals the sum of its line items"); a rule is an instruction to
whoever writes the code ("never log request bodies on auth endpoints").

### `non_goal`

Something the project has decided not to build, recorded so that nobody builds
it helpfully. It earns its place when the omission looks like an oversight —
which is exactly when an agent fills it in.

**Nearest neighbour: `constraint`.** A non_goal excludes the thing itself ("we
are not building offline sync"); a constraint limits how the things you *are*
building may be built.

### `open_question`

A question the project has deliberately left open, recorded so the next session
does not quietly answer it. It carries `blocks`, naming what is waiting on the
answer.

**Nearest neighbour: `assumption`.** An open question is undecided and must not
be decided alone; an assumption is a premise someone has *already* acted on
that nobody has verified.

### `pattern`

A shape to reach for when a particular problem comes up, or one to avoid. It is
conditional by nature — it applies when the situation arises, not to every line
of code.

**Nearest neighbour: `standard`.** A standard says what the code should look
like everywhere ("every exported function carries a doc comment"); a pattern is
what to do when a specific problem appears ("repository objects wrap every
query; handlers never open a connection").

### `requirement`

Something the system must do, in the user's terms rather than the
implementation's. It carries `kind`, which is where functional and
non-functional live — they are one type with a field, not two types.

**Nearest neighbour: `constraint`.** A requirement is what must be built ("users
can reset their own password"); a constraint limits how anything may be built
("on Node 24 with no dependencies").

### `rule`

A do or a don't, addressed to whoever is writing the code. It carries
`directive: do | dont`, so a rule states plainly which of the two it is instead
of leaving that to the grammar of the title.

**Nearest neighbour: `standard`.** A rule is a directive with a consequence
behind it ("never log request bodies on auth endpoints"); a standard is a
convention about form, and breaking one is untidy rather than dangerous.

### `runbook`

The steps for one named operation, in the order they have to be taken, and what
goes wrong if the order is not kept. It is the type to reach for when the
sequence is the knowledge — when doing the same three things in a different
order produces a different outcome.

**Nearest neighbour: `instruction`.** An instruction is a *standing* directive:
always do this, on every task. A runbook is *conditional and procedural*: it
applies only when a particular operation is being performed, and it is worth an
item because agents improvise procedures badly and confidently. "Run the test
suite before claiming a change is complete" is an instruction; "to rotate the
webhook secret, deploy the new secret first, then roll it upstream" is a
runbook.

### `standard`

A convention that shapes how the code looks and reads, applied everywhere
rather than case by case. A good enough reason can revise a standard, which is
what separates it from a constraint.

**Nearest neighbour: `pattern`.** A standard holds everywhere ("every exported
function carries a doc comment"); a pattern is the shape to reach for when a
particular problem comes up.

### `adr`

A decision record in the MADR shape: context and drivers, the options
considered, the outcome, and the consequences that follow from it. Reach for it
when the *rejected* options are as worth keeping as the chosen one.

**Nearest neighbour: `decision`.** If you would not write a "considered
options" section, what you have is a `decision` — one sentence plus its reason.

### `assumption`

Something the project is already relying on as true without having checked it.
It carries `validate_by`, the day you mean to check it by, and `validated_on`
for when you did — both are dates for a reader, and nothing in my_context sends
a reminder about either.

**Nearest neighbour: `risk`.** An assumption is being relied on now; a risk has
not happened and may never. The one is verified, the other watched.

### `decision`

What was chosen, and the one-line reason it was chosen over the obvious
alternative. It is the lightweight half of the pair with `adr` and is what most
decisions should be.

**Nearest neighbour: `tradeoff`.** A decision records what was chosen; a
tradeoff records what that choice cost, and earns its own item when the cost is
what a future reader will be tempted to undo.

### `edge_case`

A boundary the system has to survive — an empty cart, a stale tab, a zero-length
file — captured with the reasoning, so the thinking behind an odd-looking branch
is not lost.

**Nearest neighbour: `requirement`.** An edge case is rationale: it explains the
boundary. Once it is agreed *how* the system must behave there, that agreement
is a `requirement` or an `invariant`, and the edge case is the reasoning behind
it.

### `known_issue`

Something that is broken, flaky or a dead end *right now*, recorded so nobody
spends a session rediscovering it. It is a present fact about the state of the
system, not a conclusion drawn from one — the sentence is "this does not work
and here is what we already tried", and its job is to stop effort rather than
to steer it.

**Nearest neighbour: `lesson`.** A lesson is retrospective and general — what an
incident taught, phrased so it outlives the incident. A known issue is neither:
it is true today and will be false the day the breakage is fixed. `risk` is the
third of the family and the other direction in time — a risk has not happened
and may never, while a known issue has happened and is still happening.

**A known issue goes wrong by getting fixed**, and a stale one is worse than
none: it stops an agent working on something that now works. Nothing here
expires it for you. `valid_until` is not the field for it — it is a lifecycle
record of the day an item stopped being current, stamped when an item is
retired and cleared when it is un-retired, and no capture or edit surface
accepts one on an active item. The route is `status`: retire the item with
`mycontext edit <id> --status deprecated` when the breakage is fixed, or
`supersede` it onto whatever replaced it. Two things make that likelier to
happen — name in the body the condition that would make the item false ("this
is fixed when upstream closes X"), and cite the issue where the fix will land.

It is a **normative** type, and that is a deliberate exception to the grammar
the two tiers otherwise follow: "the sandbox declines test cards at random" is
a present fact, not a directive. It is normative because of what the tier
*does*. Rationale items are never injected in full and are not even named in
the session index — the whole tier arrives as counts — so a known issue filed
there reached a session as the digit in `1 known_issue` and nothing else, and a
category whose one job is to stop an agent chasing something already broken
cannot do that job from a place the agent never reads.

The price is the one every normative type pays: **a known issue an agent
captures lands as a `draft`** and governs nothing until a human promotes it
(`mycontext review`). That is the right trade for an item that will be injected
into future sessions — but it does mean the fastest way to record a live
breakage is a human capture, `mycontext add known_issue "…" --yes`, which lands
active. A project that would rather have them land active from an agent can set
`categories.known_issue.tier` to `rationale`, and gets back the invisibility
described above.

### `lesson`

What actually happened, and what it cost. It is what `mycontext lesson` builds
its rule-derivation request from, so it is worth capturing while the incident is
fresh and before anyone knows what the rule should say.

**Nearest neighbour: `rule`.** A lesson is what happened; a rule is what must
now hold. Capture the lesson — a human promotes it, or accepts a candidate
derived from it.

### `risk`

Something that has not happened, would harm if it did, and is worth watching. It
carries `likelihood` and `impact`, which is what makes a list of risks sortable
rather than a list of worries.

**Nearest neighbour: `assumption`.** A risk may happen; an assumption is already
being relied on as true. A risk is watched; an assumption is checked.

### `tradeoff`

What a choice cost — the thing given up, and what was bought with it. It exists
so that the cost is on the record beside the benefit, where someone tempted to
undo the choice will find it.

**Nearest neighbour: `decision`.** The decision is the choice; the tradeoff is
its price. Write both when the price is the part a future reader will forget.

## When you are unsure

Capture it as the closest type rather than not capturing it. `update_item`
cannot re-file an item under a different type — `type` is fixed at creation
and decides where the file lives. A misfiled item is recovered by
`create_item`-ing a correctly-typed replacement and `supersede_item`-ing the
original onto it, or by a human editing the Markdown directly. An uncaptured
constraint is lost either way, which is the greater risk.
