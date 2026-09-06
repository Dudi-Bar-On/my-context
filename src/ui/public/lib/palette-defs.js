// The command catalogue (spec §4, Work: "build a command from selections and
// inputs, with real pickers and a live glob tester"). Write commands are
// COMPOSED AND COPIED with the on-screen note — per spec §2 the only treatment
// of a write anywhere in this UI. Read commands EXECUTE, through the one verb
// every other entry uses.
//
// ── THE SECOND RUN TARGET THAT USED TO LIVE ON THESE ENTRIES ───────────────
//
// Eight reads carried an `endpoint` (`list`, `show`, `search`) or a `screen`
// (`status`, `doctor`, `decay`, `review revisions`, `help`), and
// `screens/palette.js`' `readTarget` turned either into a second button — Run —
// beside Execute. Removed 2026-09-07 by owner ruling
// (`DEC-run-is-removed-execute-is-the-only-way-to-run-what-the`).
//
// It was not a second feature. `readTarget` arrived in `e5696b9`, when this
// console was strictly READ-ONLY and could not run a command at all, so Run
// fetched an endpoint serving an EQUIVALENT answer. Execute arrived later in
// `3702b1a` and runs the real command. Re-measured 2026-09-07 on this
// catalogue: 8 entries had a Run target, 27 have Execute, and EVERY entry with
// Run also had Execute — Run was the older mechanism kept past the arrival of
// the thing that replaced it, and its approximation had drifted into being
// wrong (`mycontext list rule` fetched `/api/items`, which ignores the
// category argument entirely and answered 980 rows of every type where the CLI
// answers 52; `mycontext help slash` navigated to `#/learn`, which draws the
// four topics `UI_HELP_TOPICS` names of the seven `core/teach.ts` accepts).
//
// Removal rather than repair is the point of the ruling: patching `list` and
// `help` fixes two instances of a class, and deleting the field deletes the
// class. No entry added later can reintroduce the split, and
// `test/ui/palette-lib.test.ts` fails this file if one tries.
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

