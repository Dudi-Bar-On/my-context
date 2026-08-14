import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Config } from '../core/config.ts';
import { createItem, type MutationContext } from '../core/mutate.ts';
import { checksum, makeId } from '../core/slug.ts';
import type { Item } from '../core/types.ts';
import type { ValidationIssue } from '../ingest/schema.ts';

export const RULE_REQUEST_PROTOCOL = 'my_context/rule-derivation-request@1';
export const STAGING_PROTOCOL = 'my_context/lesson-staging@1';

export interface RuleCandidate {
  title: string;
  directive: 'do' | 'dont';
  body: string;
  scope: string[];
  severity: 'hard' | 'soft';
}

export interface StagedRule {
  /** Stable handle used by `mycontext lesson-accept`. */
  key: string;
  candidate: RuleCandidate;
  state: 'pending' | 'accepted' | 'discarded';
  ruleId: string | null;
}

export interface LessonStaging {
  protocol: string;
  lessonId: string;
  createdAt: string;
  candidates: StagedRule[];
}

export function stagingDir(root: string): string {
  return path.join(root, '.staging');
}

/**
 * A lesson id becomes both a JSON filename (`stagingFile`, below) and a
 * relation target written into a rule's frontmatter (`acceptStagedRule`).
 * Task 9 takes this id from argv, so an id containing a path separator
 * (`/` or `\`) would let `stagingFile` read or write outside `.staging/` —
 * the same class of hazard `validateRelationTarget` (mutate.ts) guards for
 * relation targets in general, checked here at the one place this module
 * turns an id into a filesystem path. Note: this pattern allows `.` and
 * therefore allows a lone `..` segment — harmless here only because there is
 * no path separator alongside it for `..` to act on (`stagingFile` always
 * appends it as one whole `${lessonId}.json` filename component, never a
 * directory segment), not because the pattern itself excludes it.
 */
const LESSON_ID_RE = /^[A-Za-z0-9._-]+$/;

function stagingFile(root: string, lessonId: string): string {
  if (!LESSON_ID_RE.test(lessonId)) {
    throw new Error(
      `my_context: "${lessonId}" is not a valid lesson id — only letters, digits, ".", "_" and ` +
      `"-" are allowed, so it cannot safely be used as a staging file name.`,
    );
  }
  return path.join(stagingDir(root), `${lessonId}.json`);
}

function ensureDir(root: string): string {
  const dir = stagingDir(root);
  mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n', 'utf8');
  return dir;
}

export function saveStaging(root: string, staging: LessonStaging): string {
  ensureDir(root);
  const target = stagingFile(root, staging.lessonId);
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, JSON.stringify(staging, null, 2) + '\n', 'utf8');
    renameSync(tmp, target);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return target;
}

export function loadStaging(root: string, lessonId: string): LessonStaging | null {
  const file = stagingFile(root, lessonId);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as LessonStaging;
  } catch {
    return null;
  }
}

/**
 * The internal loader `acceptStagedRule`/`discardStagedRule` use — never a
 * caller-supplied `LessonStaging` value (see those functions' doc comments
 * for why that distinction is load-bearing). Refuses a missing file, a file
 * that fails to parse as JSON, a wrong/garbled `protocol`, and a file whose
 * OWN `lessonId` field disagrees with the `lessonId` this function was asked
 * to load (see the identity check below for why that last one matters). It
 * does NOT — and cannot — verify that the candidates inside a file that
 * passes all of that actually came from a model's response to this lesson:
 * a hand-written `.staging/<realLessonId>.json` with the right protocol and
 * a matching `lessonId` is indistinguishable from a real one and is
 * accepted. The staging directory is unauthenticated working state; this
 * function only checks the SHAPE the rest of this module depends on, not
 * the provenance of what is inside it.
 */
