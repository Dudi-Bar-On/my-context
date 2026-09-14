/**
 * **The four checks that read an item's own TEXT — its body, its title and the
 * citations inside them — rather than its metadata or the disk around it.**
 *
 * `citation_form`, `body_truncated`, `laundered_enum` and
 * `body_disagrees_with_meta` are one group because they share one subject and
 * one difficulty: prose. Each of them has to decide, from wording alone,
 * whether a human sentence still means what the item's fields say it means,
 * and each therefore carries a large private vocabulary of patterns —
 * `UNFINISHED_TAIL`, `BARE_POINTER`, `CLOSING_VERDICTS`, `HEDGES` — that is
 * meaningless to every other check and was, until this split, sitting in the
 * middle of a file thirty other checks had to scroll past.
 *
 * Split out of `checks.ts` by
 * `TASK-the-checks-file-splits-along-a-boundary-its-own-tests`, along the line
 * the tests had already drawn: `test/doctor/citation-form.test.ts`,
 * `test/doctor/body-truncation.test.ts`, `test/doctor/body-agreement.test.ts`
 * and `test/core/enum-read-boundary.test.ts` each own one of them.
 *
 * The rule these obey is stated once on `Finding` in `./finding.ts`.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Config } from '../core/config.ts';
import { droppedBodyText, launderedEnumSentence, launderedEnums } from '../core/item.ts';
import { governs } from '../core/select.ts';
import { checksum } from '../core/slug.ts';
import { updatesFor } from '../core/tag-projection.ts';
import type { Item } from '../core/types.ts';
import { ACK, NOTHING, type Finding } from './finding.ts';
import { listRepoFiles } from './repo-files.ts';

/**
 * `checkCliOnPath` deliberately is NOT one of the checks below, even though
 * it returns the same `Finding[]` shape every other one does — see its own
 * doc comment for the three-state, "resolves to something else is the worst
 * outcome" reasoning; this comment is only about why it is wired in
 * DIFFERENTLY from its dozen siblings.
 *
 * Every check below answers a question about the FILES in `root`/`repoRoot`
 * — the same corpus on every machine that clones it. `checkCliOnPath`
 * answers a question about THIS MACHINE'S PATH, which two clones of the
 * identical corpus can answer differently. Folding it into `findings` would
 * make `counts.warnings` — and the "N finding(s)" this project's own test
 * suite and its generated documentation assert is exactly the printed count
 * — depend on whether the box asking happens to have `npm link`ed this
 * package. That is precisely the silent, environment-dependent divergence
 * this check exists to catch; making the check ITSELF introduce it into
 * every existing "this fixture is clean" assertion would defeat it before
 * it shipped.
 *
 * `mycontext doctor` (`src/cli/commands/doctor.ts`) calls `checkCliOnPath`
 * directly, the same way it already calls `openMutateContext` for corpus
 * LOAD errors — a second category of thing this command reports and folds
 * into its exit code without folding into `findings`/`counts`, for the same
 * reason: a load error is not a property of the item that failed to load
 * either, it is a property of whether the file could be read at all. Every
 * OTHER caller of `runChecks` — `status`, and the UI's health widget in
 * `read-model.ts` — therefore never runs this check and never could, for
 * the same reason they never see corpus load errors flow through `findings`
 * either — that is `doctor`'s own reporting surface, not `runChecks`'s.
 */
/**
 * A body's last non-blank line, ending in a way that reads as cut off.
 *
 * Measured on this repository's own corpus before it was written: 655 of 656
 * non-empty bodies end with a full stop and the 656th with a `*`. Ending
 * mid-sentence, or on a colon whose list is not there, is therefore not a
 * style this corpus has — which is what makes it worth reporting at all, and
 * also exactly how little it proves. See `checkBodyTruncation`.
 */
export const UNFINISHED_TAIL = /(?::|[^.!?)\]"'*_|\u00bb\u201d\u2019\u2026])$/u;

/**
 * **Text an item's file holds that no future write will keep — and bodies that
 * read as though that already happened.**
 *
 * Two findings, and the difference between them is the whole point.
 *
 * `body_truncation` is EXACT. `droppedBodyText` (core/item.ts) partitions the
 * file the way `parseItem` does and reports what falls out: a `## ` section
 * that is not a field of an item, the earlier of two same-named sections, a
 * second `# ` line, a line inside `## Observations`/`## Relations` that the
 * section's grammar does not match. Every one of those is deleted, silently,
 * by the next command that writes the item — `renderItem` writes back what was
 * parsed, and what was parsed is missing them. Nothing reported this before,
 * which is how two task bodies in this corpus lost roughly two-thirds of
 * themselves (3,918 -> 1,272 bytes and 5,507 -> 1,535) in a commit that
 * hand-edited them and then ran `mycontext repair`. `repair` now refuses those
 * items (cli/commands/repair.ts); this is where they are reported before
 * anybody runs it.
 *
 * `body_ends_unfinished` is a HEURISTIC, and is `info` for that reason. Once a
 * truncation has been written back, the file is internally consistent and its
 * checksum agrees with the shortened content — the deleted text leaves no
 * trace whatsoever. The only residue is prose that stops in the middle, so
 * that is what this looks for, and the message says plainly that a truncation
 * which happened to land after a full stop is invisible to it. A check that
 * implied otherwise would be the same failure this whole pair exists to fix.
 *
 * PROJECT items only, exactly as `needsRestamp` (repair.ts) is: `item.filePath`
 * is relative to its own layer's root, and `root` here is the project's.
 *
 * COST, measured rather than assumed: this is the only check that reads every
 * item file, and it has to — the loss is a property of the FILE, and the
 * parsed item in memory is precisely the thing with the text already missing.
 * Reading this repository's own 661 item files takes 23-27ms, which `doctor`
 * and `status` can afford; a corpus large enough for that to matter is one
 * `checkCorpusSize` is already complaining about.
 */
