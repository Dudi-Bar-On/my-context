/**
 * `nav.ev` — **Doctor**, `<section data-p="doctor">` in the design of record.
 * `runChecks`' findings, kept whole: *"'exit 1' loses the findings list"*
 * (`doc.v`).
 *
 * **Three cards, one per LEVEL, each row carrying its code — the mockup's
 * arrangement, not the plan's.** The plan's Step 3 sketch builds one
 * `<section>` per CODE with a `<ul>` inside it; `<section data-p="doctor">`
 * builds `<div class="card pane">` per level — `error`, `warning`, `notice` —
 * each holding a `<table>` whose first cell is the code. Both readings satisfy
 * `doc.sub` (*"Grouped by code, in three levels"*), and the
 * mockup is the specification, so the levels are the cards and the grouping by
 * code is the ROW ORDER inside each one: `groupFindings` orders the codes
 * worst-first and this file walks that order three times, once per level.
 *
 * **The three levels are given no hue, and that is the mockup's answer to the
 * question the plan raised.** The reconciliation note worried that `.gap` and
 * `.spill` both retarget to `--crit` post-repaint and would collapse `error`
 * and `warn` into one colour — true, and the reason this screen uses neither.
 * What it uses instead is what the mockup uses: a card per level with the
 * level's NAME in its heading. That survives `forced-colors`, survives print,
 * survives a reader who does not know the palette — and it is the same
 * argument the repaint spec makes against category glyphs one section earlier,
 * `docs/superpowers/specs/2026-08-21-web-ui-visual-direction-design.md` · `A glyph beside it repeats what the reader has already been told` · ~191.
 * A `.chip.crit` on every row of a card headed `error` is exactly that
 * repetition. The five meaning hues are therefore unused here, deliberately,
 * and this task's report says so rather than leaving it to be discovered.
 *
 * **The message is the CHECKER'S OWN TEXT.** `doc.d1`…`doc.d5` in the string
 * tables are the mockup's sample sentences for five specific findings, three
 * of which name checks that do not exist yet (they wear the mockup's own
 * `PROPOSED` badge). A real `Finding.message` is composed at run time from the
 * paths, checksums and counts of THIS corpus and cannot be translated by a
 * lookup; rendering `doc.d1` beside a `source_drift` about a different file
 * would be a caption contradicting its own subject. Same treatment every other
 * endpoint string in this UI gets: the producer's words, unedited.
 *
 * **Unedited, and ISOLATED where he QUOTED a machine literal.** The mockup's
 * own `dead_scope` cell reads `scope <span class="m v">src/billing/**</span>
 * matches no file`: the glob is lifted out of the sentence and isolated,
 * because a glob inside prose reorders in an RTL page
 * (`e2e/bidi.spec.ts` · `renders with its segments reversed` · ~6). This
 * screen cannot draw that span's `.v` half — `lib/i18n.js` builds `m v` for an
 * `{mv:}` SLOT and only for one, and nothing here substitutes a value into a
 * translated string. What it has is a literal the PRODUCER wrote, which is the
 * other half of the same pair
 * (`src/ui/public/lib/i18n.js` · `out.push(run('m', payload));` · ~71), and
 * `.m` is precisely what the stylesheet reserves for one
 * (`src/ui/public/styles.css` · `Direction KNOWN ltr: identifiers, paths, globs, commands, flags.` · ~261).
 * So `messageRuns` isolates what he quoted and changes not one character of
 * what he wrote.
 *
 * **The repair command is composed and never run** (spec §4). Which codes get
 * one, and why most do not, is `repairCommandFor`'s docstring — established by
 * reading `src/doctor/checks.ts`'s messages and then the usage banner of every
 * command those messages name. One `.cmd` row per DISTINCT command per card,
 * in the order the rows above it first asked for one, because the mockup draws
 * the commands under the table rather than inside it and two rows sharing a
 * code share a command.
 *
 * **A card whose findings compose nothing draws no `.cmd`, and that is the
 * design of record's own answer rather than a hole in this file.** The
 * mockup's warning card carries a `dead_scope` row and composes NO command for
 * it — the `.cmd` under that card belongs to `watched_docs_no_match`, one of
 * the three PROPOSED checks this build does not have. Measured 2026-08-23
 * against `.demo-corpus`, the corpus `e2e/screen-parity.spec.ts` runs over:
 * `/api/doctor` answers three findings, all `dead_scope`, all `warn`, so the
 * screen draws three cards, three rows and, correctly, not one `.cmd`. That —
 * and not a missing implementation — is why `div.cmd`, `code` and `button` sit
 * in that gate's ledger for this screen; `commandRow` below has built all
 * three since the screen was written, and `screens/work.js` cites it as the
 * precedent for its own.
 *
 * **AND SINCE 2026-08-29 IT SAYS SO RATHER THAN DRAWING BARE.** The paragraph
 * above was correct about every byte it drew and silent about what it did not,
 * which is the shape of half this day's findings. A row whose code composes
 * nothing now carries `doc.norepair` — the strip's own `.chip.unmeas`, two words
 * on screen and the reason in a `title` — and the screen opens with `doc.tally`,
 * the count of findings beside the count that carry a repair. Neither is new
 * data: `repairFor` already answers `null` at the one point where the fact is
 * known. What is new is that the fact is said. `noRepairChip` and `repairTally`
 * carry the owner report and the reasoning.
 *
 * **AND SINCE 2026-09-01 IT SAYS EACH THING ONCE.** Owner, three times in
 * different clothes: *"go over every screen and simplify by using simple words
 * to shorten texts on screen that most of them are long if not very long, it
 * makes them tedious to read and actually user will not read them"*. Measured
 * here rather than argued: 42,353 characters of message on this screen, 34,440
 * of them the same paragraph re-printed per row. `sharedTail` moves the repeat
 * under the table into one `details.help` per code. **Shortened words, never
 * shortened facts** — every row keeps all of what is true of it alone, the
 * removed prose is one click away and complete, and the two halves still join
 * to the producer's message byte for byte.
 *
 * The four keyed sentences on this screen were shortened under the same rule:
 * `doc.v`, `doc.sub`, `doc.zero` and `title.noRepair` each keep every
 * distinction they drew — `doc.zero` is still a MEASURED zero and still says
 * it was checked, and `title.noRepair` still says a person repairs this, still
 * says why no command exists, and still says the absence is the state rather
 * than a missing control.
 *
 * **A clean corpus draws three empty cards, not an empty screen.** Owner
 * ruling: empty renders the real markup with zero rows. A refusal is the other
 * case, and is drawn INSTEAD of the data, in the endpoint's own words.
 */
