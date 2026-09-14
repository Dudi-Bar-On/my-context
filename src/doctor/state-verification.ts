/**
 * **The three checks that read the AUDIT LOG rather than the corpus, and so
 * can say what actually HAPPENED to an item instead of what it now claims.**
 *
 * `governing_spill_pressure`, `state_unaudited` and `task_unverified` are one
 * group because they share one evidence source and one hard limitation: the
 * log only records what the product witnessed, so each of them has a
 * population it CANNOT measure. That is why all three carry a coverage
 * disclosure, why those disclosures cite each other by name — `task_unverified`
 * explicitly defers a set to `state_unaudited` rather than drawing a second,
 * disagreeing conclusion from the same log — and why `verifiedOnAdoptedAt` and
 * `STATE_AUDITED_FIELD` are shared between them rather than duplicated.
 *
 * Split out of `checks.ts` by
 * `TASK-the-checks-file-splits-along-a-boundary-its-own-tests`, along the line
 * the tests had already drawn: `test/doctor/governing-spill-pressure.test.ts`,
 * `test/doctor/state-unaudited.test.ts` and `test/doctor/task-unverified.test.ts`,
 * the last of which already exercises two of the three together because their
 * populations are defined against each other.
 *
 * The rule these obey — and in particular what a check may say about what it
 * could not measure — is stated once on `Finding` in `./finding.ts`.
 */

import path from 'node:path';
import { readAudit, type AuditRecord } from '../core/audit.ts';
import { openProjectionReadOnlyChecked, topItems } from '../core/audit-db.ts';
import type { Config } from '../core/config.ts';
import { DONE_STATE, STATE_FIELD, taskState, workItems } from '../core/needs.ts';
import { governs, isEligible } from '../core/select.ts';
import { checksum } from '../core/slug.ts';
import type { Item } from '../core/types.ts';
import { ACK, AUDIT_FILES, NOTHING, PERSON, type Finding } from './finding.ts';

/** How many recorded spills, so far, is "repeatedly" for a governing item — the owner's own
 *  worked examples (`RULE-do-not-accept-a-test-that-passes-in-isolation-and-fails` at 278,
 *  `STD-a-summary-is-one-plain-sentence-for-someone-who-does-not` at 289,
 *  `REQ-a-pinned-item-is-delivered-or-the-user-is-told-it-was-not` at 263) are two orders of
 *  magnitude past any number a single unlucky session could produce, so a low round number is
 *  enough to separate ordinary budget contention from a governing item the budget structurally
 *  cannot carry. Not tuned finer than that: the finding this feeds is a DISCLOSURE (see below),
 *  not a threshold a person is asked to trust to the token. */
export const GOVERNING_SPILL_REPEAT_THRESHOLD = 20;

/** How many of the log's most-spilled items to look at before filtering to governing ones —
 *  wide enough that a governing item does not fall out of the sample by sitting behind a
 *  handful of heavier-spilling rationale-adjacent categories, cheap enough that the query stays
 *  a single indexed GROUP BY (`topItems`, `core/audit-db.ts`). */
export const GOVERNING_SPILL_SAMPLE = 40;

/**
 * **A doctor line for the failure the corpus's own audit history already
 * measured: a governing item spilling so often that the budget cannot be said
 * to carry it, discovered by a person reading the log rather than by an
 * assistant that broke a rule it was never shown.**
 *
 * Owner ruling 2026-09-04, `TASK-the-injection-budget-drops-governing-items-
 * and-open-work`: *"Add a doctor line when a governing item spills
 * repeatedly, so the corpus says when its budget can no longer carry its own
 * rules rather than leaving it to be discovered."* `governs` (`select.ts`) is
 * the same predicate `byPriority` now ranks by — this check reads the effect
 * of that ranking on the corpus's own history, not a second opinion about
 * which categories matter.
 *
 * **Why this is a DISCLOSURE (`about`, self-routed) and not a counted
 * finding, unlike `checkContinuity`'s `continuity_overflow` beside it.** That
 * check computes a CURRENT fact — today's continuity candidates' total cost
 * against today's budget — fully re-derivable every run and cleared the
 * moment the corpus or the config changes to fix it: an ordinary, actionable,
 * countable finding. A spill COUNT read off the audit log is a different
 * shape of fact: the log is append-only, so an item's historical spill count
 * can only ever grow, never shrink, no matter how completely this file's own
 * ranking change fixes the corpus going forward. A finding that counts toward
 * the exit code would therefore be exactly the trap the rule above `interface
 * Finding` (./finding.ts) names — *"a row that only an accident can clear is not work"* —
 * except worse: this row could not be cleared by ANY accident either, only by
 * the log itself eventually rotating the evidence out of reach. `about`
 * points at this check's own code rather than at a different one (unlike
 * `state_audit_coverage`'s `about: 'state_unaudited'`) because there is no
 * separate primary check this is reporting the reach of — it is the whole of
 * what this check has to say, said as a disclosure rather than as a worklist
 * row, and `partitionFindings`/`summarize` (`cli/commands/doctor.ts`) route
 * and exclude it from `errors`/`warnings` on that field alone, whichever
 * `level` it carries.
 *
 * **`remedy: PERSON`, not `run` or `acknowledge`.** There is no catalogue
 * command that edits `config.json`, and `PERSON`'s own docblock names exactly
 * this case among its examples. There is also no single item to rule on:
 * pressure on a shared budget is a fact about the CORPUS's shape against the
 * CONFIG's numbers, not a defect in one item's content, so `acknowledge`
 * (which anchors to one item's own record) would be the wrong tool even if
 * this finding named an item, which — deliberately, being a disclosure rather
 * than a worklist row — it does not.
 *
 * **Read-only, and silent rather than alarmed when it cannot look.**
 * `openProjectionReadOnlyChecked` builds nothing and repairs nothing (its own
 * docblock); a projection that has never been built (`mycontext audit` has
 * never run here), or one that is behind or diverged from the log it derives
 * from, is caught the same way as any other read failure and this check
 * simply has nothing to say this run — bringing the projection current is a
 * WRITE (`syncProjection`), and it is `mycontext audit`'s job, not doctor's,
 * for the same separation `openProjectionReadOnlyChecked`'s own docblock
 * draws for the web UI's read routes. `doctor` stays read-only; this
 * secondary, optional disclosure over OPTIONAL infrastructure is not worth
 * spending doctor's write-free guarantee on.
 *
 * **`topItems(db, 'spilled', N)` is not tier-scoped**, matching the CLI's own
 * `mycontext audit --top spilled` — the query that produced the ruling's own
 * worked examples, so this check answers the identical question rather than a
 * narrower one that could disagree with the numbers the ruling was written
 * against.
 */
