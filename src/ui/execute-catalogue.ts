/**
 * The server's copy of the command catalogue — which is to say, NOT a copy.
 *
 * The client sends a catalogue id and a bag of values; it never sends a
 * command (spec §3.1). This module rebuilds the argv from the SAME file the
 * browser composed from, `src/ui/public/lib/palette-defs.js`, and refuses
 * anything that is not in that entry's declared shape.
 *
 * ── WHY THE BROWSER'S FILE AND NOT A SECOND ONE ───────────────────────────
 *
 * A server-side catalogue would drift from the browser's, and the drift would
 * be silent in exactly the direction that matters: the browser showing one
 * command in a confirm dialog while the server ran another. The confirm is the
 * security boundary (spec §3.3, §6.3) and its entire job is that the string a
 * person read and the argv that runs are the same thing. One file is the only
 * shape in which that is true by construction rather than by discipline.
 *
 * `palette-defs.js` is plain ESM with no DOM reference, no network name and no
 * import of any kind — its own header says so and `palette-lib.test.ts` checks
 * it over the bytes — so Node can load it unchanged.
 *
 * ── WHAT THIS MODULE IS NOT ───────────────────────────────────────────────
 *
 * It composes and it validates. It imports nothing that touches the network,
 * the filesystem or a shell, and it runs nothing. Executing what it returns is
 * `execute.ts`'s job, and the split is deliberate: everything decided here can
 * be tested without a process ever starting.
 */

/**
 * The shape of the catalogue AT THE BOUNDARY, declared rather than inferred.
 *
 * A static `import` of `./public/lib/palette-defs.js` — which the plan's sketch
 * writes — cannot typecheck here: `allowJs` is off and `tsconfig.json`'s
 * `include` is `.ts` only, so a resolved `.js` module is an implicit `any` and
 * `strict` refuses it (TS7016).
 *
 * That specifier is written WITHOUT the `from '…'` form on purpose. `no-writes`'s
 * over-blanking guard scans RAW source for anything shaped like a relative
 * import and requires a parsed statement at that line, so a doc comment quoting
 * the full form reads as an import the masker swallowed — a false alarm on the
 * one guard whose whole job is that a shrinking graph cannot pass silently. The
 * comment moves; the guard stays exact. `palette-lib.test.ts` and
 * `strings-parity.test.ts` both met this and both landed on a URL specifier,
 * which is additionally the only form that survives a Windows path. This file
 * follows them, and states the module's shape here so the rest of the file is
 * typed against something real.
 *
 * `args` and `flags` are optional on this declaration even though every entry
 * in the file today carries both. The fail-safe below is only worth having if
 * an entry added later cannot crash the resolver into a 500 that reads as
 * "server bug" when the honest answer is "that entry declares nothing".
 */
interface FieldSpec {
  name: string;
  required?: boolean;
  boolean?: boolean;
  joined?: boolean;
  options?: string[];
}

