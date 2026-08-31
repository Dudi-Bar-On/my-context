import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { retryOnTransientFsError } from '../core/rebuild.ts';
import path from 'node:path';
import { RULE_DIRECTIVES } from '../core/command-flags.ts';
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
 * the same class of hazard `validateRelationTarget` (core/validate.ts) guards for
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
    // Retried: on NTFS a rename over an existing staging file fails EPERM
    // while a scanner/indexer holds the target open. The default ~200 ms
    // policy is enough here — this is an interactive CLI path whose failure
    // is thrown to a human who can rerun, not a hook whose failure is a
    // silent loss.
    retryOnTransientFsError(() => renameSync(tmp, target));
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return target;
}

/**
 * Reads `.staging/<lessonId>.json`.
 *
 * Returns `null` for exactly ONE case — the file does not exist — and THROWS
 * for a file that exists but cannot be trusted (unparseable JSON, a
 * non-object payload, a wrong/garbled `protocol`, a `lessonId` field that
 * disagrees with the filename, or a `candidates` field that is not an
 * array). Collapsing those two outcomes into one `null` was a real defect:
 * `stageRuleCandidates` read `null` as "nothing here yet" and OVERWROTE a
 * corrupt file, which meant a candidate a human had already discarded came
 * back `pending` and acceptable; `lesson-accept` read the same `null` as
 * "nothing staged" and told the user to run `lesson-stage`, i.e. steered
 * them into that overwrite. A corrupt staging file is working state a human
 * has to look at, so every caller now has to handle it as its own case.
 *
 * The thrown messages deliberately name the file's path rather than
 * suggesting a re-stage: `stageRuleCandidates` refuses on the same condition,
 * so "re-run lesson-stage to regenerate it" would not be true of what this
 * code does.
 *
 * What this does NOT check is provenance. A hand-written
 * `.staging/<realLessonId>.json` with the right protocol and a matching
 * `lessonId` is indistinguishable from a real one and is accepted. The
 * staging directory is unauthenticated working state; this function only
 * checks the SHAPE the rest of this module depends on.
 */
export function loadStaging(root: string, lessonId: string): LessonStaging | null {
  const file = stagingFile(root, lessonId);
  if (!existsSync(file)) return null;

  const corrupt = (reason: string): Error => new Error(
    `my_context: the staging file for ${lessonId} cannot be trusted — ${reason}. Refusing to read or ` +
    `overwrite it, because it may record candidates a human already accepted or discarded. Inspect ` +
    `${file} and delete it if it is genuinely junk, then re-stage.`,
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw corrupt(`it is not valid JSON (${err instanceof Error ? err.message : String(err)})`);
  }

  if (!isObject(parsed)) {
    throw corrupt(`its top level is ${parsed === null ? 'null' : Array.isArray(parsed) ? 'an array' : `a ${typeof parsed}`}, not an object`);
  }

  const staging = parsed as unknown as LessonStaging;
  if (staging.protocol !== STAGING_PROTOCOL) {
    throw corrupt(
      `its protocol is ${JSON.stringify(staging.protocol)}, expected ${JSON.stringify(STAGING_PROTOCOL)} ` +
      `(it may be from an incompatible version)`,
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
      `Inspect ${file} and delete it if it is genuinely junk, then re-stage.`,
    );
  }

  if (!Array.isArray(staging.candidates)) {
    throw corrupt(`its "candidates" field is ${JSON.stringify(staging.candidates)}, not an array`);
  }

  return staging;
}

/**
 * The internal loader `acceptStagedRule`/`discardStagedRule` use — never a
 * caller-supplied `LessonStaging` value (see those functions' doc comments
 * for why that distinction is load-bearing). Adds "the file is absent" to
 * the refusals `loadStaging` already makes, so accept and discard have a
 * single non-null value to work with.
 */