export function checkGoverningSpillPressure(root: string, items: Item[], config: Config): Finding[] {
  let db;
  try {
    db = openProjectionReadOnlyChecked(root);
  } catch {
    return [];
  }
  try {
    const byId = new Map(items.map((i) => [i.id, i]));
    const repeats = topItems(db, 'spilled', GOVERNING_SPILL_SAMPLE)
      .filter((row) => row.count >= GOVERNING_SPILL_REPEAT_THRESHOLD)
      .map((row) => ({ row, item: byId.get(row.label) }))
      .filter((entry): entry is { row: typeof entry.row; item: Item } =>
        entry.item !== undefined && isEligible(entry.item, config) && governs(entry.item));
    if (repeats.length === 0) return [];

    repeats.sort((a, b) => b.row.count - a.row.count || a.row.label.localeCompare(b.row.label));
    const named = repeats.map((entry) => `${entry.row.label} (${entry.row.count})`).join(', ');

    return [{
      level: 'info', code: 'governing_spill_pressure',
      about: 'governing_spill_pressure',
      remedy: PERSON,
      message:
        `${repeats.length} governing item(s) — rule, constraint, invariant, instruction, ` +
        `requirement, standard, or open task/plan work (\`select.ts\`'s \`governs\`) — have ` +
        `each spilled at least ${GOVERNING_SPILL_REPEAT_THRESHOLD} times in the audit history ` +
        `this projection has read so far: ${named}. A rule that spills cannot be obeyed. This ` +
        `is a disclosure of pressure on the tier budgets, not a defect in any one item, and the ` +
        `count can only grow — raise the relevant \`budgets.*\` figure in config.json, or ` +
        `narrow the busiest item's \`scope\` so it competes on fewer paths.`,
    }];
  } finally {
    db.close();
  }
}

/**
 * The audited field name a record written BEFORE the widening used for the
 * whole `extra` bag.
 *
 * `state` is an EXTRA field (`categories.ts`: `task.state`, `store: 'field'`),
 * and `movedFields` (core/persist.ts) used to compare `AUDITED_FIELDS` with
 * `extra` as one entry covering the whole bag. So a record that moved `state`
 * said `extra`, and so did a record that moved `priority`, `progress`,
 * `last_change` or `needs` — which is why this check could only ever be a
 * floor on the bypass and never a count of it.
 *
 * `movedFields` now reports per key (`STATE_AUDITED_FIELD` below), so this
 * spelling identifies exactly one thing: a record old enough that its `extra`
 * says nothing about which key moved. Such a record is treated as UNMEASURED
 * for `state` and credits the item, because reading it as evidence in either
 * direction would be inventing a measurement nobody took
 * (`STD-a-measured-zero-is-drawn-and-named`).
 */
export const EXTRA_AUDITED_FIELD = 'extra';

/**
 * What a record naming this item's `state` says since `movedFields`
 * (core/persist.ts) began reporting `extra` per key. A record carrying it
 * moved `state` and nothing else can have; a record not carrying it did not.
 */
export const STATE_AUDITED_FIELD = `${EXTRA_AUDITED_FIELD}.${STATE_FIELD}`;

