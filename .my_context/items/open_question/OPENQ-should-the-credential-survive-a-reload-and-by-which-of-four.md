---
id: OPENQ-should-the-credential-survive-a-reload-and-by-which-of-four
type: open_question
title: should the credential survive a reload, and by which of four mechanisms
status: active
severity: soft
always: false
summary: Whether signing in to the local viewer should last past a reload, and which of four ways of remembering it is worth its cost.
summary_of: 69975d61ea392d4d
acknowledged:
  - body_ends_unfinished@65ce27217b21ccc9
  - open_question_blocks@65ce27217b21ccc9
scope:
  - src/ui/security.ts
  - src/ui/public/app.js
tags:
  - v2
  - ui
  - security
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: af61005d46246611
blocks: live/22
---

# should the credential survive a reload, and by which of four mechanisms

Owner request 2026-09-09: "i also want you to make a deep research over the internet a find a more
reliable and cheaper mechanism to replace the one we use based on the tokens in memory, it makes a
user very unhappy that he should always needs to handle it, maybe some socket protocols between
mycontext app and the web server or our MCP server, just raise some ideas not realy know what’s
possible". Researched; this item is the decision put on the record.

── WHAT EXISTS TODAY, AND WHAT IT BUYS ──────────────────────────────────────────────────────

A one-shot nonce in the URL FRAGMENT, redeemed for an in-memory token (`src/ui/security.ts` -
"The handoff nonce is one-shot by design"). Two properties fall out of that and both are real:

  - THE FRAGMENT IS NEVER SENT TO THE SERVER, so the credential cannot leak through an access log,
    a proxy or a Referer header.
  - NOTHING IS SENT AUTOMATICALLY, so CSRF IS STRUCTURALLY IMPOSSIBLE. That is what lets this
    server say "NO CORS headers, deliberately - their absence is the defence".

The cost is the one he is complaining about: the token dies with the page. Reload, tab close or
server restart means handling a credential again.

AND THE FIRST FINDING IS THAT THE AUTH DESIGN IS NOT WHY HE FEELS IT. `restartStaleServer` replaces
the running server whenever its code goes stale, which during active development is after every
commit - measured on 2026-09-09 as six restarts in one night and a down/up cycle every 14-15
minutes. So the credential is not dying at the rate the design intended; it is dying at the rate we
commit. plan:live seq:22 fixes the recovery and is far cheaper than replacing the model.

── OPTION A: THE JUPYTER MODEL. A TOKEN THAT SETS A COOKIE ONCE, THEN IS DISCARDED ──────────

The closest analogue in the wild, and it solves reload-survival directly: Jupyter’s token "can be
used only once to set a cookie for your browser once it connects, after which the token is
discarded", and thereafter a reload just works. Jupyter also does the Host-header check against DNS
rebinding that this server already does.

AND I RECOMMEND AGAINST IT, ON ONE MEASURED FACT: COOKIES ARE NOT PORT-ISOLATED. RFC 6265
acknowledges this outright - cookies for a host are shared across every port on that host, unlike
every other same-origin rule. A cookie for `127.0.0.1` would therefore be sent to `127.0.0.1` on
ANY port, and this project spins up ephemeral loopback servers constantly (`startUiChild`), as does
every other dev tool on the machine. The session cookie would be handed to a Vite server, a
Storybook, a test harness, another checkout’s my_context.

It also reintroduces AMBIENT AUTHORITY - the browser attaching the credential without the page
asking - which is the thing that makes CSRF possible at all. We would then need SameSite plus an
XSRF token to climb back to the safety the fragment design already has for free.

── OPTION B: WEB STORAGE. THE RECOMMENDATION IF PERSISTENCE IS WANTED ───────────────────────

`localStorage` and `sessionStorage` are scoped to the FULL ORIGIN - scheme, host AND PORT. So on
loopback they are STRICTLY BETTER ISOLATED THAN A COOKIE, which is the opposite of the usual
advice and is specific to this situation. And they are never sent automatically, so the CSRF-free
property survives intact.

PortSwigger argues web storage is the LESSER EVIL for session tokens, on the ground that cookies
are "insecure by default, and the secure flag is simply a bodge" - the automatic attachment being
the deeper flaw. Their preconditions are: one consistent scheme, SERVER-SIDE EXPIRY (web storage
has none of its own), the page attaching the token explicitly, and no XSS.

THIS APP MEETS THOSE PRECONDITIONS UNUSUALLY WELL, which is the argument for taking their side
here rather than the conventional one: loopback only, `dependencies` empty by constraint, a
front end that is vendored and SHA-pinned (`check:vendor`, 28 files), no third-party scripts at
all, and the same four security headers on every response from one object.

`sessionStorage` survives a reload in that tab; `localStorage` survives a browser restart and new
tabs. The cost is honest and must be written down: ANY JavaScript on the page can read it, so the
XSS surface becomes the whole of the credential’s protection.

── OPTION C: HIS SOCKET IDEA, ANSWERED RATHER THAN DEFLECTED ────────────────────────────────

A browser cannot speak a raw socket or a named pipe to a local process. The only browser-reachable
socket is a WebSocket, which is still HTTP-origin-based and needs the same credential - so sockets
would CARRY the auth, not replace it. That is the direct answer.

BUT THE INSTINCT MAPS ONTO SOMETHING REAL, and it is what current practice actually recommends: a
short-lived token in memory with the DURABLE secret held OUTSIDE the browser - the CLI or the MCP
server keeping it in the OS keychain and minting short-lived credentials on demand. That is a
genuine improvement in durability and it composes with option B rather than competing.

The catch to state plainly: something must still get the short-lived token INTO the page, and that
is the nonce handoff we already have. So this improves the refresh, not the handoff.

── OPTION D: THE CHEAPEST. NO AUTH ON LOOPBACK ──────────────────────────────────────────────

Many local dev tools do exactly this and rely on binding 127.0.0.1 plus the Host check. It is the
cheapest possible answer and he asked what was cheapest, so it belongs on the list.

NOT RECOMMENDED: it means any process on the machine can read the corpus, the audit log and every
transcript the archive indexes. The archive now serves 615 MB of lane reasoning and full tool-call
inputs, so the value of what sits behind that port went up sharply on 2026-09-08.

── THE RECOMMENDATION, IN ORDER ─────────────────────────────────────────────────────────────

  1. FIX THE RECOVERY, NOT THE MODEL. plan:live seq:22: reopen the stream on the look tick, and
     MEASURE whether `ui-sessions.json` really does let a restart keep the session -
     `restartStaleServer`’s own comment claims "the owner’s already-open tab survives the restart
     anyway", and he lost his credential on the morning of 2026-09-09. If that claim is true and
     merely unreached, this whole item may be unnecessary.
  2. THEN OPTION B, if he still wants survival across a browser restart: `localStorage` with
     server-side expiry.
  3. NOT A COOKIE, for the port bleed and the return of ambient authority.
  4. OPTION C alongside B, if the durable half is wanted outside the browser.

SOURCES, so the reasoning can be checked rather than trusted:
  - Jupyter, Security in the notebook server:
    https://jupyter-notebook.readthedocs.io/en/v6.5.3/security.html
  - PortSwigger, Web storage: the lesser evil for session tokens:
    https://portswigger.net/research/web-storage-the-lesser-evil-for-session-tokens
  - Mozilla bug 469287, cookies same domain different ports:
    https://bugzilla.mozilla.org/show_bug.cgi?id=469287
  - Storing session tokens in a browser:
    https://blog.ropnop.com/storing-tokens-in-browser/
