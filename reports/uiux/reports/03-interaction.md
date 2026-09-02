# Interaction design — the mutator-free UI

**Panel role:** interaction designer · **Date:** 2026-08-19
**Authority read:** `docs/superpowers/specs/2026-08-16-web-ui-design.md` (all 1127 lines),
`docs/superpowers/specs/2026-08-18-v2-decisions.md`, `docs/design/web-ui-mockup.{md,html}`,
`docs/superpowers/plans/2026-08-16-web-ui-2-palette-and-work.md` (Tasks 4, 9, 10, 11, 12).
**Sketch:** `…/scratchpad/uiux/sketches/03-interaction.html` — open it; the three *Simulate*
buttons in the header drive the whole lifecycle.

Provenance marks, in this project's own convention: **[V]** verified against the file cited,
**[R]** reasoned/proposed, **[?]** needs verification against code before it is relied on.

---

## Compose-and-copy, designed

### The diagnosis

Compose-and-copy feels like a workaround for one reason, and it is not the writing. It is that
**the interaction ends at the copy button.** `writeBlock` today is:

```js
// plan 2, Task 11, ~2278
copy.onclick = () => navigator.clipboard.writeText(command);   // [V]
```

A `<code>`, a button, a note. The user copies, leaves, pastes, comes back — and the UI has no
idea any of that happened. It is a vending machine for strings. Every UI that feels like
*control* has the same three parts, and this one has only the middle:

| | | present today |
|---|---|---|
| **before** | you see what it will do | only in Configure, and only for two keys |
| **during** | you commit the act | the copy button ✓ |
| **after** | you get a receipt | **nothing** |

Fix the two missing thirds and compose-and-copy stops being a compromise, because in this
product **the composed path can show you more than running the command would.** The CLI prints
what it did *after* it did it. The UI can show what it *will* do, exactly, using the same pure
functions, *before* — and that is a capability the terminal does not have. That is the whole
argument, and it is winnable.

### The unit of design: a composed command is an object with a lifecycle

Stop treating the command as a string. Every composed write is an object carrying five fields:

| Field | What it is | Where it comes from |
|---|---|---|
| **subject** | the item / revision / config key / set it acts on | the pickers, rendered as objects with links, not tokens in a string |
| **precondition** | what must be true for this command to be valid | snapshot of the read model at compose time |
| **effect** | the exact predicted change | the counterfactual endpoint, below |
| **argv** | the command | `commandFor` + `composeCommand` [V] |
| **landing predicate** | how the UI will recognise that it happened | declared on the command def |

And six states:

```
 ready ──copy──▶ armed ─────corpus shows the predicted change────▶ landed
   │               │
   │               ├──corpus moved, but not that way──▶ diverged
   │               └──cannot observe (server gone)────▶ not seen
   └──precondition broke before paste──▶ stale
```

Five of these six are states the current design has no rendering for. `stale` and `diverged`
are the ones that matter most, because they are the states where **the string in the user's
clipboard is now wrong** and `--yes` is on it.

### Before: the effect preview, and one mechanism for all of them