/**
 * **A task that says it is finished, over a log that never recorded anybody
 * finishing it.**
 *
 * Owner ruling, verbatim: *"i never allow to do that only using create and
 * edit that updates properties, generates summary and calculates checksum."*
 * A `state` typed straight into an item's Markdown skips all three of those
 * acts. Measured on this corpus 2026-09-03: 28 tasks carry `state: done` with
 * no recorded write that could have set it.
 *
 * **This check exists because the file STOPS betraying the bypass, which is
 * not the same as never having betrayed it.** The earlier wording here — that
 * a hand-edited item "checksums correctly" and passes every file-level check
 * "by construction, and always would" — was measured and is false at the
 * moment of the edit, and the correction is the mechanism this whole check
 * depends on:
 *
 *  1. **At the hand edit, the file DOES betray it, loudly.**
 *     `computeItemChecksum` (core/item.ts) hashes `extra`, and `state` lives
 *     in `extra`, so a hand-edited item's recorded checksum is stale the
 *     instant the edit lands. `loadLayer` (core/rebuild.ts) raises that as a
 *     corpus LOAD ERROR naming the file, `doctor` exits 1, and the message
 *     says in as many words that "an edit outside my_context is one cause".
 *     Every one of the bypasses on this corpus was catchable at the moment it
 *     happened.
 *  2. **The next ordinary write erases it.** `writeItem` recomputes the
 *     checksum unconditionally on every write path, so the next `mycontext
 *     edit` on that item — for any reason at all, on any field — silently
 *     re-hashes the hand-edited value. `mycontext repair` does the same
 *     deliberately. From that moment the two items ARE indistinguishable on
 *     disk: identical frontmatter shape, a correct `summary` and
 *     `summary_of`, a correct `checksum`, `state:done` correctly projected
 *     into `tags`, and `doctor` green on both.
 *  3. **So the log is the only witness that survives**, and on this corpus
 *     every flagged item had a later product write and every one now
 *     checksums cleanly. The evidence eroded while it was being counted: the
 *     count drifted 28 → 25 → 24 as ordinary edits credited items out of the
 *     check.
 *
 * `persist` (core/persist.ts) now takes the measurement in (1) at write time
 * and records it in the mutation record that would have erased it, so a
 * divergence is a fact this check can READ rather than one it has to infer
 * from an absence — see `AuditRecord.diverged` and `AuditRecord.checksumAfter`.
 *
 * **`done` alone, and that is a scope decision rather than an oversight.**
 * `todo` is the value a task is CREATED in — 95 of them here — so "no record
 * ever set this to todo" reports the default on a hundred items and teaches a
 * reader to skim the code. `doing` and `blocked` are transient: the next real
 * move corrects them, and a stale one costs a glance. `done` is terminal. It
 * is the value that removes a task from `mycontext ready`, satisfies every
 * `needs` pointing at it (core/needs.ts) and closes the work; it is the one
 * whose truth another person's plan depends on, and it is the value the
 * owner's ruling was made about. Widening this to every tracked field would
 * fire on `title` for every item that was never retitled, which is a check
 * that fires on everything and therefore says nothing.
 *
 * **What it CANNOT determine, said here and said again in the finding**
 * (RULE-say-what-your-check-cannot-see-when-you-report-it-green):
 *
 *  - **Create-time values are invisible.** A `create` record carries no
 *    `fields` — on a create everything moved, so naming fields would name all
 *    of them — so a task captured with `--extra state=done` already set looks
 *    exactly like one hand-edited to `done` later. The two are
 *    indistinguishable from the log, and several of the findings on this
 *    corpus are honestly the first. That is why the message does not ACCUSE:
 *    it states the two readings and hands the choice to the person who knows.
 *  - **Records written before `fields` reported `extra` per key say only
 *    `extra`** (see `EXTRA_AUDITED_FIELD`). Over that stretch of the log a
 *    task whose `priority` was edited through the product and whose `state`
 *    was written by hand is still CREDITED here, and over that stretch this
 *    check is a floor on the bypass rather than a count of it. Records
 *    written from now on say `extra.state` or they do not, so for them the
 *    question has an answer. The finding says which of the two it is looking
 *    at, because a silence from this check would otherwise be read as an
 *    assurance it has no way to give. A coarse credit is defeated by positive
 *    divergence evidence — see below.
 *  - **Divergence, when the log holds it, is REPORTED rather than inferred.**
 *    Two independent measurements reach this check, and either one is enough:
 *    a `diverged` on some mutation record for the item (the file had moved
 *    under the product at the instant of that write), and a `checksumAfter`
 *    on the newest such record that disagrees with the item's checksum today
 *    (the file has moved since, and that comparison is made against the LOG
 *    rather than against a number stored inside the very file being checked,
 *    so the file cannot lie about its own history). Neither says WHICH field
 *    moved, and the finding does not pretend otherwise.
 *
 * **THE CUTOFF: an item born before the witness is UNMEASURABLE, and is
 * counted rather than accused.** This is the rule stated on `Finding`
 * (`./finding.ts`) applied to the one check that broke it, and it is the change of 2026-09-03.
 *
 * The predicate is exact: **the item's own `create` record carries
 * `checksumAfter`** — that is, the item was born after `persist`'s write-time
 * witness shipped. `checksumAfter` is stamped by `persist` on every write that
 * touches an item file (core/persist.ts), so its presence on a record is the
 * signature of the witness and `audit.ts` already rules what its absence
 * means: *"on a record without `checksumAfter`, absence is UNMEASURED and must
 * never be read as 'no divergence'"*. An item born under the witness has been
 * watched for its whole life, so a hand edit anywhere in it leaves something:
 * the write that overwrote it RECORDED the divergence it found, a `repair`
 * that re-stamped it left a checksum the log disagrees with, and one still
 * standing is red under the checksum check today. An item born before it has a
 * stretch of life nobody measured, and a hand edit inside that stretch was
 * erased by the next ordinary write with nothing recorded anywhere. **No
 * command can retro-fit that evidence and there must not be one.**
 *
 * So the question this check asks has no answer on such an item, and asking a
 * person to RULE on it is asking them to guess. Measured on this repository on
 * 2026-09-03: the witness's first record is `2026-09-03T10:18:56Z`, the log
 * reaches back to 2026-08-17, and all 24 of the items this check was reporting
 * had zero witnessed writes — every one of them unanswerable, which is why the
 * count could only ever erode by accident.
 *
 * **Why the CREATE record and not "any record".** An item created before the
 * witness and written after it is still dark over the stretch between the two,
 * and a bypass inside that stretch is just as gone. Keying on the create
 * record is also the only spelling that cannot erode: a create record is
 * written once and never rewritten, so membership of the measurable set is
 * FIXED at birth. Keying on "any record carries a stamp" would have let an
 * ordinary unrelated edit move an item into the reported set, which is the
 * same accident-driven drift in the opposite direction.
 *
 * **The loud half is untouched, and it is deliberately checked FIRST.**
 * Positive divergence evidence — a recorded `diverged`, or a newest
 * `checksumAfter` the file disagrees with — is reported per item whatever the
 * item's birth, because it is a measurement and not an inference from silence.
 * A bypass from now on is caught by name.
 *
 * **Items the log never saw are named as unmeasured, not counted as clean**
 * (`STD-a-measured-zero-is-drawn-and-named`, clause 2). A task with no
 * `create` record anywhere in the log — an imported pack, a corpus copied
 * without `.audit/`, a segment archived by its owner — has a life this log
 * cannot describe, and reporting it would be accusing an item of a bypass
 * nothing here could check for. Those are skipped and COUNTED, and the count
 * is emitted as its own finding whenever it is non-zero. The pre-witness set
 * is the second population of exactly the same kind and is emitted the same
 * way, as its own line under the same `state_audit_coverage` code: two facts,
 * two sentences, two remedies, and never a row per item.
 *
 * The zero case stays silent, which is doctor's own convention rather than a
 * departure from that standard: `checkCitationForm`, `checkAuditSize` and
 * `emitAcknowledged` all refuse to draw a line nobody can ever clear, and
 * doctor prints no per-check green for a reader to misread. The blind spots
 * above therefore travel in the per-item message, where they are read on
 * every run in which this check speaks at all.
 *
 * **It reads the whole log, and that is affordable HERE and nowhere else.**
 * `readAudit`'s own docblock draws the line — it is the read surface, not the
 * hot path, and nothing on the hook path calls it. Measured 2026-09-03 over
 * this repository's log: 11,296 records, 5.7 MiB, one un-rotated segment,
 * 39 ms. `doctor` already walks the repository twice and stats every source a
 * `reference` names; one pass over the log beside that is not the cost that
 * matters, and no cheaper answer exists — the question is about the ABSENCE of
 * a record, which cannot be answered from a bounded tail.
 *
 * **`info`, deliberately, and `citation_form` is the precedent.** The original
 * reason was volume — 28 findings existed the moment this shipped, and a check
 * that turns a corpus amber on arrival for historical reasons is a check
 * people switch off. The cutoff above retires that reason: zero per-item
 * findings remain on this corpus. The level does not change with it, on the
 * standing reason rather than the retired one — what is reported is a question
 * about PROVENANCE that a person answers once per item, not a fault in the
 * product's own state, and doctor's exit code is reserved for the second.
 * `acknowledge` remains its remedy for the same reason and only now honestly:
 * every finding still emitted asks a question whose evidence is in the log the
 * reader can go and read, so the ruling it asks for is one they can actually
 * make.
 */
