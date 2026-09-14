import { VERSION } from '../core/version.ts';

export const LATEST_PROTOCOL_VERSION = '2026-07-28';

/**
 * Newest first. Advertised verbatim by server/discover and in -32022 data,
 * and every entry here is echoed back unchanged by `initialize` (see
 * "every supported protocol version is echoed back verbatim by
 * initialize") — the unsupported-version fallback to
 * LATEST_PROTOCOL_VERSION is unreachable for any client announcing a
 * revision actually on this list.
 */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  '2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05',
];

/** The revision at which results gained resultType / ttlMs / cacheScope. */
const MODERN_FROM = '2026-07-28';

/**
 * Assumed when a client never announces one — deliberately `2025-06-18`,
 * not the newest legacy entry in SUPPORTED_PROTOCOL_VERSIONS (`2025-11-25`).
 * A client that never announces a version is, by definition, one this
 * module has no evidence uses anything past the classic `initialize`
 * handshake, so it gets the older of the two plausible legacy shapes rather
 * than the newer: understating what a silent client gets is safe (plain,
 * undecorated results), overstating it is not (2026-07-28 decoration a
 * legacy client was never shown to expect).
 */
const ASSUMED_VERSION = '2025-06-18';

const META_VERSION = 'io.modelcontextprotocol/protocolVersion';
const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo';

/**
 * What the server reports at `initialize` and in every `_meta` block.
 *
 * `version` is read from `package.json` through `core/version.ts` rather than
 * transcribed here. It was transcribed here, as `'0.1.0'`, and stayed at that
 * value through the `0.9.0` and `1.0.0` releases — every client was told the
 * wrong version for two releases. `core/version.ts` had already named the
 * cause: "a constant transcribed into a `.ts` file is a fourth place to
 * forget." `scripts/set-version.ts` rewrites the three JSON manifests, which
 * cannot read `package.json`; this file can, so it does, and the site stops
 * existing rather than being added to that list.
 */
export const SERVER_INFO = { name: 'mycontext', version: VERSION };

const INSTRUCTIONS =
  'Project constraints, requirements, decisions and lessons. Capture normative ' +
  'knowledge as it is established; call mycontext_help("capture") first if unsure.';

export const ERROR_PARSE = -32700;
export const ERROR_INVALID_REQUEST = -32600;
export const ERROR_METHOD_NOT_FOUND = -32601;
export const ERROR_INVALID_PARAMS = -32602;
export const ERROR_INTERNAL = -32603;
/** UnsupportedProtocolVersion, renumbered from -32004 in revision 2026-07-28. */
export const ERROR_UNSUPPORTED_VERSION = -32022;

export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcErrorBody {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcErrorBody;
}

/**
 * **What a client is told about a tool's BEHAVIOUR, rather than about its
 * arguments** — MCP's `ToolAnnotations`, spelled here because this package
 * takes no dependencies (`CONST-zero-runtime-dependencies`) and so has no SDK
 * to import the type from.
 *
 * The field meanings and defaults are the specification's, quoted so that a
 * reader does not have to hold them in their head while reading the table in
 * `tools.ts`:
 *
 * - `readOnlyHint` — *"If true, the tool does not modify its environment."*
 *   Default **false**.
 * - `destructiveHint` — *"If true, the tool may perform destructive updates to
 *   its environment. If false, the tool performs only additive updates. (This
 *   property is meaningful only when `readOnlyHint == false`)"* Default
 *   **true**.
 * - `idempotentHint` — *"If true, calling the tool repeatedly with the same
 *   arguments will have no additional effect on the its environment. (This
 *   property is meaningful only when `readOnlyHint == false`)"* Default
 *   **false**.
 * - `openWorldHint` — *"If true, this tool may interact with an 'open world'
 *   of external entities. If false, the tool's domain of interaction is
 *   closed."* Default **true**.
 *
 * **Every default is the cautious one**, which is why omitting the block is not
 * the harmless silence it looks like: a tool with no annotations reads as a
 * not-read-only, possibly-destructive, non-idempotent, open-world tool. That is
 * what all twenty-six of this server's tools looked like to a host until
 * `mcpsurface/2` — including `get_item`, which reads one file.
 *
 * The specification also says, of the whole block: *"all properties in
 * ToolAnnotations are hints. They are not guaranteed to provide a faithful
 * description of tool behavior"*, and tells clients to *"never make tool use
 * decisions based on ToolAnnotations received from untrusted servers"*. So
 * these are a claim this server makes about itself, and the value of the claim
 * is entirely in whether it is true — which is why `tools.ts` declares them
 * through four named shapes rather than per tool, and why a test cross-checks
 * them against the CLI's own approval boundary rather than against a list.
 */
