---
id: LESSON-every-wrong-answer-i-gave-came-from-a-partial-measurement
type: lesson
title: Every wrong answer I gave came from a partial measurement
status: active
severity: soft
always: false
summary: Every confident wrong answer came from searching too small a place, and a half-finished search looks exactly like a complete one.
summary_of: 4f777bfbfac602f4
scope: []
tags:
  - v2
  - method
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 2dbfb54eaf5ea234
---

# Every wrong answer I gave came from a partial measurement

Every confidently wrong statement made to the owner over two days came from the same move: a partial measurement reported as a whole one. None came from faulty reasoning about correct data.

The Content Security Policy was blocking the charts. It was not. style-src governs stylesheets and the style ATTRIBUTE; it does not govern the CSSOM. Measured in the browser against the policy the server was still sending: el.style.setProperty was ALLOWED, el.setAttribute('style', ...) was BLOCKED. The nine setProperty calls in the screens had never been blocked, and screens/parts.js had chosen that path deliberately and said so in its header.

The app used no dynamic styles at all - zero occurrences. The grep had covered src/ui/public/*.js and lib/*.js and missed the screens/ directory entirely, where all nine live.

coverage.js and doctor.js used .pair, so a global rule had broken them. Those matches were the words pairing and repair.

prov and strip were rendering, so an earlier claim had been wrong. The grep had searched only index.html; they are built - or not - by the screen modules.

coverage.js built a tree of classless buttons the mockup does not have. The mockup's tree is script-built too and styles those same classless buttons through .tree button; the grep had read only the static markup. What was actually missing was eight families of CSS nobody had carried.

THE PATTERN

An incomplete search returns a confident answer in the same shape as a complete one. There is no signal in the output that says the tree was only half walked. And a wrong measurement is worse than no measurement, because it forecloses the question - the next agent reads the claim and does not re-check it.

The instrument that ended each of these was the same: widen the scope and count. find src/ui/public -name '*.js' | wc -l gave 21 files where the earlier grep had covered 8. A script that walked both pages and tallied every element by tag and class found in one pass what five screenshots had not.

The owner's instruction after the third of these was two words: do not invent facts. It is recorded as [[RULE-measure-before-you-assert-and-show-the-measurement]].
