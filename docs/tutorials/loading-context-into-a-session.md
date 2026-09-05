# Load this project's context at the start of a session

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

Capturing knowledge is only half the tool. The other half is the part you never
type: the corpus reaching a session, at the moment it is relevant, without
anybody remembering to paste it.

This tutorial is about that arrival — what a new session opens with, what turns
up later when a file is touched, and how to ask for it on purpose when the
automatic path has not fired.

## How it works

**A session start sends a short index, not the corpus.**

```markdown
_2 governing item(s) below carry a title only — the body was not delivered: CONST-card-numbers-never-reach-the-logs, RULE-every-price-is-an-integer-of-minor-units. A title names a rule; it does not tell you what it requires. Read each with `mycontext show <id>` before treating it as satisfied. Delivering every one of them in full this session would cost ~71 estimated tokens._

## my_context index
- CONST-card-numbers-never-reach-the-logs · constraint · Card numbers never reach the logs
- RULE-every-price-is-an-integer-of-minor-units · rule · Every price is an integer of minor units

2 lesson · 1 reference · 1 todo
→ use mycontext list or mycontext show <id> to browse these
```

Ids and titles for the normative items — enough for the model to know they exist
and fetch one — and the whole rationale tier reduced to a bare count, one count
per category. The italic line above the index is the disclosure: the index is a
name, not the rule, and it says so rather than letting a title be mistaken for
the item.

**Then the corpus arrives as you work.** Ask Claude to read
`src/billing/charge.ts`, and before the read runs this reaches its context:

```markdown
## my_context — these govern this project

### CONST-card-numbers-never-reach-the-logs · constraint · Card numbers never reach the logs

Log the last four digits and the processor's reference.

_scope: src/billing/**_

### RULE-every-price-is-an-integer-of-minor-units · rule · Every price is an integer of minor units
```

Three separate things just happened, and they are worth telling apart:

1. The constraint arrived because the file matched `src/billing/**`.
2. The rule arrived too, because it has **no scope**, and no scope means it
   applies everywhere.
3. The lessons, the reference and the todo **did not arrive**. They are
   rationale. Rationale is never injected — it is there for you to search, and
   for Claude to look up deliberately.

Read `README.md` in the same session and nothing arrives, for two reasons worth
telling apart. The constraint does not match that path. The rule *does* match —
but it was already delivered, and my_context does not repeat itself within a
session. It tracks what each session has seen.

**All of that is done by hooks.** The plugin registers eighteen hook events
today; the hook table in `README.md` §5 ("Using it") is re-derived from
`hooks/hooks.json` on every test run and is the one to trust for what fires
each.

## From the CLI

There is no `mycontext load` verb, and that absence is the design: injection is
a hook's job, not a command's. What the terminal gives you is the deliberate
form of the same thing.

**The slash command is the surface.** `/mycontext:LoadMyContext` loads this
project's knowledge into the session you are in, right now. Reach for it when a
session started before the plugin did, when a subagent needs the corpus its
parent already has, or after a long detour when you want the governing items in
view again.

To pin one item into *every* session start, in full:

```bash
mycontext pin CONST-card-numbers-never-reach-the-logs --yes
mycontext unpin CONST-card-numbers-never-reach-the-logs --yes
```

Use pinning sparingly. A pinned item costs tokens in every session forever.
Scope is the cheaper tool: it delivers the item exactly when it is relevant.

For a one-shot instead of a permanent pin, `mycontext carry <id>` marks one item
for the next injection and then forgets it:

```console
about to mark CONST-card-numbers-never-reach-the-logs ("Card numbers never reach the logs") for
  delivery at the next injection, regardless of its own budget. It is a front-of-queue index line —
  the same disclosure a cross-session carry already gets — not the full item text, and not a change
  to what governs it. The mark is spent by that one injection, whether or not the line is admitted,
  and is not renewed.
```

**From an agent**, `load_context` answers what would be injected now, and
`focus_context` narrows it.

**What the CLI can do here that the UI cannot.** Everything on this page that
changes what arrives: `pin`, `unpin` and `carry` are terminal acts. The browser
composes `pin` and `unpin` in the Composer catalogue and runs them behind a
confirm; `carry` is not in the catalogue at all.

## From the UI

The UI does not inject anything — it has no session to inject into. What it does
is show you the same selection from the outside, on three screens under
`nav.inj` — *Injection — what arrives*:

- **Injection preview** — pick a file, see what would arrive on touching it, and
  what spilled.
- **Injected now** — what a real session has actually been given, read from that
  session's own seen-file rather than from a replayed projection.
- **Scope coverage** — every walked path, coloured by what governs it.

Each has its own tutorial. Together they are the answer to "why did that item
arrive, and why did that one not?"

**What the UI can do here that the CLI cannot.** Show the selection for a file
you have not touched, and for a session you are not in, side by side with the
rendered text that would have been delivered.

**What the UI cannot do here.** Load context into a session. There is no session
on the other side of a browser tab; the only surfaces that inject are the hooks
and `/mycontext:LoadMyContext`.
