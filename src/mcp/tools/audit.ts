/**
 * **`audit_log`, moved out of the registry.**
 *
 * `TASK-26-tool-specs-keep-their-handlers-inline-where-one-already`, in the
 * shape `src/mcp/tools/ingest.ts` already set: the schema and the handler move,
 * the spec entry and its docblock stay in `tools.ts`.
 *
 * The boundary is the tests': `test/mcp/audit-log-tokens.test.ts` exercises
 * `audit_log` and no other tool — one of only three files under `test/mcp/`
 * that name a tool set a module could be cut around. See `rule-store.ts`'
 * header for the whole measurement, and for why the other 24 specs stayed.
 *
 * Every line below is the line that shipped, moved and de-indented.
 */
import {
  AUDIT_KINDS, AUDIT_OPS, filterAudit, parseWhen, readAudit,
  type AuditFilter, type AuditKind, type AuditOp,
} from '../../core/audit.ts';
import type { Origin } from '../../core/types.ts';
import { ORIGINS } from '../../core/validate.ts';
import { resolveWorkspace } from '../../core/workspace.ts';
import { object, optEnum, optNum, optStr, S_STRING, type Args } from './args.ts';

export const AUDIT_LOG_SCHEMA: Record<string, unknown> = object({
  item: { ...S_STRING, description: 'Records naming this item id, in any role' },
  session: { ...S_STRING, description: 'Records from one session id' },
  op: { ...S_STRING, enum: AUDIT_OPS },
  kind: { ...S_STRING, enum: AUDIT_KINDS },
  // **`actor`, not `origin`, and the difference is a security pin rather
  // than taste.** `test/mcp/tools.test.ts` asserts that NO tool schema
  // exposes a property named `origin`, because a model that can name its
  // own origin on a write tool can route around the review boundary that
  // keeps agent-authored normative items out of injection. That guard is
  // blanket by design, and a read-only filter is not worth carving an
  // exception into it — a weakened pin outlives the reason it was
  // weakened. The CLI keeps `--origin`, which matches the record field,
  // because no such hazard exists on a human surface.
  //
  // The NAME is this surface's; the VALUES are `Origin`'s, so they are
  // read from `ORIGINS` (`core/validate.ts`) rather than restated. A
  // list retyped here would agree with the type until the day it did
  // not, and the failure is silent: the filter would refuse a member
  // every record is free to carry.
  actor: { ...S_STRING, enum: ORIGINS },
  since: { ...S_STRING, description: 'ISO-8601 instant, or a span back from now: 7d, 12h' },
  limit: { type: 'number', description: 'The most recent N. Default 30.' },
});

export function runAuditLog(cwd: string, args: Args): string {
  const ws = resolveWorkspace(cwd);
  if (!ws.projectRoot) {
    throw new Error(
      `my_context: there is no .my_context workspace at or above ${cwd}, so there is no ` +
      `audit log to read. Ask the user to run \`mycontext init\`.`,
    );
  }
  const filter: AuditFilter = { limit: optNum(args, 'limit', 30) };
  const item = optStr(args, 'item');
  if (item !== undefined) filter.itemId = item;
  const session = optStr(args, 'session');
  if (session !== undefined) filter.sessionId = session;
  const op = optEnum(args, 'op', [...AUDIT_OPS], 'workflow');
  if (op !== undefined) filter.op = op as AuditOp;
  const kind = optEnum(args, 'kind', [...AUDIT_KINDS], 'workflow');
  if (kind !== undefined) filter.kind = kind as AuditKind;
  const actor = optEnum<Origin>(args, 'actor', ORIGINS, 'workflow');
  if (actor !== undefined) filter.origin = actor;
  const since = optStr(args, 'since');
  if (since !== undefined) filter.since = parseWhen(since, 'since');

  // Read straight from the JSONL, which is the authoritative record. The
  // SQLite projection is the CLI's read path because a human filters
  // interactively over a long history; a tool call filtered to at most a
  // few dozen records does not need an index, and skipping it means this
  // surface can never answer from something stale.
  const found = filterAudit(readAudit(ws.projectRoot), filter);
  if (found.length === 0) {
    return (
      'my_context: no audit records match. This log records mutations and hook actions — ' +
      'injections by SCOPE (which items at which tier), never their text. An empty answer ' +
      'means nothing matching has happened in this workspace, not that nothing is recorded.'
    );
  }
  return [
    `my_context: ${found.length} audit record(s), oldest first. Injections carry the ids ` +
    `and tiers of what was delivered, never the text that was injected — plus \`tokens\`, ` +
    `the estimated token count (chars/4) the injection budget was charged at injection ` +
    `time. An injection record WITHOUT a \`tokens\` field predates that field: read it as ` +
    `"not recorded", never as zero.`,
    ...found.map((r) => JSON.stringify(r)),
  ].join('\n');
}