function loadOrThrowStaging(root: string, lessonId: string): LessonStaging {
  const file = stagingFile(root, lessonId);
  if (!existsSync(file)) {
    throw new Error(
      `my_context: no staged rule candidates found for ${lessonId}. Run ` +
      `\`mycontext lesson ${lessonId}\` to derive candidates first.`,
    );
  }

  let staging: LessonStaging;
  try {
    staging = JSON.parse(readFileSync(file, 'utf8')) as LessonStaging;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `my_context: the staging file for ${lessonId} is not valid JSON (${message}) and could not ` +
      `be read. It may be corrupt — re-run \`mycontext lesson ${lessonId}\` to regenerate it.`,
    );
  }

  if (staging.protocol !== STAGING_PROTOCOL) {
    throw new Error(
      `my_context: the staging file for ${lessonId} has protocol ${JSON.stringify(staging.protocol)}, ` +
      `expected ${JSON.stringify(STAGING_PROTOCOL)}. It may be corrupt or from an incompatible version — ` +
      `re-run \`mycontext lesson ${lessonId}\` to regenerate it.`,
    );
  }

  // `saveStaging` derives the FILENAME from `staging.lessonId`, and every
  // legitimate write path (`stageRuleCandidates`) sets that field to the
  // same lesson it was called with — so on a normal, untampered file the two
  // always agree. They can disagree only if something wrote (or rewrote) the
  // file directly rather than through this module's own save path: a file
  // literally named `<lessonId>.json` whose CONTENTS name a different
  // lesson. Without this check, `acceptStagedRule` below would create the
  // rule and write its `derived_from` relation using whichever lesson id it
  // trusted, while persisting the resulting `accepted` state to a FILE NAMED
  // AFTER THE OTHER ONE (`saveStaging` uses `staging.lessonId` for the
  // filename) — leaving the file this function was asked to load still
  // `pending`, so a second accept against the same key would silently
  // succeed again.
  if (staging.lessonId !== lessonId) {
    throw new Error(
      `my_context: the staging file for "${lessonId}" names a different lesson internally ` +
      `(${JSON.stringify(staging.lessonId)}) than its filename (${JSON.stringify(lessonId)}). Refusing to ` +
      `trust it — this file may have been copied from another lesson's staging or edited by hand. ` +
      `Re-run \`mycontext lesson ${lessonId}\` to regenerate it.`,
    );
  }

  return staging;
}

export function listStaging(root: string): LessonStaging[] {
  let names: string[];
  try {
    names = readdirSync(stagingDir(root)).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }

  const out: LessonStaging[] = [];
  for (const name of names) {
    try {
      const parsed = JSON.parse(readFileSync(path.join(stagingDir(root), name), 'utf8')) as LessonStaging;
      if (parsed.protocol === STAGING_PROTOCOL) out.push(parsed);
    } catch {
      // Working state, not knowledge. Skip.
    }
  }
  return out.sort((a, b) => a.lessonId.localeCompare(b.lessonId));
}

export const RULE_CANDIDATE_SCHEMA: Record<string, unknown> = {
  type: 'array',
  items: {
    type: 'object',
    required: ['title', 'directive', 'body'],
    additionalProperties: false,
    properties: {
      title: { type: 'string', maxLength: 200, description: 'The directive itself, phrased as an instruction: "Run migrations outside peak hours".' },
      directive: { enum: ['do', 'dont'], description: '"do" prescribes; "dont" prohibits.' },
      body: { type: 'string', description: 'Why. Cite the mechanism from the lesson, not the incident narrative.' },
      scope: { type: 'array', items: { type: 'string' }, description: 'POSIX globs this governs. Omit rather than guessing; a bare "**" is rejected.' },
      severity: { enum: ['hard', 'soft'] },
    },
  },
};

