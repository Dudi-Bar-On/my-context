/**
 * **Noise removal** — `plan:recall seq:2`, Task 8 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, and §6 of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * ── WHAT NOISE MEANS HERE, IN HIS WORDS ────────────────────────────────────
 *
 * *"my say about summary is not because of its content but it is more about
 * filtering huge amount of noise and irrelevant data like scripts, output and
 * alike."* So this is about VOLUME, never about meaning. Nothing below reads a
 * passage to decide whether it is interesting; everything below decides
 * whether a passage is MACHINERY or a COPY.
 *
 * ── THE CLASSIFICATION IS `classifyTurn`, READ ONE STEP FURTHER ────────────
 *
 * §6 asks for the document screen's own `said`/`work`/`deed` sorting, and
 * `stanceOf` produces exactly those three words — but it DERIVES them from
 * `classifyTurn`, the thirteen lines in `conversation-index.ts` that the list
 * screen's prompt and answer columns and the prose index already rest on. It
 * is not a second opinion about what machinery is, and that is deliberate:
 * `CLAUDE.md` opens by describing what a second copy of a rule costs, and a
 * second definition of noise would drift from the one the screen draws.
 *
 *     classifyTurn        here      kept?
 *     prompt / answer     said      always
 *     machinery + tool    deed      only when the TOOL is prose-bearing
 *     machinery           work      never
 *
 * ── ROUTING IS BY TOOL NAME, AND THE ALTERNATIVE WAS MEASURED AT CHANCE ────
 *
 * The obvious design — decide lexically whether a `tool_result` is prose —
 * **does not work, and the number must not be softened**: punctuation density
 * scored **AUC 0.499**, a coin flip; the best single feature reached 0.836;
 * and a two-rule classifier still admitted **47% of the noise**. The reason is
 * itself the finding: *much `tool_result` content IS prose*.
 *
 * So the route is the tool's NAME, which is exact and free. `Bash` is **65.5%**
 * of `tool_result` bytes; prose-bearing tools together are **8.8%**.
 *
 * **A result record does not name its own tool** — it carries a
 * `tool_use_id` — so the calls in the window are paired to their results here.
 * A result whose call is not in the window is treated as machinery: unknown is
 * the safe direction, because the failure it produces is a visible under-count
 * rather than admitting whatever this file has not heard of.
 *
 * ── THE REPEAT RULE IS EXACT, AND IT HAS NO THRESHOLD ──────────────────────
 *
 * His rule: *"if a group of sentences or other text repeats more than once in
 * the session it could be considered noise."* Confirmed by measurement — the
 * top repeated 8-gram in this corpus is an injected harness note appearing
 * **195 times**.
 *
 * An **exact 8-gram inverted index** does it, and the alternatives were
 * measured on identical data: exact index **60 pairs in 629 ms**, SimHash
 * **64 in 677 ms**, MinHash K=128 with LSH **62 in 4,065 ms** — and SimHash's
 * brute-force comparison of all 3,136,260 pairs took **20 ms**. At this scale
 * LSH solves a problem that does not exist.
 *
 * **And there is no similarity threshold**, deliberately. A passage is dropped
 * only when EVERY one of its grams has already been seen, which is the
 * question *is this text wholly something we already have*. A share threshold
 * would be a number with no derivation behind it, and `core/retire.ts` is this
 * project's ruling on what a threshold that cannot be derived is worth.
 *
 * This module is PURE. It opens nothing and writes nothing.
 */
import { classifyTurn } from '../conversation-index.ts';
import { proseOf } from '../conversation-search.ts';

/** The document's three kinds, as `seq:13` named them. */
export type Stance = 'said' | 'work' | 'deed';

/** Words in a gram. Eight, and the measurements above are all at eight. */
export const GRAM_WORDS = 8;

/** How many repeated grams a report names. Enough to see the shape, not a dump. */
export const REPEATS_REPORTED = 20;