export function checkStateUnaudited(root: string, items: Item[], config: Config): Finding[] {
  const closed = workItems(items, config).filter((i) => taskState(i) === DONE_STATE);
  if (closed.length === 0) return [];

  let records: AuditRecord[];
  try {
    records = readAudit(root);
  } catch (err) {
    // `readAudit` REFUSES a log with a damaged line rather than skipping it,
    // and that refusal must not become a `check_failed` error: doctor would go
    // red, and the red would say a doctor check crashed when what actually
    // happened is that this workspace's log cannot be read. Reported as the
    // maximal case of the thing this check reports anyway — it could not look.
    return [{
      level: 'info', code: 'state_audit_coverage',
      about: 'state_unaudited',
      remedy: PERSON,
      message:
        `${closed.length} task(s) carry \`${STATE_FIELD}: ${DONE_STATE}\` and none of them has ` +
        `been checked against the audit log, because the log could not be read: ` +
        `${err instanceof Error ? err.message : String(err)} That is an UNMEASURED set and not ` +
        `a clean one. Nothing about the items is being asserted here in either direction; the ` +
        `file named in that refusal is what a person has to look at first.`,
    }];
  }

  // Six facts per item and nothing else: was its creation recorded here at
  // all; was that creation WITNESSED (its record carries `checksumAfter`, the
  // signature of `persist`'s write-time guard — see the cutoff in the
  // docblock); did any recorded write name `state` itself; did any record name
  // the whole `extra` bag coarsely (a write from before the widening, which is
  // unmeasured for `state` rather than evidence about it); did any write
  // OBSERVE the file diverging under it; and what did the last recorded write
  // stamp on it.
  const created = new Set<string>();
  const bornWitnessed = new Set<string>();
  const laterWrites = new Map<string, number>();
  const movedState = new Set<string>();
  const movedExtraCoarsely = new Set<string>();
  const observedDivergence = new Map<string, string>();
  const stamped = new Map<string, string>();
  for (const record of records) {
    if (record.kind !== 'mutation') continue;
    const id = record.itemId;
    if (typeof id !== 'string' || id === '') continue;
    if (record.op === 'create') {
      created.add(id);
      // The cutoff, read off the record rather than off a date: a `create`
      // carrying the guard's stamp is an item born under the witness, and
      // every write of its life since has been measured.
      if (typeof record.checksumAfter === 'string' && record.checksumAfter !== '') {
        bornWitnessed.add(id);
      }
    } else laterWrites.set(id, (laterWrites.get(id) ?? 0) + 1);
    if (Array.isArray(record.fields)) {
      if (record.fields.includes(STATE_AUDITED_FIELD)) movedState.add(id);
      if (record.fields.includes(EXTRA_AUDITED_FIELD)) movedExtraCoarsely.add(id);
    }
    // Records arrive oldest-first across every segment, so a plain overwrite
    // leaves the NEWEST of each — which is what both divergence questions are
    // about.
    if (record.diverged !== undefined) observedDivergence.set(id, record.at);
    if (typeof record.checksumAfter === 'string' && record.checksumAfter !== '') {
      stamped.set(id, record.checksumAfter);
    }
  }

  const findings: Finding[] = [];
  let unseen = 0;
  let unwitnessed = 0;
  for (const item of closed) {
    if (!created.has(item.id)) { unseen++; continue; }
    // A record that named `state` itself settles the question: a recorded
    // write moved it, and this check has nothing to ask.
    if (movedState.has(item.id)) continue;

    // The two divergence measurements, either of which is a POSITIVE fact
    // rather than an inference from silence. See the docblock.
    const observedAt = observedDivergence.get(item.id);
    const lastStamp = stamped.get(item.id);
    const stampDisagrees = lastStamp !== undefined && item.checksum !== ''
      && lastStamp !== item.checksum;
    const divergence = observedAt !== undefined
      ? `The log RECORDS this item's file being changed outside my_context: the write at ` +
        `${observedAt} found the file's own recorded checksum disagreeing with its own ` +
        `content, which is what a hand edit leaves and what the write after it erases. `
      : stampDisagrees
        ? `The log RECORDS a divergence: the last write it holds for this item stamped ` +
          `\`${lastStamp}\`, and the file now carries \`${item.checksum}\`, so the file has ` +
          `been written since by something this log never saw — a hand edit, or a ` +
          `\`mycontext repair\` re-stamp of one. That comparison is made against the LOG and ` +
          `not against a number stored inside the file being checked, so the file cannot ` +
          `answer it for itself. `
        : '';

    // A record that named the whole bag coarsely predates the widening and is
    // UNMEASURED for `state` — it credits the item rather than accusing it,
    // exactly as this check always did. Positive divergence evidence defeats
    // that credit: an old coarse record cannot excuse a file the log actually
    // saw move.
    if (divergence === '' && movedExtraCoarsely.has(item.id)) continue;

    // THE CUTOFF. With no positive evidence left, all this check has is the
    // ABSENCE of a record — and an absence is only evidence where something
    // was watching. An item born before `persist`'s witness has a stretch of
    // life nobody measured; a hand edit inside it was erased by the next
    // ordinary write with nothing recorded, and no command can retro-fit that.
    // A person asked to rule on it would be guessing, so it is COUNTED as
    // unmeasurable and reported once, below, rather than as a row of its own.
    // See the docblock, and the rule stated on `Finding` (./finding.ts).
    if (divergence === '' && !bornWitnessed.has(item.id)) { unwitnessed++; continue; }

    const later = laterWrites.get(item.id) ?? 0;
    findings.push({
      level: 'info', code: 'state_unaudited', item: item.id,
      remedy: ACK,
      message:
        `\`${STATE_FIELD}: ${DONE_STATE}\` closes this task, and no write recorded in the audit ` +
        `log ever moved it there. The log holds this item's \`create\` record and ` +
        `${later} later write(s), and not one of them named \`${STATE_AUDITED_FIELD}\` among ` +
        `the fields it moved. ${divergence}` +
        (divergence === ''
          ? `Two readings fit that evidence and this check cannot choose between them: the ` +
            `task was CREATED already done, which is invisible from here because a \`create\` ` +
            `record lists no fields at all; or \`${STATE_FIELD}\` was written into the Markdown ` +
            `by hand, outside \`mycontext edit\` — the path that updates the properties, ` +
            `regenerates the summary and re-stamps the checksum. `
          : `That does not by itself say WHICH field moved, so it is evidence of a bypass on ` +
            `this item and not proof that \`${STATE_FIELD}\` was the field bypassed. `) +
        `What the FILE can tell you is bounded, and it is bounded in a way worth knowing: a ` +
        `hand edit DOES show up at the moment it lands, because the recorded checksum covers ` +
        `\`extra\` and \`doctor\` goes red naming the file — and then the very next write ` +
        `through the product re-stamps it, after which the hand-set state projects into ` +
        `\`tags\`, checksums correctly, and passes every other check in this report. The log ` +
        `is what survives that, so which reading is right is yours to say and nobody else's — ` +
        `\`mycontext ack ${item.id} state_unaudited\` records the ruling. What this check ` +
        `cannot see, said here so its silence elsewhere is not read as an assurance: a ` +
        `mutation record written before \`fields\` reported \`${EXTRA_AUDITED_FIELD}\` per key ` +
        `names the bag and never WHICH extra key moved, so over that stretch of the log a task ` +
        `whose \`priority\` or \`progress\` was edited through the product is credited by this ` +
        `check even if its \`${STATE_FIELD}\` never was. Over that stretch this is a ` +
        `floor on the bypass, never a count of it; over what follows it, \`${STATE_AUDITED_FIELD}\` ` +
        `is named or it is not.`,
    });
  }

  if (unseen > 0) {
    findings.push({
      level: 'info', code: 'state_audit_coverage',
      about: 'state_unaudited',
      remedy: AUDIT_FILES,
      message:
        `${unseen} task(s) carry \`${STATE_FIELD}: ${DONE_STATE}\` and have no \`create\` record ` +
        `anywhere in the audit log, so \`state_unaudited\` has NOT looked at them — an ` +
        `unmeasured set, which is a different fact from a clean one and is reported as itself. ` +
        `The log describes the stretch of history it holds and no more: an item restored from ` +
        `a pack, copied in without \`.audit/\`, or older than the oldest segment still present ` +
        `leaves no trace of its own capture, and an item whose life this log never saw must not ` +
        `be accused of a bypass nothing here can check for. \`mycontext audit --files\` names ` +
        `the segments that do survive, and how far back they reach.`,
    });
  }

  if (unwitnessed > 0) {
    findings.push({
      level: 'info', code: 'state_audit_coverage',
      about: 'state_unaudited',
      // NOTHING, and it is the whole point of this line. There is no command,
      // and there is no ruling to ask for either: `acknowledge` on a question
      // whose evidence was never recorded asks a person to certify a guess.
      // The set shrinks on its own as items created under the witness replace
      // the ones created before it — which is repair by turnover, not by
      // accident, because nothing an unrelated edit does can move an item into
      // or out of it.
      remedy: NOTHING,
      message:
        `${unwitnessed} task(s) carry \`${STATE_FIELD}: ${DONE_STATE}\` and were CREATED before ` +
        `this workspace began recording what each write found on disk, so \`state_unaudited\` ` +
        `cannot measure them and does not report them one by one. That is an UNMEASURED set ` +
        `and not a clean one: nothing is being asserted about these items in either direction. ` +
        `The reason it is stated once here rather than as ${unwitnessed} finding(s) is that ` +
        `there is no answer to give — a write that bypassed the product before the guard ` +
        `existed was erased by the next ordinary write, the evidence is not recoverable, and ` +
        `no command can retro-fit it. Nothing is owed on this line and this set can only ` +
        `shrink: every task created from now on is watched for its whole life, and a bypass on ` +
        `one is reported against that item by name.`,
    });
  }
  return findings;
}

