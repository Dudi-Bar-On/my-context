import { COMMANDS } from '../cli/commands/registry.ts';

/**
 * **The surface map: what the model can do, and what the user can do.**
 *
 * The requirement this file exists to make checkable, in the owner's words:
 * *"anything the model can do through a tool, the user should be able to do
 * through a command"*. Before Phase 4 that was aspiration — there were eleven
 * MCP tools and slash commands covering about four of them — and the gap was
 * discovered a surface at a time, by someone looking for a command that was
 * not there.
 *
 * So the map is declared here and enforced by `test/plugin/parity.test.ts`,
 * which checks it against the running program in both directions: every tool
 * in `TOOL_NAMES` appears below exactly once, every CLI name it claims is a
 * command the CLI really dispatches, and every slash name it claims is a file
 * really on disk. The declaration cannot drift from the product without the
 * test naming what moved.
 *
 * **The rule, stated as narrowly as it is enforced:** every MCP tool has at
 * least one user-invocable counterpart — a CLI command, a slash command, or
 * both. Where one of the two is missing, that is a decision, and it carries
 * its reason in `note`. This is deliberately weaker than "every tool has a
 * slash command", because that would be a rule the product does not follow and
 * has good reason not to: `mycontext_help` is answered for a user by
 * `mycontext help <topic>`, and a `/mycontext:help` whose entire content was
 * "run `mycontext help`" would be a file with nothing of its own in it.
 *
 * The other direction — CLI commands with no slash command — is
 * `CLI_WITHOUT_SLASH`, and it is listed rather than derived for the same
 * reason: the point is that each absence was decided.
 */

/** One MCP tool and the two user surfaces that answer it. */
export interface ToolParity {
  /** The tool name, exactly as `TOOL_NAMES` spells it. */
  tool: string;
  /**
   * The `mycontext <name>` counterpart, or null when there is none.
   *
   * Matched loosely on purpose, by the same rule `CLI_WITHOUT_SLASH` uses: a
   * name counts as covered when a command equals it or extends it with a
   * hyphen, because `add` is reached as `add <category>` on the CLI and as
   * `/mycontext:add-<category>` on the slash surface.
   */
  cli: string | null;
  /** The `/mycontext:<name>` counterpart, or null when there is none. */
  slash: string | null;
  /** Required whenever `cli` or `slash` is null. Why, not what. */
  note?: string;
}

