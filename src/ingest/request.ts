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

function instructionsFor(request: Omit<ExtractionRequest, 'instructions'>): string[] {
  return [
    'You are the extractor. my_context has no model of its own and never calls one — it hands you the text and validates what you return.',
    `Read the chunk below, taken from ${request.sourceFile} under the anchor "${request.anchor}", and extract every piece of NORMATIVE knowledge it establishes: things that must hold, must be built, must not be done, or are deliberately left open.`,
    'Do not extract narrative, status updates, or descriptions of what was done — that is claude-mem\'s job, not this one.',
    `Emit a JSON array matching the "schema" field. Return [] when the chunk establishes nothing normative — that is a correct and common answer.`,
    'Every candidate MUST carry a "quote": a span copied VERBATIM from the chunk. It is checked by exact match after whitespace collapsing, and a paraphrase is rejected. This is how an invented item is caught.',
    `Titles are one declarative sentence, at most ${MAX_TITLE} characters. Put the reasoning in "body".`,
    'Set "scope" only to the directories the item actually governs, as POSIX globs such as "src/auth/**". A bare "**" is rejected. Omitting scope is safe: the item is still indexed and searchable, it is simply never auto-injected.',
    'Everything you return lands as status "draft". Nothing you extract governs future work until a human promotes it with `mycontext review promote <id>`.',
    `Then call back with the results. CLI: ${request.callback.cli}   MCP: ${request.callback.mcp.tool} with {"session": "${request.session}", "anchor": "${request.anchor}", "candidates": [...]}.`,
    request.remaining > 1
      ? `${request.remaining} chunks remain in this document; the callback returns the next request automatically.`
      : 'This is the last pending chunk in this document.',
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
        arguments: { session: session.id, anchor: chunk.anchor, candidates: '<your JSON array here>' },
      },
    },
  };

  return { ...partial, instructions: instructionsFor(partial) };
}

export function renderExtractionRequest(request: ExtractionRequest): string {
  const header = [
    `my_context EXTRACTION REQUEST — ${request.sourceFile} § ${request.anchor} ` +
    `(chunk ${request.chunkIndex + 1} of ${request.totalChunks}, ${request.remaining} pending)`,
    '',
    ...request.instructions.map((line) => `- ${line}`),
    '',
    '```json',
    JSON.stringify(request, null, 2),
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
