/**
 * Every path through this module normalizes first, so Windows CRLF — or a
 * lone CR, the same thing a bare pre-OS-X Mac line ending or a partially
 * normalized source document produces — never changes a checksum or hides
 * a Markdown heading from a naive `'\n'`-only split. The canonical
 * implementation: `src/ingest/chunk.ts` re-exports this rather than
 * defining its own copy, and `src/core/mutate.ts` imports it directly, so
 * there is exactly one EOL-normalization rule for both the ingest and MCP
 * surfaces to share, not two that can drift.
 */
export function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
