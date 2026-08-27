# The UI server outlives the session — design

**Status:** DRAFT 2026-08-27. One question in §8 needs the owner.
**Owner requirement that asked for it:** 2026-08-27 — *"on the most suitable hooks,
check if the app server is running, if not running and not disabled start it up, find
the correct interval for this test to not overload the system"*.
**Rule it makes into a mechanism:**
`RULE-anything-you-start-for-a-human-to-look-at-must-outlive-the`.

---

## 1. The rule exists; the mechanism does not

The project already ruled that anything started for a human to look at must outlive
the work done next. It has been enforced by remembering, and remembering has failed:
the owner reported the server not working three times, and every time the server was
either dead or answering a spent nonce.

This is that rule becoming code. It is also the first enforcement site for a config
key that has been validated and read by nothing since it shipped.

## 2. What exists, and what does not

**The server.** `mycontext ui [--port N] [--no-open] [--idle-ms N]` binds
`127.0.0.1` and refuses any other host. Its default port is **0** — an ephemeral port
chosen by the operating system. It exits on idle after
`src/ui/idle.ts` · `export const IDLE_MS = 8 * 60 * 60_000;` · ~36, raised from
fifteen minutes on 2026-08-23.

**58888 is not in the product at all.** No file under `src/` contains it. It appears
only in the handover, in two corpus items, in a printed hint in the demo-corpus
script and in a test asserting it is an ordinary port. It is a number the owner types.

**There is no liveness record of any kind.** No pidfile, no lockfile, no port probe,
no `EADDRINUSE` branch. `ui-sessions.json` exists —
`src/core/ui-sessions.ts` · `const SESSIONS_FILE = 'ui-sessions.json';` · ~71 — but it
holds sha256 digests of issued tokens and nothing else: no port, no pid, no URL. It
cannot answer *is a server running*, and it was never meant to. A second
`mycontext ui --port 58888` today surfaces a raw bind error.

**`ui.enabled` is a switch with no enforcement site.**
`src/core/config.ts` · `const DEFAULT_UI: UiConfig = { enabled: true };` · ~234 is
validated, refused when malformed, rendered on the Configure screen, and consulted by
nothing that decides anything — the file says so itself. The owner's *"not disabled"*
already exists in the product. This requirement gives it its first meaning.

## 3. A liveness record, and why it is only a hint

`~/.my-context/ui-server.json`, beside `ui-sessions.json` and for the same reason:
this is machine state, not corpus state, and it must not land in a repository where
it would travel through git to a machine where the pid means something else.
`src/core/workspace.ts` · `export const GLOBAL_DIR = path.join(homedir(), '.my-context');` · ~7
is the directory.

```json
{ "version": 1, "pid": 12345, "host": "127.0.0.1", "port": 58888,
  "url": "http://127.0.0.1:58888/", "startedAt": 1756300000000,
  "workspace": "D:\\Users\\UserC\\source\\repos\\test_mycontext_plugin" }
```

Written atomically on listen, through the same tmp-plus-rename the sessions file
uses. Removed on close.

**The record is a claim, and a claim is not a measurement.** A crashed server leaves
its record behind, and a pid is reused. So liveness is PROVED in three steps and only
the third one counts:

1. the record parses and names a port,
2. the pid is alive,
3. a TCP connect to `127.0.0.1:<port>` succeeds.

A record that fails 2 or 3 is stale and is removed. This is the pattern of 2026-08-26
applied on purpose: **measure the thing, not its proxy.** The proxy here is
attractive and wrong — a file that says a server is running is exactly the shape of
the audit projection that said the corpus was loading for nine days.

## 4. The nonce problem, and why it does not sink this

The obvious objection: `mycontext ui` prints a URL with a ONE-SHOT nonce, spent by
the first load. Who gets the nonce of a server nobody started by hand?

**`ui-sessions.json` already answers it.** It exists precisely so an open browser tab
survives a server restart: the new server loads previously issued digests and honours
them. So a tab the owner already has open **keeps working across a hook-driven
restart**, with no nonce and no reload. That is not a workaround; it is the feature
that file was built for, finally having a second caller.

