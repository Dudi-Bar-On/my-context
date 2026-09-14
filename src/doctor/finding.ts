/**
 * **What a check may EMIT, and the one rule every check in `src/doctor/`
 * obeys — stated once, in the module they all import.**
 *
 * This is the shared vocabulary of the doctor: the `Finding` shape, the
 * `Remedy` union that says what a reader can DO about one, and the handful of
 * ready-made remedies checks reach for. It has no imports at all, which is
 * what makes it safe for every check module to depend on.
 *
 * It lives in its own file since
 * `TASK-the-checks-file-splits-along-a-boundary-its-own-tests` split the
 * checks across modules. **The rule below moved here rather than being copied
 * into each of them**, which matters: a rule with two copies cannot be
 * superseded, only contradicted, and this project has already measured what
 * that costs. Every check module imports `Finding` from here, so the rule is
 * one hop from every check that must obey it, and there is still exactly one
 * of it.
 */

/**
 * **THE RULE EVERY CHECK IN `src/doctor/` OBEYS: a check reports a finding only
 * when a person could DO something about it; what it cannot judge is disclosed
 * as UNMEASURED, once, and never per item.**
 *
 * Owner, 2026-09-03: *"the main problem is that even the user has no tools to
 * solve them ... i want to clear them all and complete to be annoyed by this
 * issue"* — against the purpose he had already stated for this whole module,
 * *"doctor was added to the app for repairing, this is its role"*. A finding a
 * reader cannot act on is a defect in the CHECK and not a chore for the
 * reader, which makes this a rule about what a check may EMIT and not about
 * how a screen draws what it emitted.
 *
 * Every row is therefore one of three things, and a check that produces a
 * fourth is wrong:
 *
 *  - **FIXABLE** — a command settles it (`Remedy.route: 'run'` or `'copy'`),
 *    and the finding's own message names that command.
 *  - **RULABLE** — a PERSON can answer the question it asks
 *    (`route: 'acknowledge'`). The test is NOT "is `ack` available": `ack` is
 *    available on every finding that names an item, which is exactly why its
 *    availability proves nothing. The test is *does the question have an
 *    answer this reader can give*. A question whose evidence was never
 *    recorded and cannot now be reconstructed does not, and asking for a
 *    ruling on it is the shape the owner is objecting to.
 *  - **NOT REPORTED — and said so, ONCE**, as a coverage line naming how many
 *    items the check could not look at and why. This is
 *    `STD-a-measured-zero-is-drawn-and-named` applied at the other end of the
 *    scale: a measured zero is drawn and named, an unmeasured set is named as
 *    unmeasured, and neither is ever blank. N per-item rows saying "this could
 *    not be measured" is the failure both halves of that standard forbid — it
 *    is blank dressed up as work. `checkStateUnaudited`'s
 *    `state_audit_coverage` is the worked example.
 *
 * **The failure this closes was measured, not imagined.** `state_unaudited`
 * shipped with 28 findings on this corpus, every one of them about a write
 * that predated the witness which could have recorded it. No command could
 * clear one; an unrelated edit could, and did — the count eroded 28 → 25 → 24
 * while nobody repaired anything. **A row that only an accident can clear is
 * not work. It is noise wearing work's clothes**, and it costs the reader the
 * attention that the rows next to it needed.
 *
 * The corollary for the loud half, which this rule must never be read as
 * softening: a condition a person CAN act on is still reported per item, by
 * name, with the evidence that established it. Narrowing a check to what it
 * can measure is not the same as narrowing it to what is comfortable.
 */
export interface Finding {
  level: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  item?: string;
  /**
   * **A person has ruled on this exact finding, on this item, against the
   * content the item still has** (owner ruling 2026-08-27 — the whole argument
   * is on `core/acknowledge.ts`).
   *
   * Set by `markAcknowledged` below, after every check has run, and never by a
   * check: a check answers "is this true of the corpus", which does not change
   * because somebody read the answer.
   *
   * **It is a MARK, not a filter.** The finding is still in `findings`, still
   * in `counts`, and still contributes to the exit code exactly as its `level`
   * always did. Absent (rather than `false`) when nobody has ruled, so a
   * consumer can tell "not acknowledged" from a field that was never
   * populated — the same choice `cliOnPath: null` makes in doctor's JSON.
   */
  acknowledged?: true;

