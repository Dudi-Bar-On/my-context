/**
 * **Subjects come from the documents** — `plan:recall seq:2`, Task 7 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, and §5 of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * ── WHERE A SUBJECT COMES FROM, AND WHY NOT FROM CLUSTERING ────────────────
 *
 * The owner's ruling: the specs, designs, plans and roadmaps a session
 * references **are** the developer-domain vocabulary, already written down, in
 * the project's own words. So a subject is read out of those documents and the
 * session text is matched against them — corpus first, leftovers surfaced.
 *
 * Not clustering, and D33 is why: 88% of its candidate pairs involved a single
 * item, because `containment × 0.8` was measuring **length rather than
 * subject**. A vocabulary somebody wrote does not have that failure mode.
 *
 * ── THE TOKENISER IS THE VENDORED ONE, AND A REGEX IS NOT A SUBSTITUTE ─────
 *
 * markdown-it 15.0.1 is already in the tree, pinned and gated
 * (`DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings`), and it
 * parses under Node unchanged. It found **4,348 headings and 59,600
 * inline-code spans over 7.53 MB in 536 ms**, and the measurement that decides
 * this file is the other half: a regex gets the headings and **misses 44% of
 * the inline code** — and inline code is what this actually runs on, because
 * `§3` measured that the NAME is the unit and the heading is not.
 *
 * It is reached the way `cli/commands/statusline-powerline.ts` reaches
 * `viewmodel.js`: a URL computed from `import.meta.url`, a dynamic import, and
 * a SHAPE CHECK, so a browser asset that has been moved or changed is refused
 * as a shape rather than answering `undefined` three calls later. When it does
 * not load, this module says so (`markdownIsDerived`) and returns nothing —
 * it does not fall back to a pattern, because a vocabulary missing 44% of its
 * names looks exactly like a vocabulary that is merely small.
 *
 * ── DEPTH IS A KNOB HE CHOOSES ─────────────────────────────────────────────
 *
 * His ruling: *"how deep to go and how much effort to put on it may be a
 * selectable option that the user could choose from."* `shallow` reads titles
 * and headings — the structure, cheap. `deep` adds every inline-code span,
 * which is where the matches actually are. `deep` is a strict superset, so
 * turning the knob up never loses a name.
 *
 * ── AND WHAT MATCHED NOTHING IS SURFACED, NOT DROPPED ──────────────────────
 *
 * `INV-nothing-is-dropped-silently`, and here it carries more than hygiene:
 * the leftovers are the design's own signal — *work happening that no item
 * covers*. A span no document names is returned as an unnamed thread the owner
 * can name or ignore.
 *
 * This module READS documents. It writes nothing and opens no database.
 */
import { readFileSync } from 'node:fs';
import { buildAutomaton, findTerms, type Automaton } from './from-selection.ts';

/**
 * **How the vendored tokeniser is reached from typed code.**
 *
 * The same bridge `LEVEL_SOURCE` builds for the status line, for the same
 * reason: `src/ui/public/lib/vendor/` is a browser asset directory with no
 * type declarations, and a computed URL is what lets a typed module import one
 * without inventing a declaration file that would then be a second place the
 * shape is written down.
 */
export const MARKDOWN_SOURCE =
  new URL('../../ui/public/lib/vendor/markdown-it.esm.min.js', import.meta.url).href;

/** The part of a markdown-it token this file reads, and nothing more. */
interface MdToken {
  type: string;
  tag: string;
  content: string;
  map: [number, number] | null;
  children: MdToken[] | null;
}

interface MdParser {
  parse(source: string, env: Record<string, unknown>): MdToken[];
}

/**
 * Load the tokeniser, or answer `null`.
 *
 * `null` rather than a throw, and then nothing is returned rather than
 * something weaker: a moved or corrupted vendor file is a reason to say the
 * vocabulary could not be built, never a reason to build a worse one that
 * reads as merely small.
 */
