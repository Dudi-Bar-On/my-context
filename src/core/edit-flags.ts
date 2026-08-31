/**
 * **`edit`'s flag surface, RESOLVED for one workspace — the read model over
 * what only this project can answer (plan:builder seq:2b).**
 *
 * Every other command in this CLI has a static flag spec, and
 * `core/command-flags.ts` holds all thirty of them. `edit` resists, and the
 * reason is not an accident of implementation: its accepted set is
 * `[...ALLOWED, ...declaredFlags(ws.config)]`, where the second half is
 * whatever flags THIS project's categories declare a `mycontext edit` spelling
 * for in their `updates` block. A project declaring `state` on `task` accepts
 * `--state`; a project that does not, does not. There is no static entry that
 * is true, so a builder over the static catalogue can compose a command line
 * for `edit` that is right here and refused next door.
 *
 * **Worth noticing that this is the requirement working rather than failing.**
 * The owner asked that syntax be enforced by the selections a person makes, and
 * the one command whose syntax is defined BY THE USER is the one that needs the
 * server to say what it is.
 *
 * ── WHY IT IS A `core/` MODULE AND NOT A FUNCTION ON THE COMMAND ───────────
 *
 * `declaredFlags` and `isEditFlag` lived in `src/cli/commands/edit.ts`, which
 * imports `updateItem`, `unlinkItems` and `stageRevision`. A read surface that
 * wants to know what `mycontext edit` accepts here may not import that module —
 * `test/ui/no-writes.test.ts` is the gate, and the whole argument is in
 * `core/command-flags.ts`'s header. So the computation moved and the command
 * imports it back, exactly as the thirty static specs did.
 *
 * What did NOT move is `cmdEdit` itself: this module answers "what would be
 * accepted", never "do it".
 *
 * ── WHAT A DECLARED FLAG'S DECLARATION IS, AND WHERE IT COMES FROM ─────────
 *
 * `FLAG_DECLARATIONS` (command-flags.ts) says what a flag means and what may be
 * put in it. For a flag this project DECLARED, that answer already exists one
 * level up and is written by the same person: `UpdatableName` (categories.ts)
 * carries a closed `values` vocabulary, an absent one meaning free text, and a
 * `note` a person reads. `declarationOf` below is that record read as a flag
 * declaration rather than a second description of it — which is the whole point
 * of `plan:builder seq:2` choosing `UpdatableName`'s shape in the first place.
 */
import type { UpdatableName } from './categories.ts';
import type { Config } from './config.ts';
import type { FlagDeclaration, FlagDeclarations, FlagSpec } from './command-flags.ts';
import { SEVERITIES, STATUSES } from './validate.ts';
import { updatesFor } from './tag-projection.ts';

/**
 * The flags `edit` spells itself, and therefore never derives.
 *
 * Moved out of `cli/commands/edit.ts` with the rest of the resolution, and it
 * is the ONE list in this module that is not derived from anything: these
 * eleven are what `cmdEdit`'s own code reads. The command binds them back
 * rather than keeping a copy, so a twelfth added there and not here would be
 * accepted by the parser and invisible to every builder — which is the exact
 * shape of drift this plan exists to end.
 */
export const EDIT_FLAGS: FlagSpec = {
  allowed: [
    'title', 'body', 'scope', 'tags', 'severity', 'always', 'continuity', 'status', 'extra',
    'unlink', 'yes',
  ],
  values: ['title', 'body', 'scope', 'tags', 'severity', 'status', 'extra'],
};

/**
 * `--unlink <relation> <target>` is the one flag in this product a
 * `{ allowed, values }` record cannot describe, and saying so is cheaper than
 * letting a builder discover it.
 *
 * It takes TWO operands and `takeUnlinks` strips them out of argv before any
 * shared helper sees them, so it is neither a bare switch nor a value flag: it
 * is absent from `EDIT_FLAGS.values` because `unknownFlag` must not swallow one
 * token of a pair, and a control built from that alone would compose
 * `--unlink` with nothing after it.
 */
export const UNLINK_ARITY = 2;

/** What `edit`'s own eleven mean. `unlink` carries its arity in the note. */
const BUILT_IN_DECLARATIONS: FlagDeclarations = {
  title: {
    format: 'one line of prose', example: 'Never log secrets',
    note: 'Replace the item\'s title.',
  },
  body: {
    format: 'prose — the whole body, replacing what is there',
    example: 'Secrets in logs outlive the incident.',
    note: 'Replace the item\'s body. It is a replacement, not an append.',
  },
  scope: {
    format: 'comma-separated path globs', example: 'src/**,docs/*.md',
    note: 'Replace the paths this item attaches to. This changes what the item REACHES, so it '
      + 'carries the before-and-after preview.',
  },
  tags: {
    format: 'a comma-separated list that REPLACES the whole set', example: 'v2,ui',
    source: 'tags',
    note: 'Every tag the item should end with. A tag you leave out is removed - there is no '
      + 'spelling that adds one to what is there.',
  },
  severity: {
    values: SEVERITIES,
    note: 'hard items are admitted to a budget before soft ones. `mycontext harden` and '
      + '`mycontext soften` are these two settings under a shorter name.',
  },
  always: {
    note: 'Pin the item: inject it in full at every session start. `--always=false` clears it, '
      + 'and `mycontext pin`/`mycontext unpin` are the same two edits under a shorter name.',
  },
  continuity: {
    note: 'Mark the item for the continuity tier, re-delivered at every session start. '
      + '`--continuity=false` clears it.',
  },
  status: {
    values: STATUSES.filter((s) => s !== 'superseded'),
    note: 'Move the item\'s lifecycle status. `superseded` is refused here, because a retirement '
      + 'names its replacement and records it both ways - that is `mycontext supersede`.',
  },
  extra: {
    format: 'key=value, one key per flag', example: 'directive=do',
    note: 'One category-specific field. It MERGES: a key you do not name keeps its value.',
  },
  unlink: {
    format: 'two operands, a relation and a target id, in that order',
    example: 'refines RULE-never-log-secrets',
    source: 'items',
    note: 'Remove one relation. It is the only flag in this CLI that takes TWO operands, which '
      + 'is why no static flag/value model describes it.',
  },
  yes: {
    note: 'Answer the confirmation without a prompt. `edit` is on the approval boundary: it '
      + 'changes what governs this project.',
  },
};

