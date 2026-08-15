import { createItem } from '../../core/mutate.ts';
import { makeId } from '../../core/slug.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import {
  acceptStagedRule, buildRuleRequest, discardStagedRule, loadStaging,
  renderRuleRequest, stageRuleCandidates, type LessonStaging, type RuleCandidate,
} from '../../lesson/derive.ts';
import { emitLoadErrors, openMutateContext, readPayload, toCliMessage } from './context.ts';
import { table } from './format.ts';
import { flag, listFlag, positionals, registerCommand, type Emit } from './registry.ts';

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
    // F2 (see the comment in cmdAdd, src/cli/index.ts, and openMutateContext's
    // own doc comment in context.ts): this command did what it was asked — the
    // lesson exists and the derivation request printed — so an UNRELATED load
    // error elsewhere in the corpus is a warning, not a failure. Only `status`
    // and `doctor` exit non-zero on one.
    emitLoadErrors(errors, out);
    return 0;
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
    const { staging, issues, dropped } = stageRuleCandidates(ws.projectRoot as string, lesson, payload);

    const pending = staging.candidates.filter((c) => c.state === 'pending');
    out(`my_context: ${pending.length} rule candidate(s) staged for ${lessonId}. None of them exists as an item yet.`);
    // The shared `table` helper, not hand-rolled `padEnd`: this repo's real
    // ids run to 63 characters and collided with hardcoded widths in every
    // report that rolled its own. Two-space indent so the table sits under
    // the line above it, the same shape `decay` and `status` use.
    for (const line of table(
      ['key', 'directive', 'title'],
      pending.map((s) => [s.key, s.candidate.directive, s.candidate.title]),
      { indent: '  ' },
    )) out(line);

    // Re-staging replaces the pending set. Saying which pending candidates
    // that dropped is the difference between "replaced" and "silently lost"
    // — accepted and discarded candidates are carried forward and are never
    // in this list.
    if (dropped.length) {
      out('');
      out(`${dropped.length} previously pending candidate(s) dropped — this derivation did not produce them again:`);
      for (const line of table(
        ['key', 'directive', 'title'],
        dropped.map((s) => [s.key, s.candidate.directive, s.candidate.title]),
        { indent: '  ' },
      )) out(line);
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
    // F2 — see the identical comment in cmdLesson above: staging succeeded at
    // its own job, so an unrelated load error elsewhere is a warning, not a
    // failure.
    emitLoadErrors(errors, out);
    return 0;
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
  if (title !== null) patch.title = title;
  // `listFlag`, not `flag`: `--scope a/** --scope b/**` used to keep `a/**`
  // alone and accept the rule, the same first-occurrence-wins drop
  // `mycontext add --scope` was fixed for. Every occurrence is unioned and
  // each is still comma-split, so both spellings compose.
  const scope = listFlag(args, 'scope');
  if (scope !== null) patch.scope = scope;
  // Passed through as typed, NOT filtered to the legal values. The filter
  // that used to be here (`if (severity === 'hard' || severity === 'soft')`)
  // meant `--severity critical` and `--directive maybe` were accepted on the
  // command line, dropped, and the rule created from the staged values while
  // the command reported success. `validateRuleCandidates` — which
  // `acceptStagedRule` runs over the MERGED candidate, and which this
  // function's contract above already claims as its guard — refuses both by
  // name with the vocabulary in its own message, so passing them through is
  // what makes that claim true.
  const severity = flag(args, 'severity');
  if (severity !== null) patch.severity = severity as RuleCandidate['severity'];
  const directive = flag(args, 'directive');
  if (directive !== null) patch.directive = directive as RuleCandidate['directive'];
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
  // mutation context, and so this command can PRINT the full candidate
  // (title/directive/severity/scope/body, with any --title/--scope/etc.
  // edits already merged in) before creating anything. This does not, and
  // cannot, verify that a human actually read what was printed — nothing
  // here checks that. What it does guarantee is narrower and mechanical:
  // the candidate shown is a real staged one (found by key in the peeked
  // file, not fabricated by this command), and the edited values printed
  // are the same values `acceptStagedRule` below will independently
  // recompute and create — because both this peek and that call apply the
  // identical `edits` patch on top of the identical staged candidate. The
  // peek and the create are still two separate reads of the staging file,
  // not one shared value passed between them (constraint 4) — `staging`
  // below is never handed to `acceptStagedRule`, which reloads from disk
  // itself by `(root, lessonId)`.
  //
  // `loadStaging` returns null ONLY when there is no staging file, and throws
  // when there is one that cannot be trusted. Both are handled here, and
  // differently: "nothing staged, run lesson-stage" would be a false and
  // actively harmful thing to print for a corrupt file, because
  // `lesson-stage` refuses that case rather than regenerating over it. This
  // is also the guard for a `lessonId` that is not a legal staging file name
  // — `stagingFile` throws on those, and that throw used to escape this
  // function uncaught.
  let staging: LessonStaging | null;
  try {
    staging = loadStaging(root, lessonId);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
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
    // F2 — see the identical comment in cmdLesson above: accept did what it
    // was asked (the rule was created and staging was updated) — so an
    // unrelated load error elsewhere is a warning, not a failure. Getting
    // this wrong here is worse than in the read-only commands: a caller
    // scripting `lesson-accept ... && next-step` would see failure AFTER a
    // real, persisted mutation, which is not what "failure" should mean.
    emitLoadErrors(errors, out);
    return 0;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

function cmdLessonDiscard(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;

  // Same `valueFlags` list as `cmdLessonAccept`'s positionals() call, even
  // though discard accepts none of those flags itself: without this, `mycontext
  // lesson-discard <id> --title X <key>` would treat the flag's own value `X`
  // as a positional and silently resolve it as the key (asymmetric with
  // accept, and confusing) instead of consuming it as an unrecognized flag's
  // argument the same way accept does.
  const [lessonId, key] = positionals(args, ['title', 'scope', 'severity', 'directive']);
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
