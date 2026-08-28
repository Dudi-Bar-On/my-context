/**
 * **What a boundary command will change, derived by running it somewhere safe.**
 *
 * Spec `docs/superpowers/specs/2026-08-26-execute-a-composed-command-design.md`
 * §3.2 and §6.1; task `plan:execute seq:5b`. Owner ruling 2026-08-27: the
 * effect is computed by DRY-RUNNING the real write path against a scratch copy,
 * not by each command declaring its own effect.
 *
 * ── WHY THE DERIVATION IS HERE AND NOT IN THE BROWSER ───────────────────────
 *
 * §6.1 ruled that every catalogue command runs, boundary-crossing ones behind a
 * confirm showing every field that changes, before → after. §3.2 makes that
 * honest: "A command whose effect cannot be shown that way does not get a
 * weaker confirm — it does not run."
 *
 * What shipped obeyed §3.2 and did not reach §6.1, because the confirm was
 * rendered in the browser and a browser cannot derive what a command writes:
 * that is the command's BODY, not its argument shape, and there is no build
 * step to import it through. So `command-actions.js` carried a transcribed
 * `COMMAND_EFFECTS` table covering five commands, and the other nine were
 * refused — correctly under §3.2, and still refused.
 *
 * The derivation was on the wrong side. This module puts it where the knowledge
 * already is, the same move `resolveCommand` made for argv.
 *
 * ── WHY A DRY RUN AND NOT A DECLARATION ─────────────────────────────────────
 *
 * A declaration is the house pattern — `command-flags.ts` declares flags — and
 * it cannot express a DATA-DEPENDENT effect. `repair` re-stamps however many
 * items are stale; `refresh` re-snapshots whatever moved. No table can state
 * what those change, because the answer is a property of the corpus at the
 * moment the button is pressed. A declaration would leave exactly the commands
 * this task exists to unblock still blocked.
 *
 * The dry run also cannot drift. A transcribed table is a second spelling of
 * something the code already knows, and `palette-defs.js` records that this
 * repository has already paid for four of those.
 *
 * ── THE SAFETY PROPERTY, ESTABLISHED RATHER THAN ASSUMED ────────────────────
 *
 * This module RUNS A REAL WRITE COMMAND. The whole design rests on it running
 * against a copy, so "the copy is what it reached" cannot be a hope.
 *
 * The child runs with `cwd` at the REAL repository, because that is what makes
 * `--file docs/x.md` mean what the user typed. So `cwd` alone would send it to
 * the real corpus, and what sends it to the copy instead is `CORPUS_DIR_ENV`,
 * set for that child and nothing else.
 *
 * **That was not always possible, and the first version of this module was
 * wrong because of it.** `findProjectRoot` used to walk up from `cwd` with no
 * override, so one lever set both the corpus AND the path root. This module
 * moved `cwd` into the copy, and the child then resolved the user's paths
 * against a temp directory: `add --file` was refused as unreadable, and a file
 * inside the repository was reported "outside this repository", naming the
 * scratch as the repository. Both were FALSE refusals, reported by the owner
 * from live confirms, and §3.2 must never produce one.
 *
 * **The check that used to sit here could not fail, and it is worth saying so
 * rather than quietly replacing it.** It compared
 * `findProjectRoot(repoRoot, scratchCorpus)` against `scratchCorpus` — but with
 * a non-empty override `findProjectRoot` returns `path.resolve(override)`
 * unconditionally, so it compared a value to itself, three lines after a
 * `cpSync` that would already have thrown on anything it might have caught. Its
 * docstring called it "established rather than assumed". Two tests named for it
 * passed for other reasons: one says in its own comment that the copy fails
 * first, and the other passes because `status` exits non-zero on an unparseable
 * file. Found by review 2026-08-28.
 *
 * It also asked the wrong question. It asked where the corpus IS, and the real
 * defect was a file INSIDE a corpus that genuinely was the copy, pointing back
 * out of it. What guards this now is stated as a property of the COPY, checked
 * after it is made and before anything is spawned:
 *
 *   - the copy holds item files at all, so an empty effect cannot be a copy
 *     that did not happen;
 *   - no symlink survived it, so no write can leave the scratch through one.
 *
 * Both are falsifiable, and the second fails on the exact defect that was
 * shipped.
 *
 * ── FAILURE IS A REFUSAL, NEVER AN EMPTY DIFF ───────────────────────────────
 *
 * The task states the one outcome that must not happen: "an empty diff beside a
 * command that changes something is the worst outcome available here." Every
 * path here either returns a derived effect or THROWS. It never returns `[]` to
 * mean "could not tell" — `[]` means, and only means, that the command ran and
 * changed no item.
 *
 * ── WHY THE CLI ENTRY IS A PARAMETER ────────────────────────────────────────
 *
 * `execute.ts` owns `CLI_ENTRY` and imports this module, so importing it back
 * would close a cycle. Passing it in keeps one spelling of the path, keeps the
 * dependency pointing one way, and lets a test drive a stub entry point.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseItem } from '../core/item.ts';
import type { Item } from '../core/types.ts';
import { CORPUS_DIR_ENV, DIR_NAME } from '../core/workspace.ts';

/**
 * How long a dry run may take before it is killed.
 *
 * Shorter than `RUN_TIMEOUT_MS` on purpose: this one runs while a person waits
 * with a dialog half-open, where the real run happens after they have
 * committed. A command that cannot describe itself in this long is refused a
 * confirm, which §3.2 already says is the right answer.
 */
