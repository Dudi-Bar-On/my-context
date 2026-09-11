/**
 * **Rendering the applicable set, and naming what outranks what.**
 *
 * D41 spec §8 and §9, `plan:store seq:2` Tasks 6 and 8. This module turns a
 * loaded `RuleSet` into the text a door puts in front of a model, and it is
 * the ONLY place that text is composed — a second renderer would be a second
 * answer to "what does an entry say", which is the drift the whole store
 * exists to end.
 *
 * ── EVERY PART NAME COMES OUT OF `TEMPLATE`, NEVER OUT OF THIS FILE ────────
 *
 * `schema.ts` says it in its own header: *"`TEMPLATE` is not a list the
 * validator happens to consult. It is the only place a part is named."* So
 * `renderEntry` walks `partsOf(entry.kind)` and prints `part.name` — a kind
 * that gains a part gains a rendered line with no edit here, and a part
 * renamed there is renamed here. A literal `'trigger'` or `'why'` written in
 * this file would be exactly the second table that header rejects.
 *
 * ── `request` IS NEVER RENDERED, AND THE ABSENCE IS STRUCTURAL ─────────────
 *
 * Spec §6: the owner's own words are carried *"for documentation only and
 * should not be injected to the context"*. That is not enforced by filtering
 * `request` out — a filter is a list somebody can forget to extend. It is
 * enforced by rendering ONLY what `partsOf(kind)` names plus the frame
 * (`id`, `title`, `kind`) and the body, none of which `request` is. A field
 * added to the entry shape tomorrow is invisible here until somebody decides
 * to render it, which is the safe direction for a store whose one documented
 * never-inject field lives beside the ones that must be injected.
 * `test/rules/deliver.test.ts` plants a distinctive request and asserts its
 * absence, because "structural" is a claim and the test is the evidence.
 *
 * ── WHY THE STORE IS RENDERED HERE AND NOT IN `core/inject.ts` ─────────────
 *
 * `test/rules/isolation.test.ts` forbids the edge in both directions, and its
 * own failure message names this module as the alternative: *"the store is
 * rendered by `src/rules/deliver.ts` and never selected as a corpus item,
 * because a constant that competed for the tier budget would spend a user's
 * budget on our rules."* So the composition happens at the HOOK: the corpus
 * block comes from `core/inject.ts`, this block comes from here, and the hook
 * — which is allowed to know about both — puts them in that order.
 *
 * Nothing in this module writes. `delivered.ts` holds the one write, for the
 * same reason `manifest.ts` holds the store's other one: "does this write"
 * stays answerable by reading an import list.
 */
import path from 'node:path';
import { assertDelivered, recordDelivery, type Door } from './delivered.ts';
import { partsOf, type Entry, type EntryError, type Tier } from './schema.ts';
import { entriesDir, loadRules, packageRoot, type RuleSet } from './store.ts';

/**
 * A store entry and a corpus item that claim the same subject.
 *
 * Spec §9: *"a product entry wins, and the conflict is reported."* Both halves
 * are here because the second is the load-bearing one — a silent win teaches a
 * reader their own rule is being obeyed when it is not.
 */
export interface Conflict {
  /** The store entry's id. It wins. */
  entry: string;
  /** The corpus item's id. It is not deleted, hidden, or edited. */
  item: string;
}

export interface Delivery {
  /** The block to put in front of the model, or `''` when there is none. */
  text: string;
  /** The ids rendered, in the order rendered. Scope for the record. */
  entries: string[];
  /** Entries that did not load — named here, never dropped. */
  refused: string[];
  conflicts: Conflict[];
}

/**
 * A corpus id carries its category as a prefix (`RULE-`, `STD-`, `TASK-`…);
 * a store entry's id does not, because the store has no categories. So the
 * comparable half of a corpus id is what follows the first `-` when the head
 * is an ALL-CAPS category token.
 *
 * **This is the conflict migration will actually produce** (`plan:store
 * seq:4`): an item moved into the store leaves the corpus copy behind under
 * the same slug, and for a window the two say different things about the same
 * subject. Matching on the slug catches exactly that pair and nothing else —
 * no fuzzy title comparison, no similarity score, nothing that could report a
 * conflict between two rules that merely rhyme. A check that cries wolf is a
 * check people turn off, and `STD-the-precedence-order-when-four-sources-of-
 * truth-disagree` is explicit that a contradiction is a FINDING: a finding
 * nobody believes is worse than none.
 *
 * The narrowness is the cost, and it is named rather than hidden: two rules
 * that genuinely disagree under unrelated names are not detected here, and
 * `check: detective:…` on the entry is what covers that case (spec §4).
 */
