---
id: a-scanner-names-what-it-skips-not-what-it-scans
kind: standard
tier: developer
title: a scanner enumerates what it will SKIP, never what it will scan
trigger: writing or reviewing anything that walks a set and judges its members — a gate, a check, a lint, a sweep
shape: the code lists the exclusions and scans everything else; an input the list does not name is SCANNED, never waved through. Where a list of inclusions is unavoidable, the set must be derived from the tree or the registry rather than typed by hand, and a test must assert the derivation covers the real set in BOTH directions
example: "`isWriter` in `test/ui/no-writes.test.ts` answers from a table keyed by defining module, so a module the table does not name is judged harmless — it has now missed FOUR real writers (`ui-server-record.ts` 2026-08-27, `review/trigger.ts` 2026-09-10, `core/anchors.ts` and the retrieval staging pair 2026-09-12), each time repaired by adding a key rather than by inverting the default"
check: "none - a scanner's default is a property of its code rather than of its output, so nothing in the archive can see it. The nearest measurable proxy is that a gate goes red when its guarded thing breaks, which is a different claim. Grep for `.includes(` and `in TABLE` beside a `return false` when reviewing."
request: do we have more lessons we learned today and yesterday that worth putting in the store as part of the product ?
---

**Three independent reviews on 2026-09-12 found this same shape and none of them could see
each other.** A silent-failure review named it as a pattern with six members; a type-design
review showed the compiler had been ready and a cast walked past it; a gates review found
eleven more sites. Consolidated, it is **seventeen or more** places where an unlisted input
takes the benign branch.

The members are not all alike, and the difference decides the remedy:

- **`check-text-files.ts` skips `.tsx`, `.jsonl`, `.svg` and every root file** — an inclusion
  list wearing an extension filter.
- **`scopePolicyFor` hands an undeclared category the permissive default.**
- **`parseItem` cast `status` out of frontmatter**, so `GOVERNING_STATUS['activ']` answered
  `undefined`, which is falsy, and **five gates failed open together**. Here the union existed
  and the table was total — the type system was ready and the cast walked past it.
- **`isWriter`'s key is a `string`**, so "the set of modules under `src/`" is not a type and the
  compiler could never form the proposition. That one needs a derivation from the filesystem,
  not a better default.

So the rule has a second half. Inverting the default is the answer where the set is knowable;
where it is not, **derive the set and assert the derivation both ways** — every member found is
scanned, and every thing scanned is a member. `runChecks` in `doctor/checks.ts` is a hand-kept
registry that is correct today and **has already caused one silent-miss incident on record**; it
wants that guard BEFORE the file is split, not after.

The failure is quiet by construction, which is why it needs a standard rather than a memory: a
scanner that skips an input reports success. Nothing goes red. The only evidence is the defect
it let through, arriving later and looking like something else.