export const EFFECT_TIMEOUT_MS = 15_000;

/**
 * `checksum` is excluded from every diff.
 *
 * It changes whenever any other field does, so showing it adds a row to every
 * confirm saying only "something above this line changed". Excluded rather than
 * rendered quietly, because a reader who learns to skim one row of this table
 * has learned to skim the table, and the table is the security boundary.
 */
const NOT_SHOWN: ReadonlySet<string> = Object.freeze(new Set(['checksum']));

/** One field of one item, as the confirm will draw it. */
export interface FieldEffect {
  field: string;
  /** The lines before, or `null` when the item did not exist. */
  before: string[] | null;
  /** The lines after, or `null` when the item is gone. */
  after: string[] | null;
}

/** One item the command touches. */
export interface ItemEffect {
  id: string;
  kind: 'created' | 'changed' | 'removed';
  fields: FieldEffect[];
}

/** Raised when the effect cannot be derived. Never swallowed into an empty diff. */
export class EffectRefusal extends Error {}

/**
 * Every path under `root` that is still a SYMLINK after the copy.
 *
 * **The guard that would have caught the 2026-08-28 Critical**, and the reason
 * the one it replaces was worthless. That one compared
 * `findProjectRoot(repoRoot, scratchCorpus)` against `scratchCorpus` — but with
 * a non-empty override `findProjectRoot` returns `path.resolve(override)`
 * unconditionally, so it compared a value to itself, three lines after a
 * `cpSync` that would already have thrown. It could not fail, and its docstring
 * called it "established rather than assumed".
 *
 * It also asked the wrong question. It asked where the corpus IS. The defect was
 * a file INSIDE a corpus that genuinely was the copy, pointing back out of it —
 * `cpSync` preserves symlinks by default, `rebuild.ts` records that item files
 * may be symlinks, and `writeItem` resolves before renaming, so the dry run
 * wrote straight through one into the real corpus.
 *
 * `dereference: true` fixes that at the copy. This asserts the fix HELD: a
 * symlink surviving here means the flag was dropped, or `cpSync` stopped
 * honouring it, and either way the next write may leave the scratch. It costs
 * one `lstat` per file, which is the price of the claim this module makes.
 */
function symlinksUnder(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      // `isSymbolicLink` on the Dirent, which is an `lstat` — `isDirectory()`
      // is FALSE for a directory symlink, so a walk that only recursed on
      // directories would step over the very thing being looked for.
      if (entry.isSymbolicLink()) { out.push(full); continue; }
      if (entry.isDirectory()) walk(full);
    }
  };
  walk(root);
  return out;
}

/** Every `*.md` under a directory, as paths relative to it. */
function markdownUnder(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;   // a directory that is not there contributes nothing
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) out.push(path.relative(root, full));
    }
  };
  walk(root);
  return out;
}

