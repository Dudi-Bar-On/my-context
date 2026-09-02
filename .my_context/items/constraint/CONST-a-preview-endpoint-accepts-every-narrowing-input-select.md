---
id: CONST-a-preview-endpoint-accepts-every-narrowing-input-select
type: constraint
title: A preview endpoint accepts every narrowing input select() consumes
status: active
severity: soft
always: false
summary: A preview must take in everything that narrows the real answer, or it is quietly answering a different question under the same name.
summary_of: 2dc11507dc46f2e8
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-18
valid_until: null
checksum: ceb3ebc1f3a03e87
---

# A preview endpoint accepts every narrowing input select() consumes

`select()` is the one selection rule and every input it consumes narrows what comes out. An endpoint taking a subset of `SelectContext`'s inputs does not preview `select()` — it previews a different question under the same name.

This was corrected once for `seen` in the web-UI spec's third pass, written as the instance ("seen is missing") rather than the class. The endpoint then shipped a design omitting `focus` as well, found as a fresh critical by the expert review. When a new narrowing input is added to `SelectContext`, every preview surface gains it in the same change.
