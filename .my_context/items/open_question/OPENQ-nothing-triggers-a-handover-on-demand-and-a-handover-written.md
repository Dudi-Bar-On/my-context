---
id: OPENQ-nothing-triggers-a-handover-on-demand-and-a-handover-written
type: open_question
title: nothing triggers a handover on demand, and a handover written early reports as never written
status: deprecated
severity: soft
always: false
summary: A person who prepares a summary before the system asks for one is told none exists.
summary_of: aed81dc9787a871d
scope:
  - src/core/handover-ask.ts
  - src/cli/index.ts
  - commands/**
tags:
  - v2
  - handover
  - cli
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: 2026-09-06
checksum: 77150e61912ef235
---

# nothing triggers a handover on demand, and a handover written early reports as never written

Owner question 2026-09-06: is there a slash command or CLI command that triggers a handover update
manually - for a user who does not want to wait for 85% and wants to compact or start a new session
sooner?

MEASURED ANSWER: NO, on all three surfaces. `mycontext` declares no handover command; no file under
commands/ mentions handover; src/mcp/tools.ts mentions it nowhere. The entire mechanism is hooks:
Stop asks, PreCompact records the occupancy, SessionStart delivers, PostCompact resolves. The only
non-hook code that touches it is the two statusline commands, and they only READ.

THE CONTENT PATH ALREADY WORKS, and that is worth saying before anything is built. The handover is
a plain markdown file at the configured path. A user can write it by hand, or ask the assistant to,
at any occupancy - and SessionStart will deliver whatever is there, bounded and marked, exactly as
it does after an automatic ask. Nothing is broken about writing early.

WHAT IS BROKEN IS THAT THE MECHANISM CANNOT SEE IT. `checkHandoverAsk` reads the latch first:

    const latch = readLatch(root, sessionId);
    if (latch.askedAt === null) {
      return { verdict: ‘not-asked’, path: handover.path, askedAt: null, writtenAt: null, … };
    }

It returns before it ever stats the file. So a handover written by hand at 40% - current, complete,
correct - reports `not-asked` with `writtenAt: null`, and both surfaces say "no handover ask yet -
first at 85%". A user who did the right thing early is told nothing is prepared. That is the same
class of error as the one D14 fixed, pointing the other way: D14 was a stale file reported current,
this is a current file reported absent.

THE DESIGN QUESTION, and it is genuinely open. The latch is the record of an ASK, and `acted-on`
means "written after the ask" - ordering. A manual write has no ask to be ordered against, so it
does not fit the existing vocabulary rather than merely being unhandled. Two shapes:

  (a) A COMMAND THAT ASKS. `mycontext handover --now` (and a slash spelling) fires the same ask the
      Stop hook fires, at whatever the occupancy is, stamping askedAtPercent. Everything downstream
      then works unchanged, because the mechanism only ever knew about asks. Smallest change, and it
      keeps one vocabulary.
  (b) A SIXTH VERDICT for a file that is current with no ask behind it - honest, but it widens a
      type that five call sites read, and it invents a state the mechanism has no use for elsewhere.

(a) looks right and (b) looks like it is describing the same fact awkwardly, but this is the owner’s
call and not a lane’s.

RELATED AND ALREADY OPEN: handover/11 - "there is no way to keep the handover injected while turning
the automatic ask off". Same surface, opposite direction: that one wants LESS asking, this one wants
asking ON DEMAND. Whatever command shape is chosen should answer both, or say why it does not.