/**
 * The corpus OUTSIDE `items/`, digested — because a command can change the
 * corpus without touching a single item.
 *
 * **Found by review 2026-08-28, and it made a blank into a lie.**
 * `discardRevision` "writes no item and passes through no persist": its whole
 * effect is an append under `.my_context/.revisions/`. `snapshot()` walks only
 * `items/`, so `review discard-revision` — a `boundary: true` command — derived
 * an empty effect, and the confirm rendered "**This changes nothing.**" over an
 * irreversible settlement, with no fields shown. The proposal can never be
 * re-staged against that text afterwards.
 *
 * That sentence was added the same day, to replace a blank that said nothing.
 * The blank was ambiguous; this was worse — a confident false statement, which
 * is what an incomplete measurement becomes the moment something asserts on it.
 *
 * Digested rather than kept whole: these files are not items, so no field diff
 * can be shown for them, and their CONTENT is not what the reader needs. What
 * they need is that something outside the item tree changed, and which file.
 *
 * `.audit` and `.index.db` stay excluded for the reasons `worthCopying` gives —
 * they are not copied, so they cannot differ here anyway.
 */
function elsewhereInCorpus(corpusDir: string): Map<string, string> {
  const out = new Map<string, string>();
  const items = path.join(corpusDir, 'items');
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (full === items) continue;   // diffed field-by-field by `snapshot`
      // **The same exclusions the copy uses, for a second reason.** They are not
      // copied, so the "before" is always absent — but the child REBUILDS the
      // index inside the scratch, so without this every confirm grew a row
      // reading "created .index.db". That is the checksum noise this module
      // already refuses at the field level, arriving one level up: a row on
      // every confirm is a row readers learn to skim, and this table is the
      // security boundary.
      if (!worthCopying(full)) continue;
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.isFile()) continue;
      try {
        out.set(
          path.relative(corpusDir, full).split(path.sep).join('/'),
          createHash('sha256').update(readFileSync(full)).digest('hex'),
        );
      } catch {
        // Unreadable: recorded as absent, so it reads as a removal rather than
        // silently matching the other side.
      }
    }
  };
  walk(corpusDir);
  return out;
}

/** What changed outside `items/`, named as files rather than as fields. */
function elsewhereEffect(
  before: Map<string, string>,
  after: Map<string, string>,
): ItemEffect[] {
  const out: ItemEffect[] = [];
  for (const rel of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const one = before.get(rel);
    const two = after.get(rel);
    if (one === two) continue;
    out.push({
      id: rel,
      kind: one === undefined ? 'created' : two === undefined ? 'removed' : 'changed',
      // No field diff is possible — these are not items. The row says WHAT
      // changed and refuses to imply it can say how, which is the difference
      // between an honest partial answer and the empty one it replaces.
      fields: [{
        field: 'file',
        before: one === undefined ? null : ['(this file)'],
        after: two === undefined ? null : ['(is rewritten by this command)'],
      }],
    });
  }
  return out;
}

/** Every item file's text, keyed by its path relative to the corpus directory. */
export function snapshot(corpusDir: string): Map<string, string> {
  const items = path.join(corpusDir, 'items');
  const out = new Map<string, string>();
  for (const rel of markdownUnder(items)) {
    try {
      out.set(rel, readFileSync(path.join(items, rel), 'utf8'));
    } catch {
      // Unreadable mid-snapshot: absent, which the diff reports as a removal
      // rather than silently matching the other side.
    }
  }
  return out;
}

/**
 * One item's fields, in the vocabulary the rest of the UI already uses.
 *
 * These are `Item` field names, not frontmatter keys, and that is deliberate:
 * `/api/item/:id` serves an `Item`, and `command-actions.js` renders a diff by
 * reading `item[field]` from it. Emitting `source_file` here would produce a
 * confirm whose row names nothing the reader can find in the item beside it.
 *
 * `checksum` is in `NOT_SHOWN`. `filePath` and `layer` are absent for a
 * different reason — they are where the item IS, not what it says, and a move
 * shows up as a created/removed pair which states it better than a field row.
 */
