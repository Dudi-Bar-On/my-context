/**
 * **How every MCP tool DECLARES its arguments and READS them back.**
 *
 * The coercers (`str`, `optStr`, `optBool`, `optNum`, `optList`, `optEnum`,
 * `optObservations`, `optExtra`) and the three JSON-Schema atoms (`object`,
 * `S_STRING`, `S_STRINGS`) between them are what all 28 tool specs are written
 * in: every `schema:` is built from the atoms and every `run:` body reads its
 * arguments through the coercers. They were 182 lines at the top of
 * `tools.ts`, above 2,200 lines of specs that all depended on them and that
 * none of them depended on — a one-way seam, which is the only kind a module
 * can be cut along.
 *
 * Moved out by
 * `TASK-26-tool-specs-keep-their-handlers-inline-where-one-already`, and for
 * the reason that item gives: `src/mcp/tools/ingest.ts` had already taken one
 * tool's logic out of `tools.ts`, and the other tools could not follow while
 * the vocabulary they are written in lived in the file they would be leaving.
 * A handler module importing its coercers back from `tools.ts`, with `tools.ts`
 * importing the handler, is a cycle. `src/doctor/finding.ts` and
 * `src/ui/read-model-base.ts` are the same move in the other two directories.
 *
 * **`ingest.ts` does not use the atoms and writes its schema out by hand**
 * (`INGEST_DOCUMENT_SCHEMA`, `{ type: 'object', properties: … }`). That is a
 * second spelling of `object(...)`, reported rather than changed here: it is
 * the one schema in the product not written in this vocabulary, and rewriting
 * it is a change to a shipped tool's declaration that belongs in its own act.
 *
 * Every line below is the line that shipped, moved and not rewritten.
 */
import type { Observation } from '../../core/types.ts';
import { enumError, missingFieldError } from '../../core/teach.ts';

export type Args = Record<string, unknown>;

export function str(args: Args, key: string, tool: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(missingFieldError(key, tool, 'capture'));
  }
  return value;
}

/**
 * Absent keys are fine — every field on this whole surface (`optStr`,
 * `optBool`, `optNum`, `optList`, `optEnum`, `optObservations`, `optExtra`)
 * is optional, and an explicit JSON `null` is treated the same as absent
 * everywhere: it is a common way a model spells "not set", not a
 * wrong-typed value — the same reading `optObservations`'s per-entry
 * `context: null` already relies on one level down. A *present, non-null*
 * key of the wrong type is not fine: silently ignoring it (the previous
 * behaviour) reports success while changing nothing, e.g.
 * `update_item({title: 12345})` returned "updated" without ever touching
 * the title. Every helper below applies that same reasoning to its own
 * shape — scalars, arrays, enums, or the observations/extra objects.
 */
export function optStr(args: Args, key: string): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`my_context: "${key}" must be a string. You passed ${JSON.stringify(value)}.`);
  }
  return value;
}

export function optBool(args: Args, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') {
    throw new Error(`my_context: "${key}" must be a boolean. You passed ${JSON.stringify(value)}.`);
  }
  return value;
}

/** `undefined` or explicit `null` keeps the caller's fallback; a
 * present-and-non-null but invalid `limit` (non-number, zero, negative,
 * non-finite) is refused rather than silently replaced by the fallback, for
 * the same reason `optStr`/`optBool` refuse. */
export function optNum(args: Args, key: string, fallback: number): number {
  const value = args[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`my_context: "${key}" must be a positive number. You passed ${JSON.stringify(value)}.`);
  }
  return value;
}

/**
 * Arrays are validated rather than coerced. A model that passes a bare string
 * for `scope` has misunderstood the field, and silently wrapping it produces a
 * plausible-looking item with a glob that never matches. `null` is absent,
 * same as every other optional field on this surface — only a genuinely
 * wrong type (a string, a number, an array with a non-string element) throws.
 */
export function optList(args: Args, key: string): string[] | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new Error(
      `my_context: "${key}" must be an array of strings, e.g. ["src/db/**"]. ` +
      `See mycontext_help("scope").`,
    );
  }
  return value as string[];
}