import { groupFindings, repairTally } from '/lib/viewmodel.js';
import { composeCommand } from '/lib/command.js';
import { PALETTE, commandFor } from '/lib/palette-defs.js';
import { commandActions } from '/lib/command-actions.js';
import { el, errorNote, linkId, mono, screenHead, spaced } from '/screens/parts.js';

/**
 * The catalogue, by name. A Map rather than a repeated `PALETTE.find`, because
 * three of this screen's four repairs are looked up and a linear scan per
 * finding is a scan per row of a table that can be long.
 */
const CATALOGUE = new Map(PALETTE.map((def) => [def.name, def]));

/**
 * A repair that IS a catalogue entry: the id the server will rebuild from, the
 * values it will rebuild with, and the argv composed by the CATALOGUE'S OWN
 * `commandFor` — the same function `src/ui/execute-catalogue.ts` resolves with.
 *
 * Composing here through the entry rather than through a literal argv is what
 * makes the line a reader sees and the line the server runs one computation
 * instead of two that happen to agree today. Weighed against writing the three
 * argvs out, which is shorter and reads fine — and is exactly how a screen ends
 * up showing `mycontext refresh X` above a confirm that names something else.
 */
function catalogued(id, values) {
  const def = CATALOGUE.get(id);
  if (def === undefined) {
    // Not a refusal a reader can act on — the catalogue shipped without an
    // entry this screen names — so it is a bug, and it fails loudly rather
    // than degrading into a Copy-only control that looks deliberate.
    throw new Error(`doctor: the command catalogue declares no "${id}"`);
  }
  return { id, values, argv: commandFor(def, values) };
}

/**
 * **The repair a finding earns, READ off the finding's own declaration.**
 *
 * This function used to BE the decision: four `if`s over four codes, `null` for
 * everything else, with `lib/viewmodel.js`' `repairCommandFor` carrying the
 * identical four in string form. Measured on this repository 2026-09-03: 74
 * findings across five codes, and not one of them named by either table — so
 * every row drew a chip saying there was nothing to offer. Owner, that morning:
 * *"currently doctor contains many items i do not have any way to handle, solve
 * it"*.
 *
 * `reports/V2-HANDOVER.md:437` had the design and recorded it as unbuilt:
 * *"`Finding` in `src/doctor/` must declare its own remedies, never a UI-side
 * table"*. It is built. Every check populates `Finding.remedy`
 * (`src/doctor/checks.ts` · `export type Remedy =` · ~64), and what is left here
 * is the resolution of a route into the shape the control takes.
 *
 * The client sends an id and a value bag and never a command (spec §3.1), which
 * is why the declaration is DATA rather than a line, and why the argv is
 * composed by the CATALOGUE'S OWN `commandFor` — the same function
 * `src/ui/execute-catalogue.ts` resolves with on the server.
 *
 * **`audit --files` names NO id, and that is deliberate.** `PALETTE` carries no
 * `audit` entry, so there is nothing for the server to rebuild;
 * `commandActions` draws Copy alone for a null id, and that is the correct
 * outcome rather than a gap to work around. The check declares that as
 * `route: 'copy'` and carries the argv itself; naming a nearby id instead would
 * put a different command behind a confirm that looked right.
 *
 * **`source_drift` carries `yes: true`, and without it the command cannot run.**
 * Owner-reported 2026-08-28, twice, from this screen:
 *
 *     about to refresh: item REF-… checksum af12674273859b85 -> 244cac0d…
 *     my_context: refusing without confirmation — stdin is not interactive.
 *     Rerun with --yes to confirm, or run this from an interactive terminal.
 *
 * `refresh` REPLACES an item's whole body, so it gates on a human by reading
 * stdin, and a command run from this UI is a child process with no terminal —
 * so it computed the change, printed it, and refused. The dry run that derives
 * the confirm hit the same wall first, so the confirm never rendered either: the
 * button was dead in both directions. The flag now lives in the check's own
 * `refreshRemedy`, which is the only place it can be written once; it is SHOWN,
 * never implied, because it is in the argv this composes and therefore in the
 * `<code>` the reader reads.
 *
 * **`acknowledge` is the route that answers the owner's report.** A finding
 * whose message says the resolution is a judgement — *"which of the two moves is
 * the owner's call"*, *"only a person can tell the two apart"* — gets
 * `mycontext ack <id> <code>`, the verb built for exactly that on 2026-08-27 and
 * unreachable from this UI until now. The id and the code come from the FINDING,
 * never from a copy inside the remedy: two spellings of one id is how a control
 * comes to name a different item from the row it sits on.
 *
 * `null` means `route: 'none'` — the finding names no item, so there is not even
 * a ruling to anchor. The row says which of the two reasons applies; see
 * `noRepairChip`.
 */
export function repairFor(finding) {
  const remedy = finding === null || finding === undefined ? null : finding.remedy;
  if (remedy === null || remedy === undefined) return null;
  if (remedy.route === 'copy') return { id: null, values: {}, argv: remedy.argv };
  if (remedy.route === 'run') return catalogued(remedy.command, remedy.values);
  if (remedy.route === 'acknowledge') {
    const item = finding.item;
    if (typeof item !== 'string' || item === '') return null;
    // `finding:` and not `code:` — the catalogue's second POSITIONAL is keyed
    // `finding` since the bulk form arrived, because `--code` is now a flag on
    // the same entry and one values bag cannot hold two fields of one name. The
    // composed argv is unchanged: a positional is composed by position, so this
    // is still `mycontext ack <id> <code>` byte for byte.
    return catalogued('ack', { id: item, finding: finding.code });
  }
  return null;
}

/**
 * The mockup's three cards, in its order, each with the heading it draws.
 *
 * **All three are keyed now, and two of them were not until 2026-08-30.**
 * `error` and `warning` are LITERALS with no `data-t` in the design of record
 * and only `doc.notice` was keyed, so two of the three card headings stayed
 * English in the Hebrew UI. This comment gave the reason as
 * `test/ui/strings-parity.test.ts` failing "in the direction that names it: a
 * key in a table that the design of record does not declare" — a direction
 * dropped on 2026-08-26 by
 * `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`, three days
 * before this file was last read. The gate's own docstring says which
 * directions it has; a constraint quoted from memory is how a defect outlives
 * its cause. `doc.error` and `doc.warning` are the two new keys, in both
 * tables, and the mockup is untouched — the app is what is built.
 *
 * The heading is also not the level VALUE: `runChecks` emits `warn` and
 * `info`, the mockup writes "warning" and "notice". The level is the join key,
 * the heading is the label, and they are allowed to differ.
 */