/**
 * A `file.ts:123` pointer in an item body, with or without backticks around it
 * and with or without a `-129` / `,95` tail. The file part is captured so it
 * can be checked against the repository before anything is reported.
 */
export const BARE_POINTER = /`?([A-Za-z0-9_.\-/@]+\.(?:ts|js|mjs|cjs|md|json|html|css)):\d+(?:[-,]\d+)*`?/g;

/**
 * **A NECESSARY condition for `BARE_POINTER` above, read off that pattern
 * rather than guessed at — the cheap question asked before the expensive one.**
 *
 * `BARE_POINTER`'s path part is `[A-Za-z0-9_.\-/@]+`, a class that CONTAINS the
 * `.` the extension alternation needs next. So on a line of ordinary prose the
 * engine starts at every position, consumes the whole word run, and then
 * backtracks a character at a time hunting for `.ts:1`. That is quadratic in
 * the length of every word run, on all 16,589 body lines of this corpus, to
 * find 27 pointers: 22 ms of the check's own work, and it grows with the prose
 * rather than with the citations.
 *
 * This pattern is the same requirement with the unbounded quantifier removed —
 * a literal dot, the SAME extension alternation copied from the line above,
 * a colon and one digit. Every one of those characters is required by
 * `BARE_POINTER` at a fixed offset from its own match, so a line this rejects
 * cannot contain a `BARE_POINTER` match; a line it accepts is scanned exactly
 * as before and decided exactly as before. It is a filter on WHERE the
 * expensive scan runs, never on what the scan concludes.
 *
 * Not `g`, and no capture: it is asked once per line as a yes/no, so it carries
 * no `lastIndex` to reset and cannot be left mid-scan by an early `continue`.
 *
 * The two patterns must stay in step, which is why they sit adjacent: an
 * extension added to `BARE_POINTER` and not to this one would silently stop
 * reporting that extension. That is the one drift risk this buys the speed
 * with, and it is stated here rather than left to be discovered.
 */
export const POINTER_PREFILTER = /\.(?:ts|js|mjs|cjs|md|json|html|css):\d/;

/**
 * **The `historical-citation` marker, which this project already ships and
 * `scripts/verify-citations.ts` already honours. Copied, not invented.**
 *
 * The spelling is NOT written out here, and that is the same refusal
 * `checkCitationForm`'s own message makes one screen down about the citation
 * form: a real marker written into this file would be read as one by the gate
 * that walks `src/`, and a marker that excuses nothing is a fault there — so a
 * specimen printed here would manufacture the defect it describes. The two
 * regexes below ARE the spelling, exactly; `scripts/verify-citations.ts` writes
 * it out properly in its own header, where it is exempt for this reason.
 *
 * Three items in this corpus hold sixteen bare pointers that must never be
 * converted, because the sentence they sit in is ABOUT the pointer: a stale
 * citation quoted so it can be named as stale, a measured count of what the
 * corpus contained, a doctor message reproduced verbatim. Converting one of
 * those to the fragment form does not repair a citation — it falsifies a
 * quotation. Left alone they fire `citation_form` forever, and a finding
 * nobody can ever clear is the shape `state_unaudited` was just narrowed to
 * stop producing: noise wearing work's clothes.
 *
 * **`acknowledge` is the wrong SHAPE here, not the wrong strength.** An `ack`
 * records only *a person read this*, and it anchors on the content hash — so
 * every future edit to the item lapses it and reopens sixteen findings the
 * next reader has to re-derive as fine. The claim actually being made is
 * different and durable: *this pointer is a quotation, not a citation.* That
 * is a claim about the text, so it belongs IN the text, on the line it governs.
 *
 * **The same marker, deliberately, and not a second spelling of it.** The
 * escape `verify-citations.ts` grants a plan is the escape this check grants an
 * item, word for word: one vocabulary, a claim a person signs with a stated
 * reason, scoped to the line it sits on and nothing wider. A reader who has
 * learned the marker in a plan does not learn it twice, and a second noun would
 * be a second thing to get subtly wrong. Its docblock argues the line scope out
 * in full and every word of it holds here: a section- or item-level fence grows
 * its blast radius in silence and can never go stale, where a line-scoped one
 * has to keep earning itself.
 *
 * **TWO regexes rather than one, and that is the point of them** — the same
 * two, for the same reason. `OPEN` finds anything that was TRYING to be a
 * marker; `FULL` decides whether it managed it. A single strict pattern would
 * let a marker whose keyword is pluralised, or whose reason is missing, or
 * whose close ran onto the next line, fall
 * through as "no marker here" — leaving the author staring at a pointer they
 * believe they excused and a check that never mentions the thing they wrote.
 * Without this half the mechanism decays into a blanket suppressor, which is
 * exactly what `SOURCE_EXEMPT` refuses to become over in the script.
 */
export const MARKER_OPEN = /<!--[ \t]*historical-citation/g;
export const MARKER_FULL = /^<!--[ \t]*historical-citation[ \t]*:[ \t]*(\S.*?)[ \t]*-->/;

/** One body line's markers: the reason it excuses by, and what it got wrong. */
export interface MarkerRead {
  /** The reason of the ONE honoured marker on this line, or `null` if none. */
  reason: string | null;
  /** The line with every honoured marker removed, so rule 1 cannot be gamed. */
  stripped: string;
  /** Why each marker on this line is not doing the job markers exist to do. */
  faults: string[];
}

