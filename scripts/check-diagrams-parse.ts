#!/usr/bin/env node
/**
 * Refuse a ```` ```mermaid ```` fence that mermaid cannot parse, anywhere in
 * the documents — and DRAW NOTHING.
 *
 *   npm run check:diagrams
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * `docs/capabilities/07-restore-and-handover.md:78` carried `&lt;key&gt;`,
 * whose `&` breaks mermaid's lexer, and it drew an error box on the page for
 * as long as it existed. Its author reported *"every fence parses"* — having
 * checked BRACKET BALANCE, not rendering — and that was relayed upward without
 * anyone asking how it had been checked. **BALANCE IS NOT PARSING.** It is
 * repaired (`471b13b3`), and this is the thing that would have caught it.
 *
 * Nothing caught it because `scripts/gen-diagrams.ts`'s `DIAGRAM_SOURCES`
 * lists only the two READMEs, so no fence under `docs/` is generated,
 * committed or gated at all.
 *
 * ── WHAT THIS IS NOT ──────────────────────────────────────────────────────
 *
 * **IT DRAWS NOTHING.** No SVG is produced, no file is written,
 * `DIAGRAM_SOURCES` is not touched and the `DIAGRAMS` map gains no entry. That
 * separation is the owner's ruling of 2026-09-17, choosing between widening
 * `DIAGRAM_SOURCES` and a parse-only gate, in two words: **"the parse-only
 * gate"**. Drawing all the undrawn fences was measured at ~1.5-1.8 MiB, taking
 * `src/ui/public` from 5.04 MB to ~6.7 MB — past a size budget already
 * rejected once. Whether these fences are ever DRAWN stays the owner's open
 * question. Whether they PARSE stops being one.
 *
 * **THE SOURCE LIST IS DELIBERATELY WIDER THAN `DIAGRAM_SOURCES`, AND
 * DELIBERATELY NOT READ FROM IT.** Importing that constant would re-create the
 * hole, because the whole defect was that the drawing list is short. The two
 * lists are allowed to disagree; this one is allowed to be the longer.
 *
 * ── WHY IT IS A SCRIPT AND NOT A TEST ─────────────────────────────────────
 *
 * It needs a browser: mermaid is a browser library and there is no Node
 * renderer. `test/` is barred from Playwright — `npm test` runs on Windows and
 * ubuntu and only the ubuntu job has a Chromium — and `scripts/` is neither
 * `test/` nor `e2e/`. `scripts/gen-diagrams.ts` already drives headless
 * Chromium through Playwright as a plain `node` script, and this sits beside
 * it, in the `check:*` family, wired into both workflows. A gate nobody runs
 * is not a gate.
 *
 * ── ONE EXTRACTOR, ONE CONFIG ─────────────────────────────────────────────
 *
 * Fences come from the product's own `mermaidBlocks` in
 * `src/ui/public/lib/markdown.js` — the same function `collectDiagrams` uses,
 * through the same vendored tokeniser the browser renders with. **There is no
 * regex here.** A second fence scanner disagrees with the first one the day a
 * fence gets an info string.
 *
 * mermaid is initialised with `gen-diagrams.ts`'s own `securityLevel: 'strict'`
 * and the same theme and font stack. Parsing under a different config from the
 * generator would let a fence pass this gate and fail the drawing.
 *
 * `mermaid.parse()` is the parse-only half of `mermaid.render()`: it runs
 * detection and the grammar and returns without laying anything out, which is
 * exactly the half this gate is allowed to run.
 *
 * ── THE TWO WAYS THIS GATE COULD BE BORN USELESS, AND WHAT ANSWERS EACH ───
 *
 * **1. A RED PATH THAT HAS NEVER RUN IS A GREEN LIGHT WITH NO BULB BEHIND IT.**
 * So the FIRST thing every run does is fail on purpose. `KNOWN_BAD` below is
 * the pre-repair chapter-7 fence, verbatim, recoverable from
 * `471b13b3^:docs/capabilities/07-restore-and-handover.md` lines 69-84. It is
 * pushed through the SAME extraction, the SAME parse and the SAME verdict as
 * the real documents, and the run aborts non-zero if mermaid ACCEPTS it. The
 * proof is not a test somewhere that may or may not be running; it is the
 * first two lines of this gate's output, every time.
 *
 * **2. AN EMPTY SWEEP MUST NOT PASS.** A moved file, a changed fence marker or
 * a glob that stopped matching leaves a naive gate checking zero fences,
 * exiting 0 and reporting GREEN forever while the documents rot. So this
 * PRINTS THE DENOMINATOR — "N fences across M files" — and refuses to pass
 * below a pinned floor. This repository has already shipped one baseline
 * harness that printed "baseline matches the pin" without ever running a test
 * (`19939273`); this is the second one not being shipped.
 *
 * ── ON FAILURE ────────────────────────────────────────────────────────────
 *
 * The FILE, the fence's LINE NUMBER in that file, and MERMAID'S OWN ERROR
 * TEXT. "A diagram failed" costs someone the twenty minutes this gate exists
 * to save.
 *
 * This gate does not repair documents and must not: a fence it reddens on is
 * `rulings/106`'s to fix.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMainEntry } from '../src/core/paths.ts';

/** The repository root, from this file. */
export const REPO = path.join(import.meta.dirname, '..');

