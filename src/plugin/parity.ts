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
};

/**
 * Whether `name` has a surface among `available`, by the rule both directions
 * use: an exact match, or a longer name extending it with a hyphen.
 *
 * The hyphen half is not a convenience. There is no `/mycontext:add` — the
 * closed category set is spelled into the command NAMES (`add-rule`,
 * `list-rule`, …), which is why they are generated per category rather than
 * taking a `<type>` argument — so `add` and `list` do have a slash surface,
 * reached under a longer name. `test/docs/counts.test.ts` applies the same
 * rule to the same question, and the two must not disagree.
 */
export function covered(name: string, available: string[]): boolean {
  return available.some((n) => n === name || n.startsWith(`${name}-`));
}
