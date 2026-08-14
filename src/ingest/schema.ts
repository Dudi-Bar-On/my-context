import type { Config } from '../core/config.ts';
import {
  normalizeObservations, validateBody, validateExtra, validateScope, validateTags, validateTitle,
} from '../core/mutate.ts';
import { enumError } from '../core/teach.ts';
import { normalizeEol, type Chunk } from './chunk.ts';

/** Exactly `Observation` from core/types.ts, so Task 4 passes it through unchanged. */
export interface CandidateObservation {
  category: string;
  text: string;
  tags: string[];
  context: string | null;
}

export interface Candidate {
  type: string;
  title: string;
  body: string;
  /** A verbatim span from the source chunk. The grounding check, not a quality check. */
  quote: string;
  severity: 'hard' | 'soft';
  scope: string[];
  tags: string[];
  observations: CandidateObservation[];
  extra: Record<string, string>;
}

export const MAX_TITLE = 200;

/**
 * One entry per top-level candidate field. This is the SINGLE source of
 * truth for both `CANDIDATE_SCHEMA` (below) and the unknown-field check in
 * `validateCandidates` — the schema's declared shape and the validator's
 * enforced shape are therefore structurally the same array, not two
 * hand-written lists that can silently drift apart. `test/ingest/schema.test.ts`
 * asserts this by comparing the schema's property keys against
 * `CANDIDATE_FIELDS`, which is derived from this array too.
 */
/**
 * One entry per observation key, and — like `CANDIDATE_FIELD_DEFS` below —
 * the SINGLE source of truth for both the schema the model is shown and the
 * unknown-key check `validateCandidates` enforces. Declared separately (and
 * referenced by the `observations` entry below) rather than reached into
 * through the assembled schema object, so `OBSERVATION_FIELDS` is a plain
 * `Object.keys` of the same record the schema publishes and cannot drift
 * from it.
 */
const OBSERVATION_PROPERTIES: Record<string, Record<string, unknown>> = {
  category: {
    type: 'string',
    description: 'Lowercase letters, digits, underscore and hyphen only (e.g. "root-cause"), no ' +
      'spaces or other punctuation — anything else makes this observation unreadable and it is ' +
      'silently dropped when the item is read back from disk.',
  },
  text: {
    type: 'string',
    description: 'Must not contain "#" (read back as a tag marker) and must not end in a ' +
      'parenthetical like "(...)" (read back as "context") — either silently strips content ' +
      'from this text when the item is read back from disk. Use "tags"/"context" instead.',
  },
  tags: { type: 'array', items: { type: 'string' }, description: 'Must be an array of strings, not a single string.' },
  context: { type: 'string', description: 'Optional qualifier, e.g. "at registration". Must not contain parentheses.' },
};

/** Every key an observation may carry. Not in this list: rejected. */
export const OBSERVATION_FIELDS: string[] = Object.keys(OBSERVATION_PROPERTIES);