export function buildRuleRequest(lesson: Item, config: Config): Record<string, unknown> {
  return {
    protocol: RULE_REQUEST_PROTOCOL,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    lessonBody: lesson.body,
    lessonObservations: lesson.observations.map((o) => `[${o.category}] ${o.text}`),
    ruleCategoryEnabled: config.categories.rule?.enabled ?? false,
    schema: RULE_CANDIDATE_SCHEMA,
    callback: {
      cli: `mycontext lesson-stage ${lesson.id} --stdin`,
    },
    instructions: [
      'You are deriving rules. my_context has no model of its own — it stages what you return and waits for a human.',
      'A lesson is descriptive ("this is what happened"); a rule is normative ("this is what must happen from now on"). Convert, do not restate.',
      'Emit a JSON array of rule candidates matching the schema. Two or three is usually right; return [] if the lesson supports no general rule.',
      'Each rule must be actionable by someone who was not present for the incident. Drop the dates, names and ticket numbers.',
      'Do not invent scope. If you cannot name the directories a rule governs, omit "scope" — an unscoped rule is still indexed and can be scoped during review.',
      'NOTHING you return is applied. Every candidate is staged pending explicit human approval, because a subtly wrong invariant would be injected into every future session indefinitely.',
      `Call back with: mycontext lesson-stage ${lesson.id} --stdin`,
    ],
  };
}

export function renderRuleRequest(request: Record<string, unknown>): string {
  const lines = [
    `my_context RULE DERIVATION REQUEST — ${String(request.lessonId)}`,
    '',
    ...(request.instructions as string[]).map((line) => `- ${line}`),
    '',
    '```json',
    JSON.stringify(request, null, 2),
    '```',
  ];
  return lines.join('\n').replace(/\r/g, '') + '\n';
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateRuleCandidates(raw: unknown): { valid: RuleCandidate[]; issues: ValidationIssue[] } {
  const valid: RuleCandidate[] = [];
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(raw)) {
    issues.push({
      index: -1, title: null,
      message: `expected a JSON array of rule candidates, got ${raw === null ? 'null' : typeof raw}. Return [] if the lesson supports no general rule.`,
    });
    return { valid, issues };
  }

  raw.forEach((entry, index) => {
    const title = isObject(entry) && typeof entry.title === 'string' ? entry.title.trim() : null;
    const reject = (message: string): void => { issues.push({ index, title, message }); };

    if (!isObject(entry)) return reject('entry is not an object');
    if (!title) return reject('"title" is required and is the directive itself.');
    if (title.length > 200) return reject(`"title" is ${title.length} characters; the limit is 200.`);
    if (entry.directive !== 'do' && entry.directive !== 'dont') {
      return reject(`"directive" is required and must be "do" or "dont". You passed ${JSON.stringify(entry.directive)}.`);
    }

    const scope = Array.isArray(entry.scope)
      ? entry.scope.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean)
      : [];
    const backslashed = scope.find((s) => s.includes('\\'));
    if (backslashed) return reject(`scope glob "${backslashed}" contains a backslash. Scope globs are POSIX.`);
    const bare = scope.find((s) => s === '**' || s === '**/*' || s === '*');
    if (bare) return reject(`scope glob "${bare}" is too broad and defeats inert-by-default scoping. Name real directories or omit "scope".`);

    if (entry.severity !== undefined && entry.severity !== 'hard' && entry.severity !== 'soft') {
      return reject(`"severity" must be "hard" or "soft". You passed ${JSON.stringify(entry.severity)}.`);
    }

    valid.push({
      title,
      directive: entry.directive,
      body: typeof entry.body === 'string' ? entry.body.trim() : '',
      scope,
      severity: entry.severity === 'hard' ? 'hard' : 'soft',
    });
  });

  return { valid, issues };
}

/** Ties a staged candidate's key to its full content, not just directive +
 * title: two candidates that share a title and directive but differ in
 * body/scope/severity must not collide onto one key — a collision would
 * mean `find` always resolves to the first of the two, and the second could
 * never be independently accepted or discarded. Two candidates whose
 * content is genuinely IDENTICAL collapsing onto the same key is fine (and
 * intended): they are the same candidate. */