interface CommandDef {
  name: string;
  base: string[];
  boundary?: boolean;
  /**
   * **Whether this server may RUN the entry, as opposed to merely describe it.**
   *
   * Until 2026-09-06 there was no such field and no such distinction: the map
   * below was built from `PALETTE` and `resolveCommand` resolved whatever it
   * found, so being in the catalogue at all WAS the execution licence. The
   * consequence, measured in
   * `docs/superpowers/specs/2026-09-06-composer-architecture-review.md` §2b, was
   * that three commands could not be given a checked argument shape without
   * being handed `POST /api/execute` in the same edit — and one of them is
   * `procedure done`, the act this product reserves for its owner in its own
   * printed words. Owner ruling D2 (`reports/2026-09-06-PLAN.md`) split the two.
   *
   * **UNDEFINED MEANS NOT RUNNABLE**, which is the opposite default from
   * `boundary` directly above, deliberately. A forgotten `boundary` costs a
   * reader ceremony they did not need; a forgotten `runnable` would cost them a
   * command nobody licensed. The owner's own words for the rule: *a mistake
   * should withhold execution, never grant it.*
   *
   * That default is only honest because the twenty-seven entries that could
   * already execute were all marked `runnable: true` explicitly in the same
   * pass — see the header of `public/lib/palette-defs.js` — so an omission
   * still means "nobody has ruled on this", exactly as an omitted `boundary`
   * does.
   */
  runnable?: boolean;
  args?: FieldSpec[];
  flags?: FieldSpec[];
  /**
   * Fields the catalogue composes and the Composer screen never offers — today
   * `ack`'s `--all --code <code> --count <n>`, drawn on the Doctor card instead
   * (`DEC-doctor-gets-a-bulk-settlement-overturning-the-no-bulk-ruling`).
   *
   * Declared here for the reason at the top of this file: withholding is a
   * decision about a PICKER, and this module is not a picker. A field this
   * server did not declare would be refused by name, so leaving the list out
   * would not withhold the flag from anyone — it would break the one screen the
   * owner licensed to send it, while the Composer's own `controlSpecs` (which
   * reads `args` and `flags` and nothing else) went on withholding it correctly.
   */
  flagsNotOffered?: FieldSpec[];
}

interface CatalogueModule {
  PALETTE: CommandDef[];
  commandFor: (def: CommandDef, values: Record<string, unknown>) => string[];
}

/**
 * Loaded with a top-level `await` so that `resolveCommand` stays SYNCHRONOUS.
 * A request handler that had to await a catalogue lookup would either await it
 * per request or memoise it in a promise, and both put an `await` between
 * "resolve the argv" and "redeem the nonce against that argv" — a seam in the
 * one ordering spec §3.3 depends on. The catalogue is a constant; it is loaded
 * once, when the module is.
 */
const { PALETTE, commandFor } = (await import(
  new URL('./public/lib/palette-defs.js', import.meta.url).href
)) as CatalogueModule;

/** A refusal a caller may be shown. Distinct from a bug, which is an `Error`. */
export class CommandRefusal extends Error {}

export interface ResolvedCommand {
  id: string;
  argv: string[];
  boundary: boolean;
}

/**
 * Characters that must never reach an argument, whatever the shape says.
 *
 * `execFile` takes an argv array, so none of these can start a second command —
 * this is not shell escaping, and reading it as shell escaping is how it gets
 * "simplified" into a strip. They are refused because they LIE: a newline, a
 * bidi override or a zero-width space renders as something other than what
 * runs, and the confirm dialog's whole job is that those two are the same.
 * `pack import --name` shipped accepting a U+202E override and an embedded
 * newline, measured, which is why this is a REFUSAL and not a sanitisation:
 * stripping would run a command the person did not read, quietly.
 *
 * The set: C0 controls and DELETE; the zero-width and directional MARKS
 * (U+200B–U+200F), which are invisible rather than merely unusual; the
 * deprecated bidi EMBEDDING/OVERRIDE controls (U+202A–U+202E); and the bidi
 * ISOLATES (U+2066–U+2069). Every one of them can make a rendered string
 * differ from the bytes that run.
 */
const DECEPTIVE = /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/;

/**
 * A caller-supplied string, made safe TO QUOTE BACK. Refusal reasons are shown
 * in the browser, so an id or a key carrying an override would reorder the very
 * sentence explaining why it was refused. Escaped, never dropped: the reader
 * has to be able to see what was actually sent.
 */
function readable(text: string): string {
  return text
    .replace(DECEPTIVE, (ch) => `\\u${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`)
    .slice(0, 60);
}

/**
 * Looked up through a `Map`, never property access on an object literal. `id`
 * is caller-supplied text, and `catalogue['__proto__']` on a plain object is a
 * hit that resolves to something that is not a command.
 */
const BY_ID = new Map<string, CommandDef>(PALETTE.map((def) => [def.name, def]));

