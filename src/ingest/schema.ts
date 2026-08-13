import type { Config } from '../core/config.ts';
import {
  validateBody, validateExtra, validateObservationCategory, validateObservationContext,
  validateObservationTags, validateObservationText, validateScope, validateTags, validateTitle,
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
const CANDIDATE_FIELD_DEFS: { name: string; required: boolean; schema: Record<string, unknown> }[] = [
  { name: 'type', required: true, schema: { type: 'string', description: 'One of the enabled categories listed in this request.' } },
  { name: 'title', required: true, schema: { type: 'string', maxLength: MAX_TITLE, description: 'One declarative sentence stating what must hold.' } },
  { name: 'body', required: true, schema: { type: 'string', description: 'The rationale: why this holds, and what breaks if it does not.' } },
  { name: 'quote', required: true, schema: { type: 'string', description: 'A verbatim span copied from the chunk. Never paraphrase — a paraphrased quote is rejected.' } },
  { name: 'severity', required: false, schema: { enum: ['hard', 'soft'], description: 'hard = a future enforcement candidate. Default soft.' } },
  {
    name: 'scope', required: false, schema: {
      type: 'array', items: { type: 'string' },
      description: 'POSIX globs of the code this governs, e.g. "src/auth/**". Omit when unknown — an unscoped item is indexed but never auto-injected. A bare "**" is rejected.',
    },
  },
  { name: 'tags', required: false, schema: { type: 'array', items: { type: 'string' } } },
  {
    name: 'observations', required: false, schema: {
      type: 'array',
      items: {
        type: 'object', required: ['category', 'text'], additionalProperties: false,
        properties: {
          category: { type: 'string' },
          text: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          context: { type: 'string', description: 'Optional qualifier, e.g. "at registration".' },
        },
      },
    },
  },
  {
    name: 'extra', required: false, schema: {
      type: 'object', additionalProperties: { type: 'string' },
      description: 'Category-specific fields, e.g. {"kind":"functional"} for a requirement, {"directive":"dont"} for a rule.',
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
        let text = o.text.trim();
        try {
          validateObservationCategory(o.category, `observations[${i}].category`);
          // Validated on the RAW (pre-collapse) text, deliberately: this is
          // what catches a line break, "#", or a trailing parenthetical —
          // none of which the whitespace collapse just below would change
          // the presence of, EXCEPT a line break, which the collapse WOULD
          // silently erase into a space if it ran first. Line breaks must
          // be a rejection, not a silent fix — see the collapse's own
          // comment for why it is the one sanctioned exception and this
          // is not — so the order here is load-bearing: validate first.
          validateObservationText(text, `observations[${i}].text`);
        } catch (err) {
          return reject(messageOf(err));
        }
        // THE ONE SANCTIONED **LOSSY** NORMALIZATION IN THIS FILE — read
        // this before "fixing" it back. (`.trim()` elsewhere in this file
        // is also a normalization, but a lossless one — it only removes
        // whitespace nothing downstream would ever see anyway. This one is
        // different: it changes interior content.) `parseObservations`
        // (item.ts) unconditionally collapses every run of whitespace in
        // observation text to a single space (`.replace(/\s+/g, ' ')`) on
        // the way back off disk. A model that writes "a  b" (a double
        // space — routine after a sentence-ending period) or "a\tb" would
        // otherwise validate here, get written, and come back as "a b"
        // with a checksum that can never match. Every OTHER normalization
        // this project refuses — lowercasing a category, silently
        // truncating at a parenthesis — changes what the text MEANS or IS;
        // collapsing a whitespace run changes neither, and there is no
        // lossless alternative: Markdown itself collapses runs of spaces
        // on render, so preserving "a  b" literally would only buy a value
        // nothing downstream can ever actually distinguish from "a b"
        // again. Safe to run only now, AFTER `validateObservationText` has
        // already confirmed `text` carries no line break to collapse away.
        text = text.replace(/\s+/g, ' ');

        const oTags = readStringArray(o.tags, `observations[${i}].tags`, reject);
        if (oTags === undefined) return;
        try {
          validateObservationTags(oTags, `observations[${i}].tags`);
        } catch (err) {
          return reject(messageOf(err));
        }

        const rawContext = typeof o.context === 'string' ? o.context.trim() : '';
        const context = rawContext !== '' ? rawContext : null;
        try {
          validateObservationContext(context, `observations[${i}].context`);
        } catch (err) {
          return reject(messageOf(err));
        }

        observations.push({ category: o.category, text, tags: oTags, context });
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