/**
 * Documents swept, repo-relative. Files are read as named; directories are
 * walked for `.md`.
 *
 * NOT `DIAGRAM_SOURCES`, and not derived from it — see this file's docblock.
 * The two READMEs are here as well as there because a gate that trusts the
 * generator to have covered them is a gate with a hole exactly the shape of
 * the generator's next bug.
 */
export const DOC_SOURCES = [
  'README.md',
  'docs/README.he.md',
  'docs/capabilities',
  'docs/system',
];

/**
 * The floor. Measured 2026-09-17 over the list above; a run finding fewer than
 * this has lost sight of a document rather than found a tidier tree, and
 * saying so is the whole of anti-vacuity guard 2.
 *
 * These are MINIMA and they are allowed to move — deleting a diagram is a real
 * change and lowering the number is the deliberate act that goes with it. What
 * they refuse is the silent collapse: a renamed directory, a fence marker that
 * stopped being recognised, an extractor that started returning nothing.
 */
export const FENCE_FLOOR = 38;
export const FILE_FLOOR = 21;

/**
 * **The known-bad input, with provenance, and the reason this gate can be
 * believed.**
 *
 * Byte-identical to the fence that shipped in
 * `docs/capabilities/07-restore-and-handover.md` until `471b13b3` repaired it.
 * Recover it with:
 *
 *   git show 471b13b3^:docs/capabilities/07-restore-and-handover.md | sed -n '69,84p'
 *
 * The defect is on the tenth line — `--approve &lt;key&gt;` — where the bare
 * `&` ends mermaid's lexer. It is a real document that really shipped, not a
 * fixture invented to be broken, and that is why it is the right bulb to put
 * behind this light.
 */
export const KNOWN_BAD = `sequenceDiagram
  participant P as Person
  participant CLI as mycontext restore
  participant Stage as .staging/ record
  participant Inj as core/inject.ts
  participant Next as the next ordinary<br/>session start
  P->>CLI: "this window lost something" — a sentence, no code
  CLI->>Stage: --build reads the transcript,<br/>writes PROPOSED, approves nothing
  Stage-->>P: numbered review form under a coverage headline
  P->>CLI: --approve &lt;key&gt; — owner only, no --agent flag
  CLI->>Stage: writes the record, then re-reads it<br/>off disk to prove it survived
  Stage-->>P: "SAFE TO CLEAR"
  P->>P: clears the window — no command does this
  Next->>Inj: SessionStart, gated !manual && !subagent && !compacting
  Inj->>Stage: reads the approved, staged summary
  Inj-->>Next: delivers once — or discloses the failure,<br/>never swallows it
`;

/** Where the red proof's fence comes from, printed as its location. */
export const KNOWN_BAD_ORIGIN = '471b13b3^:docs/capabilities/07-restore-and-handover.md';

/** In the shipped file, ```` ```mermaid ```` sat here and its content began next. */
export const KNOWN_BAD_CONTENT_LINE = 69;

/**
 * And `--approve &lt;key&gt;` sat HERE — the line `471b13b3` names and the
 * line the ruling cites. The red proof requires this gate to compute exactly
 * this number from mermaid's own in-fence line, which is how the locator is
 * re-checked on every single run rather than the day it was written.
 */