export function corpusSlug(itemId: string): string {
  const cut = itemId.indexOf('-');
  if (cut <= 0) return itemId;
  const head = itemId.slice(0, cut);
  return /^[A-Z][A-Z0-9]*$/.test(head) ? itemId.slice(cut + 1) : itemId;
}

/**
 * Which entries collide with which of `itemIds`.
 *
 * `itemIds` is passed IN, exactly as `loadRules`'s `workspaceIsMyContext` is:
 * this module may not read the corpus (spec §7), and the caller already has
 * the ids it just delivered.
 */
export function findConflicts(
  entries: readonly Entry[], itemIds: readonly string[],
): Conflict[] {
  const bySlug = new Map<string, string>();
  for (const id of itemIds) {
    const slug = corpusSlug(id);
    if (!bySlug.has(slug)) bySlug.set(slug, id);
  }
  const found: Conflict[] = [];
  for (const entry of entries) {
    const item = bySlug.get(entry.id);
    if (item !== undefined) found.push({ entry: entry.id, item });
  }
  return found;
}

/**
 * The frame, and it is a frame rather than a heading for the reason
 * `SUBAGENT_PREAMBLE` is one: a block with no account of where it came from
 * was once reported by a real subagent to its parent as a possible
 * out-of-band attack, which is the correct reading of unattributed text
 * arriving in a context window.
 *
 * It says three things and no more: what these are, that they are not the
 * reader's project's items, and that they cannot be edited from here.
 */
const PREAMBLE =
  '_These are **product constants**: facts, prohibitions, procedures, standards and definitions ' +
  'about my_context itself, shipped inside the tool and delivered at every door an agent starts ' +
  'through. They are NOT items in this project\'s corpus — they are not listed by `mycontext ' +
  'list`, they spend none of this project\'s injection budget, and they cannot be edited, ' +
  'superseded or deprecated from here._';

/** The precedence sentence, delivered whether or not a conflict was found. */
const PRECEDENCE =
  '_**Precedence:** a product constant outranks every other source, including this project\'s ' +
  'own corpus — it states how the tool behaves, which is true whatever anybody records about it. ' +
  'Where one disagrees with an item you are also holding, the constant governs and the ' +
  'disagreement is named below rather than settled in silence ' +
  '(`STD-the-precedence-order-when-four-sources-of-truth-disagree`)._';

function renderValue(value: string | string[]): string {
  return Array.isArray(value)
    ? value.map((line, i) => `  ${i + 1}. ${String(line).trim()}`).join('\n')
    : String(value).trim();
}

/**
 * **The tiers whose rendered entry names the corpus item it was moved from —
 * owner's ruling, 2026-09-11.**
 *
 * A migrated entry carries `movedFrom`, and what that pointer is worth depends
 * entirely on who is reading it. Inside my_context the retired item is on disk
 * and one `mycontext show` away, so on a `developer` entry the line is
 * provenance: it says the rule has one home now and where the argument that
 * produced it can still be read. A `product` entry ships to every install,
 * where the same id names an item the reader does not have, cannot fetch, and
 * has no way to tell was ever real — a dangling citation inside the one block
 * `PRECEDENCE` above claims outranks every other source.
 *
 * He was offered three ways out on 2026-09-11 — strip it for product entries,
 * keep it and update both READMEs to quote it, or isolate the documentation
 * fixture — and took the first.
 *
 * **Written as an allow-list, and that is the decision rather than an
 * accident**, for the reason `SESSION_SCOPE_DOORS` is one: `!== 'product'`
 * would disclose provenance to every tier added later, and the next tier will
 * be added by somebody thinking about something else. A tier nobody has
 * thought about yet gets the treatment that ships nothing.
 */
export const TIERS_THAT_DISCLOSE_PROVENANCE: readonly Tier[] = ['developer'];