/**
 * Every attempt at the marker on one body line, sorted into the one this check
 * will honour and the ones it refuses to.
 *
 * A SECOND marker on a line is a fault rather than a redundancy — one marker
 * already covers the whole line, so a second can only mean its author thought
 * markers attach to individual pointers, and someone who believes that will
 * eventually leave one attached to nothing.
 *
 * A malformed marker is reported AND leaves the pointers on its line judged as
 * normal: a mangled marker fails twice rather than swallowing once.
 */
export function readMarkers(line: string): MarkerRead {
  // `MARKER_OPEN` opens on the literal `<!--`, so a line without one cannot
  // hold a marker, honoured or malformed — the answer below would be this
  // exact object. Asked with `indexOf` rather than by running the pattern
  // because 16,581 of this corpus's 16,589 body lines are that case, and the
  // one thing a scan must never cost is the lines it has nothing to say about.
  if (!line.includes('<!--')) return { reason: null, stripped: line, faults: [] };
  MARKER_OPEN.lastIndex = 0;
  let reason: string | null = null;
  let stripped = line;
  const faults: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = MARKER_OPEN.exec(line)) !== null) {
    const full = MARKER_FULL.exec(line.slice(m.index));
    if (full === null) {
      // `MARKER_OPEN` has already advanced `lastIndex` past its own match, so
      // the loop makes progress without touching it here.
      faults.push(
        'malformed — an HTML comment opening on the `historical-citation` keyword, spelled ' +
        'exactly, then a colon, then a reason, then the comment closed on the same line',
      );
      continue;
    }
    MARKER_OPEN.lastIndex = m.index + full[0]!.length;
    if (reason === null) {
      reason = full[1]!;
      stripped = stripped.replace(full[0]!, '');
      continue;
    }
    faults.push('a second marker on one line — one marker already covers every pointer on the line');
  }
  return { reason, stripped, faults };
}

/**
 * **A line number is not a citation, and this is the only place that says so
 * where the writing happens.**
 *
 * `scripts/verify-citations.ts` resolves citations BY FRAGMENT — a verbatim
 * quotation of the cited text, which survives a refactor moving it and fails
 * loudly when the text is rewritten. Its docblock records why it will never
 * learn `file:line` instead: a bare line number carries no fragment, so the
 * check can only prove the line EXISTS. Measured over this corpus on
 * 2026-08-29 that proved the line existed for 161 of 165 pointers while
 * proving nothing about what any of them said.
 *
 * That is why the gate does not walk `.my_context/`: **it walks what it can
 * resolve by fragment**, and a tree whose citations carry no fragment is out of
 * scope until they do. Normalising the corpus once would not keep it — agents
 * and the owner write `file:line` constantly, and the count comes back. So the
 * form is stated in the corpus (a `standard`, which is injected and therefore
 * read before the writing) and counted here, which is where a claim that the
 * writing changed can be checked instead of believed.
 *
 * **`info`, deliberately.** A bare pointer is not a defect in the project; it
 * is a citation that cannot be checked. It costs nothing until someone follows
 * it, so it is a note that stays visible and countable until the corpus is
 * converted, rather than a warning that makes `doctor` look broken over
 * prose.
 *
 * **One finding per ITEM, not per pointer**, and the file part must name a
 * file this repository actually has. Both are for the same reason: the fault
 * being reported is "this item's citations are unresolvable", which is one
 * fact per item — and a pointer whose file does not exist here is far more
 * often an EXAMPLE of the form (`file.ts:123`, written to describe it) than a
 * citation of anything. Reporting the example as the fault it documents is how
 * a check earns itself a permanent finding nobody can clear.
 *
 * **AN ITEM MAY DECLARE A SPAN EXEMPT, and the count is drawn rather than
 * hidden.** See `MARKER_OPEN` above for the marker, why it is the one
 * `verify-citations.ts` already honours rather than a second spelling, and why
 * `acknowledge` is the wrong shape for the claim. Three rules keep it from
 * becoming a suppressor, and they are the script's three rules:
 *
 *   1. **It must excuse something.** A marker on a line carrying no bare
 *      pointer this check would have reported is itself a fault. It cannot be
 *      pre-armed against a pointer somebody might write later, and one left
 *      behind after the pointer is converted turns red rather than sitting
 *      there ready to hide the next one underneath itself. The line is read
 *      with the marker's own text REMOVED first, so a pointer written inside a
 *      reason cannot be the thing the marker claims to excuse.
 *   2. **It must be well formed.** Missing reason, missing colon, misspelled
 *      or unterminated is reported AND leaves the pointers on its line judged
 *      as normal — a mangled marker fails twice rather than swallowing once.
 *   3. **It excuses only what this check would otherwise REPORT** — a pointer
 *      whose file this repository has. A pointer naming no file here is already
 *      read as an example of the form and needs no excuse, so a marker cannot
 *      borrow one to satisfy rule 1.
 *
 * **The excused count is a DISCLOSURE and never a finding**, emitted once under
 * `citation_form_excused` with `remedy: none/nothing` and naming no item —
 * `state_audit_coverage`'s shape exactly. An excused span is not UNMEASURED:
 * it was measured and then RULED, in writing, by the person who wrote the
 * reason, so there is nothing left for a reader to do and nothing to
 * acknowledge. But it must still be counted where a person reads it, because
 * an exemption that leaves no trace is precisely the silent drop
 * `INV-nothing-is-dropped-silently` forbids, and a measured number is drawn
 * and named (`STD-a-measured-zero-is-drawn-and-named`). Zero excused spans
 * stay silent, which is doctor's own convention rather than a departure from
 * that standard — no per-check green is printed here for a reader to misread.
 *
 * **A marker fault IS a finding, at `warn`**, one row per item listing every
 * broken marker in it by body line. It is louder than the `info` it failed to
 * excuse on purpose: a marker that is not working is the only thing standing
 * between this exception and a blanket suppressor, and it is repairable by
 * hand in the body — which is exactly the question `ack` exists to let a person
 * answer if they disagree.
 */