export const TOOL_PARITY: ToolParity[] = [
  { tool: 'create_item', cli: 'add', slash: 'add' },
  { tool: 'get_item', cli: 'show', slash: 'show' },
  { tool: 'ingest_document', cli: 'ingest', slash: 'ingest' },
  // `mycontext link <from> <relation> <to>` — added 2026-09-04 (owner
  // instruction, "support relation using the cli too"). Both counterparts
  // exist now, so no note: recording a relation is the one write with no
  // trust boundary on it (`LinkInput` carries no `origin`, because an added
  // edge cannot change what governs), which is why neither surface gates it —
  // `/mycontext:link` calls the tool directly and `mycontext link` takes no
  // `--yes`. The REMOVAL half stays the opposite case: `mycontext edit
  // --unlink` exists and no tool does, because removing an edge CAN weaken
  // what a governing item asserts and therefore runs under `edit`'s own gate.
  { tool: 'link_items', cli: 'link', slash: 'link' },
  { tool: 'audit_log', cli: 'audit', slash: 'audit' },
  { tool: 'doctor', cli: 'doctor', slash: 'doctor' },
  { tool: 'focus_context', cli: 'focus', slash: 'focus' },
  { tool: 'list_drafts', cli: 'review', slash: 'review' },
  {
    tool: 'load_context', cli: null, slash: 'LoadMyContext',
    note:
      'Injection happens into a session, and a terminal is not one. There is nothing for ' +
      'a CLI command to inject into, so the counterpart is the slash command and the ' +
      'absence is a property of the act rather than a gap in the surface.',
  },
  {
    tool: 'mycontext_examples', cli: 'examples', slash: null,
    note:
      'Answered for a user by `mycontext examples <category>`. A `/mycontext:examples` ' +
      'whose whole content was "run that command" would carry nothing of its own, and ' +
      'the per-category `add-<type>` commands already point at it where it is needed.',
  },
  {
    tool: 'mycontext_help', cli: 'help', slash: null,
    note:
      'Answered for a user by `mycontext help <topic>`, and by both READMEs, which are ' +
      'longer and better organised than any command file could be. Same reasoning as ' +
      '`mycontext_examples`.',
  },
  { tool: 'query_items', cli: 'search', slash: 'search' },
  { tool: 'ready', cli: 'ready', slash: 'ready' },
  { tool: 'refresh_item', cli: 'refresh', slash: 'refresh' },
  { tool: 'supersede_item', cli: 'supersede', slash: 'supersede' },
  { tool: 'update_item', cli: 'edit', slash: 'edit' },
  { tool: 'decay_report', cli: 'decay', slash: 'decay' },
  {
    tool: 'list_ingest_sessions', cli: 'ingest-status', slash: null,
    note:
      'Answered for a user by `mycontext ingest-status`, and — per `CLI_WITHOUT_SLASH` — ' +
      'already reported by `/mycontext:status` and by `/mycontext:ingest` on resume. A slash ' +
      'command for the bare listing would carry nothing beyond what those two already print.',
  },
  // `cli: 'lesson-stage'` — an EXACT match against a real, independently
  // registered command, never the hyphen fallback. It used to also read as
  // covering `mycontext lesson` (a genuinely different command; see
  // `lesson.ts`), because `covered`'s hyphen rule could not tell a sibling
  // command from a sub-form spelled under a longer name — measured 2026-09-04
  // and fixed in `covered` itself, which now consults the command registry
  // rather than the strings. Bare `lesson` now has its OWN row below
  // (`create_lesson`), rather than being read as covered by this one.
  { tool: 'stage_rule_candidates', cli: 'lesson-stage', slash: 'lesson-stage' },
  {
    tool: 'preview_pack_import', cli: 'pack', slash: null,
    note:
      'Answered for a user by `mycontext pack import`/`mycontext pack list`. `CLI_WITHOUT_SLASH.pack` ' +
      'already refuses a slash command for the ACT of importing — an agent taking, on the ' +
      'user\'s behalf, the one act two confirmations exist to keep with a person. This tool ' +
      'never imports (it wraps the pure, non-writing half of `pack/import.ts`), but the ' +
      'preview it prints ends in the command a human runs next, and a slash command that then ' +
      'ran the command it had just printed would be the same act by the back door.',
  },
  { tool: 'status_report', cli: 'status', slash: 'status' },
  { tool: 'list_todos', cli: 'todo', slash: 'todo' },
  // `list`'s slash counterpart is covered only under the hyphen rule — there
  // is no bare `commands/list.md`, but `commands/list-<category>.md` is
  // generated per category (`list-adr.md`, `list-todo.md`, …) and none of
  // those is itself a registered CLI command, which is exactly the sub-form
  // shape `covered`'s hyphen half exists for.
  { tool: 'list_items', cli: 'list', slash: 'list' },
  { tool: 'create_lesson', cli: 'lesson', slash: 'lesson' },
  { tool: 'read_procedure', cli: 'procedure', slash: 'procedure' },
  // All three surfaces, and that is the owner's ruling of 2026-09-06 rather
  // than a default: *"i want you to implement all 3 ways: a cli command, a
  // slash command and a MCP tool, all should trigger handover update on
  // demand."* So there is no absence to record here and no note to write —
  // `mycontext handover ask`, `/mycontext:handover` and this tool are three
  // entry points onto `askHandoverNow`, which decides everything all three
  // report.
  { tool: 'ask_handover', cli: 'handover', slash: 'handover' },
];

