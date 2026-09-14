// @basis TASK-item-has-zero-readonly-fields-no-factory-and-no-freeze-so-a, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`Item` with its `readonly` modifiers stripped, for FIXTURES only.**
 *
 * `Item.id`, `.type`, `.layer` and `.filePath` became `readonly` on 2026-09-14
 * (`TASK-item-has-zero-readonly-fields-no-factory-and-no-freeze-so-a`). Nothing
 * in `src/` ever assigned any of them — that was measured before the modifiers
 * went on, and it is why they were safe to add — but three test files build
 * their fixtures by parsing one item and then editing the field they are about
 * to assert on, and two of those fields are now fixed at creation.
 *
 * Those tests are not wrong: a test whose whole subject is "a corpus holding
 * two items with the same id" or "a control character planted in an id" has to
 * fabricate a record the product would only ever CREATE, never edit. So the
 * escape exists, and three properties keep it from being a hole:
 *
 *  - **It lives under `test/`.** `package.json`'s `files` list does not ship
 *    `test/`, and no module in `src/` imports from it — so this cannot become
 *    the way production code writes to a field the type says is fixed.
 *  - **It is ONE declaration, not three.** Three local copies of the same
 *    `-readonly` mapped type would be three places to forget the reason, which
 *    is this project's most-measured defect.
 *  - **It is a type, so it erases.** `CONST-node-24-no-build-step`: a mapped
 *    type emits nothing, costs nothing, and disappears under type stripping.
 *
 * Use it at the narrowest point. Prefer `{ ...parseItem(...), id, title }` —
 * construction rather than mutation — wherever the fixture can be built in one
 * expression; reach for this only where the test's shape is genuinely "hand me
 * an item and I will move one field on it".
 */
import type { Item } from '../../src/core/types.ts';

export type FabricatedItem = { -readonly [K in keyof Item]: Item[K] };
