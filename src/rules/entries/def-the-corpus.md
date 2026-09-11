---
id: def-the-corpus
kind: definition
tier: developer
title: the corpus is the Markdown under .my_context/items, and it is the source of truth
term: the corpus
means: this project’s knowledge as Markdown files under `.my_context/items/**` — one file per item, frontmatter plus body. The FILES are the source of truth; the SQLite index beside them is derived, and can be thrown away and rebuilt from disk without losing anything.
confusedWith: "the index, and this store. Losing the index costs time and never knowledge. And the product rule store is NOT a corpus category: `doctor`, `list`, `ready`, the tier budgets, decay, supersede and the injection selector each return nothing from it, and the corpus has never heard of it — which is why none of them needs an exception."
example: INV-markdown-is-the-source-of-truth, and 1,085 item files in this workspace on 2026-09-11.
check: "preventive:test/rules/isolation.test.ts asserts that doctor, list, ready and the injection selector each return nothing from src/rules/entries/, one assertion per surface so a leak names the surface that leaked."
---

Said in one sentence, because a reader who has the sentence wrong reads every surface wrong: the
corpus is a directory of Markdown you can open in an editor, and every screen this product has is
a view over it.

"The corpus" also carries a warning here. A command run from the wrong directory answers about a
DIFFERENT corpus, and an unknown-category error is the shape that mistake takes —
`RULE-read-an-unknown-category-error-as-a-possible-wrong-corpus`.
