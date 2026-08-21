export type HelpTopic =
  'categories' | 'scope' | 'capture' | 'workflow' | 'cli' | 'tools' | 'slash';

/**
 * Every help topic, in the order `mycontext help` lists them.
 *
 * The list lives beside its own union type, in a module that imports nothing,
 * because `src/mcp/tools.ts` reads it while building its tool schemas AT
 * MODULE SCOPE, and `src/help/index.ts` imports `createRegistry` from that
 * same file. That cycle is real, and it is safe only while neither module
 * reaches into the other during evaluation. Exporting this list from
 * `help/index.ts` would break exactly that: a process that loaded help FIRST
 * would enter `mcp/tools.ts` before the binding was initialised and die in the
 * temporal dead zone. A leaf has no such order to get wrong.
 */
export const HELP_TOPICS: HelpTopic[] = [
  'categories', 'scope', 'capture', 'workflow', 'cli', 'tools', 'slash',
];

/**
 * The topics an MCP caller may ask for: every topic the server can actually
 * render.
 *
 * `cli` is withheld, and it is the only one. Its command list is built from
 * `COMMANDS`, which `src/cli/index.ts` fills by side effect, so in a process
 * that never loaded the CLI — every MCP server process — the topic would come
 * back complete-looking and empty. `commandList` refuses rather than render
 * that, and advertising the topic would turn a refusal into a round trip.
 *
 * Nothing of the sort is true of `tools` and `slash`. The first renders from a
 * module-level array literal in `src/mcp/tools.ts`; the second from the
 * committed `commands/*.md`. Both were withheld only because the enum beside
 * the schema was written by hand when there were four topics and never widened
 * — and `tools` is the page about the surface the caller is already on.
 */
export const MCP_HELP_TOPICS: HelpTopic[] = HELP_TOPICS.filter((t) => t !== 'cli');

/** Classic two-row Levenshtein. Small inputs only — category names and ids. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[n];
}

/**
 * The nearest candidate, or null when nothing is near enough. Returning null
 * matters: "the closest match is 'adr'" for input 'xylophone' is worse than no
 * suggestion, because the model may believe it.
 */
export function closestMatch(
  value: string, candidates: string[], maxDistance = 4,
): string | null {
  const needle = value.trim().toLowerCase();
  let best: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of [...candidates].sort()) {
    const distance = levenshtein(needle, candidate.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  const ceiling = Math.min(maxDistance, Math.max(1, Math.floor(needle.length / 2) + 1));
  return best !== null && bestDistance <= ceiling ? best : null;
}

export function enumError(
  field: string, value: string, allowed: string[], topic: HelpTopic,
): string {
  const near = closestMatch(value, allowed);
  return (
    `my_context: "${field}" must be one of: ${allowed.join(', ')}. ` +
    `You passed "${value}".` +
    (near ? ` The closest match is "${near}".` : '') +
    ` See mycontext_help("${topic}").`
  );
}

export function missingFieldError(field: string, tool: string, topic: HelpTopic): string {
  return (
    `my_context: ${tool} requires "${field}", which was missing or empty. ` +
    `See mycontext_help("${topic}").`
  );
}

export function unknownIdError(id: string, knownIds: string[]): string {
  const near = closestMatch(id, knownIds, 6);
  return (
    `my_context: no item with id "${id}".` +
    (near ? ` The closest match is "${near}".` : '') +
    ` Use query_items to find the right id — ids are never guessed.`
  );
}