export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: ToolAnnotations;
}

export interface ToolRegistry {
  list(): ToolDefinition[];
  /** Returns the text shown to the model. Throws to signal a tool-level error. */
  call(name: string, args: Record<string, unknown>): string;
}

export interface Session {
  handle(message: JsonRpcMessage): JsonRpcResponse | null;
}

/**
 * **What this server can do, said once, because two routes used to say it
 * differently.**
 *
 * `initialize` answered `{ tools: { listChanged: false } }` and
 * `server/discover` answered `{ tools: {} }`, so a client that asked one way
 * and a client that asked the other were told different things about the same
 * server — and nothing in the code connected the two literals, so neither
 * could go stale without the other staying right. There is now one declaration
 * and both routes read it, which is the only arrangement in which "identically"
 * is a property of the program rather than of whoever last edited both.
 *
 * `listChanged: false` is the truthful half of the pair, which is why it is the
 * one that survived: `SORTED` (tools.ts) is built once at module load and is
 * required to be byte-stable across calls for prompt caching, so this server
 * genuinely never emits `notifications/tools/list_changed`. `{}` was not wrong,
 * merely silent — and a silent capability is one a client has to guess at.
 *
 * Frozen, and rebuilt nowhere: a shared literal handed to two responses is only
 * "one answer" for as long as nobody mutates it in between.
 */
export const CAPABILITIES = Object.freeze({
  tools: Object.freeze({ listChanged: false }),
});

/**
 * **A notification is a request with NO `id` member — not a request whose `id`
 * is null.** The distinction is the whole of `mcpsurface/3`.
 *
 * JSON-RPC 2.0 §4.1: *"A Notification is a Request object without an 'id'
 * member."* §4 allows `id` to be *"a String, Number, or NULL value if
 * included"* and merely discourages null, *"because this specification uses a
 * value of Null for Responses with an unknown id"*. The MCP base protocol is
 * stricter still and says so explicitly: *"Requests MUST include a string or
 * integer ID. Unlike base JSON-RPC, the ID MUST NOT be `null`."* — while
 * *"Notifications MUST NOT include an ID"*, and only for those does
 * *"The receiver MUST NOT send a response"* apply.
 *
 * So `{"id": null, "method": "ping"}` is a REQUEST, and a malformed one. It
 * gets an Invalid Request error, not silence. This predicate used to read
 * `message.id === undefined || message.id === null` — the `|| null` half is the
 * bug — and a client whose first id was spelled that way waited forever with
 * nothing on either side saying why.
 *
 * `undefined` rather than a `hasOwn` check: JSON can never produce a present
 * `id` whose value is `undefined`, so for anything off the wire the two agree,
 * and callers that build a message by hand mean "absent" when they write it.
 */
function isNotification(message: JsonRpcMessage): boolean {
  return message.id === undefined;
}

/**
 * The refusal a null id earns. Says which of the two shapes the sender
 * probably meant, because both are reachable from the mistake: a request
 * wants a real id, a notification wants no `id` member at all.
 */
export const NULL_ID_REFUSAL =
  'The "id" member of a request must not be null. A message with a null id is a REQUEST — ' +
  'JSON-RPC 2.0 defines a notification as a request with no "id" member at all — and MCP ' +
  'requires a request id to be a string or an integer. Resend it with a string or integer id, ' +
  'or, if no response was wanted, omit the "id" member entirely.';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function fail(
  id: string | number | null, code: number, message: string, data?: unknown,
): JsonRpcResponse {
  const error: JsonRpcErrorBody = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id, error };
}