function shown(item: Item): Record<string, string[]> {
  const out: Record<string, string[]> = {
    type: [item.type],
    title: [item.title],
    status: [item.status],
    severity: [item.severity],
    always: [String(item.always)],
    scope: item.scope,
    tags: item.tags,
    origin: [item.origin],
    sourceFile: item.sourceFile === null ? [] : [item.sourceFile],
    sourceAnchor: item.sourceAnchor === null ? [] : [item.sourceAnchor],
    sourceChecksum: item.sourceChecksum === null ? [] : [item.sourceChecksum],
    validFrom: item.validFrom === null ? [] : [item.validFrom],
    validUntil: item.validUntil === null ? [] : [item.validUntil],
    body: item.body === '' ? [] : item.body.split('\n'),
    // Structured sections are compared as rendered lines rather than by count:
    // "3 observations → 3 observations" is exactly the reassuring wrong reading
    // this confirm exists to prevent when one of them was rewritten.
    steps: item.steps.map((step) => JSON.stringify(step)),
    observations: item.observations.map((entry) => JSON.stringify(entry)),
    relations: item.relations.map((entry) => JSON.stringify(entry)),
  };
  // Category-specific fields — `kind`, `directive`, `plan`, `seq`, `state`,
  // `priority` — carried flat so a task's `state: todo → done` is one row.
  for (const [name, value] of Object.entries(item.extra)) out[name] = [value];
  return out;
}

/** Parse one item file, or refuse — a file this cannot read is not a silent skip. */
function readItem(text: string, rel: string): Item {
  try {
    return parseItem(text, rel, 'project');
  } catch (error) {
    throw new EffectRefusal(`${rel} could not be parsed, so its change cannot be shown: ${String(error)}`);
  }
}

/** The fields that differ between two versions of one item file. */
function fieldsBetween(before: Item | null, after: Item | null): FieldEffect[] {
  const a = before === null ? {} : shown(before);
  const b = after === null ? {} : shown(after);
  const out: FieldEffect[] = [];
  for (const field of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    if (NOT_SHOWN.has(field)) continue;
    const one = a[field] ?? [];
    const two = b[field] ?? [];
    if (one.join('\n') === two.join('\n')) continue;
    out.push({
      field,
      before: before === null ? null : one,
      after: after === null ? null : two,
    });
  }
  return out;
}

/** Compare two snapshots into the per-item effect the confirm renders. */
export function effectBetween(
  before: Map<string, string>,
  after: Map<string, string>,
): ItemEffect[] {
  const out: ItemEffect[] = [];
  for (const rel of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const oneText = before.get(rel) ?? null;
    const twoText = after.get(rel) ?? null;
    if (oneText === twoText) continue;
    const kind = oneText === null ? 'created' : twoText === null ? 'removed' : 'changed';
    const one = oneText === null ? null : readItem(oneText, rel);
    const two = twoText === null ? null : readItem(twoText, rel);
    const fields = fieldsBetween(one, two);
    // The file's bytes differ and no shown field does. That is a real state —
    // a reordered frontmatter key, a whitespace change — and reporting it as an
    // empty row list would be the empty diff this module exists to refuse, so
    // it says what it knows instead.
    if (fields.length === 0) {
      fields.push({
        field: 'file',
        before: ['(no shown field differs)'],
        after: ['(the file was rewritten)'],
      });
    }
    out.push({ id: (two ?? one)?.id ?? rel, kind, fields });
  }
  return out;
}

/**
 * What the scratch copy needs, which is less than the corpus contains.
 *
 * **Reported by the owner 2026-08-27, from a live confirm:**
 *
 *     the corpus could not be copied: Error: EDOM, The process cannot access
 *     the file because another process has locked a portion of the file
 *
 * `.index.db` is a SQLite database, and the running UI server holds it open.
 * On Windows that is a mandatory lock, so `cpSync` cannot read it and the whole
 * confirm was refused — a boundary command became un-runnable for as long as a
 * server was up, which is always. It did not appear in testing because a copy
 * only fails while the lock is actually held.
 *
 * Skipping it is not a workaround. `INV-markdown-is-the-source-of-truth` says
 * the index is DISPOSABLE — "delete the index, it rebuilds" is the documented
 * recovery — so the markdown alone is the corpus, and the child rebuilds what
 * it needs in its own copy. The sidecars go with it: a `-wal` or `-shm` without
 * its database is worse than neither.
 *
 * `.audit` goes too, for a different reason. It is an append-only log that this
 * run's writes are discarded with, so copying it is pure cost — and on a corpus
 * with thousands of rows it is the largest thing here. The real execution's
 * audit rows are written by `execute.ts` against the REAL log and are unaffected.
 */