const CARDS = [
  { level: 'error', key: 'doc.error' },
  { level: 'warn', key: 'doc.warning' },
  { level: 'info', key: 'doc.notice' },
];

/**
 * One card's rows: every finding at this LEVEL, in `groupFindings`' order.
 *
 * Lifted out of `render` rather than left inside it because THREE decisions
 * live here and spec §6 puts DOM glue outside what any test can reach — which
 * findings a card claims, the order they arrive in, and whether a row names an
 * item at all. `screens/work.js` took the same cut for the same reason
 * (`fieldView`), and `test/ui/doctor-screen.test.ts` reads all three without
 * standing up a `document`.
 *
 * **`item` is normalised to `null` HERE, once.** A `Finding` may omit it, and
 * an empty string is the same fact as an absent one — `linkId('')` would
 * compose a button that opens the detail pane for no item at all. Both become
 * `null`, which is what the em dash below and `repairCommandFor` each read,
 * rather than two spellings of absence drifting apart in two loops.
 *
 * **`remedy` is carried through unchanged**, because it is the finding's own
 * declaration and this row is what every reader of it downstream is handed.
 * Absent on a body served by an older build, which `repairFor` reads as "no
 * route" — the same chip that build already drew, rather than a thrown error
 * over a field it never sent.
 *
 * **`acknowledged` is carried through too, and until 2026-09-03 it was not.**
 * `mycontext ack` writes `Finding.acknowledged`, `runChecks` sets it through
 * `markAcknowledged`, and `/api/doctor` serves it verbatim — `read-model.ts`
 * says so in those words, and adds that *"the Doctor screen still draws an
 * acknowledged finding, marked"* and that *"drawing it is the screen's business
 * and is not done here"*. It was not done here either: this file and
 * `lib/viewmodel.js` between them contained zero occurrences of the word. So
 * the one command 73 of this corpus's 74 findings offer wrote a field nothing
 * read, and running it changed nothing a reader could see.
 *
 * Normalised to a BOOLEAN here, once, for the same reason `item` is normalised
 * to `null` here: a body from a build that predates the field omits it, and
 * `undefined` and `false` are the same fact — nobody has ruled on this — with
 * two spellings that would drift apart in the loop that draws them.
 */
export function cardRows(groups, level) {
  const rows = [];
  for (const [code, findings] of groups) {
    for (const finding of findings) {
      if (finding.level !== level) continue;
      const named = typeof finding.item === 'string' && finding.item !== '';
      rows.push({
        code,
        item: named ? finding.item : null,
        message: finding.message,
        remedy: finding.remedy ?? null,
        acknowledged: finding.acknowledged === true,
      });
    }
  }
  return rows;
}

/**
 * The DISTINCT repair commands one card offers, in the order its rows first
 * asked for them — the ones that answer for MANY rows, and never the ones that
 * answer for one.
 *
 * **`acknowledge` is excluded, and that is the whole shape of the change.** A
 * `mycontext rebuild` is about the CORPUS: every `index_stale` row in the card
 * is settled by the same line, so one block under the table serves all of them
 * and deduping by the composed line is right. A `mycontext ack <id> <code>` is
 * about ONE item and ONE code; there is no sharing to do, and seventy-three of
 * them stacked under a table would be seventy-three controls a reader cannot
 * match to a row. Those are drawn ON the row instead, where the id in the
 * `<code>` is the id in the cell beside it.
 *
 * Nothing here builds a command string. Which code earns one is
 * `repairCommandFor`'s decision and the composition is `lib/command.js`'s, the
 * one place quoting lives in this UI
 * (`src/ui/public/lib/command.js` · `// Command-string composition for every composed write in the UI — the ONE` · ~1),
 * so an id carrying a space is escaped once rather than in a second spelling
 * invented here. `test/ui/doctor-screen.test.ts` pins both halves — the line
 * against the mockup's own `<code>`, and the quoting against an id with a
 * space — because a screen that quietly grew its own composer would still draw
 * a `.cmd` and still look right.
 */
export function cardCommands(rows) {
  const repairs = [];
  const seen = new Set();
  for (const row of rows) {
    if (row.remedy !== null && row.remedy !== undefined && row.remedy.route === 'acknowledge') {
      continue;
    }
    const repair = repairFor(row);
    if (repair === null) continue;
    // Deduped by the composed LINE rather than by the id: two `source_drift`
    // rows about different items are two different repairs under one id, and
    // deduping by id would drop the second item's refresh silently.
    const line = composeCommand(repair.argv);
    if (seen.has(line)) continue;
    seen.add(line);
    repairs.push(repair);
  }
  return repairs;
}

/**
 * **THE SETTLEMENTS ONE CODE OFFERS — the bulk ruling, grouped by code.**
 *
 * `DEC-doctor-gets-a-bulk-settlement-overturning-the-no-bulk-ruling`, owner
 * ruling 2026-09-03, overturning his own no-bulk ruling of 2026-08-31: *"for
 * notices that could be many items, we need to have a capability to fix all of
 * them at once using doctor"*, and *"doctor was added to the app for repairing
 * this is it's role"*. Measured the same day on this repository: 71 findings, 70
 * of them routing to `acknowledge` — seventy confirms and seventy single-use
 * nonces to clear one screen.
 *
 * **WHY RULING PER CODE IS RULING ON ONE THING READ ONCE.** `sharedTail` above
 * exists because 34,440 of this screen's 42,353 characters were one paragraph
 * reprinted per row: thirty-four `body_disagrees_with_meta` rows say the same
 * sentence thirty-four times, and this file already draws that sentence ONCE per
 * code, in a `details.help`, on exactly that ground. A control that rules on the
 * code is a control over the argument the reader has just read in that
 * disclosure. What differs per row is which item it lands on, and the CLI's own
 * preview names every one before it writes.
 *
 * ── WHAT THIS IS NOT: A PER-ROW CHECKBOX ──────────────────────────────────
 *
 * `test/ui/palette-lib.test.ts` rules on that shape in its own words, about the
 * bulk PROMOTE: a checkbox *"moves an unreviewed promotion closer to one click
 * than the CLI puts it. That is a design decision about the approval boundary,
 * not a convenience."* So there is no checkbox and no selection state here. The
 * control is one composed command per code, drawn under the table with the same
 * `.cmd` block and the same Copy-and-Execute the shared repairs already use, so
 * it goes through the same confirm and the same one-shot execution nonce as
 * every other command this UI runs (`src/ui/execute.ts` · the nonce is minted by
 * the GET that renders a confirm and by nothing else).
 *
 * ── THE FOUR THINGS A GROUP MUST BE, AND WHY EACH ─────────────────────────
 *
 *  - **`route === 'acknowledge'`.** Only. Bulk-running `refresh` would rewrite N
 *    bodies, which is a different act with a different gate, and it stays one
 *    item at a time.
 *  - **It NAMES AN ITEM.** An acknowledgement is anchored to an item's content
 *    (`core/acknowledge.ts`), so a finding with no `item` cannot carry one —
 *    `repairFor` already answers `null` for exactly that, and the CLI names such
 *    findings in its skip list rather than dropping them.
 *  - **It is not already acknowledged.** A settled row keeps its row, its chip
 *    and its own control (nothing here filters), but counting it again would put
 *    a number on the button that is larger than the number the command writes —
 *    and the CLI refuses a `--count` that does not match what it finds.
 *  - **TWO AT LEAST.** One finding is not a class: the row already carries
 *    `mycontext ack <id> <code>`, which is shorter, more precise and settles the
 *    same thing. A bulk control for a single row would be a second control for
 *    one act, and the reader would have to work out which one to press.
 *
 * **The group's level is where the code FIRST appears**, and the count is the
 * whole run's rather than that card's. Those two facts belong together: the
 * command is corpus-wide per code, so a card-local count would name a smaller
 * number than the command settles — the one number on this control that must not
 * be a guess. Every code in this corpus sits at one level, so the distinction is
 * invisible today; it is written down because the day a check emits one code at
 * two levels, a card-local count would be silently wrong rather than absent.
 */
