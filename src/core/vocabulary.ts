/**
 * **The closed vocabularies, and the id grammar, with nothing behind them.**
 *
 * This module imports nothing. That is its entire purpose, and it is a
 * property to preserve rather than a coincidence: every surface in this
 * project validates against these lists, so whatever module holds them is
 * reachable from everywhere. A vocabulary that lives next to an operation
 * drags the operation's dependencies along with it.
 *
 * Two concrete defects made that abstract point real:
 *
 * 1. **`RELATION_TYPES` lived in `relations.ts`**, which also exports
 *    `linkItems` and `unlinkItems` — two of the eight mutating functions the
 *    v2.0 web UI's central guarantee bans from its import graph — and which
 *    imports `persist.ts` at runtime. Reading the relation vocabulary is a
 *    read; it should not require a module that can write. `RELATION_TYPES`
 *    was in `mutate.ts` before that, so this is its third home, and the
 *    reason it kept moving is that it kept living beside operations.
 *
 * 2. **`validate.ts` and `item.ts` had become circular.** `validate.ts`
 *    imports `isValidObservationCategory` from `item.ts`; when the id grammar
 *    was applied at the read boundary, `item.ts` began importing
 *    `validateLoadedId` back. That cycle loads cleanly today only because
 *    both bindings are used inside function bodies and never at module
 *    evaluation — a property nobody declared and nothing checks. Moving the
 *    grammar here breaks it.
 *
 * `test/core/vocabulary-graph.test.ts` asserts the no-imports property, so
 * the next person to reach for a helper from here finds out immediately.
 */

/**
 * The relation vocabulary. Closed deliberately: an open vocabulary produces
 * `derives_from`, `derivedFrom` and `derived-from` in one corpus, and then no
 * query finds all three.
 *
 * `superseded_by` is deliberately NOT a member — see `relations.ts`, where
 * that omission is load-bearing rather than an oversight: `RELATION_TYPES` is
 * the whole gate on `linkItems`, so a name absent from this list cannot be
 * forged through the link surfaces.
 *
 * **This is a WRITE gate and never a read filter** (owner ruling, 2026-09-02).
 * A query surface that validates `--relation` against this list refuses the
 * nine `superseded_by` edges this corpus actually holds, which is a filter
 * that cannot ask about half the graph. `apiGraph` (`ui/read-model.ts`) was
 * the first surface to state the rule — serve this vocabulary, then whatever
 * else is on disk — and `mycontext search --relation` and `GET /api/search`
 * now read the same way. Nothing about that widens what may be WRITTEN.
 *
 * ── WHAT EACH ONE MEANS ───────────────────────────────────────────────────
 *
 * In `RELATION_MEANINGS` below, one sentence per name, and NOT in this
 * comment. That prose is what a caller actually needs and it used to live in
 * a hand-typed table in `help/topics/workflow.md`; on 2026-09-02 the
 * vocabulary went from eight names to twelve and that table still listed
 * nine. It is data here so the table can be generated from it, and so a name
 * added without its sentence fails rather than shipping unexplained.
 *
 * The four added on 2026-09-02 are `depends_on`, `caused_by`,
 * `conflicts_with` and `amends`. `depends_on` was already in
 * `RELATION_CLASSIFICATION` and already on disk in this corpus, so adding it
 * was the enum catching up with an edge the corpus has carried since before
 * the enum closed; the other three were new.
 *
 * The six added on 2026-09-03 are `produced`, `discovered_by`, `unblocks`,
 * `enforces`, `enforced_by` and `answers` — owner ruling,
 * `DEC-all-nineteen-relation-types-ship-and-an-inverse-pair-is-two`. All six
 * were already ON DISK in this corpus and had been since before the enum
 * closed: the Markdown parser does not gate a relation name, so they indexed,
 * classified (`RELATION_CLASSIFICATION`, `core/focus.ts`) and drew fine while
 * `link_items` refused to write one. Adding them is the enum catching up with
 * edges the corpus has carried for weeks, the same act `depends_on` was on
 * 2026-09-02, and it leaves `superseded_by` as the ONLY name the corpus holds
 * that the vocabulary does not.
 *
 * ── TWO INVERSE PAIRS ARE NOW MEMBERS, AND THAT IS NOT A REVERSAL ─────────
 *
 * Until 2026-09-03 no inverse of any member was a member, on the ground that a
 * stored inverse is a second row to keep in sync with the first. Asked
 * directly whether inverse pairs should be stored or derived, the owner
 * answered *"do it, currently there are also some pairs, we could look at the
 * active one or the passive side of a relation"*, and the decision above
 * records precisely what that settles and what it does not.
 *
 * It settles that a READER may ask from either end, so `enforces`/
 * `enforced_by` and `produced`/`discovered_by` each get a name here. It does
 * NOT license two rows for one edge — the decision says so in its own words:
 * "offering a name for the passive side is a different act from storing an
 * unmanaged second row". `INVERSE_RELATIONS` below declares the two pairs, and
 * `linkItems` uses it to refuse the mirror of an edge that is already
 * recorded. **One edge, one row, either name.**
 *
 * `conflicts_with`, the one SYMMETRIC member, still stores no mirror for the
 * same reason, and `apiGraph`'s bidirectional walk plus `relationDegrees` and
 * `danglingEdges` already read every edge from both ends with nothing stored.
 *
 * `superseded_by` is still NOT a member and nothing here weakens that. It
 * asserts a lifecycle change rather than a relation; excluding it from this
 * list IS the write gate that stops it being forged, and `supersede_item`
 * writes both of its directions together so they cannot drift.
 */
