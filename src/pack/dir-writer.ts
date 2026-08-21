/**
 * `writeBundleDirectory` — the canonical rung, and the one place an artefact
 * path stops being a string and becomes a file.
 *
 * A plain directory in workspace shape is the format this product recommends:
 * it imports with `cp -r`, it diffs per item, it reviews in a pull request,
 * and it needs no code at all to read. The ZIP is a convenience over it, not
 * the other way round.
 *
 * ## What it does, in order, and why the order is the design
 *
 *   1. Refuse the whole path set. Nothing has been opened yet.
 *   2. Refuse the destination.
 *   3. Create the destination, then one file at a time.
 *
 * Step 1 is before step 2 deliberately. A bundle carrying an illegal path is
 * wrong wherever it is written, so it is refused without the filesystem being
 * consulted at all — which makes "nothing was written" the strongest sentence
 * available rather than a claim about ordering inside a loop: after that
 * refusal the destination has not been created, not been read, and not been
 * stat'ed. The test asserts exactly that, because it is the only version of
 * this promise a caller can check.
 *
 * ## Why the path check runs here at all, when `buildBundle` already ran it
 *
 * `bundle.ts` calls `refuseArtefactPaths` over the assembled set and attributes
 * the failure to the item that owns the offending path. That is a check on
 * ASSEMBLY. This is a different crossing, and it is not the plan's "defence in
 * depth" argument that makes it one — though that argument is also true, and
 * `zip.ts` is about to be the second caller of a `Bundle`:
 *
 * **This function is where containment is decided, and the refusal above IS
 * the containment check.** `path.join(target, ...p.split('/'))` cannot leave
 * `target` for exactly one reason: every segment reaching it is a plain
 * non-empty name with no separator, no `..`, no `.`, no colon and no drive
 * letter — because `refuseArtefactPath` refused all six. So this call is not a
 * duplicate of `buildBundle`'s; it is the precondition of the very next line,
 * and deleting it does not lose a redundant check, it loses containment.
 *
 * There is deliberately no second containment assertion after the join, and
 * the reason is not that such a check is wrong — the corpus prescribes one,
 * and `ui/static.ts` guard 1 implements exactly the prescribed shape:
 * containment on the RESOLVED absolute path, `root + path.sep`, never on the
 * spelling of a relative one, because
 * `KNOWN-repo-containment-guard-is-defeated-across-windows-drive` records a
 * `path.relative` guard sailing through for `C:\tmp\x` against `D:\repo`. That
 * guard belongs where a path arrives with no prior grammar, which is what an
 * HTTP request is. Here the grammar has already run, so a post-join check
 * would have no input that could reach it: an unreachable branch, permanently
 * SURVIVING every mutation run, of the kind `layout.ts` deleted a clause to
 * avoid. If the allow-list is ever widened so that such a check could fire,
 * the widening is the defect and this comment is where to start.
 *
 * A `Bundle` is a structural value with no unforgeable field. `readArtefact`
 * (Task 8) parses a stranger's directory into one shape and a re-export writes
 * it back out through this function; that path is the whole reason the
 * refusal cannot live only in the builder.
 *
 * ## `history.jsonl` present-and-empty is not the same as absent
 *
 * `buildBundle` omits the file entirely for `history: false` and emits a
 * zero-byte one for `history: true` with nothing to say. Those are different
 * artefacts — "history was withheld" against "history travelled and there was
 * none" — and a receiver can tell them apart only if the writer creates the
 * empty file. So every entry in `files` is written, and a zero-length body is
 * not a reason to skip one. There is no `if (bytes.length)` below, and that
 * absence is the feature.
 *
 * ## Determinism, which here means "adds nothing"
 *
 * `renderManifest` writes its own object literal so an artefact's bytes do not
 * depend on how the value was assembled. The obligation this writer inherits
 * is narrower but absolute: it copies `bytes` verbatim. No encoding, no
 * newline translation, no BOM, no trailing byte, no mode. `writeFileSync` with
 * a `Buffer` is the whole of it — the moment a string went through here, the
 * platform's line endings would become part of the format.
 *
 * A directory has no container bytes to pin, so there is nothing else to make
 * deterministic: no order field, no timestamp, no header. That is what makes
 * this the canonical rung and the ZIP the one with a determinism section.
 *
 * ## What this writer deliberately does NOT check, and where the line is
 *
 * It refuses what WRITING can get wrong — a path that would land outside the
 * destination or collide with another, a destination that already holds
 * something. It does not restate what ASSEMBLY decides: which files there are,
 * whether `manifest.json` is among them, whether the manifest agrees with the
 * bytes beside it. A bundle with no manifest is not a hazard of writing; it is
 * an artefact `readArtefact` refuses with a better sentence than any this
 * function could invent, and a copy of that rule here would be a second
 * spelling to drift.
 *
 * It also never deletes. If a write fails half-way — a full disk, a revoked
 * permission — the partial tree is left exactly where it is. An exporter that
 * removed a directory on its way out is a worse failure than a partial export
 * the emptiness rule will name on the next attempt, and it is one nobody can
 * undo.
 *
 * ## Where a hostile pack NAME reaches a filesystem, since it is not here
 *
 * Nothing in this module reads `bundle.manifest`. `outDir` is the user's own
 * `--out`, and a pack's `name` travels inside `manifest.json`'s bytes, never
 * as a path segment. The site where an author-supplied name does become a
 * directory is the IMPORTER's `.audit/imported/<pack>/` (Task 11), and
 * `manifest.ts` says so in its own comment. That is where the Unicode screen
 * and the name-to-path rules belong; screening here would screen the half of
 * the traffic this module produces and miss the half that arrives.
 */
import { lstatSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { retryOnTransientFsError } from '../core/rebuild.ts';
import { refuseArtefactPaths, type ExportFile } from './layout.ts';

/**
 * The part of a `Bundle` a writer reads, which is `files` and nothing else.
 *
 * Declared structurally rather than as `Bundle` so this module does not import
 * `bundle.ts` for a type it never uses a field of — every `Bundle` satisfies
 * it, and the narrower parameter is itself the statement that the manifest and
 * the report are not this function's business. `readonly` because a writer
 * that reordered or appended to its caller's array would be deciding something
 * `comparePaths` already decided once.
 */
export type WritableBundle = { files: readonly ExportFile[] };

/**
 * How many held entries a refusal names before it stops counting. Enough to
 * recognise the directory ("ah, that is my source tree") and few enough that
 * the sentence stays one sentence.
 */
const NAMED_ENTRIES = 5;

/**
 * A set-level refusal from `layout.ts`, re-voiced as a refusal of this WRITE.
 *
 * `bundle.ts` attributes the same refusal to the item that owns the path,
 * because it has the items. This one has a bundle and a destination, so it
 * says the thing only it knows: the destination was never opened. That is not
 * decoration — it is the claim the caller needs in order to know whether to
 * clean anything up.
 */
function refuseFileSet(refusal: string): Error {
  return new Error(
    `my_context: this artefact cannot be written as a directory: `
    + `${refusal.replace(/^my_context:\s*/, '')} Nothing was written — the destination was `
    + 'not created, read or opened, because a path set this shape is refused wherever it '
    + 'would be written.',
  );
}

/**
 * The resolved destination, or a refusal naming what is in the way.
 *
 * **`outDir` must not exist, or must exist and be empty.** An export never
 * merges into a directory that already holds something, because "which of
 * these files did I just write" is not a question a user should have to
 * answer — and because the answer decides whether they can hand the directory
 * to someone else. A dot-prefixed entry counts: `readdirSync` reports it,
 * `cp -r` copies it, and a rule that ignored it would let an artefact travel
 * with a `.git` inside it.
 *
 * **A destination that exists and is not a directory is named as itself.**
 * `--out ../packs/acme.zip` with `--format dir` is the typo this catches, and
 * `ENOTDIR` from inside `readdirSync` names a system call rather than a
 * mistake.
 *
 * **A symlink is followed, not refused.** `statSync` resolves it, so a
 * destination that is a link to an empty directory is accepted and one that
 * links to a file is refused as a non-directory. Refusing links outright was
 * considered and rejected for a Windows reason: Node reports a directory
 * JUNCTION as a symbolic link, and junctions are how a directory gets moved
 * off a full volume on Windows, so the rule would refuse ordinary
 * destinations.
 *
 * **A link whose target is gone is named, because `statSync` cannot tell it
 * from an absent path.** Both are `undefined` here, and the two need different
 * sentences: an absent path is created, while a dangling link fails
 * `mkdirSync` with `ENOENT` — measured on this platform, where the link is
 * plainly visible in a directory listing and "no such file or directory" reads
 * as a lie. One `lstatSync`, paid only when the destination looks absent,
 * separates them.
 */
function refuseDestination(outDir: string): string {
  if (outDir === '') {
    throw new Error(
      'my_context: this export names no destination — the output path is the empty string. '
      + 'It is refused rather than resolved, because an empty path resolves to the current '
      + 'working directory, and an artefact written into whatever directory the command '
      + 'happened to be run from is the one destination nobody chose. Nothing was written.',
    );
  }

  const target = path.resolve(outDir);
  const existing = statSync(target, { throwIfNoEntry: false });
  if (existing === undefined) {
    if (lstatSync(target, { throwIfNoEntry: false }) === undefined) return target;
    throw new Error(
      `my_context: the export destination ${JSON.stringify(target)} is a link whose target does `
      + 'not exist. It is refused here rather than left to fail, because creating it reports '
      + '"no such file or directory" about a name that is plainly there in a listing, and '
      + 'following it would write the artefact to a path this one only points at. Repoint the '
      + 'link, remove it, or choose another destination. Nothing was written.',
    );
  }

  if (!existing.isDirectory()) {
    throw new Error(
      `my_context: the export destination ${JSON.stringify(target)} already exists and is not a `
      + 'directory. A directory artefact is a tree of files, so there is nothing this could '
      + 'mean — and overwriting the file that is there would destroy it. Choose a path that '
      + 'does not exist, or an empty directory. Nothing was written.',
    );
  }

  const held = readdirSync(target);
  if (held.length > 0) {
    const named = held.slice(0, NAMED_ENTRIES).map((n) => JSON.stringify(n)).join(', ');
    const rest = held.length > NAMED_ENTRIES ? `, and ${held.length - NAMED_ENTRIES} more` : '';
    throw new Error(
      `my_context: the export destination ${JSON.stringify(target)} already holds `
      + `${held.length} entr${held.length === 1 ? 'y' : 'ies'} (${named}${rest}). An export `
      + 'never merges into a directory that already holds something: afterwards "which of '
      + 'these files did I just write" is a question with no answer, and the artefact could '
      + 'not be handed on without asking it. Choose a path that does not exist, or an empty '
      + 'directory. Nothing was written.',
    );
  }
  return target;
}

/**
 * Write `bundle` as a directory at `outDir`, and return the absolute path of
 * every file written, in bundle order.
 *
 * The returned order is the array's, which `buildBundle` already sorted with
 * the one comparator; nothing is re-sorted here, because a second sort is a
 * second opinion about an order that is part of the format.
 *
 * Every filesystem call goes through `retryOnTransientFsError`, which retries
 * `EPERM`/`EACCES`/`EBUSY` and rethrows everything else unchanged. That is
 * what makes an export survive an anti-virus scanner or the Windows search
 * indexer holding a freshly-created file for a few milliseconds.
 *
 * **Two surviving mutants, kept deliberately and both the same one.**
 * Unwrapping either call — `retryOnTransientFsError(() => writeFileSync(…))`
 * to `writeFileSync(…)`, and the same for the `mkdirSync` beside it — SURVIVES
 * the battery, and it survives every battery that could be written. The two
 * spellings differ only when the operation fails with one of three codes, and
 * `core/rebuild.ts` records why that cannot be arranged: *"a genuine Windows
 * `EPERM` from a real competing file handle cannot be manufactured reliably in
 * a unit test on any platform"*. It cannot be arranged THROUGH THIS FUNCTION
 * either, and that is the sharper reason: the allow-list has already refused
 * every path that could make a write fail transiently, so the only failures
 * reachable here are permanent ones (`ENOSPC`, `EACCES` on a destination the
 * user cannot write, `EROFS`) which the wrapper passes through after its
 * budget. The behaviour is exercised directly, with a fake operation, in
 * `test/core/rebuild.test.ts`; what is unprovable here is only that this call
 * site uses it. Recorded rather than deleted, so the next mutation run does
 * not spend an hour deciding whether the survivors are holes.
 *
 * `mkdirSync(..., { recursive: true })` is called for each file's parent
 * rather than once for the set: the writer does not know which directories a
 * bundle needs without walking it, and `recursive: true` over a directory that
 * already exists is a no-op, so asking per file costs one already-satisfied
 * syscall and removes a second traversal that could disagree with the first.
 * It also creates the destination's own missing parents, so `--out
 * ../packs/acme` works without the user making `../packs` first.
 *
 * The destination's own `mkdirSync` before the loop looks redundant against
 * that — every root file's parent IS the destination — and it is not: a bundle
 * with no files would otherwise leave the destination uncreated, so a caller
 * that reported "wrote 0 files to `<out>`" would be naming a directory that is
 * not there. "Wrote nothing" and "wrote nowhere" are different outcomes and
 * this is the line that keeps them apart.
 */
export function writeBundleDirectory(bundle: WritableBundle, outDir: string): string[] {
  const bad = refuseArtefactPaths(bundle.files.map((f) => f.path));
  if (bad !== null) throw refuseFileSet(bad);

  const target = refuseDestination(outDir);
  retryOnTransientFsError(() => mkdirSync(target, { recursive: true }));

  const written: string[] = [];
  for (const file of bundle.files) {
    // Joined from POSIX segments with the platform separator, never by string
    // concatenation: `target + '/' + p` happens to open on Win32, which
    // accepts both separators, and then RETURNS a path with two spellings of
    // the separator in it — so the list this function hands back would not
    // compare equal to a path the caller built with `path.join`.
    const absolute = path.join(target, ...file.path.split('/'));
    retryOnTransientFsError(() => mkdirSync(path.dirname(absolute), { recursive: true }));
    retryOnTransientFsError(() => writeFileSync(absolute, file.bytes));
    written.push(absolute);
  }
  return written;
}
