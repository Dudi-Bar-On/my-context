---
id: TASK-three-rulings-the-wave-surfaced-the-unbuilt-format-rung-ask
type: task
title: "three rulings the wave surfaced: the unbuilt format rung, ask's two extra kinds, and where the artefact routes belong"
status: active
severity: soft
always: false
summary: "Three decisions waiting on the owner: an option that does not exist, two small drawing differences, and where two routes belong."
summary_of: ee7f931a33e13391
scope: []
tags:
  - "plan:port"
  - "seq:14"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: ca42e547c1aa6c9d
valid_from: 2026-08-23
valid_until: null
checksum: caad6bf114a6a757
plan: port
seq: "14"
state: done
verified_on: 2026-09-05
---

# three rulings the wave surfaced: the unbuilt format rung, ask's two extra kinds, and where the artefact routes belong

> Three findings from the wave of 2026-08-23 that are rulings rather than code, all
> recorded with their measurement so the decision has evidence in front of it.
>
> THE UNBUILT FORMAT RUNG. The Export screen draws three format rungs and
> `ArtefactFormat` is `'dir' | 'zip'` — `--format` refuses anything else. The
> read model serves the third as `built: false` rather than dropping it, so the
> page cannot silently invent a format. Badge it, footnote it, or drop the row and
> lose the string: an owner call, and the one mockup error of 2026-08-23 not
> corrected because it needs a design decision rather than a fact.
>
> TWO KINDS THE ASK SCREEN DRAWS THAT THE MOCKUP DOES NOT. It writes the item cell as
> `button.linkid.m` where the mockup writes a bare `span.m`, because every screen
> this project ships writes an id as `linkId()` — the button whose click the shell
> routes to the item detail pane. The alternative is one screen whose ids are the
> only dead ones. It also adds `span.chip.index` for `subject`, the third of the
> audit projection's three roles, which the mockup gives no treatment at all.
> Confirm both, or rule the other way.
>
> WHERE THE ARTEFACT ROUTES BELONG. `/api/packs` and `/api/port` both serve
> `carries` and `artefact` — the config keys that travel and the manifest's
> meaning. They are served once, from packs. Whether the two routes should merge
> into one `/api/artefacts` is undecided; the packs model could not see the port
> model's shape because both were being written at the same moment.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, REDUCED FROM THREE RULINGS TO TWO. One of the three was answered by a general ruling the owner gave later, and nobody came back to apply it.

RULING 2 IS SETTLED: "two kinds the Ask screen draws that the mockup does not" -- button.linkid.m where the mockup writes a bare span.m, and span.chip.index for subject, the third of the audit projection s three roles. The owner ruled the general case on 2026-08-25: MORE THAN THE MOCKUP IS USUALLY RIGHT, in his own words -- "we have continued to develop after the mockup was created so this is in most times the correct one, it means we have code that implements the MORE you see". The rule is NOT symmetric: more is usually right, LESS is the gap. Both extras are more, both are argued in the screen s own header, and the alternative named here -- one screen whose ids are the only dead ones -- is worse. THE APP IS RIGHT; the mockup catches up. It joins the mockup session.

RULING 1 STANDS -- the unbuilt format rung. ArtefactFormat is dir|zip, --format refuses anything else, and the read model serves the third rung as built:false rather than dropping it so the page cannot silently invent a format. Badge it, footnote it, or drop the row and lose the string. Genuinely the owner s, and it is ALSO an entry for plan:walk seq:12 -- a served-not-drawn state is a refusal in the sense that matters.

RULING 3 STANDS -- whether /api/packs and /api/port should merge into one /api/artefacts. Both serve carries and artefact, served once from packs. The reason it was left open is recorded and is still the reason: the two models were written at the same moment and neither could see the other s shape. Somebody can see both now, so this is answerable by reading rather than by ruling.