/**
 * The provenance footer, or `''`.
 *
 * The sentence lives here and nowhere else — `scripts/migrate-rules.ts` writes
 * the FIELDS and never this text — so there is one answer to what the footer
 * says, which is the same argument this module's header makes about there
 * being one renderer.
 */
function provenance(entry: Entry): string {
  if (entry.movedFrom === undefined) return '';
  if (!TIERS_THAT_DISCLOSE_PROVENANCE.includes(entry.tier)) return '';
  const when = entry.movedOn === undefined ? '' : ` on ${entry.movedOn}`;
  return `*Moved from \`${entry.movedFrom}\`${when}; that item is retired and points here.*`;
}

/**
 * One entry. Every line below `###` is derived from `partsOf` — see the header.
 */
export function renderEntry(entry: Entry): string {
  const lines = [`### ${entry.title}`, '', `\`${entry.id}\` · ${entry.kind}`, ''];
  for (const part of partsOf(entry.kind)) {
    const value = entry.parts[part.name];
    if (value === undefined) continue;
    const rendered = renderValue(value);
    lines.push(rendered.includes('\n')
      ? `- **${part.name}:**\n${rendered}`
      : `- **${part.name}:** ${rendered}`);
  }
  if (entry.body !== '') lines.push('', entry.body);
  const footer = provenance(entry);
  if (footer !== '') lines.push('', footer);
  return lines.join('\n');
}

/**
 * A refusal, named in the delivered text rather than only in a log.
 *
 * `INV-nothing-is-dropped-silently`, and this is the surface where it costs
 * the most: a reader holding four constants when five shipped has no way to
 * know the fifth existed. `store.ts` already refuses to tier-filter refusals
 * for the same reason.
 */
function renderRefusals(refused: readonly EntryError[]): string {
  if (refused.length === 0) return '';
  const rows = refused.map((r) => `- \`${r.id ?? path.basename(r.path)}\` — ${r.error}`);
  return [
    `**${refused.length} product constant(s) did not load, and are therefore NOT in force ` +
    'below.** Run `mycontext rules verify --restore`.',
    '',
    ...rows,
  ].join('\n');
}

/** Spec §9's second half, and the whole reason the first half is safe. */
function renderConflicts(conflicts: readonly Conflict[]): string {
  if (conflicts.length === 0) return '';
  const rows = conflicts.map((c) =>
    `- \`${c.entry}\` (product constant, GOVERNS) vs \`${c.item}\` (this project's corpus item, ` +
    'does not) — the two claim the same subject.');
  return [
    `**${conflicts.length} disagreement(s) between a product constant and an item in this ` +
    'project\'s corpus.** The constant wins; the item is untouched — nothing here deletes, ' +
    'hides or rewrites it, because the superseded statement is how anybody later understands ' +
    'why the winner reads the way it does.',
    '',
    ...rows,
  ].join('\n');
}

/**
 * Render the applicable set.
 *
 * "Applicable" is decided upstream, by `loadRules`'s tier filter, and is not
 * re-decided here: a second place that could exclude an entry is a second
 * place an entry can go missing, and only one of them would be tested.
 *
 * Returns `text: ''` when the set is empty AND nothing was refused and no
 * conflict was found — a door that spoke and said nothing is a door that
 * teaches its reader to skip the block. The DELIVERY is still recorded by the
 * caller in that case; see `delivered.ts`, which is emphatic about why.
 */
export function renderRules(set: RuleSet, itemIds: readonly string[] = []): Delivery {
  const conflicts = findConflicts(set.entries, itemIds);
  const refusals = renderRefusals(set.refused);
  const conflictBlock = renderConflicts(conflicts);

  if (set.entries.length === 0 && refusals === '' && conflictBlock === '') {
    return { text: '', entries: [], refused: [], conflicts: [] };
  }

  const blocks: string[] = [
    `## my_context product rules — ${set.entries.length} constant(s)`,
    PREAMBLE,
    PRECEDENCE,
  ];
  if (conflictBlock !== '') blocks.push(conflictBlock);
  if (refusals !== '') blocks.push(refusals);
  for (const entry of set.entries) blocks.push(renderEntry(entry));

  return {
    text: blocks.join('\n\n'),
    entries: set.entries.map((e) => e.id),
    refused: set.refused.map((r) => r.id ?? r.path),
    conflicts,
  };
}

