---
id: TASK-the-mockup-s-hebrew-contradicts-its-english-in-two-places
type: task
title: the mockup's Hebrew contradicts its English in two places, and abridges it in two more
status: active
severity: soft
always: false
summary: Two translated sentences say the opposite of their English, and two more leave parts of it out.
summary_of: a0c88c5bb83acdcf
scope: []
tags:
  - v2
  - ui
  - walk
  - i18n
  - "plan:walk"
  - "seq:63"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 5485a52e1be82f82
plan: walk
seq: "63"
state: todo
priority: "1"
needs: walk/37
source: owner ruled, 2026-08-28
---

# the mockup's Hebrew contradicts its English in two places, and abridges it in two more

> Two Hebrew decisions the owner made 2026-08-28, both surfaced by `plan:walk seq:1h`'s emphasis pass and neither an emphasis problem. **The owner ruled: fix both, and accept without a review pass** — *"1 and accept it by yourself i see that you do it well"* for the contradictions, and "extend the Hebrew" for the gaps.
>
> **1. Two mockup strings whose Hebrew contradicts their own English**
>
> * `port.sub` — EN *"Built, and this screen reports it."*; HE still says `הוחלט, טרם נבנה` — *decided, not yet built*. The two sentences assert opposite things about the same screen.
> * `pk.trustn`, first run — EN *"Both routes land the same way, and it is draft"*; HE still carries the superseded claim that choosing a pack at init is itself the act of trust.
>
> `seq:1h` left both unmarked and said why: marking them would have put emphasis on a sentence asserting the opposite of the English. It was right to stop — rewording a translation was not its brief.
>
> **Before rewriting, confirm which side is stale.** `port.sub`'s English asserts the port screen is built and reporting. If that is not true of the app today, the HEBREW is right and the ENGLISH overstates the product — which would be a correctness finding in the design of record, not a translation fix. Measure it; do not assume the newer text wins.
>
> **MEASURED 2026-08-28, and it demotes half of this task**
>
> The owner ruled the same day: *"about the english, i allow you to fix and change as you understand, the mockup is just a demo what matters is the app itsef, just let me know, that's it."*
>
> So the question became: are the contradictions in the APP, or only in the demo? Measured per key against `src/ui/public/strings/{en,he}.js` and the mockup's Hebrew table:
>
>     port.sub    app en  "Built, and this screen reports it."
>                 app he  {b:נבנה, והמסך הזה מדווח על כך.}      CORRECT, and marked
>                 mockup  הוחלט, טרם נבנה                        STALE
>
>     pk.trustn   app he  {b:שני המסלולים נוחתים באותו אופן, והוא טיוטה}  CORRECT, and marked
>                 mockup  בחירת חבילה ב-init היא עצמה מעשה האמון          SUPERSEDED
>
> **Both contradictions exist only in the mockup. The shipped app is right in both languages, and always was.** `plan:walk seq:1h` reported them as "mockup only" and that is confirmed.
>
> So part 1 below is COSMETIC — no user of the product sees a wrong sentence — and it drops behind part 2, which is in the shipped tables and is what a reader actually meets. Fix it when the mockup is next open for another reason rather than opening it for this.
>
> **2. Two keys whose Hebrew is missing the content the English emphasises**
>
> * `cfg.nocmd` — the English italicises the deny hook's verbatim quotation. The Hebrew says *"…כך אומר הוו על `.my_context/config.json` במילים האלה."* — "in those words" — and then never gives them. A Hebrew reader is promised a quotation and shown none.
> * `dv.mdnote` — the English bolds *"refused and shown as refusals"*. The Hebrew ends at "no HTML string is created"; the entire clause about raw HTML, images and unknown URL schemes is absent. A Hebrew reader is not told that unknown schemes are refused rather than silently dropped, which is a security-relevant property of the renderer.
>
> These are translation gaps that the emphasis pass merely exposed. Extend the Hebrew so it says what the English says, then mark the emphasis — taking the key count from 61 of 63 to 63 of 63.
>
> **Bounds**
>
> * **Both string tables AND the mockup**, which is the design of record. `e2e/bidi.spec.ts` counts `.m`/`.v` runs per key and requires EN and HE to agree — `{b:}`/`{i:}` are not counted, but any identifier or number-bearing run added to the Hebrew needs `{m:…}`. That trap has been hit three times in one day.
> * The mockup's slot parser was rewritten by `seq:1h` to scan five markers with nesting (`{m:}`, `{mv:}`, `{v:}` keep the old first-`}` rule; `{b:}` and `{i:}` scan for the matching brace and recurse). Read it before adding markup — it is new and its shape is deliberate.
> * `strings-parity` compares key SETS and cannot see any of this, which is why it was invisible until a person read both languages.
>
> **Also open, and a smaller question the same pass raised**
>
> `seq:1h` found two keys the MOCKUP emphasises where `en.js` does not: `preview.whyn` (`<b>order is the explanation</b>`, `<i>not reached</i>`) and `work.diffn` (`<b>word-level</b>`). It marked their Hebrew in the mockup for internal consistency but deliberately did not add the emphasis to the shipped English tables — the owner pre-approved Hebrew placements, not new English emphasis. Two keys, three runs. Decide and say which way.
>
> **Done when**
>
> Both contradictions are resolved in whichever direction the measurement supports, with the reasoning recorded; `cfg.nocmd` and `dv.mdnote` carry in Hebrew what they carry in English, with the emphasis then marked; the mockup and both tables agree; `bidi.spec.ts` and `strings-parity` stay green; and the `preview.whyn` / `work.diffn` question is answered rather than left.