/**
 * The CLI commands with no slash command, and why each one has none.
 *
 * Every entry is one of two things: a command that runs once, before there is
 * a session to run a slash command in, or a step of a flow whose slash command
 * deliberately stops before it and hands control back (see `statefulCommands`
 * in `commands.ts`). Nothing here is "we did not get to it" — the test refuses
 * an entry with no reason and refuses a command that is missing from the list.
 */
export const CLI_WITHOUT_SLASH: Record<string, string> = {
  ack: 'Records that a PERSON read a doctor finding and ruled on it, so the acknowledgement is ' +
    'only worth anything if a person made it. `acknowledgeFinding` (core/mutate.ts) refuses ' +
    'every origin but `human`, and a slash command is a model typing the command - which is ' +
    'the one caller this write exists to exclude. It is read out of `mycontext doctor` and ' +
    'typed by the person who read it.',
  carry: 'A one-shot override of what the very next injection delivers, spent whether or not ' +
    'the marked id is admitted — owner ruling 2026-09-04, a judgement about NOW rather than ' +
    'forever. It exists precisely because a person looked at what spilled and decided one ' +
    'item was required; a slash command would let a model make that same call on its own, ' +
    'the same reason `ack` has none. It is read out of the spilled-items list and typed by ' +
    'the person who read it.',
  conversation: 'Reads the transcripts Claude Code has already written on disk and indexes ' +
    'them; it is the scanner behind the ARCHIVE, not a corpus operation. A model has no use ' +
    'for it — the conversation it would be asking about is the one it is having — and the ' +
    'browsing it exists to serve was ruled a web feature by the owner, on the Conversations ' +
    'screen. The one caller who benefits is a person filling the index before opening that ' +
    'screen.',
  config: 'Edits the config that governs what every item of a category may declare, so its ' +
    'blast radius is the corpus rather than one item — which is why it prints the number of ' +
    'items a change would touch, and copies config.json aside before writing. Both exist to ' +
    'be READ by the person about to consent, and a slash command is a model typing the ' +
    'command past them. It is on the recommended deny list for the same reason `repair` is.',
  init: 'Creates the workspace. It is what you run before there is anything for a slash ' +
    'command to talk to, and the plugin\'s own SessionStart hook tells you to run it.',
  rebuild: 'Reconstructs the index from the Markdown. Every command that reads the corpus ' +
    'already rebuilds first, so a user reaches for this only when told to by `doctor`.',
  repair: 'Re-stamps checksums after a hand edit, and its preview is a page of consequences ' +
    'a person has to read. It is on the recommended deny list; a slash command for it ' +
    'would be a prompt whose only honest content is "do not let me do this".',
  help: 'The topics are `mycontext help <topic>` and both READMEs. See TOOL_PARITY\'s note ' +
    'on `mycontext_help`.',
  examples: 'See TOOL_PARITY\'s note on `mycontext_examples`.',
  export: 'Writes an artefact to a path outside the workspace, which a slash command cannot ' +
    'choose safely on the user\'s behalf: the destination is the whole decision, and a prompt ' +
    'that guessed one would be writing a stranger-readable copy of the corpus somewhere the ' +
    'user did not name.',
  pack: 'Imports a stranger\'s corpus into yours, behind two confirmations — the second of '
    + 'which is the only route by which an item you wrote is replaced by an item somebody else '
    + 'wrote. A slash command for it would be an agent taking that act on your behalf, which is '
    + 'the one thing the two gates exist to keep with a person. This is deliberate future work '
    + 'rather than an absence: a slash command that only PREVIEWED an import — the collision '
    + 'report, and then a printed `mycontext pack import` for you to run — is the shape '
    + '`/mycontext:lesson-stage` already uses, and it is what this row is waiting for.',
  'ingest-apply': '`/mycontext:ingest` runs it — it is step 4 of that command, not a ' +
    'command of its own. Splitting it out would offer a user a step with no session id ' +
    'and no extracted candidates to pass it.',
  'ingest-status': 'Reported by `/mycontext:status`, which prints the unfinished-ingest ' +
    'line, and by `/mycontext:ingest` itself when a session is resumed.',
  'lesson-accept': 'The approval gate. `/mycontext:lesson-stage` prints this command for ' +
    'the user to run and stops; a slash command that ran it would be the agent accepting ' +
    'a rule on the user\'s behalf, which is the one act this flow exists to prevent.',
  'lesson-discard': 'The other half of the same gate, printed by `/mycontext:lesson-stage` ' +
    'for the same reason. It permanently rejects a candidate, which is not reversible from ' +
    'any command here.',
  statusline: 'Configuration belonging to Claude Code rather than anything in this corpus. '
    + 'Run bare it reads a payload that only Claude Code sends, on stdin, which a slash '
    + 'command has no way to produce; and `statusline install` edits settings.json, which is '
    + 'a decision about the editor the user is sitting in, taken by that user, in a terminal. '
    + 'A slash command for it would be the model reconfiguring the tool it runs inside.',
};