export function settleGroups(findings) {
  const byCode = new Map();
  for (const finding of findings ?? []) {
    const remedy = finding.remedy ?? null;
    if (remedy === null || remedy === undefined || remedy.route !== 'acknowledge') continue;
    if (typeof finding.item !== 'string' || finding.item === '') continue;
    if (finding.acknowledged === true) continue;
    const held = byCode.get(finding.code);
    if (held === undefined) {
      byCode.set(finding.code, { level: finding.level, count: 1, items: new Set([finding.item]) });
    } else {
      held.count += 1;
      held.items.add(finding.item);
    }
  }
  const groups = [];
  for (const [code, held] of byCode) {
    if (held.count < 2) continue;
    groups.push({
      code,
      level: held.level,
      count: held.count,
      items: held.items.size,
      // Composed through the CATALOGUE'S OWN `commandFor`, like every other
      // control on this screen: the line the reader reads and the argv the
      // server rebuilds are one computation rather than two that agree today.
      // `count` is a string because the catalogue declares it as text — a
      // number would be refused at the boundary, which is `resolveCommand`
      // being right rather than in the way.
      ...catalogued('ack', { all: true, code, count: String(held.count) }),
    });
  }
  return groups;
}

/**
 * `<p class="small">` naming what the settlement covers, then the command.
 *
 * The sentence sits ABOVE the command and in the reading path to the button,
 * which is where `doc.ackedNoop` already puts the one fact a reader needs before
 * pressing. It names the code, the count and the number of items, and it says
 * the thing about this act that a reader could most easily get wrong: the
 * findings do not go away. `INV-nothing-is-dropped-silently` and
 * `RULE-a-screen-shows-the-new-state-after-the-reader-acts-on-it` agree on that
 * — the latter in its own words, *"It does not require a finding to vanish when
 * it was ACKNOWLEDGED rather than repaired"* — so the row stays, marked.
 *
 * The count is in the COMMAND as well as in the sentence, and that is not a
 * repetition: `--count` is how the CLI is consented to, so the number the reader
 * agrees to is a number they can see in the line they are agreeing to. It is
 * also what makes this control safe to press from a page — there is no `--yes`
 * on `ack`, deliberately (see `cli/commands/ack.ts`), and a count answers the
 * gate identically with a terminal and without one.
 */
function settleBlock(ctx, group) {
  const block = document.createDocumentFragment();
  const note = el('p', 'small');
  note.append(...ctx.t('doc.settle', {
    code: group.code, count: String(group.count), items: String(group.items),
  }));
  // `.small` sets size and colour and no box, so a bare `<p>` would take the
  // user agent's `1em 0` — a physical pair, and a size from nowhere. The
  // stylesheet's own spacing token, set through the CSSOM because
  // `style-src 'self'` carries no `'unsafe-inline'`; `doc.ackedNoop` above and
  // `screens/parts.js`'s `spaced` established this treatment.
  note.style.setProperty('margin-block', 'var(--sp-3) 0');
  block.append(note, commandRow(ctx, group));
  return block;
}

/** A literal the checker delimited: `"a glob"` or `` `a command` ``. */
const QUOTED_LITERAL = /"([^"\n]+)"|`([^`\n]+)`/g;

/**
 * The checker's sentence split at the literals HE marked — text, run, text —
 * so the cell can isolate those and nothing else.
 *
 * **The rule is the producer's own punctuation, never a guess at what looks
 * like a path.** Every message in `src/doctor/checks.ts` that embeds a value
 * wraps it in double quotes
 * (`src/doctor/checks.ts` · `scope glob "${glob}" matches no file in the repository.` · ~396)
 * and every message that names a command wraps it in backticks. A heuristic
 * over slashes and asterisks would isolate half a sentence the first time one
 * of them writes "and/or", and it would have to be re-guessed every time a
 * check is added; a delimiter the producer typed is a fact about the message
 * rather than an inference from it.
 *
 * **The delimiters STAY.** They are his characters, and this screen shows his
 * words unedited — only the isolation is added. Joining the runs reproduces
 * the message byte for byte, which is the first thing the test asserts and the
 * only thing that makes "unedited" checkable rather than claimed.
 *
 * An unbalanced quote matches nothing and falls through to one text run, which
 * is exactly what this screen drew before. The failure mode is the old
 * behaviour, never a dropped clause.
 */
export function messageRuns(message) {
  const text = typeof message === 'string' ? message : String(message ?? '');
  const runs = [];
  let last = 0;
  QUOTED_LITERAL.lastIndex = 0;
  for (let m = QUOTED_LITERAL.exec(text); m !== null; m = QUOTED_LITERAL.exec(text)) {
    const literal = m[1] === undefined ? m[2] : m[1];
    // The OPENING delimiter belongs to the text before the run and the closing
    // one to the text after it, so both survive as his characters.
    const open = m.index + 1;
    if (open > last) runs.push({ mono: false, text: text.slice(last, open) });
    runs.push({ mono: true, text: literal });
    last = open + literal.length;
  }
  if (last < text.length) runs.push({ mono: false, text: text.slice(last) });
  return runs;
}