const CANDIDATE_FIELD_DEFS: { name: string; required: boolean; schema: Record<string, unknown> }[] = [
  { name: 'type', required: true, schema: { type: 'string', description: 'One of the enabled categories listed in this request.' } },
  { name: 'title', required: true, schema: { type: 'string', maxLength: MAX_TITLE, description: 'One declarative sentence stating what must hold. Must be a single line — no line breaks.' } },
  {
    name: 'body', required: true, schema: {
      type: 'string',
      description: 'The rationale: why this holds, and what breaks if it does not. Plain prose only — ' +
        'no line may start with a Markdown heading ("#" through "######", e.g. "## Why"). A heading line ' +
        'and everything after it is silently dropped when the item is read back from disk.',
    },
  },
  { name: 'quote', required: true, schema: { type: 'string', description: 'A verbatim span copied from the chunk. Never paraphrase — a paraphrased quote is rejected.' } },
  { name: 'severity', required: false, schema: { enum: ['hard', 'soft'], description: 'hard = a future enforcement candidate. Default soft.' } },
  {
    name: 'scope', required: false, schema: {
      type: 'array', items: { type: 'string' },
      description: 'POSIX globs of the code this governs, e.g. "src/auth/**". Must be an array of strings, not a ' +
        'single string. Omit when unknown — an unscoped item is indexed but never auto-injected. ' +
        '"**", "*" and "**/*" are all rejected as too broad — name the directories this actually governs.',
    },
  },
  { name: 'tags', required: false, schema: { type: 'array', items: { type: 'string' }, description: 'Must be an array of strings, not a single string.' } },
  {
    name: 'observations', required: false, schema: {
      type: 'array',
      items: {
        type: 'object', required: ['category', 'text'], additionalProperties: false,
        properties: OBSERVATION_PROPERTIES,
      },
    },
  },
  {
    name: 'extra', required: false, schema: {
      type: 'object', additionalProperties: { type: 'string' },
      description: 'Category-specific fields, e.g. {"kind":"functional"} for a requirement, {"directive":"dont"} ' +
        'for a rule. Keys must be letters, digits and underscore only, and not start with a digit ' +
        '(e.g. "validate_by", not "validate-by") — any other character makes the item unreadable on the next ' +
        'rebuild. Keys must also not collide with a reserved frontmatter field name (e.g. "source_file", ' +
        '"status", "id") — that would silently overwrite the real field on disk.',
    },
  },
];

/** Every top-level key a candidate may carry. Not part of this list: rejected. */
export const CANDIDATE_FIELDS: string[] = CANDIDATE_FIELD_DEFS.map((f) => f.name);

/**
 * The JSON Schema embedded verbatim in every extraction request. It is data,
 * not executable validation — `validateCandidates` is the enforcing half.
 * Built from `CANDIDATE_FIELD_DEFS` above, so its `required` list and
 * `properties` keys cannot drift from what the validator actually reads.
 */
export const CANDIDATE_SCHEMA: Record<string, unknown> = {
  type: 'array',
  items: {
    type: 'object',
    required: CANDIDATE_FIELD_DEFS.filter((f) => f.required).map((f) => f.name),
    additionalProperties: false,
    properties: Object.fromEntries(CANDIDATE_FIELD_DEFS.map((f) => [f.name, f.schema])),
  },
};

export interface ValidationIssue {
  /**
   * Position in the submitted array. -1 when the issue is not about one
   * submitted entry: a malformed payload here, and in Task 4 a write that the
   * trust model refused after validation had already passed.
   */
  index: number;
  title: string | null;
  message: string;
}

export interface ValidationResult {
  valid: Candidate[];
  issues: ValidationIssue[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Collapse all whitespace so a quote survives re-wrapping between chunk and callback. */
function flatten(text: string): string {
  return normalizeEol(text).replace(/\s+/g, ' ').trim();
}

/** The message text of a thrown Error, or the stringified value for anything else. */
function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** "an array" / "an object" / "a string" / "null" — for grammatically correct "you passed ..." messages. */
function describeValue(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'an array';
  const t = typeof v;
  return /^[aeiou]/i.test(t) ? `an ${t}` : `a ${t}`;
}

/**
 * Reads `v` as an optional array of usable strings for `field` (e.g.
 * `"scope"`, `"tags"`, `"observations[2].tags"`). Returns `[]` when `v` is
 * `undefined`. On any problem — not an array, or an element that isn't a
 * non-empty string — calls `reject` with a message naming the exact element
 * and returns `undefined`, so the caller can bail out of the whole
 * candidate rather than silently dropping the bad element (as a plain
 * `.filter(Boolean)` would). Line-break safety is NOT this function's job:
 * that is `validateScope`/`validateTags`/`validateObservationTags`
 * (mutate.ts), called separately by each caller below on the array this
 * returns — the same shared functions `createItem`'s other callers use, so
 * the rule can't drift into two copies.
 */
function readStringArray(v: unknown, field: string, reject: (message: string) => void): string[] | undefined {
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    reject(`"${field}" must be an array of strings. You passed ${describeValue(v)}, not an array.`);
    return undefined;
  }
  const out: string[] = [];
  for (let i = 0; i < v.length; i++) {
    const el: unknown = v[i];
    if (typeof el !== 'string' || el.trim() === '') {
      reject(`${field}[${i}] must be a non-empty string. You passed ${JSON.stringify(el)}.`);
      return undefined;
    }
    out.push(el.trim());
  }
  return out;
}

export function validateCandidates(raw: unknown, config: Config, chunk: Chunk): ValidationResult {
  const valid: Candidate[] = [];
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(raw)) {
    issues.push({
      index: -1,
      title: null,
      message:
        `expected a JSON array of candidate items, got ${raw === null ? 'null' : typeof raw}. ` +
        `Return [] when a chunk contains nothing normative.`,
    });
    return { valid, issues };
  }