function loadOrThrowStaging(root: string, lessonId: string): LessonStaging {
  const staging = loadStaging(root, lessonId);
  if (!staging) {
    throw new Error(
      `my_context: no staged rule candidates found for ${lessonId}. Run ` +
      `\`mycontext lesson ${lessonId}\` to derive candidates first.`,
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
      directive: { enum: RULE_DIRECTIVES, description: '"do" prescribes; "dont" prohibits.' },
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
      'Do not invent scope. Scope RESTRICTS where a rule applies, so omitting it leaves the rule applying everywhere — which is the right answer for a rule that is not about particular directories, and the honest answer when you cannot name them. A human can narrow it during review.',
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

/**
 * The exact property set `RULE_CANDIDATE_SCHEMA` declares, which is
 * `additionalProperties: false`. Spelled here so an entry carrying a field
 * the schema does not have is REPORTED rather than dropped on the floor —
 * see the note on silent coercion in `validateRuleCandidates`.
 */
const CANDIDATE_FIELDS = ['title', 'directive', 'body', 'scope', 'severity'];

/**
 * Every field a candidate carries is either accepted as given or REJECTED
 * with a message naming the field, what was passed and the accepted shape.
 * Nothing is silently coerced.
 *
 * That rule is not stylistic. This module sits on the approval gate, and a
 * field the model asserted but this function quietly replaced is a claim
 * discarded without anyone being told: a string `scope` became `[]`, so a
 * candidate whose author named real directories was staged as applying to
 * the whole repository; a missing `body` — declared REQUIRED in
 * `RULE_CANDIDATE_SCHEMA` — became `''`, producing a rule that states no
 * reason. Both were reported as zero issues. Silently widening a rule's
 * reach past what its author wrote is the worse of the two, and neither is
 * survivable enough to hide.
 */
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

    const unknown = Object.keys(entry).filter((k) => !CANDIDATE_FIELDS.includes(k));
    if (unknown.length > 0) {
      return reject(
        `unknown field(s) ${unknown.map((k) => JSON.stringify(k)).join(', ')}. A rule candidate has ` +
        `exactly these fields: ${CANDIDATE_FIELDS.join(', ')}.`,
      );
    }

    if (!title) return reject('"title" is required and is the directive itself.');
    if (title.length > 200) return reject(`"title" is ${title.length} characters; the limit is 200.`);
    // The literal comparison is what NARROWS `entry.directive` for the push
    // below; `RULE_DIRECTIVES` is what the schema above advertises and what
    // `lesson-accept --directive` offers as a select. They are asserted
    // identical in `test/cli/command-flags.test.ts` rather than left to agree
    // by inspection — this is the one vocabulary in the product that decides
    // whether a rule prescribes or prohibits.
    if (entry.directive !== 'do' && entry.directive !== 'dont') {
      return reject(
        `"directive" is required and must be ${RULE_DIRECTIVES.map((d) => `"${d}"`).join(' or ')}. `
        + `You passed ${JSON.stringify(entry.directive)}.`,
      );
    }

    if (typeof entry.body !== 'string' || entry.body.trim() === '') {
      return reject(
        `"body" is required and must be a non-empty string saying WHY the rule holds. You passed ` +
        `${JSON.stringify(entry.body)}.`,
      );
    }

    if (entry.scope !== undefined && !Array.isArray(entry.scope)) {
      return reject(
        `"scope" must be an array of POSIX glob strings, e.g. ["migrations/**"]. You passed ` +
        `${JSON.stringify(entry.scope)}. Omit "scope" rather than guessing.`,
      );
    }
    const rawScope: unknown[] = Array.isArray(entry.scope) ? entry.scope : [];
    const nonString = rawScope.findIndex((s) => typeof s !== 'string');
    if (nonString !== -1) {
      return reject(
        `"scope" entry ${nonString} is ${JSON.stringify(rawScope[nonString])}; every scope entry must be ` +
        `a POSIX glob string, e.g. "migrations/**".`,
      );
    }
    const scope = (rawScope as string[]).map((s) => s.trim());
    const blank = scope.indexOf('');
    if (blank !== -1) {
      return reject(`"scope" entry ${blank} is empty. Name a real glob, e.g. "migrations/**", or omit "scope".`);
    }
    const backslashed = scope.find((s) => s.includes('\\'));
    if (backslashed) return reject(`scope glob "${backslashed}" contains a backslash. Scope globs are POSIX.`);
    const bare = scope.find((s) => s === '**' || s === '**/*' || s === '*');
    if (bare) return reject(`scope glob "${bare}" matches the whole repository, which is what omitting "scope" already does. Name real directories, or omit "scope".`);

    if (entry.severity !== undefined && entry.severity !== 'hard' && entry.severity !== 'soft') {
      return reject(`"severity" must be "hard" or "soft". You passed ${JSON.stringify(entry.severity)}.`);
    }

    valid.push({
      title,
      directive: entry.directive,
      body: entry.body.trim(),
      scope,
      // Reachable values here are only 'hard', 'soft' and undefined — the
      // enum check above rejected everything else, so this is the documented
      // default for an OMITTED severity, not a coercion of a supplied one.
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
 *
 * Re-staging is destructive by design — a second derivation replaces the
 * pending set — but it is NOT a reset button for anything a human has ruled
 * on: `settled` carries every `accepted` and `discarded` candidate forward
 * unchanged, so a discarded candidate cannot come back acceptable. The
 * pending candidates a re-stage drops are returned as `dropped` so the
 * caller can SAY what it dropped instead of losing it silently; dropping
 * them is not refused, because re-deriving after a bad model response is the
 * documented loop.
 *
 * If the existing staging file cannot be trusted, `loadStaging` throws and
 * this function never reaches `saveStaging` — a corrupt file is not
 * overwritten, because it may be the only record of an earlier discard.
 */
export function stageRuleCandidates(
  root: string, lesson: Item, raw: unknown,
): { staging: LessonStaging; issues: ValidationIssue[]; dropped: StagedRule[] } {
  const { valid, issues } = validateRuleCandidates(raw);

  const previous = loadStaging(root, lesson.id);
  const settled = (previous?.candidates ?? []).filter((c) => c.state === 'accepted' || c.state === 'discarded');

  const staged: StagedRule[] = valid.map((candidate) => ({
    key: candidateKey(candidate),
    candidate,
    state: 'pending',
    ruleId: null,
  }));

  const seen = new Set(settled.map((c) => c.key));
  const kept = new Set([...seen, ...staged.map((c) => c.key)]);
  const dropped = (previous?.candidates ?? []).filter((c) => c.state === 'pending' && !kept.has(c.key));

  const staging: LessonStaging = {
    protocol: STAGING_PROTOCOL,
    lessonId: lesson.id,
    createdAt: new Date().toISOString(),
    candidates: [...settled, ...staged.filter((c) => !seen.has(c.key))],
  };

  saveStaging(root, staging);
  return { staging, issues, dropped };
}

/**
 * The only call site of `createItem` in this module — the sole route from a
 * staged candidate to a real item. `origin: 'human'` is hardcoded below; there
 * is no argument through which a caller can override it. A user command
 * creates active items (spec §7.1's first table row), and `rule` is
 * normative, so any other origin would be silently demoted to `draft` by
 * `trustedStatus` (core/trust.ts) — the gate is the command that reaches this
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
    // `'accept'`, not the default `'create'`: the audit log distinguishes a
    // rule a human wrote from a rule a human APPROVED out of a staged
    // candidate the deriver proposed. Both produce a governing item, and only
    // one of them started as a machine's suggestion — a reader auditing where
    // this project's rules came from needs to see which.
  }, 'accept');

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