/** The runs of one message, appended into `node`. One spelling for the cell and the note. */
function appendMessage(node, message) {
  for (const run of messageRuns(message)) {
    node.append(run.mono ? mono(run.text) : document.createTextNode(run.text));
  }
  return node;
}

/** `<td class="small">` — the message, with its quoted literals isolated. */
function messageCell(message) {
  return appendMessage(el('td', 'small'), message);
}

/**
 * **The sentence every finding of one code repeats, found rather than listed.**
 *
 * Measured against this repo's own corpus on 2026-09-01: `/api/doctor` answers
 * 73 findings carrying 42,353 characters of message, and 34,440 of those are
 * the SAME paragraph drawn again. Thirty-four `citation_form` rows share a
 * 943-character explanation of the citation form, word for word; thirty-six
 * `body_disagrees_with_meta` rows share "Read the body against the title and
 * the fields; which of the two moves is the owner's call." Eighty-one per cent
 * of the text on this screen is a re-print, and the owner has reported the
 * effect three times — most exactly as *"58,000 characters of near-identical
 * paragraph"*.
 *
 * So the repeat is factored out and drawn ONCE per code, under the table it
 * belongs to. Every row keeps the whole of what is TRUE OF IT ALONE and loses
 * not one character of it; what leaves the row is only the part that was
 * already on screen N times. The producer's words are still unedited and still
 * complete on the screen — `row text + shared tail` is the message byte for
 * byte, which is asserted rather than taken on trust.
 *
 * **The cut is the producer's own sentence boundary, never a character count.**
 * The common suffix is computed backwards over the messages, then advanced to
 * the first sentence break inside it, so the row keeps a finished sentence and
 * the note begins with one. A truncation at N characters would cut mid-clause
 * and would be a different sentence rather than a shorter one.
 *
 * Three guards, and each answers a way this could lie:
 *   - two messages at least, or there is no repetition to factor;
 *   - `SHARED_MIN` characters at least, so a shared full stop earns no
 *     disclosure;
 *   - every row must keep WORDS of its own, so two identical messages never
 *     collapse into two blank rows and one note.
 * Fail any of them and the answer is the empty string — the screen draws
 * exactly what it drew before, which is the safe direction for a defect here.
 */
const SHARED_MIN = 60;

/** One letter or one digit — what "the row still says something" means. */
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export function sharedTail(messages) {
  if (messages.length < 2) return '';
  let suffix = messages[0];
  for (const message of messages.slice(1)) {
    let same = 0;
    while (same < suffix.length && same < message.length
      && suffix[suffix.length - 1 - same] === message[message.length - 1 - same]) same += 1;
    suffix = suffix.slice(suffix.length - same);
    if (suffix === '') return '';
  }
  const boundary = /[.!?]\s+/.exec(suffix);
  if (boundary === null) return '';
  const tail = suffix.slice(boundary.index + boundary[0].length);
  if (tail.length < SHARED_MIN) return '';
  for (const message of messages) {
    // WORDS of its own, not merely characters: a message whose whole first
    // 'sentence' is the punctuation that opened it would pass a trim() and
    // still leave a row saying '.' beside a note holding everything.
    if (!LETTER_OR_DIGIT.test(message.slice(0, message.length - tail.length))) {
      return '';
    }
  }
  return tail;
}

/**
 * One card's shared tails, by code, in the order the rows first asked — the
 * same ordering rule `cardCommands` uses, and for the same reason: the reader
 * meets the notes in the order the table introduced their codes.
 */
export function sharedNotes(rows) {
  const byCode = new Map();
  for (const row of rows) {
    const held = byCode.get(row.code);
    if (held === undefined) byCode.set(row.code, [row.message]);
    else held.push(row.message);
  }
  const notes = new Map();
  for (const [code, messages] of byCode) {
    const text = sharedTail(messages);
    if (text !== '') notes.set(code, { count: messages.length, text });
  }
  return notes;
}

/**
 * `<details class="help"><summary>…<div class="helpbox">` — the disclosure the
 * mockup already draws on Decay, holding the paragraph the rows stopped
 * repeating
 * (`docs/design/web-ui-mockup.html` · `<details class="help"><summary data-t="help.whyCold">` · ~2754).
 *
 * Closed by default and one click from open, which is the owner's own pattern:
 * a short line on screen with the full body behind it. It is a SIBLING of the
 * table rather than a row inside it — the note is about a code, not about any
 * one finding, and a row spanning three columns to hold it would say otherwise.
 */
function sharedNoteBlock(ctx, code, note) {
  const box = el('details', 'help');
  const summary = el('summary');
  summary.append(...ctx.t('doc.shared', { code: code, count: String(note.count) }));
  box.append(summary, appendMessage(el('div', 'helpbox'), note.text));
  return box;
}

/**
 * **`no automated repair` — the row saying what it has, instead of drawing
 * bare.**
 *
 * Owner, 2026-08-28: *"doctor lost it's execute an fix controls ? why yo broke
 * it ?"* Nothing had. That day cleared nine `source_file` links, which retired
 * every `source_drift` — the code that had been supplying most of this screen's
 * controls — and `plan:categories seq:21` added `blocked_without_needs`, whose
 * remedy is a PERSON naming a blocker and which is correctly not automatable.
 * The corpus got healthier and the toolbar went quiet, and **quiet is what
 * broken looks like**. The reaction was the cost of the silence, not a
 * misreading of it.
 *
 * `repairFor` already answers `null` at the one point where the fact is known,
 * so the disclosure needs no new data and no new endpoint — only somewhere to
 * be said.
 *
 * **The primitive is the strip's, not a fourth spelling of it.** `app.js`'s
 * `stateChip` draws `strip.unread`, `strip.unmeasured` and `screen.unread` as
 * `span.chip.unmeas` with `data-g="◌"` and the reason in a `title`
 * (`src/ui/public/app.js` · `chip.className = 'chip unmeas';` · ~1514), under
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`. The same
 * shape, the same glyph, the same split of two words on screen and the sentence
 * in the title. That function is module-private to the shell and this screen
 * imports nothing from `app.js`, so the element is rebuilt here rather than
 * shared; what must not diverge is the VOCABULARY, and it does not.
 *
 * **Neutral, and that is a decision.** `.chip.unmeas` borrows no meaning hue —
 * an absent repair is not a warning, and this screen already argues one section
 * up that the level's own card heading is where severity is said. A `.chip.warn`
 * here would give a `notice` row a warning's colour for the crime of being
 * ordinary.
 *
 * **In the message cell, after the message, which is where the mockup puts a
 * badge about a row.** `<span class="prop">PROPOSED</span>` sits exactly there
 * on three of its own rows
 * (`docs/design/web-ui-mockup.html` · `repo has none of them.</span> <span class="prop">PROPOSED</span>` · ~2217).
 * A fourth `<td>` would change the table's shape for a fact that is about the
 * finding rather than a column of its own.
 */
