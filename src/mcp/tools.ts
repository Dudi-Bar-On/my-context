import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  AUDIT_KINDS, AUDIT_OPS, auditFailureNote, filterAudit, kindOf, parseWhen, PROGRESS_OPS,
  readAudit, recordAudit,
  type AuditFilter, type AuditKind, type AuditOp,
} from '../core/audit.ts';
import { RULE_DIRECTIVES } from '../core/command-flags.ts';
import { askHandoverNow } from '../core/handover-ask.ts';
import { computeDecay } from '../core/decay.ts';
import {
  focusReportLines, isFocusActive, readFocus, setFocus, unsetFocus,
  type Focus, type FocusAxes,
} from '../core/focus.ts';
import { Ledger } from '../core/ledger.ts';
import { topUpLedger } from '../core/ledger-replay.ts';
import { summaryStalenessNote } from '../core/content-hash.ts';
import { renderItem } from '../core/item.ts';
import {
  isWorkCategory, NEEDS_FIELD, PLAN_FIELD, readyReport, SEQ_FIELD, STATE_FIELD,
  type HeldRow, type ReadyRow,
} from '../core/needs.ts';
import { checksumMigrationFindings, runChecks, type Finding } from '../doctor/checks.ts';
import {
  createItem, supersedeItem, updateItem,
  type CreateInput, type MutationContext, type UpdateInput,
} from '../core/mutate.ts';
import {
  summaryAtCreateRefusal, summaryOmittedRefusal, summaryRequired, summaryRequiredAtCreate,
  summaryRequiredRefusal, summaryUnchangedRefusal,
} from '../core/summary-gate.ts';
import { procedureProgress, progressLine, unreadableProgress } from '../core/progress.ts';
import { STAGES, stageOf, type Stage } from '../core/procedure-stage.ts';
import { linkItems } from '../core/relations.ts';
import { RELATION_TYPES } from '../core/vocabulary.ts';
import {
  extraFieldNames, resolveConfig, scopePolicyFor, skippedKeyNotice, type Config,
} from '../core/config.ts';
import { buildInjection } from '../core/inject.ts';
import { openRebuiltStore, rebuildRoots } from '../core/open-store.ts';
import { loadErrorNote, loadLayer, type LoadError } from '../core/rebuild.ts';
import { isSnapshot, readSnapshot } from '../core/reference.ts';
import { scopeField } from '../core/render-item.ts';
import {
  agentRevisionNotice, itemRevisionNotice, pendingRevisionLine, pendingRevisions,
  type PendingRevision,
} from '../core/revision.ts';
import { filterItems, LINK_DIRECTIONS, type LinkDirection } from '../core/search.ts';
import { mergeLayers, RETIRED_STATUSES, reviewQueue, select } from '../core/select.ts';
import { makeId } from '../core/slug.ts';
import { MCP_HELP_TOPICS, enumError, missingFieldError, unknownIdError } from '../core/teach.ts';
import type { Item, Observation, Origin, Severity, Status } from '../core/types.ts';
import { ORIGINS } from '../core/validate.ts';
import { VERSION } from '../core/version.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import { exampleItem, helpTopic, toolDescriptions } from '../help/index.ts';
import { listSessions, pendingAnchors, rejectionsForAnchor } from '../ingest/session.ts';
import {
  buildRuleRequest, listStaging, renderRuleRequest, stageRuleCandidates,
} from '../lesson/derive.ts';
import { renderCollisionReport, type CollisionReport } from '../pack/collide.ts';
import { planImport } from '../pack/import.ts';
import { readImportRecords } from '../pack/imported-audit.ts';
import { readArtefact } from '../pack/reader.ts';
import { INGEST_DOCUMENT_SCHEMA, runIngestDocument } from './tools/ingest.ts';
import { toolResultProvenance } from './provenance.ts';
import type { CodeIdentity } from '../core/code-identity.ts';
import type { ToolDefinition, ToolRegistry } from './protocol.ts';

const STATUSES = ['active', 'draft', 'superseded', 'deprecated', 'validated'];
const SEVERITIES = ['hard', 'soft'];

type Args = Record<string, unknown>;

function str(args: Args, key: string, tool: string): string {
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
function optStr(args: Args, key: string): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`my_context: "${key}" must be a string. You passed ${JSON.stringify(value)}.`);
  }
  return value;
}