  const enabled = Object.values(config.categories)
    .filter((c) => c.enabled)
    .map((c) => c.name)
    .sort();
  const haystack = flatten(chunk.text);

  raw.forEach((entry, index) => {
    const title = isObject(entry) && typeof entry.title === 'string' ? entry.title.trim() : null;
    // Every message pushed here is a standalone teaching message, never a
    // thrown Error the caller has to unwrap — so any "my_context: " prefix
    // picked up from a reused mutate.ts/teach.ts error is stripped, keeping
    // every entry in `issues[]` in the same voice regardless of which check
    // produced it.
    const reject = (message: string): void => {
      issues.push({ index, title, message: message.replace(/^my_context:\s*/, '') });
    };

    if (!isObject(entry)) return reject(`entry is ${Array.isArray(entry) ? 'an array' : typeof entry}, expected an object`);

    const unknownKey = Object.keys(entry).find((k) => !CANDIDATE_FIELDS.includes(k));
    if (unknownKey) {
      return reject(
        `unknown field "${unknownKey}" — a candidate accepts only: ${CANDIDATE_FIELDS.join(', ')}. ` +
        `Fields such as the source anchor are assigned automatically from the chunk this candidate ` +
        `was drawn from, not supplied on the candidate itself.`,
      );
    }

    if (typeof entry.type !== 'string' || entry.type.trim() === '') {
      return reject(`"type" is required. Expected one of: ${enabled.join(', ')}.`);
    }
    const type = entry.type.trim().toLowerCase();
    if (!enabled.includes(type)) {
      // Prototype-unsafe lookup guarded the same way `resolveCategory`
      // (mutate.ts) guards it: a type of "constructor" must not resolve to
      // `Object.prototype.constructor` and report a nonsensical "disabled".
      if (Object.hasOwn(config.categories, type) && !config.categories[type].enabled) {
        return reject(
          `"type" must be an enabled category — "${type}" is a real category but is disabled ` +
          `in this project, so no new ${type} items are accepted. Enable it in ` +
          `.my_context/config.json under categories.${type}.enabled, or choose one of: ` +
          `${enabled.join(', ')}. See mycontext_help("categories").`,
        );
      }
      return reject(enumError('type', type, enabled, 'categories'));
    }

    if (!title) return reject('"title" is required and must be a non-empty string.');
    if (title.length > MAX_TITLE) {
      return reject(`"title" is ${title.length} characters; the limit is ${MAX_TITLE}. Move the detail into "body".`);
    }
    // Shared with `createItem`'s own title guard (mutate.ts) — a line break
    // corrupts the file whether it arrives through ingest or straight
    // through the MCP `create_item` tool, so one function guards both.
    try {
      validateTitle(title);
    } catch (err) {
      return reject(messageOf(err));
    }

    // Normalized ONCE, here, into the `body` that both `validateBody` and
    // the stored `Candidate` read — not validated-then-re-derived, and not
    // stored raw. `parseItem` (item.ts) normalizes line endings before
    // splitting the body into lines; a body carrying a lone '\r' (any
    // Windows- or old-Mac-authored source text — ingestion reads source
    // documents, so this is the routine case, not an exotic one) has no
    // literal '\n' to reveal a hidden '## ' heading to a naive check, and
    // storing the RAW (un-normalized) text here would mean the checksum
    // Task 4 computes at capture time could never match what a fresh hash
    // of the parsed, re-normalized file produces.
    const body = normalizeEol(typeof entry.body === 'string' ? entry.body : '').trim();
    try {
      validateBody(body);
    } catch (err) {
      return reject(messageOf(err));
    }

    if (typeof entry.quote !== 'string' || entry.quote.trim() === '') {
      return reject('"quote" is required: copy the verbatim sentence from the source chunk this item is drawn from.');
    }
    const quote = flatten(entry.quote);
    if (!haystack.includes(quote)) {
      return reject(
        `"quote" does not appear in the source chunk "${chunk.anchor}". ` +
        `Copy the text verbatim from the chunk; do not paraphrase, summarize, or quote a different section.`,
      );
    }

    let severity: 'hard' | 'soft' = 'soft';
    if (entry.severity !== undefined) {
      if (entry.severity !== 'hard' && entry.severity !== 'soft') {
        return reject(enumError('severity', String(entry.severity), ['hard', 'soft'], 'capture'));
      }
      severity = entry.severity;
    }

    // A model that omits scope sends nothing; a model that means to scope
    // this item is expected to send an array of glob strings. Silently
    // coercing a bare string to [] would drop that intent without telling
    // the model — reject the shape instead. (A glob that is deliberately
    // over-broad, e.g. "**", is a separate check below — this one is purely
    // about the array-vs-string shape.)
    const scope = readStringArray(entry.scope, 'scope', reject);
    if (scope === undefined) return;
    try {
      validateScope(scope);
    } catch (err) {
      return reject(messageOf(err));
    }
    const backslashed = scope.find((s) => s.includes('\\'));
    if (backslashed) {
      return reject(`scope glob "${backslashed}" contains a backslash. Scope globs are POSIX, e.g. "src/db/**".`);
    }
    const bare = scope.find((s) => s === '**' || s === '**/*' || s === '*');
    if (bare) {
      return reject(
        `scope glob "${bare}" is too broad — it matches the whole repository and defeats inert-by-default scoping. ` +
        `Name the directories this actually governs, or omit "scope" entirely. See mycontext_help("scope").`,
      );
    }

    const tags = readStringArray(entry.tags, 'tags', reject);
    if (tags === undefined) return;
    try {
      validateTags(tags);
    } catch (err) {
      return reject(messageOf(err));
    }

    if (entry.observations !== undefined && !Array.isArray(entry.observations)) {
      return reject(`"observations" must be an array of {category, text} objects. You passed ${describeValue(entry.observations)}, not an array.`);
    }

    // Every observation is validated against exactly the rules the write
    // boundary (mutate.ts) enforces, via the SAME exported functions
    // mutate.ts's own `createItem` calls (`validateObservationCategory`,
    // `validateObservationText`, `validateObservationTags`,
    // `validateObservationContext`) — not a second, local copy of those
    // rules. Both the MCP `create_item` surface and this ingest candidate
    // surface hand observations to `createItem` eventually, so validating
    // once, in the module both of them already depend on, is what keeps
    // them from drifting into two different (and possibly incomplete)
    // rule sets. Malformed observations fail the whole candidate rather
    // than being silently skipped: an extraction call that asked for three
    // observations and got one written is a worse failure than a visible,
    // explainable rejection.
    const observations: CandidateObservation[] = [];
    if (Array.isArray(entry.observations)) {
      for (let i = 0; i < entry.observations.length; i++) {
        const o = entry.observations[i];
        if (!isObject(o)) {
          return reject(`observations[${i}] must be an object with "category" and "text", got ${Array.isArray(o) ? 'an array' : typeof o}.`);
        }
        if (typeof o.category !== 'string' || o.category.trim() === '') {
          return reject(`observations[${i}].category is required and must be a non-empty string.`);
        }
        if (typeof o.text !== 'string' || o.text.trim() === '') {
          return reject(`observations[${i}].text is required and must be a non-empty string.`);
        }

        // The schema above declares `additionalProperties: false` for an
        // observation, and this is what makes that promise true. Without it
        // a key the reader does not consume — `"rationale": "NIST 800-63B"`
        // inside an observation — applied with `created 1` and zero issues,
        // and the field was simply gone: exactly the silent loss this whole
        // module exists to refuse, while the schema the model was shown said
        // the opposite. The accepted set is derived from the schema's own
        // `properties`, not restated, so the two cannot drift.
        const unknownObsKey = Object.keys(o).find((k) => !OBSERVATION_FIELDS.includes(k));
        if (unknownObsKey) {
          return reject(
            `observations[${i}] has an unknown field "${unknownObsKey}" — an observation accepts ` +
            `only: ${OBSERVATION_FIELDS.join(', ')}. Nothing else is stored, so this value would ` +
            `be lost. Fold it into "text", or add it as a separate observation.`,
          );
        }

        const oTags = readStringArray(o.tags, `observations[${i}].tags`, reject);
        if (oTags === undefined) return;

        // `context` is refused when present and not a string, rather than
        // coerced to `null`. The coercion was the same silent-drop class as
        // the unknown-field check immediately above, one field over: a model
        // that wrote `context: 42` — or `context: {at: "registration"}` — had
        // it discarded with `created 1` and zero issues, and the qualifier it
        // meant to attach simply did not exist in the stored item. `null` and
        // absent both legitimately mean "no context" and stay accepted.
        if (o.context !== undefined && o.context !== null && typeof o.context !== 'string') {
          return reject(
            `observations[${i}].context must be a string, or omitted. You passed ` +
            `${describeValue(o.context)}, which would be dropped and the qualifier lost. ` +
            `Fold it into "text" if it is not a short parenthetical.`,
          );
        }

        // Validation AND the whitespace collapse both come from
        // `normalizeObservations` (core/mutate.ts) — the function the MCP
        // `create_item` surface also goes through — rather than a copy of
        // those rules kept here. The collapse used to live in this file, so
        // it applied to ingested observations and NOT to ones a model wrote
        // interactively through `create_item`, where the same double space
        // produced a permanently mismatched checksum. One implementation,
        // both surfaces. See that function for why the collapse is the one
        // sanctioned lossy normalization and why it must run after, not
        // before, the line-break rejection.
        let normalized;
        try {
          normalized = normalizeObservations([{
            category: o.category,
            text: o.text,
            tags: oTags,
            context: typeof o.context === 'string' ? o.context : null,
          }]);
        } catch (err) {
          return reject(messageOf(err).replace(/observations\[0\]/g, `observations[${i}]`));
        }

        observations.push(normalized[0]);
      }
    }

    if (entry.extra !== undefined && !isObject(entry.extra)) {
      return reject(`"extra" must be an object of string values, e.g. {"kind":"functional"}. You passed ${describeValue(entry.extra)}.`);
    }
    const extra: Record<string, string> = {};
    if (isObject(entry.extra)) {
      for (const [key, value] of Object.entries(entry.extra)) {
        // `null`/`undefined` are refused, not silently dropped: dropping a
        // key the model explicitly sent is the same silent-loss failure
        // this whole function exists to avoid for every other field. This
        // is a JSON-shape concern specific to untrusted candidate input —
        // `validateExtra` (mutate.ts) expects `Record<string, string>`
        // already, so it isn't the place for it.
        if (value === null || value === undefined) {
          return reject(`extra.${key} is ${JSON.stringify(value)}. Omit the key entirely instead of setting it to ${value === null ? 'null' : 'undefined'}.`);
        }
        if (Array.isArray(value) || isObject(value)) {
          return reject(`extra.${key} must be a string; nested objects and arrays are not supported and would be lost. Flatten it to a string.`);
        }
        extra[key] = String(value);
      }
      // Emptiness and line-break checks on the VALUES live in `validateExtra`
      // (mutate.ts) now, shared with `createItem`'s other callers, rather
      // than duplicated here.
      try {
        validateExtra(extra);
      } catch (err) {
        return reject(messageOf(err));
      }
    }

    valid.push({
      type, title, body, quote,
      severity,
      scope,
      tags,
      observations,
      extra,
    });
  });

  return { valid, issues };
}