function noRepairChip(ctx, remedy) {
  // **Two sentences now, not one, because there are two reasons and they are
  // not the same fact.**
  //
  // `why: 'person'` is a PATH entry, a `.gitignore` line, a key in
  // `config.json`, a doctor check that threw — settled by a person, outside
  // my_context, and naming no item, so there is not even an acknowledgement to
  // anchor. `why: 'nothing'` is a finding that asks for no action at all:
  // `index_missing` says the index "is disposable and will be built on the next
  // command"; `nested_corpus` says "nothing is wrong with it existing". Drawing
  // "no automated repair" over that second group described the product instead
  // of the finding — true, and about the wrong thing.
  //
  // Everything else about the chip is unchanged, including the reason it exists
  // at all: a missing control reads as a bug and a named state reads as a state.
  const chip = el('span', 'chip unmeas');
  chip.dataset.g = '◌';
  // The four keys are named as LITERALS, in two branches, rather than picked by
  // a ternary inside the call. `test/ui/doctor-screen.test.ts` finds the keys a
  // screen names by scanning these bytes for a translation call whose key is a
  // string literal — a key chosen
  // by an expression is invisible to it, and the two assertions that every
  // named key is declared in both tables would pass by finding nothing.
  //
  // `tFlat` for the title because an attribute cannot hold an element — the
  // same reason `stateChip` flattens, and the flattening is lossless here:
  // neither key carries an isolated run.
  if (remedy !== null && remedy !== undefined && remedy.why === 'nothing') {
    chip.append(...ctx.t('doc.noaction'));
    chip.title = ctx.tFlat('title.noAction');
    return chip;
  }
  chip.append(...ctx.t('doc.norepair'));
  chip.title = ctx.tFlat('title.noRepair');
  return chip;
}

/**
 * **`acknowledged` — a person read this finding and ruled on it, said on the
 * row.**
 *
 * Owner, 2026-09-03: *"check the doctor using playright, it looks like the run
 * do nothing"*. Driven in Chrome the same day, `ack` DID run: 200, `exitCode:
 * 0`, the field written. What it had no way to show is that anything had
 * happened, because this screen never read `Finding.acknowledged` — a repo-wide
 * grep over `screens/doctor.js` and `lib/viewmodel.js` returned zero
 * occurrences of the word. `read-model.ts` carries the field verbatim and says
 * whose job the drawing is; this is that job.
 *
 * ── IT IS A MARK, AND IT IS NOT A FILTER ──────────────────────────────────
 *
 * Owner ruling 2026-08-27, argued at length in `src/core/acknowledge.ts`:
 * *"An acknowledged finding is still computed, still reported, still counted,
 * and still contributes to the exit code."* The CLI's own stdout says the same
 * sentence to the person who runs `ack`: *"They are still reported and still
 * counted in the numbers above."*
 *
 * So the row stays in its card, in its level, in `doc.tally`'s finding count,
 * and keeps the control it had. Nothing here hides, drops, sorts or dims a
 * finding out of the way. The one thing that changes is that the row now SAYS
 * which of the two states it is in, which is the whole of what was missing.
 *
 * ── WHAT IT LOOKS LIKE, AND WHY THIS SHAPE ────────────────────────────────
 *
 * **The design of record does not answer this question.** `docs/design/web-ui-mockup.html`
 * contains the string "acknowledg" zero times, and its `<section data-p="doctor">`
 * draws no settled, ruled-on or marked row of any kind. Under
 * `INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask` that is a
 * QUESTION FOR THE OWNER and not a licence to invent, so what is built here is
 * the most conservative thing available: **this screen's own existing
 * vocabulary for a row-level state**, not a new one.
 *
 * That vocabulary is `noRepairChip` above — `span.chip` in the message cell,
 * after the message, with the word on screen and the sentence in a `title` —
 * which is itself `app.js`'s `stateChip` primitive, which is
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`. The mockup
 * puts a row badge in exactly that position (`<span class="prop">PROPOSED</span>`,
 * inside the message `<td>`, on three of its own rows).
 *
 * `chip index` and NOT `chip unmeas`, and not a meaning hue:
 *
 *   - not `unmeas`, because that is taken and means something else on this very
 *     screen — "nothing here, and here is why". An acknowledged finding is the
 *     opposite of unmeasured: it is the one row on the screen somebody has
 *     definitely looked at.
 *   - not `ok`/`warn`/`crit`/`gov`/`carry`. `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn`
 *     caps the meaning hues at five, and this screen's own header argues that
 *     severity is said by the card heading and nowhere else. `.chip.ok` would
 *     tell a reader the finding was resolved, and it is not — it is ruled on and
 *     still counted, which is a different fact and the one the ack design is
 *     most careful about.
 *   - `index` is the stylesheet's declared SECOND NEUTRAL, ruled 2026-08-31,
 *     whose documented meaning is exactly this: *"PRESENT, and quieter than the
 *     things around it"*. It spends `--dim`/`--edge-3`/`--sink` — decoration and
 *     structure, no meaning hue at all — and it carries no `::before` of its
 *     own, so the glyph is the call site's to name.
 *
 * `●` is that glyph: the "present" mark this shell already uses, never `◌`,
 * which is absence. Colour is not the only carrier and neither is shape — the
 * WORD inside the chip is, which is the stylesheet's own rule for telling two
 * neutrals apart, and it is why this is legible in print and in forced-colors.
 *
 * **No new class**, so nothing here depends on a stylesheet change: `.chip` and
 * `.chip.index` are both already shipped rules.
 */
function acknowledgedChip(ctx) {
  const chip = el('span', 'chip index');
  chip.dataset.g = '●';
  chip.append(...ctx.t('doc.acked'));
  // `tFlat` because an attribute cannot hold an element — `noRepairChip`'s own
  // reason, and lossless here for the same reason: the key carries no isolated
  // run.
  chip.title = ctx.tFlat('title.acked');
  return chip;
}