export function worthCopying(source: string): boolean {
  const name = path.basename(source);
  if (name === '.audit') return false;
  return !name.startsWith('.index.db');
}

/**
 * The copy, as a seam.
 *
 * Not for convenience: `worthCopying` can be tested directly, and a test that
 * only does that PASSES when somebody deletes `filter: worthCopying` from the
 * call below — the filter would be correct and unused, and the owner's EDOM
 * would come straight back. This seam is what lets a test assert the filter is
 * WIRED, which is the property that actually failed.
 */
export type CopyTree = (
  from: string,
  to: string,
  options: { recursive: true; dereference: true; filter: (source: string) => boolean },
) => void;

const copyTree: CopyTree = (from, to, options) => { cpSync(from, to, options); };

/** The seam, so the timeout and failure paths are testable without a real child. */
export type RunChild = (
  file: string,
  args: readonly string[],
  options: { cwd: string; timeout: number; env: NodeJS.ProcessEnv },
) => void;

/**
 * The child's own words are kept and re-thrown.
 *
 * `stdio: 'ignore'` was the first shape here, and it produced a refusal reading
 * "the command did not complete against a copy" with nothing after it — true,
 * useless, and identical whether the argument was wrong or the corpus was
 * broken. The CLI already explains itself well, and substituting a generic
 * sentence makes the product less helpful than its own parts.
 *
 * **Both streams are captured, and stdout is where the answer usually is.**
 * Measured 2026-08-27: `refresh` on an item that holds no snapshot exits 1 and
 * writes its whole explanation — "records no source file, so there is nothing
 * to re-read" — to STDOUT, leaving stderr empty. This CLI reports refusals on
 * stdout with a `my_context:` prefix, so reading only stderr discards exactly
 * the sentence the reader needs. stderr is still preferred when it has
 * something, because a crash lands there.
 */