async function loadMarkdown(): Promise<MdParser | null> {
  try {
    const module = await import(MARKDOWN_SOURCE) as { default?: unknown };
    const Ctor = module.default;
    if (typeof Ctor !== 'function') return null;
    const parser = new (Ctor as new () => Partial<MdParser>)();
    if (typeof parser.parse !== 'function') return null;
    // The shape check is a real parse, not a `typeof`: a file that exports
    // something callable but is no longer a tokeniser fails here rather than
    // returning an empty vocabulary that looks like an empty document.
    const probe = parser.parse('# probe', {});
    if (!Array.isArray(probe) || probe.length === 0) return null;
    return parser as MdParser;
  } catch {
    return null;
  }
}

const MARKDOWN: MdParser | null = await loadMarkdown();

/** Whether the vendored tokeniser actually loaded. Exported so a test can say so. */
export function markdownIsDerived(): boolean {
  return MARKDOWN !== null;
}

/** How much of a document to read. His ruling; the caller picks. */
export type Depth = 'shallow' | 'deep';

/**
 * One name a document gives to something, and where it said it.
 *
 * `file` and `line` are not decoration: a subject handed to the distilling
 * subagent without a citation is a claim it cannot check, which is the whole
 * failure §8 is built to prevent.
 */
export interface Subject {
  name: string;
  /** `title` — the document's own h1. `heading` — any other. `code` — an inline span. */
  kind: 'title' | 'heading' | 'code';
  file: string;
  /** 1-based, the way an editor counts. */
  line: number;
}

/** A compiled vocabulary: the names, and the automaton that finds them. */
export interface Vocabulary {
  subjects: Subject[];
  /** The subject names, deduplicated — what the automaton was built over. */
  terms: string[];
  depth: Depth;
  /** How many documents were read. */
  documents: number;
  /** False when the tokeniser did not load. Then `subjects` is empty. */
  derived: boolean;
  /** Why it is empty, when it is. `null` otherwise. */
  note: string | null;
  automaton: Automaton;
}

/** One subject the session text actually used. */
export interface SubjectMatch {
  subject: Subject;
  /** Which spans mentioned it, in order. */
  spans: number[];
  /** How many times, across all of them. */
  hits: number;
}

/** A span no document named. The leftovers are themselves a signal. */
export interface UnnamedThread {
  /** The span's index in what the caller passed. */
  span: number;
  /** Its opening, so the owner can tell what it was without opening it. */
  peek: string;
}

/** What `matchSubjects` answers with. Every span is accounted for. */
export interface SubjectReport {
  matched: SubjectMatch[];
  unnamed: UnnamedThread[];
  /** How many spans were attributed to at least one subject. */
  matchedSpans: number;
  /** How many were handed in. `matchedSpans + unnamed.length` equals it. */
  spans: number;
}

/** Characters of an unnamed span carried in the report, so a list stays readable. */
export const PEEK_CHARS = 140;

/**
 * **Every name one document gives, at the depth asked for.**
 *
 * `file` is passed rather than read so a caller that already holds the text —
 * the UI, a test, a document arriving over a request — does not have to write
 * it to disk to ask what is in it.
 */
export function subjectsIn(file: string, text: string, depth: Depth): Subject[] {
  if (MARKDOWN === null) return [];
  const found: Subject[] = [];
  const tokens = MARKDOWN.parse(text, {});
  let headingLevel: string | null = null;
  let headingLine = 1;
  // **The last line any token admitted to.** Table cells carry `map: null` —
  // measured on the vendored tokeniser, every `th_open`/`td_open`/`inline`
  // inside a table does — so an inline-code span in a table would cite line 1,
  // and a citation that resolves to the wrong line is worse than none. The
  // enclosing `tr_open` DOES carry a map, so carrying the last one forward is
  // what makes a table cell cite its own row.
  let lastLine = 1;
  for (const token of tokens) {
    if (token.map !== null) lastLine = token.map[0] + 1;
    if (token.type === 'heading_open') {
      headingLevel = token.tag;
      headingLine = lastLine;
      continue;
    }
    if (token.type === 'heading_close') {
      headingLevel = null;
      continue;
    }
    if (token.type !== 'inline') continue;

    if (headingLevel !== null) {
      const name = token.content.trim();
      if (name !== '') {
        found.push({
          name,
          kind: headingLevel === 'h1' ? 'title' : 'heading',
          file,
          line: headingLine,
        });
      }
      // A heading's own inline code is part of the heading at both depths, and
      // is not collected twice.
      continue;
    }
    if (depth !== 'deep') continue;

    // **`code_inline` children only.** A fenced block is a `fence` token and is
    // never reached from here, which is the point: the body of a code block is
    // not a name, and a vocabulary that swallowed one would turn every line of
    // it into an FTS5 query.
    const line = lastLine;
    for (const child of token.children ?? []) {
      if (child.type !== 'code_inline') continue;
      const name = child.content.trim();
      if (name === '') continue;
      found.push({ name, kind: 'code', file, line });
    }
  }
  return found;
}