/**
 * `<div class="cmd"><code>…</code></div>` — the mockup's command row — followed
 * by the ONE Copy-and-Execute control.
 *
 * **The hand-rolled Copy button is gone, and that is the point of the task
 * rather than a tidy-up.** It was one of nine across `screens/`, each with its
 * own error handling and its own words; adding Execute nine times would have
 * been nine chances to get the confirm wrong, and the confirm is the security
 * boundary. `lib/command-actions.js` is the one spelling, and the two keys this
 * button used to owe the mockup are its problem now, not this screen's.
 *
 * **The control is a SIBLING of `.cmd`, not a child of it, and that is the
 * defect the owner reported on 2026-08-27 rather than a layout preference.**
 * `styles.css`'s only global button rule is `button{font:inherit;color:inherit}`
 * — colour and NO background — so a button's readability comes from an ancestor
 * rule. `.cmd button` is why the old Copy looked right; `.cmdactions button`
 * carries its own background precisely so the shared control does not depend on
 * which of six containers it lands in. Nesting it inside `.cmd` would work
 * today and would quietly reintroduce that dependency, and `.cmd` is a
 * one-line flex row that the confirm's table and residual do not fit in.
 *
 * A fragment, because the mockup's `.cmd` is one element and the control is
 * another: wrapping them in a new `<div>` would invent a class the design of
 * record does not draw, or a classless one — and a classless container is
 * exactly what made the Composer's read button invisible.
 */
