---
id: an-unknown-category-means-a-possible-wrong-corpus
kind: fact
tier: product
title: an unknown-category error may mean the wrong corpus, not a misspelled flag
truth: categories are per-corpus configuration, so a name valid in one corpus is invalid in another. The refusal names the accepted list and never names the corpus it consulted, so one message carries two meanings.
breaks: the flag gets respelled until something is accepted, against a corpus that was never the intended one — and the write lands somewhere nobody is looking.
example: check which `.my_context` answered before changing the spelling of the flag.
check: none - the refusal would have to name the corpus it consulted for this to be checkable, and it does not. That is a fix to the message rather than a check on the reader.
---

Categories are per-corpus configuration, so a category name that is valid in one corpus is invalid in another. The refusal names the accepted list and never names the corpus it consulted, which makes one message carry two meanings: the name is misspelled, or the command is pointed at a corpus that does not define it. Check which .my_context answered before changing the spelling of the flag.

*Moved from `RULE-read-an-unknown-category-error-as-a-possible-wrong-corpus` on 2026-09-11; that item is retired and points here.*
