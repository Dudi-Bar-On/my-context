# 07 — Frontend architecture: what makes sixteen screens affordable, and where plan 1 breaks

**Panel role:** frontend architect
**Read:** spec `2026-08-16-web-ui-design.md` (whole), `2026-08-18-v2-decisions.md` (whole),
plan 1 `2026-08-16-web-ui-1-server-and-reads.md` (§0, verified facts, design decisions, file
structure, Tasks 8, 11, 16, 17, 18, self-review, Produces), plan 2 and plan 3 file structures +
plan 3 Task 11 (`window.myctx.stream`), `docs/design/web-ui-mockup.html`, and the panel's
`02-ia.md`.
**Sketch:** `sketches/07-arch.html` — runnable, demonstrates every pattern below including a live
XSS payload rendered safely and the plan-1 subscription leak on a toggle.
**Provenance marks:** **[V]** verified in the repo, **[M]** measured or derived from a measurement
recorded in the repo, **[R]** reasoned.

The panel is about to recommend a larger feature set. The question I was asked is not "can it be
built" — it can — but **what makes it affordable**, and the answer turns out to be four decisions
that each remove a whole class of per-screen work: the URL is the store, structure lives in
`<template>`, `textContent` is the only text sink, and every screen has a teardown. Everything else
in this report follows from those four.

**The finding that matters most is not architectural.** Plan 1's §0 corrections table records the
`focus` omission, the `readSeen`-not-`Ledger.seen` correction and (via decision 5) the landing
screen — and **none of the three is applied in the task bodies those rows name.** §0 is a log, not
a patch, and nothing checks that a row landed. Details in *Changes to plan 1*, items 1–3.

---

## Module and state

### The shape

Six modules, ~500 lines of infrastructure total, no store library, no framework:

| Module | Lines | Owns |
|---|---|---|
| `lib/signal.js` | ~25 | `createSignal(v)` → `{get, set, subscribe→unsubscribe}` |
| `lib/router.js` | ~70 | parse/serialize the URL, per-screen parameter schemas, sticky globals |
| `lib/dom.js` | ~40 | `clone(templateId)`, `fields(frag)` — the only text sink in the app |
| `lib/resource.js` | ~90 | fetch, cache classes, generation invalidation, the staleness envelope |
| `lib/stream.js` | ~80 | one refcounted audit tail, multiplexed to N subscribers |
| `app.js` | ~200 | shell chrome, provenance bar, mount/dispose lifecycle |

### The rule: the URL is the store

> **Shared state is state that belongs in a link. State that belongs in a link lives in the URL.
> Everything else is a screen's private variable.**

This is the whole answer to "how do sixteen screens share the session selector without a framework".
They do not share it — they **read it from the URL**, which the shell owns. The session picker does
not notify screens; it rewrites the URL, the router notices, and the screen's declared dependency on
`session` re-runs. One direction of flow, one source of truth, no synchronisation problem, and
deep-linking (§4 below) becomes free rather than a second feature.

It also settles the panel's IA proposal cleanly: `02-ia.md`'s **modes** are a URL parameter
(`?mode=simulate`), its **detail pane** is a URL parameter (`?item=RULE-7`), its **composer overlay**
is a URL parameter (`?compose=supersede&item=RULE-7`). Sixteen capabilities across eight
destinations needs *zero* new state mechanism — it needs a parameter schema per screen.

Precisely, three tiers:

1. **Global, sticky, in the URL:** `session`, `focus`. They survive navigation because the router
   carries them across screens (`GLOBAL_PARAMS` in the sketch). They are in the URL because the spec
   already treats them as *questions the reader must be able to see they asked* — "cold session" and
   "focus off" are labelled as different questions, and a labelled question that vanishes from the
   address bar is one a colleague cannot reproduce.
2. **Screen-local, in the URL:** `path`, `event`, `dir`, `item`, `radius`, `code`, `window`, `kind`.
   Declared per screen; **unknown parameters are refused, not ignored** — the client mirror of plan
   1's design decision 6, which already refuses them server-side. Refusing on one side only is how
   `?sesion=` becomes a silent cold preview in the address bar instead of on the wire.
3. **Not in the URL:** language and theme (preferences, `localStorage`), tree expansion beyond the
   addressed directory, in-flight edit buffers, scroll position.

`language` is deliberately *not* URL state: it is a property of the reader, not of the view, and
putting it in a link means a shared link changes the recipient's language. `<html dir>`/`lang` follow
it; nothing else in the app knows about it.