function commandRow(ctx, repair) {
  const block = document.createDocumentFragment();
  const box = el('div', 'cmd');
  box.append(el('code', null, composeCommand(repair.argv)));
  block.append(box, commandActions({
    argv: repair.argv, id: repair.id, values: repair.values, ctx,
  }));
  return block;
}

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'doc.h', 'doc.v', 'doc.sub');

  let data;
  try {
    data = await ctx.api('/api/doctor');
  } catch (error) {
    // Drawn INSTEAD of the three cards, never beside them: a doctor that could
    // not run and a corpus with no findings are opposite facts, and three
    // empty cards would report the good one.
    root.append(errorNote(error.message));
    return;
  }

  // **THE TALLY, and it is drawn at every count including zero.**
  //
  // "findings: 2 · with an automated repair: 0" is a different sentence from an
  // empty toolbar, and it is the one a reader can act on. It sits ABOVE the
  // cards rather than inside one because it is a fact about the whole run: the
  // repairs are spread across three cards, and a number in one of them would be
  // a fraction of the wrong denominator.
  //
  // AFTER the fetch, never before, and for the reason `errorNote` returns above:
  // a doctor that could not run and a corpus with no findings are opposite
  // facts, and a tally reading zero would report the good one over a refusal.
  //
  // The two slots are spelled out rather than spread from `tally`, because the
  // scan in `test/ui/viewmodel.test.ts` that proves every `{slot}` a key
  // declares is actually supplied reads the ARGUMENT LITERAL — a spread it
  // cannot see is a substitution nothing checks, and `t()` throws on a missing
  // one at render time rather than leaving braces on screen.
  //
  // ── THE FOURTH FIGURE, AND WHY `settle` DID NOT MOVE ─────────────────────
  //
  // The question asked on 2026-09-03 was whether "yours to settle" should stop
  // counting findings a person has already ruled on. **It should not**, and the
  // reason is what that number IS. `lib/viewmodel.js`'s `repairTally` says it
  // in its own words — *"`settle` is the count of rows that now carry
  // `mycontext ack`"* — and `test/ui/doctor-screen.test.ts` pins the
  // consequence as an equality: rows-drawing-a-chip + `repairs` + `settle` is
  // exactly `findings`, "a row counted twice or not at all is the screen
  // disagreeing with its own summary". An acknowledged row still carries its
  // ack control, so subtracting it would leave a row counted in none of the
  // three columns and reintroduce `plan:walk seq:61`'s defect — a summary that
  // contradicts the rows underneath it — while fixing the one above it.
  //
  // The question a badge asks — how much is waiting for YOU — is a real
  // question and it already has a correct answer on a different surface:
  // `read-model.ts`'s `health` excludes acknowledged findings from
  // `errors`/`warnings`/`infos`, argued there from the owner's own report, and
  // that is what the rail's gold count reads. Two surfaces, two questions, both
  // answered; folding one into the other would break a partition to duplicate
  // an answer.
  //
  // What was genuinely missing is the number itself, so it is ADDED rather than
  // subtracted. `read-model.ts` took the same decision for the same reason when
  // it started excluding them from the badge: *"`acknowledged` is served beside
  // them so nothing is dropped silently … a tally that made them vanish with no
  // count would undo that."* Nothing vanishes here either — `findings` is still
  // the whole run.
  //
  // Counted HERE, off the served body, rather than added to `repairTally`:
  // `repairTally` is a partition by REMEDY ROUTE and this is not a route, and
  // three tests in two files pin its return shape whole.
  const tally = repairTally(data.findings);
  const acked = data.findings.filter((f) => f.acknowledged === true).length;
  const summary = el('p', 'small');
  summary.append(...ctx.t('doc.tally', {
    findings: tally.findings, repairs: tally.repairs, settle: tally.settle, acked: acked,
  }));
  // `.small` carries no margin and `.card` only a bottom one, so this would
  // otherwise sit flush against the first card's top edge and read as part of
  // it. Set through the CSSOM and never as an attribute — `style-src 'self'`
  // carries no `'unsafe-inline'` — and with a LOGICAL property and the
  // stylesheet's own spacing token, which is the treatment `screens/parts.js`'s
  // `spaced` established for exactly this
  // (`src/ui/public/screens/parts.js` · `e.style.setProperty('margin-block-start', '8px');` · ~55).
  summary.style.setProperty('margin-block-end', 'var(--sp-3)');
  root.append(summary);

  const groups = groupFindings(data.findings);

  // **The bulk settlements, computed ONCE over the whole run and drawn once
  // each.** `settleGroups` reads every finding rather than one card's rows,
  // because `mycontext ack --all --code <code>` is corpus-wide per code and a
  // card-local count would name a number smaller than the command settles. A
  // code lands in the card of the level it first appears at, and `settled`
  // stops it being drawn a second time if it ever appears at two.
  const settlements = settleGroups(data.findings);
  const settled = new Set();

  for (const card of CARDS) {
    const pane = el('div', 'card pane');
    const heading = el('h3');
    heading.append(...ctx.t(card.key));

    const table = el('table');
    const tbody = el('tbody');
    const rows = cardRows(groups, card.level);
    // Computed once per card and read twice below: once to shorten each row,
    // once to draw the note. Asking per row would recompute one suffix over
    // thirty-four messages thirty-four times.
    const notes = sharedNotes(rows);

    for (const row of rows) {
      const tr = el('tr');
      tr.append(el('td', 'm', row.code));

      // `item` is OPTIONAL on a Finding and its absence is real —
      // `watched_docs_no_match` and `audit_log_size` name none. The mockup
      // draws an em dash for exactly that row, which is this design's own
      // mark for "no value here"; an empty cell would read as a bug.
      const who = row.item === null ? el('td', 'small', '—') : el('td');
      if (row.item !== null) who.append(linkId(row.item, false));

      // The row keeps everything true of it alone; the shared remainder is
      // drawn once under the table. `slice` and never a trim: the two halves
      // must still join to the producer's message byte for byte.
      const note = notes.get(row.code);
      const message = messageCell(note === undefined
        ? row.message
        : row.message.slice(0, row.message.length - note.text.length));
      // **The row says what it HAS, and where that is a command only this row
      // can run, it draws the command.**
      //
      // Three endings, and every finding reaches exactly one of them:
      //
      //   route `acknowledge`  the control is HERE, in the cell, because
      //                        `mycontext ack <id> <code>` answers for this row
      //                        and no other. This is the ending the owner's
      //                        2026-09-03 report was missing — 73 of this
      //                        corpus's 74 findings take it.
      //   route `run`/`copy`   the control is under the table, shared by every
      //                        row of its code (`cardCommands`), so the cell
      //                        adds nothing.
      //   route `none`         a chip naming which of the two reasons applies.
      //
      // `repairFor` is asked once per row here and again inside `cardCommands`;
      // that is two calls to a pure reader of one declaration, and it keeps the
      // cell and the `.cmd` block reading the same field rather than this loop
      // passing a flag down to it.
      // **The ruling comes FIRST, before whatever the row offers to do next.**
      // "A person has read this and ruled on it" is a fact about the finding;
      // the chip or the control after it is about what is left to do. Drawn on
      // its own condition rather than folded into the three endings below,
      // because it is orthogonal to all three: a finding can be acknowledged
      // and still carry a shared repair, and one that names no item can never
      // be acknowledged at all.
      if (row.acknowledged) {
        message.append(document.createTextNode(' '), acknowledgedChip(ctx));
      }
      const repair = repairFor(row);
      if (repair === null) {
        message.append(document.createTextNode(' '), noRepairChip(ctx, row.remedy));
      } else if (row.remedy.route === 'acknowledge') {
        // **Still drawn on an acknowledged row, and that is the ruling rather
        // than an oversight.** The mark is a mark and not a filter, so nothing
        // about the row is taken away by it — and `mycontext ack --clear` is
        // the command that would undo a ruling, which is a different control
        // with a different confirm and a decision the owner has not taken.
        // Swapping the row's command out from under the reader on the strength
        // of a guess is the wider change; leaving the row as it was is the
        // conservative one.
        //
        // ── WHAT IT NOW SAYS FIRST, AND WHY THAT IS THE WHOLE CHANGE ───────
        //
        // Owner, 2026-09-03: *"clicked execute, clicked run it but nothing has
        // changed"*. Nothing had. His finding was already acknowledged at
        // 00:17, so the 07:29 run re-ran `ack` against a current ruling and the
        // CLI answered, correctly, *"already acknowledges … Nothing was
        // written"* (`src/core/mutate.ts` · the `before === 'current'` return).
        // The row had offered a button that could not do anything, with nothing
        // on it to say so, and the reader spent an Execute, a confirm and a
        // full-corpus dry run finding that out.
        //
        // **The minimum that stops the row lying is a sentence, not a different
        // control.** It sits directly above the command, in the reading path to
        // the button rather than at the tail of a 420-character paragraph, and
        // it states the one fact the reader needs BEFORE pressing: this is
        // already settled, and running it again writes nothing.
        //
        // **Two questions are deliberately left OPEN, because they are the
        // owner's**: whether an acknowledged row should offer `ack --clear`
        // instead of `ack`, and what an acknowledged row should look like. This
        // answers neither. Nothing is swapped, nothing is hidden, no chip moves,
        // no hue is spent — `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn`
        // is untouched and `docs/design/web-ui-mockup.html` still contains
        // "acknowledg" zero times, so there is still no design of record to
        // build against. What is added is a true statement where a false
        // impression was; the design ruling is still his to give.
        if (row.acknowledged) {
          const noop = el('p', 'small');
          noop.append(...ctx.t('doc.ackedNoop'));
          // `.small` sets size and colour and no box, so a `<p>` here would take
          // the user agent's `1em 0`: a physical pair, and a size from nowhere.
          // Replaced with the stylesheet's own spacing token, set through the
          // CSSOM and never as an attribute — `style-src 'self'` carries no
          // `'unsafe-inline'`. This is the treatment `screens/parts.js`'s
          // `spaced` established and the tally summary above already follows.
          noop.style.setProperty('margin-block', 'var(--sp-2) 0');
          message.append(noop);
        }
        message.append(commandRow(ctx, repair));
      }

      tr.append(who, message);
      tbody.append(tr);
    }

    table.append(tbody);
    pane.append(heading, table);

    // **A LEVEL WITH NO FINDINGS SAYS SO.** Until 2026-08-26 an empty level
    // rendered as a heading over an empty `<tbody>` and nothing else — a card
    // headed `error` containing nothing, which reads AS an error rather than as
    // the absence of one (`plan:walk seq:34`).
    //
    // `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`: a
    // measured zero is drawn and named, and is never blank. This IS a measured
    // zero — `runChecks` ran and this level had none — and it is reachable only
    // here, because a doctor that could not run takes the `errorNote` branch
    // above INSTEAD of the cards. So the two facts cannot be confused: a
    // refusal replaces the cards, an empty level names itself inside one.
    //
    // The owner ruling at the head of this file is untouched: "a clean corpus
    // draws three empty cards, not an empty screen". The card still draws. What
    // it no longer does is stay silent inside.
    if (rows.length === 0) {
      const zero = el('p', 'small');
      zero.append(...ctx.t('doc.zero'));
      pane.append(spaced(zero));
    }

    for (const [code, note] of notes) pane.append(sharedNoteBlock(ctx, code, note));

    for (const repair of cardCommands(rows)) pane.append(commandRow(ctx, repair));

    // **AFTER the shared repairs, and that ordering is a reading order rather
    // than a preference.** A `.cmd` under this table either REPAIRS its code —
    // `mycontext rebuild` makes `index_stale` stop being true — or RULES on it,
    // which leaves every row exactly where it is and marks it. The repairs come
    // first because they are the shorter question; the settlement comes last
    // because it is the one that needs the sentence above it read.
    for (const group of settlements) {
      if (group.level !== card.level || settled.has(group.code)) continue;
      settled.add(group.code);
      pane.append(settleBlock(ctx, group));
    }
    root.append(pane);
  }
}