const spawnChild: RunChild = (file, args, options) => {
  try {
    execFileSync(file, [...args], {
      cwd: options.cwd,
      timeout: options.timeout,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const streams = error as { stderr?: Buffer | string; stdout?: Buffer | string };
    const err = withoutRuntimeNoise(String(streams.stderr ?? ''));
    const out = withoutRuntimeNoise(String(streams.stdout ?? ''));
    const said = err !== '' ? err : out;
    throw new Error(said === '' ? `the command exited without explaining why: ${String(error)}` : said);
  }
};

/**
 * Node's own warnings, dropped before either stream is read as an answer.
 *
 * Measured 2026-08-27, and it is the reassuring-wrong-reading shape again:
 * stderr was NOT empty — it carried "ExperimentalWarning: SQLite is an
 * experimental feature" — so preferring stderr surfaced a note about the
 * runtime as though it were the command's explanation, and buried the real
 * sentence sitting on stdout. Filtering rather than switching the preference,
 * because stderr IS the right place to look when something genuinely crashes;
 * what is wrong is treating a warning about the interpreter as the command
 * speaking.
 */
function withoutRuntimeNoise(text: string): string {
  return text
    .split('\n')
    .filter((line) => !/^\(node:\d+\)/.test(line) && !line.startsWith('(Use `node --trace-warnings'))
    .join('\n')
    .trim();
}

/**
 * Run `argv` against a throwaway copy of the corpus and report what it changed.
 *
 * `corpusDir` is the `.my_context` DIRECTORY — `Workspace.projectRoot` is that
 * directory and not the repository above it, which is the trap that made every
 * configured handover report itself missing on 2026-08-27. `argv` excludes the
 * leading `mycontext`, matching what `resolveCommand` returns and what the
 * audit rows record.
 *
 * `repoRoot` is PASSED, not derived here, and that is the point: the real run
 * uses `ctx.repoRoot` (`execute.ts`, and `read-model.ts` builds it as
 * `path.dirname(root)`). Computing the same thing here independently would make
 * the confirm agree with the run by COINCIDENCE, and a confirm that shows the
 * effect of a command run somewhere else is the defect this whole route exists
 * to prevent. One value, handed to both.
 *
 * Throws `EffectRefusal` for anything that leaves the answer unknown.
 */
export function deriveEffect(
  corpusDir: string,
  repoRoot: string,
  cliEntry: string,
  argv: readonly string[],
  run: RunChild = spawnChild,
  copy: CopyTree = copyTree,
): ItemEffect[] {
  let scratch: string | null = null;
  try {
    scratch = mkdtempSync(path.join(tmpdir(), 'myctx-effect-'));
    const scratchCorpus = path.join(scratch, DIR_NAME);
    try {
      // **`dereference: true`, and without it this module writes to the REAL
      // corpus.** Found by review 2026-08-28 and reproduced immediately.
      //
      // `cpSync` defaults to `dereference: false`, which copies a symlink AS a
      // symlink. `src/core/rebuild.ts` documents that item files may be
      // symlinks, and `writeItem` `realpathSync`-resolves before renaming — so
      // it writes THROUGH one. The scratch therefore held a link pointing back
      // into the real corpus, and the dry run followed it out.
      //
      // Measured: with `items/rule/RULE-x.md` a symlink, deriving the effect of
      // `pin RULE-x` rewrote the real item. Not on "Run it" — on EXECUTE, the
      // click that only opens the dialog. The confirm then rendered a
      // normal-looking diff, because it read back through the same link, and
      // Cancel left the item pinned. No audit row: the dry run's `.audit` is
      // the scratch's and is deleted with it.
      //
      // The directory-resolution check below could never have caught this. It
      // asks where the corpus IS; this is a file inside a corpus that is
      // genuinely the copy, pointing out of it.
      copy(corpusDir, scratchCorpus, {
        recursive: true, dereference: true, filter: worthCopying,
      });
    } catch (error) {
      throw new EffectRefusal(`the corpus could not be copied: ${String(error)}`);
    }

    // **The safety check, made with the resolution rule itself.** The child
    // finds its workspace by walking up from `cwd`, so a scratch directory
    // sitting under a corpus would send it to the real one.
    // **The copy produced a corpus at all.** A `cpSync` that filtered
    // everything, or landed somewhere unexpected, would leave both snapshots
    // empty and every command would derive `[]` — which the confirm now renders
    // as "This changes nothing", a confident false statement rather than a
    // blank. An empty result must mean the command changed nothing, never that
    // there was nothing to change.
    if (markdownUnder(path.join(scratchCorpus, 'items')).length === 0) {
      throw new EffectRefusal(
        'the scratch copy holds no item files, so an empty effect could not be distinguished '
        + 'from a copy that did not happen',
      );
    }

    // **No symlink survived the copy**, or a write may leave the scratch — see
    // `symlinksUnder`. This replaced a check that compared
    // `findProjectRoot(repoRoot, scratchCorpus)` to `scratchCorpus`, which with
    // a non-empty override is a value compared to itself and could not fail.
    const escapes = symlinksUnder(scratchCorpus);
    if (escapes.length > 0) {
      throw new EffectRefusal(
        `${escapes.length} symlink(s) survived the copy (${escapes[0]}), so a write to the `
        + 'scratch could reach the real corpus through one — which is exactly what happened '
        + 'before `dereference: true`',
      );
    }

    const before = snapshot(scratchCorpus);
    const beforeRest = elsewhereInCorpus(scratchCorpus);
    try {
      run(process.execPath, [cliEntry, ...argv], {
        // The REAL repository, so every repository-relative path the user typed
        // means what they typed. The corpus is redirected by the variable below
        // and by nothing else.
        cwd: repoRoot,
        timeout: EFFECT_TIMEOUT_MS,
        env: { ...process.env, [CORPUS_DIR_ENV]: scratchCorpus },
      });
    } catch (error) {
      // A non-zero exit is a real answer about the command rather than about
      // this module — and it means the write did not complete, so there is no
      // effect to show and §3.2 refuses the confirm rather than showing part of
      // one.
      throw new EffectRefusal(String(error instanceof Error ? error.message : error));
    }
    return [
      ...effectBetween(before, snapshot(scratchCorpus)),
      ...elsewhereEffect(beforeRest, elsewhereInCorpus(scratchCorpus)),
    ];
  } finally {
    if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  }
}