### The screen contract, which must gain a teardown

```js
export const uses   = ['session', 'focus', 'path'];      // declared dependencies
export const fields = ['title', 'delivered', 'spilled'];  // asserted against the template
export function mount(root, ctx) { … }                    // ctx.effect() files its own unsubscribe
```

`ctx` gives a screen exactly five capabilities: `state()`, `go(patch)`, `t(key, subs)`,
`read(url, cacheClass)`, `declare(notes)`, plus `effect(deps, fn)` and `cancelled()`. Nothing else.
A screen cannot call `fetch`, cannot touch `history`, cannot subscribe without being unsubscribed.

**Plan 1's contract is `render(root, ctx)` with no return value, and that is a defect, not a
style.** [V] `app.js` Task 16 holds `const sessionListeners = []` and
`onSessionChange: (fn) => sessionListeners.push(fn)` with **no removal path anywhere in the plan**,
while `route()` mounts a new screen module on every hash change. Consequences, in order of how soon
they bite:

- Visit preview → coverage → preview: three live listeners. Change the session once and
  `preview.show()` runs twice and `coverage.showDetail()` once — [V] `preview.show()` issues three
  fetches (`/api/select`, `/api/simulate`, `/api/render`), so one session change costs 6–9 requests
  and the last response to land wins a race with no ordering guarantee.
- The listeners close over the *previous* screen's DOM nodes, so every navigation retains a detached
  tree. With sixteen screens and a session picker, a normal working hour leaks steadily.
- Plan 3 adds `myctx.stream()` (Task 11) whose abort function is returned to the screen and, with no
  teardown hook, is never called on navigation — the tab holds a stream to a server it is no longer
  looking at, and §2's "an open stream is not activity" means the server is silently kept in a state
  where it *can* idle out while the page still believes it is connected.

The sketch has this on a checkbox (`leak like plan 1 Task 16`) beside a live subscription counter, so
the failure is observable rather than argued.

### Live streams

**One stream for the whole app, refcounted, owned by the shell.** Plan 3 gives each screen its own
`myctx.stream(path, onEvent, onEnd)`. That is right while exactly one screen (Watch) uses it and
wrong the moment a second does — with the larger feature set, the status strip wants injections, the
preview wants to invalidate its cache when its session receives one, Work wants mutation records, and
Doctor wants to know the projection moved. Four consumers, four connections, four idle-exempt
sockets, four parsers.

`lib/stream.js` instead: `subscribe(filter, fn) → unsubscribe`; the first subscriber opens the tail,
the last one closes it. Filtering is client-side over the four record kinds. Closure is a single
state machine (`connecting | live | closed | fault`) rendered once by the shell's connection banner,
not by each screen's `catch`.

---

## Rendering and escaping

### The choice: `<template>` + field binding

Three candidates, judged against CSP, the no-build rule, sixteen screens and two languages:

| | Hand-rolled DOM (plan 1) | Tagged-template HTML → `innerHTML` | **`<template>` + field binding** |
|---|---|---|---|
| CSP `script-src 'self'` | fine | fine | fine |
| CSP `style-src 'self'` | fine via CSSOM (see trap below) | fine | fine |
| No build step | fine | fine | fine |
| XSS surface | one `.textContent` per value, ~600 call sites to keep right | **a hand-written escaper with per-context rules** | **one sink, `fill()`, in one file** |
| Lines for 16 screens | ~2,500 [R] | ~1,200 | ~1,000 + ~300 of HTML |
| RTL audit | read 16 JS files | read 16 JS files | read one HTML file |
| Testable without a browser | needs a full DOM | needs an HTML parser | **needs ~12 DOM methods** |
| New machinery to maintain | none | a mini-framework | ~40 lines |

