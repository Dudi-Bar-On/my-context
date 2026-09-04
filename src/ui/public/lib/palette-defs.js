// The command catalogue (spec §4, Work: "build a command from selections and
// inputs, with real pickers and a live glob tester"). Write commands are
// COMPOSED AND COPIED with the on-screen note — per spec §2 the only treatment
// of a write anywhere in this UI. Read commands EXECUTE: they navigate to the
// screen that renders the answer, or fetch the endpoint that serves it.
//
// ── WHY THIS FILE IS A LIST AT ALL, AND WHAT STOPS IT GOING STALE ──────────
//
// A hand-kept list of commands is a defect waiting to happen; this repository
// has already paid for four of them (§7 of both READMEs, the recommended deny
// block, and the skill, each of which went stale on the day a command shipped
// — see `test/helpers/approval-boundary.ts`). The honest answer would be to
// derive this catalogue from the CLI's own registry at load time. A browser
// module cannot: there is no bundler, no build step and no runtime dependency,
// and the registry is TypeScript that only Node ever loads.
//
// So the list is here, and EVERY claim it makes is derived somewhere else and
// compared against it. `test/ui/palette-lib.test.ts` runs the real CLI and
// fails this file when:
//
//   * a def names a command string the registry does not have (derived from
//     `COMMANDS` and the four `SUBCOMMANDS` exports);
//   * a def advertises a flag the command refuses, or omits one it accepts
//     (derived by probing the real argument parser, the same probe
//     `approval-boundary.ts` uses, with every omission named and reasoned);
//   * a def's `boundary` or `ungated` marking disagrees with
//     `approvalBoundary()` (derived from which command strings the parser
//     accepts `--yes` on);
//   * any argv this file composes is one the real parser REFUSES.
//
// That last one is the load-bearing check. It is why `--always` on `edit`
// carries `joined: true` below: `mycontext edit <id> --always false` is
// refused outright ("unexpected argument \"false\"") while `--always=false` is
// the form that unsets, and a catalogue that composed the first would hand the
// user a broken command with every other test in this file still green.
//
// ── WHAT THIS FILE WILL NOT DO ────────────────────────────────────────────
//
// It composes. It does not run, and it holds nothing that could: no network
// name, no dynamic evaluation, no navigation, no import of any kind. That is
// checked over these bytes, not promised — see `command.js`'s header.
//
// **Promotion stays a human act, at CLI distance.** Both READMEs and the skill
// say an agent must never promote on a user's behalf, and the gate that makes
// that mean something is a person reading a command and running it. Every
// promotion here therefore composes exactly what the CLI takes, `--yes` shown
// rather than hidden, one item named by id. `review promote --all --pack
// <name>` — every draft a pack imported, settled in one confirmation — is a
// real flag pair and is deliberately NOT offered: turning a bulk promotion
// into a checkbox is a design decision about how close to one click an
// unreviewed promotion should sit, and this task is not the place to take it.
// `FLAGS_NOT_OFFERED` in the test names it, so adding it later means editing a
// test that states the reason rather than editing a list that does not.
//
// **`ack --all --code <code>` IS offered, and the two are not the same
// question.** A bulk PROMOTION makes N items start governing a project; a bulk
// ACKNOWLEDGEMENT changes nothing about what governs anything — it records that
// a person read one argument that N findings share, and every one of those
// findings stays computed, stays reported and stays counted afterwards. The
// owner overturned his own no-bulk ruling for that act and not for the other
// (`DEC-doctor-gets-a-bulk-settlement-overturning-the-no-bulk-ruling`), so the
// paragraph above stands unchanged and this one sits beside it.

/** `--yes`, spelled once. On the approval boundary it is SHOWN, never implied. */
const yes = { name: 'yes', boolean: true };

