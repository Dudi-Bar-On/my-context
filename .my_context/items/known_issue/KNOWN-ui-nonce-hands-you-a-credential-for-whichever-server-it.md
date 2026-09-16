---
id: KNOWN-ui-nonce-hands-you-a-credential-for-whichever-server-it
type: known_issue
title: ui --nonce hands you a credential for whichever server it found, and refuses the flag that would aim it
status: active
severity: soft
always: false
summary: The command that gets you back into the web UI can quietly give you a key to the wrong server, and there is no way to say which one you meant.
summary_of: 7f38b2245080b090
scope:
  - src/cli/commands/ui.ts
  - src/core/ui-server-upkeep.ts
  - src/core/command-flags.ts
tags:
  - v2
  - silent-failure
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: c01facf6d1949d67
---

# ui --nonce hands you a credential for whichever server it found, and refuses the flag that would aim it

MET BY THE MAIN SESSION ON 2026-09-16 WHILE TRYING TO GET THE OWNER BACK INTO HIS OWN SERVER.

His page had stopped working because the UI upkeep had replaced the process on 58888 and the
new one printed its handoff nonce to a console nobody reads. `mycontext ui --nonce --no-open`
is the documented way back — "ask a server already running for a fresh one-shot credential".
It answered:

    mycontext ui: http://127.0.0.1:59125/#cb64d5b511efc4f11648a7274a230f4e

**59125 WAS A LANE’S THROWAWAY SERVER.** His is 58888, and it is written down —
`.my_context/config.json` carries `ui.port: 58888` with `ui.enabled: true`. Two servers were
running and the command picked the other one.

AND IT CANNOT BE AIMED. `--nonce` is documented as "mutually exclusive with `--port` and
`--idle-ms`, which this command refuses rather than ignore". Refusing a flag rather than
ignoring it is normally the right instinct — here it removes the only way to say which server
you meant, on a machine where several are routinely running because every lane starts one.

── WHY IT IS WORSE THAN A WRONG PORT ───────────────────────────

The URL it printed WORKS. It opens a real server, serving the same corpus, and looks correct —
so the reader has no signal that anything went wrong until something is subtly not what they
expected. A command that fails is better than one that succeeds at the wrong thing, and this is
the second kind.

It is also the ONLY escape hatch from a problem the product creates itself: the upkeep
(`src/core/ui-server-upkeep.ts`, riding the Stop hook) respawns the configured server whenever
it stops answering, minting a nonce into a detached console. The owner met that twice in one
day. So the recovery path is the thing that most needs to be right, and it is the thing that
guesses.

── WHAT WOULD FIX IT, AND THE SMALLEST ONE IS ENOUGH ──────────────────

  1. PREFER THE CONFIGURED PORT. `ui.port` is written down and the upkeep already reads it; a
     `--nonce` that asks THAT server first would have been right here with no new surface.
  2. SAY WHICH SERVER IT CHOSE AND WHY, especially when more than one answered. The URL names
     the port, but nothing says "there were three and I picked this one".
  3. AND LET IT BE AIMED. `--port` with `--nonce` is not the contradiction the refusal assumes:
     one says which server to ASK, the other said which port to BIND. They are different
     questions wearing one flag name.