/**
 * **The tools whose output is words somebody wrote**, and therefore the only
 * `deed`s whose text is kept.
 *
 * The list is short on purpose and anything absent is machinery. Adding a name
 * here is a decision about what reaches a context window, so it should be one
 * somebody made rather than one a default made.
 */
export const PROSE_BEARING_TOOLS: ReadonlySet<string> = new Set([
  'Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Task', 'Agent', 'NotebookRead',
]);

/** One transcript record offered to the filter. */
export interface NoiseCandidate {
  record: Record<string, unknown>;
  /**
   * The tool behind this record, when the caller already knows it. Normally
   * left out: a `tool_use` names itself and a `tool_result` is paired by id.
   */
  tool?: string | null;
}

/** One turn that survived. */
export interface KeptTurn {
  /** Its position in what the caller handed in, so a caller can join back. */
  index: number;
  stance: Stance;
  /** The tool behind it, or `null` for a turn in words. */
  tool: string | null;
  text: string;
}

/** One repeated gram, and how many times it occurred across every turn. */
export interface RepeatedGram {
  gram: string;
  count: number;
}

/** What one run removed, and why. Every turn is in exactly one column. */
export interface NoiseReport {
  kept: KeptTurn[];
  removed: {
    /** Machinery carrying no tool: thinking, folded runs, the harness's own. */
    work: number;
    /** A deed whose tool is not prose-bearing, or cannot be named. */
    tool: number;
    /** A turn every gram of which had already been seen. */
    repeat: number;
    /** A turn that survived the filters and carried no words at all. */
    empty: number;
  };
  /** The repeated grams, most-repeated first, capped at `REPEATS_REPORTED`. */
  repeats: RepeatedGram[];
  /** How many turns were handed in. The columns above account for all of them. */
  seen: number;
}

/** The content blocks of a record, or an empty list. */
function blocksOf(record: Record<string, unknown>): Array<Record<string, unknown>> {
  const message = record.message;
  if (typeof message !== 'object' || message === null) return [];
  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) return [];
  return content.filter(
    (block): block is Record<string, unknown> => typeof block === 'object' && block !== null,
  );
}

/**
 * **Which of the three a record is.**
 *
 * `classifyTurn` decides the first cut and this only reads what kind of
 * machinery the rest is: machinery that names a tool is a `deed`, and
 * machinery that does not is `work`.
 */
export function stanceOf(record: Record<string, unknown>): Stance {
  const message = record.message;
  const content = typeof message === 'object' && message !== null
    ? (message as { content?: unknown }).content
    : undefined;
  if (classifyTurn(record.type, content) !== 'machinery') return 'said';
  for (const block of blocksOf(record)) {
    if (block.type === 'tool_use' || block.type === 'tool_result') return 'deed';
  }
  return 'work';
}

/** The `tool_use` a record makes, if it makes one: its id and its name. */
function callIn(record: Record<string, unknown>): { id: string; name: string } | null {
  for (const block of blocksOf(record)) {
    if (block.type !== 'tool_use') continue;
    const id = typeof block.id === 'string' ? block.id : '';
    const name = typeof block.name === 'string' ? block.name : '';
    if (name === '') continue;
    return { id, name };
  }
  return null;
}

/** The `tool_use_id` a result answers, if it is a result. */
function answersCall(record: Record<string, unknown>): string | null {
  for (const block of blocksOf(record)) {
    if (block.type !== 'tool_result') continue;
    return typeof block.tool_use_id === 'string' ? block.tool_use_id : '';
  }
  return null;
}

/** Whatever words a block holds, whether it spells them as a string or as blocks. */
function textOfContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue;
    const typed = block as { type?: unknown; text?: unknown };
    if (typed.type === 'text' && typeof typed.text === 'string') parts.push(typed.text);
  }
  return parts.join('\n');
}

