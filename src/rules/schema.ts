/**
 * **The product rule store's schema — one table per kind, and the table IS the
 * schema, the check and the form.**
 *
 * D41, spec §4 (`docs/superpowers/specs/2026-09-10-product-rule-store-design.md`).
 * Five kinds, each with the parts it owes, plus the two every kind owes:
 * `example` and `check`. The design's own sentence is the constraint this file
 * has to hold: *"the template is the schema, the check AND the form — one
 * thing, not three that can drift: a `prohibition` without a `why` does not
 * load, does not validate, and cannot be saved in the maintenance UI."*
 *
 * So `TEMPLATE` below is not a list the validator happens to consult. It is
 * the only place a part is named. `parseEntry` derives its required set from
 * it, `test/rules/schema.test.ts` derives its assertions from it, and the
 * maintenance form of Phase 3 is required to derive its fields from it — which
 * is why every part carries a `shape` (what control draws it) and an `asks`
 * (what the control is labelled) rather than only a name. A second table with
 * the labels in it would be the drift this store exists to end, arriving in
 * the store itself.
 *
 * ── WHAT THIS MODULE MAY IMPORT ────────────────────────────────────────────
 *
 * `core/frontmatter.ts` and nothing else from `src/core/`. The store is not a
 * corpus category (spec §7): the corpus must not depend on it and it must not
 * depend on the corpus, because every edge between them is a place the store
 * leaks into `list`, `ready`, `doctor` or the injection selector.
 * `test/rules/isolation.test.ts` is the guard on that, in both directions.
 */
import { parseFrontmatter, type FrontmatterValue } from '../core/frontmatter.ts';

export type Kind = 'fact' | 'prohibition' | 'procedure' | 'standard' | 'definition';

/**
 * Spec §3. `product` reaches a user; `developer` applies only when the
 * workspace being worked on IS my_context. New entries default to `developer`
 * — the blast radius of a misfiled developer rule is one workspace, and a
 * misfiled product rule ships to everyone — but that default belongs to the
 * maintenance tool that CREATES an entry, not here: a file on disk states its
 * tier, and inferring one for a file that forgot to would be exactly the
 * silent widening the default exists to prevent.
 */
export type Tier = 'product' | 'developer';

export const KINDS: readonly Kind[] = ['fact', 'prohibition', 'procedure', 'standard', 'definition'];
export const TIERS: readonly Tier[] = ['product', 'developer'];

/**
 * What control draws this part, and therefore what a legal value looks like.
 *
 * `list` is not decoration: `steps` is *ordered steps*, and a procedure whose
 * steps arrived as one sentence has lost the ordering that makes it a
 * procedure. The frontmatter parser reads an indented `- ` block as an array
 * and a bare scalar as a string, so the two are distinguishable on disk and
 * the wrong one is refused rather than coerced.
 */
export type PartShape = 'text' | 'list';

export interface Part {
  /** The frontmatter key, and the form field's name. */
  name: string;
  shape: PartShape;
  /** What the form asks for, and what the refusal explains. One sentence. */
  asks: string;
}

/**
 * **THE TABLE.** Spec §4's first table, executable.
 *
 * Rejected kinds and why, kept here because the absence is the decision:
 * *anti-pattern* is a prohibition with a reason (one idea in two places),
 * *boundary* is also a prohibition, and mirroring the corpus categories would
 * import a lifecycle these entries do not have.
 */
export const TEMPLATE: Record<Kind, readonly Part[]> = {
  fact: [
    { name: 'truth', shape: 'text', asks: 'what is true about how the tool behaves' },
    { name: 'breaks', shape: 'text', asks: 'what breaks if you assume otherwise' },
  ],
  prohibition: [
    { name: 'prohibition', shape: 'text', asks: 'what must not be done' },
    // Load-bearing, and not theoretically: `archive/47`'s lane recorded four
    // separate lanes working around a red gate because it was labelled
    // "known-red" with no reason attached. An unreasoned prohibition gets
    // rationalised away the first time it is inconvenient.
    { name: 'why', shape: 'text', asks: 'why — an unreasoned prohibition gets rationalised away' },
  ],
  procedure: [
    { name: 'steps', shape: 'list', asks: 'the steps, in order' },
    { name: 'proof', shape: 'text', asks: 'how you know it worked' },
  ],
  standard: [
    // Spec §5: a standard names the ACT it governs, not a path glob. Everything
    // in the store is present at all times, so the trigger does not gate
    // delivery — it answers which of several format rules applies to what is
    // being done right now, and it is what makes obedience measurable at all.
    { name: 'trigger', shape: 'text', asks: 'the act this governs — "asking the owner to decide"' },
    { name: 'shape', shape: 'text', asks: 'how it must look' },
  ],
  definition: [
    { name: 'term', shape: 'text', asks: 'the word' },
    { name: 'means', shape: 'text', asks: 'what it means here' },
    { name: 'confusedWith', shape: 'text', asks: 'what it is confused with' },
  ],
};