function candidateKey(candidate: RuleCandidate): string {
  return checksum(JSON.stringify({
    directive: candidate.directive,
    title: candidate.title.toLowerCase(),
    body: candidate.body,
    scope: [...candidate.scope].sort(),
    severity: candidate.severity,
  })).slice(0, 8);
}

/**
 * Stage candidates. This function never calls `createItem` — the only call
 * site of `createItem` in this whole module is inside `acceptStagedRule`, so
 * the only route from a candidate to a real item is through that one
 * function. Whether `acceptStagedRule` is in turn reachable only from an
 * explicit human command is a property of whatever wires it up (a CLI
 * command), not something this module enforces on its own: nothing here
 * stops another caller from importing and calling `acceptStagedRule`
 * directly.
 */
export function stageRuleCandidates(
  root: string, lesson: Item, raw: unknown,
): { staging: LessonStaging; issues: ValidationIssue[] } {
  const { valid, issues } = validateRuleCandidates(raw);

  const previousRaw = loadStaging(root, lesson.id);
  const previous = previousRaw?.protocol === STAGING_PROTOCOL ? previousRaw : null;
  const settled = (previous?.candidates ?? []).filter((c) => c.state === 'accepted' || c.state === 'discarded');

  const staged: StagedRule[] = valid.map((candidate) => ({
    key: candidateKey(candidate),
    candidate,
    state: 'pending',
    ruleId: null,
  }));

  const seen = new Set(settled.map((c) => c.key));
  const staging: LessonStaging = {
    protocol: STAGING_PROTOCOL,
    lessonId: lesson.id,
    createdAt: new Date().toISOString(),
    candidates: [...settled, ...staged.filter((c) => !seen.has(c.key))],
  };

  saveStaging(root, staging);
  return { staging, issues };
}

/**
 * The only call site of `createItem` in this module — the sole route from a
 * staged candidate to a real item. `origin: 'human'` is hardcoded below; there
 * is no argument through which a caller can override it. A user command
 * creates active items (spec §7.1's first table row), and `rule` is
 * normative, so any other origin would be silently demoted to `draft` by
 * `trustedStatus` (mutate.ts) — the gate is the command that reaches this
 * function, not the origin value itself.
 *
 * This function owns its own persistence rather than trusting a
 * caller-supplied `LessonStaging` object: it takes `root` and `lessonId`,
 * loads the staging file itself via `loadOrThrowStaging` (which also checks
 * `protocol` and that the file's own `lessonId` matches the argument — see
 * that function's comment), confirms the `lessonId` ARGUMENT names a lesson
 * that still exists in the index, and writes the accepted/`ruleId` state
 * back with `saveStaging` before returning. Because `loadOrThrowStaging`
 * already guarantees `staging.lessonId === lessonId` by the time this line
 * runs, the existence check and the `derived_from` relation target below
 * both deliberately read the `lessonId` ARGUMENT, not `staging.lessonId` —
 * one value to reason about, not two that happen to agree today. Without
 * `loadOrThrowStaging`'s checks, a hand-built `LessonStaging` value — one
 * never written to `.staging/`, or naming a lesson id that does not exist —
 * would be indistinguishable from a real one, and a second accept of the
 * same key would succeed silently because the in-memory mutation below was
 * never persisted for the next call to see.
 *
 * `edits` are re-validated through `validateRuleCandidates` (merged onto the
 * original candidate first) rather than trusted directly: without this, an
 * edit could smuggle in a bare `**` scope glob or an out-of-enum `directive`
 * that the original staged candidate was never allowed to carry, bypassing
 * every guard `validateRuleCandidates` enforces on the way in.
 *
 * This is *intended* to be reachable only from an explicit human command
 * (`mycontext lesson-accept`) — that is an intention about how this function
 * gets wired up, not a guarantee this function itself can make.
 */