/**
 * Whether `name` has a surface among `available`: an exact match, or a
 * longer name extending it with a hyphen — PROVIDED that longer name is not
 * itself a registered CLI command.
 *
 * The hyphen half exists for a cross-surface case, not a convenience. The
 * shipped catalogue is spelled into command NAMES (`add-rule`, `list-rule`,
 * …), generated per category so a disabled one keeps no command, and `list`
 * therefore has a slash surface only under a longer name. Neither
 * `add-rule` nor `list-rule` is ever a CLI command in its own right — the
 * real CLI command is `add <category>` / `list <category>`, dispatched on an
 * argument, and the hyphenated spelling exists only on the slash surface.
 * `test/docs/counts.test.ts` applies the same rule to the same question, and
 * the two must not disagree.
 *
 * What the hyphen rule must NOT do is call two independently registered CLI
 * commands the same thing because one name happens to begin with the other
 * plus a hyphen — a SIBLING, not a sub-form. `lesson` and `lesson-stage` are
 * both real, separately registered commands (`registry.ts`) doing different
 * things (the usage banner lists them apart: one records a lesson and
 * requests candidate rules, the other stages derived rule candidates for
 * approval), and `'lesson-stage'.startsWith('lesson-')` used to be read as
 * "lesson-stage covers lesson", which is false — a tool that wraps
 * `lesson-stage` covers nothing about bare `lesson`. The registry is
 * therefore consulted: a candidate extension only counts as a sub-form when
 * it is NOT itself a name `COMMANDS` dispatches, which is exactly the
 * property that separates `add-rule` (never independently registered) from
 * `lesson-stage` (independently registered, and dispatched on its own).
 *
 * `add` now answers on both halves: `commands/add.md` is the generic capture
 * whose category is an argument rather than part of the name — the only shape
 * that can reach a category this build never saw, since the per-category files
 * are generated when the plugin is built. That makes this row's `slash: 'add'`
 * literal as well as true by the hyphen rule; the hyphen half still carries
 * `list`, so it cannot be dropped.
 */
export function covered(name: string, available: string[]): boolean {
  return available.some(
    (n) => n === name || (n.startsWith(`${name}-`) && !COMMANDS.has(n)),
  );
}