export const RELATION_TYPES = [
  'derived_from', 'constrains', 'supersedes', 'blocks',
  'mitigates', 'refines', 'relates_to', 'links_to',
  'depends_on', 'caused_by', 'conflicts_with', 'amends',
  // Owner ruling 2026-09-03. Appended rather than interleaved: the authored
  // order is what every refusal message, `--relation` select and `/api/graph`
  // filter shows, and `plugin/commands.ts` reads `RELATION_TYPES[3]` by index.
  'produced', 'discovered_by', 'unblocks', 'enforces', 'enforced_by', 'answers',
];

/**
 * What each relation MEANS and when to reach for it — the prose an enum
 * cannot carry, keyed by the name it describes.
 *
 * **This exists so that no hand-typed copy of the vocabulary does.**
 * `mycontext help workflow` renders its relation table from this map and
 * `RELATION_TYPES` together (`help/index.ts` · `relationTable`), and that
 * renderer THROWS when the two disagree in either direction — a name in
 * `RELATION_TYPES` with no sentence here, or a sentence here for a name that
 * is not in the vocabulary. So the failure a new relation type causes is
 * "help/index.ts refuses to render the workflow topic", named in the message,
 * rather than a table that quietly lists one fewer name than the tool accepts.
 * `test/help/relation-vocabulary.test.ts` holds both directions.
 *
 * ONE LINE EACH, AND NO `|`: every sentence is rendered into a GFM table
 * cell, where a literal pipe ends the cell. `relationTable` refuses one.
 */