export const KNOWN_BAD_OFFENDING_LINE = 78;

/**
 * The document the red proof sweeps, so EXTRACTION runs in the proof too and
 * not only parsing.
 *
 * It is padded so the fence lands on the shipped file's own lines: content on
 * 69, the `&` on 78. That is not decoration — it means the proof's printed
 * location must read `…07-restore-and-handover.md:78`, the exact citation in
 * `471b13b3` and in the owner's ruling, or the run fails.
 */
export const KNOWN_BAD_DOCUMENT = (() => {
  const lines = ['# the pre-repair chapter 7, reconstructed here only to be rejected', ''];
  while (lines.length < KNOWN_BAD_CONTENT_LINE - 2) {
    lines.push('> Padding, so this reconstruction carries the shipped file\'s own line numbers.');
  }
  lines.push('```mermaid');
  return `${lines.join('\n')}\n${KNOWN_BAD}\`\`\`\n`;
})();

/** One fence, located well enough for a person to go and open it. */
export interface Fence {
  /** Repo-relative, forward slashes. */
  file: string;
  /** 1-based line of the fence's first line of CONTENT, or 0 if not located. */
  line: number;
  source: string;
}

/** One verdict on one fence. */
export interface Outcome {
  fence: Fence;
  ok: boolean;
  /** mermaid's own message, verbatim, when it refused. */
  error: string;
}

/**
 * The browser renderer, loaded from Node, exactly as `gen-diagrams.ts` loads
 * it. It takes its `doc` as an argument and imports nothing but its own
 * vendored tokeniser, so it answers "which fences are diagrams" here the same
 * way it answers it in the page — the only reason one function can serve both.
 */
async function renderer(): Promise<{ mermaidBlocks: (src: string) => string[] }> {
  const file = path.join(REPO, 'src', 'ui', 'public', 'lib', 'markdown.js');
  return await import(pathToFileURL(file).href) as { mermaidBlocks: (src: string) => string[] };
}

/**
 * Every mermaid fence in one document, with the line its content starts on.
 *
 * **The line number is DERIVED from the extractor's own answer, never parsed
 * independently.** `mermaidBlocks` says what the fences are; this finds where
 * that exact text sits in the file. A second scanner computing positions would
 * be the very duplication the single-extractor rule exists to prevent — so
 * when the same definition appears twice in one file the search continues from
 * the previous hit rather than restarting, and a definition that somehow
 * cannot be located reports line 0 rather than guessing.
 */
export async function fencesIn(file: string, text: string): Promise<Fence[]> {
  const { mermaidBlocks } = await renderer();
  const normalised = String(text).replaceAll('\r\n', '\n');
  const out: Fence[] = [];
  let from = 0;
  for (const source of mermaidBlocks(normalised)) {
    const at = normalised.indexOf(source, from);
    const line = at === -1 ? 0 : normalised.slice(0, at).split('\n').length;
    if (at !== -1) from = at + source.length;
    out.push({ file, line, source });
  }
  return out;
}

/** Every `.md` under one source entry, repo-relative, sorted, recursing. */
export function markdownUnder(root: string, relative: string): string[] {
  const full = path.join(root, ...relative.split('/'));
  if (!existsSync(full)) return [];
  if (statSync(full).isFile()) return relative.endsWith('.md') ? [relative] : [];
  const out: string[] = [];
  const entries = readdirSync(full, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const child = `${relative}/${entry.name}`;
    if (entry.isDirectory()) out.push(...markdownUnder(root, child));
    else if (entry.name.endsWith('.md')) out.push(child);
  }
  return out;
}

/** Every document the sweep covers, repo-relative, in `DOC_SOURCES` order. */
export function documentsUnder(root: string, sources: string[] = DOC_SOURCES): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const source of sources) {
    for (const file of markdownUnder(root, source)) {
      if (seen.has(file)) continue;
      seen.add(file);
      out.push(file);
    }
  }
  return out;
}

/** Every fence in every document of the sweep, in document order. */
export async function collectFences(
  root: string,
  sources: string[] = DOC_SOURCES,
): Promise<Fence[]> {
  const out: Fence[] = [];
  for (const file of documentsUnder(root, sources)) {
    const text = readFileSync(path.join(root, ...file.split('/')), 'utf8');
    out.push(...await fencesIn(file, text));
  }
  return out;
}