export function checkCitationForm(repoRoot: string, items: Item[]): Finding[] {
  const findings: Finding[] = [];
  const known = new Set<string>();
  for (const rel of listRepoFiles(repoRoot)) {
    known.add(rel);
    known.add(rel.slice(rel.lastIndexOf('/') + 1));
  }
  let excusedSpans = 0;
  let excusedItems = 0;
  for (const item of items) {
    if (item.layer !== 'project') continue;
    const found: string[] = [];
    const markerFaults: string[] = [];
    let excusedHere = 0;
    // Line at a time, because one line is the marker's entire scope. Nothing
    // here joins or wraps: an item body is Markdown, and a pointer and the
    // marker that excuses it could always have been written on one line.
    const lines = item.body.split('\n');
    for (let n = 0; n < lines.length; n++) {
      const { reason, stripped, faults } = readMarkers(lines[n]!);
      for (const why of faults) markerFaults.push(`body line ${n + 1}: ${why}`);
      const here: string[] = [];
      // Hoisted out of the `exec` call it used to sit inside: `reason` and
      // `stripped` are both fixed for this line, so the ternary was being
      // re-decided on every iteration of a loop it could not affect.
      const subject = reason === null ? lines[n]! : stripped;
      // `POINTER_PREFILTER` is a NECESSARY condition for `BARE_POINTER` (see
      // its docblock): a line it rejects cannot hold a match, so skipping the
      // scan leaves `here` empty — which is exactly what the scan would have
      // left it. The line is still read for markers above and still judged by
      // every rule below, including rule 1's "excuses nothing" fault, which
      // depends on `here` being empty rather than on the scan having run.
      if (POINTER_PREFILTER.test(subject)) {
        BARE_POINTER.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = BARE_POINTER.exec(subject)) !== null) {
          const cited = m[1]!;
          if (!known.has(cited) && !known.has(cited.slice(cited.lastIndexOf('/') + 1))) continue;
          here.push(m[0].replace(/`/g, ''));
        }
      }
      if (reason === null) {
        found.push(...here);
        continue;
      }
      if (here.length === 0) {
        markerFaults.push(
          `body line ${n + 1}: excuses nothing — this line carries no bare pointer this check ` +
          'would have reported, so the marker is either pre-armed against one nobody has ' +
          'written, or left behind after the pointer it excused was converted',
        );
        continue;
      }
      excusedHere += here.length;
    }
    if (excusedHere > 0) {
      excusedSpans += excusedHere;
      excusedItems++;
    }
    if (markerFaults.length > 0) {
      findings.push({
        level: 'warn', code: 'citation_marker', item: item.id,
        remedy: ACK,
        message:
          `${markerFaults.length} \`historical-citation\` marker(s) in this body are not doing ` +
          `the job the marker exists to do — ${markerFaults.join('; ')}. The marker says a ` +
          `pointer on its line is a QUOTATION rather than a citation, so \`citation_form\` must ` +
          `not count it; a marker that is malformed, doubled, or excusing nothing is reported ` +
          `here rather than silently obeyed, because a marker obeyed without being read is a ` +
          `blanket suppressor with extra steps. The pointers on a malformed marker's line are ` +
          `judged as normal in the same run, so a mangled marker fails twice rather than ` +
          `swallowing once. Write it on the line the pointer sits on, with a reason that says ` +
          `why THIS pointer is a quotation, or delete it. (The spelling is not printed here for ` +
          `the reason \`citation_form\` does not print the citation form: a real marker in this ` +
          `string would be read as one where this message is written. ` +
          `\`scripts/verify-citations.ts\` writes it out properly in its header, and honours the ` +
          `identical marker under the identical rules in plans and specs.)`,
      });
    }
    if (found.length === 0) continue;
    const shown = found.slice(0, 3).join(', ');
    findings.push({
      level: 'info', code: 'citation_form', item: item.id,
      remedy: ACK,
      message:
        `${found.length} citation(s) point by line number and carry no fragment — ${shown}` +
        `${found.length > 3 ? ', …' : ''}. A line number proves only that the line exists; it ` +
        `cannot say whether the code it named is still there, and a plausible wrong number ` +
        `sends a reader somewhere real. Write the form \`verify:citations\` resolves instead: ` +
        `the cited file in backticks, then a middle dot, then a VERBATIM fragment of the cited ` +
        `text in backticks, then optionally a middle dot and a ~line hint. (It is not spelled ` +
        `out here: a real citation in this string would be read as one, and a mangled example ` +
        `is exactly what the gate exists to catch. \`scripts/verify-citations.ts\` opens with ` +
        `the form written properly.) The fragment is the identity and ` +
        `the ~line is a convenience allowed to be stale. Anchor on a KEY or an identifier, ` +
        `never on user-facing copy. Where the fragment itself contains backticks, use a ` +
        `double-backtick span, or the span ends early and the rest of the citation is read as ` +
        `prose. If the cited code is gone, say so — do not repoint to something plausible.`,
    });
  }
  // One line, whatever the number, naming no item and asking for nothing —
  // `state_audit_coverage`'s shape. This is not an unmeasured set: every span
  // counted here was measured and then RULED, in writing, on the line it sits
  // on. What the line exists to prevent is the other failure — an exemption
  // that leaves no trace, which is the silent drop the invariant forbids.
  if (excusedSpans > 0) {
    findings.push({
      level: 'info', code: 'citation_form_excused',
      // A note about `citation_form`'s own reach, not a row of work — so it
      // prints under its own heading and is not counted among the things a
      // reader has to do. See `Finding.about`.
      about: 'citation_form',
      remedy: NOTHING,
      message:
        `${excusedSpans} bare pointer(s) across ${excusedItems} item(s) are excused as SPECIMENS ` +
        `and are not counted above: each sits on a line carrying a \`historical-citation\` ` +
        `marker, which says the sentence is ABOUT the pointer — a ` +
        `stale citation quoted so it can be named as stale, a measured count of what the corpus ` +
        `held, a doctor message reproduced verbatim. Converting one of those to the fragment ` +
        `form would not repair a citation; it would falsify a quotation. Nothing is owed on this ` +
        `line: the ruling is already made, in writing, by the person who wrote the reason, and ` +
        `each marker governs one line and no more. It is drawn rather than left silent because ` +
        `an exemption that leaves no trace is the silent drop ` +
        `\`INV-nothing-is-dropped-silently\` forbids, and because a measured number is drawn and ` +
        `named. The reasons are in the item bodies beside the pointers they excuse; a marker ` +
        `that is malformed, doubled or excusing nothing is reported as \`citation_marker\` ` +
        `instead of being obeyed.`,
    });
  }
  return findings;
}

