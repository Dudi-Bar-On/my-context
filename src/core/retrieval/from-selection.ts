/**
 * **A selection becomes a query** — `plan:recall seq:2`, Task 6 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, and §3 of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * ── WHY THE PASSAGE IS THE ENTRY POINT ─────────────────────────────────────
 *
 * Every other way in is a guess at what the owner cares about. A passage he
 * selected is not a guess — it IS the subject, and the hard problem inverts:
 * instead of *find the subjects, then pick one*, it is *here is the thing,
 * find everything related to it*.
 *
 * The design's measurement is what makes that work, and it is the reason this
 * file extracts NAMES and not words. Matched against the archive as FTS5
 * queries: headings **4%**, word-bags **32%**, corpus item-id slugs **68%**.
 * A passage worth copying is dense in names — item ids, file paths, function
 * names, command spellings, commit hashes — and those are what this returns.
 *
 * ── TWO MECHANISMS, BECAUSE THEY SEE DIFFERENT THINGS ──────────────────────
 *
 * `names` are the identifiers the passage carries in its own text, found by
 * shape. They need no dictionary and are available the moment he copies.
 *
 * `terms` are names the passage mentions in PLAIN PROSE, where no pattern can
 * see them — *"the byte offset"* is a name in this project and is written
 * without backticks nearly everywhere. Those need a dictionary, which is what
 * `retrieval/subjects.ts` builds out of the documents, and an Aho–Corasick
 * automaton is how a dictionary of that size is run over a passage in one
 * pass. The spec measured the yield at **39 terms per block**. The automaton
 * is exported because `subjects.ts` runs the same dictionary the other way —
 * over session text rather than over a selection — and two implementations of
 * *does this text contain this name* would eventually disagree.
 *
 * ── AND WHEN IT FINDS NOTHING IT SAYS SO ───────────────────────────────────
 *
 * A word-bag fallback is available, cheap, and **refused**: Task 6's own step
 * says *a guess that resolves is worse than silence*. A caller handed thirty
 * ordinary words cannot tell a real match from a plausible one, so the answer
 * carries `matchable` and a `note` the way `searchArchive`'s does, for the
 * same reason — `INV-nothing-is-dropped-silently`.
 *
 * This module is PURE. It opens nothing, reads no file, and writes nothing.
 */
import { MIN_QUERY_CHARS } from '../conversation-search.ts';

/**
 * What a passage turns into.
 *
 * Not a bare `{ names, terms }`: the plan sketched that shape and it cannot
 * carry the one thing Task 6 Step 2 requires it to be able to say. Two empty
 * arrays are indistinguishable from *the passage had nothing in it*, which is
 * the state that must be STATED rather than inferred.
 */
export interface PassageQuery {
  /** Identifiers the passage carries in its own text, best-signal first. */
  names: string[];
  /** Dictionary names the passage mentions in prose. Empty without a vocabulary. */
  terms: string[];
  /** False when there is nothing here worth searching for. Then both lists are empty. */
  matchable: boolean;
  /** Why not, in a sentence a reader can act on. `null` when there was something. */
  note: string | null;
}

/**
 * The kinds of name, in the order they are offered.
 *
 * The order is the research's ranking, not a preference: an item-id slug is
 * the shape that matched 68% of the time, and a bare camelCase word is the
 * weakest of these because ordinary English produces it by accident. A caller
 * that can afford only one query should take the first.
 */