/** `null` is absent, same as every other optional field on this surface —
 * only a present value that is not a string, or not a member of `allowed`,
 * is a genuine enum violation. */
export function optEnum<T extends string>(
  args: Args, key: string, allowed: string[], topic: 'categories' | 'workflow' | 'capture',
): T | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(enumError(key, String(value), allowed, topic));
  }
  return value as T;
}

/**
 * `category` and `text` are required strings, not defaulted or coerced: a
 * missing `category` silently becoming `'note'`, or a non-string `text`
 * silently going through `String()`, is the same plausible-looking-but-wrong
 * outcome `optStr`/`optBool` refuse above — an observation the model thinks
 * it wrote correctly is instead stored as something else entirely.
 * `observations: null` (the whole field) is absent, same as every other
 * optional field on this surface; a per-entry `context: null` below is a
 * different, deliberate case — see that check — and is left exactly as is.
 */
export function optObservations(args: Args): Observation[] | undefined {
  const value = args.observations;
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(
      'my_context: "observations" must be an array of ' +
      '{ category, text } objects. See mycontext_help("capture").',
    );
  }
  return value.map((raw, i) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    if (typeof entry.category !== 'string' || entry.category.trim() === '') {
      throw new Error(
        `my_context: observations[${i}] is missing "category", a required string. ` +
        `See mycontext_help("capture").`,
      );
    }
    if (typeof entry.text !== 'string' || entry.text.trim() === '') {
      throw new Error(
        `my_context: observations[${i}] is missing "text", a required string. ` +
        `See mycontext_help("capture").`,
      );
    }
    if (entry.tags !== undefined && (!Array.isArray(entry.tags) || entry.tags.some((t) => typeof t !== 'string'))) {
      throw new Error(`my_context: observations[${i}].tags must be an array of strings.`);
    }
    if (entry.context !== undefined && entry.context !== null && typeof entry.context !== 'string') {
      throw new Error(`my_context: observations[${i}].context must be a string.`);
    }
    return {
      category: entry.category,
      text: entry.text,
      tags: (entry.tags as string[] | undefined) ?? [],
      context: (entry.context as string | undefined) ?? null,
    };
  });
}

/** `update_item`'s `extra` merges into the item's existing extra fields
 * (`mutate.ts`'s `updateItem` does the merge and validates keys/collisions);
 * this only checks the shape at the boundary — an object of string values.
 * An explicit `extra: null` is treated the same as omitting `extra`
 * entirely, same as every other optional field here. */
export function optExtra(args: Args): Record<string, string> | undefined {
  const value = args.extra;
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      'my_context: "extra" must be an object of string values, e.g. {"kind": "functional"}. ' +
      'See mycontext_help("capture").',
    );
  }
  const out: Record<string, string> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== 'string') {
      throw new Error(`my_context: "extra.${key}" must be a string. You passed ${JSON.stringify(v)}.`);
    }
    // `defineProperty`, not `out[key] = v`. Plain assignment with the key
    // `__proto__` sets `out`'s PROTOTYPE instead of creating an own
    // property, so the field vanishes here — before `validateExtra`
    // (mutate.ts) ever sees it, since that function iterates
    // `Object.entries`, which lists own properties only. The refusal
    // `validateExtra` exists to make was therefore unreachable through this
    // surface, and `update_item` reported "updated" having silently dropped
    // the field the caller asked for. `update_item` is the only surface that
    // takes free-form `extra` from a model, so this is the one path where
    // that mattered. Verified by execution before the fix: `extra` arrived
    // as `{"__proto__": "boom"}` from `JSON.parse` of the tool call and
    // reached `updateItem` as `{}`.
    Object.defineProperty(out, key, {
      value: v, writable: true, enumerable: true, configurable: true,
    });
  }
  return out;
}

export function object(
  properties: Record<string, unknown>, required: string[] = [],
): Record<string, unknown> {
  return { type: 'object', properties, required };
}

export const S_STRING = { type: 'string' };
export const S_STRINGS = { type: 'array', items: { type: 'string' } };