/**
 * The verdict, as an exit code, kept PURE and separate from the browser so the
 * test can assert it without one.
 *
 * Two independent ways to be non-zero, and they are different failures: a
 * fence mermaid refused, and a sweep too small to have looked at anything.
 */
export function verdict(
  outcomes: Outcome[],
  files: number,
  floors: { fences: number; files: number } = { fences: FENCE_FLOOR, files: FILE_FLOOR },
): { code: number; reasons: string[] } {
  const reasons: string[] = [];
  const failed = outcomes.filter((o) => !o.ok);
  if (outcomes.length < floors.fences) {
    reasons.push(
      `EMPTY SWEEP: ${outcomes.length} fence(s) found, below the floor of ${floors.fences}. `
      + 'Either a document moved out from under DOC_SOURCES, or the extractor stopped '
      + 'recognising a fence. A gate that checks nothing exits 0 and reports GREEN forever. '
      + 'If diagrams were deliberately removed, lower FENCE_FLOOR in the same commit.',
    );
  }
  if (files < floors.files) {
    reasons.push(
      `EMPTY SWEEP: ${files} document(s) carry a fence, below the floor of ${floors.files}. `
      + 'Same reason as above, one level up: a directory that stopped matching takes its whole '
      + 'chapter set with it and says nothing about having done so.',
    );
  }
  if (failed.length > 0) reasons.push(`${failed.length} fence(s) do not parse.`);
  return { code: reasons.length > 0 ? 1 : 0, reasons };
}

/**
 * The line IN THE FILE that mermaid is complaining about, when it says.
 *
 * mermaid counts from the start of the DEFINITION — "Parse error on line 10"
 * — and a person needs the line in the document. This adds the fence's own
 * offset and nothing else; when mermaid names no line, or the fence could not
 * be located, it returns the fence's first line, which is always somewhere
 * true to open.
 */
export function offendingLine(fence: Fence, error: string): number {
  if (fence.line <= 0) return 0;
  const named = /^\s*Parse error on line (\d+)/m.exec(error);
  if (named === null) return fence.line;
  return fence.line + (Number(named[1]) - 1);
}

/** How a refusal is printed. One line a person can act on, then the error. */
export function describe(outcome: Outcome): string {
  const at = offendingLine(outcome.fence, outcome.error);
  const where = at > 0 ? `${outcome.fence.file}:${at}` : `${outcome.fence.file} (line not located)`;
  const first = (outcome.fence.source.split('\n')[0] ?? '').trim();
  const fenceAt = outcome.fence.line > 0 ? `${outcome.fence.file}:${outcome.fence.line}` : '?';
  return `DOES NOT PARSE  ${where}\n`
    + `     the fence opens: ${first}  (at ${fenceAt})\n`
    + `     mermaid says:    ${outcome.error.split('\n').join('\n                      ')}`;
}

/**
 * A page with mermaid in it, and a function that parses one definition without
 * drawing it.
 *
 * `securityLevel`, `theme` and `fontFamily` are `gen-diagrams.ts`'s, verbatim
 * and on purpose — see this file's docblock.
 */
async function parser(): Promise<{
  parse: (definition: string) => Promise<{ ok: boolean; error: string }>;
  close: () => Promise<void>;
}> {
  const { chromium } = await import('playwright');
  const bundle = readFileSync(
    path.join(REPO, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'), 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    const mermaid = (globalThis as unknown as {
      mermaid: { initialize: (config: unknown) => void };
    }).mermaid;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict',
      fontFamily: 'system-ui, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    });
  });
  return {
    parse: (definition: string) => page.evaluate(async (source) => {
      const mermaid = (globalThis as unknown as {
        mermaid: { parse: (definition: string) => Promise<unknown> };
      }).mermaid;
      try {
        await mermaid.parse(source as string);
        return { ok: true, error: '' };
      } catch (cause) {
        const thrown = cause as { message?: unknown; str?: unknown };
        const message = typeof thrown?.message === 'string'
          ? thrown.message
          : typeof thrown?.str === 'string' ? thrown.str : String(cause);
        return { ok: false, error: message };
      }
    }, definition),
    close: () => browser.close(),
  };
}

/** Where output goes. Injectable so nothing here has to own a console. */
export type Out = (line: string) => void;