/** The note a vocabulary carries when the tokeniser did not load. */
const NOT_DERIVED =
  'my_context: the vendored markdown tokeniser did not load, so no vocabulary was built. '
  + 'It is not an answer of "these documents name nothing". A pattern was deliberately not '
  + 'used instead: measured, a regex misses 44% of inline code, and inline code is what this '
  + 'matches on — a vocabulary short by that much reads as merely small. '
  + `Check ${MARKDOWN_SOURCE}.`;

/** **Compile subjects already in hand into a vocabulary.** */
export function vocabularyOf(
  subjects: readonly Subject[], depth: Depth, documents = 0,
): Vocabulary {
  const terms = [...new Set(subjects.map((subject) => subject.name))];
  return {
    subjects: [...subjects],
    terms,
    depth,
    documents,
    derived: MARKDOWN !== null,
    note: MARKDOWN === null ? NOT_DERIVED : null,
    automaton: buildAutomaton(terms),
  };
}

/**
 * **Read documents off disk and compile what they name.**
 *
 * A file that cannot be read is SKIPPED and counted rather than throwing: a
 * document list assembled from a session's own references will name files that
 * have since moved, and one of those must not take the whole vocabulary down.
 */
export function readVocabulary(files: readonly string[], depth: Depth): Vocabulary {
  const subjects: Subject[] = [];
  let read = 0;
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    read += 1;
    subjects.push(...subjectsIn(file, text, depth));
  }
  return vocabularyOf(subjects, depth, read);
}

/**
 * **Match session text against the vocabulary, and surface what did not
 * match.**
 *
 * One automaton pass per span however large the vocabulary — the same
 * Aho–Corasick `from-selection.ts` runs over a copied passage, imported rather
 * than re-implemented so that *does this text contain this name* cannot come
 * to mean two things.
 */
export function matchSubjects(
  vocabulary: Vocabulary, spans: ReadonlyArray<{ text: string }>,
): SubjectReport {
  const byName = new Map<string, SubjectMatch>();
  const unnamed: UnnamedThread[] = [];
  let matchedSpans = 0;

  spans.forEach((span, index) => {
    const found = findTerms(vocabulary.automaton, span.text);
    if (found.size === 0) {
      unnamed.push({ span: index, peek: peekOf(span.text) });
      return;
    }
    matchedSpans += 1;
    for (const [name, hits] of found) {
      const already = byName.get(name);
      if (already === undefined) {
        const subject = vocabulary.subjects.find((candidate) => candidate.name === name);
        if (subject === undefined) continue;
        byName.set(name, { subject, spans: [index], hits });
        continue;
      }
      already.spans.push(index);
      already.hits += hits;
    }
  });

  return {
    matched: [...byName.values()].sort((a, b) => b.hits - a.hits),
    unnamed,
    matchedSpans,
    spans: spans.length,
  };
}

/** The opening of a span, whitespace collapsed, so a list of threads stays readable. */
function peekOf(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= PEEK_CHARS ? flat : `${flat.slice(0, PEEK_CHARS - 1)}…`;
}
