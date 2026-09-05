# Open and use the web UI

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

Some questions do not fit in a terminal. "Which parts of this repository does my
corpus actually cover?" is a map. "What would a smaller pinned budget stop
delivering?" is a slider. "Why did that item arrive and this one not?" is three
answers side by side.

The web UI is the surface for those. It is not a second product: every fact it
draws is read from the same corpus the CLI reads, and every screen names the
endpoint behind it.

## How it works

`mycontext ui` starts an HTTP server that **binds `127.0.0.1` only** and refuses
to start on any other host. It exits on its own after eight hours with no `/api`
request other than a stream, so a forgotten background tab does not hold it up;
`--idle-ms` moves that window, up to a ceiling of 24 hours.

The port is the ephemeral one the operating system hands out, unless `ui.port`
in `.my_context/config.json` or `--port` names one.

**Nineteen screens, in four rail groups**, and the group names are the product's
own claims about what each screen is for:

- **Injection — what arrives**: Injection preview, Scope coverage, Budget
  simulator, Injected now.
- **Evidence — why it did or didn't**: Audit stream, Ask, Doctor, Decay,
  Relations, Status.
- **Change — composed, never run**: Review queue, Capture, Composer, Configure,
  Procedures, Export / import, Template packs.
- **Read**: Library, Learn.

**"Composed, never run" is the rule, and the confirm is the exception to it.**
Most write-shaped screens end at a line of shell you copy. Where the UI does run
a command, it runs one of 27 catalogue entries — 19 writes and 8 reads — and it
does so through a mechanism built around one property: *the string a person read
in the confirm dialog and the argv that runs are the same thing*. The browser
sends a catalogue id and a bag of values, never a command; the server rebuilds
the argv from the same file the browser composed from; a nonce binds the run to
the argv the server built; and every execution is written to the audit log
before it starts and again when it ends. Sixteen of the 27 sit on the trust
boundary and get the field-by-field confirm rather than the light one.

## From the CLI

```bash
mycontext ui                     # start it and open a browser
mycontext ui --no-open           # start it and print the URL
mycontext ui --port 4321         # a fixed port
mycontext ui --idle-ms 600000    # exit after ten idle minutes
mycontext ui --nonce             # ask a server that is ALREADY running for a credential
```

`--nonce` is the one worth explaining. It does not start anything: it asks a
running server to mint a one-shot, loopback-only credential and opens the
browser at `http://127.0.0.1:<port>/#<nonce>`. With `--no-open` it prints a
longer-lived link instead. Every mint is audited.

When there is no record of a running server, the command says exactly that —
that there is no record, and that a server may well be listening anyway — rather
than claiming none is running. "No record" is not a measurement, and this
command does not report it as one.

**The slash command.** `/mycontext:ui` starts the UI from inside a session.

**What the CLI can do here that the UI cannot.** Start, stop and address the
server; choose the port and the idle window; and everything else in this
product, since the browser's write surface is 27 catalogue entries and the CLI
has 43 verbs.

## From the UI

Once it is open, the UI itself is what the other 23 tutorials are about — each
one names the screen its feature is reached through.

Two conveniences belong to the UI as a whole rather than to any one screen:

- **It is bilingual.** Every screen's strings come from a table, in English and
  Hebrew, and the two are held equal by a parity test rather than by discipline.
- **It never falls back.** Where a translation or a document does not exist, the
  screen says so as a measured state; it does not quietly serve you the English
  one under a Hebrew label.

**What the UI can do here that the CLI cannot.** Draw. The coverage tree, the
relations ego-graph, the budget staircase and the decay heatstrip are not
terminal answers rendered in a browser — they are answers a terminal cannot give
at all.

**What the UI cannot do here.** Reach anything outside this machine (it binds
loopback and refuses any other host); run a command that is not one of its 27
catalogue entries; or run any of them without a confirm you read first.