export const RELATION_MEANINGS: Record<string, string> = {
  derived_from:
    'This item came out of that one — a rule from a lesson, a constraint from an ADR. '
    + 'Provenance of the ARTEFACT, where `caused_by` is causation in the world',
  constrains: 'This item limits what that one may do',
  supersedes:
    'This item replaces that one. Written by `supersede_item`, which sets the retired '
    + 'item\'s status in the same breath; `link_items` refuses it — see below',
  blocks:
    'That item cannot be settled until this one is — a lifecycle gate on WORK, mainly '
    + 'for `open_question`, where `depends_on` is a standing claim about correctness',
  mitigates: 'This item reduces that risk',
  refines:
    'This item makes that one more specific — it NARROWS what the target says, where '
    + '`amends` adds to it',
  relates_to: 'Weak association, when nothing more precise fits',
  links_to: 'A bare mention',
  depends_on:
    'This item\'s correctness rests on that one; if the target falls, re-examine this. '
    + 'The direction is dependent → premise',
  caused_by:
    'The thing this item describes was produced by the thing that one describes — an '
    + 'outage is `caused_by` a deployment because the deployment made it happen',
  conflicts_with:
    'Both stand and they pull opposite ways. The one symmetric member, and the mirror '
    + 'is never stored: it is derived on traversal',
  amends:
    'This item extends the target without replacing it, and the target stays active — '
    + 'where `refines` narrows it and `supersedes` retires it',
  produced:
    'The work THIS item records brought that one into being — a lesson `produced` the '
    + 'requirement written off the back of it. The active reading of provenance',
  discovered_by:
    'This item was found by the work that one records — the PASSIVE reading of `produced`, for '
    + 'a reader starting at the finding. One edge: store whichever end you mean, never both',
  unblocks:
    'Settling this item RELEASED that one. Not the inverse of `blocks` — `blocks` says the gate '
    + 'is still shut, and this says it opened, so both can be true of one pair over time',
  enforces:
    'This item is the mechanism by which that one actually holds — a rule that makes an '
    + 'invariant true, where `constrains` only limits what the target may do',
  enforced_by:
    'That item is the mechanism by which THIS one holds — the PASSIVE reading of `enforces`. '
    + 'One edge: store whichever end you mean, never both',
  answers:
    'This item settles that question, and records only WHO answered it. The retirement is a '
    + 'separate act: an answered `open_question` is retired by `supersede_item`, which moves '
    + 'its status too',
};

/**
 * **The two INVERSE PAIRS in the vocabulary — one edge, two names, and never
 * two rows.**
 *
 * Owner ruling 2026-09-03,
 * `DEC-all-nineteen-relation-types-ship-and-an-inverse-pair-is-two`: *"do it,
 * currently there are also some pairs, we could look at the active one or the
 * passive side of a relation"*. `RULE-never-weaken-byte-identity enforces
 * INV-markdown-is-the-source-of-truth` and `INV-markdown-is-the-source-of-truth
 * enforced_by RULE-never-weaken-byte-identity` are not two facts; they are one
 * edge read from each end.
 *
 * **This map exists so that the second row cannot be written, not so that it
 * can.** The ruling this project already held — inverses are DERIVED, not
 * stored — objected to two independent rows that disagree the moment one is
 * edited alone, and naming the passive side does nothing about that objection
 * by itself: it hands a caller a spelling for the duplicate. `linkItems`
 * consults `inverseOf` and refuses the mirror of an edge the target already
 * carries, reporting it as already recorded. So the corpus holds ONE row per
 * edge whichever name wrote it, and both halves of the two rulings stand.
 *
 * **Symmetric, and asserted symmetric by `test/core/relation-inverses.test.ts`
 * rather than written twice by hand.** Both directions are listed here because
 * a lookup that only worked one way would refuse `enforced_by` after
 * `enforces` and accept `enforces` after `enforced_by` — a gate that depends
 * on which end the author happened to write first.
 *
 * **What is NOT declared here, deliberately.** `conflicts_with` is its own
 * inverse and is left out: its mirror is the same name in the other direction,
 * so a pair entry would refuse a second, legitimately different `conflicts_with`
 * edge. `blocks`/`unblocks` are not inverses — see their meanings. And
 * `superseded_by` has no entry because it is not in the vocabulary at all.
 */
export const INVERSE_RELATIONS: Record<string, string> = {
  produced: 'discovered_by',
  discovered_by: 'produced',
  enforces: 'enforced_by',
  enforced_by: 'enforces',
};