/**
 * The whole gate. Returns the exit code; never calls `process.exit`, so
 * importing this module cannot end the importing process.
 */
export async function main(argv: string[] = [], out: Out = console.log): Promise<number> {
  const root = argValue(argv, '--root') ?? REPO;
  const floors = {
    fences: Number(argValue(argv, '--min-fences') ?? FENCE_FLOOR),
    files: Number(argValue(argv, '--min-files') ?? FILE_FLOOR),
  };

  const started = Date.now();
  const { parse, close } = await parser();
  try {
    // ── 0. The red proof, before a single green number is believed ─────────
    const proofFences = await fencesIn(KNOWN_BAD_ORIGIN, KNOWN_BAD_DOCUMENT);
    if (proofFences.length !== 1) {
      out('');
      out(`RED PROOF BROKEN: the extractor found ${proofFences.length} fence(s) in the known-bad`);
      out('document, not 1. Nothing below this line would mean anything.');
      return 1;
    }
    const proofRun = await parse(proofFences[0]!.source);
    const proof: Outcome = { fence: proofFences[0]!, ok: proofRun.ok, error: proofRun.error };
    if (proof.ok || verdict([proof], 1, { fences: 1, files: 1 }).code === 0) {
      out('');
      out('RED PROOF FAILED — THIS GATE HAS NO BULB BEHIND IT.');
      out('The pre-repair chapter 7 fence (`--approve &lt;key&gt;`, git 471b13b3^) was ACCEPTED');
      out('by this parser, or was passed by this gate\'s own verdict. That fence shipped as an');
      out('error box on the page for as long as it existed. If it passes here, nothing that');
      out('follows is evidence.');
      return 1;
    }
    const pointedAt = offendingLine(proof.fence, proof.error);
    if (pointedAt !== KNOWN_BAD_OFFENDING_LINE) {
      out('');
      out('RED PROOF FAILED: the fence was correctly refused, but this gate located it at line');
      out(`${pointedAt} rather than ${KNOWN_BAD_OFFENDING_LINE}, which is where 471b13b3 found it.`);
      out('A refusal that points somewhere else costs a reader the twenty minutes this gate');
      out('exists to save, so it is a failure here rather than a surprise later.');
      return 1;
    }
    out('');
    out('red proof — the RED path, run before any number below is believed. The pre-repair');
    out(`chapter 7 fence (git ${KNOWN_BAD_ORIGIN.split(':')[0]}) must be refused, and is:`);
    out(describe({ ...proof, fence: { ...proof.fence, file: KNOWN_BAD_ORIGIN } }));

    // ── 1. The sweep, and its denominator ──────────────────────────────────
    const documents = documentsUnder(root);
    const fences = await collectFences(root);
    const withFence = new Set(fences.map((f) => f.file));

    const outcomes: Outcome[] = [];
    for (const fence of fences) {
      const result = await parse(fence.source);
      outcomes.push({ fence, ok: result.ok, error: result.error });
    }

    const { code, reasons } = verdict(outcomes, withFence.size, floors);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const bad = outcomes.filter((o) => !o.ok);

    out('');
    for (const failure of bad) out(describe(failure));
    if (bad.length > 0) out('');
    out(
      `${outcomes.length} fence(s) across ${withFence.size} of ${documents.length} document(s) `
      + `(${DOC_SOURCES.join(', ')}): ${outcomes.length - bad.length} parse, ${bad.length} do `
      + `not — ${seconds}s.`,
    );
    if (code === 0) {
      out('nothing was drawn, and nothing needed to be: every fence in the documents parses.');
    } else {
      for (const reason of reasons) out(reason);
      if (bad.length > 0) {
        out('DO NOT repair a document from here — `rulings/106` owns document repair.');
      }
    }
    return code;
  } finally {
    await close();
  }
}

/** `--flag value`, or undefined. Deliberately tiny; there is no argv library. */
function argValue(argv: string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at === -1 ? undefined : argv[at + 1];
}

// Guarded, for the reason `scripts/check-needs-cycles.ts` and
// `scripts/e2e-gate.ts` state: an unguarded module-scope `process.exit` kills
// the process of any test that imports this file, deleting every case in it
// while the runner reports GREEN.
if (isMainEntry(import.meta.filename, process.argv[1])) {
  process.exit(await main(process.argv.slice(2)));
}
