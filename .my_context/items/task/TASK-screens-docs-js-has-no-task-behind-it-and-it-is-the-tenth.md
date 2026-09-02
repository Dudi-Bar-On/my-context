---
id: TASK-screens-docs-js-has-no-task-behind-it-and-it-is-the-tenth
type: task
title: screens/docs.js has no task behind it, and it is the tenth unbuilt screen
status: active
severity: soft
always: false
summary: The documentation screen is offered in the menu and everything it needs already exists, but nobody was ever asked to build it.
summary_of: 244efc9e9ab66ea3
scope: []
tags:
  - "plan:port"
  - "seq:5b"
  - v2
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: cbdb016da91efc90
valid_from: 2026-08-23
valid_until: null
checksum: 48dc4b6a236a5215
plan: port
seq: 5b
state: done
---

# screens/docs.js has no task behind it, and it is the tenth unbuilt screen

> The rail lists twenty-one screens and `docs` is one of them, but unlike its ten
> unbuilt siblings it has no task behind it at all — `port seq:4` covers
> `screens/capture.js`, `port seq:5` covers `screens/tut.js`, `port seq:7` and
> `seq:8` cover Procedures and Template packs, and the four ui2/ui3 tasks cover
> ask, work, palette and config. Measured on 2026-08-23 while selecting the
> independent tasks for the first parallel dispatch: nine of the ten unbuilt
> screens had an owner and `docs` had none.
>
> Everything it needs already exists. The endpoint is `/api/help/:topic`, the
> same one `tut` reads. Both string tables already carry its nine keys under the
> `doc.` prefix — `doc.h`, `doc.v`, `doc.sub`, `doc.d1`, `doc.d2`, `doc.d3` and
> three more — because `strings-parity` holds the app's key set equal to the
> mockup's `data-t` set in both directions, so the keys landed with the mockup.
> The one CSS family it needed, the rendered-markdown `.md` block, was carried
> into `styles.css` on 2026-08-23 ahead of the dispatch and is held byte-identical
> to the mockup by `styles-parity`.
>
> So this is pure UI work: build `src/ui/public/screens/docs.js` against the
> mockup's own `docs` section, 1:1 with the design of record, and register it in
> `SCREENS`. It counts toward `port seq:98`, which cannot run until all twenty-one
> screens exist.
