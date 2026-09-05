# Write and run a procedure

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

A runbook is the steps for something you do every time it comes up. A
**procedure** is the steps for something you do **once** and then retire: a
migration, a cutover, a one-off backfill.

Both are normative, because both have to reach a session to be followed. What
makes a procedure different is that it is supposed to end — and the feature is
built around making sure it does.

## How it works

**Five states, and exactly one of them injects.**

| State | Meaning | Injection |
|---|---|---|
| `proposed` | written, not approved. An agent may author one here | not injected |
| `ready` | you approved it | index line only |
| `active` | you initiated it | in full, every session |
| `done` | completed | not injected |
| `abandoned` | you stopped it, and it is `superseded` rather than finished | not injected |

**Injecting only in `active` is the mechanism, not a request the model can
ignore.** A procedure held in full may be followed, so it is delivered only when
you set the state deliberately. The real risk this guards against is a procedure
left `active` forever, injecting long after the work ended.

**A `ready` procedure is not injected and not named in the index.** The model
does not learn it exists until you activate it. Nothing is lost: it is a draft,
and `mycontext procedure list` is where it is visible.

**Steps are a `## Steps` section in the Markdown**, parsed the same way
`## Observations` is. `"1 of 3"` is **counted, never stored** — there is no
second place for the number to disagree with the boxes.

**Ticking a box is a progress record, not an item edit.** `mycontext procedure
step` matches one checkbox by a strict pattern and writes *an audit record*; the
item file is not touched at all. That is a distinction rather than an exemption:
the draft gate stops an agent changing normative *content*, and a checkbox is
*progress*. Every flip is audited, so it stays visible.

**What is not relaxed is the state.** `active → done` stays yours. The last box
does not close the procedure — it lets the agent *ask*.

**Progress is per workspace, not per session.** Two terminals on the same
workspace share one record set.

## From the CLI

```bash
mycontext add procedure "Move prices to integer minor units" \
  --summary "The one-off migration that moves stored prices from a decimal column to an integer minor-units column." \
  --step "Add the integer column beside the decimal one" \
  --step "Backfill, and verify the two agree on every row" \
  --step "Switch reads to the integer column" --yes
```

```console
$ mycontext procedure list
active:
  PROC-move-prices-to-integer-minor-units · active · 0 of 3 · Move prices to integer minor units

note: progress is recorded per workspace, not per session — two terminals on this workspace share
      one record set.
```

The item itself carries the steps as an ordinary Markdown section:

```markdown
# Move prices to integer minor units

## Steps
- [ ] Add the integer column beside the decimal one
- [ ] Backfill, and verify the two agree on every row
- [ ] Switch reads to the integer column
```

Ticking one says exactly what it did, and what it did not:

```console
$ mycontext procedure step PROC-move-prices-to-integer-minor-units 1
my_context: step 1 ticked — 1 of 3. The item file is unchanged; this is one record in the audit log.
```

And finishing it is a decision, previewed as one:

```console
$ mycontext procedure done PROC-move-prices-to-integer-minor-units
about to finish:
  procedure   PROC-move-prices-to-integer-minor-units
  title       Move prices to integer minor units
  status      active -> deprecated
  progress    1 of 3

  after this it is no longer injected, and it is not deleted either: the file, its body and its
  steps all stay, and it is counted in the session banner's "N retired" rather than vanishing from
  every tally.
  the progress line above is what it is — this command checks nothing and concludes nothing. A
  procedure is finished when a human says it is.
```

Read the last note. It finished with one of three boxes ticked and said so; it
did not refuse, and it did not pretend the count meant anything.

```bash
mycontext procedure list                    # what is ready, running and finished
mycontext procedure show <id>               # one, whole
mycontext procedure activate <id>           # ready → active, and it starts injecting
mycontext procedure step <id> <n>           # tick one box
mycontext procedure done <id>               # finish it, and stop injecting it
```

**The slash command.** `/mycontext:procedure`.

**From an agent**, `read_procedure` reads one. An agent can author a procedure
as a `proposed` draft and can tick a box; it cannot activate or finish one.

**What the CLI can do here that the UI cannot.** Everything that changes a
procedure: activate, step and done. None of the `procedure` subcommands is in
the browser's command catalogue.

## From the UI

The **Procedures** screen (`nav.ch`) is three cards. The first is the five-state
table above, with the reason beside it. The second is **live** — one card per
procedure in this corpus, drawn from the real endpoint, with its stage and its
counted progress. The third is the "who may tick a box" prose.

`nav.ch` is *Change — composed, never run*, and this screen is exactly that:
nothing here writes, and the one line it composes goes to a clipboard.

Two things it is careful about:

- **The empty case is drawn and named.** A corpus with no procedure says *"No
  procedure in this corpus. The lifecycle above is what one would be; nothing
  has been written yet"* — an empty corpus and a screen that failed must not
  look identical.
- **The disclosures are the endpoint's own**, under a heading that says they are
  *true whether or not a card above says so*: progress is per workspace;
  progress records this build could not read are counted in neither direction; a
  tick written by hand into the Markdown is not a progress record, and the two
  can disagree; and if the `procedure` category is switched off in config, the
  empty list says *that* rather than "no procedures".

**What the UI can do here that the CLI cannot.** Show the lifecycle and this
corpus's procedures on one screen, so a procedure left `active` long after the
work ended is visible at a glance rather than found.

**What the UI cannot do here.** Activate, tick or finish anything. It composes
the line and stops.