export function checkBodyTruncation(root: string, items: Item[]): Finding[] {
  const findings: Finding[] = [];
  for (const item of items) {
    if (item.layer !== 'project') continue;

    let text: string | null = null;
    try {
      text = readFileSync(path.join(root, ...item.filePath.split('/')), 'utf8');
    } catch {
      // Unreadable is `loadLayer`'s report to make, not this check's.
      text = null;
    }
    const loss = text === null ? null : droppedBodyText(text);
    if (loss !== null) {
      findings.push({
        level: 'error', code: 'body_truncation', item: item.id,
        remedy: ACK,
        message:
          `${item.filePath} holds ${loss.lines} line(s) (${loss.bytes} bytes) that are not part ` +
          `of any field of an item, starting at ${JSON.stringify(loss.line)}. An item's body is ` +
          `the prose BEFORE its first "## " section, so the next command that writes this item — ` +
          `\`mycontext repair\`, or any \`mycontext edit\` — re-renders it WITHOUT that text and ` +
          `reports success, and nothing recovers it afterwards. Write the heading as bold ` +
          `("**Name**"), or move the content into "## Observations": both survive being read ` +
          `back. \`mycontext repair\` holds this item back until one of those is done.`,
      });
      // One finding per item: the exact report already names the first dropped
      // line, and adding a guess beside a measurement would only dilute it.
      continue;
    }

    const body = item.body.trim();
    if (body === '') continue;
    const lines = body.split('\n').filter((l) => l.trim() !== '');
    const last = lines[lines.length - 1]!.trimEnd();
    if (!UNFINISHED_TAIL.test(last)) continue;
    findings.push({
      level: 'info', code: 'body_ends_unfinished', item: item.id,
      remedy: ACK,
      message:
        `this item's body ends ${JSON.stringify(last.slice(-60))} — mid-sentence, or on a colon ` +
        `whose list is not there. That is what a body cut short at a "## " heading looks like ` +
        `once the cut has been written back to disk. It is a heuristic and nothing more: a ` +
        `performed truncation leaves no other trace (the file is self-consistent and its ` +
        `checksum agrees with the shortened text), and one that happened to land after a full ` +
        `stop leaves none at all. Compare the item against git history if the text reads ` +
        `unfinished; otherwise ignore this.`,
    });
  }
  return findings;
}

/**
 * **A `status:`, `severity:` or `origin:` on disk that is not a member of its
 * own vocabulary — reported here because `parseItem` cannot report it and must
 * not drop the item.**
 *
 * The read boundary reads a value outside one of the three unions as a safe
 * member and keeps loading (`ENUM_READ`, core/vocabulary.ts). That is the
 * right answer for the owner's own corpus — refusing the file would make a
 * one-character typo delete an item from every surface at once — but it is
 * only half an answer, because the item then reads as something the file does
 * not say and nothing anywhere mentions it. This is the other half.
 *
 * **It is an `error` and not a warning, and `status` is why.** An item whose
 * file says `status: activ` used to load as `'activ'`: a value outside
 * `Status`, indexed into `GOVERNING_STATUS` — a `Record<Status, boolean>`
 * written total precisely so every status has an answer — which returned
 * `undefined`. Measured 2026-09-13 on a throwaway corpus: the supersede
 * preflight, the guarded-field refusal, `supersedeItem`'s own refusal, the
 * contradiction gate's candidate filter and the pack-collision judgement all
 * stopped firing. The fallback makes the item honest; it does NOT restore
 * those protections, because `draft` does not govern either. Only repairing
 * the file does, which is what makes this row work a person actually owes.
 *
 * **Two remedies, because the routes genuinely differ.** `mycontext edit`
 * carries `--status` and `--severity` (core/edit-flags.ts) and carries no
 * `--origin`, so the first two are FIXABLE by a command a reader can copy and
 * the third is RULABLE and nothing more — which is this module's own
 * three-way rule applied rather than a remedy chosen for uniformity.
 *
 * **The evidence is destructible, and the message says so.** Every write path
 * re-renders the whole item from the parsed value, so the next
 * `mycontext repair` or `mycontext edit` on this item writes the FALLBACK into
 * the file and this finding stops firing with the original value gone. That is
 * not a reason to suppress the row; it is a reason for the row to name it.
 *
 * Project layer only, exactly as `checkBodyTruncation` above: `item.filePath`
 * is relative to the project root, and a global-layer item's file is not under
 * it.
 */
