import type { Config } from '../core/config.ts';
import type { Chunk } from './chunk.ts';
import { CANDIDATE_SCHEMA, MAX_TITLE } from './schema.ts';
import { pendingAnchors, type IngestSession } from './session.ts';

export const EXTRACTION_PROTOCOL = 'my_context/extraction-request@1';

export interface RequestCategory {
  name: string;
  description: string;
  extraFields: string[];
}

export interface ExtractionRequest {
  protocol: string;
  session: string;
  sourceFile: string;
  anchor: string;
  chunkIndex: number;
  totalChunks: number;
  /** Chunks still pending, counting this one. */
  remaining: number;
  heading: string | null;
  categories: RequestCategory[];
  schema: Record<string, unknown>;
  chunk: string;
  callback: {
    cli: string;
    mcp: { tool: string; arguments: Record<string, unknown> };
  };
  instructions: string[];
}

/**
 * Every one of these lines states a rule `validateCandidates` (schema.ts) /
 * `createItem` (mutate.ts) actually enforces — not a paraphrase of it. Each
 * was checked against the real validator (see `test/ingest/request.test.ts`
 * and Task 5's review) before being written here: a request that teaches a
 * rule the validator does not enforce is harmless; one that FAILS to
 * mention a rule the validator DOES enforce produces a rejected candidate
 * the model had no way to avoid, which is the one failure mode this
 * function exists to prevent.
 */
function instructionsFor(request: Omit<ExtractionRequest, 'instructions'>): string[] {
  const remainingLine = request.remaining > 1
    ? `Including this one, ${request.remaining} chunks in this document still need extraction; the callback returns the next request automatically.`
    : 'This is the last pending chunk in this document.';

  return [
    'You are the extractor. my_context has no model of its own and never calls one — it hands you the text and validates what you return.',
    `Read the chunk below, taken from ${request.sourceFile} under the anchor "${request.anchor}", and extract every piece of NORMATIVE knowledge it establishes: things that must hold, must be built, must not be done, or are deliberately left open.`,
    'Do not extract narrative, status updates, or descriptions of what was done — that is claude-mem\'s job, not this one.',
    'Emit a JSON array matching the "schema" field. Return [] when the chunk establishes nothing normative — that is a correct and common answer, and the common case for prose that isn\'t a spec.',
    'Every candidate MUST carry a "quote": a span copied VERBATIM from the chunk. It is checked by exact match after whitespace collapsing, and a paraphrase is rejected. This is how an invented item is caught.',
    `"title" is one declarative sentence on a SINGLE LINE, at most ${MAX_TITLE} characters — no line breaks. Put the reasoning in "body".`,
    '"body" is plain prose: no line may start with a Markdown heading ("#" through "######", e.g. "## Why") — that line and everything after it is silently dropped when the item is read back from disk. Do not structure the rationale with headings; use plain paragraphs.',
    '"scope", "tags" and "observations" must each be a JSON ARRAY — never a bare string. Scope RESTRICTS where an item applies: set it only to the directories the item actually governs, as POSIX globs such as "src/auth/**". "**", "*" and "**/*" are all rejected, because omitting "scope" already means exactly that. Omitting scope is safe and is the right answer when the item is not about particular files — it simply leaves the item unrestricted, so it applies everywhere.',
    '"severity" is "hard" (a future enforcement candidate) or "soft" (the default) — omit it to get "soft".',
    'Each observation\'s "category" must be lowercase letters, digits, underscore and hyphen only (e.g. "root-cause", not "Root Cause") — anything else silently drops the whole observation on the next read. Its "text" must not end in a parenthetical like "(...)" — use "context" for that instead of writing it inline. A "#word" is a TAG and is read back into "tags", so it is accepted only at the END of the text, where it is stored exactly as written; anywhere else it would be moved to the end and is refused.',
    '"extra" keys are category-specific fields (e.g. {"kind":"functional"} for a requirement, {"directive":"dont"} for a rule). Keys must be letters, digits and underscore only, not starting with a digit, and must not reuse a reserved field name such as "source_file", "status" or "id".',
    'Everything you return lands as status "draft". Nothing you extract governs future work until a human promotes it with `mycontext review promote <id>`.',
    `Then call back with the results. CLI: ${request.callback.cli} — pipe your JSON array to stdin. ` +
    `MCP: call ${request.callback.mcp.tool} with exactly the arguments shown in the "callback.mcp.arguments" ` +
    `object below, PLUS one more key: "candidates", whose value is the JSON array you produced (a real array, not a string).`,
    remainingLine,
  ];
}

