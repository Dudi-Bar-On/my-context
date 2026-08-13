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

export const SERVER_INFO = { name: 'my-context', version: '0.1.0' };

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

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolRegistry {
  list(): ToolDefinition[];
  /** Returns the text shown to the model. Throws to signal a tool-level error. */
  call(name: string, args: Record<string, unknown>): string;
}

export interface Session {
  handle(message: JsonRpcMessage): JsonRpcResponse | null;
}

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
    const isNotification = message.id === undefined || message.id === null;
    const params = isObject(message.params) ? message.params : {};

    const announced = announcedVersion(params);
    if (announced !== null) {
      if (!SUPPORTED_PROTOCOL_VERSIONS.includes(announced)) {
        if (isNotification) return null;
        return fail(
          id, ERROR_UNSUPPORTED_VERSION, 'Unsupported protocol version',
          { supported: SUPPORTED_PROTOCOL_VERSIONS, requested: announced },
        );
      }
      negotiated = announced;
    }

    // Notifications never receive a response, whatever they say.
    if (isNotification) return null;

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
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      }

      case 'server/discover':
        return ok(id, {
          resultType: 'complete',
          supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
          capabilities: { tools: {} },
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

export function serveStdio(
  input: NodeJS.ReadableStream, output: NodeJS.WritableStream, session: Session,
): void {
  let buffer = '';
  input.setEncoding('utf8');

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
        // session throws handling it: a message with no id never gets a
        // response, whatever went wrong inside `handle`.
        const isNotification = message.id === undefined || message.id === null;
        response = isNotification ? null : fail(
          message.id ?? null, ERROR_INTERNAL,
          err instanceof Error ? err.message : String(err),
        );
      }
      if (response) writeMessage(output, response);
    }
  });
}