/**
 * The passive reading of `type`, or `null` when it has no declared inverse.
 *
 * A function rather than a bare map read so that "this type has no inverse" is
 * one answer with one spelling, and so the READ surfaces that want to render a
 * phrase for an inbound edge ("enforced_by X" for an inbound `enforces`) share
 * it with the WRITE gate that refuses the stored mirror.
 */
export function inverseOf(type: string): string | null {
  return INVERSE_RELATIONS[type] ?? null;
}

/**
 * An id is not only a key. `createItem` turns an explicit `input.id` straight
 * into a path — `filePath: items/${type}/${id}.md` — and `writeItem` joins
 * that with the workspace root and `mkdirSync`s the parent recursively. So an
 * id of `../../../evil`, or one carrying any separator, writes a file OUTSIDE
 * `.my_context/`, creating directories on the way, and the write-deny hook
 * (which matches on the `.my_context` path segment) never sees a managed path
 * at all.
 *
 * The rule is "one safe filename segment", not `slugify`'s grammar. What
 * matters is the path property, and the slug grammar would additionally
 * reject ids this system already accepts from disk — an uppercase or
 * underscored id in a hand-authored or older corpus parses and indexes fine
 * today, and refusing to re-mint one would enforce a rule the rest of the
 * codebase does not.
 *
 * `..` is refused anywhere in the string, not merely as a whole segment: no
 * id this project mints contains one, and the separator check plus the
 * leading-character rule already make a bare `..` unreachable, so this only
 * removes a shape that is meaningless as an id and easy to misread as safe.
 */
export const ID_GRAMMAR = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Whether `id` is a usable id: one safe filename segment, and no `..`. */
export function isUsableId(id: string): boolean {
  return ID_GRAMMAR.test(id) && !id.includes('..');
}

/**
 * The same grammar, applied where ids ARRIVE rather than where they are minted.
 *
 * `validateExplicitId` guards the mint path — the surface that turns an id into
 * a filename — and its comment states the principle this function completes:
 * insurance "taken at the boundary rather than at whichever future call site
 * first does it". The READ boundary was never guarded. `parseItem` took `id`
 * from frontmatter verbatim, so a file written straight into
 * `.my_context/items/` — the shell-redirect route README §7 documents as open
 * to an agent — could carry any string at all. The checksum field is not a
 * barrier here: it only catches files this CLI wrote and something later
 * edited, so a freshly written file with no `checksum:` at all loads with no
 * error.
 *
 * That id then reaches roughly fifteen sites that interpolate it into a command
 * the CLI invites a human to run. Demonstrated on 1.0.1: an item whose id was
 * `DEC-$(echo SUBSTITUTED)` made `mycontext supersede` print
 *
 *     promote it with `mycontext review promote DEC-$(echo SUBSTITUTED)`
 *
 * and the substitution runs in the user's own interactive shell, where none of
 * the fourteen deny rules apply — those govern the agent's Bash tool, not the
 * human's terminal.
 *
 * `ID_GRAMMAR` is the right rule and not a stricter one: it accepts uppercase,
 * `_` and `.`, so the hand-authored or older ids `validateExplicitId`'s comment
 * is careful to keep loading still load. It rejects `$`, backticks, spaces,
 * parentheses, path separators and `..` — the shapes that are dangerous and
 * meaningless as an id in equal measure.
 *
 * Throws, because `parseItem`'s caller already catches per file, records a
 * `LoadError { file, message }` and continues. One unusable id must not make a
 * workspace unreadable, and it must not vanish quietly either.
 */
export function validateLoadedId(id: string, file: string): void {
  if (isUsableId(id)) return;
  throw new Error(
    `id ${JSON.stringify(id)} is not a usable id. An id must start with a letter or digit and ` +
    `contain only letters, digits, ".", "_" and "-" — it becomes this item's filename, and it is ` +
    `printed inside commands this tool invites you to run, where a character like "$" or "\`" ` +
    `would be interpreted by your shell. This item was not loaded; ${file} is otherwise ` +
    `untouched. Rename the id in the file to load it.`,
  );
}