/**
 * **Is the workspace being worked on my_context itself** — spec §3's one
 * question, and the whole of what the `developer` tier turns on.
 *
 * Asked by comparing the workspace's parent against the package this file
 * ships in, for the reason `rules/store.ts` · `packageRoot` gives at length: a
 * marker file inside the workspace is something a stranger's project acquires
 * by copying a file, and what hangs on the answer is whether rules about how
 * THIS repository works become law somewhere else.
 *
 * `projectRoot` is the `.my_context` directory (`core/workspace.ts` ·
 * `findProjectRoot`), so the workspace is its parent.
 */
export function workspaceIsMyContext(projectRoot: string): boolean {
  return path.resolve(path.dirname(projectRoot)) === packageRoot();
}

/**
 * **An explicitly named store directory, and the reason there is one.**
 *
 * `entriesDir()` resolves the store from the package this file ships in, and
 * that is the right default for every real door: the rules ship inside the
 * package, so their location is a fact about the installation and never about
 * where the caller is standing (`rules/store.ts` · `entriesDir`).
 *
 * This variable overrides it, and it is the same shape as `MYCONTEXT_CORPUS_DIR`
 * — a CALLER STATING A CHOICE BY NAME. Two callers need it: the maintenance
 * tool of Phase 3, which must be able to render and publish a candidate store
 * without overwriting the live one, and the door tests, which have to prove a
 * door delivers TEXT and cannot do that against a shipped store whose only
 * entry is `developer` tier and therefore inapplicable in any workspace but
 * this repository.
 *
 * **It does not weaken §13's integrity story, and the reason is structural.**
 * The manifest lives INSIDE the store directory, so `verifyManifest` verifies
 * whatever directory it is handed: a substituted store is verified against its
 * own manifest exactly as the shipped one is, and a damaged substitute refuses
 * writes exactly as a damaged shipped store does. What the variable can do is
 * deliver a DIFFERENT set of rules, and that is why it is DISCLOSED in the
 * block it produces rather than merely permitted — a reader who is holding
 * constants from somewhere other than the installed package needs to be told
 * so, by the same argument `corpusRootLine` names the corpus root on a
 * subagent's block.
 */
export const RULES_DIR_ENV = 'MYCONTEXT_RULES_DIR';

/**
 * The line that says the constants below did not come out of the package.
 *
 * Non-empty only when the variable is in effect, for the reason every note in
 * `core/inject.ts` is gated the same way: a sentence that appears every time
 * is a sentence nobody reads.
 */
export function substitutedStoreLine(dir: string, shipped: string): string {
  return path.resolve(dir) === path.resolve(shipped) ? ''
    : `_**These constants were NOT read from the installed package.** \`${RULES_DIR_ENV}\` ` +
      `points at \`${dir}\`, so what follows is whatever that directory holds — verified ` +
      'against its own manifest, which is not the one that shipped. Unset the variable to read ' +
      'the installed store._';
}

/** Where a delivery came from, and what the caller already knows about it. */
export interface DoorContext {
  /** The `.my_context` directory. The record is written under its `state/`. */
  stateRoot: string;
  door: Door;
  /**
   * `ledgerKey(input)` — the session id, or `session::agent` for a subagent.
   * `null` when the payload carried no session id: the delivery still happens
   * and is still recorded, under a key no assertion can match, and the row
   * says so rather than being dropped.
   */
  key: string | null;
  /** The corpus ids delivered beside this block, for spec §9's conflict check. */
  itemIds?: readonly string[];
  /** The store directory. Overridden only by tests and by `mycontext rules`. */
  storeDir?: string;
}

/**
 * **The whole of a door's work, in one call, so every door does the same
 * thing.**
 *
 * Three doors call this — `hooks/session-start.ts` (twice over: a new or
 * resumed session and a compact-restore are one hook and two `Door` values)
 * and `hooks/subagent-start.ts`. Each one does exactly two things with the
 * result: put `text` in front of the model, and nothing else. If a door ever
 * needs to do something different, that is a reason to change this function,
 * not a reason for that door to compose its own block — a second composition
 * is a second answer to "what did we deliver", and only one of them would be
 * recorded.
 *
 * **The record is written even when `text` is `''`.** See `recordDelivery`:
 * the row is about the door, not the payload, and an empty delivery that
 * wrote no row is indistinguishable from a hook that was killed.
 */