function optBool(args: Args, key: string): boolean | undefined {
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
function optNum(args: Args, key: string, fallback: number): number {
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
function optList(args: Args, key: string): string[] | undefined {
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
function optEnum<T extends string>(
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
function optObservations(args: Args): Observation[] | undefined {
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
function optExtra(args: Args): Record<string, string> | undefined {
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

/**
 * Open the workspace, refresh the index from Markdown, run, close. The rebuild
 * is per call by design: the CLI, the hooks and other sessions write the same
 * files, and a cached index would hand the model stale answers.
 */
function withWorkspace(cwd: string, fn: (ctx: MutationContext) => string): string {
  const ws = resolveWorkspace(cwd);
  if (!ws.projectRoot) {
    throw new Error(
      `my_context: there is no .my_context workspace at or above ${cwd}. ` +
      `Ask the user to run \`mycontext init\` in the repository root.`,
    );
  }
  const projectRoot = ws.projectRoot;

  // `openRebuiltStore` (core/open-store.ts) owns the open-rebuild sequence.
  // `retryOnBusy: true` is the MCP server's caller-class policy — a transient
  // SQLITE_BUSY surfaced to the model costs a whole tool call — and is what
  // the hand-rolled `withRetry(() => rebuild(...))` here used to spell; see
  // `OpenStoreOptions` for why the CLI and the hooks do NOT take it.
  const { store, errors } = openRebuiltStore(ws, { retryOnBusy: true });
  try {
    return fn({ root: projectRoot, store, config: ws.config }) + loadErrorNote(errors);
  } finally {
    try { store.close(); } catch { /* nothing left to do */ }
  }
}

/**
 * The scope is ALWAYS shown, including when it is empty.
 *
 * It used to be omitted for an unscoped item, which was survivable while an
 * empty scope meant the item was never injected. It is not survivable now:
 * `query_items({path})` returns unscoped items for every path, so the caller
 * asking "what governs this file" gets a list in which the items that govern
 * EVERY file are exactly the ones whose reach is left unstated — and an absent
 * field reads as "narrow, details elided", the opposite of the truth.
 *
 * `renderItemBlock` still omits it, and that is not the same case: an injected
 * block is an item the caller already received, so whether it applies here is
 * answered by its presence. A list line describes items the caller did NOT
 * receive and is choosing between.
 */
function line(item: Item, config: Config, pending: PendingRevision[]): string {
  // The pending marker is on the LINE, not only in the notice below the list:
  // a caller choosing between twenty items needs to know which of them it is
  // being shown pre-proposal text for, and a trailing paragraph naming ids it
  // has to match up by eye is not that. `· N pending revision(s), not applied` costs
  // one short clause on the items that have one and nothing at all on the rest.
  const mine = pending.filter((r) => r.itemId === item.id).length;
  return `${item.id} · ${item.type} · ${item.status} · ${item.title} · ` +
    `scope ${scopeField(item.scope, scopePolicyFor(config, item.type))}` +
    (mine === 0 ? '' : ` · ${mine} pending revision(s), not applied`);
}

/**
 * `pending` is every pending revision in the WORKSPACE, not only those on the
 * listed items — the notice appended below is the workspace-wide queue, in the
 * one count spelling every surface shares (`pendingRevisionCounts`,
 * core/revision.ts). Narrowing it here would produce a fourth number for this
 * queue that disagrees with the other three by design, which is the confusion
 * the single spelling exists to prevent; `mycontext review revisions <id>`
 * takes the same position for the same reason.
 */
function listOf(
  items: Item[], config: Config, limit: number, empty: string, pending: PendingRevision[],
): string {
  const shown = items.length === 0
    ? [empty]
    : items.slice(0, limit).map((item) => line(item, config, pending));
  if (items.length > limit) {
    shown.push(`… ${items.length - limit} more. Narrow the filter or raise "limit".`);
  }
  // Appended to the EMPTY answer as well, and that is the case this exists
  // for: `list_drafts` said "no drafts are waiting for review" to a workspace
  // with proposals waiting, and an agent had no surface at all on which its
  // own staged change was visible.
  const notice = agentRevisionNotice(pending);
  if (notice) shown.push('', notice);
  return shown.join('\n');
}

function requireItem(ctx: MutationContext, id: string): Item {
  const item = ctx.store.get(id);
  if (!item) throw new Error(unknownIdError(id, ctx.store.all().map((i) => i.id)));
  return item;
}

/**
 * Whether `finding` is a note a check makes about ITSELF — an unmeasured span
 * disclosed once, never a defect in the corpus — rather than an ordinary
 * finding. See `Finding.about` (doctor/checks.ts) for the field's own
 * contract, which this reproduces exactly: absent or `''` is not a
 * disclosure, any other string is.
 *
 * **Deliberately NOT the `isDisclosure`/`partitionFindings` exported by
 * `cli/commands/doctor.ts`, even though that module carries the identical
 * three lines.** Importing it here would pull that module's top-level
 * `registerCommand({name: 'doctor', ...})` call into every process that loads
 * this file — including the MCP server, which today never loads
 * `cli/index.ts` at all. `test/help/tools-topic.test.ts` pins that exact
 * absence: `COMMANDS` (cli/commands/registry.ts) is empty in a process that
 * never loaded the CLI, which is what makes `mycontext_help("cli")` refuse
 * rather than print a partial command list built from whichever commands
 * happened to be imported for other reasons. A one-line predicate over a
 * public, documented field is not the computation this project's "do not
 * reimplement" rule is protecting — `runChecks` below is, and it IS reused,
 * directly, unchanged.
 */
function isDoctorDisclosure(finding: Finding): boolean {
  return typeof finding.about === 'string' && finding.about !== '';
}

/** Presentation only, for the `ready` tool's held rows — the same four
 * sentences `cli/commands/ready.ts`'s own `HELD_REASON` prints, kept in step
 * by `test/mcp/tools.test.ts` rather than imported: that module writes to a
 * terminal (`Emit`), and this tool is a string return, so nothing there is
 * reusable as a function — only the wording is shared, and the wording is
 * data, not the readiness computation `readyReport` (core/needs.ts) owns and
 * this tool calls directly. */
const READY_HELD_REASON: Record<HeldRow['reason'], string> = {
  pending: 'a blocker has not landed',
  unresolved: 'names a task this corpus does not have',
  malformed: `an unreadable "${NEEDS_FIELD}" entry`,
  blocked_without_needs: 'says blocked and names nothing',
};

/** The same hedge `mycontext decay` and `mycontext status` print, word for
 * word — data, not the computation `computeDecay` (core/decay.ts) owns.
 * Duplicated rather than imported for the reason every other duplication on
 * this surface is: `cli/commands/decay.ts` and `cli/commands/status.ts`
 * call `registerCommand` at module scope, and importing either one drags the
 * CLI registry into this process. */
const DECAY_COLD_CAVEAT =
  '"cold" means: not auto-injected in the last window of sessions. It does NOT mean unused ' +
  '— the ledger records injection, not reading or reliance, so a new item, and any item ' +
  'consulted via get_item or the Markdown file directly, look exactly like an abandoned one here.';

/** Opens the usage ledger, catches it up from the audit log best-effort, and
 * closes it — the same three steps `cli/commands/decay.ts`'s and
 * `cli/commands/status.ts`'s own (unexported, near-identical) helpers take,
 * duplicated here for the same module-scope reason `DECAY_COLD_CAVEAT` is. An
 * unreadable audit log must not take a report down; the answer is then
 * computed from whatever the ledger already holds. */
function readLedgerView(
  root: string, dbPath: string, window: number,
): { usage: ReturnType<Ledger['allUsage']>; recentlyUsed: string[]; sessionsRecorded: number } {
  let ledger: Ledger | null = null;
  try {
    ledger = Ledger.open(dbPath);
    try { topUpLedger(root, ledger); } catch { /* aggregate from what is there */ }
    const recent = ledger.recentSessions(window);
    return {
      usage: ledger.allUsage(),
      recentlyUsed: ledger.itemsUsedIn(recent),
      sessionsRecorded: ledger.sessionCount(),
    };
  } catch {
    return { usage: [], recentlyUsed: [], sessionsRecorded: 0 };
  } finally {
    try { ledger?.close(); } catch { /* nothing to close */ }
  }
}

/**
 * The workspace's own `config.json`, raw and unresolved — the same 3-line
 * read `cli/commands/pack.ts`'s `rawWorkspaceConfig` performs, duplicated
 * here rather than imported for the same module-scope reason every other
 * duplication on this surface gives. `planImport` merges INTO this document,
 * never into the resolved shape, so the plan this tool computes must be
 * fed the same raw JSON the CLI command feeds it.
 */
function rawWorkspaceConfig(root: string): unknown {
  const file = path.join(root, 'config.json');
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** `id · type · usage` — one row of a `decay_report` bucket. */
function decayLine(row: { id: string; type: string; title: string; useCount: number; lastUsed: string | null }): string {
  const usage = row.lastUsed === null ? 'never injected' : `${row.useCount}x, last ${row.lastUsed.slice(0, 10)}`;
  return `${row.id} · ${row.type} · ${row.title} · ${usage}`;
}

export interface ToolSpec {
  name: string;
  schema: Record<string, unknown>;
  run(cwd: string, args: Args): string;
}

/**
 * The extra sentence an argument this surface deliberately does NOT take
 * earns, keyed `<tool>.<argument>` — or `*.<argument>` for one that means the
 * same thing on every tool. Without one, `refuseUnknownArgs` still refuses and
 * still lists what the tool does accept; with one, the refusal names the route
 * that works, which is the difference between "no" and "here".
 *
 * `create_item.relations` is the one this mechanism was built for.
 * `createItem` (mutate.ts) does take a `relations` array internally, and it
 * would have been a two-line change to forward one from here — but it must not
 * be forwarded, and the reason is a trust boundary rather than effort.
 * `createItem`'s `validateRelations` checks only each relation's TARGET; the
 * closed `RELATION_TYPES` vocabulary is enforced solely inside `linkItems`,
 * and `linkItems` additionally refuses `supersedes`/`superseded_by` by name so
 * that an agent cannot stamp a retirement-direction edge on an item without
 * the lifecycle changes that would make the claim true (see `SUPERSEDED_BY`'s
 * comment in mutate.ts, and `linkItems`' first check). A `relations` argument
 * on `create_item` would route around both gates in one step, which is exactly
 * the door Wave 1 closed. So it is refused, by name, with the two supported
 * routes named in the message.
 */
const ARGUMENT_HINTS: Record<string, string> = {
  'create_item.relations':
    'Relations are added after the item exists, and not by this tool: use ' +
    'link_items(from, to, relation) for an ordinary edge, and supersede_item(id, by) for a ' +
    'retirement — link_items refuses "supersedes" and "superseded_by" by name, because those ' +
    'assert a lifecycle change it never performs. See mycontext_help("workflow").',
  '*.origin':
    'origin is never taken from a tool call: every tool that writes on an agent\'s behalf ' +
    'records origin "agent" itself, which is what the draft/active trust boundary rests on. ' +
    'See mycontext_help("workflow").',
};

/**
 * Every top-level argument a tool accepts, read from the schema it advertises
 * so the two cannot disagree.
 */
function declaredArgs(spec: ToolSpec): string[] {
  const properties = spec.schema.properties;
  return properties && typeof properties === 'object' ? Object.keys(properties) : [];
}

/**
 * Refuses any argument the tool does not declare.
 *
 * Every schema on this surface declared `properties` and none declared
 * `additionalProperties: false`, and no handler looked at a key it did not
 * expect — so an argument that was not in the schema was accepted by the
 * transport, ignored by the handler, and answered with the tool's ordinary
 * success text. `create_item({..., relations: [...]})` returned
 * `created … (active)` having written no relation and said nothing about it.
 * That is one instance of a general shape, not a `create_item` bug: the same
 * silence covered `origin` on all three write tools, a misspelled `source_file`,
 * and `update_item({sevrity: "hard"})`, which reported "updated" while changing
 * nothing.
 *
 * The check is therefore here, at the one boundary every tool call crosses,
 * rather than in each handler — a per-tool check is a list eleven tools have to
 * remember to keep, and the twelfth tool would ship without one. The schema is
 * the list, so a property added to a schema is accepted by this check the same
 * moment the model is told about it. `createRegistry` also advertises
 * `additionalProperties: false` on each tool's top-level schema, so a client
 * that validates locally sees the same rule the server enforces.
 *
 * Top level only, deliberately: nested shapes are validated by the helpers that
 * read them (`optObservations` checks each entry's fields, `optExtra` its
 * values), and observation entries legitimately carry `tags`/`context` beyond
 * what their nested schema spells out.
 */
export function refuseUnknownArgs(spec: ToolSpec, args: Args): void {
  const declared = declaredArgs(spec);
  const unknown = Object.keys(args).filter((key) => !declared.includes(key));
  if (unknown.length === 0) return;

  const hints = unknown
    .map((key) => ARGUMENT_HINTS[`${spec.name}.${key}`] ?? ARGUMENT_HINTS[`*.${key}`])
    .filter((hint): hint is string => hint !== undefined);

  throw new Error(
    `my_context: ${spec.name} does not take ${unknown.map((k) => JSON.stringify(k)).join(', ')}. ` +
    `It accepts: ${declared.length ? declared.join(', ') : '(no arguments)'}. ` +
    `Nothing was written — an argument this tool cannot act on is refused rather than ignored.` +
    (hints.length ? `\n${[...new Set(hints)].join('\n')}` : ''),
  );
}

function object(
  properties: Record<string, unknown>, required: string[] = [],
): Record<string, unknown> {
  return { type: 'object', properties, required };
}

const S_STRING = { type: 'string' };
const S_STRINGS = { type: 'array', items: { type: 'string' } };

/**
 * Hand-written value hints for the extra fields, keyed by field name. Purely
 * cosmetic: the SET of extra fields comes from the config (see
 * `extraFieldNames`), and a field with no hint here still appears in the
 * schema with a generated description. A missing hint therefore costs a
 * slightly vaguer description, never a dropped field — which is the failure
 * mode the hardcoded list used to have.
 */
const EXTRA_FIELD_HINTS: Record<string, string> = {
  kind: 'functional | non_functional',
  directive: 'do | dont',
  likelihood: 'e.g. low | medium | high',
  impact: 'e.g. low | medium | high',
  validate_by: 'a date to revisit it',
  validated_on: 'the date it was confirmed',
  blocks: 'what this question is blocking',
};

/**
 * The `<field>: {type, description}` schema properties for every extra field
 * the category table declares, with the owning categories derived from which
 * categories actually declare it — so renaming or re-homing a field in
 * `categories.ts` updates the advertised description too.
 *
 * Every description says "Only on <categories>", and that word is load-bearing
 * rather than decorative. This flat argument list is the UNION of what every
 * category declares (see `extraFieldNames`, config.ts) and cannot be anything
 * else — one `tools/list` answer serves every project and must be byte-stable
 * for prompt caching — but a field is now REFUSED on a category that does not
 * declare it (`unknownExtraFieldError`, trust.ts). The descriptions used to
 * read "Typically <categories>", which was true when `kind` on a `constraint`
 * was merely unusual; a model reading that today would conclude the fields are
 * universal and be refused at the write. It says "Only" so the schema and the
 * validator agree about the same fact.
 */
function extraFieldSchema(config: Config): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const field of extraFieldNames(config)) {
    const owners = Object.values(config.categories)
      .filter((c) => c.extraFields.includes(field))
      .map((c) => c.name)
      .sort();
    const hint = EXTRA_FIELD_HINTS[field];
    props[field] = {
      ...S_STRING,
      description:
        `Category-specific. Only on ${owners.join(', ')} — refused on any other type` +
        `${hint ? `: ${hint}` : ''}`,
    };
  }
  return props;
}

/**
 * The schema is static (it must be byte-stable across calls for prompt
 * caching, and `tools/list` is answered before any workspace is known), so it
 * is built from the DEFAULT resolved config — which contains every built-in
 * category regardless of profile, and therefore every built-in extra field.
 *
 * A project CAN now add to that set: `categories.<name>.extraFields` in
 * `config.json` declares fields on a custom category, and replaces the list on
 * a built-in one (see `resolveConfig`). Those fields are honoured everywhere
 * `extra` is a free-form object — `update_item`, `mycontext add --extra`,
 * `mycontext edit --extra`, ingest — but they are NOT reachable through this
 * tool's flattened argument list, because `checkUnknownArgs` refuses an
 * argument the advertised schema does not name and the advertised schema is
 * this static one. That is the price of a byte-stable `tools/list`: making the
 * schema project-aware would recompute it per workspace and break the caching
 * this comment exists to protect. The `run` handler below still harvests from
 * `ctx.config`, so nothing here silently drops a project field — the refusal
 * happens at the argument gate, by name, before the handler is entered.
 */
const DEFAULT_CONFIG = resolveConfig({});

const SPECS: ToolSpec[] = [
  {
    name: 'create_item',
    schema: object({
      type: { ...S_STRING, description: 'Category — see mycontext_help("categories")' },
      title: { ...S_STRING, description: 'One sentence, the item as a claim' },
      body: { ...S_STRING, description: 'Why it holds' },
      summary: { ...S_STRING, description: 'One PLAIN sentence, max 160 chars, for a reader who does not know this codebase: what it IS and why it matters. No ids, no paths, no measurements, never how it was found. The body keeps the precision. REQUIRED unless you pass summary_omitted: an item created without a summary can never afterwards be asked for one, because every check that would ask compares a summary against the text it was written against' },
      // A boolean beside a string, and the pair is the whole design: the
      // schema cannot make `summary` conditionally required, so the handler
      // refuses instead and this description is where a model learns the
      // condition before it is refused. `required` below is unchanged — a
      // capture may legitimately arrive with `summary_omitted` and no summary,
      // and a schema that demanded both would refuse the opt-out it advertises.
      summary_omitted: {
        type: 'boolean',
        description:
          'Say that this item is being captured with NO summary, and that it is deliberate. A ' +
          'capture carrying neither a summary nor this is REFUSED, because an item born with ' +
          'no summary is invisible to every check that could later ask for one - mycontext ' +
          'doctor reports it as summary_absent and nothing else ever will. This is the named ' +
          'way to mean it: never a default, refused beside "summary", and the audit row records ' +
          '"summary-omitted" so that nobody wrote one is visible rather than assumed. Reach for ' +
          'it when the item genuinely has nothing to say in one sentence that its title does ' +
          'not - never to get past the refusal',
      },
      scope: { ...S_STRINGS, description: 'Repo-relative globs — see mycontext_help("scope")' },
      tags: S_STRINGS,
      severity: { ...S_STRING, enum: SEVERITIES },
      always: { type: 'boolean', description: 'Inject at every session start' },
      observations: {
        type: 'array',
        // `tags` and `context` are spelled out because `optObservations`
        // accepts and stores both. While they were undeclared, a caller could
        // only discover them by reading the source, and the top-level
        // `additionalProperties: false` `createRegistry` adds would have read
        // as forbidding them.
        items: object(
          { category: S_STRING, text: S_STRING, tags: S_STRINGS, context: S_STRING },
          ['category', 'text'],
        ),
      },
      steps: {
        type: 'array',
        // `S_STRING`, not an object: a caller cannot set `checked`, so
        // "nothing in this product ever writes `checked: true`" holds by
        // construction at this boundary rather than by convention. A box is
        // ticked only by a human editing the Markdown, and this schema
        // therefore does not mention one — a model that never sees the field
        // cannot invent a "done" flag for it.
        items: { ...S_STRING },
        // Steps are accepted on EVERY category (design decision 19 — there is
        // no category-conditional field rule anywhere in this product to
        // follow), so this description is one of the few places the
        // `procedure`/`runbook` boundary is stated where a model is choosing.
        description:
          'Ordered steps for a `procedure` — an operation performed once and then finished. ' +
          'Stored as "- [ ] text" lines; progress is never stored in the item. A repeatable ' +
          'sequence is a `runbook`, and it keeps its steps in the body.',
      },
      source_file: { ...S_STRING, description: 'Document this came from' },
      source_anchor: { ...S_STRING, description: 'Heading within that document' },
      ...extraFieldSchema(DEFAULT_CONFIG),
      // The escape hatch `update_item` already has (see its own `extra`
      // property below), mirrored here. The flattened properties just above
      // are generated from `extraFieldSchema(DEFAULT_CONFIG)` — the STATIC
      // default config, byte-stable for `tools/list` — so they can only ever
      // name a BUILT-IN category's extra fields. A project that adds its own
      // field to `config.json` (`categories.<name>.extraFields`) has no
      // flattened argument for it, and this is the route: a free-form object,
      // validated the same way `update_item`'s is, against the WORKSPACE's
      // actual config rather than the static default.
      extra: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description:
          'A project-defined extra field not listed above — one this workspace\'s own ' +
          'config.json adds to a category. The fields named above already cover every ' +
          'BUILT-IN category\'s extra fields; use this only for one this project added itself. ' +
          'Refused if a field is also named above for the same call.',
      },
    }, ['type', 'title']),
    // origin is never accepted from the schema above. Every handler that
    // writes on an agent's behalf — create_item, update_item, supersede_item
    // — passes origin: 'agent' itself, so an argument the model could set
    // would make the whole trust boundary advisory. link_items is the one
    // exception, and it cannot be otherwise: `LinkInput` has no `origin` at
    // all, because adding a relation crosses no trust boundary — `linkItems`
    // never touches status, severity, scope, always or the item's body.
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const extra: Record<string, string> = {};
      // Driven from the resolved config, not a literal: see `extraFieldNames`.
      for (const key of extraFieldNames(ctx.config)) {
        const value = optStr(args, key);
        if (value !== undefined) extra[key] = value;
      }
      // The free-form escape hatch, merged in rather than letting one silently
      // overwrite the other. A name given both ways is refused instead of
      // picking a winner — the same shape `unknownExtraFieldError` (trust.ts)
      // refuses an unrecognised field with, just below this call.
      const freeform = optExtra(args);
      if (freeform) {
        for (const key of Object.keys(freeform)) {
          if (Object.hasOwn(extra, key)) {
            throw new Error(
              `my_context: "${key}" was passed both as a top-level argument and inside "extra". ` +
              `Pass it once: as the flattened argument if it is a built-in field, or inside ` +
              `"extra" if this project's own config.json declared it.`,
            );
          }
        }
        Object.assign(extra, freeform);
      }
      const input: CreateInput = {
        type: str(args, 'type', 'create_item'),
        title: str(args, 'title', 'create_item'),
        body: optStr(args, 'body'),
        summary: optStr(args, 'summary'),
        summaryOmitted: optBool(args, 'summary_omitted') ?? undefined,
        scope: optList(args, 'scope'),
        tags: optList(args, 'tags'),
        severity: optEnum<Severity>(args, 'severity', SEVERITIES, 'capture'),
        always: optBool(args, 'always'),
        observations: optObservations(args),
        // `optList`, the same reader `scope`/`tags` use, and for its reason:
        // a model that passes a bare string, or an array of `{text, checked}`
        // objects, has misunderstood the field, and coercing either one
        // produces a plausible-looking procedure that says something the
        // caller did not. `createItem` then refuses any text the Markdown
        // could not hold back byte-identically.
        steps: optList(args, 'steps'),
        sourceFile: optStr(args, 'source_file') ?? null,
        sourceAnchor: optStr(args, 'source_anchor') ?? null,
        extra,
        origin: 'agent',
      };
      // **The summary gate, on the agent half of its creation surface**, and
      // it is placed here rather than inside `createItem` for the reason
      // `summaryRequiredAtCreate` states: `createItem` is the shared road
      // every mechanical caller drives down, and a gate there would refuse
      // pack imports and ingest runs that have no author to ask.
      //
      // The contradiction first, so a call passing both a summary and
      // `summary_omitted` is told about it rather than being waved through by
      // the summary it carries — the order `update_item` puts
      // `summaryUnchangedRefusal` in, for its reason.
      const omittedRefusal = summaryOmittedRefusal(input, 'create_item');
      if (omittedRefusal) throw new Error(omittedRefusal);
      if (summaryRequiredAtCreate(input)) {
        throw new Error(summaryAtCreateRefusal(input, 'create_item'));
      }
      return createItem(ctx, input).message;
    }),
  },
  {
    name: 'update_item',
    schema: object({
      id: S_STRING,
      title: S_STRING,
      body: S_STRING,
      // Content, like title and body, and the description says the one thing a
      // caller cannot infer from the name: the empty string is how a summary
      // is REMOVED. There is no null spelling — see `UpdateInput.summary`.
      summary: {
        ...S_STRING,
        description:
          'One PLAIN sentence, max 160 chars, for a reader who does not know this codebase: what it IS and why it matters. No ids, no paths, no measurements, never how it was found. Optional - the body keeps the precision. Content, so it is staged for ' +
          'review on a governing normative item like title and body. Pass "" to remove ' +
          'the existing summary',
      },
      // The escape hatch for the gate below, and the description says the one
      // thing a caller cannot infer: it is an assertion about MEANING, not a
      // way to skip a step. See `UpdateInput.summaryUnchanged`.
      summary_unchanged: {
        type: 'boolean',
        description:
          'Say that this edit does NOT change what the item means, so the summary it already ' +
          'carries still describes it. An edit that moves the body, steps, observations or ' +
          'extra fields is REFUSED without a new "summary", because nothing in this product ' +
          'can write one; this is the answer for a typo, a reflow or a rewrapped paragraph. It ' +
          're-stamps what the summary was written against without new text, and the audit log ' +
          'records that nobody rewrote it. Refused beside "summary", on an item with no ' +
          'summary, and on an edit that was never asked for one. It is NOT how an ALREADY-STALE ' +
          'summary is cleared: if that sentence still describes the item, pass it back verbatim ' +
          'as "summary" - a re-affirmation, which re-stamps the basis and is audited as one. ' +
          'Never invent a different sentence just to clear a stale warning',
      },
      scope: { ...S_STRINGS, description: 'Refused on a governing normative item' },
      tags: S_STRINGS,
      severity: { ...S_STRING, enum: SEVERITIES, description: 'Refused on a governing normative item' },
      always: { type: 'boolean', description: 'Refused on a governing normative item' },
      status: { ...S_STRING, enum: STATUSES, description: 'Rationale items only' },
      // Content, and it says so: `extra` carries `rule.directive`, which decides
      // whether a rule prohibits or prescribes. It used to be described here as
      // fields "to merge in" and nothing else, while it was the one writable
      // field neither `agentEdits` nor the reach-and-force guard covered.
      extra: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description:
          'Category-specific fields to merge in, e.g. kind, directive, likelihood. Content, so ' +
          'it is staged for review on a governing normative item like title, body and tags',
      },
    }, ['id']),
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const id = str(args, 'id', 'update_item');
      const patch: UpdateInput = {
        id,
        title: optStr(args, 'title'),
        body: optStr(args, 'body'),
        summary: optStr(args, 'summary'),
        summaryUnchanged: optBool(args, 'summary_unchanged') ?? undefined,
        scope: optList(args, 'scope'),
        tags: optList(args, 'tags'),
        severity: optEnum<Severity>(args, 'severity', SEVERITIES, 'capture'),
        always: optBool(args, 'always'),
        status: optEnum<Status>(args, 'status', STATUSES, 'workflow'),
        extra: optExtra(args),
        origin: 'agent',
      };
      // **The summary gate, on the second of its two AUTHORED surfaces.**
      //
      // `mycontext edit` is the human one; this is the agent's, and the ruling
      // applies here at least as hard: an agent rewriting a body is holding the
      // new text in the same turn, and writing one plain sentence about it is
      // the cheapest it will ever be. It also closes the staging path without
      // touching it — on a category set to `agentEdits: "review"` the summary
      // is staged WITH the body, so the promotion a human later approves lands
      // both rather than landing a body against an old summary.
      //
      // It is applied HERE and not inside `updateItem`, and that placement is
      // the whole of the caller audit: `updateItem` is the road every internal
      // mechanical write drives down — a promoted revision, a pack import, a
      // status change from `review promote`, `refresh_item`'s re-snapshot of a
      // file — and none of those is a person holding new prose. A gate there
      // would refuse them all.
      //
      // `ctx.store.get` rather than a second lookup helper: `updateItem` will
      // refuse an unknown id in its own words a line later, so a null here just
      // falls through to that refusal instead of growing a second one.
      const item = ctx.store.get(id);
      if (item) {
        const hatchRefusal = summaryUnchangedRefusal(item, patch, 'update_item');
        if (hatchRefusal) throw new Error(hatchRefusal);
        if (summaryRequired(item, patch)) {
          throw new Error(summaryRequiredRefusal(item, 'update_item'));
        }
      }
      return updateItem(ctx, patch).message;
    }),
  },
  {
    // The agent-facing half of `mycontext refresh`. It takes an id and NO
    // content: the server re-reads the item's own `source_file` and writes
    // what is there. That is the whole point of the tool existing rather than
    // the model calling `update_item` with text it pasted — a snapshot's one
    // guarantee is that its body is a copy of the named file, and a body
    // supplied by the caller cannot carry that guarantee.
    //
    // It crosses no trust boundary the rest of the surface does not: it calls
    // `updateItem` with `origin: 'agent'`, so on a category set to
    // `agentEdits: "review"` — the default on the normative tier, which is
    // where a retiered `reference` would land — the new snapshot is STAGED as
    // a pending revision and the item is untouched until a human promotes it.
    // On the rationale tier, where `reference` ships and where the item is
    // never injected in full, it applies.
    //
    // There is deliberately NO agent-facing capture. A reference enters the
    // corpus only through `mycontext add <category> "<title>" --file <path>`,
    // a human command, so the decision that a particular file's contents
    // belong in this project's knowledge is one a person makes once. Refresh
    // is the part that recurs, and is therefore the part an agent can help
    // with.
    name: 'refresh_item',
    schema: object({
      id: {
        ...S_STRING,
        description:
          'A file-snapshot item (captured with `mycontext add ... --file`). Its body is ' +
          'replaced with the current text of its source_file; nothing else changes.',
      },
    }, ['id']),
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const id = str(args, 'id', 'refresh_item');
      const item = ctx.store.get(id);
      if (!item) throw new Error(unknownIdError(id, ctx.store.all().map((i) => i.id)));
      if (!isSnapshot(item)) {
        throw new Error(
          `my_context: ${id} is not a file snapshot, so there is nothing to re-read. ` +
          `refresh_item only acts on an item captured with \`mycontext add <category> ` +
          `"<title>" --file <path>\`, which records source_file and source_checksum and no ` +
          `source_anchor. An INGESTED item (source_anchor set) holds an assertion someone ` +
          `extracted from a section, not a copy of it, and overwriting that with the file ` +
          `would discard their judgement. Nothing was written.`,
        );
      }
      const repoRoot = path.dirname(ctx.root);
      const snapshot = readSnapshot(repoRoot, repoRoot, item.sourceFile as string);
      if (snapshot.checksum === item.sourceChecksum) {
        return (
          `my_context: ${id} is already current — "${snapshot.sourceFile}" is unchanged since ` +
          `it was snapshotted (${snapshot.checksum}). Nothing was written.`
        );
      }
      // `'refresh'`, matching `mycontext refresh` — see the note there. Both
      // surfaces must record the same op or the audit log's answer to "how did
      // this body change" would depend on which door was used.
      return updateItem(ctx, { id, body: snapshot.body, origin: 'agent' }, 'refresh').message;
    }),
  },
  {
    name: 'supersede_item',
    schema: object({
      id: { ...S_STRING, description: 'The item being retired' },
      by: { ...S_STRING, description: 'The replacement, which must already exist' },
      reason: S_STRING,
    }, ['id', 'by']),
    // origin: 'agent' here is load-bearing, not cosmetic: supersedeItem
    // refuses to let an agent retire a normative item that currently governs
    // (active or validated) — the exact security boundary updateItem's
    // status rule exists to protect. Defaulting to 'human' here (as the
    // omitted argument would) bypasses that guard entirely.
    run: (cwd, args) => withWorkspace(cwd, (ctx) => supersedeItem(ctx, {
      id: str(args, 'id', 'supersede_item'),
      by: str(args, 'by', 'supersede_item'),
      reason: optStr(args, 'reason'),
      origin: 'agent',
    }).message),
  },
  {
    name: 'link_items',
    schema: object({
      from: S_STRING,
      to: S_STRING,
      // **The enum IS the vocabulary, stated where the caller reads it.** This
      // was a bare string with `description: 'See mycontext_help("workflow")'`,
      // and the document it pointed at held a HAND-TYPED table that had gone
      // stale: on 2026-09-02 `RELATION_TYPES` went from eight names to twelve
      // and the table stayed at nine, so this tool accepted four values that
      // nothing an agent could read ever named. `RELATION_TYPES` here is that
      // list itself, so `mycontext_help("tools")` — which renders every
      // property's enum from the live `tools/list` schemas — prints the
      // vocabulary automatically and can never fall behind it again.
      //
      // `supersedes` is a member and is nonetheless refused by `linkItems`
      // by name, so it is listed AND excepted in the same breath rather than
      // filtered out: an enum that omitted it would make a client reject the
      // call generically, and what `linkItems` throws instead is the
      // paragraph that names which item gets retired and which command to
      // use. Losing that refusal to a schema check would cost more than the
      // eleventh name is worth.
      relation: {
        ...S_STRING,
        enum: RELATION_TYPES,
        description:
          'Stored on "from" and not symmetric. "supersedes" (and "superseded_by", which is not '
          + 'in this list at all) assert a lifecycle change and are refused here — use '
          + 'supersede_item. See mycontext_help("workflow") for what each one means',
      },
    }, ['from', 'to', 'relation']),
    // `origin: 'agent'` gates nothing here — `linkItems` does not branch on it
    // — but it is what makes the audit log's "who" true for an edge a model
    // added. Left to the `'human'` default, every agent-added relation would
    // be recorded as the user's.
    run: (cwd, args) => withWorkspace(cwd, (ctx) => linkItems(ctx, {
      from: str(args, 'from', 'link_items'),
      to: str(args, 'to', 'link_items'),
      relation: str(args, 'relation', 'link_items'),
      origin: 'agent',
    }).message),
  },
  {
    name: 'get_item',
    schema: object({ id: S_STRING }, ['id']),
    // The item, and then whether a proposal is waiting to rewrite it.
    //
    // This is the surface 1C.2 is really about. `update_item` under
    // `agentEdits: "review"` answers "NOT applied — staged as revision REV-…",
    // and that sentence was the ONLY place the fact ever appeared: a later
    // call, a later session, or a different agent read the item back with no
    // sign at all that a proposal existed. Which makes the staging pointless
    // in both directions — the model re-proposes the change it already
    // proposed, or reasons about text that is not in force and says so to the
    // user.
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const item = requireItem(ctx, str(args, 'id', 'get_item'));
      const notice = itemRevisionNotice(item.id, pendingRevisions(ctx));
      // The same disclosure `mycontext show` prints, from the same function
      // (content-hash.ts), and for a sharper reason on this surface: a model
      // reading an item back is the caller most likely to quote its summary
      // onward, and `renderItem` prints `summary:` and `summary_of:` as two
      // frontmatter lines no reader can hash in their head. The summary is
      // never withheld here — it is labelled.
      const stale = summaryStalenessNote(item);
      return renderItem(item)
        + (stale ? `\n\n${stale}` : '')
        + (notice ? `\n\n${notice}` : '');
    }),
  },
  {
    name: 'query_items',
    schema: object({
      type: { ...S_STRING, description: 'Category — see mycontext_help("categories")' },
      status: { ...S_STRING, enum: STATUSES },
      tag: S_STRING,
      text: {
      ...S_STRING,
      // The model reads this, so a narrow description is a narrow search: an
      // agent told the filter covers title and body will not try it for a
      // phrase it expects in an observation.
      description: 'Substring of the title, body, any observation, or any extra value',
    },
      path: { ...S_STRING, description: 'Repo-relative file path; matches item scopes' },
      relation: {
        ...S_STRING,
        description: 'Items carrying this relation type. Combined with linked_to, matches either '
          + 'spelling of an inverse pair (e.g. "enforces" also matches a stored "enforced_by" row)',
      },
      // B10 — the backlink query. `relationDegrees` and `apiGraph`
      // (`src/ui/read-model.ts`) already walk every edge in both directions to
      // build their own read models; before this, nothing an agent could call
      // answered "what points AT this item" — only "what does this item point
      // at", by reading its own relations back off `get_item`.
      linked_to: {
        ...S_STRING,
        description: 'Item id. Only items connected to THIS item by a relation, in `direction`. '
          + 'Needs no direction to be useful alone — with only linked_to, every connected item '
          + 'comes back regardless of which way the relation points',
      },
      direction: {
        ...S_STRING,
        enum: LINK_DIRECTIONS,
        description: 'Which side of linked_to\'s edges to answer with: "in" is what points AT it, '
          + '"out" is what it points at, "both" (the default) is either. Refused without '
          + 'linked_to, which is the item this is a direction OF',
      },
      limit: { type: 'number' },
    }),
    // The predicate itself is `filterItems` (src/core/search.ts), shared with
    // `mycontext search` — the CLI counterpart this tool did not have until
    // Phase 4. Two copies of one filter is the drift this project keeps
    // finding; one copy is what makes "the same search, either surface" a
    // structural fact rather than a promise. Only the RENDERING is this
    // surface's own.
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const linkedTo = optStr(args, 'linked_to');
      const direction = optEnum<LinkDirection>(args, 'direction', [...LINK_DIRECTIONS], 'workflow');
      // `direction` alone answers nothing — it names a side of an anchor's
      // edges that was never given. Refused rather than silently ignored, the
      // same reason an unrecognized argument is refused elsewhere on this
      // surface: a caller who typed it believed it was doing something.
      if (direction !== undefined && linkedTo === undefined) {
        throw new Error(
          'my_context: "direction" only means something alongside "linked_to" — it names which ' +
          'side of THAT item\'s edges to answer with, and there is no item here to answer about.',
        );
      }
      const hits = filterItems(ctx.store.all(), {
        type: optStr(args, 'type'),
        status: optEnum<Status>(args, 'status', STATUSES, 'workflow'),
        tag: optStr(args, 'tag'),
        text: optStr(args, 'text'),
        path: optStr(args, 'path'),
        relation: optStr(args, 'relation'),
        linkedTo,
        direction,
      }, ctx.config);

      return listOf(
        hits, ctx.config, optNum(args, 'limit', 20),
        'my_context: no items match that query. Try fewer filters, or ' +
        'mycontext_help("categories") to check the type name.',
        pendingRevisions(ctx),
      );
    }),
  },
  {
    name: 'list_drafts',
    schema: object({ type: S_STRING, limit: { type: 'number' } }),
    // Newest first, as the tool description promises — `store.all()` comes
    // back `ORDER BY id`, which is alphabetical, not chronological.
    // `validFrom` is day-granularity, so items captured the same day sort
    // only by id (ascending, for determinism), not by time of day.
    //
    // The membership question ("which drafts are pending review") is
    // `core/select`'s `reviewQueue` and is not re-derived here: this tool is
    // named to the agent as the review queue (see `mcp/tools/ingest.ts`), and
    // a copy of the filter that omitted the layer check offered global-layer
    // drafts that `mycontext review promote` then refuses. Only the ORDER is
    // this tool's own.
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const type = optStr(args, 'type');
      const drafts = reviewQueue(ctx.store.all(), type ?? null)
        .sort((a, b) => {
          const byDate = (b.validFrom ?? '').localeCompare(a.validFrom ?? '');
          return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
        });
      // The SECOND queue is reported here too, exactly as `mycontext review`
      // reports it on every path including the empty one. Without it this tool
      // answered "no drafts are waiting for review" in a workspace with
      // proposals waiting for a human — the same sentence, on the same queue,
      // that `review list` was already fixed for. `type` deliberately does not
      // filter it: it selects a category of DRAFT, and narrowing a different
      // queue by it would make this number disagree with `mycontext status`.
      return listOf(
        drafts, ctx.config, optNum(args, 'limit', 20),
        'my_context: no drafts are waiting for review.',
        pendingRevisions(ctx),
      );
    }),
  },
  {
    /**
     * **`mycontext list`, mirrored — the corpus census by category.**
     *
     * `CLI_WITHOUT_TOOL.list` (plugin/parity.ts) recorded this as `owed` and
     * left one thing undecided: whether `query_items` already answers the
     * same question well enough to make a second tool redundant. Measured
     * directly, it does not — `query_items` returns matching ITEMS, with no
     * grouping and no counts, so producing `mycontext list`'s per-category
     * census through it would take one call per category plus manual
     * tallying. This tool answers the census directly, the same way
     * `cmdList` (cli/index.ts) does: `type => count` over every item in the
     * corpus, no mutation, no origin check.
     *
     * The one real overlap is the FILTERED form: `list_items({category:
     * 'reference'})` and `query_items({type: 'reference'})` answer the same
     * question, and the schema description says so rather than pretend
     * there is none.
     */
    name: 'list_items',
    schema: object({
      category: {
        ...S_STRING,
        description:
          'Only this category — see mycontext_help("categories"). Omitted, this returns the ' +
          'census below instead: every category with a count, not items. The overlap with ' +
          'query_items is here: query_items({type}) answers the same filtered question.',
      },
      limit: {
        type: 'number',
        description: 'Caps the row list a "category" returns. Meaningless on the census, which is never capped.',
      },
    }),
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const category = optStr(args, 'category');
      const items = ctx.store.all();

      if (category === undefined) {
        if (items.length === 0) return 'my_context: no items in this corpus yet.';
        const counts = new Map<string, number>();
        for (const item of items) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
        const rows = [...counts]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([type, n]) => `${type} · ${n}`);
        return [
          `my_context: ${items.length} item(s) across ${counts.size} ` +
          `categor${counts.size === 1 ? 'y' : 'ies'}:`,
          '',
          ...rows,
        ].join('\n');
      }

      // Same refusal `cmdList` gives for a misspelled category — and the
      // same two things it deliberately does NOT refuse: a category that
      // exists but is disabled (items captured before it was disabled are
      // still on disk and still findable by name), and a type absent from
      // config but present in the corpus (a category renamed or deleted
      // after items were captured). See the comment on `cmdList` itself.
      const configured = Object.hasOwn(ctx.config.categories, category);
      const inCorpus = items.some((item) => item.type === category);
      if (!configured && !inCorpus) {
        throw new Error(
          enumError('category', category, Object.keys(ctx.config.categories).sort(), 'categories'),
        );
      }

      const matched = items.filter((item) => item.type === category);
      return listOf(
        matched, ctx.config, optNum(args, 'limit', 20),
        `my_context: no ${category} items.`,
        pendingRevisions(ctx),
      );
    }),
  },
  {
    /**
     * **`mycontext ready`, mirrored — what can be started right now.**
     *
     * `CLI_WITHOUT_TOOL.ready` (plugin/parity.ts) recorded this as `owed`:
     * read-only, no mutation, no origin check anywhere on its path. This tool
     * closes that row rather than answering the question a second way —
     * `readyReport` (core/needs.ts) is the ONE place readiness is derived,
     * the same call `cmdReady` (cli/commands/ready.ts) makes, so a tool and a
     * command can never quietly disagree about what is unblocked.
     *
     * Nothing here is stored, exactly as the CLI's own doc comment says:
     * readiness is `needs` plus the `state` of what it names, computed fresh
     * on every call.
     */
    name: 'ready',
    schema: object({
      plan: {
        ...S_STRING,
        description: 'Only tasks whose "plan" extra field matches this, case-insensitively',
      },
      held: {
        type: 'boolean',
        description:
          'Also list HELD work below the ready rows, each naming why it is not ready. Held work ' +
          'is always counted, whether or not this is set.',
      },
      limit: {
        type: 'number',
        description:
          'Cap on ready rows returned, highest priority first. Default 50 — the same cap ' +
          '`mycontext ready` applies to its own table, made explicit here rather than left silent.',
      },
    }),
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const workCategories = Object.keys(ctx.config.categories)
        .filter((name) => isWorkCategory(ctx.config, name))
        .sort();
      // Same disclosure `cmdReady` opens with: "nothing is ready" and "no
      // category here plans work" are different answers, and returning the
      // first for the second would be the silent-empty-answer failure this
      // project has already been fixed for elsewhere on this surface.
      if (workCategories.length === 0) {
        return `my_context: no enabled category in this project declares "${PLAN_FIELD}", ` +
          `"${SEQ_FIELD}" and "${STATE_FIELD}", so there is no planned work to order. See ` +
          `mycontext_help("categories").`;
      }

      const plan = optStr(args, 'plan');
      const includeHeld = optBool(args, 'held') ?? false;
      const limit = optNum(args, 'limit', 50);

      const report = readyReport(ctx.store.all(), ctx.config);
      const inPlan = (row: ReadyRow | HeldRow): boolean =>
        plan === undefined
        || (row.item.extra[PLAN_FIELD] ?? '').toLowerCase() === plan.toLowerCase();
      const ready = report.ready.filter(inPlan);
      const held = report.held.filter(inPlan);
      const shown = ready.slice(0, limit);

      const taskCell = (row: ReadyRow | HeldRow): string => {
        const p = row.item.extra[PLAN_FIELD] ?? '';
        const s = row.item.extra[SEQ_FIELD] ?? '';
        return p === '' || s === '' ? '(no plan/seq)' : `${p}/${s}`;
      };

      const lines: string[] = [];
      if (shown.length === 0) {
        lines.push(plan === undefined
          ? 'my_context: no task is ready to start.'
          : `my_context: no task in plan "${plan}" is ready to start.`);
      } else {
        lines.push(
          `my_context: ${ready.length} ready of ${ready.length + held.length} open task(s)` +
          (ready.length > shown.length
            ? ` — ${shown.length} shown. Raise "limit" or narrow "plan" to see the rest.`
            : '.'),
        );
        for (const row of shown) {
          lines.push(
            `${row.item.id} · ${taskCell(row)} · pri ${row.item.extra.priority ?? '-'} · ` +
            `${row.reading.state} · ${row.item.title}`,
          );
        }
      }

      if (held.length > 0) {
        const byReason = new Map<HeldRow['reason'], number>();
        for (const row of held) byReason.set(row.reason, (byReason.get(row.reason) ?? 0) + 1);
        lines.push(
          '',
          `${held.length} open task(s) held and not listed above: ` +
          [...byReason].sort((a, b) => a[0].localeCompare(b[0]))
            .map(([reason, n]) => `${n} ${READY_HELD_REASON[reason]}`).join(', ') +
          '. Pass held: true to list the rows.',
        );
        if (includeHeld) {
          for (const row of held) {
            lines.push(
              `${row.item.id} · ${taskCell(row)} · held: ${READY_HELD_REASON[row.reason]} · ` +
              row.item.title,
            );
          }
        }
      }

      lines.push(
        '',
        `Readiness is derived on every run from "${NEEDS_FIELD}" and the "${STATE_FIELD}" of ` +
        `what it names — stored nowhere. A task with no "${NEEDS_FIELD}" is ready here because ` +
        'nothing in the corpus says otherwise; a dependency only ever written in prose is ' +
        'invisible to this report. mycontext doctor reports the blocked tasks that name nothing.',
      );

      return lines.join('\n');
    }),
  },
  {
    /**
     * **`mycontext doctor`, mirrored — the self-check, read-only.**
     *
     * `CLI_WITHOUT_TOOL.doctor` (plugin/parity.ts) recorded this as `owed`
     * for the same reason `ready` was: nothing on `runChecks`'s path mutates
     * or checks origin. This tool calls `runChecks` (doctor/checks.ts)
     * directly — the same function `cli/commands/doctor.ts` composes — so
     * there is exactly one place corpus health is computed.
     *
     * **The findings/disclosures split is reproduced, not skipped.** A
     * `Finding` carrying `about` is a note a check makes about ITSELF —
     * what it could not measure — never a defect in the corpus (see
     * `Finding.about`'s own doc comment). The CLI routes those out of its
     * finding count and its exit code; this tool does the same, through
     * `isDoctorDisclosure` above, so a corpus `mycontext doctor` calls clean
     * is reported clean here too — a disclosure with no finding beside it
     * must still read as ZERO findings, never as a lone unexplained note.
     */
    name: 'doctor',
    schema: object({}),
    run: (cwd) => {
      const ws = resolveWorkspace(cwd);
      if (!ws.projectRoot) {
        throw new Error(
          `my_context: there is no .my_context workspace at or above ${cwd}. ` +
          `Ask the user to run \`mycontext init\`.`,
        );
      }
      const projectRoot = ws.projectRoot;
      const { store, errors: rawErrors } = openRebuiltStore(ws, { retryOnBusy: true });
      let items: Item[];
      try {
        items = store.all();
      } finally {
        store.close();
      }

      // `errors` mirrors `cmdDoctor`'s own split: a checksum mismatch whose
      // basis predates `CHECKSUM_BASIS_VERSION` is a benign migration, turned
      // into an ordinary `warn` finding by `checksumMigrationFindings` rather
      // than counted as a corpus load error.
      const errors = rawErrors.filter((e) => e.kind !== 'migration');
      const migrationFindings = checksumMigrationFindings(rawErrors);
      const all: Finding[] = [
        ...runChecks({
          root: projectRoot,
          repoRoot: path.dirname(projectRoot),
          dbPath: ws.dbPath,
          items,
          config: ws.config,
        }),
        ...migrationFindings,
      ];
      const findings = all.filter((f) => !isDoctorDisclosure(f));
      const disclosures = all.filter(isDoctorDisclosure);

      const totalErrors = findings.filter((f) => f.level === 'error').length + errors.length;
      const warnings = findings.filter((f) => f.level === 'warn').length;
      const infos = findings.filter((f) => f.level === 'info').length;
      const acknowledged = findings.filter((f) => f.acknowledged === true).length;

      const lines: string[] = [
        `my_context doctor: ${totalErrors} error(s), ${warnings} warning(s), ${infos} note(s) ` +
        `across ${findings.length} finding(s).` +
        (errors.length
          ? ` ${errors.length} of the error(s) are corpus load errors, listed below.`
          : ''),
      ];
      if (acknowledged > 0) {
        lines.push(
          `${acknowledged} of the finding(s) above are ACKNOWLEDGED: a person read each one ` +
          'and ruled on it. Still reported, still counted — acknowledging distinguishes a ' +
          'finding, it does not silence it.',
        );
      }

      for (const f of findings) {
        lines.push(
          `${f.level}  ${f.code}${f.item ? `  ${f.item}` : ''}` +
          `${f.acknowledged === true ? '  [acknowledged]' : ''}: ${f.message}`,
        );
      }

      if (errors.length > 0) {
        lines.push('', `${errors.length} corpus load error(s), not findings:`);
        for (const e of errors) lines.push(`  ${e.file}: ${e.message}`);
      }

      if (disclosures.length > 0) {
        lines.push(
          '',
          'notes about the checks themselves — what they could not measure, said once. These ' +
          'are NOT findings, are not counted above, and nothing is owed on them.',
        );
        for (const f of disclosures) {
          lines.push(`  ${f.code} — about the "${f.about}" check: ${f.message}`);
        }
      }

      return lines.join('\n');
    },
  },
  {
    name: 'load_context',
    // No properties at all, and none may be added: the one argument this
    // tool could plausibly want is a session id, and the model has no way to
    // know it — it would have to invent one, and a fabricated ledger key is
    // exactly the silent corruption `buildInjection` refuses. See the note
    // there on why the manual path records nothing.
    schema: object({}),
    // Deliberately NOT wrapped in `withWorkspace`: this is a read path that
    // must not behave like a mutation. `buildInjection` does its own
    // workspace resolution and rebuild, and fails open with '' — the same
    // text SessionStart would have produced, produced by the same code.
    run: (cwd) => buildInjection(cwd, { event: 'manual' }) || (
      `my_context: nothing to inject. Either there is no .my_context workspace ` +
      `at or above ${cwd} — ask the user to run \`mycontext init\` — or nothing ` +
      `has been captured in it yet. See mycontext_help("capture").`
    ),
  },
  {
    /**
     * **Q3's "readable by agents", answered now rather than later.**
     *
     * It ships in the same change as the log because the alternative is a
     * capability the corpus item already promises ("mirrored as MCP tools so
     * Claude can inspect its own effects") sitting unbuilt behind a decision
     * that was already taken, and because it costs almost nothing: it is a
     * read-only view over the same filter the CLI uses, so there is no second
     * definition of "records for this item" to keep in step.
     *
     * It answers the question a model most needs and cannot otherwise get:
     * what did I already do in this workspace, and what has this session
     * already been shown. Both are things a model currently guesses at.
     *
     * `session` is accepted but never defaulted, for the reason
     * `buildInjection` documents at length: the MCP server has no trustworthy
     * session id, so inventing one here would filter against a key nothing
     * ever recorded and answer "nothing happened" for a busy session.
     */
    name: 'audit_log',
    schema: object({
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
    }),
    // Read-only, and deliberately NOT wrapped in `withWorkspace`: that helper
    // rebuilds the item index on every call, which this tool has no use for —
    // the audit log is not derived from the corpus and does not go stale when
    // an item file changes.
    run: (cwd, args) => {
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
    },
  },
  {
    name: 'mycontext_help',
    schema: object({
      // Derived, like `audit_log`'s ops. The hand-written four stopped being
      // right the moment `tools` and `slash` landed, and a hand-written enum
      // does not notice. `MCP_HELP_TOPICS` carries the one exclusion and the
      // reason for it.
      topic: { ...S_STRING, enum: MCP_HELP_TOPICS },
    }, ['topic']),
    // Help must work without a workspace: not knowing what a category is and
    // not having a workspace are the same moment.
    run: (cwd, args) => helpTopic(
      str(args, 'topic', 'mycontext_help'), resolveWorkspace(cwd).config,
    ),
  },
  {
    name: 'mycontext_examples',
    schema: object({ type: S_STRING }, ['type']),
    run: (cwd, args) => exampleItem(
      str(args, 'type', 'mycontext_examples'), resolveWorkspace(cwd).config,
    ),
  },
  {
    /**
     * **The focus, reachable by the model — decided rather than assumed.**
     *
     * `REQ-session-focus-controls-what-loads` asks for it in as many words:
     * "every command must be mirrored as an MCP tool so Claude can narrow its
     * own context too", and Phase 4's parity rule points the other way as well.
     * The obvious objection is real and worth stating: this is a tool an agent
     * can use to hide governing rules from itself, and a narrowed agent that
     * then reports on "the rules for this project" is describing a corpus it
     * chose. Three things answer it, and none of them is trust:
     *
     *  1. **`severity: hard` items are never hidden**, by any caller, through
     *     any surface. The rules a project says must not be violated are not
     *     narrowable — the predicate is in `select`, not in this handler.
     *  2. **Every injection under a focus discloses it**, in the injected block
     *     the model reads and a human can read over its shoulder. An agent
     *     cannot narrow its context and leave no trace in the very text it is
     *     working from.
     *  3. **Every focus change is audited with its `origin`**, so
     *     `mycontext audit --kind focus` answers "who narrowed this, and when".
     *
     * With no arguments it REPORTS rather than changing anything: a tool whose
     * empty call silently widened or narrowed a corpus would be the worst
     * possible default here.
     */
    name: 'focus_context',
    schema: object({
      tags: { ...S_STRINGS, description: 'Keep items carrying any of these tags' },
      categories: {
        ...S_STRINGS,
        description: 'Keep items of these categories — see mycontext_help("categories")',
      },
      scope: { ...S_STRINGS, description: 'Keep items applying to these paths or globs' },
      preview: {
        type: 'boolean',
        description: 'Report what the focus would hide and change nothing',
      },
      clear: { type: 'boolean', description: 'Remove the focus. Refused alongside axes.' },
    }),
    run: (cwd, args) => {
      const ws = resolveWorkspace(cwd);
      if (!ws.projectRoot) {
        throw new Error(
          `my_context: there is no .my_context workspace at or above ${cwd}, so there is no ` +
          `focus to set. Ask the user to run \`mycontext init\`.`,
        );
      }
      const root = ws.projectRoot;
      const axes: FocusAxes = {
        tags: optList(args, 'tags') ?? [],
        categories: optList(args, 'categories') ?? [],
        scope: optList(args, 'scope') ?? [],
      };
      const asked = isFocusActive(axes);

      if (optBool(args, 'clear') === true) {
        if (asked) {
          throw new Error(
            'my_context: focus_context takes either "clear" or the axes, never both. ' +
            'Clearing and setting in one call has two readings, and honouring either would ' +
            'drop the other without saying so. Nothing was changed.',
          );
        }
        const { existed, audit } = unsetFocus(root, 'agent');
        return existed
          ? `my_context: focus cleared. Every eligible item is injectable again.` +
            auditFailureNote(audit)
          : 'my_context: there was no focus to clear. Nothing was hidden.';
      }

      // The report always comes from `select`, never from a second predicate —
      // see the note on `SelectContext.focus`.
      const describe = (focus: Focus | null, heading: string): string => {
        // The same `retryOnBusy: true` every other MCP surface takes through
        // `withWorkspace`. This site had silently drifted to no-retry — the
        // one MCP rebuild a busy database could fail immediately — which is
        // exactly the divergence consolidating the open-rebuild copies
        // exists to make impossible.
        const { store } = openRebuiltStore(ws, { retryOnBusy: true });
        try {
          const report = select(store.all(), { event: 'manual', focus }, ws.config).focus;
          if (report === null) {
            return 'my_context: no focus is set — every eligible item is injectable. Set one ' +
              'with focus_context({tags: ["billing"]}).';
          }
          return [heading, ...focusReportLines(report)].join('\n');
        } finally {
          store.close();
        }
      };

      if (!asked) {
        const state = readFocus(root);
        if (state.error !== null) {
          throw new Error(
            `my_context: \`.my_context/state/focus.json\` ${state.error}, so NO focus is in ` +
            'effect and nothing is hidden. Ask the user to fix the file or to run ' +
            '`mycontext focus --clear`.',
          );
        }
        return describe(state.focus, 'my_context: the focus now in effect.');
      }

      if (optBool(args, 'preview') === true) {
        return describe(
          { ...axes, setAt: new Date().toISOString(), setBy: 'agent' },
          'my_context: preview only — nothing was changed.',
        );
      }

      const { focus, audit } = setFocus(root, axes, 'agent');
      return describe(
        focus,
        'my_context: focus set. Every future injection narrows to it and says so, and ' +
        `severity:hard items stay visible regardless.${auditFailureNote(audit)}`,
      );
    },
  },
  {
    name: 'ingest_document',
    schema: INGEST_DOCUMENT_SCHEMA,
    // No `origin` argument, here or in the schema: applyCandidates writes as
    // 'ingest' and asserts the result is a draft. See create_item's note above.
    run: (cwd, args) => withWorkspace(cwd, (ctx) => runIngestDocument(ctx, args)),
  },
  {
    /**
     * **`mycontext decay`, mirrored — items not injected in the last window
     * of sessions.**
     *
     * `CLI_WITHOUT_TOOL.decay` (plugin/parity.ts) recorded this as `owed`:
     * read-only, no mutation, no origin check anywhere on its path. This
     * tool calls `computeDecay` (core/decay.ts) directly — the same
     * function `cmdDecay` composes — so a tool and the CLI can never
     * quietly disagree about what is cold.
     *
     * No `limit` argument: the CLI itself never caps this list (only its
     * detail level changes how many COLUMNS a row carries, never how many
     * rows), and a tool that added a cap the command it mirrors does not
     * have would be exactly the silent limit the design record warns
     * against on `ready`. This report's rows are bounded by the corpus's own
     * normative-and-active count, which is small on every project measured
     * so far.
     */
    name: 'decay_report',
    schema: object({
      sessions: {
        type: 'number',
        description:
          'How many of the most recent sessions define the window. Default 20 — the same ' +
          'default `mycontext decay` uses.',
      },
      all: {
        type: 'boolean',
        description:
          'Include warm items (injected inside the window) in the answer. Cold and ' +
          'unrestricted items are always included; only the warm list is gated by this.',
      },
    }),
    run: (cwd, args) => {
      const ws = resolveWorkspace(cwd);
      if (!ws.projectRoot) {
        throw new Error(
          `my_context: there is no .my_context workspace at or above ${cwd}. ` +
          `Ask the user to run \`mycontext init\`.`,
        );
      }
      const projectRoot = ws.projectRoot;
      const { store, errors } = openRebuiltStore(ws, { retryOnBusy: true });
      let items: Item[];
      try { items = store.all(); } finally { store.close(); }

      const rawSessions = args.sessions;
      if (rawSessions !== undefined && rawSessions !== null) {
        if (typeof rawSessions !== 'number' || !Number.isInteger(rawSessions) || rawSessions <= 0) {
          throw new Error(
            `my_context: "sessions" must be a positive whole number. You passed ` +
            `${JSON.stringify(rawSessions)}.`,
          );
        }
      }
      const window = (rawSessions as number | undefined) ?? 20;
      const includeWarm = optBool(args, 'all') ?? false;

      const ledger = readLedgerView(projectRoot, ws.dbPath, window);
      const report = computeDecay({
        items, config: ws.config, usage: ledger.usage, recentlyUsed: ledger.recentlyUsed,
        window, sessionsRecorded: ledger.sessionsRecorded,
      });

      if (report.cold.length === 0 && report.warm.length === 0) {
        return 'my_context: nothing to report — no active normative items in this project yet.'
          + loadErrorNote(errors);
      }

      const lines: string[] = [
        `my_context decay — items not injected in the last ${report.window} session(s). ` +
        `The ledger holds ${report.sessionsRecorded} session(s).`,
        DECAY_COLD_CAVEAT,
        'Do not supersede or deprecate anything on this report alone — verify real usage first.',
      ];
      if (report.sessionsRecorded === 0) {
        lines.push(
          '(no sessions recorded yet — nothing here has been measured; "cold" currently ' +
          'means only "never injected")',
        );
      } else if (report.sessionsRecorded < report.window) {
        lines.push(`(only ${report.sessionsRecorded} session(s) recorded so far, so "cold" mostly means "new")`);
      }

      lines.push('');
      if (report.cold.length === 0) {
        lines.push(report.warm.length > 0
          ? 'cold: none — every active normative item was injected inside the window.'
          : 'cold: none — no active, normative item exists yet to measure.');
      } else {
        lines.push(`cold (${report.cold.length}) — not auto-injected in the window; check before acting:`);
        for (const row of report.cold) lines.push(decayLine(row));
      }

      if (report.unrestricted.length) {
        lines.push(
          '',
          `unrestricted (${report.unrestricted.length}) — active and normative with no scope, ` +
          'so they apply to every file and compete for the jit budget on every file operation. ' +
          'Each is also counted as cold or warm above — this is a view over those rows, not a ' +
          'fourth bucket.',
        );
        for (const row of report.unrestricted) lines.push(decayLine(row));
      }

      if (includeWarm && report.warm.length) {
        lines.push('', `warm (${report.warm.length}) — injected inside the window:`);
        for (const row of report.warm) lines.push(decayLine(row));
      }

      return lines.join('\n') + loadErrorNote(errors);
    },
  },
  {
    /**
     * **`mycontext ingest-status`, mirrored — every ingest session and its
     * per-anchor progress.**
     *
     * `CLI_WITHOUT_TOOL['ingest-status']` recorded this as `owed`: read-only
     * over `listSessions`/`pendingAnchors` (ingest/session.ts), no mutation,
     * no origin check. Those two functions — and `rejectionsForAnchor`,
     * which this tool also calls — live under `src/ingest/`, not
     * `src/cli/commands/`, so they carry none of that directory's
     * module-scope hazard.
     *
     * Always the full per-anchor detail: unlike a terminal, a tool response
     * has no column width to protect, and there is no reason to hide a
     * session's rejections behind a `--full` a model would have no way to
     * discover.
     */
    name: 'list_ingest_sessions',
    schema: object({}),
    run: (cwd) => {
      const ws = resolveWorkspace(cwd);
      if (!ws.projectRoot) {
        throw new Error(
          `my_context: there is no .my_context workspace at or above ${cwd}. ` +
          `Ask the user to run \`mycontext init\`.`,
        );
      }
      const sessions = listSessions(ws.projectRoot);
      if (sessions.length === 0) {
        return 'my_context: no ingest sessions. Start one with ingest_document.';
      }

      const unfinished = sessions.filter((s) => pendingAnchors(s).length > 0).length;
      const rejectedTotal = sessions.reduce((n, s) => n + s.rejected.length, 0);
      const lines: string[] = [
        `my_context: ${sessions.length} ingest session(s), ${unfinished} unfinished.` +
        (rejectedTotal ? ` ${rejectedTotal} candidate(s) rejected.` : ''),
      ];

      for (const session of sessions) {
        const pending = pendingAnchors(session);
        lines.push(
          '',
          `${session.id}  ${session.sourceFile}  applied ` +
          `${session.chunks.length - pending.length}/${session.chunks.length}  ` +
          `rejected ${session.rejected.length}`,
        );
        for (const chunk of session.chunks) {
          lines.push(`  ${pending.includes(chunk.anchor) ? 'pending' : 'applied'}  ${chunk.anchor}`);
          for (const r of rejectionsForAnchor(session, chunk.anchor)) {
            const which = r.index >= 0 ? `candidate ${r.index}` : 'batch';
            lines.push(`    rejected  ${which}${r.title ? ` "${r.title}"` : ''}: ${r.message}`);
          }
        }
      }
      return lines.join('\n');
    },
  },
  {
    /**
     * **`mycontext lesson`, mirrored — record a lesson and request candidate
     * rules, always as an agent.**
     *
     * `CLI_WITHOUT_TOOL.lesson` (plugin/parity.ts) recorded this as `owed`:
     * nothing on `cmdLesson`'s path refuses a non-human caller, and
     * `--agent` (cli/commands/lesson.ts:122) already solves the trust
     * boundary honestly for the CLI case — the same reasoning `create_item`
     * already applies. A tool call is a non-human caller BY CONSTRUCTION, so
     * this tool never takes an `origin` argument (see `ARGUMENT_HINTS`
     * above, `'*.origin'`) and always stamps `origin: 'agent'` itself; there
     * is no flag-equivalent decision here, only the wiring.
     *
     * `subject` may already be an existing lesson's id — the same re-derive
     * path `cmdLesson` offers — so calling this twice with the same wording
     * re-derives the rule-derivation request rather than creating a
     * duplicate lesson. `lesson` is rationale tier, so the created item
     * lands `origin: agent, status: active` — honest and immediately
     * usable, with no trust boundary bypassed, because nothing on the
     * rationale tier is injected in the first place.
     */
    name: 'create_lesson',
    schema: object({
      subject: {
        ...S_STRING,
        description:
          'What was learned, in your own words — creates a new lesson — or an existing ' +
          'lesson\'s id, to re-derive its rule-derivation request without creating a duplicate.',
      },
    }, ['subject']),
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const subject = str(args, 'subject', 'create_lesson').trim();
      if (subject === '') throw new Error(missingFieldError('subject', 'create_lesson', 'capture'));

      let recorded = false;
      let lesson: Item | null = ctx.store.get(subject);
      if (lesson && lesson.type !== 'lesson') {
        throw new Error(
          `my_context: ${subject} is a ${lesson.type}, not a lesson. Rules are derived from lessons only.`,
        );
      }

      if (!lesson) {
        // Not an id — treat it as title text and dedupe on the id
        // `createItem` would allocate for it, exactly as `cmdLesson` does,
        // so calling this twice with the same wording re-derives instead
        // of creating a second lesson.
        const candidateId = makeId(ctx.config.categories.lesson.prefix, subject);
        const existing = ctx.store.get(candidateId);
        if (existing) {
          lesson = existing;
        } else {
          // WHO this write claims to be — always 'agent'. See the doc
          // comment above; never taken from the tool call.
          const created = createItem(ctx, {
            type: 'lesson', title: subject, status: 'active', origin: 'agent',
          });
          lesson = ctx.store.get(created.id) as Item;
          recorded = true;
        }
      }

      const lines = [
        recorded
          ? `my_context: lesson ${lesson.id} recorded as origin: ${lesson.origin} ` +
            `(rationale tier — indexed, never injected).`
          : `my_context: lesson ${lesson.id} already recorded — nothing was written by this call ` +
            `(rationale tier — indexed, never injected). Re-deriving rules from it:`,
        '',
        renderRuleRequest(buildRuleRequest(lesson, ctx.config)),
      ];
      return lines.join('\n');
    }),
  },
  {
    /**
     * **`mycontext lesson-stage`, mirrored — stage derived rule candidates
     * for a human to accept or discard.**
     *
     * `CLI_WITHOUT_TOOL['lesson-stage']` recorded this as `owed`:
     * `stageRuleCandidates` (lesson/derive.ts) writes ONLY to
     * `.staging/<lesson>.json` — its own doc comment: "this function never
     * calls createItem" — so nothing this tool does creates an item or
     * crosses a trust boundary. The candidates it stages are inert until a
     * HUMAN runs `mycontext lesson-accept`, which is the only call site of
     * `createItem` anywhere in this module and hardcodes `origin: 'human'`
     * with no override (see that function's own comment, and
     * `CLI_WITHOUT_TOOL['lesson-accept']`, which stays `intended` for
     * exactly that reason).
     */
    name: 'stage_rule_candidates',
    schema: object({
      lesson: { ...S_STRING, description: 'The LESSON item id these candidates were derived from' },
      candidates: {
        type: 'array',
        description:
          'Rule candidates to stage for approval. None of this becomes an item by itself — ' +
          '`mycontext lesson-accept <lesson> <key>` is the only route from a staged candidate ' +
          'to a real rule, and it is a human command.',
        items: object({
          title: { ...S_STRING, description: 'Max 200 characters. The rule\'s own directive' },
          directive: { ...S_STRING, enum: [...RULE_DIRECTIVES], description: 'Whether the rule prescribes or prohibits' },
          body: { ...S_STRING, description: 'Why it holds' },
          scope: { ...S_STRINGS, description: 'POSIX glob(s) the rule applies to. Omit for the whole repository' },
          severity: { ...S_STRING, enum: SEVERITIES, description: 'Defaults to "soft" when omitted' },
        }, ['title', 'directive', 'body']),
      },
    }, ['lesson', 'candidates']),
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const lessonId = str(args, 'lesson', 'stage_rule_candidates');
      const lesson = ctx.store.get(lessonId);
      if (!lesson) throw new Error(unknownIdError(lessonId, ctx.store.all().map((i) => i.id)));
      if (args.candidates === undefined) {
        throw new Error(
          'my_context: "candidates" is required. Pass [] if the lesson supports no general rule.',
        );
      }

      const { staging, issues, dropped } = stageRuleCandidates(ctx.root, lesson, args.candidates);
      const pending = staging.candidates.filter((c) => c.state === 'pending');

      const lines: string[] = [
        `my_context: ${pending.length} rule candidate(s) staged for ${lessonId}. None of them ` +
        'exists as an item yet.',
      ];
      for (const s of pending) lines.push(`  ${s.key} · ${s.candidate.directive} · ${s.candidate.title}`);

      if (dropped.length) {
        lines.push(
          '',
          `${dropped.length} previously pending candidate(s) dropped — this derivation did not ` +
          'produce them again:',
        );
        for (const s of dropped) lines.push(`  ${s.key} · ${s.candidate.directive} · ${s.candidate.title}`);
      }

      if (issues.length) {
        lines.push('', `${issues.length} candidate(s) rejected:`);
        for (const issue of issues) lines.push(`  [${issue.index}] ${issue.title ?? '(untitled)'}: ${issue.message}`);
      }

      lines.push(
        '',
        `Accept with: mycontext lesson-accept ${lessonId} <key> [--title "…"] [--scope "a/**,b/**"]`,
        `Discard with: mycontext lesson-discard ${lessonId} <key>`,
      );
      return lines.join('\n');
    }),
  },
  {
    /**
     * **`mycontext pack`, mirrored — but stopped where `CLI_WITHOUT_SLASH.pack`
     * already said a tool for this should stop.**
     *
     * That row calls a preview — the collision report, then the import
     * command printed for a person to run — "deliberate future work…the
     * shape `/mycontext:lesson-stage` already uses". `CLI_WITHOUT_TOOL.pack`
     * names the identical shape for a TOOL and stays `owed` rather than
     * `intended` because nothing forecloses it. This is that shape and
     * nothing more: `planImport` (pack/import.ts) is PURE — its own doc
     * comment says so — and this tool never calls `applyImport`, the one
     * function that writes. **A tool that can import is not what the design
     * record asked for**, so there is no `--yes`, no `--dry-run`, and no
     * path from this tool to a corpus mutation.
     *
     * With `path`, it reads and plans an import and prints the same
     * collision report `mycontext pack import` prints before its own first
     * confirmation, followed by the command for a HUMAN to run. Without
     * `path`, it lists the packs already imported here (`readImportRecords`,
     * pack/imported-audit.ts) — a plain read with no artefact to plan
     * against at all, the other half of what `mycontext pack` answers.
     */
    name: 'preview_pack_import',
    schema: object({
      path: {
        ...S_STRING,
        description:
          'A directory or .zip artefact to preview. Omit to list the packs already imported ' +
          'into this workspace instead.',
      },
      name: {
        ...S_STRING,
        description:
          'Override the name this workspace would file the pack under, when previewing. ' +
          'Defaults to the manifest\'s own name; required when the artefact is a full export, ' +
          'which carries none. Ignored when "path" is omitted.',
      },
    }),
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const source = optStr(args, 'path');
      if (source === undefined) {
        const records = readImportRecords(ctx.root);
        if (records.length === 0) {
          return 'my_context: no packs have been imported into this workspace. Pass "path" to ' +
            'preview one.';
        }
        const lines = [`my_context: ${records.length} pack(s) imported here.`];
        for (const r of records) {
          lines.push(
            `  ${r.pack} · v${r.version === '' ? '—' : r.version} · ${r.items.length} item(s) · ` +
            `imported ${r.importedAt} · from ${r.source}`,
          );
        }
        return lines.join('\n');
      }

      const origin = path.resolve(cwd, source);
      const artefact = readArtefact(origin);
      const plan = planImport(artefact, {
        existing: (id) => ctx.store.get(id),
        rawConfig: rawWorkspaceConfig(ctx.root),
        local: ctx.config,
      });

      const override = optStr(args, 'name');
      const name = override ?? plan.pack;
      if (name === null || name === '') {
        throw new Error(
          `my_context: ${JSON.stringify(source)} is a full export and carries no pack name, so ` +
          'there is nothing to file this preview under. Pass "name" to say what to call it. ' +
          'Nothing was imported — this tool only previews.',
        );
      }

      const report: CollisionReport = {
        pack: name,
        version: plan.version ?? '',
        kind: plan.kind,
        source: plan.source,
        format: plan.format,
        manifest: plan.manifest,
        buckets: plan.buckets,
        config: { merged: plan.config.merged, refused: [], untouched: plan.config.untouched },
        history: { records: plan.history.records.length, quarantined: plan.history.unknown.length },
        notCarried: plan.notCarried,
        refused: [],
        applied: false,
        overwriteApproved: false,
        overwritten: [],
        loadErrors: [],
      };

      return [
        ...renderCollisionReport(report),
        '',
        'Nothing was imported — this tool only previews. A person runs the import:',
        `  mycontext pack import ${source}${override ? ` --name ${JSON.stringify(override)}` : ''}`,
      ].join('\n');
    }),
  },
  {
    /**
     * **`mycontext status`, mirrored — the composed dashboard.**
     *
     * `CLI_WITHOUT_TOOL.status` recorded this as `owed`: `cmdStatus`
     * (cli/commands/status.ts) composes `runChecks`, `computeDecay`,
     * `listSessions`/`listStaging` and the review/revision queues, and none
     * of that composition writes or checks origin. This tool reaches every
     * one of those functions directly — never through `cli/commands/status.ts`
     * or `cli/commands/review.ts`, both of which call `registerCommand` at
     * module scope — so its numbers cannot drift from the CLI's own.
     */
    name: 'status_report',
    schema: object({}),
    run: (cwd) => {
      const ws = resolveWorkspace(cwd);
      if (!ws.projectRoot) {
        throw new Error(
          `my_context: there is no .my_context workspace at or above ${cwd}. ` +
          `Ask the user to run \`mycontext init\`.`,
        );
      }
      const projectRoot = ws.projectRoot;
      const { store, errors } = openRebuiltStore(ws, { retryOnBusy: true });
      let items: Item[];
      let queueCount: number;
      let alwaysInQueue: number;
      let revisions: PendingRevision[];
      try {
        items = store.all();
        const queue = reviewQueue(items, null);
        queueCount = queue.length;
        alwaysInQueue = queue.filter((i) => i.always).length;
        revisions = pendingRevisions({ root: projectRoot, store, config: ws.config });
      } finally {
        store.close();
      }

      const globalLayerDrafts = items.filter((i) => i.status === 'draft').length - queueCount;
      const sessions = listSessions(projectRoot).filter((s) => pendingAnchors(s).length > 0);
      const pendingRules = listStaging(projectRoot)
        .flatMap((s) => s.candidates.filter((c) => c.state === 'pending')
          .map((c) => ({ lesson: s.lessonId, candidate: c })));

      const window = 20;
      const ledger = readLedgerView(projectRoot, ws.dbPath, window);
      const decay = computeDecay({
        items, config: ws.config, usage: ledger.usage, recentlyUsed: ledger.recentlyUsed,
        window, sessionsRecorded: ledger.sessionsRecorded,
      });

      const findings = runChecks({
        root: projectRoot, repoRoot: path.dirname(projectRoot), dbPath: ws.dbPath, items, config: ws.config,
      });
      const real = findings.filter((f) => !isDoctorDisclosure(f));
      const health = {
        errors: real.filter((f) => f.level === 'error').length,
        warnings: real.filter((f) => f.level === 'warn').length,
        infos: real.filter((f) => f.level === 'info').length,
      };

      const lines: string[] = [`my_context ${VERSION}: ${items.length} item(s), profile "${ws.config.profile}"`];

      const skipped = skippedKeyNotice(ws.config);
      if (skipped !== '') lines.push('', skipped);

      lines.push('', `review queue: ${queueCount} draft(s) pending review.`);
      if (globalLayerDrafts > 0) {
        lines.push(
          `  ${globalLayerDrafts} further draft(s) are in the global layer and are NOT in this ` +
          'queue — they cannot be promoted or discarded from this project.',
        );
      }
      if (alwaysInQueue > 0) {
        lines.push(
          `  ${alwaysInQueue} of them carry \`always: true\` — promoting one pins it into ` +
          'every session start, in full, regardless of scope.',
        );
      }

      if (revisions.length > 0) lines.push('', pendingRevisionLine(revisions));

      if (sessions.length) {
        lines.push('', `ingest: ${sessions.length} unfinished session(s).`);
      }

      if (pendingRules.length) {
        lines.push(
          '',
          `${pendingRules.length} rule candidate(s) awaiting approval. Nothing generated is ` +
          'active until a human accepts it.',
        );
      }

      lines.push(
        '',
        ledger.sessionsRecorded === 0
          ? 'usage: no sessions recorded yet — decay reporting starts once items begin to be injected.'
          : `usage: ${ledger.sessionsRecorded} session(s) recorded. ${decay.cold.length} normative ` +
            `item(s) not injected in the last ${window} session(s) — not evidence they are unused, ` +
            'only that they were not selected. See decay_report.',
      );
      if (decay.unrestricted.length) {
        lines.push(
          `  ${decay.unrestricted.length} active normative item(s) carry no scope, so they apply ` +
          'to every file and compete for the jit budget on every file operation.',
        );
      }

      lines.push(
        '',
        `health: ${health.errors} error(s), ${health.warnings} warning(s), ${health.infos} note(s) ` +
        '— see the doctor tool for details.',
      );

      if (errors.length > 0) {
        lines.push('', `${errors.length} corpus load error(s):`);
        for (const e of errors) lines.push(`  ${e.file}: ${e.message}`);
      }

      return lines.join('\n');
    },
  },
  {
    /**
     * **`mycontext todo`, mirrored — the inbox.**
     *
     * `CLI_WITHOUT_TOOL.todo` recorded this as `owed`: `filterItems`
     * (core/search.ts) over todos, with no mutation and no origin check.
     * `cmdTodo` itself is in `cli/commands/todo.ts`, which this tool never
     * imports — every function this tool calls lives under `core/`.
     */
    name: 'list_todos',
    schema: object({
      tag: { ...S_STRING, description: 'Only todos carrying this tag' },
      all: {
        type: 'boolean',
        description:
          'Include retired (superseded/deprecated/validated) todos too. Always counted; only ' +
          'the listing changes.',
      },
      limit: {
        type: 'number',
        description:
          'Cap on rows returned. Default 50 — the same cap `mycontext todo` applies to its own ' +
          'table, made explicit here rather than left silent.',
      },
    }),
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const tag = optStr(args, 'tag');
      const all = optBool(args, 'all') ?? false;
      const limit = optNum(args, 'limit', 50);

      const category = Object.hasOwn(ctx.config.categories, 'todo') ? ctx.config.categories.todo : null;
      const tier = category?.tier ?? 'normative';

      const matched = filterItems(ctx.store.all(), { type: 'todo', tag }, ctx.config);
      const retired = matched.filter((i) => RETIRED_STATUSES.has(i.status));
      const kept = all ? matched : matched.filter((i) => !RETIRED_STATUSES.has(i.status));
      const shown = kept.slice(0, limit);

      const lines: string[] = [];
      if (shown.length === 0) {
        lines.push(tag === undefined ? 'my_context: no todo items.' : `my_context: no todo items tagged "${tag}".`);
      } else {
        lines.push(
          `my_context: ${kept.length} todo item(s)` +
          (kept.length > shown.length ? `, ${shown.length} shown. Raise "limit" or narrow "tag".` : '.'),
        );
        for (const item of shown) {
          lines.push(`${item.id} · ${item.status} · ${item.tags.length ? item.tags.join(', ') : '(none)'} · ${item.title}`);
        }
      }

      if (!all && retired.length > 0) {
        lines.push(
          '',
          `${retired.length} retired (superseded/deprecated/validated) and not shown — pass ` +
          '"all": true to include them.',
        );
      }

      lines.push(
        '',
        tier === 'rationale'
          ? '`todo` is on the rationale tier: a todo is never injected into a session in full, ' +
            'and nothing forces it to `draft`, so it does not enter the review queue.'
          : '`todo` has been retiered to the normative tier in this project\'s config: an active ' +
            'todo IS injected in full, and an agent-authored one lands `draft` for human review, ' +
            'so it also appears in the review queue.',
      );

      return lines.join('\n');
    }),
  },
  {
    /**
     * **`mycontext procedure`, mirrored — but only its read half.**
     *
     * `CLI_WITHOUT_TOOL.procedure` (plugin/parity.ts) recorded this as
     * `owed`: a mixed command, where `list`/`show`/`step` are plain reads
     * over the CORPUS AS MARKDOWN (`corpus`, cli/commands/procedure.ts — the
     * same `rebuildRoots`/`loadLayer`/`mergeLayers` triple `buildInjection`
     * uses) with no mutation and no origin check, but `activate` and `done`
     * hardcode `origin: 'human'` on their `updateItem` calls
     * (procedure.ts:294, :337) and must stay a human-only act — the same
     * reasoning that gives `review` a read tool (`list_drafts`) with no
     * tool for `review promote`. This tool's `action` enum names exactly
     * `list`/`show`/`step`; there is no value that reaches `activate` or
     * `done`, and none is ever added.
     *
     * `step` DOES write — one record appended to the audit log — but not to
     * the item, and progress governs nothing: `commands/procedure.md`
     * already tells an agent at a shell it may run this one for exactly
     * that reason, and this tool draws the same line rather than a
     * stricter one. Its `origin: 'human'` (procedure.ts:387) is unchanged;
     * see that file's own note on the bargain this makes — it is
     * indistinguishable from a human's own tick, and that is acceptable
     * specifically because a tick changes what is injected, what governs,
     * or what any other session is shown, precisely nothing.
     *
     * Reads the Markdown directly, through `resolveWorkspace` +
     * `rebuildRoots`/`loadLayer`/`mergeLayers`, never `withWorkspace` (which
     * calls `openRebuiltStore` first): the whole point of leaving
     * `list`/`show`/`step` off the SQLite rebuild is that `step` takes no
     * write lock, and routing this tool through the SQLite path would
     * reintroduce exactly the lock this design avoids.
     */
    name: 'read_procedure',
    schema: object({
      action: {
        type: 'string',
        enum: ['list', 'show', 'step'],
        description:
          'Default "list" — every procedure grouped by stage. "show" and "step" need "id"; ' +
          '"step" also needs "step". There is no "activate" or "done" here — those stay a ' +
          'human act; see mycontext_help("workflow").',
      },
      id: { ...S_STRING, description: 'A procedure item id. Needed by "show" and "step"' },
      step: {
        type: 'number',
        description: 'The step number to tick or un-tick, 1-based. Needed by "step" only',
      },
      undo: {
        type: 'boolean',
        description: 'Un-tick the step instead of ticking it. Only means something with "step"',
      },
    }),
    run: (cwd, args) => {
      const ws = resolveWorkspace(cwd);
      if (!ws.projectRoot) {
        throw new Error(
          `my_context: there is no .my_context workspace at or above ${cwd}. ` +
          `Ask the user to run \`mycontext init\`.`,
        );
      }
      const root = ws.projectRoot;
      const action = optEnum<'list' | 'show' | 'step'>(
        args, 'action', ['list', 'show', 'step'], 'workflow',
      ) ?? 'list';

      const roots = rebuildRoots(ws);
      const errors: LoadError[] = [];
      const layered: Item[] = [];
      if (roots.global) layered.push(...loadLayer(roots.global, 'global', errors, ws.config));
      layered.push(...loadLayer(root, 'project', errors, ws.config));
      const items = mergeLayers(layered);
      const records = readAudit(root);

      const categoryRefusal = (item: Item): string => {
        const first =
          `my_context: ${item.id} is a ${item.type}, not a procedure. ` +
          `read_procedure acts on procedure items only — get_item(${JSON.stringify(item.id)}) reads this one.`;
        if (item.type !== 'runbook') return first;
        return `${first}\n` +
          'A "runbook" is repeatable: it is performed again every time the named operation ' +
          'comes up, so it has no lifecycle to read progress against. A "procedure" is done ' +
          'once and then finished, which is why it is the one that carries this lifecycle. ' +
          'This is a category error, not a feature that is coming.';
      };

      if (action === 'list') {
        const procedures = items
          .filter((i) => i.type === 'procedure')
          .sort((a, b) => a.id.localeCompare(b.id));
        if (procedures.length === 0) {
          return 'my_context: 0 procedure(s). Capture one with create_item ' +
            '(type: "procedure", steps: [...]).' + loadErrorNote(errors);
        }
        const byStage = new Map<Stage, Item[]>();
        for (const item of procedures) {
          const stage = stageOf(item);
          byStage.set(stage, [...(byStage.get(stage) ?? []), item]);
        }
        const lines: string[] = [];
        for (const stage of STAGES) {
          const rows = byStage.get(stage);
          if (!rows) continue;
          lines.push(`${stage}:`);
          for (const item of rows) {
            const done = procedureProgress(records, item.id);
            lines.push(`  ${item.id} · ${stage} · ${progressLine(done, item.steps.length)} · ${item.title}`);
          }
          lines.push('');
        }
        lines.push('note: progress is recorded per workspace, not per session — two callers on this workspace share one record set.');
        return lines.join('\n') + loadErrorNote(errors);
      }

      if (args.id === undefined || args.id === null) {
        throw new Error(missingFieldError('id', 'read_procedure', 'workflow'));
      }
      const id = optStr(args, 'id') as string;
      const item = items.find((i) => i.id === id);
      if (!item) throw new Error(unknownIdError(id, items.map((i) => i.id)));
      if (item.type !== 'procedure') throw new Error(categoryRefusal(item));

      if (action === 'show') {
        const done = procedureProgress(records, item.id);
        const unreadable = unreadableProgress(records, item.id);
        const overlaid: Item = {
          ...item,
          steps: item.steps.map((s, i) => ({ ...s, checked: done.has(i + 1) })),
        };
        const lines = [
          renderItem(overlaid),
          '',
          `progress: ${progressLine(done, item.steps.length)}`,
          'note: every ticked box above is rendered from the audit log, not stored — the ' +
          'Markdown on disk still reads "- [ ]" on every step, and mycontext doctor stays ' +
          'quiet while a procedure is being worked through.',
        ];
        if (unreadable > 0) {
          lines.push(
            `note: ${unreadable} progress record(s) in this run could not be read by this ` +
            'build and are counted in neither direction.',
          );
        }
        return lines.join('\n') + loadErrorNote(errors);
      }

      // action === 'step'
      if (item.status !== 'active') {
        throw new Error(
          `my_context: ${item.id} is "${item.status}", not "active", so there is no run to ` +
          `record a step against. A human starts it with \`mycontext procedure activate ${item.id}\`.`,
        );
      }
      if (args.step === undefined || args.step === null) {
        throw new Error(missingFieldError('step', 'read_procedure', 'workflow'));
      }
      const n = optNum(args, 'step', 1);
      const total = item.steps.length;
      if (!Number.isSafeInteger(n) || n < 1 || n > total) {
        throw new Error(total === 0
          ? `my_context: ${item.id} declares 0 steps, so there is nothing to tick.`
          : `my_context: ${n} is not one of this procedure's steps. ${item.id} has ${total} ` +
            `step(s), numbered 1 to ${total}.`);
      }
      const undo = optBool(args, 'undo') ?? false;
      // The op and its kind are DERIVED from `core/audit.ts`'s own vocabulary
      // (`PROGRESS_OPS` names the two step ops; `kindOf` classifies either)
      // rather than spelled out here — see
      // `test/core/audit-surfaces-derive.test.ts`'s "neither surface names
      // the new kind or its ops anywhere in its source".
      const op = undo ? PROGRESS_OPS[1] : PROGRESS_OPS[0];
      const kind = kindOf(op);
      const written = recordAudit(root, {
        kind, op, itemId: item.id, origin: 'human', note: `step ${n}`,
      });
      if (!written.written) {
        throw new Error(
          `my_context: the progress record could not be written (${written.error}), so nothing ` +
          'was recorded. The item is untouched either way — progress never enters items/.',
        );
      }
      const after = procedureProgress([...records, {
        protocol: '', at: '', kind, op, itemId: item.id, note: `step ${n}`,
      }], item.id);
      return `my_context: step ${n} ${undo ? 'un-ticked' : 'ticked'} — ${progressLine(after, total)}. ` +
        'The item file is unchanged; this is one record in the audit log.';
    },
  },
  /**
   * **`ask_handover` — the third entry point onto one implementation.**
   *
   * Owner ruling 2026-09-06, in as many words: *a cli command, a slash command
   * and a MCP tool, all should trigger handover update on demand*. Every
   * decision this makes is `core/handover-ask.ts`'s `askHandoverNow` —
   * `cli/commands/handover.ts` calls the identical function and renders the
   * identical fields. Nothing about session identity, occupancy or any refusal
   * is decided here, and that is the ruling's own requirement: the three
   * surfaces are entry points, not implementations.
   *
   * **It takes no session argument, and that is the owner's second ruling of
   * the same day**: the ask may only be made from inside a Claude Code session,
   * so there is no id to pass and no hatch to pass it through. This server is
   * inside one by construction — Claude Code launches a stdio MCP server with
   * `CLAUDE_CODE_SESSION_ID` in its environment (measured on 2.1.260, in the
   * binary's own launch path) — so the ordinary case needs nothing.
   *
   * **The one case that is not ordinary, stated rather than papered over:** a
   * long-lived server outlives a `/clear`, and Claude Code re-stamps the
   * variable in its OWN process rather than in an already-running child, so
   * this server can hold the id of a conversation that has ended. Nothing
   * special-cases it because nothing has to — an ended session has no current
   * context sample, so the ask is refused for want of an occupancy rather than
   * stamped against a dead latch. The recovery is the CLI, run by the assistant
   * in a shell that was started after the reset.
   */
  {
    name: 'ask_handover',
    schema: object({
      anyway: {
        type: 'boolean',
        description:
          'Ask even though this session has lanes still running, or even though whether it ' +
          'has could not be read. Only pass it when the USER has said to: the disclosure ' +
          'names what is running so they can choose between waiting and proceeding.',
      },
    }),
    run: (cwd, args) => {
      const ws = resolveWorkspace(cwd);
      if (!ws.projectRoot) {
        throw new Error(
          `my_context: there is no .my_context workspace at or above ${cwd}. ` +
          'Ask the user to run `mycontext init`.',
        );
      }
      const result = askHandoverNow(ws.projectRoot, { anyway: optBool(args, 'anyway') ?? false });

      if (result.verdict === 'asked') {
        // The paragraph FIRST, because it is an instruction and the rest is
        // provenance. `checkHandoverAsk` decides later whether it was acted on,
        // by the same mtime comparison every other ask is judged by.
        return `${result.ask}\n\nmy_context: ${result.note}. Recorded against session ` +
          `${result.sessionId}.`;
      }
      if (result.verdict === 'work-in-flight') {
        const lanes = result.running.map((lane) =>
          `  - ${lane.agentId}${lane.type === null ? '' : ` [${lane.type}]`}: ` +
          `${lane.what ?? '(no description on the dispatch row)'} — dispatched ` +
          `${lane.dispatchedAt}, last step ${lane.lastStepAt ?? '—'}`).join('\n');
        return `my_context: ${result.note}.\n${lanes}\n\n` +
          'Tell the user what is running and let THEM choose: wait for those lanes to ' +
          'finish, stop them in Claude Code (my_context has no control that ends a lane), ' +
          'or say to proceed — in which case call this again with anyway: true. Do not ' +
          'choose for them, and do not ask again without their answer.';
      }
      if (result.verdict === 'outside-session') {
        // Reachable from a server Claude Code did not start — a hand-run one,
        // or a test harness. Say what it means rather than inviting a retry:
        // there is no argument that would change the answer.
        return `my_context: ${result.note}. This server was started without a Claude Code ` +
          'session id in its environment, so there is no session to ask. Nothing you can pass ' +
          'to this tool changes that.';
      }
      return `my_context: ${result.note}.`;
    },
  },
];

