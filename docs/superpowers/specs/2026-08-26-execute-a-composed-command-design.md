# Executing a composed command from the web UI — design

**Status:** DRAFT, awaiting the owner's approval. No code until then.
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

### 3.2 Only commands below the approval boundary run unattended

`test/helpers/approval-boundary.ts` already **derives** — from the real argument
parser — the set of commands that *"change what governs this project with no
human in the loop"*. That set is exactly the set this endpoint must not run on a
bare click.

- **Below the boundary** (reads, previews, `doctor`, `rebuild`, `decay`): run on
  confirm.
- **On or above it** (`add`, `promote-revision`, `refresh`, `inbox-promote`, …):
  **refused by this endpoint entirely** in the first version. They keep the Copy
  button.

Deriving rather than listing is the point: a command added later joins the
refused set automatically, the same way the READMEs and the skill file are kept
honest today.

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

## 4. What I need decided

1. **Is §3.2 the right first cut?** It means the Configure wizard and Review
   queue — arguably the two you most want — keep Copy, because they cross the
   approval boundary. The alternative is to allow them behind a stronger confirm
   that names every field that changes.
2. **Does the audit record satisfy you as the accountability story**, or do you
   want a kill switch (`ui --no-execute`) and/or execute off by default?
3. **Section 3.3 is the weakest link.** It reduces the browser-vs-person gap; it
   does not close it. Accepting Execute means accepting that.

## 5. Not in this design

Running arbitrary text typed by the user; anything that reaches outside the
workspace; and any execution path that does not pass through the catalogue.
