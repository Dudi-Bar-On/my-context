---
id: TASK-the-item-detail-pane-is-never-built-so-every-linkid-button
type: task
title: the item detail pane is never built, so every linkid button on every screen does nothing
status: active
severity: soft
always: false
summary: Clicking an item does nothing anywhere in the app, because the panel meant to show its details was never built.
summary_of: d1d79d718bd87f81
scope: []
tags:
  - "plan:port"
  - "seq:12"
  - v2
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: b9bc08cf433f0f3b
valid_from: 2026-08-23
valid_until: null
checksum: a950737a1d379b5e
plan: port
seq: "12"
state: done
---

# the item detail pane is never built, so every linkid button on every screen does nothing

> Reported by the owner on 2026-08-23, while the first parallel dispatch was
> running: clicking an item does not open the right-hand detail pane. Measured
> before filing, because an absent feature and a broken one look identical from
> the outside, and this project has already lost a day to that confusion.
>
> It is not broken. It was never built, and it is the LAST of the three surfaces
> the web-ui plan called "unowned" (plan §0.2, items 4-5). The other two have
> since landed: the provenance bar is built by the shell today
> (`src/ui/public/app.js` · `prov.className = 'prov';` · ~1560) and so is the
> footer strip. Only the pane is still missing.
>
> WHAT ALREADY EXISTS, all of it measured:
>
> - The trigger. Every id on every screen is already a `button.linkid` carrying
>   `data-id`, built for exactly this: `src/ui/public/screens/parts.js` · `so a click reaches the global item detail pane` · ~122. That file
>   deliberately does NOT wire the click, and says why — `the shell owns the
>   pane and delegates from the document, exactly as the mockup does, and a
>   second listener here would open it twice`.
> - The layout. `.app.pane-open{grid-template-columns:214px 1fr 330px;` is
>   carried into `src/ui/public/styles.css` at ~310 and held byte-identical to
>   the mockup by `styles-parity`. The third column exists and has nothing to
>   seat.
> - The data. `/api/item/:id` is already registered — `src/ui/server.ts` · `registerRoute('GET', '/api/item/:id', {` · ~304.
> - The behaviour of record. The mockup opens it with `$('#pane').hidden=false;
>   $('#app').classList.add('pane-open');` (~3347) and closes it in two places
>   (~2866, ~3355) — including one that closes it on navigation.
>
> WHAT IS MISSING is only two things: the `aside.pane#pane` markup in
> `src/ui/public/index.html`, and the document-level delegated click listener in
> `src/ui/public/app.js` that reads `event.target.closest('.linkid')?.dataset.id`
> and fills the pane from `/api/item/:id`. Nothing blocks it.
>
> ALSO CORRECT WHILE HERE: `src/ui/public/index.html`'s own header comment is now
> stale. It reads `Still genuinely unbuilt: the mockup's item detail pane
> (aside.pane#pane), provenance bar (div.prov#prov) and footer strip
> (footer.strip)` (~9-12) and names three surfaces where only one is still true.
>
> WHY THIS SEQ. It must land before `plan:port seq:98`, the screen-by-screen
> review. Every screen draws clickable ids, so a reviewer walking the rail meets
> this on the first screen and on every screen after it — twenty-one reports of
> one defect. Fixing it first removes that noise from the review. It does not
> block any screen being built, so it does not need to come earlier than that.