export function deliverAtDoor(ctx: DoorContext): Delivery & { recorded: boolean } {
  const shipped = entriesDir();
  const dir = resolveStoreDir(ctx.storeDir);
  const set = loadRules(dir, workspaceIsMyContext(ctx.stateRoot));
  const rendered = renderRules(set, ctx.itemIds ?? []);
  const substituted = rendered.text === '' ? '' : substitutedStoreLine(dir, shipped);
  const delivery: Delivery = substituted === ''
    ? rendered
    : { ...rendered, text: `${substituted}

${rendered.text}` };
  const recorded = recordDelivery(ctx.stateRoot, {
    kind: 'delivered',
    key: ctx.key ?? '',
    door: ctx.door,
    entries: delivery.entries.length,
    ...(delivery.refused.length === 0 ? {} : { refused: delivery.refused.length }),
    ...(delivery.conflicts.length === 0 ? {} : { conflicts: delivery.conflicts.length }),
    ...(ctx.key === null
      ? { note: 'no session id in the payload; this delivery cannot be asserted against later' }
      : {}),
  });
  return { ...delivery, recorded };
}

/**
 * The store directory a door would read right now: the caller's, then the one
 * named in the environment, then the package's.
 *
 * One resolution, used by `deliverAtDoor` and by `assertDoor` below, because a
 * second one would let the assertion count a different store from the one the
 * door delivered.
 */
function resolveStoreDir(storeDir?: string): string {
  if (storeDir !== undefined) return storeDir;
  const named = process.env[RULES_DIR_ENV];
  return named !== undefined && named !== '' ? named : entriesDir();
}

/**
 * **The assertion, with the store's own knowledge behind it** — spec §8.2,
 * `plan:store seq:2` Task 7. Returns the sentence to disclose, or `''`.
 *
 * It lives here rather than in `delivered.ts` for one reason: answering *"how
 * many constants would have applied"* means loading and tier-filtering the
 * store, and `delivered.ts` is the module that writes the record. Keeping the
 * count on this side means `assertDelivered` takes it as a value and cannot
 * accidentally decide it — and the callback is not invoked at all unless the
 * key is genuinely unanswered, so the parse is paid at most once per key.
 */
export function assertDoor(stateRoot: string, key: string, storeDir?: string): string {
  return assertDelivered(stateRoot, key, () => {
    try {
      return loadRules(resolveStoreDir(storeDir), workspaceIsMyContext(stateRoot)).entries.length;
    } catch {
      // A store that cannot be read is a store that would have delivered
      // nothing, and reporting against it would blame the door for the
      // store's own damage — which `mycontext rules verify` is the surface
      // for.
      return 0;
    }
  });
}

/* ══ A STORE UPDATE UNDER A RUNNING SESSION — SPEC §12.3 ═══════════════════ */

