import { createItem } from '../../core/mutate.ts';
import { makeId } from '../../core/slug.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import {
  acceptStagedRule, buildRuleRequest, discardStagedRule, loadStaging,
  renderRuleRequest, stageRuleCandidates, type RuleCandidate,
} from '../../lesson/derive.ts';
import { emitLoadErrors, openMutateContext, readPayload, toCliMessage } from './context.ts';
import { flag, positionals, registerCommand, type Emit } from './registry.ts';

function requireWorkspace(ws: Workspace, out: Emit): boolean {
  if (ws.projectRoot) return true;
  out('my_context: no workspace here. Run `mycontext init` to create one.');
  return false;
}

/**
 * `mycontext lesson "<text>"` records the lesson AND prints the derivation
 * request in one step; `mycontext lesson <existing-id>` re-derives from an
 * item that already exists rather than creating a duplicate. Both paths end
 * by printing the same request — there is exactly one place that builds it.
 */
function cmdLesson(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;

  const subject = positionals(args, []).join(' ').trim();
  if (!subject) {
    out('usage: mycontext lesson "<what was learned>" | mycontext lesson <LESSON-id>');
    return 1;
  }

  const { ctx, errors } = openMutateContext(ws);
  try {
    // `subject` may already BE an id (the re-derive path) — checked first so
    // an id round-trips to the same item instead of trying to mint a new one
    // from it as if it were title text.
    let lesson: Item | null = ctx.store.get(subject);
    if (lesson && lesson.type !== 'lesson') {
      out(`my_context: ${subject} is a ${lesson.type}, not a lesson. Rules are derived from lessons only.`);
      return 1;
    }

    if (!lesson) {
      // Not an id — treat it as title text and dedupe on the id `createItem`
      // would allocate for it, so re-running `lesson` with the same wording
      // re-derives instead of creating a second lesson.
      const candidateId = makeId(ctx.config.categories.lesson.prefix, subject);
      const existing = ctx.store.get(candidateId);
      if (existing) {
        lesson = existing;
      } else {
        // `origin: 'human'` — the CLI is the user (spec §7.1). `createItem`
        // returns ids, not the item itself, so the object comes from the
        // store, which it has already upserted into.
        const created = createItem(ctx, { type: 'lesson', title: subject, status: 'active', origin: 'human' });
        lesson = ctx.store.get(created.id) as Item;
      }
    }

    out(`my_context: lesson ${lesson.id} recorded (rationale tier — indexed, never injected).`);
    out('');
    out(renderRuleRequest(buildRuleRequest(lesson, ws.config)));
    emitLoadErrors(errors, out);
    return errors.length ? 1 : 0;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

function cmdLessonStage(ws: Workspace, args: string[], out: Emit, cwd: string): number {
  if (!requireWorkspace(ws, out)) return 1;

  const [lessonId] = positionals(args, ['file']);
  if (!lessonId) {
    out('usage: mycontext lesson-stage <LESSON-id> (--file <path> | --stdin)');
    return 1;
  }

  const { ctx, errors } = openMutateContext(ws);
  try {
    const lesson = ctx.store.get(lessonId);
    if (!lesson) { out(`my_context: no item with id "${lessonId}".`); return 1; }

    const payload = readPayload(args, cwd);
    const { staging, issues } = stageRuleCandidates(ws.projectRoot as string, lesson, payload);

    const pending = staging.candidates.filter((c) => c.state === 'pending');
    out(`my_context: ${pending.length} rule candidate(s) staged for ${lessonId}. None of them exists as an item yet.`);
    for (const staged of pending) {
      out(`  ${staged.key}  ${staged.candidate.directive.padEnd(4)}  ${staged.candidate.title}`);
    }

    if (issues.length) {
      out('');
      const noun = issues.length === 1 ? 'candidate' : 'candidates';
      out(`${issues.length} ${noun} rejected:`);
      for (const issue of issues) out(`  [${issue.index}] ${issue.title ?? '(untitled)'}: ${issue.message}`);
    }

    out('');
    out(`Accept with:  mycontext lesson-accept ${lessonId} <key> [--title "…"] [--scope "a/**,b/**"]`);
    out(`Discard with: mycontext lesson-discard ${lessonId} <key>`);
    emitLoadErrors(errors, out);
    return errors.length ? 1 : 0;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

/** `--title`/`--scope`/`--severity`/`--directive` overrides for accept. Never
 * trusted directly — `acceptStagedRule` re-validates the merged candidate
 * through the same schema every staged candidate already passed. */
function edits(args: string[]): Partial<RuleCandidate> {
  const patch: Partial<RuleCandidate> = {};
  const title = flag(args, 'title');
  if (title) patch.title = title;
  const scope = flag(args, 'scope');
  if (scope !== null) patch.scope = scope.split(',').map((s) => s.trim()).filter(Boolean);
  const severity = flag(args, 'severity');
  if (severity === 'hard' || severity === 'soft') patch.severity = severity;
  const directive = flag(args, 'directive');
  if (directive === 'do' || directive === 'dont') patch.directive = directive;
  return patch;
}

/**
 * `lessonId` and `key` are the only staging inputs this command accepts from
 * argv — never a serialized staging blob, a staging file path, or a `--root`
 * the caller chose (see the module comment on `acceptStagedRule` in
 * `lesson/derive.ts`). `loadStaging` below is read ONLY to print the
 * candidate for human review before acting on it; it is never passed into
 * `acceptStagedRule`/`discardStagedRule`, which reload staging from disk
 * themselves by `(root, lessonId)` — two independent reads of the same file,
 * not one load shared between "what we show" and "what we act on".
 */
function cmdLessonAccept(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;

  const [lessonId, key] = positionals(args, ['title', 'scope', 'severity', 'directive']);
  if (!lessonId || !key) {
    out('usage: mycontext lesson-accept <LESSON-id> <key> [--title "…"] [--scope "a/**,b/**"] [--severity hard|soft] [--directive do|dont]');
    return 1;
  }

  const root = ws.projectRoot as string;

  // Peek at staging so a bad key or missing staging fails BEFORE opening a
  // mutation context, and so the human sees exactly what they are about to
  // approve — the printing requirement is what turns "a human named this
  // key" into "a human read this rule and approved it".
  const staging = loadStaging(root, lessonId);
  if (!staging) {
    out(
      `my_context: nothing staged for ${lessonId}. Run \`mycontext lesson ${lessonId}\` then ` +
      `\`mycontext lesson-stage ${lessonId} --stdin\` (or --file) first.`,
    );
    return 1;
  }
  const staged = staging.candidates.find((c) => c.key === key);
  if (!staged) {
    out(
      `my_context: staging for ${lessonId} has no candidate "${key}". ` +
      `Keys: ${staging.candidates.map((c) => c.key).join(', ')}.`,
    );
    return 1;
  }
  if (staged.state === 'discarded') {
    out(`my_context: candidate ${key} was discarded and cannot be accepted. Re-derive with \`mycontext lesson ${lessonId}\`.`);
    return 1;
  }
  if (staged.state === 'accepted') {
    out(`my_context: candidate ${key} was already accepted as ${staged.ruleId}.`);
    return 1;
  }

  const patch = edits(args);
  const merged: RuleCandidate = { ...staged.candidate, ...patch };
  out('my_context: about to create this rule — review before it becomes active:');
  out(`  title:     ${merged.title}`);
  out(`  directive: ${merged.directive}`);
  out(`  severity:  ${merged.severity}`);
  out(`  scope:     ${merged.scope.length ? merged.scope.join(', ') : '(none — matches every scope check)'}`);
  out(`  body:      ${merged.body}`);
  out('');

  const { ctx, errors } = openMutateContext(ws);
  try {
    // `acceptStagedRule` reloads staging from disk itself by (root,
    // lessonId) — the object peeked above is never handed to it.
    const ruleId = acceptStagedRule(ctx, root, lessonId, key, patch);
    out(`my_context: created ${ruleId} (active) with derived_from [[${lessonId}]].`);
    emitLoadErrors(errors, out);
    return errors.length ? 1 : 0;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

function cmdLessonDiscard(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;

  const [lessonId, key] = positionals(args, []);
  if (!lessonId || !key) {
    out('usage: mycontext lesson-discard <LESSON-id> <key>');
    return 1;
  }

  try {
    discardStagedRule(ws.projectRoot as string, lessonId, key);
    out(`my_context: discarded candidate ${key} for ${lessonId}. It cannot be accepted later.`);
    return 0;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

registerCommand({
  name: 'lesson',
  usage: 'lesson "<text>" | <id>',
  summary: 'record a lesson and request candidate rules',
  run: cmdLesson,
});

registerCommand({
  name: 'lesson-stage',
  usage: 'lesson-stage <id>',
  summary: 'stage derived rule candidates for approval',
  run: cmdLessonStage,
});

registerCommand({
  name: 'lesson-accept',
  usage: 'lesson-accept <id> <key>',
  summary: 'approve a staged rule and create it',
  run: cmdLessonAccept,
});

registerCommand({
  name: 'lesson-discard',
  usage: 'lesson-discard <id> <key>',
  summary: 'permanently reject a staged rule',
  run: cmdLessonDiscard,
});
