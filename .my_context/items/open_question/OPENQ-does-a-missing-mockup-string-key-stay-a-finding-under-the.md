---
id: OPENQ-does-a-missing-mockup-string-key-stay-a-finding-under-the
type: open_question
title: does a missing mockup string key stay a finding under the core-difference rule
status: active
severity: soft
always: false
summary: Nobody has decided whether a label the design drew but the app never shows should still be reported, now that only important differences count.
summary_of: df3e3cf839a5d3db
scope: []
tags:
  - v2
  - ui
  - mockup
  - gates
  - testing
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: 453d6fbb061487fe
---

# does a missing mockup string key stay a finding under the core-difference rule

The owner's ruling of 2026-09-11 narrows a mockup-versus-app difference to what is "important, like core functionality or similar". Three of the four axes could be DERIVED from rulings this corpus already carries -- direction, kind of thing, and the spacing/colour/weight/count exclusions. WORDING could not, and this is the one question a gate should not settle on its own.

WHAT ARGUES EACH WAY, and both are this project's own record rather than a hypothetical.

AGAINST reporting it. It is prose. The ruling says the app having done things differently is ok, and wording is the easiest thing to have done differently for a good reason. Nothing in either surface compares a mockup SENTENCE against an app sentence today, and nothing ever has.

FOR reporting it. The surviving half of `RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done` was written off a WORDING defect and nothing else: the audit stream rendered one generic op-itemId-note-path cell for four record kinds where the mockup composes a different sentence for each. Every element was the same `bdi` and `span.m`, `e2e/screen-parity.spec.ts` was green, and the OWNER found it by looking at the two screens side by side. `test/ui/strings-parity.test.ts` keeps the mockup-declares-a-sentence-the-app-lacks direction for exactly that reason and names the failure it is guarding: "quietly rendering a weaker version".

WHAT IS IN FORCE UNTIL THIS IS ANSWERED, so nothing is ambiguous meanwhile. A MISSING STRING KEY is still a finding: `strings-parity`'s gap direction still fails, because a key the app never places is usually a missing LABEL on a missing THING rather than a rephrasing, which puts it under the "control or field" limb rather than under prose. A DIFFERENT SENTENCE under the same key is not a finding and never was.

THE THREE ANSWERS AVAILABLE.

  A. KEEP IT AS IT IS. A missing key fails; different prose does not. Costs nothing today -- `strings-parity` is green -- and keeps the one gate that has ever caught this class.
  B. NARROW IT. A missing key fails only where the key belongs to a control or a field, and a key that only labels a paragraph does not. Truer to the ruling; costs a per-key classification nobody maintains today, which is how ledgers rot.
  C. DROP IT. Wording stops being a finding in either form. Cheapest, and it retires the only mechanical guard against the exact defect that produced the rule. If this is chosen, the protection lost must be named in the item that chooses it -- `DEC-the-frozen-mockup-unpins-the-css-coupling-styles-parity` set that bar.

The recommendation is A. It is already green, it costs nothing, and the one time this class of defect shipped it took the owner's own eyes to find it -- which is an argument for keeping the cheap mechanical half, not for dropping it.

## Relations
- derived_from [[DEC-the-mockup-is-a-reference-to-initial-thoughts-and-only-a]]