  /**
   * **This row is a NOTE ABOUT A CHECK, not a finding about the corpus**, and
   * the value is the code of the check it is about.
   *
   * The rule above this interface says what a check cannot judge is disclosed
   * once and never per item. `src/cli/commands/doctor.ts` finished the other
   * half — owner, 2026-09-03: *"after you complete handling them, the test
   * should be that they will not be listed anymore at doctor list"* — because a
   * row saying "nothing is owed" is still a row he has to read and dismiss.
   * `partitionFindings` routes anything carrying this out of the worklist and
   * under its own heading, where every character still prints and none of it is
   * counted as work.
   *
   * It names the CHECK rather than saying "this is a note", because a reader
   * meeting the sentence needs to know a note about WHAT: it is drawn under the
   * table whose reach it limits. `state_audit_coverage` is
   * `about: 'state_unaudited'`; `citation_form_excused` is
   * `about: 'citation_form'`.
   *
   * Absent, never `false`, on an ordinary finding — the same choice
   * `acknowledged` makes one field up, so a consumer can tell "not a
   * disclosure" from a field that was never populated. `doctor.ts` reads it
   * through `disclosureAbout`, which was written as a runtime test on an
   * optional string precisely so this declaration could land later without a
   * second edit there; its docblock names the `as` cast that is now redundant.
   */
  about?: string;

  /**
   * **What settles this finding**, declared by the check that emits it and
   * never by a surface that renders it — the design of record recorded at
   * `reports/V2-HANDOVER.md:437`. See `Remedy`.
   *
   * Required, not optional, and that is the whole point: a check added
   * tomorrow cannot reach a screen without somebody deciding what a reader is
   * supposed to DO about it. An optional field would have let the same silence
   * back in through the same door.
   */
  remedy: Remedy;
}

/**
 * The values a catalogue entry is rebuilt with — `src/ui/execute-catalogue.ts`
 * resolves an id plus one of these into the argv, and refuses anything outside
 * the entry's declared shape. `true` is a boolean flag SET; a flag left out is
 * simply absent, never `false`.
 */
export type RemedyValues = Record<string, string | true>;

/**
 * **What settles a finding, declared by the check that emits it.**
 *
 * Recorded as designed-and-unbuilt in `TASK-a-doctor-finding-with-no-repair-shows-no-control-and-no`
 * (`plan:walk seq:61`): *"a `Finding` in `src/doctor/` must declare its OWN
 * remedies, never a UI-side table."* It cited `reports/V2-HANDOVER.md:437` and
 * `reports/EXECUTION-BOARD.md:99` until 2026-09-07; BOTH anchors had already
 * rotted — the handover is prepended-to, so every line number in it moves on
 * each write, and the board was rewritten on 2026-09-05. Cite the ITEM, which
 * is addressed by id and cannot drift, not a line in a report. Until 2026-09-03 the
 * decision lived twice in the browser — `screens/doctor.js`'s `repairFor` and
 * `lib/viewmodel.js`'s `repairCommandFor`, four `if`s each — and every code
 * either of them did not name drew a chip saying there was nothing to offer.
 * On this repository's own corpus that was 74 findings out of 74. Owner,
 * 2026-09-03: *"currently doctor contains many items i do not have any way to
 * handle, solve it"*.
 *
 * **It is DATA and never a composed string.** The client sends a catalogue id
 * and a value bag and never a command (spec §3.1, `src/ui/execute-catalogue.ts`),
 * so a remedy that carried a line would be a second composer whose output the
 * confirm could not be bound to. The one exception carries an explicit `argv`
 * and says why: see `copy`.
 *
 * The four routes, and the question each answers:
 *
 *  - **`run`** — a catalogue command RESOLVES it. `command` is the entry's name
 *    in `src/ui/public/lib/palette-defs.js`; `values` is what it is rebuilt
 *    with. Declared only where the finding's own MESSAGE names that command:
 *    the message is the specification and this field is its machine-readable
 *    half, never a second opinion about it.
 *  - **`copy`** — a line the catalogue declares NO entry for. There is nothing
 *    for the server to rebuild, so it is copied and never run. `audit --files`
 *    is the only one, and naming a nearby id instead would put a different
 *    command behind a confirm that looked right.
 *  - **`acknowledge`** — `mycontext ack <item> <code>`: a PERSON reads the
 *    finding and rules on it (owner ruling 2026-08-27, argued in
 *    `core/acknowledge.ts`). This is the route for every message whose own
 *    words say the answer is a judgement or a hand edit — *"which of the two
 *    moves is the owner's call"*, *"only a person can tell the two apart"*,
 *    *"Re-scope it to the path that replaced it"*. It carries no id and no code
 *    of its own: the finding already has both, and a copy here could disagree
 *    with the finding it is attached to.
 *  - **`none`** — no control, because there is nothing honest to offer: the
 *    finding names no item, so nobody can rule on it either. `why` picks which
 *    sentence says so — `person` for something a person fixes OUTSIDE
 *    my_context (a PATH, a `.gitignore`, `config.json`), `nothing` for a
 *    finding that explicitly asks for no action at all.
 */