/** Sorted so tools/list is byte-stable across calls, which prompt caching needs. */
const SORTED = [...SPECS].sort((a, b) => a.name.localeCompare(b.name));

export const TOOL_NAMES = SORTED.map((spec) => spec.name);

/**
 * `code` is the identity `src/mcp/server.ts` stamped at startup, or `null`.
 *
 * A PARAMETER rather than a module-level singleton stamped on import, for the
 * reason `stampCodeIdentity` is called per server in the UI: `startedAt` must
 * be the moment a reader can line up with the line their terminal printed, and
 * a module-level stamp would date every registry in a process to whenever the
 * first `import` happened. It also keeps the derivation honest — the entry is
 * `server.ts`'s own `import.meta.filename`, so no path to this server is
 * spelled anywhere.
 *
 * `null` is the default because most callers are not the long-lived process:
 * every test builds a registry, and none of them is stale by construction. See
 * `staleCodeNote` for why silence is the right answer there.
 */
export function createRegistry(cwd: string, code: CodeIdentity | null = null): ToolRegistry {
  const descriptions = toolDescriptions();

  const definitions: ToolDefinition[] = SORTED.map((spec) => {
    const description = descriptions[spec.name];
    if (!description) {
      throw new Error(
        `my_context: tool "${spec.name}" has no description in ` +
        `src/help/topics/capture.md. Tool descriptions have exactly one source.`,
      );
    }
    // `additionalProperties: false` is added here rather than inside each
    // schema literal because `object()` builds nested schemas too — the
    // observations entries — and those legitimately accept `tags`/`context`
    // beyond the two fields they spell out, so a blanket closure would
    // advertise a rule the server does not enforce. This closes the TOP level
    // only, which is exactly what `refuseUnknownArgs` enforces on the way in.
    return {
      name: spec.name,
      description,
      inputSchema: { ...spec.schema, additionalProperties: false },
    };
  });

  const byName = new Map(SORTED.map((spec) => [spec.name, spec]));

  return {
    list: () => definitions,
    call: (name, args) => {
      const spec = byName.get(name);
      if (!spec) throw new Error(enumError('tool', name, TOOL_NAMES, 'capture'));
      // Before the handler, never after: a refusal has to happen while
      // nothing has been written.
      refuseUnknownArgs(spec, args);
      const result = spec.run(cwd, args);
      // **Every result names the code and the corpus it came from.** Here,
      // once, at the one boundary every tool call crosses — the same argument
      // `refuseUnknownArgs` makes directly above: a per-tool footer is a list
      // fourteen handlers have to remember, and the fifteenth ships without
      // one. `provenance.ts` carries the reasoning; it never throws and it is
      // one short line unless something is actually wrong.
      const provenance = toolResultProvenance(cwd, code);
      return provenance === '' ? result : `${result}\n\n${provenance}`;
    },
  };
}