export function buildExtractionRequest(
  session: IngestSession, chunk: Chunk, config: Config,
): ExtractionRequest {
  const categories: RequestCategory[] = Object.values(config.categories)
    .filter((c) => c.enabled)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ name: c.name, description: c.description, extraFields: c.extraFields }));

  const pending = pendingAnchors(session);
  const remaining = pending.includes(chunk.anchor) ? pending.length : pending.length + 1;

  const partial: Omit<ExtractionRequest, 'instructions'> = {
    protocol: EXTRACTION_PROTOCOL,
    session: session.id,
    sourceFile: session.sourceFile,
    anchor: chunk.anchor,
    chunkIndex: chunk.index,
    totalChunks: session.chunks.length,
    remaining,
    heading: chunk.heading,
    categories,
    schema: CANDIDATE_SCHEMA,
    chunk: chunk.text,
    callback: {
      cli: `mycontext ingest-apply ${session.id} --anchor ${chunk.anchor} --stdin`,
      mcp: {
        tool: 'ingest_document',
        // Deliberately does NOT include "candidates" here: the value the
        // model must send is an array it hasn't produced yet, and there is
        // no way to spell "put your array here" as a JSON value that both
        // (a) documents the requirement and (b) would not itself be valid
        // input if copied verbatim (a string placeholder previously sat
        // here and, copied literally, produced "expected a JSON array of
        // candidate items, got string" from validateCandidates). The
        // instruction that tells the model to add the key is prose, in
        // `instructions`, not JSON that could be mistaken for a template.
        arguments: { session: session.id, anchor: chunk.anchor },
      },
    },
  };

  return { ...partial, instructions: instructionsFor(partial) };
}

/**
 * A fence at least this long can enclose chunk text that itself contains an
 * ordinary triple-backtick fenced code block (Markdown source routinely
 * does) without the inner fence prematurely closing the outer one — the
 * same "longer fence wins" rule `chunk.ts`'s own `closesFence` enforces when
 * chunking such a document in the first place.
 */
const CHUNK_FENCE = '````';

/**
 * The chunk is rendered as its own delimited prose block with real `\n`
 * line breaks — NOT solely as the JSON-escaped `chunk` string field buried
 * inside the metadata block below. A single long paragraph JSON-escaped
 * into one line, positioned after a multi-hundred-line schema dump, is the
 * least legible part of an artifact whose entire job is to be read: the
 * Markdown structure (headings, lists, paragraph breaks) the extractor
 * must reason over is exactly what JSON-string-escaping erases. The
 * `chunk` field still exists on the returned `ExtractionRequest` object for
 * a programmatic caller (e.g. an MCP tool returning the object directly,
 * not this rendered text) — this function alone chooses to present it twice
 * only where duplication earns its cost (prose readability), and to elide
 * it from the embedded JSON to avoid paying for that duplication in bytes.
 * `instructions` is elided from the embedded JSON for the same reason: it
 * is already rendered, verbatim, as the bullet list immediately above.
 */
export function renderExtractionRequest(request: ExtractionRequest): string {
  const { chunk, instructions, ...jsonView } = request;

  const header = [
    `my_context EXTRACTION REQUEST — ${request.sourceFile} § ${request.anchor} ` +
    `(chunk ${request.chunkIndex + 1} of ${request.totalChunks}, ${request.remaining} pending)`,
    '',
    ...instructions.map((line) => `- ${line}`),
    '',
    'CHUNK — the source text to read and extract from:',
    CHUNK_FENCE,
    chunk,
    CHUNK_FENCE,
    '',
    '```json',
    JSON.stringify(jsonView, null, 2),
    '```',
  ];
  return header.join('\n').replace(/\r/g, '') + '\n';
}

/** The next chunk awaiting extraction, in document order. */
export function nextRequest(session: IngestSession, config: Config): ExtractionRequest | null {
  const anchor = pendingAnchors(session)[0];
  if (anchor === undefined) return null;
  const chunk = session.chunks.find((c) => c.anchor === anchor);
  return chunk ? buildExtractionRequest(session, chunk, config) : null;
}