/**
 * Spec §4's second table — the two parts EVERY kind requires, added on owner
 * review 2026-09-10.
 *
 * `example` is what stops an entry being arguable: *"never `git add -A`"* is
 * weak, and *"never `git add -A` — on 2026-09-09 a bare `git commit` swept
 * another lane's staged work into a commit about a table border"* is not.
 *
 * `check` is §4's argument turned on this store: if an enforced check beats
 * prose 37.6% to 57.5%, an entry that COULD be checked and is not has chosen
 * the weaker form, and requiring the field makes that choice visible.
 */
export const ALWAYS: readonly Part[] = [
  { name: 'example', shape: 'text', asks: 'one concrete instance' },
  {
    name: 'check',
    shape: 'text',
    asks: 'preventive:<name>, detective:<name>, or none - <reason>',
  },
];

/** Every part `kind` requires: its own, then the two every kind carries. */
export function partsOf(kind: Kind): readonly Part[] {
  return [...TEMPLATE[kind], ...ALWAYS];
}

/**
 * A check is PREVENTIVE or DETECTIVE, and spec §4 argues the difference is not
 * cosmetic: `preventive` refuses before the fact and is available only where
 * we own the write path; `detective` reports after the fact from the archive,
 * and is the ONLY kind available for a rule about the assistant's own output.
 *
 * Collapsing the two would make every entry governing the assistant declare
 * `none`, and that would be false — those entries are measurable, just not
 * preventable. `none` is legal, written the way `@basis none - <reason>`
 * already works here, and is meant to be rare.
 */
export type Check =
  | { how: 'preventive' | 'detective'; name: string }
  | { how: 'none'; why: string };

export interface Entry {
  id: string;
  kind: Kind;
  tier: Tier;
  title: string;
  /** The prose after the frontmatter. */
  body: string;
  /** Every part of this kind's template, by name. `list` parts arrive as arrays. */
  parts: Record<string, string | string[]>;
  example: string;
  check: Check;
  /** `standard` only — `parts.trigger` surfaced, never a second copy of it. */
  trigger?: string;
  /** Spec §6: the owner's own words. Documentation only; never injected. */
  request?: string;
  sourcePath: string;
}

export interface EntryError {
  /** One sentence, naming the part or field at fault. */
  error: string;
  /** The file, so a refusal can be opened rather than hunted for. */
  path: string;
  /** The id, when the file got far enough to have one. */
  id?: string;
}

/** The fields an entry carries that are not parts of its template. */
const FRAME = ['id', 'kind', 'tier', 'title'] as const;
/** Optional, on every kind. */
const OPTIONAL = ['request'] as const;

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/;

function refuse(path: string, error: string, id?: string): EntryError {
  return id === undefined ? { error, path } : { error, path, id };
}

/**
 * `preventive:<name>` · `detective:<name>` · `none - <reason>`.
 *
 * An em dash is accepted beside the hyphen because the design writes it that
 * way and a store entry copied out of the design must not be refused for its
 * punctuation.
 */
function parseCheck(raw: string): Check | string {
  const value = raw.trim();
  for (const how of ['preventive', 'detective'] as const) {
    if (!value.startsWith(`${how}:`)) continue;
    const name = value.slice(how.length + 1).trim();
    if (name === '') {
      return `\`check\` says "${how}" and names no check after the colon. Write ` +
        `\`${how}:<name>\`, or \`none - <reason>\` if there is genuinely nothing.`;
    }
    return { how, name };
  }
  if (value === 'none' || value.startsWith('none ') || value.startsWith('none-')) {
    const reason = value.slice(4).replace(/^\s*[-—–]\s*/, '').trim();
    if (reason === '') {
      return '`check: none` carries no reason. `none` is a legal answer and a bare `none` is ' +
        'not — write `none - <why nothing checks this>`, the way `@basis none - <reason>` ' +
        'already works here. A `none` on an entry the archive could measure is a defect.';
    }
    return { how: 'none', why: reason };
  }
  return `\`check\` must be \`preventive:<name>\`, \`detective:<name>\`, or \`none - <reason>\` ` +
    `(got ${JSON.stringify(value)}). preventive refuses before the fact and is available only ` +
    `where we own the write path; detective reports after the fact from the archive, and is the ` +
    `only kind available for a rule about the assistant's own output.`;
}

function text(value: FrontmatterValue): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * Parse one entry file. Returns the entry, or a refusal naming what is wrong —
 * **never throws and never returns a partial entry**.
 *
 * A throw here would travel up through `loadRules` and take the whole store
 * down for one bad file, which is the opposite of what `INV-nothing-is-dropped-
 * silently` asks for: the store loads what it can and NAMES what it could not,
 * one refusal per file, so a damaged entry is visible rather than absent.
 */