export function checkLaunderedEnum(root: string, items: Item[]): Finding[] {
  const findings: Finding[] = [];
  for (const item of items) {
    if (item.layer !== 'project') continue;
    let text: string;
    try {
      text = readFileSync(path.join(root, ...item.filePath.split('/')), 'utf8');
    } catch {
      // Unreadable is `loadLayer`'s report to make, not this check's — the
      // same division `checkBodyTruncation` keeps.
      continue;
    }
    for (const bad of launderedEnums(text)) {
      const fixable = bad.field === 'status' || bad.field === 'severity';
      findings.push({
        level: 'error',
        code: 'laundered_enum',
        item: item.id,
        remedy: fixable
          ? {
            route: 'copy',
            argv: ['mycontext', 'edit', item.id, `--${bad.field}`, bad.read, '--yes'],
          }
          : ACK,
        message:
          `${item.filePath} says ${launderedEnumSentence(bad)}. This build does not guess which ` +
          `one was meant, so it reads the field as ${JSON.stringify(bad.read)} — which is what ` +
          `every surface is showing you for this item right now, including \`mycontext show\`` +
          (bad.field === 'status'
            ? ' and the session injection. A status outside the vocabulary is the one that costs ' +
              'most: it is the field five separate gates ask about before they refuse a non-human ' +
              'caller anything, and none of them fires for an item that does not govern — so ' +
              'until the file is repaired this item is not protected by any of them. '
            : '. ') +
          (fixable
            ? `\`mycontext edit ${item.id} --${bad.field} ${bad.read} --yes\` writes that reading ` +
              'into the file and settles this row; pass a different value if a different one is ' +
              'what you meant.'
            : 'There is no `mycontext edit --origin` — origin records who wrote the item and no ' +
              'command restamps it — so this is a ruling rather than a repair. Note that ' +
              `${JSON.stringify(bad.read)} is the protective reading: it is the one origin the ` +
              'retirement sweep may not touch and the one `review decline` refuses, so nothing ' +
              'automatic acts on this item while it stands.') +
          ' Repair it before the next `mycontext repair` or `mycontext edit` on this item: every ' +
          'write path re-renders the whole file from the value above, so the next one replaces ' +
          `${JSON.stringify(bad.value)} with ${JSON.stringify(bad.read)} and this row stops ` +
          'firing with nothing left to read.',
      });
    }
  }
  return findings;
}

/**
 * List and blockquote scaffolding a line may open with before its first word.
 * Stripped so "does this line OPEN with a shouted clause" is asked of the
 * prose rather than of the Markdown wrapped around it.
 */
export const LINE_SCAFFOLD = /^(?:[>\s*_•+-]|\d+[.)])+/;

