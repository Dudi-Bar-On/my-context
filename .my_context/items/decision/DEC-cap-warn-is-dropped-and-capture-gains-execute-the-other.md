---
id: DEC-cap-warn-is-dropped-and-capture-gains-execute-the-other
type: decision
title: "cap.warn is dropped and Capture gains Execute; the other three keep id: null"
status: active
severity: soft
always: false
summary: Where the tool can show exactly what a command would write, it gets a run button; where the command is incomplete or the call is a person's, it gets none.
summary_of: fdea6e19c75cf74d
scope: []
tags:
  - v2
  - ui
  - execute
  - capture
  - mockup
origin: human
source_file: null
source_anchor: null
source_checksum: d8729ee710a6d8a8
valid_from: 2026-08-27
valid_until: null
checksum: dc0543693cf2df91
---

# cap.warn is dropped and Capture gains Execute; the other three keep id: null

> Ruled by the owner 2026-08-27, after the diagnosis of why Execute appeared
> unimplemented.
>
> **`cap.warn` is dropped, and Capture gains Execute once `seq:5b` lands.**
> The sentence — "This is a write. Run it in your own shell." — is drawn in the
> mockup's capture section and is therefore design of record, which is why
> `capture.js` reserved the choice for the owner rather than taking it. Once the
> confirm endpoint derives effects server-side, `add` gets a real confirm showing
> what it writes, and a sentence directing the reader to a shell is no longer
> true. Two things follow that are not optional: the mockup must be edited, since
> it is the record, and `test/ui/capture-screen.test.ts` pins both halves so the
> assertions are re-taken deliberately rather than inherited.
>
> **`packs.js`, `port.js` and `proc.js` keep `id: null`, and that is settled.**
> Each argument stands on its own, independent of whether the catalogue ever
> grows an entry:
>
> * `mycontext init` runs BEFORE a workspace exists, so there was never anything
>   for a catalogue served from a workspace to carry.
> * `mycontext export` is composed one argument short on purpose: `--out` has no
>   destination because the CLI refuses to default one, so Execute could only
>   refuse or write somewhere unchosen.
> * `procedure` omits `--yes` because `pr.w3` — "active → done stays yours" —
>   makes that prompt the human's decision, and composing `--yes` to enable a
>   button would answer it on their behalf.
>
> Recorded as settled rather than left looking like an unfinished gap, because
> the shape it would otherwise invite is the one `packs.js` names: passing the
> nearest id to obtain a button is how a different command ships behind a
> confirm that looks right.
