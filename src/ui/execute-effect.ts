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
 * `findProjectRoot` takes no environment override — it walks UP from `cwd`
 * until it finds a `.my_context` directory. So the only lever is `cwd`, and the
 * failure mode is a scratch directory nested somewhere a corpus sits above:
 * the child would walk past the copy and write the real thing.
 *
 * So the scratch root is checked with `findProjectRoot` ITSELF — the same
 * function, in this process, before the child starts — and anything other than
 * the copy is a refusal. That checks the RESOLUTION rather than the path shape,
 * so it stays true if the resolution rule ever changes.
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
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseItem } from '../core/item.ts';
import type { Item } from '../core/types.ts';
import { DIR_NAME, findProjectRoot } from '../core/workspace.ts';

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
  options: { recursive: true; filter: (source: string) => boolean },
) => void;

const copyTree: CopyTree = (from, to, options) => { cpSync(from, to, options); };

/** The seam, so the timeout and failure paths are testable without a real child. */
export type RunChild = (
  file: string,
  args: readonly string[],
  options: { cwd: string; timeout: number },
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
 * Throws `EffectRefusal` for anything that leaves the answer unknown.
 */
export function deriveEffect(
  corpusDir: string,
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
      copy(corpusDir, scratchCorpus, { recursive: true, filter: worthCopying });
    } catch (error) {
      throw new EffectRefusal(`the corpus could not be copied: ${String(error)}`);
    }

    // **The safety check, made with the resolution rule itself.** The child
    // finds its workspace by walking up from `cwd`, so a scratch directory
    // sitting under a corpus would send it to the real one.
    const resolved = findProjectRoot(scratch);
    if (resolved === null || path.resolve(resolved) !== path.resolve(scratchCorpus)) {
      throw new EffectRefusal(
        `the scratch corpus resolves to ${String(resolved)} rather than to itself, so a dry `
        + 'run could reach a corpus that is not a copy',
      );
    }

    // **A repository-relative path cannot survive the copy, and a wrong answer
    // here is worse than no answer.**
    //
    // Reported by the owner 2026-08-27 from two live confirms. The child runs
    // with `cwd` inside the scratch, and `resolveWorkspace` derives BOTH the
    // corpus and every relative path from that one `cwd` — they are the same
    // lever. So `add --file docs/x.md` looked for `docs/x.md` under the scratch,
    // did not find it, and refused; and a path that WAS inside the real
    // repository was reported "outside this repository", naming a temp
    // directory as the repository. The command would have succeeded.
    //
    // That is a FALSE refusal, which is the one thing §3.2 must not produce: it
    // says "this cannot run" about a command that runs. Refusing here instead,
    // in words that name the real limit, keeps the confirm honest until the
    // corpus location and the path root can be set independently — which is a
    // change to `resolveWorkspace`, not to this file, and is the owner's call.
    //
    // `add --file` is the only catalogue command this reaches: it is the sole
    // path-bearing argument on a boundary command (`search --path` is below the
    // boundary and never dry-runs).
    const pathBearing = argv.indexOf('--file');
    if (pathBearing !== -1) {
      throw new EffectRefusal(
        'this command reads a file from your repository, and the effect is derived against a '
        + 'COPY of the corpus that does not contain your repository’s files — so the answer '
        + 'here would be wrong rather than merely missing. Copy the command and run it in your '
        + 'own shell, where the path means what you typed.',
      );
    }

    const before = snapshot(scratchCorpus);
    try {
      run(process.execPath, [cliEntry, ...argv], {
        cwd: scratch,
        timeout: EFFECT_TIMEOUT_MS,
      });
    } catch (error) {
      // A non-zero exit is a real answer about the command rather than about
      // this module — and it means the write did not complete, so there is no
      // effect to show and §3.2 refuses the confirm rather than showing part of
      // one.
      throw new EffectRefusal(String(error instanceof Error ? error.message : error));
    }
    return effectBetween(before, snapshot(scratchCorpus));
  } finally {
    if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  }
}