/**
 * Whether a declaration says its name is typed as a flag OF `edit`.
 *
 * Moved verbatim from `cli/commands/edit.ts`; the reasoning is unchanged and is
 * worth keeping where the function is. The declared `command` is the whole
 * test, and that direction is deliberate: `mycontext help categories` and
 * `mycontext examples <type>` print that string verbatim as the spelling a
 * person types, so anything else would let the printed instruction and the
 * accepted argv drift. A declaration with no `command` means the generic
 * `--extra <name>=<value>` spelling, and one naming a different command —
 * `mycontext pin`, `mycontext harden` — is that command's business.
 *
 * `store: 'field'` as well, because a `tag` is a membership: `--tags` is the
 * only thing that writes one.
 *
 * Tokenised rather than matched with a regular expression built from a
 * user-supplied name: these names come out of `config.json`, and `--state` must
 * not match `--stateful` or carry metacharacters into a pattern.
 */
export function isEditFlag(name: string, decl: UpdatableName): boolean {
  if (decl.store !== 'field' || decl.command === undefined) return false;
  if (!decl.command.startsWith('mycontext edit ')) return false;
  return decl.command.split(/[\s=]+/).includes(`--${name}`);
}

/**
 * Every value flag `edit` accepts BEYOND the eleven it spells itself, in name
 * order, unioned over the categories this project has.
 *
 * The union rather than one category's, because argv is parsed before the item
 * — and therefore its type — is known. A flag declared by SOME category is
 * accepted and then checked against the item's OWN declaration once it is
 * loaded (`undeclaredFlagError`, edit.ts), which is the same two-stage shape
 * `--severity` already has.
 *
 * Nothing in the shipped catalogue derives a flag, so this is empty for a
 * project that has declared nothing of its own and costs it one pass over the
 * catalogue.
 */
export function declaredEditFlags(config: Config): string[] {
  const builtIn = new Set(EDIT_FLAGS.allowed);
  const names = new Set<string>();
  for (const category of Object.values(config.categories)) {
    for (const [name, decl] of Object.entries(updatesFor(config, category.name))) {
      if (!builtIn.has(name) && isEditFlag(name, decl)) names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * One declared name read as a flag declaration.
 *
 * `UpdatableName` already answers what `FlagDeclaration` asks — a closed
 * `values`, or its absence meaning free text, plus a `note` — so this is a
 * projection and not a translation. The one thing it must add is a `format` and
 * an `example` for the free-text case, and it says the true thing rather than
 * inventing a shape: the value goes into a FIELD on the item, and what that
 * field will accept is whatever the category declared, which for a name with no
 * vocabulary is "anything". A hint that claimed more than that would be the
 * invented answer this whole table exists to replace.
 */
function declarationOf(name: string, decl: UpdatableName): FlagDeclaration {
  if (decl.values !== undefined) return { values: decl.values, note: decl.note };
  return {
    format: `free text — this project declares no closed vocabulary for "${name}"`,
    example: '',
    note: decl.note,
  };
}

/** `edit`'s accepted flags and what each one means, for ONE workspace. */
export interface EditFlagSurface extends FlagSpec {
  /** The names this project's own categories added. Empty is the common case. */
  declared: string[];
  /** Every flag in `allowed`, described. */
  flags: FlagDeclarations;
}

/**
 * The whole answer, computed from a config.
 *
 * This is what `GET /api/flags/edit` serves and what `cmdEdit` parses with, so
 * the surface a builder composes against and the surface the parser enforces
 * are one function call rather than two agreeing implementations.
 */
export function editFlagSurface(config: Config): EditFlagSurface {
  const declared = declaredEditFlags(config);
  const flags: Record<string, FlagDeclaration> = { ...BUILT_IN_DECLARATIONS };
  for (const category of Object.values(config.categories)) {
    for (const [name, decl] of Object.entries(updatesFor(config, category.name))) {
      if (declared.includes(name) && !Object.hasOwn(flags, name)) {
        flags[name] = declarationOf(name, decl);
      }
    }
  }
  return {
    allowed: [...EDIT_FLAGS.allowed, ...declared],
    values: [...EDIT_FLAGS.values, ...declared],
    declared,
    flags,
  };
}