/**
 * Every id the catalogue has, in catalogue order — including the two-word
 * subcommand spellings (`review promote-revision`). The browser sends the
 * `name` verbatim, so neither side normalises and there is no spelling that
 * exists on one side only.
 *
 * **This is NOT the executable set, and it used to be.** Every id here can be
 * DESCRIBED — a form drawn for it, an argv composed and shown — and only the
 * subset `runnableIds()` returns can be run. Reading this list as a licence is
 * the exact conflation owner ruling D2 ended; `resolveCommand` refuses the
 * difference.
 */
export function catalogueIds(): string[] {
  return [...BY_ID.keys()];
}

/**
 * Which of an entry's two licences is being asked about: may this RUN.
 *
 * `=== true` and not `!== false`, and the asymmetry with `boundaryOf` below is
 * the whole point — see `runnable` on `CommandDef`. An entry that says nothing
 * has not been licensed by anybody, and this function is where that sentence is
 * enforced rather than remembered.
 */
export function runnableOf(def: { runnable?: boolean }): boolean {
  return def.runnable === true;
}

/**
 * **The executable set: every id this server will run, and no other.**
 *
 * Named as a function rather than left implicit in `resolveCommand` because
 * "what can this server run" is a question a test, an audit and a reader all
 * have to be able to ask in one call. `test/ui/execute-catalogue.test.ts` pins
 * it to the twenty-seven names that were executable before the flag existed.
 */
export function runnableIds(): string[] {
  return [...BY_ID.values()].filter(runnableOf).map((def) => def.name);
}

/**
 * The catalogue's entries, for a gate that has to ask about the DEFS rather than
 * about a resolved command — chiefly "does every entry declare a boundary".
 *
 * Read-only by type and by intent: nothing here is a place to mutate the
 * catalogue from, and a caller that wants a command wants `resolveCommand`.
 */
export function catalogueEntries(): readonly Readonly<CommandDef>[] {
  return PALETTE;
}

/**
 * Which confirm an entry gets: `true` is the field-by-field diff, `false` is the
 * plain one naming the command and its argv.
 *
 * AN ENTRY WITH NO `boundary` KEY IS ON THE BOUNDARY. That is the fail-safe, and
 * it is what makes spec §6.1's "a command added later automatically gets the
 * STRONGER confirm" true without anyone having to remember: a stale
 * classification costs ceremony, never a silent write.
 *
 * For that default to mean anything, an omission has to be RARE and has to mean
 * "nobody has classified this yet". So on 2026-08-27 every one of the
 * catalogue's entries was given the key explicitly — the fourteen that already
 * carried `boundary: true`, and the ten reads plus `rebuild` and
 * `lesson-discard` that now carry `boundary: false` with the reason beside them.
 * Before that pass there was no `boundary: false` anywhere in the file, so this
 * function resolved every entry as `true` including `doctor`, which spec §3.2
 * puts below the line. The fail-safe was working exactly as specified; what was
 * missing was anybody having said what the reads are.
 *
 * `test/ui/palette-lib.test.ts` derives the same classification from the REAL
 * argument parser and fails when the catalogue disagrees with it, so this flag
 * is a cache of a measurement rather than somebody's opinion.
 */
export function boundaryOf(def: { boundary?: boolean }): boolean {
  return def.boundary !== false;
}