export function parseEntry(entryText: string, path: string): Entry | EntryError {
  const fence = FENCE.exec(entryText.replace(/^﻿/, '').trimStart());
  if (fence === null) {
    return refuse(path, 'no frontmatter: an entry is Markdown opening with a `---` fenced block, ' +
      'exactly as a corpus item is. This file has none, so there is nothing to validate.');
  }

  let data: Record<string, FrontmatterValue>;
  try {
    data = parseFrontmatter(fence[1]);
  } catch (err) {
    return refuse(path, `frontmatter did not parse: ${err instanceof Error ? err.message : String(err)}`);
  }

  const id = text(data.id);
  if (id === null) return refuse(path, '`id` is missing or empty. An entry is named or it cannot be cited.');

  const kindRaw = text(data.kind);
  if (kindRaw === null || !(KINDS as readonly string[]).includes(kindRaw)) {
    return refuse(path, `\`kind\` must be one of ${KINDS.join(', ')} (got ` +
      `${JSON.stringify(kindRaw ?? null)}). A template per kind is the whole schema, so a kind ` +
      `with no template validates nothing.`, id);
  }
  const kind = kindRaw as Kind;

  const tierRaw = text(data.tier);
  if (tierRaw === null || !(TIERS as readonly string[]).includes(tierRaw)) {
    return refuse(path, `\`tier\` must be one of ${TIERS.join(', ')} (got ` +
      `${JSON.stringify(tierRaw ?? null)}). \`product\` reaches a user and \`developer\` never ` +
      `leaves this workspace, so an unstated tier is a decision nobody took.`, id);
  }
  const tier = tierRaw as Tier;

  const title = text(data.title);
  if (title === null) return refuse(path, '`title` is missing or empty.', id);

  const parts: Record<string, string | string[]> = {};
  for (const part of partsOf(kind)) {
    const value = data[part.name];
    if (value === undefined || value === null || value === '') {
      return refuse(path, `a \`${kind}\` requires \`${part.name}\` — ${part.asks} — and this ` +
        `entry has none.`, id);
    }
    if (part.shape === 'list') {
      if (!Array.isArray(value) || value.length === 0) {
        return refuse(path, `\`${part.name}\` on a \`${kind}\` is a list — ${part.asks} — and ` +
          `this entry writes it as a single value. Written as one sentence the ordering that ` +
          `makes it a ${kind} is gone.`, id);
      }
      parts[part.name] = value;
      continue;
    }
    if (Array.isArray(value)) {
      return refuse(path, `\`${part.name}\` on a \`${kind}\` is a single value — ${part.asks} — ` +
        `and this entry writes it as a list.`, id);
    }
    parts[part.name] = String(value);
  }

  const check = parseCheck(String(parts.check));
  if (typeof check === 'string') return refuse(path, check, id);

  /**
   * **The template is a ceiling as well as a floor.** A `fact` carrying a
   * `why` is either a prohibition filed as a fact or a field nothing reads,
   * and spec §7 rules out the corpus lifecycle fields by name — `status`,
   * `supersedes`, `always`, `valid_until` — because "these are constants, not
   * items with a life". A field that merely went unread would let the store
   * look like it had a lifecycle it does not have.
   */
  const allowed = new Set<string>([
    ...FRAME, ...OPTIONAL, ...partsOf(kind).map((p) => p.name),
  ]);
  const stray = Object.keys(data).filter((key) => !allowed.has(key)).sort();
  if (stray.length > 0) {
    const otherKind = KINDS.find((k) => k !== kind && TEMPLATE[k].some((p) => stray.includes(p.name)));
    return refuse(path, `\`${stray.join('`, `')}\` ${stray.length === 1 ? 'is not a field' : 'are not fields'} ` +
      `a \`${kind}\` has. ${otherKind !== undefined
        ? `\`${stray[0]}\` belongs to a \`${otherKind}\` — this entry may be filed under the wrong kind.`
        : 'The store has no lifecycle: no status, no supersedes, no always, no valid_until. ' +
          'These are constants, not items with a life.'}`, id);
  }

  const request = text(data.request ?? null);
  const entry: Entry = {
    id,
    kind,
    tier,
    title,
    body: (fence[2] ?? '').trim(),
    parts,
    example: String(parts.example),
    check,
    sourcePath: path,
  };
  // Surfaced from `parts`, never stored twice: `trigger` is a part of the
  // `standard` template and this is a view over it, so the two cannot disagree.
  if (kind === 'standard') entry.trigger = String(parts.trigger);
  if (request !== null) entry.request = request;
  return entry;
}