/**
 * The other reverse: `TOOL_PARITY` asserts every TOOL has a user surface, and
 * `CLI_WITHOUT_SLASH` asserts every CLI command has a slash surface OR a
 * reason. Nothing asserted the third leg — that every CLI command has a
 * TOOL — until this row, and `test/plugin/parity.test.ts` found the gap by
 * deriving both sides and taking the difference: it was large, and nobody
 * had looked at it as a set.
 *
 * `disposition` is the one thing `CLI_WITHOUT_SLASH` does not carry, and it
 * is here because the two absences are not the same claim:
 *
 * - `'intended'` — a structural reason blocks a tool, not merely that one
 *   has not been written. Most of these carry a fact the test re-checks
 *   below (a hardcoded `origin: 'human'`, a `workspace: 'none'` registration,
 *   a raw-SQL usage string) rather than only a sentence, because a sentence
 *   is exactly what went stale silently on `ready`'s `CLI_WITHOUT_SLASH` row
 *   before this file existed: both of its clauses had stopped being true and
 *   nothing caught it until a person reread the prose.
 * - `'owed'` — nothing in the code refuses a non-human caller; the command
 *   sits in the space the board names, undecided rather than impossible. An
 *   `'owed'` row makes NO claim beyond "no tool exists today", which is
 *   exactly what the derived-set comparison already re-checks on every run —
 *   the day a tool ships for one, its name drops out of the derived
 *   "without" list, the dictionary now names a row nothing produced, and the
 *   test fails until the row is deleted. That is the whole of what makes an
 *   `'owed'` reason self-checking: there is nothing under it to go stale,
 *   only a fact the next test run either finds true or does not.
 *
 * `'intended'` rows are the harder promise, because "no tool should ever
 * cover this" can go stale quietly, exactly the way `ready` did: the code
 * fact the reason describes changes and the reason keeps asserting the old
 * one. Where
 * a reason cites a fact this file's own test can re-check by reading the
 * source it names, it does; where it cannot (`session`, `statusline`,
 * `lesson-discard`), the test says so in place of pretending a prose
 * assertion is enforcement.
 */
export type ToolAbsenceDisposition = 'intended' | 'owed';

export interface ToolAbsence {
  /** See the file comment above: 'intended' or 'owed', never left unsaid. */
  disposition: ToolAbsenceDisposition;
  /** Why, not what. Required, same floor `CLI_WITHOUT_SLASH` holds its notes to. */
  reason: string;
}

/**
 * The CLI commands with no tool counterpart, and why.
 *
 * Compared against `TOOL_NAMES` and `TOOL_PARITY`, both derived — never a
 * second hand-kept list next to `TOOL_PARITY`'s own `cli` column, which is
 * where the true set of "tool-covered" CLI names already lives once a row's
 * `cli` field is read out of it. See `test/plugin/parity.test.ts` for the
 * comparison and every self-check keyed to a row below.
 */
