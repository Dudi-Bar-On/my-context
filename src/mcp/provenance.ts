/**
 * **What produced this answer: which code, and which corpus.**
 *
 * ── THE HOUR THIS EXISTS FOR ────────────────────────────────────────────────
 *
 * The MCP server loads its TypeScript modules once, at startup, and holds them
 * for the life of the process — which is the life of a Claude Code session, so
 * hours. On 2026-08-27 its `core/content-hash.ts` drifted from disk, and the
 * frozen copy began answering `checksum mismatch` for **719 of 736 items**,
 * each with the sentence *"part of this item's text may already have been
 * lost"*. A migration was planned against that reading. A direct sweep with the
 * on-disk code matched **736 of 736**: the corpus had never been touched.
 *
 * Nothing in the reading said which process had produced it, and nothing said
 * that process was an hour behind the source. The web UI had been disclosing
 * exactly this for a month — "the server freezes its own modules at start" —
 * through `core/code-identity.ts`, which this module now calls rather than
 * re-invents.
 *
 * ── WHY IT RIDES ON EVERY TOOL RESULT ───────────────────────────────────────
 *
 * The requirement is one step, not two: a reader looking at a suspicious answer
 * must be able to tell from THAT answer whether the process behind it is
 * current. A line on a separate diagnostic tool fails that — it is a second
 * call, made by someone who has already decided to be suspicious, and the whole
 * defect is that nobody was suspicious. So the disclosure travels with the
 * result it is about.
 *
 * What that costs is bounded and was the deciding argument: the stale line and
 * the wrong-corpus block appear ONLY when they are true, and in the ordinary
 * case the entire footer is one short line naming the corpus root. The
 * freshness check behind it is `isStale()`, whose cheap half is a `stat` over
 * the files this server's own module graph named — measured at 2.4 ms in the
 * UI's identical scope, memoised on that stamp — and the expensive half runs
 * only while somebody is actively editing a file this server loaded.
 *
 * It rides on RESULTS and not on thrown tool errors, and that is a decision
 * rather than an oversight: `STD-error-message-conventions` gives a refusal one
 * prefix and one filename, and stapling a provenance block onto the end of a
 * teaching message would make the shortest, most-read text on this surface the
 * longest. A refusal is also a message about the ARGUMENTS, not about the
 * corpus — it is the plausible-looking success that needed this.
 *
 * ── WHY THE STALE WORDING IS FLAT ───────────────────────────────────────────
 *
 * Stale is not damage. The server is answering correctly for the code it holds;
 * it simply holds yesterday's. A banner written in the register of corruption
 * would be read as corruption, which is precisely the mistake the outage
 * consisted of — 719 healthy items reported as damaged. So the line states the
 * three facts a reader needs (this process loaded its code at X, the disk has
 * moved since, restarting is the fix), says nothing was blocked, and stops.
 */
import type { CodeIdentity } from '../core/code-identity.ts';
import { corpusRootLine, nestedCorpusNote, resolveCorpus } from '../core/corpus-identity.ts';

/**
 * The one sentence a reader of a suspicious answer needs, and `''` when this
 * process is current.
 *
 * `null` is "this server never stamped an identity" — the registry built by a
 * test, or by any caller that is not the long-lived stdio process. Silence is
 * the right answer there rather than an invented reassurance: a claim of
 * freshness from something that measured nothing is worse than no claim.
 */
export function staleCodeNote(code: CodeIdentity | null): string {
  if (code === null || !code.isStale()) return '';
  return (
    `my_context: this MCP server is running code it loaded at ${code.startedAt}, and at least ` +
    `one of the ${code.files} source files it loaded has changed on disk since. Its answers ` +
    `may not reflect the current source — including this one. Nothing is broken and nothing ` +
    `was blocked; restarting the MCP server is the fix.`
  );
}

/**
 * The footer appended to every successful tool result: the corpus that was
 * resolved, plus the two disclosures that only appear when they are true.
 *
 * Order is loudest first. The wrong-corpus block is the one that changes what
 * the whole answer MEANS; the stale line changes how much to trust it; the
 * corpus line is the standing anchor and comes last so it is always in the same
 * place at the bottom of the result.
 *
 * It never throws. A footer that could take down the tool it decorates would be
 * a new failure bought to disclose an old one — the argument `isStale()` makes
 * for itself, one level up.
 */
export function toolResultProvenance(cwd: string, code: CodeIdentity | null): string {
  try {
    const corpus = resolveCorpus(cwd);
    const lines = [nestedCorpusNote(corpus), staleCodeNote(code), corpusRootLine(corpus)]
      .filter((line) => line !== '');
    return lines.length === 0 ? '' : lines.join('\n');
  } catch {
    return '';
  }
}

/**
 * The three sentences a provenance footer can open with. Written once, here,
 * beside the functions that produce them — a second list spelled in a reader is
 * how the appender and the splitter come to disagree about where the answer
 * ends.
 */
const PROVENANCE_OPENERS = [
  'my_context: WRONG CORPUS?',
  'my_context: this MCP server is running code it loaded at ',
  'my_context corpus: ',
];

/**
 * The answer without its envelope, and the envelope.
 *
 * The inverse of the appender above, and it exists because two kinds of reader
 * need the answer alone and neither should re-derive where it ends:
 * `test/docs/staged-revision.test.ts` pins the sentence `update_item` composes
 * against the text both READMEs quote, and several tests parse a tool's output
 * a line at a time.
 *
 * The footer is one block — its own lines are joined with single newlines — so
 * it is exactly the text after the LAST blank line, and it is only claimed as a
 * footer when that text opens with one of the sentences this module writes. A
 * result whose own final paragraph merely starts with `my_context:` (every
 * refusal does) is left whole.
 */
export function splitProvenance(text: string): { answer: string; provenance: string } {
  const cut = text.lastIndexOf('\n\n');
  if (cut < 0) return { answer: text, provenance: '' };
  const tail = text.slice(cut + 2);
  if (!PROVENANCE_OPENERS.some((opener) => tail.startsWith(opener))) {
    return { answer: text, provenance: '' };
  }
  return { answer: text.slice(0, cut), provenance: tail };
}
