/**
 * **`focus_context`, moved out of the registry.**
 *
 * `TASK-26-tool-specs-keep-their-handlers-inline-where-one-already`, in the
 * shape `src/mcp/tools/ingest.ts` already set: the schema and the handler move,
 * the spec entry and the long argument ABOUT this tool — why an agent may
 * narrow its own context at all — stay on the spec in `tools.ts`, where a
 * reader of the registry meets it.
 *
 * The boundary is the tests': `test/mcp/focus-tool.test.ts` exercises
 * `focus_context` and no other tool — one of only three files under
 * `test/mcp/` that name a tool set a module could be cut around. See
 * `rule-store.ts`' header for the whole measurement, and for why the other 24
 * specs stayed where they are.
 *
 * Every line below is the line that shipped, moved and de-indented.
 */
import { auditFailureNote } from '../../core/audit.ts';
import {
  focusReportLines, isFocusActive, readFocus, setFocus, unsetFocus,
  type Focus, type FocusAxes,
} from '../../core/focus.ts';
import { openRebuiltStore } from '../../core/open-store.ts';
import { select } from '../../core/select.ts';
import { resolveWorkspace } from '../../core/workspace.ts';
import { object, optBool, optList, S_STRINGS, type Args } from './args.ts';

export const FOCUS_CONTEXT_SCHEMA: Record<string, unknown> = object({
  tags: { ...S_STRINGS, description: 'Keep items carrying any of these tags' },
  categories: {
    ...S_STRINGS,
    description: 'Keep items of these categories — see mycontext_help("categories")',
  },
  scope: { ...S_STRINGS, description: 'Keep items applying to these paths or globs' },
  preview: {
    type: 'boolean',
    description: 'Report what the focus would hide and change nothing',
  },
  clear: { type: 'boolean', description: 'Remove the focus. Refused alongside axes.' },
});

export function runFocusContext(cwd: string, args: Args): string {
  const ws = resolveWorkspace(cwd);
  if (!ws.projectRoot) {
    throw new Error(
      `my_context: there is no .my_context workspace at or above ${cwd}, so there is no ` +
      `focus to set. Ask the user to run \`mycontext init\`.`,
    );
  }
  const root = ws.projectRoot;
  const axes: FocusAxes = {
    tags: optList(args, 'tags') ?? [],
    categories: optList(args, 'categories') ?? [],
    scope: optList(args, 'scope') ?? [],
  };
  const asked = isFocusActive(axes);

  if (optBool(args, 'clear') === true) {
    if (asked) {
      throw new Error(
        'my_context: focus_context takes either "clear" or the axes, never both. ' +
        'Clearing and setting in one call has two readings, and honouring either would ' +
        'drop the other without saying so. Nothing was changed.',
      );
    }
    const { existed, audit } = unsetFocus(root, 'agent');
    return existed
      ? `my_context: focus cleared. Every eligible item is injectable again.` +
        auditFailureNote(audit)
      : 'my_context: there was no focus to clear. Nothing was hidden.';
  }

  // The report always comes from `select`, never from a second predicate —
  // see the note on `SelectContext.focus`.
  const describe = (focus: Focus | null, heading: string): string => {
    // The same `retryOnBusy: true` every other MCP surface takes through
    // `withWorkspace`. This site had silently drifted to no-retry — the
    // one MCP rebuild a busy database could fail immediately — which is
    // exactly the divergence consolidating the open-rebuild copies
    // exists to make impossible.
    const { store } = openRebuiltStore(ws, { retryOnBusy: true });
    try {
      const report = select(store.all(), { event: 'manual', focus }, ws.config).focus;
      if (report === null) {
        return 'my_context: no focus is set — every eligible item is injectable. Set one ' +
          'with focus_context({tags: ["billing"]}).';
      }
      return [heading, ...focusReportLines(report)].join('\n');
    } finally {
      store.close();
    }
  };

  if (!asked) {
    const state = readFocus(root);
    if (state.error !== null) {
      throw new Error(
        `my_context: \`.my_context/state/focus.json\` ${state.error}, so NO focus is in ` +
        'effect and nothing is hidden. Ask the user to fix the file or to run ' +
        '`mycontext focus --clear`.',
      );
    }
    return describe(state.focus, 'my_context: the focus now in effect.');
  }

  if (optBool(args, 'preview') === true) {
    return describe(
      { ...axes, setAt: new Date().toISOString(), setBy: 'agent' },
      'my_context: preview only — nothing was changed.',
    );
  }

  const { focus, audit } = setFocus(root, axes, 'agent');
  return describe(
    focus,
    'my_context: focus set. Every future injection narrows to it and says so, and ' +
    `severity:hard items stay visible regardless.${auditFailureNote(audit)}`,
  );
}
