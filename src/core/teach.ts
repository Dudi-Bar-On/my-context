export type HelpTopic = 'categories' | 'scope' | 'capture' | 'workflow';

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