// ── `runnable`: DRAWING A FORM AND LETTING THE SERVER RUN IT ARE TWO ─────
//
// Owner ruling 2026-09-06 (decision D2, `reports/2026-09-06-PLAN.md`), on the
// finding `docs/superpowers/specs/2026-09-06-composer-architecture-review.md`
// §2b states: **membership in this list used to be the whole execution
// licence.** `src/ui/execute-catalogue.ts` built its lookup from `PALETTE` and
// resolved anything it found, so adding an entry — for no reason but that a
// screen wanted the flag set checked against the real parser — handed that
// command `POST /api/execute` in the same edit. The review measured the
// consequence on the three commands below: they were unrunnable from this app
// only because of which FILE their argv literal happened to live in.
//
// So the two facts are now two fields:
//
//   * being in `PALETTE` licenses a FORM — the Composer draws controls for the
//     entry and composes an argv a reader can read and copy;
//   * `runnable: true` licenses EXECUTION — the server rebuilds the argv and
//     runs it behind the confirm, and the screen offers the button.
//
// **AN ENTRY WITH NO `runnable` KEY IS NOT RUNNABLE.** That is the fail-safe,
// and it points the opposite way from `boundary`'s on purpose: a forgotten
// `boundary` costs a reader ceremony, while a forgotten `runnable` would cost
// them a command they never licensed. The owner's words: *a mistake should
// withhold execution, never grant it.*
//
// For that default to keep meaning "nobody has ruled on this yet", every entry
// that could already execute on 2026-09-06 carries `runnable: true` EXPLICITLY
// — all twenty-seven of them, marked in the same pass that added the field, so
// that nothing changed about what any of them can do. The three added beside
// them carry `runnable: false`, which is not a verdict either: whether each of
// them earns Execute is
// `OPENQ-the-three-proposed-screens-hold-the-only-command-blocks-in`, an owner
// question, and `false` is what this catalogue says while it is unanswered.
//
// Both sides read the field. `execute-catalogue.ts` refuses to resolve a
// non-runnable id at all, so neither the confirm nor the run can reach it; and
// `screens/palette.js` passes `id: null` to `commandActions` for one, so the
// Composer draws Copy alone rather than a button whose only outcome is a
// refusal. Neither is a substitute for the other — the screen's is courtesy,
// the server's is the boundary.

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
    //
    // **`finding` is `input: 'suggest'` and its list DEPENDS ON `id`** (owner
    // ruling D11, 2026-09-06). `cmdAck` takes the codes doctor reports on THAT
    // item as the vocabulary and refuses anything else — *"a typo would
    // otherwise write a permanent entry for a code no check emits"*
    // (`src/cli/commands/ack.ts`) — so the honest list here is not the eleven
    // codes this corpus reports anywhere, it is the one or two it reports on
    // the item the reader just picked. `dependsOn` is that fact in the data;
    // `narrowedOptions` in `screens/palette.js` is what reads it. Measured on
    // this corpus 2026-09-06: 61 findings, 56 of them on an item, over 55
    // distinct items, 1-2 codes each.
    //
    // **And it stays a BOX, not a `<select>`, for a reason the flag itself
    // gives.** `--clear` is exempt from that vocabulary (`ack.ts`: `if (!clear
    // && !reported.includes(code))`), because withdrawing a ruling whose check
    // was renamed or retired is exactly the case `reportState`'s "orphaned"
    // paragraph exists to fix. A closed picker would take that away. So the
    // suggestion list is offered THROUGH the box, the same shape and the same
    // reason as `--tags`: what is ticked is written into the line you can also
    // type, and neither can surprise the other.
    name: 'ack', kind: 'write', base: ['mycontext', 'ack'], boundary: false, runnable: true,
    args: [
      { name: 'id', source: 'items', required: true, notWith: 'all' },
      {
        name: 'finding', input: 'suggest', source: 'findings', dependsOn: 'id',
        required: true, notWith: 'all',
      },
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
    name: 'add', kind: 'write', base: ['mycontext', 'add'], overlap: true, boundary: true, runnable: true,
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
      { name: 'scope', input: 'glob' },
      // `input: 'tags'` — a COMMA-SEPARATED LIST with a picker over the tags
      // this corpus already carries (owner ruling D10, 2026-09-06). It stays
      // an input rather than becoming a `source`, and that is the whole design:
      // `--tags` takes many values where every `source` picker emits one, and
      // a control that composed `--tags v2` where the reader ticked three
      // would be a regression wearing a convenience's clothes. The box is the
      // model; see `screens/palette.js`' tag picker.
      { name: 'tags', input: 'tags' },
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
    name: 'config', kind: 'write', base: ['mycontext', 'config'], boundary: true, runnable: true,
    args: [{ name: 'category', source: 'categories', required: true }],
    flags: [
      { name: 'delete', boolean: true },
      { name: 'disable', boolean: true },
      yes,
    ],
  },
  {
    name: 'edit', kind: 'write', base: ['mycontext', 'edit'], boundary: true, runnable: true,
    args: [{ name: 'id', source: 'items', required: true }],
    flags: [
      { name: 'title', input: 'text' }, { name: 'body', input: 'textarea' },
      { name: 'scope', input: 'glob' },
      // `input: 'tags'`, for `add`'s reason one entry up — and here the
      // catalogue's picker is doing a second job. `edit --tags` REFUSES a
      // hand-written projected tag outright (`handWrittenProjectionError`,
      // core/tag-projection.ts, called from `cli/commands/edit.ts`), so the
      // Composer offers the FREE-FORM half of `/api/tags` and names the other
      // half rather than drawing a control that composes a refusal.
      { name: 'tags', input: 'tags' },
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
    // `--tag` is `input: 'text'` and stays that way, though the reason it gives
    // has changed. It used to be that this screen could fill no `tags` source
    // at all; since owner ruling D10 (2026-09-06) it reads `/api/tags` and
    // draws a tag picker for `add`/`edit --tags`. What is different here is the
    // FLAG: `--tag` on `focus` is a READ filter, so a projected tag is a
    // legitimate thing to pick, and the control that already offers BOTH halves
    // correctly is the focus dialog's own (`app.js`). Giving the Composer a
    // second, narrower control for the same flag is a decision about which
    // surface owns focus, and it is not this ruling's.
    name: 'focus', kind: 'write', base: ['mycontext', 'focus'], boundary: true, runnable: true,
    args: [],
    flags: [
      { name: 'tag', input: 'text' },
      { name: 'category', source: 'categories' },
      { name: 'scope', input: 'glob' },
      { name: 'clear', boolean: true },
      yes,
    ],
  },
  {
    // **`mycontext init --pack <path>` — found a workspace from a template pack.**
    //
    // Moved here 2026-09-06 from `screens/packs.js`, which held it as
    // `IMPORT_ARGV`, a module-level literal array. That array was never checked
    // against the real argument parser: every other command this UI composes is
    // swept by `test/ui/palette-lib.test.ts` against the CLI that will read it,
    // and this one was invisible to that sweep for no better reason than where
    // it was written. The literal is gone; `packs.js` composes through
    // `commandFor` now, so the line the mockup draws and the line this file
    // composes are one computation rather than two that agree today.
    //
    // **`runnable: false`, and here that is close to permanent.** The screen's
    // own words are the argument and they survive the entry:
    // *"`mycontext init` is the command that is run BEFORE there is a workspace
    // for this UI to be served out of"*. Its effect is not on this corpus — it
    // founds a new one wherever `--pack`'s path names, from an artefact this
    // project did not write — and
    // `OPENQ-the-three-proposed-screens-hold-the-only-command-blocks-in` already
    // recommends it stay Copy-only. That recommendation is still the owner's to
    // take; `false` is what this file says until he does.
    //
    // **`boundary: false`, derived and not chosen.** `mycontext init` accepts no
    // `--yes` (`COMMAND_FLAGS.init` allows exactly `--pack`), so
    // `approvalBoundary()` puts it below the line — which is why it needs a row
    // in `OFF_BOUNDARY` in `test/ui/palette-lib.test.ts` rather than a deny
    // rule. The marking costs nothing today: an entry that cannot run never
    // reaches a confirm to size.
    //
    // `--pack` is `required`, which the CLI itself insists on: a bare
    // `mycontext init` is a legal command, but it is not the one this entry is
    // for, and the flag's own refusal says there is deliberately no default
    // ("an import is a stranger's corpus arriving in yours").
    //
    // **It was `input: 'text'` with the reason *"the value is a path on disk
    // outside this workspace, and every picker source here is corpus data"*,
    // and that reason was right about a `<select>` and wrong about the field.**
    // Owner ruling D11, 2026-09-06. `/api/packs` carries `PackRow.source` —
    // *"the path as the importer typed it, recorded verbatim"* — for every pack
    // this workspace has imported, so there IS derived data here: not "packs
    // available on disk", which nothing in this product enumerates, but the
    // artefact locations this corpus was actually founded and fed from. That is
    // the honest domain and the aside beside the box says so in those words.
    //
    // **`suggest` and not a picker, and the difference is the whole point.**
    // The list is a HINT, never the vocabulary: `--pack` takes any path, this
    // corpus reports zero imports today (measured 2026-09-06: `/api/packs`
    // answers `packs: []` here), and a `<select>` over an empty list is a
    // control that has taken the box away and given nothing back. A box with no
    // suggestions is exactly the box that was here before, which is why this
    // cannot regress and why the empty case needed no ruling of its own.
    name: 'init', kind: 'write', base: ['mycontext', 'init'], boundary: false, runnable: false,
    args: [],
    flags: [{ name: 'pack', input: 'suggest', source: 'packs', required: true }],
  },
  { name: 'pin', kind: 'write', base: ['mycontext', 'pin'], boundary: true, runnable: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'unpin', kind: 'write', base: ['mycontext', 'unpin'], boundary: true, runnable: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'harden', kind: 'write', base: ['mycontext', 'harden'], boundary: true, runnable: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'soften', kind: 'write', base: ['mycontext', 'soften'], boundary: true, runnable: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  {
    name: 'supersede', kind: 'write', base: ['mycontext', 'supersede'], boundary: true, runnable: true,
    args: [{ name: 'id', source: 'items', required: true }],
    flags: [
      { name: 'by', source: 'items', required: true },
      { name: 'reason', input: 'text' },
      yes,
    ],
  },
  { name: 'refresh', kind: 'write', base: ['mycontext', 'refresh'], boundary: true, runnable: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'repair', kind: 'write', base: ['mycontext', 'repair'], boundary: true, runnable: true, args: [], flags: [yes] },
  {
    // The one member of the approval boundary with NO gate to show. It creates
    // an `active` rule with no `--yes` and no prompt of any kind (§3, §7), so
    // there is no token for a human to withhold — `ungated` is how the screen
    // is told to say that instead of rendering a checkbox that does not exist.
    // ── `key` IS THE ONE FIELD D11 ASKED FOR AND COULD NOT BUILD ───────────
    //
    // The ruling's own words were that these are *"the staged lesson's own
    // keys — already fetched for the `id` picker sitting next to it, so the
    // data is on the page already"*. Measured 2026-09-06: neither half is
    // true. `id` here is `input: 'text'` — there is no picker sitting next to
    // it — and NO endpoint in this server carries a staged lesson at all. Five
    // staging files exist on this corpus (`.my_context/.staging/*.json`, each
    // `{ lessonId, candidates: [{ key, candidate }] }`) and nothing serves
    // them.
    //
    // **The obstacle is not an oversight, it is the read/write boundary.**
    // `listStaging` lives in `src/lesson/derive.ts`, which value-imports
    // `createItem` from `core/mutate.ts`. `src/ui/read-model.ts` already
    // refused the same read for the same reason, about `st.staged` on the
    // status screen: *"serving `st.staged` would put the mutation surface into
    // this server's runtime import graph for the first time. That is a decision
    // about the boundary §0.5 is the owner's ruling on, not a field to add on
    // the way past."* `test/ui/no-writes.test.ts` is the gate that means it.
    //
    // So the box stays, and the question of whether the read half of
    // `derive.ts` may be split out into a module the UI can import is filed as
    // an open question rather than answered by a lane. Nothing here is undone
    // when it is answered: `input: 'suggest', source: 'lessonKeys',
    // dependsOn: 'id'` is the whole change, exactly as `finding` above.
    name: 'lesson-accept', kind: 'write', base: ['mycontext', 'lesson-accept'],
    boundary: true, runnable: true, ungated: true,
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
    // `key` is a box here for the reason written out on `lesson-accept` above:
    // the staged candidates it would offer are behind `derive.ts`'s import of
    // `core/mutate.ts`, and nothing serves them.
    name: 'lesson-discard', kind: 'write', base: ['mycontext', 'lesson-discard'], boundary: false, runnable: true,
    args: [{ name: 'id', input: 'text', required: true }, { name: 'key', input: 'text', required: true }],
    flags: [],
  },
  {
    // **`mycontext procedure done <id> [--yes]` — retire an active procedure.**
    //
    // Moved here 2026-09-06 from `screens/proc.js`'s `doneArgv`, which built the
    // array per render. `proc.js` said what that cost, in its own words: *"the
    // catalogue is where a flag set gets verified against the real parser, and a
    // command composed outside it has had no such check"*. It has one now.
    //
    // **`runnable: false` is not the ruling `pr.w3` takes.** `pr.w3` reserves
    // the DECISION — *"active → done stays yours"* — and the review's §2c(3)
    // found that the owner cannot press a button to take it from this app at
    // all, for a reason that turned out to be an accident of which file the argv
    // lived in rather than a considered posture. Whether this entry earns
    // Execute is
    // `OPENQ-the-three-proposed-screens-hold-the-only-command-blocks-in`, and it
    // is his; `false` is what this file says while the question is open, because
    // the alternative — granting Execute as a side effect of moving a literal —
    // is the exact thing that question exists to prevent.
    //
    // **`boundary: true` and `--yes` offered, both DERIVED.**
    // `SUBCOMMANDS`' `done: { allowed: ['yes'] }` (`cli/commands/procedure.ts`)
    // is what puts the command string `procedure done` on the boundary, and
    // `test/ui/palette-lib.test.ts` requires an entry on it to SHOW the flag.
    // Offering it answers nobody's prompt: `commandFor` emits `--yes` only when
    // the checkbox is ticked, and `proc.js` composes this entry with an empty
    // value bag, so the line that screen draws is byte-identical to the one it
    // drew before this entry existed.
    //
    // `source: 'items'` because a procedure IS an item and `/api/items` is the
    // only list the Composer fetches; there is no procedures-only picker source,
    // and inventing one is a Composer change this entry does not make.
    name: 'procedure done', kind: 'write', base: ['mycontext', 'procedure', 'done'],
    boundary: true, runnable: false,
    args: [{ name: 'id', source: 'items', required: true }],
    flags: [yes],
  },
  {
    name: 'review promote', kind: 'write', base: ['mycontext', 'review', 'promote'], boundary: true, runnable: true,
    args: [{ name: 'id', source: 'drafts', required: true }],
    flags: [
      { name: 'scope', input: 'glob' }, { name: 'always', boolean: true },
      { name: 'severity', options: ['hard', 'soft'] }, yes,
    ],
  },
  {
    name: 'review discard', kind: 'write', base: ['mycontext', 'review', 'discard'], boundary: true, runnable: true,
    args: [{ name: 'id', source: 'drafts', required: true }], flags: [yes],
  },
  {
    name: 'review promote-revision', kind: 'write', base: ['mycontext', 'review', 'promote-revision'],
    boundary: true, runnable: true,
    args: [{ name: 'id', source: 'revisions', required: true }],
    flags: [{ name: 'revision', input: 'text' }, { name: 'force', boolean: true }, yes],
  },
  {
    name: 'review discard-revision', kind: 'write', base: ['mycontext', 'review', 'discard-revision'],
    boundary: true, runnable: true,
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
  { name: 'rebuild', kind: 'write', base: ['mycontext', 'rebuild'], boundary: false, runnable: true, args: [], flags: [] },

  // --- reads: executed by the UI -----------------------------------------
  //
  // Every one carries `boundary: false` EXPLICITLY rather than by omission.
  // The server resolves an unflagged entry as ON the boundary, so leaving
  // these blank would give `doctor` the field-by-field diff meant for a
  // command that changes what governs the project — too much ceremony, which
  // is the safe direction to fail in but is still wrong. Spelling it out is
  // what keeps an omission meaning "nobody has classified this yet".
  { name: 'status', kind: 'read', base: ['mycontext', 'status'], boundary: false, runnable: true, args: [], flags: [] },
  { name: 'doctor', kind: 'read', base: ['mycontext', 'doctor'], boundary: false, runnable: true, args: [], flags: [] },
  { name: 'decay', kind: 'read', base: ['mycontext', 'decay'], boundary: false, runnable: true, args: [], flags: [] },
  { name: 'review revisions', kind: 'read', base: ['mycontext', 'review', 'revisions'], boundary: false, runnable: true, args: [], flags: [] },
  {
    name: 'help', kind: 'read', base: ['mycontext', 'help'], boundary: false, runnable: true,
    args: [{ name: 'topic', source: 'topics' }], flags: [],
  },
  {
    name: 'list', kind: 'read', base: ['mycontext', 'list'], boundary: false, runnable: true,
    args: [{ name: 'category', source: 'categories' }], flags: [],
  },
  {
    name: 'show', kind: 'read', base: ['mycontext', 'show'], boundary: false, runnable: true,
    args: [{ name: 'id', source: 'items', required: true }], flags: [],
  },
  {
    name: 'search', kind: 'read', base: ['mycontext', 'search'], boundary: false, runnable: true,
    args: [],
    flags: [
      { name: 'text', input: 'text' }, { name: 'type', source: 'categories' },
      { name: 'tag', input: 'text' }, { name: 'path', input: 'text' },
      // **Two closed domains that were text boxes** — owner ruling D10,
      // 2026-09-06. `search --status` is checked against `STATUSES`
      // (`cli/commands/search.ts`) and `--relation` against what the corpus can
      // hold; both lists now travel on the wire, `statuses` on `/api/meta` and
      // `relations` on `/api/items`, so neither is spelled in any browser file.
      //
      // **`--status` here has FIVE values and `edit --status` has four**, and
      // the two are not a contradiction: `edit-flags.ts` writes
      // `STATUSES.filter((s) => s !== 'superseded')` because only `mycontext
      // supersede` may move an item into that state, while a SEARCH over it is
      // an ordinary question — 25 items in this corpus carry it, measured
      // 2026-09-06, and every one of them was unreachable from here. So the four
      // stay spelled on `edit` (it is a subset the flag itself declares) and
      // the five are derived here.
      { name: 'status', source: 'statuses' },
      { name: 'relation', source: 'relations' },
      { name: 'limit', input: 'text' },
    ],
  },

  // --- the read that is COPIED rather than executed -----------------------
  {
    // **`mycontext audit --files` — where the run-time audit log actually is.**
    //
    // The third argv moved into this file on 2026-09-06. Doctor's
    // `audit_log_size` finding declares it as its own remedy
    // (`src/doctor/checks.ts` · `AUDIT_FILES`), and until this entry existed
    // there was nothing in this catalogue for that declaration to name — which
    // is why the remedy carries `route: 'copy'` and its own array. This entry
    // does not take that array away from the check: a finding declaring its own
    // remedy is `reports/V2-HANDOVER.md`'s design and it stays. What it ends is
    // the REASON two files gave for the null id, which was *"`PALETTE` carries
    // no `audit` entry"* — an absence rather than a decision.
    //
    // **`runnable: false`, and since 2026-09-07 that is the WHOLE of it.**
    //
    // This entry used to be the read with no `screen` and no `endpoint` where
    // every other read had one, and the paragraph here argued that the absence
    // was a decision rather than an omission. Run is gone
    // (`DEC-run-is-removed-execute-is-the-only-way-to-run-what-the`), so no read
    // carries either field any more and there is no absence left to explain.
    // What survives is the reason this entry cannot run AT ALL: the audit log
    // reaches this UI through the Watch and Ask read models, which answer
    // different questions, and `mycontext audit --files` is a command to COPY.
    // `runnable: false` says exactly that, and `execute-catalogue.ts` gives the
    // server nothing to run — one licence now, checked in one place, instead of
    // two that could disagree.
    //
    // **Only `--files` is offered, of the twelve flags the command accepts.**
    // `audit`'s query surface (`--since`, `--item`, `--role`, `--limit` …) is a
    // Composer design nobody has scoped, and this entry exists to hold ONE argv
    // as data rather than to draw a query builder. Every read in this catalogue
    // is partial in this way — `status`, `doctor` and `decay` accept the four
    // detail flags and offer none — and the probe in
    // `test/ui/palette-lib.test.ts` that would fail an under-advertised flag set
    // runs over `kind: 'write'` only. That gap is real, it is older than this
    // entry, and closing it is `builder/3`'s bidirectional test rather than this.
    name: 'audit', kind: 'read', base: ['mycontext', 'audit'], boundary: false, runnable: false,
    args: [],
    flags: [{ name: 'files', boolean: true }],
  },
];

/**
 * **May this entry RUN, as opposed to merely be drawn?** The second of the two
 * licences the header above splits apart.
 *
 * `=== true`, never `!== false`: an entry that says nothing has been licensed
 * by nobody. Exported so that the screens read the same sentence the server
 * does — `src/ui/execute-catalogue.ts` states the identical rule as
 * `runnableOf`, in its own file, because a browser module and a Node module
 * cannot share one function across this boundary and the server must never
 * depend on the client for a permission. Two spellings of one rule is a cost
 * this file already pays for `boundaryOf`; what is NOT paid twice is the DATA,
 * which is this catalogue and is read by both.
 */
export function runnableFor(def) {
  return def.runnable === true;
}

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
