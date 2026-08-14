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

function stagingFile(root: string, lessonId: string): string {
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

/**
 * Stage candidates. This function deliberately does not import anything that
 * can write to `items/`: the only route from a candidate to an item is
 * `acceptStagedRule`, and that is reachable only from an explicit user command.
 */
export function stageRuleCandidates(
  root: string, lesson: Item, raw: unknown,
): { staging: LessonStaging; issues: ValidationIssue[] } {
  const { valid, issues } = validateRuleCandidates(raw);

  const previous = loadStaging(root, lesson.id);
  const settled = (previous?.candidates ?? []).filter((c) => c.state === 'accepted' || c.state === 'discarded');

  const staged: StagedRule[] = valid.map((candidate) => ({
    key: checksum(`${candidate.directive}|${candidate.title.toLowerCase()}`).slice(0, 8),
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
 * The approval gate. Nothing else in this module writes an item, and this is
 * called only from `mycontext lesson-accept` — the user's explicit act of
 * approval. The rule is created `active` with `origin: 'human'` because a user
 * command creates active items (spec §7.1's first table row); the gate is the
 * command itself, not a second status hop. `origin: 'agent'` here would be
 * silently self-defeating: `rule` is normative, so `trustedStatus` would force
 * the result to `draft` and the accept would appear to do nothing.
 */
export function acceptStagedRule(
  ctx: MutationContext, staging: LessonStaging, key: string, edits: Partial<RuleCandidate> = {},
): string {
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

  const merged: RuleCandidate = { ...staged.candidate, ...edits };
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
    // The only edge spec §7.4 asks for, and the only one that could be written:
    // `produced_rule` is not in RELATION_TYPES, so link_items would throw.
    relations: [{ type: 'derived_from', target: staging.lessonId }],
  });

  staged.state = 'accepted';
  staged.ruleId = outcome.id;
  return outcome.id;
}

export function discardStagedRule(staging: LessonStaging, key: string): void {
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
}