const PATTERNS: ReadonlyArray<{ kind: string; re: RegExp; group: number }> = [
  // RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number
  { kind: 'item', re: /\b[A-Z]{2,12}-[a-z0-9]+(?:-[a-z0-9]+)+\b/g, group: 0 },
  // plan:archive seq:34 — the corpus' own way of naming a lane's work.
  { kind: 'plan', re: /\bplan:[a-z0-9][a-z0-9-]*(?:\s+seq:\d+)?/g, group: 0 },
  // src/core/conversation-index.ts
  { kind: 'path', re: /(?:[A-Za-z0-9_@.-]+\/)+[A-Za-z0-9_@.-]+/g, group: 0 },
  // Anything he backticked. He backticks names.
  { kind: 'code', re: /[`]([^`\n]{1,80})[`]/g, group: 1 },
  // classifyTurn, written without backticks, which is how prose writes it.
  { kind: 'camel', re: /\b[a-z][a-z0-9]*(?:[A-Z][A-Za-z0-9]*)+\b/g, group: 0 },
  // remove_missing
  { kind: 'snake', re: /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g, group: 0 },
  // A commit hash, and only one that carries BOTH a digit and a letter — the
  // lookaheads are what keep "feedface" and "12345678" out of a query.
  { kind: 'hash', re: /\b(?=[0-9a-f]*[0-9])(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/g, group: 0 },
];

/**
 * Whether a slash-bearing run is really a path.
 *
 * `and/or` is not, and neither is a date written `10/09`. Requiring either an
 * extension on the last segment or a second slash is what separates the two
 * without a list of extensions to keep current.
 */
function looksLikePath(candidate: string): boolean {
  const segments = candidate.split('/');
  if (segments.length > 2) return true;
  const last = segments[segments.length - 1] ?? '';
  return /\.[A-Za-z0-9]{1,8}$/.test(last);
}

/**
 * Whether a backticked run is a NAME rather than a quoted sentence.
 *
 * He backticks names, but he also backticks short commands and the occasional
 * phrase. A run of seven words is not an identifier and would be a word-bag
 * wearing a backtick, which is the thing Step 2 refuses.
 */
function looksLikeName(candidate: string): boolean {
  if (!/[A-Za-z0-9֐-׿]/.test(candidate)) return false;
  return candidate.split(/\s+/).length <= 6;
}

/**
 * Every identifier in a passage, deduplicated, best-signal first.
 *
 * Ties inside a kind are broken by where the name first appears, so the order
 * is reproducible and reads the way the passage does.
 */
function namesIn(text: string): string[] {
  const seen = new Map<string, { rank: number; at: number }>();
  PATTERNS.forEach((pattern, rank) => {
    const re = new RegExp(pattern.re.source, pattern.re.flags);
    let match = re.exec(text);
    while (match !== null) {
      const raw = (match[pattern.group] ?? '').trim();
      match = re.exec(text);
      if (raw.length < MIN_QUERY_CHARS) continue;
      if (pattern.kind === 'path' && !looksLikePath(raw)) continue;
      if (pattern.kind === 'code' && !looksLikeName(raw)) continue;
      const already = seen.get(raw);
      if (already !== undefined && already.rank <= rank) continue;
      seen.set(raw, { rank, at: text.indexOf(raw) });
    }
  });
  return [...seen.entries()]
    .sort((a, b) => (a[1].rank - b[1].rank) || (a[1].at - b[1].at))
    .map(([name]) => name);
}

/**
 * **Turn a copied passage into something the archive can be asked.**
 *
 * `vocabulary` is optional and is what `subjects.ts` produces: the names the
 * project's own documents use. Without it only the passage's own identifiers
 * are found, which is the state the viewer is in before any document has been
 * read, and is an answer rather than a degraded one.
 */
export function queryFromPassage(
  text: string, vocabulary: readonly string[] = [],
): PassageQuery {
  const names = namesIn(text);
  const known = new Set(names.map((name) => name.toLowerCase()));
  const terms = vocabulary.length === 0
    ? []
    : [...findTerms(buildAutomaton(vocabulary), text).keys()]
      .filter((term) => !known.has(term.toLowerCase()));

  if (names.length === 0 && terms.length === 0) {
    return {
      names: [],
      terms: [],
      matchable: false,
      note:
        'my_context: this passage carries nothing to match on — no item id, no file path, no '
        + 'backticked name, no commit hash, and no term from the vocabulary it was given. Its '
        + 'ordinary words are not offered as a query: a word-bag matched 32% against the '
        + 'archive where names matched 68%, and a guess that resolves is worse than silence. '
        + 'Select a passage that names something, or search for the words directly.',
    };
  }
  return { names, terms, matchable: true, note: null };
}

/* ─────────────────────────── Aho–Corasick ──────────────────────────────── */

/**
 * A compiled dictionary. Opaque on purpose: what a caller needs is
 * `findTerms`, and the shape below is an implementation of one pass over text
 * rather than something to read.
 */
export interface Automaton {
  /** `goto` edges, one map per state. */
  next: Array<Map<string, number>>;
  /** Where to fall back to when a character does not continue the match. */
  fail: number[];
  /** Term indices that END at this state, including via the fail chain. */
  out: Array<number[]>;
  /** The terms, in the spelling the caller gave them. */
  terms: string[];
  /** The same terms lowercased, which is what the trie was built over. */
  lowered: string[];
}

/**
 * Lowercase a string WITHOUT moving any character's index.
 *
 * `toLowerCase` is not length-preserving for every input — `İ` becomes two
 * code units — and an automaton that reports an offset into a string of a
 * different length reports the wrong offset. Characters that would change
 * length are left alone, which costs a match on a letter this corpus does not
 * contain and buys an offset that is always the caller's own.
 */
function lowerKeepingOffsets(text: string): string {
  let out = '';
  for (const ch of text) {
    const low = ch.toLowerCase();
    out += low.length === ch.length ? low : ch;
  }
  return out;
}

/** **Compile a dictionary of names into one automaton.** */
export function buildAutomaton(terms: readonly string[]): Automaton {
  const kept: string[] = [];
  const lowered: string[] = [];
  for (const term of terms) {
    const trimmed = term.trim();
    if (trimmed.length < MIN_QUERY_CHARS) continue;
    kept.push(trimmed);
    lowered.push(lowerKeepingOffsets(trimmed));
  }

  const next: Array<Map<string, number>> = [new Map()];
  const fail = [0];
  const out: Array<number[]> = [[]];
  lowered.forEach((term, index) => {
    let state = 0;
    for (const ch of term) {
      let step = next[state]?.get(ch);
      if (step === undefined) {
        step = next.length;
        next.push(new Map());
        fail.push(0);
        out.push([]);
        next[state]?.set(ch, step);
      }
      state = step;
    }
    out[state]?.push(index);
  });

  // Breadth-first, which is what makes a fail link point at the longest proper
  // suffix that is itself a prefix of some term.
  const queue: number[] = [];
  for (const [, step] of next[0] ?? []) {
    fail[step] = 0;
    queue.push(step);
  }
  for (let head = 0; head < queue.length; head += 1) {
    const state = queue[head] ?? 0;
    for (const [ch, step] of next[state] ?? []) {
      let back = fail[state] ?? 0;
      while (back !== 0 && next[back]?.get(ch) === undefined) back = fail[back] ?? 0;
      const landing = next[back]?.get(ch) ?? 0;
      fail[step] = landing === step ? 0 : landing;
      out[step] = [...(out[step] ?? []), ...(out[fail[step] ?? 0] ?? [])];
      queue.push(step);
    }
  }
  return { next, fail, out, terms: kept, lowered };
}

/** A letter, a digit, or the punctuation identifiers are built from. */
const WORDISH = /[\p{L}\p{N}_$]/u;
/** The Hebrew block. */
const HEBREW = /[֐-׿]/;
/**
 * **The one-letter particles Hebrew glues onto the FRONT of a word.**
 *
 * ו ה ב כ ל מ ש — and this is not a nicety. `conversation-index.ts`'s header
 * measured the same fact from the other side and it is why the archive's index
 * is `trigram`: the form a reader types is a SUBSTRING of the form the
 * transcript holds, because the word written alone as one form appears glued
 * to a particle in the text. A word-boundary rule applied to both edges would
 * make this automaton blind to Hebrew.
 *
 * The allowance is the LEFT edge only, and only for a run of at most two of
 * these letters with a non-word character before it. That is what separates a
 * prefixed form (a match) from a longer word that merely contains the term
 * (which is not one).
 */
const PARTICLES = /^[והבכלמש]{1,2}$/;

/** Whether a match at `[start, end)` stands as a word rather than inside one. */
function standsAlone(text: string, start: number, end: number, term: string): boolean {
  const after = text[end];
  if (after !== undefined && WORDISH.test(after)) return false;
  if (start === 0) return true;
  const before = text[start - 1] ?? '';
  if (!WORDISH.test(before)) return true;
  if (!HEBREW.test(term[0] ?? '')) return false;
  // A Hebrew term may be reached through its prefix particles, and only those.
  for (const width of [1, 2]) {
    if (start - width < 0) continue;
    const prefix = text.slice(start - width, start);
    if (!PARTICLES.test(prefix)) continue;
    const outer = start - width === 0 ? undefined : text[start - width - 1];
    if (outer === undefined || !WORDISH.test(outer)) return true;
  }
  return false;
}

/**
 * **Every dictionary term the text contains, and how many times.**
 *
 * One pass over the text however large the dictionary, which is the whole
 * point of the automaton — the alternative is one `indexOf` per term, and a
 * vocabulary built from this project's documents is thousands of terms.
 *
 * A term found INSIDE a longer word is not a match. That is the rule that
 * makes the result usable: a false positive here becomes an FTS5 query that
 * returns real records about the wrong subject, and it resolves, so nothing
 * downstream can tell it was wrong.
 */
export function findTerms(automaton: Automaton, text: string): Map<string, number> {
  const hay = lowerKeepingOffsets(text);
  const found = new Map<string, number>();
  let state = 0;
  let index = 0;
  for (const ch of hay) {
    while (state !== 0 && automaton.next[state]?.get(ch) === undefined) {
      state = automaton.fail[state] ?? 0;
    }
    state = automaton.next[state]?.get(ch) ?? 0;
    index += ch.length;
    for (const which of automaton.out[state] ?? []) {
      const term = automaton.lowered[which] ?? '';
      const start = index - term.length;
      if (!standsAlone(hay, start, index, term)) continue;
      const canonical = automaton.terms[which] ?? term;
      found.set(canonical, (found.get(canonical) ?? 0) + 1);
    }
  }
  return found;
}
