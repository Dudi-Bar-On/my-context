/**
 * **The store: a directory of entries, loaded and filtered by tier.**
 *
 * D41 spec §7. A separate directory inside the package, with its own loader —
 * NOT a category in the corpus. The argument for that, spelled out there and
 * worth keeping beside the code that would be the first casualty of forgetting
 * it: *"if the corpus knows about it, then `list`, `ready`, `doctor`, the tier
 * budgets, decay, supersede and the injection selector each need an exception,
 * and every exception is a place to leak. A store the corpus has never heard
 * of needs no exceptions anywhere. `doctor` walks directories; it simply never
 * walks this one."*
 *
 * `test/rules/isolation.test.ts` is the tripwire on that, and it is written to
 * be the thing that goes red the day a later phase wires this module into a
 * corpus surface by accident.
 *
 * **This module performs no write.** Reads only — `readdirSync`/`readFileSync`
 * and nothing else. The manifest is the one thing in `src/rules/` that writes,
 * and it lives in its own module so that "does the store write here" is
 * answerable by reading an import list.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEntry, type Entry, type EntryError } from './schema.ts';

/**
 * The shipped store, resolved from THIS FILE rather than from the workspace.
 *
 * The rules ship inside the package (spec §13), so their location is a fact
 * about the installation and never about where the user is standing. Deriving
 * it from `process.cwd()` would make `mycontext rules verify` answer about a
 * directory that happens to exist beside the caller, which is the shape a
 * verification command must not have.
 */
export function entriesDir(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'entries');
}

/**
 * The root of the package this file ships in — `<pkg>/src/rules/store.ts`, so
 * three levels up.
 *
 * It answers exactly one question, spec §3's: is the workspace being worked on
 * my_context itself, and therefore are the `developer` entries in force. Asked
 * by comparing paths rather than by looking for a marker file in the
 * workspace, because a marker is something a stranger's project acquires by
 * copying a file, and what hangs on the answer is whether rules about how THIS
 * repository works are law somewhere else.
 */
export function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export interface RuleSet {
  /** Every entry that loaded AND applies, sorted by id. */
  entries: Entry[];
  /**
   * Every file that did not load, with the reason and the path.
   * `INV-nothing-is-dropped-silently`: a store that quietly skipped a damaged
   * entry would be a store whose rules are a subset nobody can name.
   */
  refused: EntryError[];
}

/**
 * Load `root`, keeping the entries that apply.
 *
 * `workspaceIsMyContext` is passed IN rather than computed here, and that is
 * deliberate: the caller knows where it is standing, and a loader that decided
 * for itself could not be tested against a foreign workspace without faking a
 * filesystem. `test/rules/store.test.ts` asserts the tier by loading twice
 * against the same directory — the only assertion that proves the FILTER
 * rather than proving the field was written.
 *
 * A REFUSAL IS NEVER TIER-FILTERED. A file too broken to load is a file whose
 * `tier` may be exactly what is unreadable, so filtering refusals by the tier
 * they claim would hide the worst-damaged entries from the workspace least
 * able to notice.
 */
export function loadRules(root: string, workspaceIsMyContext: boolean): RuleSet {
  let names: string[];
  try {
    if (!statSync(root).isDirectory()) throw new Error('not a directory');
    names = readdirSync(root).filter((name) => name.endsWith('.md')).sort();
  } catch {
    return {
      entries: [],
      refused: [{
        error: `no rule store at ${root}. The rules ship inside the package, so this means the ` +
          `installation is incomplete rather than that anything is misconfigured — ` +
          `\`mycontext rules verify --restore\` puts it back from the installed package.`,
        path: root,
      }],
    };
  }

  const entries: Entry[] = [];
  const refused: EntryError[] = [];
  const seen = new Map<string, string>();

  for (const name of names) {
    const file = path.join(root, name);
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch (err) {
      refused.push({ error: `unreadable: ${err instanceof Error ? err.message : String(err)}`, path: file });
      continue;
    }
    const parsed = parseEntry(text, file);
    if ('error' in parsed) {
      refused.push(parsed);
      continue;
    }
    // The duplicate message names both files deliberately — there the
    // repetition is the information (`STD-error-message-conventions`).
    const first = seen.get(parsed.id);
    if (first !== undefined) {
      refused.push({
        error: `duplicate id "${parsed.id}": ${path.basename(first)} and ${name} both claim it. ` +
          `An entry is cited by id, so two files answering to one id means a citation resolves ` +
          `to whichever was read first.`,
        path: file,
        id: parsed.id,
      });
      continue;
    }
    seen.set(parsed.id, file);
    if (parsed.tier === 'developer' && !workspaceIsMyContext) continue;
    entries.push(parsed);
  }

  entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { entries, refused };
}