/** `task.verified_on`. Its whole existence is `checkTaskUnverified` below. */
export const VERIFIED_ON_FIELD = 'verified_on';

/**
 * What a record naming this item's `verified_on` says — `STATE_AUDITED_FIELD`'s
 * sibling, one key over, and true under the same condition: `movedFields`
 * (core/persist.ts) reports `extra` per key, so a record carrying this moved
 * `verified_on` and a record not carrying it did not. A record old enough to
 * say only `extra` is unmeasured here exactly as it is there.
 */
export const VERIFIED_ON_AUDITED_FIELD = `${EXTRA_AUDITED_FIELD}.${VERIFIED_ON_FIELD}`;

/**
 * **The instant THIS WORKSPACE first demonstrably wrote a `verified_on`** —
 * derived from its own audit log, and `null` where the log never saw one.
 *
 * ── IT USED TO BE A DATE TYPED INTO SHIPPED CODE, AND THE DATE WAS OURS ────
 *
 * Until 2026-09-14 this was `VERIFIED_ON_INTRODUCED_AT =
 * '2026-09-03T12:00:00.000Z'` — the instant `task.verified_on` became a legal
 * field **in this repository**, compiled into the product every consumer
 * installs. A stranger's corpus has no 2026-09-03 in it, so over there the
 * comparison below could only ever answer "after", for every task, forever.
 *
 * **And it answered "after" for every task HERE too, which is the measurement
 * that retired it.** Run against this repository's own corpus on 2026-09-14:
 * 494 closed tasks carrying no `verified_on`, of which 413 have no recorded
 * `state` write at all (the `noTransition` branch below, which is
 * `checkStateUnaudited`'s population) and 81 have one. **All 81 are after the
 * cutoff. The grandfathered count is ZERO**, and it is zero under every cutoff
 * that could be typed here — the same 81 are reported with the constant set to
 * the epoch. `doctor` prints no grandfathered disclosure on this corpus and
 * never has.
 *
 * That is not an accident of today's numbers, it is structural. The cutoff was
 * set *behind the moment the check was written* and the log's past does not
 * grow: every record written from then on carries `now`, which is after it.
 * The set the constant protected was empty when it was written — its own
 * docblock said so, measuring ZERO of 413 done tasks with a recorded `state`
 * write on 2026-09-04 — and nothing can ever put a record into it. **A
 * grandfather clause that grandfathers nobody here, and cannot fire at all
 * over there, is this repository's history shipped as a rule about somebody
 * else's.**
 *
 * ── WHAT REPLACES IT, AND WHY IT IS A DERIVATION RATHER THAN A BETTER DATE ──
 *
 * The question the cutoff was reaching for is real, and it is not about a
 * date: *could the person who made this write have set `verified_on`?* The
 * honest form of that is per-workspace — **had this workspace started using
 * the field yet** — and a workspace can answer it about itself. So the line is
 * the earliest record whose `fields` names `extra.verified_on`: the first time
 * anybody here demonstrably wrote one. Before that instant nobody in this
 * project was setting the field, and a task closed then is not faulted for it.
 *
 * On this corpus that instant is `2026-09-04T07:56:02.599Z`, twenty hours
 * after the constant it replaces, and it changes nothing here: 81 reported
 * either way, 0 grandfathered either way. In a workspace created today it is
 * whatever moment the user first uses the field, which is the only answer that
 * was ever true of a stranger's install.
 *
 * **`null` where the log names no such write.** A task minted with
 * `--extra verified_on=…` already set leaves no `fields` at all (`create`
 * records carry none — `auditMutation`, persist.ts), so adoption can be real
 * and undated. `null` grandfathers nothing, which is exactly what the constant
 * did, and the adoption gate in `checkTaskUnverified` is what keeps that from
 * becoming a wall: a corpus where nothing carries the field never reaches this
 * function at all.
 *
 * **`checkStateUnaudited` faced the identical shape of problem and is the
 * model this check follows**: a fact unknowable for items that predate the
 * mechanism, solved with a cutoff plus one coverage disclosure rather than
 * 406 rows nobody can clear (the `RULE` on `Finding`, ./finding.ts — a row only an
 * accident can clear is noise wearing work's clothes, and doctor was just
 * taken from 95 findings to zero).
 *
 * **Keyed on the recorded `done` TRANSITION, not on creation — reversed from
 * this check's first ship, by owner ruling, 2026-09-04.** The first version
 * grandfathered by the `create` record's date, and the owner named the
 * consequence and did not like it: the ~116 tasks that existed but were not
 * yet `done` would stay exempt FOREVER, because their `create` record
 * predates this field and a birth date cannot un-predate itself. He asked
 * whether `done` was even the right trigger and worried some would be
 * *"missed forever."* The ruling: key the check on the write that actually
 * closes the task, so a task open today and finished next month is judged by
 * WHEN it finishes, not by when it was opened.
 *
 * **His worry had a real basis, and the design has to answer it rather than
 * paper over it.** A task can reach `state: done` with no audit record ever
 * setting it — the hand-edit bypass `checkStateUnaudited` (immediately above)
 * already exists to catch, 27 of them measured on this corpus at the time of
 * that check's own writing. Keying purely on "the newest write that touched
 * `state`" would silently say nothing about exactly those items, which is
 * the opposite of the point. **The two checks PARTITION instead**, and nobody
 * has to trust that by assertion — it follows from a shared test: an item
 * this check finds no recorded `state`-transition for is, by the identical
 * predicate, the item `checkStateUnaudited` does not credit with a witnessed
 * `state` write either. It is that check's `state_unaudited` finding, or it
 * is inside one of that check's own coverage disclosures (`unwitnessed` or
 * `unseen`). Either way it already has an owner, and this check saying
 * nothing about it is not a gap — it is the other half of the same
 * partition. Measured on the live corpus, 2026-09-04: of 413 tasks at
 * `state: done`, precisely ZERO carry a recorded write that ever touched
 * `state` — every one of them is `state_unaudited`'s to account for, and
 * none is silently uncovered by both checks at once (see the report for the
 * query that established this).
 *
 * **The transition timestamp, read off the same log `checkStateUnaudited`
 * reads, by the same test.** A record's `fields` names `extra.state`
 * (`STATE_AUDITED_FIELD`, above) when a write moved it — never what it moved
 * it TO, because this log stores no copy of item content
 * (`AuditRecord.fields`'s own docblock). So "the log recorded this task's
 * done transition" cannot be verified more precisely than "the log recorded
 * A write to `state`, on an item now `done`" — the identical resolution
 * `checkStateUnaudited` already lives with for the same field, on the same
 * log. `create` records carry no `fields` at all (`auditMutation`,
 * persist.ts: "on a create everything moved, so naming fields would name all
 * of them"), so a task minted with `--extra state=done` already set leaves no
 * entry here — which is correct rather than a hole, because
 * `checkStateUnaudited` already reports that exact ambiguity everywhere it
 * can and grandfathers it everywhere it cannot, and this check must not draw
 * a second, disagreeing conclusion about the same fact from the same log.
 *
 * **Going `done` → `todo` → `done` again**: nothing here can see VALUES, only
 * that `state` moved, so this check takes the NEWEST recorded write to
 * `state` for the item — records arrive oldest-first across every segment
 * (`readAudit`'s own contract), so the map below is left holding the latest
 * one by construction. That is the best-available reading and the same one
 * `checkStateUnaudited`'s own `movedState` set makes: a task that cycles
 * `done → todo → done` entirely through the product is judged by its LAST
 * recorded touch, which is also the transition that actually left it
 * `done` today. A cycle where the FINAL hop back to `done` is a hand-edit
 * bypass with no record of its own is `checkStateUnaudited`'s question, not
 * this one's — this check would use the timestamp of the last-recorded
 * (earlier) product write, which is still an honest answer to "when did the
 * product last verifiably touch this field," and the reader is not left
 * unwarned: `checkStateUnaudited`'s own divergence machinery is what would
 * catch the bypass itself, on the same item, under its own code.
 *
 * The 2026-09-04 ruling is untouched by any of this: it moved WHAT is compared
 * against the line — the recorded `done` transition rather than the `create`
 * record — and that is still what is compared. Only the line itself stopped
 * being a date somebody typed.
 */