For a tab he has not opened yet, the URL is disclosed on `SessionStart`'s stderr,
which he sees, in the same place a missing workspace already discloses.

## 5. The interval, derived rather than picked

The owner asked for the correct interval. There are TWO, because two different things
are being bounded, and conflating them is how this kind of mechanism overloads a
machine.

### 5.1 The probe: every turn, floored at 60 seconds

A probe is one small file read plus one loopback TCP connect. It spawns nothing,
walks nothing and touches no corpus. Its cost is microseconds.

So the bound is not set by what the probe costs; it is set by **how long the owner
would sit looking at a dead tab**. Probe on `Stop` — which already fires on every
assistant turn — with a 60-second floor kept in state. Worst case between a server
dying and its restart is one turn or one minute, whichever is longer, at a cost of
one loopback connect per minute.

**The number that is NOT the basis:** `IDLE_MS` is eight hours, so a healthy server
needs checking roughly never. Deriving the interval from the server's lifetime would
give an interval of hours and a mechanism that is never there when it is wanted.

### 5.2 The spawn: at most once per 5 minutes, and it gives up

Spawning is the expensive act and the only dangerous one. A hook that retries a
failing spawn every minute forever is precisely how a machine gets overloaded, and it
is the only path here that can do it.

- At most one spawn attempt per **5 minutes**, enforced by a timestamp in state.
- After **3 consecutive failed spawns** the mechanism stands down for the rest of the
  session and says so once on stderr. A refusal is a state to leave, and a mechanism
  that cannot start a server needs a human, not another attempt.
- The counter resets on a successful probe.

There is no timer and no daemon. A hook has no scheduler, so the rate is enforced by
a timestamp checked on an event that already fires.

### 5.3 The spawn shape

```
spawn(process.execPath, [cli, 'ui', '--port', String(port), '--no-open'],
      { detached: true, stdio: 'ignore' }).unref()
```

`detached` and `unref` are not optional: `Stop` runs on a 3-second timeout the
platform genuinely waits on, and a child holding the parent's event loop open would
turn every turn into a three-second pause.

## 6. Off unless configured, and that is a safety call

`ui.port` joins `ui.enabled`, because **a hook cannot use port 0.** An ephemeral port
is a URL nobody can bookmark, and the whole point is a server that is there when he
looks.

Its default is ABSENT, and absent means the mechanism is off.

> **A plugin that spawns a background server on every machine it is installed on,
> because somebody installed it, is not acceptable.** Setting `ui.port` is how the
> owner turns this on — a positive act, per workspace. `ui.enabled: false` then turns
> it off again without unsetting the port, which is what a disable switch is for.

So the two keys divide cleanly: `ui.port` says *where*, and answering that question at
all is the opt-in; `ui.enabled` says *whether*, and it is the off switch that finally
does something.

## 7. What this does not do

- It does not open a browser. `--no-open` always. A hook that launches a browser
  window mid-turn is a hook nobody keeps installed.
- It does not restart a server that is running but wedged. Liveness here means the
  port accepts a connection; a server that accepts and then answers wrongly is a
  different defect with a different fix.
- It does not touch `--idle-ms`. Eight hours is the ruled default and this changes
  nothing about it.
- It does not run in a subagent. Parent sessions only, the way `PostCompact` already
  restricts itself.

## 8. What needs the owner

**Which port, and in which workspace?** The design says the owner opts in by setting
`ui.port`, and 58888 is the number he has been typing all along — but it lives in a
handover today, not in a config file, and writing `.my_context/config.json` is his
act by standing rule. *Set `ui.port: 58888` in this workspace, and is 58888 still the
number?*

## 9. Done when

1. With `ui.port` unset, no hook spawns anything and nothing is written.
2. With `ui.port` set and `ui.enabled` true, a killed server is back within one turn
   or one minute, and the owner's already-open tab keeps working without a new nonce.
3. With `ui.enabled: false`, no probe and no spawn — and the key has an enforcement
   site for the first time.
4. Three failed spawns stand the mechanism down for the session, with one line saying
   so.
5. A stale record left by a crashed process is detected by the probe, not believed,
   and removed.
