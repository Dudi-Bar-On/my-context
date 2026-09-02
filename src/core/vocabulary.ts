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
 * ── THE FOUR ADDED 2026-09-02, AND WHY EACH IS ITS OWN NAME ───────────────
 *
 * - `depends_on` — this item's correctness rests on that one; if that falls,
 *   re-examine this. The direction is dependent → premise. Distinct from
 *   `blocks`, which is a lifecycle gate on WORK, where this is a standing
 *   claim about CORRECTNESS. It was already in `RELATION_CLASSIFICATION` and
 *   already on disk in this corpus; adding it here is the enum catching up
 *   with an edge the corpus has carried since before the enum closed.
 * - `caused_by` — the thing this item describes was produced by the thing
 *   that one describes. Causation IN THE WORLD, as against `derived_from`'s
 *   provenance of the ARTEFACT: a rule is `derived_from` a lesson because
 *   someone wrote it out of that lesson; an outage is `caused_by` a
 *   deployment because the deployment made it happen.
 * - `conflicts_with` — both stand and they pull opposite ways. The ONE
 *   symmetric member, and symmetry here is a fact about the RELATION, never a
 *   licence to store the mirror: see `relations.ts`, and `apiGraph`'s
 *   bidirectional walk, which needs no stored inverse to traverse either way.
 * - `amends` — extends the target without replacing it, and the target stays
 *   active. Distinct from `refines`, which NARROWS what the target says, and
 *   from `supersedes`, which retires it.
 *
 * No inverse of any of these is a member. An inverse is DERIVED on traversal
 * or rendered as a phrase ("blocked by" for an inbound `blocks`); storing one
 * would create a second edge to keep in sync with the first.
 */
export const RELATION_TYPES = [
  'derived_from', 'constrains', 'supersedes', 'blocks',
  'mitigates', 'refines', 'relates_to', 'links_to',
  'depends_on', 'caused_by', 'conflicts_with', 'amends',
];

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