export function verifiedOnAdoptedAt(records: AuditRecord[]): string | null {
  let earliest: string | null = null;
  for (const record of records) {
    if (record.kind !== 'mutation') continue;
    if (!Array.isArray(record.fields)) continue;
    if (!record.fields.includes(VERIFIED_ON_AUDITED_FIELD)) continue;
    // `readAudit` delivers oldest-first across every segment, so the first hit
    // is already the earliest — the comparison is kept anyway because that
    // ordering is a contract of another module, and a derivation that quietly
    // depends on it is the kind of thing that breaks when a segment is
    // restored out of order.
    if (earliest === null || record.at < earliest) earliest = record.at;
  }
  return earliest;
}

/** `mycontext edit <id> --extra verified_on=<date>`, after checking the work. */
export const VERIFIED_ON_EDIT_COMMAND = `mycontext edit <id> --extra ${VERIFIED_ON_FIELD}=<date>`;

/** `''` and whitespace-only both read as absent — `taskState`'s own convention. */
export function taskVerifiedOn(item: Item): string {
  return (item.extra[VERIFIED_ON_FIELD] ?? '').trim();
}

/**
 * **`task.verified_on`'s only consumer.** A `done` task with nothing in
 * `verified_on` is reported — unless the log's newest recorded write to
 * `state` for it predates this workspace's first recorded `verified_on`, in
 * which case it is counted into a single coverage disclosure and never named;
 * and unless the log holds NO recorded write to `state` for it at all, in
 * which case it is `checkStateUnaudited`'s population and not reported HERE
 * either. See `verifiedOnAdoptedAt` for the line, the measurement that
 * replaced a hard-coded date with it, and the argument for keying on the
 * recorded transition; and for why the two checks partition rather than
 * overlap.
 *
 * ── AND IT IS SILENT IN A PROJECT THAT DOES NOT USE THE FIELD ───────────────
 *
 * `verified_on` is an OPTIONAL field on `task`. A workspace where no item has
 * ever carried one has not adopted the convention, and there **every** closed
 * task lacks it — so the check's population is not "the tasks with a problem",
 * it is "the tasks". Measured on a workspace created from `mycontext init` on
 * 2026-09-14: two tasks closed through `mycontext edit`, two `task_unverified`
 * warnings, 100%, on day one, on work the tool had just been told about.
 *
 * That is the shape the `RULE` on `Finding` (./finding.ts) refuses — *a row only
 * an accident can clear is noise wearing work's clothes* — and a newcomer
 * cannot clear these rows at all except by adopting a convention nobody has
 * asked them about. **So adoption is the gate, and the corpus answers it**: if
 * one item anywhere carries a `verified_on`, this project uses the field and a
 * closed task without one is a real gap; if none does, the check reports
 * nothing and says so in one line. It switches itself on the first time the
 * user sets one, and from that moment `verifiedOnAdoptedAt` grandfathers
 * everything they closed before.
 *
 * The silence is DISCLOSED rather than silent — `INV-nothing-is-dropped-
 * silently`, and `STD-a-measured-zero-is-drawn-and-named`: the line names how
 * many closed tasks went unexamined and the command that would start using the
 * field, so nothing is hidden and nothing is owed.
 *
 * Structured identically to `checkStateUnaudited` immediately above:
 * read-failure falls back to one `PERSON`-remedy disclosure.
 */