export function createSession(registry: ToolRegistry): Session {
  let negotiated = ASSUMED_VERSION;

  /** ISO dates compare correctly as plain strings; no date parsing needed. */
  const isModern = (): boolean => negotiated >= MODERN_FROM;

  function decorate(result: Record<string, unknown>, cacheable: boolean): Record<string, unknown> {
    if (!isModern()) return result;
    const out: Record<string, unknown> = {
      ...result,
      resultType: 'complete',
      _meta: { [META_SERVER_INFO]: SERVER_INFO },
    };
    if (cacheable) {
      out.ttlMs = 300_000;
      out.cacheScope = 'public';
    }
    return out;
  }

  function announcedVersion(params: Record<string, unknown>): string | null {
    const meta = params._meta;
    if (!isObject(meta)) return null;
    const version = meta[META_VERSION];
    return typeof version === 'string' ? version : null;
  }

  function callTool(id: string | number | null, params: Record<string, unknown>): JsonRpcResponse {
    const name = typeof params.name === 'string' ? params.name : '';
    const args = isObject(params.arguments) ? params.arguments : {};

    if (!registry.list().some((tool) => tool.name === name)) {
      return fail(id, ERROR_INVALID_PARAMS, `Unknown tool: ${name}`);
    }

    // A tool that ran and refused its input is a *result* with isError, not a
    // protocol error: only result content reaches the model, and the teaching
    // message is the entire point of refusing.
    try {
      const text = registry.call(name, args);
      return ok(id, decorate({ content: [{ type: 'text', text }], isError: false }, false));
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      return ok(id, decorate({ content: [{ type: 'text', text }], isError: true }, false));
    }
  }

  function handle(message: JsonRpcMessage): JsonRpcResponse | null {
    const id = message.id ?? null;
    const notification = isNotification(message);
    const params = isObject(message.params) ? message.params : {};

    // **Before the version check, deliberately.** A null id makes the envelope
    // invalid, and negotiation is a fact about content: letting a malformed
    // request through to `negotiated = announced` would let a message the
    // server is about to refuse change how it answers every LATER message.
    // Envelope first, then what the envelope carries.
    //
    // The response id is null because it can be nothing else — JSON-RPC 2.0 §5
    // on the Response `id`: *"If there was an error in detecting the id in the
    // Request object (e.g. Parse error/Invalid Request), it MUST be Null."*
    // That is the same id the parse-error and line-too-long branches of
    // `serveStdio` already write, so all three malformed-envelope answers agree.
    if (!notification && message.id === null) {
      return fail(null, ERROR_INVALID_REQUEST, NULL_ID_REFUSAL);
    }

    const announced = announcedVersion(params);
    if (announced !== null) {
      if (!SUPPORTED_PROTOCOL_VERSIONS.includes(announced)) {
        if (notification) return null;
        return fail(
          id, ERROR_UNSUPPORTED_VERSION, 'Unsupported protocol version',
          { supported: SUPPORTED_PROTOCOL_VERSIONS, requested: announced },
        );
      }
      negotiated = announced;
    }

    // Notifications never receive a response, whatever they say. A notification
    // is one with no `id` member at all — see `isNotification`.
    if (notification) return null;

    const method = message.method;
    if (typeof method !== 'string' || method === '') {
      return fail(id, ERROR_INVALID_REQUEST, 'Missing "method".');
    }

    switch (method) {
      case 'initialize': {
        const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
        negotiated = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : LATEST_PROTOCOL_VERSION;
        return ok(id, {
          protocolVersion: negotiated,
          capabilities: CAPABILITIES,
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      }

      case 'server/discover':
        return ok(id, {
          resultType: 'complete',
          supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
          capabilities: CAPABILITIES,
          _meta: { [META_SERVER_INFO]: SERVER_INFO },
          instructions: INSTRUCTIONS,
          ttlMs: 3_600_000,
          cacheScope: 'public',
        });

      case 'ping':
        return ok(id, {});

      case 'tools/list':
        return ok(id, decorate({ tools: registry.list() }, true));

      case 'tools/call':
        return callTool(id, params);

      default:
        return fail(id, ERROR_METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  }

  return { handle };
}

function writeMessage(output: NodeJS.WritableStream, response: JsonRpcResponse): void {
  // JSON.stringify escapes every newline inside strings, so the payload can
  // never contain a raw \n — which the stdio transport forbids.
  output.write(JSON.stringify(response) + '\n');
}

/**
 * Far above any plausible single MCP message (tool lists, results and
 * teaching text are all small strings). Guards against a pending line that
 * never gets its newline — without a cap, `buffer` would grow without bound
 * for the life of the process.
 */
export const MAX_PENDING_LINE_LENGTH = 10_000_000;

/**
 * Where a transport-level failure is reported. Never `output`: that stream
 * carries framed JSON-RPC and nothing else, and a diagnostic written onto it
 * would corrupt the one channel a client parses (`server.ts` states the same
 * rule for startup failures — *"a dead server is recoverable; a corrupt stream
 * is not"*).
 */
export type Diagnostics = (line: string) => void;

const DEFAULT_DIAGNOSTICS: Diagnostics = (line) => { process.stderr.write(line); };

export function serveStdio(
  input: NodeJS.ReadableStream, output: NodeJS.WritableStream, session: Session,
  diagnostics: Diagnostics = DEFAULT_DIAGNOSTICS,
): void {
  let buffer = '';
  input.setEncoding('utf8');

  /**
   * **The other half of "nothing on either side saying why"** (`mcpsurface/3`).
   *
   * Neither stream carried an `error` listener. A stream that emits `error`
   * with no listener does not fail quietly — Node re-throws it as an uncaught
   * exception — so the transport died with a raw stack trace that named a
   * socket rather than this server, and on `output` the throw happened *inside*
   * a `write` called from the `data` handler, taking the read loop down with
   * it. Either way the client is left waiting on a reply that is never coming.
   *
   * A listener cannot keep the connection alive — a broken pipe is broken —
   * but it can make the ending legible, and on stderr, which is the only
   * channel free to carry English.
   */
  const reportStreamError = (side: 'input' | 'output') => (err: Error) => {
    diagnostics(`my_context: MCP ${side} stream failed: ${err.message}\n`);
  };
  input.on('error', reportStreamError('input'));
  output.on('error', reportStreamError('output'));

  input.on('data', (chunk: string) => {
    buffer += chunk;

    for (;;) {
      const newline = buffer.indexOf('\n');

      // No newline yet: only an unbounded wait is a problem, and only once
      // the still-pending buffer has grown past the cap.
      if (newline < 0) {
        if (buffer.length > MAX_PENDING_LINE_LENGTH) {
          buffer = '';
          writeMessage(output, fail(null, ERROR_PARSE, 'Line too long'));
        }
        break;
      }

      const line = buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      if (line.trim() === '') continue;

      // A newline arrived, but the line it terminates may itself already
      // exceed the cap — a single oversized write, not a slow trickle.
      // Same guard, same response, and processing continues with whatever
      // is left in `buffer`.
      if (line.length > MAX_PENDING_LINE_LENGTH) {
        writeMessage(output, fail(null, ERROR_PARSE, 'Line too long'));
        continue;
      }

      let message: JsonRpcMessage;
      try {
        message = JSON.parse(line) as JsonRpcMessage;
      } catch {
        writeMessage(output, fail(null, ERROR_PARSE, 'Parse error'));
        continue;
      }

      let response: JsonRpcResponse | null;
      try {
        response = session.handle(message);
      } catch (err) {
        // JSON-RPC forbids replying to a notification, even when the
        // session throws handling it: a message with NO `id` member never
        // gets a response, whatever went wrong inside `handle`.
        //
        // **The second site `mcpsurface/3` implicates.** This read
        // `message.id === undefined || message.id === null` too, so a null-id
        // request that made the session throw was swallowed here as well —
        // fixing only `handle` would have left the same hang on the one path
        // where something had already gone wrong, which is the worst path to
        // be silent on. `isNotification` is now the single predicate both
        // sites ask, so the two cannot drift apart again.
        response = isNotification(message) ? null : fail(
          message.id ?? null, ERROR_INTERNAL,
          err instanceof Error ? err.message : String(err),
        );
      }
      if (response) writeMessage(output, response);
    }
  });
}