/**
 * ── BUILT, TESTED, AND CALLED BY NOTHING — OWNER'S RULING, 2026-09-11 ──────
 *
 * `plan:store seq:3` Task 13 asked for the correction and got it: the diff
 * only, phrased as supersession, session-scope doors only, twelve assertions
 * in `test/rules/update-correction.test.ts`. It has no caller, and **that is
 * the deliberate end state rather than an unfinished step.** The ruling and
 * the condition that would reopen it are recorded in
 * `TASK-the-maintenance-tool-crud-where-the-form-is-the-template-and`; what
 * belongs here is the mechanics, so that a reader who finds tested code with
 * no caller does not have to re-derive them.
 *
 * **NO DOOR FITS, AND THAT IS A PROPERTY OF THE DOORS.** `deliverAtDoor`
 * renders the FULL set at every door in `SESSION_SCOPE_DOORS` —
 * `session-start`, `compact-restore` and `manual` — unconditionally, with no
 * dedupe; the door only decides what the row is labelled. So a correction
 * emitted at any of the three arrives beside a complete copy of the very store
 * it is correcting: 8,472 bytes of diff (the real v4→v5 change, three entries)
 * stapled to 23,772 bytes of full delivery (twelve entries, developer tier).
 * That is the second copy §12.3's own second bullet forbids — *"never the
 * whole store … creates two versions to reconcile"* — and the defect
 * `CLAUDE.md` opens with. `resume` is the one source that keeps its window,
 * and it is not a free door either: `hooks/session-start.ts` · `storeAppendix`
 * already rules that the store IS re-delivered there, deliberately, because
 * nothing can inspect a context window.
 *
 * **THE ONLY HOOK THAT FIRES MID-SESSION FOR A SESSION ALREADY HOLDING THE
 * STORE IS `PreToolUse`, AND IT IS NOT A DOOR — IT ASSERTS.** `assertDoor`
 * below is cheap precisely because it latches: past the first row, one read of
 * `delivered.jsonl` and no store parse at all — p50 0.371 ms, p95 0.503 ms,
 * measured 2026-09-11 on this repository. Making it a delivery door costs
 * three things that are not free, and the middle one is the one that settles
 * it:
 *
 *   a. **The model's channel, closed on purpose.** A correction is FOR the
 *      model, so stderr cannot carry it — and `runPreToolUse`'s own comment
 *      records that folding the missed-door sentence into `additionalContext`
 *      reddened five tests whose subject is that this hook says nothing about
 *      a call it has no opinion on. `additionalContext` and `preToolUseDeny`
 *      are also one stdout object, so a correction pending on a refused write
 *      into `.my_context/` would lose one of the two.
 *
 *   b. **The `before` bytes, on the hot path.** `renderCorrection` takes the
 *      old ENTRIES, because `deliveredShape` diffs what the renderer PRINTED —
 *      so that a change to `request`, which spec §6 keeps out of every context
 *      window, cannot manufacture a supersession with nothing in it to act on.
 *      Nothing holds those bytes: `delivered.jsonl` records a COUNT. Adding a
 *      per-entry rendered-shape map takes the mean row from 145 to 715 bytes,
 *      and `deliveries()` parses the whole file on every matched tool call: at
 *      the 5,000-row cap that is p50 3.61 → 13.11 ms and p95 4.57 → 16.15 ms,
 *      3.6× and +11.6 ms p95, on a hook held to a 50 ms p95 ceiling, to serve
 *      an answer that is empty every time. Taking the diff from the manifest's
 *      changelog instead is cheap (manifest.json is 5,131 bytes, p50 0.032 ms)
 *      and WRONG: `planPublish` diffs FILE checksums, not rendered shape, so a
 *      `request`-only edit would tell a reader their copy is superseded when it
 *      is byte-identical — the inverse of the defect this wording exists to
 *      prevent, manufactured by the mechanism meant to prevent it.
 *
 *   c. **The measurement itself.** A `delivered` row written by `PreToolUse`
 *      would satisfy `assertDelivered`, and §8.2's count — missed doors over
 *      delivered doors — would start reporting the hook that asserts as the
 *      door that delivered.
 *
 * Kept rather than deleted because the reasoning and the wording are the
 * expensive parts and they are already paid for: if the maintenance tool ever
 * ships, a store can change under a session that did not change it, and this
 * is what that session should be told.
 */

/**
 * **The doors a correction may go through, and it is a list of what IS rather
 * than a list of what is not.**
 *
 * Spec §12.3: *"A subagent starts fresh and simply receives the new store.
 * Only a long-running session holds a stale copy."* So `subagent-start` is
 * absent, and its absence is the decision: a correction at a subagent's door
 * would be a paragraph about a delivery that subagent never had, spending its
 * window to un-tell it something it was never told.
 *
 * Written as an allow-list because the alternative — `door !== 'subagent-start'`
 * — silently admits every door added later, and the next door added will be
 * added by somebody thinking about something else.
 */
export const SESSION_SCOPE_DOORS: readonly Door[] = ['session-start', 'compact-restore', 'manual'];

export interface Correction {
  /** The block to put in front of the model, or `''` when nothing changed. */
  text: string;
  /** Entries the session already holds whose text has been REPLACED. */
  superseded: string[];
  /** Entries that did not exist when the session started. */
  added: string[];
  /** Entries that no longer govern. */
  removed: string[];
}