export function checkTaskUnverified(root: string, items: Item[], config: Config): Finding[] {
  const closed = workItems(items, config).filter((i) => taskState(i) === DONE_STATE);
  if (closed.length === 0) return [];

  // Asked of the WHOLE corpus and before the log is read: the question is
  // whether this project uses the field at all, which a closed task cannot
  // answer (it is the population being judged) and which needs no audit log.
  if (!items.some((i) => taskVerifiedOn(i) !== '')) {
    return [{
      level: 'info', code: 'task_verification_coverage',
      about: 'task_unverified',
      // NOTHING: there is no defect here and no ruling to ask for. A project
      // that does not use `verified_on` is not failing to use it.
      remedy: NOTHING,
      message:
        `${closed.length} task(s) carry \`${STATE_FIELD}: ${DONE_STATE}\` and none of them was ` +
        `examined for \`${VERIFIED_ON_FIELD}\`, because no item in this corpus has ever carried ` +
        `one. \`${VERIFIED_ON_FIELD}\` is an optional field that records you checked the work a ` +
        `closed task claims; a project that does not use it has every closed task without one, ` +
        `so reporting them would be reporting the corpus rather than anything wrong with it. ` +
        `Set one — \`${VERIFIED_ON_EDIT_COMMAND}\` — and this check starts reporting closed ` +
        `tasks from that moment on, leaving everything closed before it alone. Nothing is owed ` +
        `on this line.`,
    }];
  }

  let records: AuditRecord[];
  try {
    records = readAudit(root);
  } catch (err) {
    return [{
      level: 'info', code: 'task_verification_coverage',
      about: 'task_unverified',
      remedy: PERSON,
      message:
        `${closed.length} task(s) carry \`${STATE_FIELD}: ${DONE_STATE}\` and none of them has ` +
        `been checked for \`${VERIFIED_ON_FIELD}\` coverage, because the audit log could not be ` +
        `read: ${err instanceof Error ? err.message : String(err)} That is an UNMEASURED set ` +
        `and not a clean one. The file named in that refusal is what a person has to look at ` +
        `first.`,
    }];
  }

  // The recorded DONE TRANSITION per item: the newest record naming
  // `extra.state` among the fields it moved — exactly the test
  // `checkStateUnaudited`'s own `movedState` set uses to decide whether ANY
  // write touched `state` through the product (`STATE_AUDITED_FIELD`,
  // defined above this check's own docblock). Reusing that identical
  // predicate is what makes the two checks PARTITION rather than overlap or
  // double-count: an item this map has no entry for is, by the SAME test,
  // the item `checkStateUnaudited` does not credit with a witnessed `state`
  // write either — either it is one of that check's own `state_unaudited`
  // findings, or it is inside one of that check's own coverage disclosures.
  // Either way it already has an owner, and it is not this check's to name.
  //
  // A `create` record never carries `fields` (`auditMutation`, persist.ts —
  // "on a create everything moved, so naming fields would name all of
  // them"), so a task minted with `--extra state=done` already set leaves no
  // entry here either. That is deliberate rather than a gap:
  // `checkStateUnaudited` already reports that exact ambiguity ("the task
  // was CREATED already done ... or state was written by hand") everywhere
  // it can and grandfathers it everywhere it cannot, and this check must not
  // draw a second, disagreeing conclusion about the same fact from the same
  // log.
  //
  // Records arrive oldest-first across every segment (`readAudit`'s own
  // contract), so a plain overwrite of the map below leaves the NEWEST
  // matching record for each id — see the docblock on
  // `verifiedOnAdoptedAt` for what a task that goes
  // `done` → `todo` → `done` does to this timestamp.
  const stateTransitionAt = new Map<string, string>();
  for (const record of records) {
    if (record.kind !== 'mutation') continue;
    const id = record.itemId;
    if (typeof id !== 'string' || id === '') continue;
    if (Array.isArray(record.fields) && record.fields.includes(STATE_AUDITED_FIELD)) {
      stateTransitionAt.set(id, record.at);
    }
  }

  // The line, derived from this workspace's own log rather than typed into
  // the product — see `verifiedOnAdoptedAt` for the measurement that retired
  // the constant this replaced. `null` means the log never witnessed a
  // `verified_on` write, so nothing is grandfathered; the adoption gate above
  // has already established that the field IS in use here.
  const adoptedAt = verifiedOnAdoptedAt(records);

  const findings: Finding[] = [];
  let noTransition = 0;
  let grandfathered = 0;
  for (const item of closed) {
    if (taskVerifiedOn(item) !== '') continue;

    const transitionAt = stateTransitionAt.get(item.id);
    if (transitionAt === undefined) { noTransition++; continue; }
    if (adoptedAt !== null && transitionAt < adoptedAt) { grandfathered++; continue; }

    findings.push({
      level: 'warn', code: 'task_unverified', item: item.id,
      remedy: ACK,
      message:
        `\`${STATE_FIELD}: ${DONE_STATE}\` closes this task, and it carries no ` +
        `\`${VERIFIED_ON_FIELD}\`. The log records a write that moved \`${STATE_AUDITED_FIELD}\` ` +
        `for this item at ${transitionAt}, after \`${VERIFIED_ON_FIELD}\` became a field \`task\` ` +
        `declares — so this task could have carried one from that moment and does not. Check the ` +
        `work \`${STATE_FIELD}: ${DONE_STATE}\` claims and, if it holds up, ` +
        `\`${VERIFIED_ON_EDIT_COMMAND}\` records that; \`mycontext ack ${item.id} task_unverified\` ` +
        `records a ruling that this task does not need one.`,
    });
  }

  if (noTransition > 0) {
    findings.push({
      level: 'info', code: 'task_verification_coverage',
      about: 'task_unverified',
      // NOTHING, deliberately: this check has no command to offer and no
      // ruling to ask for, because the population is not its own — see the
      // docblock. The question "was this task's `done` ever witnessed by the
      // product" is `checkStateUnaudited`'s, and its own findings and its own
      // coverage disclosures (`state_audit_coverage`) are where it is
      // actually answered.
      remedy: NOTHING,
      message:
        `${noTransition} task(s) carry \`${STATE_FIELD}: ${DONE_STATE}\` and no write recorded ` +
        `in the audit log ever moved \`${STATE_AUDITED_FIELD}\`, so \`task_unverified\` has no ` +
        `recorded transition to measure a cutoff against and does not report them one by one. ` +
        `That is \`state_unaudited\`'s population and not this check's: a task whose \`state\` was ` +
        `never witnessed moving through the product is either one of that check's own findings or ` +
        `named inside one of its own coverage disclosures, and this check must not draw a second, ` +
        `disagreeing conclusion from the same log. Nothing is owed on this line.`,
    });
  }

  if (grandfathered > 0) {
    findings.push({
      level: 'info', code: 'task_verification_coverage',
      about: 'task_unverified',
      // NOTHING: there is no command, and no ruling to ask for either — the
      // newest write this log ever recorded moving this item's `state`
      // predates the first `verified_on` anybody in this workspace wrote, so
      // the person who made that write was not yet using the field. The set
      // can only shrink, by turnover, as these tasks are superseded,
      // replaced, or eventually re-closed by a later write.
      remedy: NOTHING,
      message:
        `${grandfathered} task(s) carry \`${STATE_FIELD}: ${DONE_STATE}\` and the newest write ` +
        `this log records moving \`${STATE_AUDITED_FIELD}\` for each of them predates ` +
        `${adoptedAt}, which is the earliest write this workspace's own log records setting a ` +
        `\`${VERIFIED_ON_FIELD}\` — so \`task_unverified\` does not report them one by one. That ` +
        `is not a clean set — nothing is asserted about these items in either direction — it is ` +
        `a set this check cannot fault: nobody here was filling the field in at the moment each ` +
        `was last recorded moving. Nothing is owed on this line.`,
    });
  }
  return findings;
}

