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
  {
    tool: 'link_items', cli: null, slash: 'link',
    note:
      'There is no `mycontext link`. Recording a relation is the one write with no trust ' +
      'boundary on it — `LinkInput` carries no `origin`, because an added edge cannot ' +
      'change what governs — so the tool was never the privileged route that needed a ' +
      'human counterpart. `/mycontext:link` calls the tool, which is a user-invocable ' +
      'command by any reading of the requirement. The REMOVAL half is the opposite case ' +
      'and went the opposite way: `mycontext edit --unlink` exists and no tool does.',
  },
  { tool: 'audit_log', cli: 'audit', slash: 'audit' },
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
  { tool: 'refresh_item', cli: 'refresh', slash: 'refresh' },
  { tool: 'supersede_item', cli: 'supersede', slash: 'supersede' },
  { tool: 'update_item', cli: 'edit', slash: 'edit' },
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
  session: 'Enumerates the sessions this workspace has recorded — their ids, their names, ' +
    'how much each did and whether anything of it is still carryable. It is a table you ' +
    'read in a terminal before choosing one. A model running INSIDE a session is not the ' +
    'reader of that table: it already has the session it is in, and what it would need is ' +
    'the ability to name one or carry from one, neither of which this listing does.',
  statusline: 'Configuration belonging to Claude Code rather than anything in this corpus. '
    + 'Run bare it reads a payload that only Claude Code sends, on stdin, which a slash '
    + 'command has no way to produce; and `statusline install` edits settings.json, which is '
    + 'a decision about the editor the user is sitting in, taken by that user, in a terminal. '
    + 'A slash command for it would be the model reconfiguring the tool it runs inside.',
};

/**
 * Whether `name` has a surface among `available`, by the rule both directions
 * use: an exact match, or a longer name extending it with a hyphen.
 *
 * The hyphen half is not a convenience. The shipped catalogue is spelled into
 * the command NAMES (`add-rule`, `list-rule`, …), generated per category so a
 * disabled one keeps no command, and `list` therefore has a slash surface only
 * under a longer name. `test/docs/counts.test.ts` applies the same rule to the
 * same question, and the two must not disagree.
 *
 * `add` now answers on both halves: `commands/add.md` is the generic capture
 * whose category is an argument rather than part of the name — the only shape
 * that can reach a category this build never saw, since the per-category files
 * are generated when the plugin is built. That makes this row's `slash: 'add'`
 * literal as well as true by the hyphen rule; the hyphen half still carries
 * `list`, so it cannot be dropped.
 */
export function covered(name: string, available: string[]): boolean {
  return available.some((n) => n === name || n.startsWith(`${name}-`));
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
  ack: {
    disposition: 'intended',
    reason:
      'Same fact `CLI_WITHOUT_SLASH.ack` cites, and it forecloses a tool even harder than a ' +
      'slash command: `acknowledgeFinding` (core/mutate.ts) throws for every origin but ' +
      '`human`, unconditionally — there is no `--agent` escape hatch here the way `mycontext ' +
      'lesson` has one. A tool call IS a non-human caller by construction, so a tool for `ack` ' +
      'would exist only to be refused on every call.',
  },
  decay: {
    disposition: 'owed',
    reason:
      'A read-only report (core/decay.ts) with no mutation and no origin check anywhere on ' +
      'its path. Nothing blocks a tool; one is simply not built. Same bucket as `doctor`, ' +
      '`ready`, `status` and `todo` — the unexamined space the board row names.',
  },
  doctor: {
    disposition: 'owed',
    reason:
      'Read-only diagnostic (index freshness, orphans, drift, dead globs, permissions, ' +
      'session ids). Named in the board row itself, and another lane is adding it as a tool ' +
      'while this row is being written — which is the expected way this entry stops being ' +
      'true: the day that lands, `doctor` drops out of the derived "without" list and this row ' +
      'fails the set-comparison test below until it is deleted, the same way `ready` left ' +
      '`CLI_WITHOUT_SLASH` earlier today.',
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
  'ingest-status': {
    disposition: 'owed',
    reason:
      'Read-only progress over `ingest/session.ts` (`listSessions`, `pendingAnchors`) — no ' +
      'mutation, no origin check. `CLI_WITHOUT_SLASH` notes it is already reported by ' +
      '`/mycontext:status` and by `/mycontext:ingest` on resume, but nothing has built the tool ' +
      'equivalent of that read.',
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
  lesson: {
    disposition: 'owed',
    reason:
      'Already built for non-human callers: `mycontext lesson --agent` records `origin: ' +
      '"agent"` on purpose (`cli/commands/lesson.ts`), with the trust boundary already solved ' +
      'the same way `create_item` solves it. Nothing structural is missing — only the tool ' +
      'wrapper.',
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
  'lesson-stage': {
    disposition: 'owed',
    reason:
      'Stages derived rule candidates on disk — no item is created, no origin check anywhere ' +
      'on its path (`stageRuleCandidates`, lesson/derive.ts). This is the command a model ' +
      'already runs today after deriving candidates from a lesson, the same shape ' +
      '`ingest_document` has as a tool; nothing blocks wrapping it, it simply is not built.',
  },
  list: {
    disposition: 'owed',
    reason:
      'A plain read (`cmdList`, cli/index.ts) with no mutation and no origin check. Sits in ' +
      'the same unexamined space as `decay`/`todo`; nothing has decided whether `query_items` ' +
      'already answers it well enough to make a second tool redundant.',
  },
  pack: {
    disposition: 'owed',
    reason:
      '`CLI_WITHOUT_SLASH.pack` already calls the slash version "deliberate future work" — a ' +
      'preview-only command that stops before the second confirmation and prints the import ' +
      'command for a person to run, the shape `/mycontext:lesson-stage` uses. A preview-only ' +
      'TOOL is the same shape and is exactly as unbuilt; nothing forecloses it, so this stays ' +
      '`owed` rather than `intended`.',
  },
  pin: {
    disposition: 'intended',
    reason: 'See `harden` — the same named-entry-point-onto-`edit` fact, checked once below for all four.',
  },
  procedure: {
    disposition: 'owed',
    reason:
      'A mixed command: `list`/`show`/`step` are plain reads, but `activate` and `done` ' +
      '(`cli/commands/procedure.ts`) hardcode `origin: \'human\'` on their `updateItem` calls, ' +
      'the same shape `review promote` has — and `review` still has `list_drafts` as a tool for ' +
      'its READ half. A read-only tool over `procedure` is not blocked by anything the mutating ' +
      'subcommands enforce; it is simply not built, so the top-level absence is `owed` even ' +
      'though half of what the name dispatches to is not.',
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
  ready: {
    disposition: 'owed',
    reason:
      'Same framing as `doctor`: a read-only report named in the board row, with another lane ' +
      'adding the tool right now. This row is expected to be deleted the same way `ready` was ' +
      'deleted from `CLI_WITHOUT_SLASH` earlier today, once `ready` gains a `TOOL_PARITY` row.',
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
  status: {
    disposition: 'owed',
    reason:
      'A read-only dashboard that composes the others (`cli/commands/status.ts` imports ' +
      '`runChecks` from `doctor/checks.ts`, `computeDecay`, `listSessions`, the review queue): ' +
      'counts, review queue, ingest progress, decay and health. The board row names it beside ' +
      '`doctor`/`ready`/`decay`, and nothing in it is more blocked than they are.',
  },
  todo: {
    disposition: 'owed',
    reason:
      'A read-only view of the inbox (`filterItems` over todos/notes, cli/commands/todo.ts). ' +
      'No mutation, no origin check — the same unexamined-read bucket as `list`/`decay`.',
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