Spec §4 already requires this for Configure ("shown as a diff of the governing set, not as a
warning"). Generalise it. **Every write's preview is the answer to "what would `select()` /
`matchesScope` / `injection()` say afterwards", computed by running them over a candidate
corpus built in memory.** [R]

| Command | Preview | Function composed |
|---|---|---|
| `supersede` | **the coverage hole**: "after this, `src/cache/keys.ts` is governed by nothing" | `matchesScope` + `injection()` over items-minus-one |
| `review promote-revision` | the delivered/spilled diff on the file you were just previewing | `select()` run twice, once with the revision applied |
| `pin` / `harden` | tier move, and what starts spilling | `select()` per tier |
| `add --scope …` | files gained, and how many were governed by nothing before | `matchesScope` |
| config change | the §4 diff, unchanged | `scopePolicyFor`, `agentEditsFor`, `select()` |

**This is one endpoint, not five.** `POST /api/preview` with a **closed set of change kinds**
(`config-set`, `revision-apply`, `item-exclude`, `item-add`, `budget-set`), each with typed
fields validated against the same enums `resolveConfig` uses. Never a free-form item patch —
same reasoning that removed SQL from Ask in §2: no attacker-controlled token reaches a rule
engine. It touches no mutator symbol, so the §6 import-graph test still passes. [R]

**One honest caveat.** Applying a staged revision to an item is `revision.ts` logic, and §3's
rule is "an endpoint may compose existing functions, it may not reimplement a rule." The
preview needs `applyRevisionFields(item, revision): Item` extracted as a pure function from
`promoteRevision`'s body and imported by the read model — the same extraction pattern plan 2
already uses for `revision-log.ts` and `revision-diff.ts`. Without that extraction, this
preview re-derives a rule and should not be built. [R] [?]

### After: the audit record is the receipt

The acknowledgement channel already exists and is *better* than a button press. Every mutation
appends an `AuditRecord` carrying `op`, `origin`, `itemId`, `fields`, `at` [V, spec §5]. A
button press proves the UI thinks it worked. **An audit record with `origin: 'human'` proves
the corpus recorded it, and proves it was your shell rather than an agent** — which is
precisely the distinction §2 built the whole no-writes rule around. The receipt is not a
consolation prize; it is stronger evidence than an in-UI write could produce.

**Wave 3 (with the stream):** an armed card subscribes; a matching mutation record flips it to
`landed`, showing the record's own timestamp, `op` and origin.

**Wave 2 has no stream** — Decision 4 states that divergence explicitly [V]. So wave 2 needs a
poll, and the right trigger is already in the page:

> **The user returning to the tab *is* the "did it work?" gesture.**

The page already heartbeats `GET /api/ping` only while visible [V, plan 1 Task 16]. Add a
`visibilitychange` ping and **one field to the response**: a cheap corpus fingerprint. If it
moved, each armed card re-fetches only its own read model and evaluates its predicate. Cost:
one field on an endpoint that returns `{ ok: true }` today [V]. No new endpoint, no polling
loop, no daemon, and it does not disturb §2's idle rules (a ping is already non-stream
activity, already visibility-gated).

Fingerprint candidates, cheapest first — [?] all of these need a measurement before being
chosen: `stat` mtime of `.my_context/items` + `config.json`; item count + max item mtime; in
wave 3, `max(rowid)` over the projection's mutation rows. Injections also append to the audit
log, so a log-length fingerprint would be noisy — noisy in the safe direction (a spurious
re-check finds nothing), but it costs a round trip per tool call, so prefer a mutation-scoped
signal.

**A "check now" affordance stays**, because the fingerprint can miss, and because a state we
cannot observe must be disclosed as unobserved. The card says **"not seen yet"**, never "not
run". That is `INV-nothing-is-dropped-silently` applied to feedback.

### The next refresh: a resolution event, not a loss event

