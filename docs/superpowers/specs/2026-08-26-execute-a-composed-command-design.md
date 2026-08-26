# Executing a composed command from the web UI — design

**Status:** APPROVED 2026-08-26. §4's three questions are answered in §6.
**Owner ruling that asked for it:** 2026-08-26 — *"from the beginning i wanted to
execute and not to copy but i compromised because the security risks where not
mitigated yet … i definitly want to go back to my initial request."*

---

## 1. What this reverses, stated first

Three things say no today, and all three were deliberate:

- **`DEC-should-the-web-ui-be-allowed-to-write-config-json`** ruled *"the
  Configure wizard composes and the user pastes"*, and named what would have to
  be decided rather than assumed — **who is authorised, given that the loopback
  gate authenticates a BROWSER and not a person.**
- **`test/ui/no-writes.test.ts`** holds the whole `src/ui/` import graph to
  read-only: the surface has exactly two ruled-in writes, both outside any
  request path.
- **`test/ui/palette-lib.test.ts`** asserts the composing modules *"bind nothing
  that can run, send or navigate"*, and the mockup's own help text says **"Run it
  in your own shell. This tool never writes."**

This design does not pretend those were wrong. It answers the question the first
one left open.

## 2. The threat model, and what is already closed

| threat | status | where |
|---|---|---|
| DNS rebinding | **closed** | Host validated on every request, two distinct refusals (owner ruling C6) |
| cross-origin request | **closed** | Origin validated, custom-header gate |
| unauthenticated caller | **closed** | one-shot nonce exchanged for a session token |
| command injection | **closed by shape** | `commandFor` builds **argv arrays** from a catalogue; no shell string is ever assembled |

**What is NOT closed, and cannot be by any of the above:** the gate proves a
request came from a browser on this machine. It does not prove a *person* asked
for it. Any page in any tab is, to that server, indistinguishable from the
owner — it simply cannot read the response or the token.

Today that buys nothing, because the worst a confused request achieves is a
read. Execute is what makes it matter.

## 3. The design

### 3.1 The client sends an ID, never a command

`POST /api/execute` accepts `{ id, args }` where `id` names an entry in the
existing palette catalogue (`lib/palette-defs.js` · `commandFor`). The server
rebuilds the argv **from its own catalogue**, validates each argument against
that entry's declared shape, and runs it with `execFile` — never a shell.

This is the same rule the markdown route took on 2026-08-26: *the boundary is
enforced by construction rather than by validating a string.* A request naming a
command the catalogue does not have is a 400, not a sanitisation problem.

### 3.2 The approval boundary decides which CONFIRM a command gets

`test/helpers/approval-boundary.ts` already **derives** — from the real argument
parser — the set of commands that *"change what governs this project with no
human in the loop"*. Everything in the catalogue runs (§6.1); that set decides
how much a person is shown before it does.

- **Below the boundary** (reads, previews, `doctor`, `rebuild`, `decay`): a plain
  confirm naming the command and its resolved argv.
- **On or above it** (`add`, `promote-revision`, `refresh`, `inbox-promote`,
  `init --rewrite-watched`): a **field-by-field diff, before → after**, through
  the same `fieldView` the Review queue already renders. A command whose effect
  cannot be shown that way does not get a weaker confirm — it does not run.

Deriving rather than listing is the point, and it matters more under §6.1 than
it would have under a refusal: a command added later automatically gets the
STRONGER confirm. The failure mode of a stale derivation is "too much ceremony",
which is the safe direction to fail in.

### 3.3 Intent is proved per action, not per session

The token proves *a browser*. To prove *a person*, each execution requires a
**confirm step in the page that names what will run and what it will change**,
and the endpoint accepts an **execution nonce** minted by the GET that rendered
that confirm — single-use, short-lived, bound to the `id` and `args` shown.

A page that never rendered the confirm cannot mint one. This does not make a
malicious local page impossible; it makes a *silent* execution impossible, which
is the property that matters.

### 3.4 Every execution is audited

One audit record per run: the id, the resolved argv, the exit code, and when.
The audit log is item-shaped today, so this needs its own record kind — the same
gap `DEC-should-the-web-ui-be-allowed-to-write-config-json` named. **A run that
cannot be recorded does not happen.**

### 3.5 Reads stay on the read path

`src/ui/read-model*.ts` gains nothing. The executor is a separate module with
its own import graph, and `no-writes.test.ts` is narrowed to the read modules
rather than deleted — so a future write sneaking into a read path still fails.

## 4. Answered

See §6. §3.2's first cut was widened, §3.4's kill switch was declined, and
§3.3's residual was accepted and must be stated in the product.

## 5. Not in this design

Running arbitrary text typed by the user; anything that reaches outside the
workspace; and any execution path that does not pass through the catalogue.

---

## 6. The owner's answers, 2026-08-26

### 6.1 Everything in the catalogue runs — §3.2 is widened

Boundary-crossing commands are NOT refused. `add`, `promote-revision`,
`refresh`, `inbox-promote` and `init --rewrite-watched` execute like any other,
**behind a stronger confirm**: it must NAME every field that changes and show
**before → after**, the same diff the Review queue already renders through
`fieldView`.

So the approval boundary keeps its job, but the job changes. It no longer
decides *what may run*; it decides **which confirm a command gets**:

    below the boundary   a plain confirm naming the command
    on or above it       a field-by-field diff, before -> after, per changed field

Deriving the set from the real argument parser still matters, and matters more:
a command added later automatically gets the STRONGER confirm rather than the
weaker one. The failure mode of a stale list is now "too much ceremony", which
is the safe direction.

### 6.2 No kill switch — §3.4 stands alone

Declined: `--no-execute` and execute-off-by-default. The audit record is the
accountability story and the confirm is the gate. There is no flag that turns
the endpoint off.

**The combination is wider than either answer alone, and it is recorded here
because neither question said so on its own:** every command in the catalogue is
executable, on every `mycontext ui`, with no way to disable it short of not
running the UI. That is the owner's decision, taken with the residual in §2
in front of him twice.

### 6.3 The residual is accepted, and the product says so

The gate proves a request came from a browser on this machine. It never proves a
person asked. That is not closed by anything in this design and it is not going
to be.

It is written where a reader MEETS it, not only where a reader could look it up:

  - **in the confirm dialog**, in these words or better — *"This runs on your
    machine, now. The UI can tell it came from your browser — not that you
    asked. Only run what you recognise here."*
  - **in §7 of both READMEs**, beside the existing trust boundary.

This follows the project's own standard that an unstated limit is how a partial
claim gets read as a complete one. A security boundary is the worst place to
break it.

**And it raises the stakes on §3.3 rather than lowering them.** With §6.1
widening what can run, the single-use execution nonce bound to the exact id and
args is no longer a nicety — it is the only thing standing between a silent
local page and a corpus mutation. It is not optional and it is not deferred.