/**
 * The bytes of an entry that a reader would be obeying — everything the
 * renderer puts in front of the model, and nothing else.
 *
 * `renderEntry` is reused rather than comparing fields, so that "did this
 * change" is answered about WHAT WAS DELIVERED. A field the renderer does not
 * print — `sourcePath`, and `request`, which spec §6 keeps out of every
 * context window — must not be able to produce a correction, because there
 * would be nothing in it for a reader to act on.
 */
function deliveredShape(entry: Entry): string {
  return renderEntry(entry);
}

const CORRECTION_PREAMBLE =
  '_**CORRECTION — the product constants you were given earlier in this session have CHANGED, ' +
  'and what follows REPLACES them.** Text cannot be removed from a context window, so the ' +
  'earlier copy is still above you: it is SUPERSEDED, and where the two disagree this one ' +
  'governs. Only the entries that moved are repeated here — everything else you were given ' +
  'still stands, unchanged._';

/**
 * **The correction, and it is phrased as supersession because an update phrased
 * as an addition is the defect `CLAUDE.md` opens with.**
 *
 * > *five superseded instructions being acted on as current because a document
 * > repeated one after it had been reversed. A copy cannot be superseded; only
 * > the original can.*
 *
 * That is why every line below names what it replaces rather than merely
 * stating the new rule, and why a REMOVED entry is named and NOT re-rendered:
 * re-rendering it would put the withdrawn text back in front of the reader one
 * more time, which is the opposite of withdrawing it.
 */
export function renderCorrection(
  before: readonly Entry[], after: readonly Entry[],
): Correction {
  const was = new Map(before.map((e) => [e.id, deliveredShape(e)]));
  const now = new Map(after.map((e) => [e.id, e]));

  const superseded: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  for (const entry of after) {
    const previous = was.get(entry.id);
    if (previous === undefined) { added.push(entry.id); continue; }
    if (previous !== deliveredShape(entry)) superseded.push(entry.id);
  }
  for (const entry of before) if (!now.has(entry.id)) removed.push(entry.id);
  superseded.sort(); added.sort(); removed.sort();

  if (superseded.length === 0 && added.length === 0 && removed.length === 0) {
    return { text: '', superseded, added, removed };
  }

  const blocks: string[] = [
    `## my_context product rules — CORRECTION (${superseded.length + added.length + removed.length} change(s))`,
    CORRECTION_PREAMBLE,
  ];

  if (removed.length > 0) {
    blocks.push([
      `**${removed.length} constant(s) no longer govern.** What you were given earlier for each ` +
      'is SUPERSEDED and in force no longer. Nothing replaces them; stop applying them.',
      '',
      ...removed.map((id) =>
        `- \`${id}\` — no longer in force. The earlier copy of it in this session is superseded.`),
    ].join('\n'));
  }

  if (superseded.length > 0) {
    blocks.push([
      `**${superseded.length} constant(s) have been REPLACED.** For each one below, the copy you ` +
      'were given earlier in this session is SUPERSEDED; the text under it is what governs now.',
      '',
      ...superseded.map((id) =>
        `- \`${id}\` — the earlier version is superseded and replaced by the text below.`),
    ].join('\n'));
    for (const id of superseded) {
      const entry = now.get(id);
      if (entry !== undefined) blocks.push(renderEntry(entry));
    }
  }

  if (added.length > 0) {
    blocks.push([
      `**${added.length} constant(s) are new** — they did not exist when this session started, ` +
      'so nothing you hold is superseded by them.',
      '',
      ...added.map((id) => `- \`${id}\` — new.`),
    ].join('\n'));
    for (const id of added) {
      const entry = now.get(id);
      if (entry !== undefined) blocks.push(renderEntry(entry));
    }
  }

  return { text: blocks.join('\n\n'), superseded, added, removed };
}

/**
 * The correction a given door may carry: the block for a session-scope door,
 * and `''` for every other.
 *
 * The gate is here rather than at each door for the reason `deliverAtDoor`
 * exists at all — a second place that decides what a door delivers is a second
 * answer to "what did we deliver", and only one of them would be recorded.
 */
export function correctionAtDoor(
  door: Door, before: readonly Entry[], after: readonly Entry[],
): string {
  if (!SESSION_SCOPE_DOORS.includes(door)) return '';
  return renderCorrection(before, after).text;
}