export type Remedy =
  | { route: 'run'; command: string; values: RemedyValues }
  | { route: 'copy'; argv: string[] }
  | { route: 'acknowledge' }
  | { route: 'none'; why: 'person' | 'nothing' };

/** `mycontext ack <id> <code>` — a person rules; nothing runs on their behalf. */
export const ACK: Remedy = { route: 'acknowledge' };

/**
 * A person settles it, outside my_context, and the finding names no item — so
 * there is not even an acknowledgement to anchor. A PATH entry, a `.gitignore`
 * line, a key in `config.json`, a doctor check that threw.
 */
export const PERSON: Remedy = { route: 'none', why: 'person' };

/** The finding asks for no action: it is a disclosure, not a defect. */
export const NOTHING: Remedy = { route: 'none', why: 'nothing' };

/** `mycontext rebuild` — `index_stale`'s own last sentence. */
export const REBUILD: Remedy = { route: 'run', command: 'rebuild', values: {} };

/** `mycontext decay` — named by `corpus_size_fallback_ceiling` as "the lever". */
export const DECAY: Remedy = { route: 'run', command: 'decay', values: {} };

/**
 * `mycontext repair --yes` — `checksum_basis_migration`'s own recommendation
 * ("Run `mycontext repair` to re-stamp it in the current format"), plus the
 * `--yes` every boundary command composed for this UI carries: it is SHOWN in
 * the line a reader reads, never implied, and without it a command run as a
 * child process with no terminal refuses for want of a confirmation it has no
 * way to ask for.
 */
export const REPAIR: Remedy = { route: 'run', command: 'repair', values: { yes: true } };

/**
 * `mycontext audit --files`, and it names NO catalogue id DELIBERATELY.
 * `PALETTE` carries no `audit` entry, so there is nothing for the server to
 * rebuild; the control draws Copy alone, and that is the correct outcome rather
 * than a gap to work around.
 */
export const AUDIT_FILES: Remedy = { route: 'copy', argv: ['mycontext', 'audit', '--files'] };

/**
 * `mycontext refresh <id> --yes` — `source_drift`'s own recommendation.
 *
 * **`yes: true`, and without it this command cannot run at all.** Owner-reported
 * twice on 2026-08-28 from the Doctor screen: `refresh` REPLACES an item's whole
 * body, so it gates on a human by reading stdin; a command run from this UI is a
 * child with no terminal, so it computed the change, printed it, and refused —
 * and the dry run behind the confirm refused first, so the confirm never
 * rendered either. The button was dead in both directions. This does not imply
 * the confirmation, it MOVES it: the flag is in the composed argv, so it appears
 * in the line the reader reads and in the confirm's own copy of it.
 */
export const refreshRemedy = (id: string): Remedy => (
  { route: 'run', command: 'refresh', values: { id, yes: true } }
);

/**
 * `mycontext edit <id> --extra state=todo --yes` — `blocked_needs_met`'s own
 * recommendation, verbatim but for the `--yes` that every boundary command
 * composed for this UI carries (see `refreshRemedy`).
 *
 * The message asks the reader to "confirm the ground is finished ground and
 * then" run it. The confirm dialog IS that confirmation — it shows, field by
 * field, what the edit changes before anything is written — so the control does
 * not skip the step the sentence asks for; it is where that step happens.
 */
export const stateTodoRemedy = (id: string): Remedy => (
  { route: 'run', command: 'edit', values: { id, extra: 'state=todo', yes: true } }
);

/**
 * The reusable remedies, by name, for the one caller outside this file that
 * builds a `Finding` of its own: `cmdDoctor` synthesises a `cli_lookup_failed`
 * when `checkCliOnPath` itself throws, and it must declare the same remedy the
 * check declares rather than a second opinion about the same code.
 */
export const REMEDY = { ACK, PERSON, NOTHING, REBUILD, DECAY, REPAIR, AUDIT_FILES } as const;