export const PALETTE = [
  // --- writes: composed, copied, never executed --------------------------
  {
    // **`mycontext ack <id> <code>` — a person rules on a doctor finding.**
    //
    // Owner ruling 2026-08-27, argued in `src/core/acknowledge.ts`; the verb
    // shipped the same day and reached NO surface in this UI until 2026-09-03.
    // Owner, that morning: *"currently doctor contains many items i do not have
    // any way to handle, solve it"*. Doctor drew a repair control for four
    // finding codes and a chip saying "no automated repair" for every other —
    // 74 rows out of 74 on this repository's own corpus. `ack` is the designed
    // route for a finding whose resolution is a JUDGEMENT rather than a
    // command, and it is now what those rows offer.
    //
    // `test/ui/palette-lib.test.ts` carried the reason it was absent, and the
    // reason names exactly what changed: *"a control that composed a usable
    // line would have to be driven by the doctor read model rather than by a
    // flag declaration"*. `Finding.remedy` (src/doctor/checks.ts) IS that read
    // model — the check that emits a finding declares whether a person settles
    // it — so the row is deleted and this entry stands in its place.
    //
    // **`boundary: false`, derived and not chosen.** `mycontext ack` accepts no
    // `--yes` (`COMMAND_FLAGS.ack`), and `approvalBoundary()` reads the
    // boundary off exactly that, so the marking is what the real parser says.
    // It is the honest answer as well as the derived one: an acknowledgement
    // changes nothing about what GOVERNS this project — it records that a
    // person read a finding, against the item as it stands — which is `ack.ts`'
    // own argument for why this is a verb and not a flag on `edit`.
    //
    // `--list` is deliberately not offered; see `FLAGS_NOT_OFFERED` in
    // `test/ui/palette-lib.test.ts`.
    // **The bulk form, added 2026-09-03.** `--all --code <code> --count <n>`
    // rules on every finding of one code in one act
    // (`DEC-doctor-gets-a-bulk-settlement-overturning-the-no-bulk-ruling`,
    // owner: *"for notices that could be many items, we need to have a
    // capability to fix all of them at once using doctor"*). The measured
    // pressure: 71 findings here, 70 of them routing to `acknowledge` — seventy
    // confirms and seventy single-use nonces to clear one screen.
    //
    // **`--count` is the consent and there is still no `--yes`**, which is why
    // this entry keeps `boundary: false` and keeps the plain confirm. The
    // argument is `cli/commands/ack.ts`'s and is not repeated here; the half
    // that belongs to this file is that `approvalBoundary()` derives the
    // boundary from which commands accept `--yes`, so putting one on `ack`
    // would flip this marking and would additionally buy every SINGLE
    // acknowledgement a full-corpus dry run it does not need.
    //
    // **The second positional is keyed `finding` and not `code`.** One values
    // bag cannot hold two fields of one name, and `--code` is a flag on the
    // same command. The KEY is invisible on the command line — a positional is
    // composed by position — so the composed argv is `ack <id> <code>` exactly
    // as it always was; only the name callers pass it under changed.
    // `notWith`/`onlyWith` on the fields below are what let one entry compose
    // both forms; see `commandFor`.
    //
    // **AND THE BULK TRIO IS NOT OFFERED ON THE COMPOSER.** It sits in
    // `flagsNotOffered` rather than in `flags`, which is this file's way of
    // saying *composable here, never drawn there* — see `commandFor`'s header
    // for the mechanism and for why it is a second LIST rather than a marker on
    // a flag.
    //
    // The reason is the settlement decision's own. What the owner approved is a
    // control **on the Doctor card, per code group**: a bulk act is licensed by
    // a NAMED, BOUNDED SET the human just chose, the full preview prints before
    // the gate, and `--count` is consent to a number the reader can see in the
    // line they are agreeing to. `screens/doctor.js`' `settleGroups` builds
    // exactly that, from findings it has counted, beside a sentence naming what
    // the ruling covers. A checkbox in this flag list composes the SAME argv and
    // is not the same act: the Composer draws no findings at all, so ticking
    // `--all` there settles a class nobody has looked at. That is the cost
    // `DEC-a-stale-summary-that-is-still-correct-is-cleared-by-passing` names
    // and the settlement decision inherits — a one-token flag that could settle
    // a corpus without a single finding being read is refused — and it is the
    // same approval-boundary ruling that keeps `review promote --all --pack`
    // off this screen. Both trios' reasons are written down in
    // `FLAGS_NOT_OFFERED` in `test/ui/palette-lib.test.ts`, so a withheld flag
    // is a decision on the record rather than an omission.
    name: 'ack', kind: 'write', base: ['mycontext', 'ack'], boundary: false,
    args: [
      { name: 'id', source: 'items', required: true, notWith: 'all' },
      { name: 'finding', input: 'text', required: true, notWith: 'all' },
    ],
    flags: [
      { name: 'clear', boolean: true },
    ],
    flagsNotOffered: [
      { name: 'all', boolean: true },
      { name: 'code', input: 'text', required: true, onlyWith: 'all' },
      { name: 'count', input: 'text', required: true, onlyWith: 'all' },
    ],
  },
  {
    name: 'add', kind: 'write', base: ['mycontext', 'add'], overlap: true, boundary: true,
    args: [
      { name: 'category', source: 'categories', required: true },
      { name: 'title', input: 'text', required: true },
    ],
    // `--note`, `--observation`, `--step` and `--extra` are repeatable at the
    // CLI and single-valued here: this model is one value per flag, and a
    // screen that needed two steps would have to grow a repeat control rather
    // than quietly compose one. `--observation` additionally carries two
    // fields in one value (`kind=text`, the shape `--extra` already uses), so
    // the placeholder its declaration supplies is what tells a composer the
    // "=" is not optional.
    flags: [
      { name: 'body', input: 'textarea' }, { name: 'file', input: 'text' },
      { name: 'note', input: 'text' }, { name: 'observation', input: 'text' },
      { name: 'step', input: 'text' },
      { name: 'summary', input: 'text' },
      { name: 'scope', input: 'glob' }, { name: 'tags', input: 'text' },
      { name: 'severity', options: ['hard', 'soft'] },
      { name: 'valid-from', input: 'text' }, { name: 'extra', input: 'text' },
      yes,
    ],
  },
  {
    // **`mycontext config <name> --delete|--disable [--yes]`** — disables or
    // deletes a whole CATEGORY rather than any one item. `rulings/20`, owner
    // ruling 2026-09-04, given directly: "a config writer with DELETE (custom
    // categories only — shipped ones are never deletable), DISABLE for
    // shipped ones, --yes for Execute, backup-before-write, and an item-count
    // warning before a change touching many items."
    //
    // **`boundary: true`, derived and not chosen.** `mycontext config` takes
    // `--yes` (`COMMAND_FLAGS.config`), and `approvalBoundary()` reads the
    // boundary off exactly that. `--delete` and `--disable` name two
    // different acts on the category named by the positional; the CLI
    // refuses a line carrying both, and it is one this catalogue can compose
    // — the sweep in `test/ui/palette-lib.test.ts` exercises one flag at a
    // time, which is also the only combination a reader building one command
    // would ever want.
    name: 'config', kind: 'write', base: ['mycontext', 'config'], boundary: true,
    args: [{ name: 'category', source: 'categories', required: true }],
    flags: [
      { name: 'delete', boolean: true },
      { name: 'disable', boolean: true },
      yes,
    ],
  },
  {
    name: 'edit', kind: 'write', base: ['mycontext', 'edit'], boundary: true,
    args: [{ name: 'id', source: 'items', required: true }],
    flags: [
      { name: 'title', input: 'text' }, { name: 'body', input: 'textarea' },
      { name: 'scope', input: 'glob' }, { name: 'tags', input: 'text' },
      { name: 'severity', options: ['hard', 'soft'] },
      // `--always[=false]`: a switch with an explicit false, so it must be
      // composed JOINED. Space-separated is a refusal, not a synonym.
      { name: 'always', options: ['true', 'false'], joined: true },
      // `--continuity[=false]`, joined for `--always`'s reason and by the same
      // parser: it is the second switch on this command and the two are read
      // through one `boolFlag`.
      { name: 'continuity', options: ['true', 'false'], joined: true },
      { name: 'status', options: ['active', 'draft', 'deprecated', 'validated'] },
      { name: 'extra', input: 'text' },
      yes,
    ],
  },
  {
    // **`mycontext focus` — narrow what every later session receives.**
    //
    // On the boundary since owner ruling 2026-09-04
    // (`DEC-the-focus-dialog-earns-execute-by-putting-focus-on-the`): *"writes
    // take the boundary, the read does not"*. `--clear` and setting an axis go
    // through `confirmAction`; `--show`, `--preview` and `--relations` refuse
    // `--yes` by name. `boundary: true` is DERIVED here as everywhere else —
    // `approvalBoundary()` reads it off the fact that the parser accepts
    // `--yes` on the command string `focus` — and `yes` is in `flags` because
    // the probe says the parser takes it, not because this entry chose to.
    //
    // **What the entry buys is the ruling reaching the screen.** `app.js`'
    // `focusCommandId` reads this catalogue lazily and returns `'focus'` for
    // the two WRITE lines the dialog composes, so the shared Copy-and-Execute
    // control draws Execute for `--tag` and `--clear` and Copy alone for
    // `--show`. The dialog composes; this entry is what licenses the button.
    //
    // **The four reporting flags are absent from BOTH lists, and the
    // distinction matters.** `flagsNotOffered` means *composable here, never
    // drawn on the Composer* — it exists because the Doctor card really does
    // send `ack --all --code <c> --count <n>` through `commandFor`. Nothing
    // composes `focus --show` through this catalogue, and nothing could:
    // this is the BOUNDARY entry, it carries `--yes`, and the CLI now refuses
    // `--yes` beside all four of `--show`, `--preview`, `--relations` and
    // `--json`. A `flagsNotOffered` row would therefore declare a form that
    // cannot be composed here at all. So they are withheld the older way — by
    // simply not appearing — with the reason filed in `FLAGS_NOT_OFFERED` in
    // `test/ui/palette-lib.test.ts`, which is where `review promote --all
    // --pack`'s reason already lives.
    //
    // `--tag` is `input: 'text'` rather than a picker: the flag help names a
    // `tags` source, and this screen fills items, categories, drafts,
    // revisions and topics — a def naming a source `sourceLists` cannot build
    // would draw a permanently empty picker. The focus dialog's own tag list
    // (`app.js`) is where that picker lives.
    name: 'focus', kind: 'write', base: ['mycontext', 'focus'], boundary: true,
    args: [],
    flags: [
      { name: 'tag', input: 'text' },
      { name: 'category', source: 'categories' },
      { name: 'scope', input: 'glob' },
      { name: 'clear', boolean: true },
      yes,
    ],
  },
  { name: 'pin', kind: 'write', base: ['mycontext', 'pin'], boundary: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'unpin', kind: 'write', base: ['mycontext', 'unpin'], boundary: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'harden', kind: 'write', base: ['mycontext', 'harden'], boundary: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'soften', kind: 'write', base: ['mycontext', 'soften'], boundary: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  {
    name: 'supersede', kind: 'write', base: ['mycontext', 'supersede'], boundary: true,
    args: [{ name: 'id', source: 'items', required: true }],
    flags: [
      { name: 'by', source: 'items', required: true },
      { name: 'reason', input: 'text' },
      yes,
    ],
  },
  { name: 'refresh', kind: 'write', base: ['mycontext', 'refresh'], boundary: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'repair', kind: 'write', base: ['mycontext', 'repair'], boundary: true, args: [], flags: [yes] },
  {
    // The one member of the approval boundary with NO gate to show. It creates
    // an `active` rule with no `--yes` and no prompt of any kind (§3, §7), so
    // there is no token for a human to withhold — `ungated` is how the screen
    // is told to say that instead of rendering a checkbox that does not exist.
    name: 'lesson-accept', kind: 'write', base: ['mycontext', 'lesson-accept'],
    boundary: true, ungated: true,
    args: [{ name: 'id', input: 'text', required: true }, { name: 'key', input: 'text', required: true }],
    flags: [
      { name: 'title', input: 'text' }, { name: 'scope', input: 'glob' },
      { name: 'severity', options: ['hard', 'soft'] },
      { name: 'directive', options: ['do', 'dont'] },
    ],
  },
  {
    // BELOW the boundary, and it is worth saying why, because the first reading
    // is the wrong one. `lesson-discard` PERMANENTLY rejects a staged rule and
    // takes no `--yes`, which reads as something that should need ceremony —
    // but the boundary is about what GOVERNS this project, and a staged
    // candidate governs nothing yet. `review discard`, which looks like the
    // same act, is derived as gated because a draft in that queue can be
    // promoted into something that does.
    //
    // So destructive and boundary-crossing are two different axes, and this is
    // the entry that separates them: it is the first, not the second. The
    // stronger confirm shows a field-by-field diff of what changes, and there
    // are no fields here to show.
    name: 'lesson-discard', kind: 'write', base: ['mycontext', 'lesson-discard'], boundary: false,
    args: [{ name: 'id', input: 'text', required: true }, { name: 'key', input: 'text', required: true }],
    flags: [],
  },
  {
    name: 'review promote', kind: 'write', base: ['mycontext', 'review', 'promote'], boundary: true,
    args: [{ name: 'id', source: 'drafts', required: true }],
    flags: [
      { name: 'scope', input: 'glob' }, { name: 'always', boolean: true },
      { name: 'severity', options: ['hard', 'soft'] }, yes,
    ],
  },
  {
    name: 'review discard', kind: 'write', base: ['mycontext', 'review', 'discard'], boundary: true,
    args: [{ name: 'id', source: 'drafts', required: true }], flags: [yes],
  },
  {
    name: 'review promote-revision', kind: 'write', base: ['mycontext', 'review', 'promote-revision'],
    boundary: true,
    args: [{ name: 'id', source: 'revisions', required: true }],
    flags: [{ name: 'revision', input: 'text' }, { name: 'force', boolean: true }, yes],
  },
  {
    name: 'review discard-revision', kind: 'write', base: ['mycontext', 'review', 'discard-revision'],
    boundary: true,
    args: [{ name: 'id', source: 'revisions', required: true }],
    flags: [{ name: 'revision', input: 'text' }, { name: 'reason', input: 'text' }, yes],
  },
  // rebuild rewrites .index.db on disk — a write for composition purposes
  // even though it is not in the deny recipe (it rebuilds a derived file the
  // README tells users they may delete freely).
  //
  // `boundary: false` and the derivation agrees: the index is DERIVED from the
  // Markdown, so rebuilding it changes nothing that governs anything. It is
  // the one `kind: 'write'` entry below the boundary, and it is spelled out
  // rather than omitted so that an omission keeps meaning "not classified".
  { name: 'rebuild', kind: 'write', base: ['mycontext', 'rebuild'], boundary: false, args: [], flags: [] },

  // --- reads: executed by the UI -----------------------------------------
  //
  // Every one carries `boundary: false` EXPLICITLY rather than by omission.
  // The server resolves an unflagged entry as ON the boundary, so leaving
  // these blank would give `doctor` the field-by-field diff meant for a
  // command that changes what governs the project — too much ceremony, which
  // is the safe direction to fail in but is still wrong. Spelling it out is
  // what keeps an omission meaning "nobody has classified this yet".
  { name: 'status', kind: 'read', base: ['mycontext', 'status'], boundary: false, args: [], flags: [], screen: '#/status' },
  { name: 'doctor', kind: 'read', base: ['mycontext', 'doctor'], boundary: false, args: [], flags: [], screen: '#/doctor' },
  { name: 'decay', kind: 'read', base: ['mycontext', 'decay'], boundary: false, args: [], flags: [], screen: '#/decay' },
  { name: 'review revisions', kind: 'read', base: ['mycontext', 'review', 'revisions'], boundary: false, args: [], flags: [], screen: '#/work' },
  {
    name: 'help', kind: 'read', base: ['mycontext', 'help'], boundary: false,
    args: [{ name: 'topic', source: 'topics' }], flags: [], screen: '#/learn',
  },
  {
    name: 'list', kind: 'read', base: ['mycontext', 'list'], boundary: false,
    args: [{ name: 'category', source: 'categories' }], flags: [],
    endpoint: () => '/api/items',
  },
  {
    name: 'show', kind: 'read', base: ['mycontext', 'show'], boundary: false,
    args: [{ name: 'id', source: 'items', required: true }], flags: [],
    endpoint: (values) => `/api/item/${encodeURIComponent(values.id)}`,
  },
  {
    name: 'search', kind: 'read', base: ['mycontext', 'search'], boundary: false,
    args: [],
    flags: [
      { name: 'text', input: 'text' }, { name: 'type', source: 'categories' },
      { name: 'tag', input: 'text' }, { name: 'path', input: 'text' },
      { name: 'status', input: 'text' }, { name: 'relation', input: 'text' },
      { name: 'limit', input: 'text' },
    ],
    endpoint: (values) => {
      const qs = new URLSearchParams();
      for (const key of ['text', 'type', 'tag', 'path', 'status', 'relation', 'limit']) {
        if (values[key]) qs.set(key, values[key]);
      }
      return `/api/search?${qs.toString()}`;
    },
  },
];

/**
 * The argv for a def and its collected values. Missing required input throws
 * — a half-built command must not be composable, let alone copyable.
 *
 * ── `notWith` AND `onlyWith`: ONE ENTRY, TWO FORMS ────────────────────────
 *
 * Added 2026-09-03 for `mycontext ack`, which is the first command in this
 * catalogue whose two forms take DIFFERENT operands: `ack <id> <code>` rules on
 * one finding, and `ack --all --code <code> --count <n>` rules on a whole class
 * and takes no id at all
 * (`DEC-doctor-gets-a-bulk-settlement-overturning-the-no-bulk-ruling`).
 *
 * **A second entry was the obvious answer and it is not available.** Both forms
 * are the command STRING `ack`, and `test/ui/palette-lib.test.ts` requires the
 * catalogued strings plus the named gaps to partition the registry's strings
 * exactly — a second def would put `ack` in that list twice and fail, correctly:
 * a permission rule is written against the string, and two entries for one
 * string are one entry wearing a disguise.
 *
 * So the requirements are CONDITIONAL rather than dropped, which is the whole
 * point — making them optional would let this file compose a bare
 * `mycontext ack`, and the paragraph directly above is a promise that it cannot.
 *
 *   - `notWith: 'all'` on a positional — required, unless that switch is set.
 *   - `onlyWith: 'all'` on a flag — required, but only when it is.
 *
 * Two keys and not one symmetrical one, because they are read at two different
 * points and a single key would have to mean "required here, forbidden there"
 * depending on which loop found it. `src/ui/execute-catalogue.ts` reads
 * `name`, `required`, `boolean`, `joined` and `options` and never these, so the
 * server rebuilds through THIS function and inherits the rule rather than
 * carrying a second copy of it.
 *
 * ── `flagsNotOffered`: COMPOSABLE HERE, NEVER DRAWN ON THE COMPOSER ────────
 *
 * A third field list beside `args` and `flags`, added 2026-09-03 for `ack`'s
 * bulk trio (`--all --code <code> --count <n>`). It is composed here exactly as
 * `flags` is, and `src/ui/execute-catalogue.ts` declares it exactly as it
 * declares `flags`, so a caller naming one of these fields gets the same argv on
 * both sides of the confirm boundary — which is the whole reason that file reads
 * this one. What the list does NOT reach is the Composer: `screens/palette.js`'
 * `controlSpecs` is `[...def.args, ...def.flags]` and nothing else, so a field
 * here has no control, no picker and no checkbox on that screen. The screen it
 * IS drawn on names itself: `screens/doctor.js` composes the bulk settlement
 * through this function, per code group, which is where the owner put it.
 *
 * **Why a second LIST and not an `offered: false` marker on the flag.** The
 * marker was the shorter change and it cannot be made honest here.
 * `test/ui/palette-screen.test.ts` pins the drawn controls to be exactly
 * `def.args` then `def.flags`, in that order, so that the screen can never add a
 * door the catalogue did not open. A marker leaves the withheld flag inside
 * `def.flags`, which means either the screen keeps drawing it — the marker is
 * decoration — or the screen stops drawing it and that equality becomes false.
 * The fix for *the Composer offers too much* cannot be to loosen the assertion
 * that says what the Composer offers.
 *
 * Withholding at the list is also the shape this catalogue already had:
 * `review promote --all --pack <name>` is withheld by simply not appearing in
 * `flags`, and its reason is filed in `FLAGS_NOT_OFFERED` in
 * `test/ui/palette-lib.test.ts`. The only thing new about `ack` is that the
 * command must still be COMPOSABLE, because a different screen is licensed to
 * offer it — so the field cannot just be deleted, and this list is exactly that
 * distinction made in the data rather than in a comment.
 */
export function commandFor(def, values) {
  const argv = [...def.base];
  for (const arg of def.args) {
    const value = values[arg.name];
    if (value === undefined || value === '') {
      if (arg.required && values[arg.notWith] !== true) {
        throw new Error(`${def.name}: ${arg.name} is required`);
      }
      continue;
    }
    argv.push(value);
  }
  // The offered flags first and the withheld ones after, which is both the
  // order `ack` documents (`ack --all --code <code> --count <n>`) and the only
  // order in which the two lists concatenate to one composition order a reader
  // can predict from the entry.
  for (const flag of [...def.flags, ...(def.flagsNotOffered ?? [])]) {
    const value = values[flag.name];
    if (flag.boolean) {
      if (value === true) argv.push(`--${flag.name}`);
      continue;
    }
    if (value === undefined || value === '') {
      if (flag.required && (flag.onlyWith === undefined || values[flag.onlyWith] === true)) {
        throw new Error(`${def.name}: --${flag.name} is required`);
      }
      continue;
    }
    // A switch that also takes an explicit value is joined with `=`. The CLI
    // reads `--always false` as a stray positional and refuses the whole
    // command, so the two forms are not interchangeable here.
    if (flag.joined) argv.push(`--${flag.name}=${value}`);
    else argv.push(`--${flag.name}`, value);
  }
  return argv;
}
