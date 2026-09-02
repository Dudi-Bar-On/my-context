---
id: KNOWN-doctor-offers-execute-although-the-running-system-refuses-it
type: known_issue
title: Doctor offers Execute although the running system refuses it, while the catalogue marks it off the boundary
status: deprecated
severity: hard
always: false
summary: A contradiction where the diagnostics screen offers to run a command that the system then refuses, because no confirmation can be built for it.
summary_of: 88c79138be8b50b7
scope: []
tags:
  - v2
  - ui
  - execute
  - doctor
  - owner-blocking
  - must-fix
origin: human
source_file: null
source_anchor: null
source_checksum: 35f6b24559d884ce
valid_from: 2026-08-27
valid_until: 2026-08-29
checksum: 4becd257fac15be6
---

# Doctor offers Execute although the running system refuses it, while the catalogue marks it off the boundary

> Owner-reported 2026-08-27: on the Doctor screen, Execute is offered but not
> actually allowed.
>
> Confirmed contradiction in the catalogue: `src/ui/public/lib/palette-defs.js`
> declares doctor as `{ name: 'doctor', kind: 'read', boundary: false,
> screen: '#/doctor' }`. `boundaryOf(def)` returns `def.boundary !== false`, so
> `boundary: false` places doctor deliberately OFF the approval boundary — the
> one marking that means "this may be executed without human approval". The
> screen therefore advertises a capability the catalogue grants and the running
> system refuses.
>
> Resolved 2026-08-27: the catalogue is right and the refusal is right, and
they are about different things. `boundary: false` on the `doctor` ENTRY
says the doctor command may run unconfirmed — and it does. But the Doctor
SCREEN does not compose `doctor`; it composes `repair`, which is
`boundary: true` and absent from `COMMAND_EFFECTS` (five entries: pin,
unpin, harden, soften, edit). So the press mints a nonce, finds no effect it
can show, and stops at `exec.noeffect` per spec §3.2. Nothing disagrees;
the screen is offering a command whose confirm cannot yet be rendered.

The fix is `plan:execute seq:5b` — derive effects server-side so `repair`
and the other eight blocked commands gain a confirm. Ruled by the owner on
2026-08-27 in favour of the server-side derivation over extending the
browser-side map.

Either the refusal is right and the catalogue's `boundary: false` is wrong, or
> the catalogue is right and something downstream is refusing a command it
> should run. Both are defects; they need different fixes, and the audit log's
> `ui-refused` records name which check refused.
>
> The general hazard this belongs to: a control that is drawn is a promise. A
> screen that shows Execute on a command the system will not execute teaches the
> user that the button is unreliable everywhere, which costs more than the one
> command.