export const CLI_WITHOUT_TOOL: Record<string, ToolAbsence> = {
  carry: {
    disposition: 'intended',
    reason:
      'Same fact `CLI_WITHOUT_SLASH.carry` cites: it exists so a PERSON can override the ' +
      'next injection for one item they just decided is required, not so a model can do the ' +
      'same on its own initiative. `cli/commands/carry.ts` stamps `setBy: \'human\'` at the ' +
      'one call site that writes the mark, unconditionally — there is no `--agent` escape ' +
      'hatch the way `mycontext lesson` has one — and a tool call would exist only to make ' +
      'the same judgement the command is written to keep with a person.',
  },
  ack: {
    disposition: 'intended',
    reason:
      'Same fact `CLI_WITHOUT_SLASH.ack` cites, and it forecloses a tool even harder than a ' +
      'slash command: `acknowledgeFinding` (core/mutate.ts) throws for every origin but ' +
      '`human`, unconditionally — there is no `--agent` escape hatch here the way `mycontext ' +
      'lesson` has one. A tool call IS a non-human caller by construction, so a tool for `ack` ' +
      'would exist only to be refused on every call.',
  },
  conversation: {
    disposition: 'intended',
    reason:
      'It indexes and reads the conversation transcripts the harness writes, which is a ' +
      'retrieval question a PERSON asks and not one an agent does: an agent asking what was ' +
      'said in a past session ' +
      'is asking for context the corpus is supposed to carry, and answering it from raw ' +
      'transcripts would route around every tier and budget this product has. The read half is ' +
      'served to the browser instead, at GET /api/conversations, where a person is doing the ' +
      'looking.',
  },
  config: {
    disposition: 'intended',
    reason:
      'It rewrites the config that decides what every item of a category may declare, and ' +
      'its two safeguards are both things a PERSON reads: the count of items a change would ' +
      'touch, printed before the gate, and the backup path printed after. A tool call ' +
      'consumes neither — it would satisfy `--yes` by passing a flag, which is consent ' +
      'without the reading the consent is for. `CLI_WITHOUT_SLASH.config` forecloses the ' +
      'slash command on the same ground, and the recommended deny list agrees.',
  },
  export: {
    disposition: 'intended',
    reason:
      'Writes this corpus to a path OUTSIDE the workspace, chosen by `--out <path>` — a ' +
      'required flag with no default (see the usage self-check below). The destination is the ' +
      'whole decision `CLI_WITHOUT_SLASH.export` already names for the slash case, and it is ' +
      'sharper for a tool: a model choosing a filesystem path on the caller\'s behalf, with no ' +
      'person watching the call, is the same "stranger-readable copy somewhere nobody named" ' +
      'outcome with one fewer chance to notice.',
  },
  harden: {
    disposition: 'intended',
    reason:
      'One of the four named entry points onto `edit` (`NAMED_ENTRY_POINTS`, ' +
      'cli/commands/edit.ts) — `harden <id>` IS `edit <id> --severity=hard`, argv-rewritten ' +
      'into the same gate, the same preview and the same `cmdEdit`. `edit` already has ' +
      '`update_item` as its tool, and that tool takes `severity` — so the act these four names ' +
      'reach has a tool; only the shorter NAME does not, the same way `mycontext harden` is not ' +
      'a second implementation of anything `mycontext edit` does.',
  },
  'inbox-promote': {
    disposition: 'intended',
    reason:
      'Two writes, and only one is safely non-human. The `createItem` half carries the ' +
      'capture\'s own origin forward (not restamped), so it alone would be tool-safe — but the ' +
      'second write, retiring the origin capture, is `updateItem(ctx, { id: origin.id, status: ' +
      '"deprecated", origin: "human" })` with `origin: "human"` HARDCODED in ' +
      'cli/commands/inbox-promote.ts, not read from a caller argument. A tool cannot make that ' +
      'call honestly, and there is no version of this command that runs only its first half.',
  },
  'ingest-apply': {
    disposition: 'intended',
    reason:
      'The `ingest_document` tool already performs this step: `src/mcp/tools/ingest.ts` ' +
      'imports `applyCandidates` (`ingest/apply.ts`) and calls it directly inside the tool ' +
      'handler, extraction and apply in one call. `ingest-apply` exists as its own CLI command ' +
      'only because a human runs `ingest` and `ingest-apply` as two turns of one conversation ' +
      '(`CLI_WITHOUT_SLASH`\'s note: "step 4" of `/mycontext:ingest`) — the tool never needs ' +
      'the second turn.',
  },
  init: {
    disposition: 'intended',
    reason:
      'Registered `workspace: \'none\'` — the one command dispatched BEFORE `resolveWorkspace` ' +
      'runs, per `registry.ts`\'s own comment: "`workspace: \'none\'` exists for `init` and, ' +
      'today, only `init`". Every MCP tool call runs inside `withWorkspace` (`src/mcp/tools.ts`), ' +
      'which resolves the workspace FIRST — so a tool call has no point in its lifecycle before ' +
      'a workspace exists for `init` to run in.',
  },
  'lesson-accept': {
    disposition: 'intended',
    reason:
      'The approval gate `CLI_WITHOUT_SLASH.lesson-accept` names, and `lesson/derive.ts`\'s ' +
      '`acceptStagedRule` hardcodes `origin: \'human\'` on the `createItem` call that turns a ' +
      'staged candidate into a real, active rule — its own doc comment: "intended to be ' +
      'reachable only from an explicit human command". A tool would be the model accepting a ' +
      'rule on its own authority, the one act this flow exists to keep out of its hands.',
  },
  'lesson-discard': {
    disposition: 'intended',
    reason:
      'The other half of the same gate. `discardStagedRule` takes no origin argument at all — ' +
      'there is no field this test can point at that would go stale, so unlike `lesson-accept` ' +
      'this row is NOT self-checking beyond the set-membership comparison below. It permanently ' +
      'rejects a staged candidate with no undo, and pairing it with `lesson-accept` behind one ' +
      'gate is a judgement about the pair, not a fact this file can re-derive.',
  },
  pin: {
    disposition: 'intended',
    reason: 'See `harden` — the same named-entry-point-onto-`edit` fact, checked once below for all four.',
  },
  query: {
    disposition: 'intended',
    reason:
      'Raw SQL over the index (`query "SELECT ..."`, capped at `DEFAULT_ROW_CAP` rows but ' +
      'otherwise unrestricted — see the usage self-check below). `query_items` is the ' +
      'structured, bounded route this project built for a model to read the corpus through; a ' +
      'tool that instead took a caller-supplied SQL string would let a call reach anything the ' +
      'schema allows regardless of what `query_items`\'s own schema deliberately narrows, which ' +
      'is a wider door than this project has opened anywhere else.',
  },
  rebuild: {
    disposition: 'intended',
    reason:
      'Already implicit in every tool call: `withWorkspace` (src/mcp/tools.ts) calls ' +
      '`openRebuiltStore` before any tool handler runs — the same function `mycontext rebuild` ' +
      'calls directly (see the self-check below). A dedicated tool would rebuild the index a ' +
      'second time for an effect every other tool call already produces as its first step.',
  },
  repair: {
    disposition: 'intended',
    reason:
      'Re-stamps checksums after a hand edit; its preview is a page of consequences a person ' +
      'has to read, and `mycontext repair *` is on the deny list README §7 recommends (checked ' +
      'below against the README text itself). The same reasoning `CLI_WITHOUT_SLASH.repair` ' +
      'gives for the slash case applies harder to a tool, which has no person reading the page ' +
      'before it runs.',
  },
  session: {
    disposition: 'intended',
    reason:
      'Same reasoning `CLI_WITHOUT_SLASH.session` gives, unchanged by the surface: a model ' +
      'CALLING a tool is already running inside some session, so a tool that lists every ' +
      'session this workspace has had would not be read by the session it is in — it already ' +
      'has that one, and what it might want is to NAME one or carry from one, neither of which ' +
      'this listing does. There is no code fact this test can point at for that claim (no ' +
      'session id crosses a tool call today to check against), so this row is NOT self-checking ' +
      'beyond the set-membership comparison below.',
  },
  soften: {
    disposition: 'intended',
    reason: 'See `harden` — the same named-entry-point-onto-`edit` fact, checked once below for all four.',
  },
  statusline: {
    disposition: 'intended',
    reason:
      'Configures Claude Code, not this corpus — bare, it reads a payload only Claude Code ' +
      'sends on stdin, and `install`/`uninstall` edit the user\'s own `settings.json`. There is ' +
      'no corpus-side fact this test can re-check for that claim (it is a statement about what ' +
      'the command touches, not about a trust boundary in this codebase), so this row is NOT ' +
      'self-checking beyond the set-membership comparison below.',
  },
  ui: {
    disposition: 'intended',
    reason:
      'Starts an HTTP server bound to a port (`createServer`/`.listen`, src/ui/server.ts) and ' +
      'either opens a browser or stays in the foreground — not the shape of a tool call, which ' +
      'is one request answered once. This project already treats the running UI server as a ' +
      'human-owned process nothing else may spawn, kill or replace; a tool that could start one ' +
      'would be a model doing exactly that.',
  },
  unpin: {
    disposition: 'intended',
    reason: 'See `harden` — the same named-entry-point-onto-`edit` fact, checked once below for all four.',
  },
};