export function acceptStagedRule(
  ctx: MutationContext, root: string, lessonId: string, key: string, edits: Partial<RuleCandidate> = {},
): string {
  const staging = loadOrThrowStaging(root, lessonId);

  if (!ctx.store.get(lessonId)) {
    throw new Error(
      `my_context: ${lessonId} no longer exists in the index. Refusing to accept a rule derived ` +
      `from a lesson that cannot be found — re-run \`mycontext lesson\` against a real lesson id.`,
    );
  }

  const staged = staging.candidates.find((c) => c.key === key);
  if (!staged) {
    throw new Error(
      `my_context: staging for ${staging.lessonId} has no candidate "${key}". ` +
      `Keys: ${staging.candidates.map((c) => c.key).join(', ')}.`,
    );
  }
  if (staged.state === 'accepted') {
    throw new Error(`my_context: candidate ${key} was already accepted as ${staged.ruleId}.`);
  }
  if (staged.state === 'discarded') {
    throw new Error(`my_context: candidate ${key} was discarded and cannot be accepted. Re-derive with \`mycontext lesson ${staging.lessonId}\`.`);
  }

  const mergedRaw = { ...staged.candidate, ...edits };
  const { valid, issues } = validateRuleCandidates([mergedRaw]);
  if (issues.length > 0) {
    throw new Error(
      `my_context: the edited candidate is invalid: ${issues.map((i) => i.message).join(' ')}`,
    );
  }
  const merged = valid[0];
  const prefix = ctx.config.categories.rule.prefix;

  const outcome = createItem(ctx, {
    type: 'rule',
    id: makeId(prefix, merged.title),
    title: merged.title,
    body: merged.body,
    status: 'active',
    origin: 'human',
    severity: merged.severity,
    scope: merged.scope,
    extra: { directive: merged.directive },
    // The only edge spec §7.4 asks for — not the only edge createItem would
    // accept. `createItem`'s own relation validation (`validateRelations`,
    // mutate.ts) checks only each relation's TARGET, never its type; the
    // closed `RELATION_TYPES` enum is enforced solely inside `linkItems`,
    // which this path never calls. A reverse `produced_rule` edge on the
    // lesson was left out because spec §7.4 asks only for this forward edge,
    // not because writing one here would be refused.
    //
    // `target: lessonId` — the ARGUMENT, not `staging.lessonId` — even
    // though `loadOrThrowStaging` guarantees they are equal by this point:
    // one source of truth for "which lesson", not two fields that must be
    // kept in sync by convention.
    relations: [{ type: 'derived_from', target: lessonId }],
  });

  staged.state = 'accepted';
  staged.ruleId = outcome.id;
  saveStaging(root, staging);
  return outcome.id;
}

/**
 * The sibling of `acceptStagedRule`: loads staging from disk itself (via
 * `loadOrThrowStaging`) rather than trusting a caller-supplied value, and
 * persists the `discarded` state with `saveStaging` before returning —
 * without that, "a discarded candidate can never be accepted" would only
 * hold for the remainder of one process's in-memory object, not across the
 * accept command's own separate invocation.
 */
export function discardStagedRule(root: string, lessonId: string, key: string): LessonStaging {
  const staging = loadOrThrowStaging(root, lessonId);
  const staged = staging.candidates.find((c) => c.key === key);
  if (!staged) {
    throw new Error(
      `my_context: staging for ${staging.lessonId} has no candidate "${key}". ` +
      `Keys: ${staging.candidates.map((c) => c.key).join(', ')}.`,
    );
  }
  if (staged.state === 'accepted') {
    throw new Error(`my_context: candidate ${key} was already accepted as ${staged.ruleId}. Supersede or deprecate ${staged.ruleId} instead.`);
  }
  staged.state = 'discarded';
  saveStaging(root, staging);
  return staging;
}
