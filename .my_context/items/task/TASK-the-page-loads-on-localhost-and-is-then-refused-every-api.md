---
id: TASK-the-page-loads-on-localhost-and-is-then-refused-every-api
type: task
title: the page loads on localhost and is then refused every API call for the life of the tab
status: active
severity: soft
always: false
summary: Opening the console by its most natural hostname served a working-looking page that could never fetch anything, and no nonce or restart could fix it.
summary_of: ad3a0dc35e32ce1b
scope:
  - src/ui/server.ts
tags:
  - v2
  - ui
  - live
  - security
  - "state:done"
  - "verified_on:2026-09-05"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 2d63df2e640c1fc5
---

# the page loads on localhost and is then refused every API call for the life of the tab

Reported by the owner 2026-09-05: "still can not use the web on my browser, you must fix it for
good", after four server restarts and three minted nonces had all failed to help.

MEASURED, before the fix:

  http://localhost:58888/            -> 200   the page loads
  http://localhost:58888/api/status  -> 403   every call, forever
  http://127.0.0.1:58888/            -> 200
  http://127.0.0.1:58888/api/status  -> 401   recoverable with a nonce

THE CAUSE. `serveStatic` ran BEFORE any Host check (Rule 1 in server.ts: "the page’s own bytes,
before the gate"), so the shell was served to any hostname that resolved to this machine. But
`validateApiRequest` compares Host against `127.0.0.1:PORT` exactly, and "localhost" is not that
string. So the page loaded, looked alive, and was refused everything it asked for.

WHY NO AMOUNT OF RESTARTING FIXED IT. The failing gate check is `host`, which answers 403. A
nonce repairs `token-missing`, which answers 401. They are different failures and the screen
drew the same refusal card for both, telling the reader to run `mycontext ui --nonce` — advice
that cannot work, because the credential was never the problem. A person whose browser
autocompletes localhost:58888 was locked out permanently with nothing on screen able to say why.

THIS IS THE FIFTH DISTINCT CAUSE of the same reported symptom, and it is exactly what
RULE-when-a-symptom-returns-after-a-verified-fix-look-for-a describes. The four before it were a
reload with no credential, a cookie scoped to a host rather than a port, a stale HttpOnly cookie
nothing could clear, and a nonce pasted into a live page doing nothing. Each earlier fix was
correct. This was a new cause, and it was found by MEASURING both hostnames side by side rather
than by re-examining the nonce path again.

THE FIX, shipped 2026-09-05. A loopback spelling other than the canonical one is REDIRECTED (302)
to `http://127.0.0.1:PORT`, preserving path and query; the browser carries the fragment across by
itself, so a nonce link survives the hop and the handoff completes on the canonical origin. A
Host that is not a loopback spelling is now REFUSED rather than served, which also closes the
hole Rule 1 left open — this server used to hand its page to any hostname resolving here,
including a rebinding one.

A REDIRECT RATHER THAN WIDENING THE GATE to accept both spellings, and the reason is the cookie.
The token lives in a cookie, cookies are scoped to a HOST and not to a port — the fact
/api/handoff’s own exemption had to be widened for — so two accepted spellings would be two
cookie jars. A reader authenticated as 127.0.0.1 would be anonymous as localhost and the lockout
would return wearing a different hostname. One origin is one jar.

VERIFIED AS A USER, in a browser: navigated to http://localhost:58888/#<nonce>; landed on
http://127.0.0.1:58888/ with the fragment consumed by the handoff; /api/status answered 200; the
screen drew real corpus data rather than a refusal. Also verified that a non-loopback Host and a
loopback name on the wrong port are both refused 403 rather than served.