/**
 * The words of a deed.
 *
 * A `tool_result` carries what came back; a `tool_use` carries what was asked
 * for, which is short and is the part worth keeping — a prose-bearing call's
 * value is in its answer, and its question is one line naming the file.
 */
function deedTextOf(record: Record<string, unknown>): string {
  for (const block of blocksOf(record)) {
    if (block.type === 'tool_result') return textOfContent(block.content);
    if (block.type === 'tool_use') {
      const name = typeof block.name === 'string' ? block.name : 'tool';
      try {
        return `${name} ${JSON.stringify(block.input)}`;
      } catch {
        return name;
      }
    }
  }
  return '';
}

/**
 * The words of a record, whichever kind it is.
 *
 * `said` goes through `proseOf` — imported rather than re-derived, so the text
 * a retrieval keeps and the text the archive's search matched cannot come to
 * differ.
 */
function textOf(record: Record<string, unknown>, stance: Stance): string {
  return stance === 'deed' ? deedTextOf(record) : proseOf(record);
}

/** The words of a passage, lowercased, for gram building. Punctuation is not a word. */
function wordsOf(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter((word) => word !== '');
}

/**
 * The grams of a passage.
 *
 * A passage shorter than the gram width has ONE gram — its whole normalised
 * self. Without that, every short turn would have no grams at all, and a rule
 * that cannot see a passage cannot call it a repeat: the harness's shortest
 * injected notes are exactly the case that matters.
 */
function gramsOf(text: string): string[] {
  const words = wordsOf(text);
  if (words.length === 0) return [];
  if (words.length < GRAM_WORDS) return [words.join(' ')];
  const grams: string[] = [];
  for (let at = 0; at + GRAM_WORDS <= words.length; at += 1) {
    grams.push(words.slice(at, at + GRAM_WORDS).join(' '));
  }
  return grams;
}

/**
 * **Take the machinery and the copies out of a window of transcript records.**
 *
 * The order of the two filters matters and is the cheap one first: the stance
 * and tool filters are a field read per record, and only what survives them is
 * ever gram-indexed.
 */
export function removeNoise(candidates: readonly NoiseCandidate[]): NoiseReport {
  const report: NoiseReport = {
    kept: [],
    removed: { work: 0, tool: 0, repeat: 0, empty: 0 },
    repeats: [],
    seen: candidates.length,
  };

  // A result does not name its own tool, so the calls in this window name it.
  const calls = new Map<string, string>();
  for (const candidate of candidates) {
    const call = callIn(candidate.record);
    if (call !== null) calls.set(call.id, call.name);
  }

  /** gram -> how many times it has occurred, dropped turns included. */
  const counts = new Map<string, number>();
  /** gram -> whether a KEPT turn has already carried it. */
  const seenGrams = new Set<string>();

  candidates.forEach((candidate, index) => {
    const stance = stanceOf(candidate.record);
    if (stance === 'work') {
      report.removed.work += 1;
      return;
    }

    let tool: string | null = null;
    if (stance === 'deed') {
      const call = callIn(candidate.record);
      const answered = answersCall(candidate.record);
      tool = candidate.tool
        ?? call?.name
        ?? (answered === null ? null : calls.get(answered) ?? null);
      if (tool === null || !PROSE_BEARING_TOOLS.has(tool)) {
        report.removed.tool += 1;
        return;
      }
    }

    const text = textOf(candidate.record, stance);
    const grams = gramsOf(text);
    for (const gram of grams) counts.set(gram, (counts.get(gram) ?? 0) + 1);
    if (grams.length === 0) {
      report.removed.empty += 1;
      return;
    }
    if (grams.every((gram) => seenGrams.has(gram))) {
      report.removed.repeat += 1;
      return;
    }
    for (const gram of grams) seenGrams.add(gram);
    report.kept.push({ index, stance, tool, text });
  });

  report.repeats = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, REPEATS_REPORTED)
    .map(([gram, count]) => ({ gram, count }));

  return report;
}
