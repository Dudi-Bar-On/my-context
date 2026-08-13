import type { Config } from '../core/config.ts';
import { validateExtra, validateObservationCategory, validateObservationText } from '../core/mutate.ts';
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
 * The JSON Schema embedded verbatim in every extraction request. It is data,
 * not executable validation — `validateCandidates` is the enforcing half, and
 * the two must be kept in step. The test asserts the required list matches.
 */
export const CANDIDATE_SCHEMA: Record<string, unknown> = {
  type: 'array',
  items: {
    type: 'object',
    required: ['type', 'title', 'body', 'quote'],
    additionalProperties: false,
    properties: {
      type: { type: 'string', description: 'One of the enabled categories listed in this request.' },
      title: { type: 'string', maxLength: MAX_TITLE, description: 'One declarative sentence stating what must hold.' },
      body: { type: 'string', description: 'The rationale: why this holds, and what breaks if it does not.' },
      quote: { type: 'string', description: 'A verbatim span copied from the chunk. Never paraphrase — a paraphrased quote is rejected.' },
      severity: { enum: ['hard', 'soft'], description: 'hard = a future enforcement candidate. Default soft.' },
      scope: {
        type: 'array', items: { type: 'string' },
        description: 'POSIX globs of the code this governs, e.g. "src/auth/**". Omit when unknown — an unscoped item is indexed but never auto-injected. A bare "**" is rejected.',
      },
      tags: { type: 'array', items: { type: 'string' } },
      observations: {
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
      extra: {
        type: 'object', additionalProperties: { type: 'string' },
        description: 'Category-specific fields, e.g. {"kind":"functional"} for a requirement, {"directive":"dont"} for a rule.',
      },
    },
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

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((e): e is string => typeof e === 'string').map((e) => e.trim()).filter(Boolean);
}

/** Collapse all whitespace so a quote survives re-wrapping between chunk and callback. */
function flatten(text: string): string {
  return normalizeEol(text).replace(/\s+/g, ' ').trim();
}

/** The message text of a thrown Error, or the stringified value for anything else. */
function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
    const reject = (message: string): void => { issues.push({ index, title, message }); };

    if (!isObject(entry)) return reject(`entry is ${Array.isArray(entry) ? 'an array' : typeof entry}, expected an object`);

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

    const body = typeof entry.body === 'string' ? entry.body.trim() : '';

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

    // A model that means to omit scope sends nothing; one that means "the
    // whole repo" is expected to write an array with a broad glob, not a
    // bare string. Silently coercing a bare string to [] would drop the
    // model's intent without telling it — reject instead.
    if (entry.scope !== undefined && !Array.isArray(entry.scope)) {
      return reject(
        `"scope" must be an array of glob strings, e.g. ["src/auth/**"]. You passed a ` +
        `${typeof entry.scope}, not an array.`,
      );
    }
    const scope = stringArray(entry.scope);
    const backslashed = scope.find((s) => s.includes('\\'));
    if (backslashed) {
      return reject(`scope glob "${backslashed}" contains a backslash. Scope globs are POSIX, e.g. "src/db/**".`);
    }
    const bare = scope.find((s) => s === '**' || s === '**/*' || s === '*');
    if (bare) {
      return reject(
        `scope glob "${bare}" is too broad — it matches the whole repository and defeats inert-by-default scoping. ` +
        `Name the directories this actually governs, or omit "scope" entirely. See help("scope").`,
      );
    }

    if (entry.tags !== undefined && !Array.isArray(entry.tags)) {
      return reject(`"tags" must be an array of strings. You passed a ${typeof entry.tags}, not an array.`);
    }

    if (entry.observations !== undefined && !Array.isArray(entry.observations)) {
      return reject(`"observations" must be an array of {category, text} objects. You passed a ${typeof entry.observations}, not an array.`);
    }

    // Every observation is validated against exactly the rules the write
    // boundary (mutate.ts) enforces — a category or text shape that cannot
    // survive the render/parse round trip is rejected HERE, with a message
    // naming the offending observation, rather than silently dropped (or
    // worse, corrupted) once it reaches createItem. Malformed observations
    // fail the whole candidate rather than being silently skipped: an
    // extraction call that asked for three observations and got one written
    // is a worse failure than a visible, explainable rejection.
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
        const text = o.text.trim();
        try {
          validateObservationCategory(o.category, `observations[${i}].category`);
          validateObservationText(text, `observations[${i}].text`);
        } catch (err) {
          return reject(messageOf(err));
        }
        observations.push({
          category: o.category,
          text,
          tags: stringArray(o.tags),
          context: typeof o.context === 'string' && o.context.trim() !== '' ? o.context.trim() : null,
        });
      }
    }

    if (entry.extra !== undefined && !isObject(entry.extra)) {
      return reject(`"extra" must be an object of string values, e.g. {"kind":"functional"}. You passed a ${Array.isArray(entry.extra) ? 'an array' : typeof entry.extra}.`);
    }
    const extra: Record<string, string> = {};
    if (isObject(entry.extra)) {
      for (const [key, value] of Object.entries(entry.extra)) {
        if (value === null || value === undefined) continue;
        if (Array.isArray(value) || isObject(value)) {
          return reject(`extra.${key} must be a string; nested objects and arrays are not supported and would be lost. Flatten it to a string.`);
        }
        extra[key] = String(value);
      }
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
      tags: stringArray(entry.tags),
      observations,
      extra,
    });
  });

  return { valid, issues };
}