**Pick `<template>` + field binding.** The decisive argument is not ergonomics, it is that it makes
the anti-XSS rule *negative and greppable*, and this project's culture is enforcement over
discipline (plan 1 Task 14's import-graph test is the same move one layer down).

Structure lives in `index.html` as `<template id="tpl-preview">…</template>` with `data-f="name"`
slots. A screen does `const f = fields(clone('tpl-preview'))` and then `f.text('title', value)`.
`fill` writes through **`.textContent`**, which is not parsed as HTML.

### How XSS is prevented on semi-trusted corpus text

Item titles, bodies, scopes, doctor messages, audit notes and composed-command fragments are written
by agents and by ingest. The defence is four layers, and only the first is load-bearing:

1. **`textContent` is the only text sink.** There is no escape function, because there is nothing to
   escape: text assigned to `textContent` never becomes markup, in any context, in any browser. An
   escaper has contexts (element, attribute, URL, style, `srcdoc`) and gets one of them wrong
   eventually; `textContent` has none.
2. **A negative invariant, enforced by a source scan** (new test, ~30 lines, zero dependencies —
   same shape as Task 14): under `src/ui/public/**` there is **no** `innerHTML`, `outerHTML`,
   `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `setTimeout('…')`,
   `setAttribute('style'|'href'|'src'|'srcdoc', …)`, or `javascript:`. This requires one change to
   plan 1: [V] its screens use `root.innerHTML = ''` and `picker.innerHTML = ''` to clear. Those
   become `replaceChildren()`, and then the ban is absolute and a grep can state it.
3. **`require-trusted-types-for 'script'; trusted-types 'none'` added to the CSP.** In Chromium this
   turns the grep into a *runtime* enforcement: an `innerHTML` assignment throws. It is inert in
   browsers that have not shipped Trusted Types, so it is defence in depth rather than the defence —
   but it costs one CSP directive and no code, and it converts a rule into a mechanism. **Verify in
   the target browser before relying on it**; the guarantee is Chromium-shaped today.
4. **Link and image discipline.** Nothing in the corpus produces a URL, so no corpus value ever
   reaches `href`/`src`. Where a screen builds an internal link it builds it from the router
   (`ctx.go`), never from data. `img-src 'self' data:` and `default-src 'none'` mean even a
   successful injection has nowhere to send anything — that is the CSP's job and it is a backstop,
   not the plan.

**The rule that has to be added to the string tables, before the tables grow.** [V] The mockup's
Hebrew table already carries markup inside translations (`'sess.parent': '… <b>השרשור ההורה</b> …'`)
and binds them with `el.innerHTML = v`. Plan 1's tables are currently markup-free, so the cheap
moment is now:

> **A string table value may not contain `<`.** Rich strings take *node* substitution —
> `t('prov.parent')` returns text, and the emphasis lives in the template — asserted by extending
> the existing key-parity test with a one-line value scan over both tables.

Without that rule, the first explanatory sentence that wants a bold word reintroduces `innerHTML`
into the one file whose values are edited by a translator.

### The CSP trap worth writing down

`style-src 'self'` blocks `<style>` blocks, `style=` attributes in markup, and
`setAttribute('style', …)`. It does **not** intercept CSSOM assignment — `el.style.inlineSize = …`
works. [V] Plan 1's screens rely on exactly that (`fill.style.inlineSize`, `wrap.style.display`,
`label.style.cursor`, `line.style.paddingInlineStart`). So the plan is *not* broken, but it is one
refactor away from a silent no-op the day someone reaches for `setAttribute('style', …)`.

**Rule:** dynamic visuals are CSS custom properties set through `el.style.setProperty('--fill', …)`,
never physical properties, never a style attribute — one channel, greppable, and it keeps the
theme/RTL logic in the stylesheet where the logical-property audit can see it.

**And the plan's own logical-property rule needs a test.** [V] Plan 1 states "a physical
`left`/`right`/`margin-left`/`text-align: left` anywhere in this file is a defect" and ships no
assertion. A ~10-line regex test over `styles.css` is the difference between a rule and a comment,
in a project whose §0 exists because rules without enforcement decay.

---

## Data and staleness

### What is fetched when

Four cache classes, declared once as a policy table so sixteen screens do not each invent one:

| Class | Endpoints | Lifetime | Invalidated by |
|---|---|---|---|
| `process` | `/api/meta` | once per page | never |
| `corpus` | `/api/items`, `/api/coverage`, `/api/status`, `/api/doctor`, `/api/graph`, `/api/help/*`, `/api/config` | cached | **corpus generation** moves |
| `session` | `/api/select`, `/api/render`, `/api/simulate`, `/api/session/:id/injected` | cached per (session, focus, event, path, budget overrides) | generation, **or a stream injection/focus record for that session** |
| `never` | `/api/ping`, the stream | — | — |

**The generation counter is the one new server concept, and it is cheap.** The server computes a
corpus generation — count + max mtime over `.my_context/items/**`, or `items` max rowid + count —
and returns it as `X-Myctx-Generation` on **every** `/api` response. The client keeps one number;
any response carrying a newer one marks every `corpus`-class entry stale. Without it, sixteen screens
each guess how long their data is good for, and the guesses disagree; with it, one comparison decides.

**Three request-discipline rules that pay for themselves at sixteen screens:**

- **`fetch` appears in exactly one module** (`lib/api.js`), enforced by the same source scan. That is
  what keeps the token header, the generation check, the abort signal and the `no-store` handling in
  one place instead of sixteen.
- **In-flight dedupe.** Two screens (or the leaked listeners above) asking for the same URL in the
  same tick share one promise.
- **Abort on unmount.** One `AbortController` per mount; navigation aborts. Plan 1 has no mechanism
  for this because it has no unmount.

**One server-side change removes a 3× cost.** [V] plan 1's preview issues `/api/select`,
`/api/simulate` and `/api/render` in parallel for one view; each runs `select()` again. Keep the
three endpoints — the §6 parity test requires `/api/select` to be `select()`'s serialization and
nothing else — but memoize `select()` server-side on
`(generation, event, path, session, focus, restore, budgets)` with a one-entry-deep map. ~15 lines,
zero dependencies, and the flagship screen costs one selection instead of three.

### Staleness is never silent — there are **seven** axes, and plan 1 renders two

The spec's rule is one sentence; satisfying it is not, because "stale" means seven different things
in this product:

| # | Axis | Where the truth is | Rendered today? |
|---|---|---|---|
| 1 | SQLite index behind the Markdown | `doctor`'s `index_stale` finding | [V] yes, on the status screen (wave 3) |
| 2 | Audit projection behind its log | spec §5: catch up or say so | plan 3 |
| 3 | **Client cache behind the server** | the generation counter | **no mechanism** |
| 4 | Status-line sample age | §4b "as of last response" + age | plan 3 |
| 5 | Seen file unreadable ≠ empty | hook's audit note | **no mechanism** |
| 6 | Coverage file walk truncated | `truncated: true` | [V] yes, one line |
| 7 | `tokens` absent = "not recorded", never zero | `AuditRecord.tokens?` | plan 3 |

Seven caveats times sixteen screens is how the seventeenth forgets one — which is exactly
`02-ia.md`'s argument for a **provenance bar**, and I reach the same place from the data layer.
Concretely:

> **No resource read returns a bare value.** `ctx.read()` returns
> `{data, state: 'fresh'|'stale'|'partial'|'error', fetchedAt, reason}`, and screens `declare()`
> their qualifications to the shell, which renders them in one band. A screen physically cannot show
> a stale number without having been handed the word.

That is `INV-nothing-is-dropped-silently` expressed as a return type rather than as a habit. The
sketch implements it: press "corpus changed" and nothing auto-refreshes behind you — the bar counts
the views now behind and each names its own refresh.

### Streams and the idle timeout

- The stream is opened by subscription, closed when the last subscriber unmounts. A user who is not
  on a stream-consuming screen holds no stream, so the server idles out normally.
- The stream never resets the idle timer (§2, already in plan 1 Task 8's `kind: 'stream'`).
- **The heartbeat needs a second condition.** §2's forgotten-tab defence is
  `document.visibilityState === 'visible'`. That is true for a tab that is active in a window sitting
  on a second monitor behind nothing — a very common way to forget a tab. So the visibility gate does
  not close the case the spec says it closes. **Gate on `visible && lastInteraction < 30 min`**,
  where interaction is pointer/key/route change. It is two lines, it is testable as a pure predicate
  (`shouldPing(visibility, msSinceInteraction)`, an extension of plan 1's existing `shouldPing`
  test), and it makes the guarantee true as written.
- **Backlog is bounded and stated.** A tail that starts at position 0 on a 32 MiB log ships
  megabytes to the page. The stream opens at "last N records" and the feed says so — the same
  disclosure the coverage map already makes for truncation.

---

## Routing

### The fragment is a credential channel, not a routing channel

Plan 1 uses `location.hash` for both: the handoff nonce arrives at `#<hex>` and screens are at
`#/preview`. They coexist only by luck — [V] `extractNonce` rejects non-hex, and
`history.replaceState(null, '', location.pathname)` then wipes the fragment, so **a deep link cannot
be opened with a nonce in the same URL.** That is not a corner case; it is the only way the app is
ever opened.

**Path-based routing.** `/preview?event=tool&path=src/db/writer.ts&session=a3f9c1&focus=off`. The
static server already serves `src/ui/public` traversal-proof (Task 12); it gains one rule — any
non-`/api`, non-asset GET serves `index.html`. The fragment is then reserved exclusively for the
one-shot nonce, and the opener URL becomes `http://127.0.0.1:PORT/preview?…#<nonce>`: a deep link
*and* a credential, which is what makes `mycontext ui --at "/coverage?dir=src/db"` possible at all.

The token is in the query string of nothing, ever. The path and query are sent to the server — which
is fine, they carry no secret — and `Referrer-Policy: no-referrer` plus a fragment-only nonce keep
the credential out of every log.

### The grammar

```
/<screen>?<global params><screen params>
```

- Global sticky: `session`, `focus`. Carried across navigation by the router.
- Screen params: declared per screen, defaults omitted from the serialized URL so links stay short
  and canonical (`toUrl` in the sketch drops any value equal to its default).
- Unknown params: refused with a visible note naming them. Mirror of the server's 400.
- `pushState` for navigation and selection; `replaceState` for continuous controls (a budget slider)
  so Back does not step through 40 slider positions.

### Deep links that address a finding

| Question | Link |
|---|---|
| what did this file get in that session | `/preview?event=tool&path=src/db/writer.ts&session=a3f9c1` |
| …with no focus narrowing it | `…&focus=off` |
| why is this directory uncovered | `/coverage?dir=src/ui&item=RULE-posix-paths` |
| this doctor finding | `/doctor?code=source_drift&item=REF-roadmap` |
| this spill | `/watch?kind=spill&item=RULE-7&session=a3f9c1` |
| this rule's neighbourhood | `/graph?focus=RULE-7&radius=2` |

**This deletes an out-of-band channel plan 1 invents.** [V] `coverage.js` does
`sessionStorage.setItem('myctx-focus', id)` then navigates to `#/graph`, and `graph.js` reads and
deletes it. That hand-off is invisible in the URL, unlinkable, lost on reload, and wrong if two tabs
are open. `/graph?focus=<id>` is the same feature with none of those properties.

**The one honest cost:** the token lives in `sessionStorage`, which is per-tab, so a deep link pasted
into a *new* tab has no credential. Handle it as a first-class state, not a 401 wall: the shell
renders "this link needs a token — re-open it with `mycontext ui --at /coverage?dir=src/db`", with
the destination preserved. The link survives a server restart; only the credential does not, which is
correct.

---

## What is testable

The spec's §6 sentence — *"the view modules' pure logic is testable; the rendering is not, without a
browser dependency this project does not have"* — is true of plan 1's rendering and **false of the
rendering proposed here**, because banning `innerHTML` is what makes the required DOM surface small
enough to double. The escaping rule and the testability rule are the same rule.

**Tier 1 — source-scan invariants** (one new file, `test/ui/public-invariants.test.ts`, ~120 lines,
`node:fs` + regex, the same enforcement shape as Task 14). Highest value per line in the whole
suite, and every one of these catches a defect class that is otherwise invisible:

1. No `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`/`eval`/`new Function`/
   `setAttribute('style'|'href'|'src'|'srcdoc')`/`javascript:` under `public/`. → the XSS class.
2. No physical CSS property in `styles.css`. → the RTL class *the plan already declares and does not
   enforce*.
3. No string-table value contains `<`. → markup-in-translations.
4. `fetch(` appears only in `lib/api.js`. → a screen bypassing the token header, the cache or the
   abort signal.
5. Every `t('…')` literal in every screen exists in **both** tables. Key-set parity (Task 1) proves
   `en` and `he` agree; it does not prove a screen only names keys that exist — [V] `t()` throws at
   *render* time, so today the first proof is a Hebrew user on screen 14.
6. Every `'/api/…'` literal in the client matches a route registered by the server. → the
   cross-plan drift class (plan 3 renames an endpoint; screen 12 discovers it at runtime).
7. Every screen in `SCREENS` has a nav entry, a route schema and a `fields` export; every
   `data-f` in its template appears in `fields` and vice versa. → the "renamed a field, screen
   renders blank" class, which is the single most likely defect in template rendering.

**Tier 2 — a ~150-line DOM double** (`test/ui/dom.ts`). Not a dependency: a test double, exactly as
`test/helpers/stdio.ts` doubles a process. It implements only what the ban-list leaves reachable —
`createElement`, `createElementNS`, `append`, `replaceChildren`, `textContent`, `setAttribute` (with
`style`/`href`/`src` refused, mirroring the CSP), `classList`, `dataset`, `style.setProperty`,
`querySelectorAll('[data-f]')`, `addEventListener`/`dispatchEvent`, and `<template>` cloning over a
parsed template file. With it, `mount(root, ctx)` runs in `node --test` and screens become assertable:

```
mount(root, ctx);  await settle();
assert.equal(root.find('[data-f=spilled] tr').length, 2);
assert.equal(root.find('[data-f=title]').text, 'Injection preview');
assert.ok(notes.some(n => n.level === 'stale'));       // the staleness rule, asserted
```

Its docstring states what it does not check — layout, CSS cascade, real event ordering, print
output, actual browser behaviour — in the same register as `pin-rendering.ts` and `parity.test.ts`.

**Tier 3 — golden trees.** `serialize(node)` → stable indented text, compared to a committed
`.txt`. Catches ordering, a missing spill section, a dropped provenance note, an RTL rendering that
differs structurally from LTR (it must not). Zero dependencies; `node:test` has no snapshot
dependency needed because a golden file is just a file.

**Tier 4 — screen/endpoint contract over real HTTP.** For each screen, its declared endpoint set;
spawn the server against a real workspace (the Task 13 harness already exists) and assert every one
answers 200 with the shape the screen reads. This is the cheapest guard against the sixteen-screen
version of "plan 3 changed a response shape".

**What remains genuinely untested, and should be said in the test file:** pixel layout, focus order
and keyboard traversal, the print stylesheet, `light-dark()` resolution, and real browser event
semantics. That residue is small and honest. The current sentence — "the DOM is untested" — exempts
about 2,500 lines from coverage, and the expert review is right that a whole family of defects hides
there.

---

## Performance budget

Budgets stated as ceilings a test can assert, plus where each breaks.

| Budget | Ceiling | Where it is spent |
|---|---|---|
| First meaningful paint, this repo (43 items) | **≤ 300 ms p95, hard fail 1 s** | round trips, not bytes |
| Round trips before first paint | **≤ 3** | today: ~6, serialized |
| Any single `/api` response | **≤ 250 KB** | coverage is the offender |
| Any single `/api` handler | **≤ 150 ms** | it blocks *every* other request |
| Live DOM nodes per screen | **≤ 2,000** | tree and item list |
| Client JSON cache | **≤ 5 MB, LRU** | coverage + items |
| Stream | **≤ 20 records/s sustained, coalesced to ≤ 10 DOM updates/s, feed capped 200** | plan 3 already caps at 200 |
| Tab memory | **≤ 150 MB** | detached trees (the leak) |

### First paint

[V] The current sequence is serialized: handoff → strings module → `/api/sessions` → screen module →
`/api/coverage` → `select`+`simulate`+`render`. That is ~6 dependent round trips plus a full file
list, for a screen the spec says must render *"with no user input at all"*. Fixes, in order of
value: **(a)** one `/api/bootstrap` returning meta + sessions + focus + generation + counts;
**(b)** `<link rel="modulepreload">` for `app.js`, `lib/*` and the landing screen, so the module
graph is one parallel wave; **(c)** paint the shell chrome from the string table *before* any
network call, so first paint is not gated on HTTP at all; **(d)** the preview must stop fetching
`/api/coverage` — see below.

### A 5,000-item corpus

[M] `select()` is asserted under 10 ms at 5,000 items and the hook hit path is 20.7–22.7 ms of a
50 ms ceiling, so the *selector* is not the problem at any size the perf suite uses. The problems are
transport and DOM:

- `/api/items` at 5,000 items ≈ 1 MB of JSON [R]; `JSON.parse` alone is ~50–100 ms per MB on the main
  thread. Page the item list (`?after=&limit=200`) or make it a projection (id, title, type,
  injected) and load detail per item.
- A 5,000-row list rendered eagerly is ~15,000 DOM nodes. Virtualize, or page. `02-ia.md`'s
  "same app at 5 items and 5,000" is right about the *shape*; the default view has to change.

### A 50,000-file tree — **this is where it breaks first, and it breaks the server, not a screen**

[V] `listRepoFiles` caps at `FILE_LIMIT = 20_000` (`src/doctor/checks.ts:44`), so a 50,000-file
monorepo is already a *partial* map with `truncated: true`. That is disclosed, which is correct, but
the cost of the 20,000 it does walk is the real problem.

[M] Derived from the glob-cache measurement recorded in `2026-08-18-v2-decisions.md` §6 — 4,000
paths × 12 globs, 28.0 ms → ~2.7 ms — the cached cost is **~0.056 µs per (path, glob) test**.
`/api/coverage` tests every file against every eligible item:

| Files | Scoped items | Matches | Server time [M/R] |
|---|---|---|---|
| 20,000 | 43 (this repo) | 860 K | **~50 ms** — fine |
| 20,000 | 200 | 4 M | **~0.22 s** — noticeable |
| 20,000 | 5,000 (perf-suite corpus) | 100 M | **~5.6 s** — fatal |

`node:http` is one event loop. A 5.6-second handler does not slow the coverage map — it stalls
`/api/ping`, the heartbeat, every other screen's fetch and the idle monitor's own timer. **The
failure is server-wide and looks like a hang.**

Then the client repeats it: [V] `buildTree` allocates a node per file and `renderTree` recurses over
*every* child creating two elements each — 20,000 files ⇒ 40,000+ elements, hundreds of ms of layout
and tens of MB — and [V] `preview.js` fetches the same `/api/coverage` **only to fill a file
`<select>`**, i.e. 20,000 `<option>` elements on the landing screen.

**Fixes, cheapest first:**

1. **Prefix prefilter.** Derive each item's scope globs' literal directory prefixes once
   (`src/db/**` → `src/db/`). Group files by directory; a directory whose prefix cannot match an
   item's globs excludes all its files in one test. Typical corpora are prefix-heavy, so this is
   commonly a 10–100× cut before `matchesScope` is called at all — and it composes rather than
   reimplements, because `matchesScope` still decides every candidate.
2. **Directory-scoped endpoint.** `/api/coverage?dir=src&depth=1` prices one level. Cost becomes
   O(children × items), independent of repo size. Expansion state is in the URL (`?dir=`), so it is
   also linkable. The sketch does this.
3. **Render only what is expanded.** ≤ 500 rows at a time.
4. **Kill the preview's dependency on the file list.** A `<datalist>` fed by
   `/api/files?prefix=src/db&limit=50`, or plain text entry with validation. A file picker must never
   cost a repo walk.
5. **Per-directory truncation disclosure**, so "partial" is stated where it applies rather than once
   at the top.

### The live stream

[M] The append is ~0.55 ms p95 and flat in log size, so production is cheap; consumption is the risk.
A tool-heavy session emits a few records per second, well inside budget — provided the feed is
**append-only DOM coalesced on one `requestAnimationFrame`**, not a re-render of 200 rows per event.
The two things that actually break it are the unbounded initial backlog (bounded above) and a resync
after log rotation double-rendering records (dedupe on the record's log position, which
`audit-tail.ts` already tracks).

### Ranked: where it breaks first

1. `/api/coverage` on a large repo with a large corpus — **stalls the whole server**.
2. The 20,000-option file `<select>` on the landing screen.
3. Leaked `onSessionChange` subscriptions — N× request amplification and detached-tree memory.
4. Eager full-tree DOM in the coverage map.
5. Stream backlog on first connect.

---

## Changes to plan 1

Ordered by cost of *not* doing them before the feature set grows.

**1. [V] Apply plan 1's own §0 rows to the task bodies — and add a check that they landed.**
Two §0 corrections are recorded and unimplemented:

- *`focus`*: §0 row 4 and the verified-facts table both say `SelectContext` declares five inputs, and
  spec §9 decision 6 says `/api/select` takes every one of them. **Task 8's query grammar has no
  `focus` parameter**, its handler does not read `readFocus`, Task 17's `selectQuery(event, path,
  session, extra)` cannot serialize one, Task 16's shell has no focus control, and no screen renders
  `Selection.focus`'s disclosure. `grep -n focus plan-1` returns only graph-focus hits outside §0 and
  the facts table.
- *`seen`*: §0 row 1 says the hook reads the per-session **seen file** via
  `readSeen(root, ledgerKey(...))` + `seenIds`. **Task 8 still specifies and implements
  `seen: ledger.seen(session)`** (grammar line, test, and handler), which the same §0 row calls a
  replayed projection nothing in the UI updates.

Both are the exact defect class §0 was created to prevent, one level up: **a corrections table is a
log, not a patch.** Add to `verify-citations.ts` (or a sibling script) a check that every §0 row's
"Where" tasks contain the corrected term and **not** the superseded one — `ledger.seen` appearing in
Task 8 after §0 says it must not is a two-line grep away from being caught.

**2. [V] The landing screen.** Decision 5 fixes `route()` on `preview`. Task 16's code still reads
`(location.hash.replace(/^#\//, '') || 'status')` and `SCREENS[name] || SCREENS.status` — twice — and
`status` is Task 19, which wave 1 defers. Wave 1 as written lands on a screen that does not exist.

**3. Screen contract gains a teardown.** `mount(root, ctx) → dispose`, `ctx.effect()` files its own
unsubscribe, router disposes before mounting. Fixes the leak, the request amplification, the response
race and (for plan 3) the orphaned stream.

**4. Routing moves to the path.** Fragment reserved for the nonce; sticky global params; per-screen
param schema with unknown-param refusal; `?focus=<id>` replaces the
`sessionStorage['myctx-focus']` hand-off; `mycontext ui --at <path>` opens a deep link with a nonce.

**5. Rendering moves to `<template>` + `fields()`.** `replaceChildren()` replaces every
`innerHTML = ''`; strings become markup-free with node substitution for emphasis; dynamic visuals
become CSS custom properties via `style.setProperty`.

**6. Add `test/ui/public-invariants.test.ts`** with the seven scans, and the DOM double + golden
trees. Rewrite §6's "rendering is untestable" sentence to say precisely what is untested (layout,
focus order, print, real browser events) rather than exempting the whole DOM.

**7. Add the data layer.** `lib/api.js` as the sole `fetch` owner; `lib/resource.js` with the four
cache classes and the `{data, state, fetchedAt, reason}` envelope; `X-Myctx-Generation` on every
response; `/api/bootstrap`; server-side memoized `select()` shared by select/render/simulate.

**8. Add the provenance bar to the shell** (converging with `02-ia.md`) as the single renderer of all
seven staleness axes, with screens declaring rather than each inventing a rendering.

**9. Rework `/api/coverage`** to directory-scoped + prefix prefilter, and make the preview's file
picker prefix-queried. Add a perf test at the sizes the suite already uses
(`CORPUS_SIZE = 5000`) asserting the handler ceiling — a 5.6 s handler on a monorepo is a defect the
current plan has no test that could see.

**10. Move `myctx.stream()` from plan 3 Task 11 into plan 1's shell** as a refcounted single tail
with a connection state machine. It is a shell capability, not a Watch capability, and plans 2 and 3
should consume it rather than each inventing one. Strengthen the heartbeat predicate to
`visible && recently interacted`.

**11. Build-then-swap rendering.** `t()` throwing on a missing key is right, but a throw partway
through an imperative render leaves a half-built screen. Build into a `DocumentFragment` and
`replaceChildren(frag)` at the end, so a throw leaves the previous screen intact and the shell shows
an error state.

**Sequencing note, consistent with decision 4 (defer, never re-cut):** items 1, 2, 3, 4, 5 are edits
*inside* Tasks 8, 16, 17 and 18. They do not re-cut plan 1 and do not invalidate its re-verification.
Items 6–11 are new tasks appended after Task 19 — except item 9, which belongs in Task 11 because
that is where `/api/coverage` is specified.

---

## Headline

**Four decisions make sixteen screens affordable without a framework: the URL is the store, structure
lives in `<template>`, `textContent` is the only text sink, and every screen has a teardown — and
each one collapses a problem the current plan solves sixteen times into a mechanism it solves once.**
Plan 1 breaks in three places that are already visible in its own text: its §0 corrections for
`focus`, for `readSeen`-not-`Ledger.seen`, and decision 5's landing screen are recorded but not
applied in the tasks those rows name; its `render(root, ctx)` contract has no teardown, so a session
change fires once per screen ever visited; and its `/api/coverage` is O(files × items) in a
single-threaded server, which on a monorepo with the perf suite's 5,000-item corpus is a ~5.6-second
handler that stalls the heartbeat, the idle timer and every other screen. **The cheapest high-leverage
change is not architectural at all — it is a grep-level check that a §0 correction actually landed in
the task it names, because that is the one defect class this project keeps paying for and the one its
current machinery still cannot see.**
