---
id: DEC-the-mcp-server-speaks-every-revision-from-2024-11-05-to-2026
type: decision
title: The MCP server speaks every revision from 2024-11-05 to 2026-07-28 and negotiates per client
status: active
severity: soft
always: false
scope:
  - src/mcp/**
tags:
  - mcp
  - protocol
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: fefc184876f8af84
---

# The MCP server speaks every revision from 2024-11-05 to 2026-07-28 and negotiates per client

Settled during Plan 3 by building the dual-era server rather than by observing a client. `SUPPORTED_PROTOCOL_VERSIONS` (src/mcp/protocol.ts) lists five revisions — 2026-07-28, 2025-11-25, 2025-06-18, 2025-03-26 and the original 2024-11-05 — and every one of them is echoed back verbatim by `initialize`.

The premise the question was built on turned out to be wrong: `initialize` is not removed in the newest revision. Both handshakes are implemented side by side. `initialize` answers with the requested version when it is supported and falls back to `LATEST_PROTOCOL_VERSION` when it is not; `server/discover` answers with the whole supported list. A client may also announce a revision on any message through the `io.modelcontextprotocol/protocolVersion` key in `_meta`, and one this server does not know is refused with JSON-RPC error -32022 carrying both the supported list and what was requested.

One behavioural switch hangs off the negotiated value: results gain `resultType`, `_meta`, `ttlMs` and `cacheScope` only from 2026-07-28 onward, and below that the legacy result shape is emitted unchanged. A client that never announces anything is assumed to be 2025-06-18 — the older of the two plausible legacy shapes, so a silent client is understated rather than handed fields it never asked for.

What is still not known is which revision Claude Code itself sends; no live client has been observed against this server. That no longer blocks anything, which is why the question retires: the server does not need to know in advance.

## Observations
- [supersession] Replaces OPENQ-which-mcp-revision-does-claude-code-speak: The MCP revision question was settled by building the dual-era server; initialize was never removed.

## Relations
- supersedes [[OPENQ-which-mcp-revision-does-claude-code-speak]]