/** The leading run of shouted words on a line, with the punctuation between them. */
export const CAPS_RUN = /^[A-Z][A-Z'’]*(?:-[A-Z'’]+)*(?:[ ,;:.—'’-]+[A-Z][A-Z'’]*(?:-[A-Z'’]+)*)*/;

/**
 * Words that make a shouted clause conditional, hypothetical or negated, so
 * the clause is a PLAN rather than a verdict: "DONE WHEN:", "UNTIL THIS IS
 * FIXED", "THIS TASK IS NOT DONE AND MUST NOT BE CLOSED". These are English
 * function words, not this project's vocabulary — nothing derived exists for
 * them to fall out of step with.
 *
 * `NO` is deliberately absent. "THE QUESTION THIS TASK ASKED IS ANSWERED, AND
 * THE ANSWER IS NO" is a verdict, and hedging on `NO` would drop it.
 */
export const HEDGES = new Set([
  'NOT', 'NOR', 'NEVER', 'UNTIL', 'UNLESS', 'WHEN', 'IF', 'WHETHER',
  'CANNOT', 'MUST', 'WOULD', 'SHOULD', 'RATHER', 'BEFORE', 'ONCE',
]);

/**
 * Closing verdicts that NO vocabulary in this project declares, so there is
 * nothing to derive them from — see the docblock on `checkBodyAgreement` for
 * why this list exists, what it is not, and why the check says so in its own
 * output rather than leaving its reach implied by silence.
 */
export const CLOSING_VERDICTS = new Set([
  'RESOLVED', 'FIXED', 'CLOSED', 'ANSWERED', 'MOOT', 'WITHDRAWN',
  'OBSOLETE', 'CANCELLED', 'CANCELED', 'REVERTED', 'RETRACTED',
]);

/**
 * A body clause withdrawing something the item states. Two branches, and the
 * difference decides what else the clause must carry (see `retracts`):
 * `WITHDRAWN` announces itself, while "is wrong" / "was false" is the most
 * ordinary thing a body can say ABOUT ITS SUBJECT and means nothing on its own
 * — "the SNAPSHOT is stale" and "PACKS WAS WRONG" are the finding, not a
 * retraction of it.
 */
export const RETRACTION_ANNOUNCED =
  /\bno longer (?:holds|true|the case|applies|stands)\b|\bwithdrawn by\b|\bretracted\b/i;
export const RETRACTION_PREDICATE =
  /\b(?:is|was|are|were|has become|have become|turned out to be)\s+(?:now\s+|since\s+)?(?:wrong|false|stale|moot|obsolete)\b/i;

/** The same clause pointing at THIS item's own title, premise, claim or ruling. */
export const SELF_REF =
  /\b(?:the|this|that|its)\s+(?:title|premise|claim|ruling)\b|\bthis\s+(?:task|item|rule|note|lesson|requirement|decision|standard)(?:'s|’s)?\b/i;

/**
 * `<count> <noun>` in a title, so the body can be asked for the same count.
 * The count may not be preceded by a digit or a dot: `v2.0 citations` and
 * `pass 2: 13 keys` are a VERSION and a SEQUENCE, and reading either as a
 * measurement produced two findings that said nothing.
 */
export const TITLE_COUNT = /(?<![\dA-Za-z.-])(\d{1,5})\s+([A-Za-z][A-Za-z-]{3,})\b/g;

export function leadClauses(line: string): string[][] {
  const m = CAPS_RUN.exec(line.replace(LINE_SCAFFOLD, ''));
  if (m === null || m[0].length < 3) return [];
  const out: string[][] = [];
  for (const clause of m[0].split(/[.;:]/)) {
    const words = clause.split(/[^A-Z'’-]+/).filter((w) => w.length > 0);
    if (words.length === 0) continue;
    if (words.some((w) => HEDGES.has(w))) continue;
    out.push(words);
  }
  return out;
}

/** This item's value for `field`, whether it is a column or an extra. */
export function fieldValue(item: Item, field: string): string | null {
  if (field === 'status') return item.status;
  if (field === 'severity') return item.severity;
  if (field === 'always') return String(item.always);
  if (field === 'continuity') return String(item.continuity);
  return Object.hasOwn(item.extra, field) ? item.extra[field] : null;
}

/**
 * Every enumerated value this item's own category declares that it does NOT
 * currently hold, keyed by the shouted form a body would write it in.
 *
 * Derived, with nothing hand-kept: `updatesFor` is the same merge of
 * `TIER_UPDATES` and the category's own `updates` that `edit`, `help` and the
 * tag projection read, so a status added to the type or a `state` value added
 * to `config.json` arrives here with no edit to this file. Booleans and digits
 * are skipped because "TRUE" and "4" are not words a body shouts a verdict in,
 * and `true`/`false` in particular would collide with "THAT PREMISE WAS FALSE".
 */
export function unheldValues(config: Config, item: Item): Map<string, { field: string; current: string }> {
  const out = new Map<string, { field: string; current: string }>();
  const updates = updatesFor(config, item.type);
  for (const field of Object.keys(updates).sort()) {
    const decl = updates[field];
    if (decl.store !== 'field' || decl.values === undefined) continue;
    const current = fieldValue(item, field);
    if (current === null || current === '') continue;
    for (const value of decl.values) {
      if (value === current || value === 'true' || value === 'false') continue;
      if (!/^[a-z]{4,}$/.test(value)) continue;
      const key = value.toUpperCase();
      if (!out.has(key)) out.set(key, { field, current });
    }
  }
  return out;
}

/** Whether this item's own fields already say it is finished. */
export function alreadyClosed(item: Item): boolean {
  if (item.status === 'superseded' || item.status === 'deprecated') return true;
  return Object.hasOwn(item.extra, 'state') && item.extra.state === 'done';
}

export function snippet(text: string, max: number = 64): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return JSON.stringify(flat.length > max ? `${flat.slice(0, max)}…` : flat);
}

/**
 * **Does the body agree with the title and the fields above it?**
 *
 * Nothing asked that before. `doctor` checks checksums, projections, citations
 * and scope; every one of those compares a field against something outside the
 * item, and none of them reads the prose. Writing summaries for the whole
 * corpus on 2026-08-26 forced somebody to read every body for the first time
 * and turned up items whose own text closes them while the fields say they are
 * open, titles asserting a defect the body withdraws, and one INJECTED rule
 * whose title claims a parity its body had already given up — that one being
 * fed to agents as governing truth.
 *
 * **Three signals, and only the first is fully derived.** Saying which is
 * which is the point, not a caveat.
 *
 * 1. **A value the item does not hold.** `unheldValues` reads this item's own
 *    declared field vocabularies through `updatesFor` — the same merge `edit`
 *    and `help` read — so a body shouting `SUPERSEDED` on `status: active`, or
 *    `DONE` on `state: todo`, is a disagreement between two things this corpus
 *    already declares. Nothing is hand-kept: add a `state` value to
 *    `config.json` and this follows it with no edit here.
 * 2. **A closing verdict no vocabulary declares.** `RESOLVED`, `FIXED`,
 *    `MOOT`, `ANSWERED` and the rest of `CLOSING_VERDICTS` are English, not
 *    this project's words, and there is no derived list anywhere for them to
 *    drift out of step with — which is what makes them a lexicon rather than
 *    the duplicated-list defect this project has been bitten by. It is still
 *    the part that can silently miss, so `body_review_limits` states the
 *    reach of the whole check beside its findings, and says in as many words
 *    that the count is a floor.
 * 3. **The body retracting its own title.** `RETRACTION` + `SELF_REF` on one
 *    sentence, and `TITLE_COUNT` for a count in the title the body re-measures.
 *    Both compare the item against ITSELF; neither consults a list of items.
 *
 * **What makes it precise enough to be worth reading is the SHAPE, not the
 * words.** A verdict in this corpus opens a line in capitals — the corpus's own
 * emphasis convention — so only a clause at the head of a line is read, and a
 * clause carrying a `HEDGES` word is a plan rather than a verdict and is
 * dropped. That is what keeps `DONE WHEN:` (an acceptance criterion, on eight
 * requirements here) and `UNTIL THIS IS FIXED` out of the report.
 *
 * **`info`, and it must never become an error.** The ruling and its reasoning
 * are recorded on the check that reports it: the signal is inferential, a false
 * positive on a gate stops the world over prose, and the remedy — moving a
 * status or rewriting a title — is the owner's call. An error here would push
 * whoever wanted a green run into editing exactly the two fields that are not
 * theirs to edit.
 *
 * **One short finding per item.** The owner has already filed a task about a
 * doctor message that repeats a long explanation with every finding; the
 * standing limitation is stated ONCE, in `body_review_limits`, and never
 * beside each item.
 */
export function checkBodyAgreement(items: Item[], config: Config): Finding[] {
  const findings: Finding[] = [];

  for (const item of items) {
    const body = item.body.trim();
    if (body === '') continue;
    const reasons: string[] = [];
    const vocabulary = unheldValues(config, item);
    const closed = alreadyClosed(item);
    // Once per WORD, never once per line: "RESOLVED" shouted three times is
    // one disagreement, not three.
    const said = new Set<string>();

    for (const line of body.split('\n')) {
      for (const words of leadClauses(line)) {
        for (const word of words) {
          if (said.has(word)) continue;
          const held = vocabulary.get(word);
          if (held !== undefined) {
            said.add(word);
            reasons.push(`body shouts "${word}" while ${held.field} is "${held.current}".`);
            continue;
          }
          if (!closed && CLOSING_VERDICTS.has(word)) {
            said.add(word);
            reasons.push(`body shouts the closing verdict "${word}" on an item still open.`);
          }
        }
      }
    }

    // Split on the colon as well as the full stop: this corpus writes
    // paragraph-long sentences with a colon in the middle, and without the
    // colon "THE SECOND HALF OF THIS TASK … and both are wrong" reads as one
    // clause in which a self-reference and a falsity claim about something
    // else are neighbours.
    for (const clause of body.split(/(?<=[.!?:])\s+|\n/)) {
      const announced = RETRACTION_ANNOUNCED.test(clause);
      const predicate = RETRACTION_PREDICATE.test(clause) && SELF_REF.test(clause);
      if (!announced && !predicate) continue;
      // An ANNOUNCED retraction still has to be about this item rather than
      // quoted from elsewhere: either it names the item's own title/premise, or
      // it is shouted, which is how this corpus marks a verdict on itself.
      if (announced && !predicate && !SELF_REF.test(clause) && leadClauses(clause).length === 0) continue;
      reasons.push(`body retracts its own premise: ${snippet(clause)}.`);
      break;
    }

    TITLE_COUNT.lastIndex = 0;
    let counted: RegExpExecArray | null;
    while ((counted = TITLE_COUNT.exec(item.title)) !== null) {
      if (counted[1] === '0' || counted[1] === '1') continue;
      const stem = counted[2]!.replace(/s$/i, '');
      const again = new RegExp(`(?<![\\dA-Za-z.-])(\\d{1,5})\\s+${stem}s?\\b`, 'gi');
      const inBody = [...body.matchAll(again)].map((m) => m[1]!);
      // Nothing is reported while the body ALSO states the title's own count:
      // a body that says both is elaborating, not disagreeing.
      if (inBody.length === 0 || inBody.includes(counted[1]!)) continue;
      reasons.push(`title says ${counted[1]} ${counted[2]}; body says ${inBody[0]}.`);
      break;
    }

    if (reasons.length === 0) continue;
    const extra = reasons.length > 2 ? ` (+${reasons.length - 2} more)` : '';
    findings.push({
      level: 'info', code: 'body_disagrees_with_meta', item: item.id,
      remedy: ACK,
      message:
        `${reasons.slice(0, 2).join(' ')}${extra} Read the body against the title and the ` +
        `fields; which of the two moves is the owner's call.`,
    });
  }

  // The standing statement of reach, once per run and never beside a finding
  // — the owner has already filed a task about a doctor message that repeats a
  // long explanation with every finding.
  //
  // It rides WITH the findings rather than being emitted unconditionally, and
  // that is a deliberate trade rather than an oversight. "A clean corpus's
  // summary counts are exactly 0/0/0" is pinned in three test files
  // (`doctor-cli-on-path`, `docs/fixture`, `docs/examples`) and is the contract
  // that makes `doctor` usable in CI; a note nobody can ever clear is also the
  // failure `checkCitationForm`'s own docblock refuses. The cost is real and is
  // named here rather than hidden: on a corpus where this check finds nothing,
  // it says nothing, and "nothing found" is still not "nothing present".
  if (findings.length > 0) {
    findings.push({
      level: 'info', code: 'body_review_limits',
      about: 'body_disagrees_with_meta',
      remedy: NOTHING,
      message:
        `the ${findings.length} finding(s) above, out of ${items.length} item(s) read, are a ` +
        `FLOOR and not a count. This check reads two shapes only: a shouted clause OPENING a ` +
        `line, and a clause retracting the item's own title or premise. The field values it ` +
        `checks against are derived from each item's own category, so they follow config; the ` +
        `closing verdicts (RESOLVED, FIXED, CLOSED, ANSWERED, MOOT, …) are a listed lexicon, ` +
        `because no vocabulary in this project declares them. A contradiction written in ` +
        `ordinary sentence case, by implication, or in words not on that list is INVISIBLE ` +
        `here — "none found" is not "none present".`,
    });
  }

  return findings;
}