export function resolveCommand(id: string, values: Record<string, unknown>): ResolvedCommand {
  const def = BY_ID.get(id);
  if (def === undefined) {
    throw new CommandRefusal(`no command named "${readable(String(id))}" is in the catalogue`);
  }

  // **The second licence, and it is refused BEFORE anything is composed.**
  //
  // Both routes that reach this function — the confirm GET and the execute POST
  // — are stopped here, which is deliberate: a confirm dialog for a command
  // that can never run is a question with no answer, and rendering one would
  // teach a reader that the button works. The refusal is a `CommandRefusal`, so
  // it arrives as a 400 carrying this sentence rather than as the 404 an
  // uncatalogued id gets, and the difference is the thing worth reading: the
  // catalogue KNOWS this command, it composed the line on screen, and it is
  // declining to be the one that runs it.
  if (!runnableOf(def)) {
    throw new CommandRefusal(
      `${id} is composed here and is not run here. Its catalogue entry is marked `
      + `runnable: false, which is this project's way of saying nobody has licensed this `
      + `command to execute from the browser — not that it failed. The line shown beside `
      + `this message is the whole command: copy it and run it in your own shell.`,
    );
  }

  // The body is parsed JSON from a request. `Object.keys(null)` throws, and a
  // TypeError here would surface as a 500 — "the server broke" — for what is
  // plainly a bad request.
  if (values === null || typeof values !== 'object' || Array.isArray(values)) {
    throw new CommandRefusal(`${id}: values must be an object of named arguments`);
  }

  // **A READ RESOLVES EXACTLY LIKE A WRITE, and as of 2026-09-07 there is no
  // longer anything that could suggest otherwise.**
  //
  // This paragraph used to argue that `list`, `show` and `search` were not a
  // separate case despite carrying an `endpoint` — a browser-side field that
  // answered a read without running anything, which the server never called.
  // That field is gone from the catalogue along with `screen` and the Composer's
  // Run button (`DEC-run-is-removed-execute-is-the-only-way-to-run-what-the`),
  // so every entry now offers this module one `base` and nothing else.
  //
  // The rule it was defending is unchanged and is why the note stays: a query
  // resolves to the same CLI invocation a person could type, which is what §6.1
  // means by "everything in the catalogue runs". A catalogue that meant two
  // different things depending on which side read it is the one outcome this
  // module exists to prevent — and it is now unrepresentable rather than merely
  // argued against.
  const args = def.args ?? [];
  // Every field the entry can COMPOSE, which is not the same set as the fields
  // one screen may OFFER; see `flagsNotOffered` on `CommandDef`. In `commandFor`'s
  // own concatenation order, so `declared` and the argv agree about the entry.
  const flags = [...(def.flags ?? []), ...(def.flagsNotOffered ?? [])];
  const specs = [...args, ...flags];
  const declared = new Map(specs.map((spec) => [spec.name, spec]));

  // Refused, not dropped. A key the entry does not declare means the caller and
  // the catalogue disagree about what this command is, and silently ignoring it
  // is how a client comes to rely on a value the server never applied.
  for (const key of Object.keys(values)) {
    const spec = declared.get(key);
    if (spec === undefined) throw new CommandRefusal(`${id} does not take "${readable(key)}"`);

    const value = values[key];
    if (spec.boolean === true) {
      // A switch is a real boolean. `commandFor` emits `--yes` only for `true`
      // and skips anything else in silence, so a coerced `'false'` would
      // compose a command missing the flag the confirm dialog had just shown.
      if (typeof value !== 'boolean') {
        throw new CommandRefusal(`${id}: ${key} is a switch and takes true or false`);
      }
      continue;
    }
    if (typeof value !== 'string') {
      throw new CommandRefusal(`${id}: ${key} must be text`);
    }
    if (DECEPTIVE.test(value)) {
      throw new CommandRefusal(
        `${id}: ${key} contains a character that would not display as it runs (${readable(value)})`,
      );
    }
    if (spec.options !== undefined && !spec.options.includes(value)) {
      throw new CommandRefusal(
        `${id}: ${key} is "${value.slice(0, 40)}" and takes one of: ${spec.options.join(', ')}`,
      );
    }
  }

  let argv: string[];
  try {
    argv = commandFor(def, values);
  } catch (error) {
    // `commandFor` throws on a missing required argument — "<name>: <arg> is
    // required". That is a refusal a caller may be shown, not a bug: it is the
    // catalogue declining to compose a half-built command, which is the same
    // answer the browser gets from the same function.
    throw new CommandRefusal((error as Error).message);
  }

  return {
    id,
    // `base` is `['mycontext', <verb>, …]` because the catalogue composes what a
    // HUMAN types. The server runs the CLI it ships with, so the program name
    // comes from the server and is never taken from the catalogue — dropping it
    // here is what makes that true rather than promised.
    argv: argv.slice(1),
    boundary: boundaryOf(def),
  };
}