Armed commands live in `sessionStorage` beside the token — same lifetime, dies with the tab,
never `localStorage` [R, following §2's own reasoning about the token]. What persists: argv,
subject ids, the predicate descriptor, the compose-time snapshot, a local sequence number.
**Not the rendered preview** — re-derive it; a cached preview is a stale claim.

So `F5` re-hydrates the tray and immediately re-evaluates every predicate. A refresh *resolves*
pending work rather than losing it. If the pattern loses your queue on a reload, it will feel
like a workaround no matter what else you do.

### Two defects found while designing this

**1. `quoteArg` does not neutralise what it appears to neutralise.** [V, plan 2 Task 9]

```js
const SAFE = /^[A-Za-z0-9@%_+=:,.\/\-]+$/;
return `"${value.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`;
```

`$` and `` ` `` are outside `SAFE`, so a value containing them is **double-quoted** — and in a
POSIX shell `"$(echo PWNED)"` *still substitutes*. Decision 6.1 demonstrated exactly this id
reaching a copy-paste-ready command on `1.0.1` [V]. Decision 7 fixes it at the load boundary in
`1.0.2`, which is right — and the UI is the **last surface before the user's shell**, so it
should re-check rather than assume. Interaction answer: render argv **per argument as chips**,
mark any chip that needed quoting, and **block the copy entirely** for a chip whose value
survives double-quoting live, naming the file the id came from. Demonstrated in the sketch
(pick `DEC-$(echo SUBSTITUTED)` from the item picker).

**2. The copy button announces success it has not observed.** [V] Plan 2 Task 11 does not
`await` or `.catch` the clipboard promise; the mockup swaps the label to "Copied" unconditionally
(`web-ui-mockup.html` ~679). A rejected `writeText` leaves the user pasting whatever was there
before. Required: swap the label **in the `then`**, and on rejection select the text and render
"press Ctrl+C". This is the one place in the product where a silent failure puts the wrong
command in a shell.

---

## The command builder

Three zones, left-to-right in logical order, and every affordance in the app that says
"compose…" is a deep link *into* this builder rather than a fifteenth composition site.
(Decision 7 found composition in the CLI is "roughly fifteen sites, none behind a common
funnel" [V]. Applying that lesson to the UI before it happens is free; after is not.)

Resolution of the obvious tension: the *card* renders inline next to the diff on Work and
Configure — a diff and its command must stay together — but it is produced by **one shared
component with one composition path**, and "open in builder" is always available. One composer,
many mount points.

### Zone 1 — the verb

Not a search box pretending to be a command line. A **catalogue** of the ~20 `PALETTE` defs,
**grouped by what they do to the corpus** — Capture / Change / Retire / Review / Configure /
Read — each row carrying a one-line gloss and a `WRITE` or `READ` badge. Type-to-filter over
name and gloss.

**Reads and writes must never render as the same object.** A read runs here; a write leaves for
your shell. If they look alike, the central product decision is invisible, and the user learns
the wrong model of what this UI is.

### Zone 2 — the subject

Real pickers, per §4:

- **items**: searchable, showing `id — title` **plus tier and scope**, because people pick by
  "the rule about emails", not by id.
- **categories**: from resolved config; disabled categories shown disabled **with the reason**.
- **flags grouped by what they mean** — identity (title, body), governing (scope, always,
  severity), bookkeeping (tags, note), execution (`--yes`) — not one flat list of twelve.
- **"blank means unchanged" is printed on every optional flag.** `mycontext edit` leaves an
  omitted field alone; a user who types nothing into `body` must know they have not just
  erased it. That sentence prevents a real data-loss fear that will otherwise stop people
  using the builder at all.

### The glob tester — two answers, rendered as two answers

This is where the UI can recreate the product's most expensive recorded defect, so it gets a
rule of its own:

1. **"which files does this pattern catch"** — `matchesAnyGlob` over `listRepoFiles`, via
   `/api/glob`. Count, sample, and the tree with matched nodes highlighted **live as you type**.
2. **"what would this item govern"** — `matchesScope` + `injection()`. A *different* number,
   because an unscoped item matches every path under the default `scopePolicy` and no path
   under `inert`.

`select.ts` documents by name that `query_items` collapsed these two and "kept hiding unscoped
items from a path query long after they had become injectable on that path" [V, spec §3]. **A
tester that renders one number implies they are one question and teaches the defect.** Render
them in two visually separated halves, each labelled with the function that answers it. The
sketch does this.

**Direct manipulation both ways:** click a directory in the tree to *append* `that/dir/**` to
the pattern. Typing and pointing edit the same value. Building a scope by pointing is the
single most useful thing this screen can offer someone who does not know glob syntax.

**Zero matches is a warning, not a block.** A scope for files not yet written is legitimate.
Spec's own sentence: "an item scoped to it would govern nothing."

### Zone 3 — the command and its consequence

Two panes, never one.

**The argv, as chips.** `mycontext` `supersede` `RULE-a` `--by` `RULE-b`. Hover a chip → which
input produced it. Dashed border → this value required quoting. Red and copy-blocked → this
value is not safe to paste (above). A wall of monospace hides a `$(…)`; chips do not.

**The consequence pane**, carrying the effect preview *and* the landing predicate written out
in English:

> *"I will know this worked when `REV-8c21` leaves the pending list **and** the item body
> matches the proposal — both, because either alone can be true for the wrong reason."*

**Writing the predicate down before the copy is what makes the later acknowledgement
trustworthy.** The user agreed in advance to what the UI will accept as proof; the UI is not
asserting success after the fact on criteria the user never saw.

### `--yes` becomes a decision, not a default

§2 is explicit that `--yes` is not a security boundary — what it buys is *legibility*, "an
explicit, greppable token in the transcript" [V]. Today the mockup and plan 2 bake it in. Rule:

> **`--yes` defaults on only where the UI has already rendered the confirmation the CLI would
> print.**

So: on in the review queue (the diff *is* the confirmation) and in Configure (the governing
diff is). Off by default in the free-form builder for `add`, `edit`, `supersede`, where the CLI's
own prompt is the last honest checkpoint. Shown as a visible toggle either way, with the
transcript sentence attached. [R]

### Deep-linkable

`#/palette?cmd=supersede&id=RULE-a&by=RULE-b`. Every builder state is a URL, so "compose this"
from the coverage map, doctor, decay or the review queue is a navigation, and a composition can
be bookmarked or pasted to a colleague.

---

## Preview interactions

The trust problem, stated exactly: **a preview that updates instantly is indistinguishable from
a UI that already changed something.** In a product whose entire promise is that it never
writes, that ambiguity is fatal. Five rules.

**1. Proposed values have their own visual register, used nowhere else.** `6000 → 8000`, with
the old value struck and the new one in the gold field. The mockup already does this once
(`cfg.budgets`); formalise it as two tokens, `.was` / `.will`, and forbid a preview from ever
rendering as a plain replaced value. **Test of the whole design: pick any number on any screen
at random — can you tell whether it is real?** If not, the pattern has failed.

**2. The chrome always says you have unapplied changes.** The tray count is in the shell and
visible on every screen. There is no moment where a preview is showing and the app looks normal.

**3. Responsive and truthful at the same time — the settling state.** Local optimistic geometry,
server-exact numbers, and *the difference is visible*:

- dragging a budget: the bar geometry moves every frame from a local approximation; the numbers
  and the item list carry a `computing` treatment until `/api/preview` returns, then snap to
  exact and the marker clears (a small solid dot = exact).
- debounce 120 ms on drag-idle, 250 ms on typing (plan 2 already uses 250 [V]).
- **Rule: never show an approximate number without marking it approximate, and never mark the
  exact one.** A three-frame settle reads as careful. An instant wrong number reads as broken
  once the user notices, and they will.

**4. The budget simulator can be exact *and* instant, if one property holds.** [?] If `select()`
admits greedily in a fixed order per tier, then for a given corpus and context the *ranking*
never changes as you drag — only the cut line does. Render the ranked list once, animate a cut
line through it at 60 fps, and the preview is both frame-perfect and exact with zero round
trips. **Verify the prefix property against `select()` before relying on it**; if admission is
not a pure prefix of a stable order, fall back to server-exact with the settling state above.
This is worth the ten minutes it takes to check, because it turns the flagship "drag it, watch
what fits" screen from good into the best thing in the product.

**5. Reverting is one gesture, always adjacent, and `Esc` does it.** The corpus has no undo, so
the preview must have a perfect one — otherwise nobody drags anything. And: **a change that
cannot be reversed must not be rendered as a toggle.** `supersede` is one-way; `type` is fixed
at creation [V, spec §4]. Those get a button and a consequence, never a switch. A switch is a
promise that flipping it back costs nothing.

---

## Keyboard

**[V] There is no keyboard model anywhere.** `grep -rn "keydown|keyboard|shortcut|accesskey"`
over all three plans and the spec returns nothing. The old mockup advertised ⌘K with nothing
behind it; the regenerated mockup (2026-08-19) deleted it and the search box rather than
restyling them — correctly, and it deleted the last keyboard affordance in the process.

### Against a ⌘K omnibox

Three reasons, and they are the product's own:

1. **The spec commits to no global search.** A ⌘K that fuzzy-matches "everything" needs a
   corpus-wide index and a ranking function — a feature this product deliberately does not
   have, and the mockup's own notes call the old one decoration [V].
2. **`/api/search` is a wave-2 palette *read* with required filters** (`anyFilterSet` [V]) — it
   refuses an unfiltered query by design. An omnibox is the wrong shape for an endpoint that
   insists on structure.
3. In read-mostly tools, ⌘K almost always duplicates navigation that is already one click away.

### For a real, small model

The loop this product runs on is **compose → copy → alt-tab → paste → alt-tab**. That loop is
keyboard-shaped by nature, and a user who must reach for the mouse to copy each of five
commands will abandon the pattern. So: a **verb-first, screen-scoped** model — nine bindings,
no modifiers except one, all suppressed while a text field has focus, all discoverable from one
sheet.

| Key | Does |
|---|---|
| `?` | the shortcut sheet — the single discovery surface |
| `n` | new composition; focuses the verb list (the honest ⌘K: a *composer*, not a search) |
| `c` | copy the focused card's command |
| `Shift`+`C` | copy the whole tray as one block |
| `x` | toggle selection on the focused row |
| `a` | select all **in view** (and the count says so) |
| `r` | re-check every waiting command |
| `g` then `p`/`c`/`w`/`s` | go to preview / coverage / work / simulate |
| `Esc` | close · revert the focused preview · clear the selection — in that order |

No `j`/`k`: rows use arrows plus roving `tabindex`, so there is one navigation grammar rather
than two.

### Four things the keyboard model must carry that nothing currently specifies

- **One table, two consumers.** The binding map generates both the handlers and the `?` sheet,
  so the sheet cannot drift from the app — same shape as the string-table parity test, and it
  should get the same kind of test. CSP forbids inline handlers, so this is one `keydown`
  listener over a declarative map anyway.
- **Arrows resolve against `document.dir`.** In RTL, `ArrowRight` moves *back* in a horizontal
  list. Hardcoding `ArrowRight = next` is the keyboard's version of `margin-left` — and §3 makes
  a physical property a defect. State it in the same sentence, or it will be retrofitted at the
  same cost.
- **Live regions, which are absent everywhere.** [V] no `aria-live` or `role="status"` in any
  plan. Every state change the user did not directly cause — a card landing, the fingerprint
  moving, the server exiting — is announced through one polite live region. **Copy announces
  through it too**, because a swapped button label is announced to nobody.
- **Focus management on the exit banner**: `role="alert"`, and focus moves to it.

---

## States and feedback

Six global states; five have no rendering today.

**1. Server exited.** §2 has the banner and the no-auto-reconnect rule [V]. The consequence for
*this* pattern is not in the spec: **an armed card cannot resolve while the server is gone.** It
must render **"cannot check — the server is not running"**, never "not seen yet", because a
pending state whose observer is dead must not present as a negative observation. And the
reassurance that has to be said out loud: **the tray survives and every command stays
copyable** — they are just text, and your shell does not need the server. The UI dying must not
strand the user's work.

**2. Token rejected / a new server minted a new token.** §2 has the sentence. The tray survives
a reconnect (it holds no secret and the corpus is the same directory) and is re-evaluated
against the new server.

**3. Stale projection** (wave 3). §5 requires it to catch up or say so [V]. Interaction
consequence: the projection **records its position**, so "behind" is a *known count*. Therefore
**a spinner is forbidden here** — render "catching up, 412 records behind" as a determinate
progress bar. A spinner where a count exists throws away information the system already has.

**4. Unreadable seen file.** §3 and Decision 7 make this a disclosed state [V]. Design
consequence nobody has drawn yet: the injection preview needs a **third** provenance label
beside "this session" and "cold session" — **"dedupe unavailable"** — and the delivered set must
be marked as not-the-live-one. Two labels is one short.

**5. Empty corpus.** Spec-required, not polish [V]. Note that the empty state's one next step
*is a composed command* — so the empty state is the first appearance of this entire pattern, to
the newest possible user. It must be the best rendering of compose-and-copy in the product, not
an afterthought.

**6. Copy failed.** Covered above. The one place a silent failure puts the wrong text in a shell.

### Three cross-cutting rules

- **Any response field named `truncated` has a required rendering.** `/api/glob`'s
  `fileWalkTruncated`, `/api/search`'s `truncated`, the ego-graph's "+N more" [V, all three
  exist in the plans]. `INV-nothing-is-dropped-silently` is a UI rule as much as a core one — a
  truncation flag that is returned and not drawn is the same defect one layer up.
- **An error names the surface, the cause, and the one next action.** Three parts, always.
  `ctx.api` currently throws a bare string into a `common.error` template [V].
- **A 400 from a structured request highlights the control that caused it**, never a banner.
  The Ask screen and Configure's validation both depend on this to feel like editing rather
  than submitting.

---

## Bulk actions

Take the brief's own example: supersede five stale items at once, as one composed command.

**It cannot be one command, and the design must say so rather than invent a flag.**
`mycontext supersede` takes `id` and `--by`; there is no batch form [V, plan 2 Task 10's def].
Plan 2 already states the rule — "a def must never advertise a flag its command refuses" — and
bulk is exactly where that rule gets broken first. So five items is **five commands, one
paste**, and the design earns its keep in the two places the terminal cannot follow.

**Selection.** A first-class mode on any list: review queue, drafts, coverage gaps, decay,
search results. Checkbox column appears on first selection; `x` toggles; `Shift`+click ranges;
`a` selects all **in view** — with the count spelled out: *"12 of 43 selected · 43 in view · 118
in the corpus."* A "select all" that silently means "all currently loaded" is the same class of
lie as a truncated list.

**Fan-out mode in the builder.** One verb, N subjects, one shared set of flags. The preview is a
**table of N rows, each with its own precondition status** — because some of the five will fail:
already superseded, is a draft, is pinned. Excluded rows are shown, struck, **with the reason,
and counted**:

> *5 selected · 3 composable · 2 excluded (1 already retired, 1 is a draft)*

**The exclusions are the value.** Handing someone a block of five commands two of which will
error is worse than the terminal. Catching them before the paste is better than a shell `for`
loop, which finds out one at a time and leaves you to reconstruct which failed.

**One counterfactual for the whole set.** The coverage diff of removing all five *together* —
*"after these five, `src/workers/**` is governed by nothing"* — computed once over the candidate
corpus. Five separate previews composed by eye is exactly the arithmetic the user came here to
avoid.

**The clipboard payload.**

- **Newline-separated. Never `&&`, never `;`.** With `&&`, one failure silently stops the rest;
  with `;`, failures scroll past. Newlines also keep each line an independent command string,
  which is what the fourteen Bash deny rules match on [V, §2]. Chaining would quietly weaken the
  protection this whole design exists to preserve.
- **Commands only** — no comment lines, no headers. Annotation lives on screen.
- **Deterministically ordered**, so `supersede … --by` pairs reference items that already exist,
  and the builder says why it ordered them that way.
- Over ~20 lines, warn.

**Per-command landing.** The tray resolves each line independently: *"3 of 5 landed"*, naming
the two that did not and why. **This is the moment bulk-via-clipboard becomes better than
bulk-via-CLI**, and it is the strongest single argument that the mutator-free decision is a gain
rather than a tax.

---

## Also found, worth ten minutes from someone

- **`docs/design/web-ui-mockup.md` is stale against its own `.html`.** The `.html` was
  regenerated 2026-08-19 and its header comment says so; it removed the search box, the ⌘K hint
  and the toast system, added the session and focus popovers, the exit banner, the three context
  states and the Hebrew table. The `.md` still describes all of those as present or missing in
  the old configuration — including "The global search box is decoration" and "no keyboard
  navigation beyond focus rings" [V, both files]. A divergence list that has itself diverged is
  this document's own §0 failure mode, one file over. Decision 8 step 4 covers regenerating the
  mockup; it should say "and its `.md`".

---

## Headline

Compose-and-copy is not a degraded write path — it is a write path with a preview and a receipt,
and the CLI has neither. Make the copy button the middle of the interaction rather than the end:
show the exact consequence before, computed by the real selector over a candidate corpus, and
recognise the audit record that proves it landed after. Then the clipboard stops being a
workaround and becomes the transaction boundary the user is deliberately driving.
