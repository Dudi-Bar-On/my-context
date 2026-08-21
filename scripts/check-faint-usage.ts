#!/usr/bin/env node
/**
 * **`--faint` is legal only at large-text size, and this is the thing that
 * enforces it.**
 *
 * The visual-direction spec's §2.4 measured the three ink steps from rendered
 * pixels, with the blur, the glass and the ground composited: `--ink` 12.89,
 * `--dim` 6.43, `--faint` **3.83**. The third one clears the 3:1 bar that large
 * text owes and fails the 4.5 bar that everything else owes. Lifting it until
 * it passed 4.5 was rejected — it lands within a hair of `--dim` and collapses
 * a three-step hierarchy into two — so the third step was kept and the cost was
 * accepted as A RULE:
 *
 *     --faint is large-text only. Body-sized prose uses --dim.
 *
 * The spec says in the same paragraph that the rule "must be enforced, not
 * remembered", and that is not a stylistic preference. Rules this project asks
 * people to remember are the ones it keeps finding broken. A colour rule is
 * worse than most, because breaking it raises no error, no warning and no
 * visual alarm — just text a portion of readers cannot read, on a screen that
 * looks fine to whoever shipped it.
 *
 * So the rule gets a checker, and the checker gets a size model rather than a
 * grep. `grep -c faint` cannot tell `th` at 10px from a 24px heading, and a
 * check that cannot tell them apart has to be written as "never use --faint",
 * which is a different rule from the one that was ruled.
 *
 * **What "large text" means here, and why it is not the number the plan wrote
 * down.** WCAG 2.2 defines large text as 18pt, or 14pt when bold — which in CSS
 * reference pixels is **24px, or 18.66px at weight >= 700**. The repaint plan's
 * Task 4 writes those two as `18` and `14`: the POINT sizes copied across as if
 * they were pixel sizes. One point is 4/3 of a pixel, so both are a third
 * short, and enforcing them would bless `--faint` on 14px bold text — 3.83
 * against a 4.5 requirement, which is the exact defect this file exists to
 * prevent, written into the thing preventing it. The constants below are
 * therefore WCAG's, and the plan's numbers are recorded here as the reason.
 *
 * That choice changed nothing about what had to be fixed: every `--faint` text
 * rule in the mockup sat at 8-11px, so the offender set is identical under
 * either threshold. The difference is entirely about what the checker will
 * bless NEXT time, which is the half of a checker's job that is invisible on
 * the day it is written.
 *
 * **What this checker cannot do, stated so a green run is not read as more than
 * it is.**
 *
 *   - It resolves inheritance through SELECTOR PREFIXES, not through the DOM.
 *     For `.pane dt` it can see `.pane` but not the `.pane dl` that actually
 *     sets 11px, so it falls back to the document's base size. Every fallback
 *     it makes is toward a LARGER size, which is toward "legal" — so the model
 *     can raise a false alarm and force an explicit `font-size`, and cannot
 *     quietly bless something small. If the document base ever rises above the
 *     large-text bar that trade inverts, and this is the line to re-read.
 *   - It judges CSS. A `var(--faint)` composed in JavaScript — the activity
 *     pulse builds one for `<rect>` fills — is counted and named in the report,
 *     never judged, because nothing static can tell which element it lands on.
 *   - It says nothing about whether 3.83 is still the true ratio. That number
 *     was sampled from pixels and belongs to the spec. If the ground or the
 *     glass changes it has to be re-measured there, and the constants in this
 *     file are not what would notice.
 *
 * Zero dependencies, erasable syntax only, run by Node from source — the same
 * constraints as `src/`.
 *
 * The gate is `test/ui/faint-usage.test.ts`, which runs inside `npm test` and
 * carries the positive controls that prove this parser can still fail. There is
 * deliberately no eighth `npm run check:*` entry: the seven-gate list is
 * written down in several places, and a rule already inside `npm test` does not
 * need its own script to have teeth.
 *
 * Usage:
 *   node scripts/check-faint-usage.ts          report, exit 1 on any offender
 *   node scripts/check-faint-usage.ts --json   the same report, machine-readable
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');

/**
 * Everything that may apply an ink token to text. The shipped stylesheet is
 * listed while it is still a placeholder, on purpose: the rule belongs to the
 * design system rather than to the mockup, and a gate that starts guarding a
 * file only once that file has content is a gate that misses its first draft.
 */
export const SCANNED_FILES = [
  'docs/design/web-ui-mockup.html',
  'src/ui/public/index.html',
  'src/ui/public/styles.css',
];

/** 18pt in CSS reference pixels. WCAG 2.2, SC 1.4.3. */
export const LARGE_TEXT_PX = 24;
/** 14pt in CSS reference pixels, which counts as large only when bold. */
export const LARGE_BOLD_PX = 18.66;
/** The weight at which the 14pt allowance applies. */
export const BOLD_WEIGHT = 700;
/** The token under enforcement, named once. */
export const TOKEN = '--faint';
/** What a rule that fails this check should use instead. */
export const REPLACEMENT = '--dim';
/**
 * What the model reports as the document size when nothing sets one.
 *
 * Exported because it is the shape of a parse failure, not a design value: if a
 * real stylesheet resolves to this, the rule that sets the base size was not
 * found and every inherited size in the report is wrong.
 */
export const NO_DOCUMENT_SIZE = 'the initial 16px, since nothing sets a document size';

export interface Declaration {
  property: string;
  value: string;
  line: number;
}

export interface Rule {
  file: string;
  line: number;
  /** The comma-separated selectors, normalised. */
  selectors: string[];
  declarations: Declaration[];
  /** Enclosing at-rule preludes, outermost first. */
  at: string[];
}

export interface Use {
  file: string;
  line: number;
  selector: string;
  property: string;
  text: string;
  sizePx: number;
  sizeFrom: string;
  weight: number;
  weightFrom: string;
  at: string[];
}

export interface Unjudged {
  file: string;
  line: number;
  what: string;
}

export interface Problem {
  file: string;
  line: number;
  detail: string;
}

export interface Report {
  /** `--faint` exactly as declared, per file that declares it. */
  declaredAs: { file: string; value: string }[];
  filesScanned: number;
  rulesParsed: number;
  /** Declarations whose value reaches `--faint`, split by what they colour. */
  textUses: number;
  nonTextUses: number;
  /** Text uses that are legal because they are large enough. */
  legal: Use[];
  offenders: Use[];
  unjudged: Unjudged[];
  problems: Problem[];
}

export interface Source {
  file: string;
  text: string;
}

/* ── the CSS a file contributes ───────────────────────────────────────────── */

interface Chunk { css: string; offset: number }

/**
 * The text with every `<!-- … -->` blanked to spaces, same length, newlines
 * kept.
 *
 * **Found by making this checker red for the wrong reason.** The mockup's
 * header comment contains the sentence *"This file carries an inline `<style>`
 * and `<script>`"*, and a naive `<style>…</style>` match starts there — nine
 * hundred lines early, inside prose, where `public/lib/*.js` reads as the start
 * of a CSS comment. The whole token block landed inside one unterminated
 * comment, `:root` was never seen, and every `var(--fs-0)` came back
 * undefined. It failed loudly, which is the only reason it was not shipped
 * green: a parser that finds nothing agrees with a file that violates nothing.
 */
function maskHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
}

function cssChunks(source: Source): Chunk[] {
  if (source.file.endsWith('.css')) return [{ css: source.text, offset: 0 }];
  const masked = maskHtmlComments(source.text);
  const out: Chunk[] = [];
  for (const m of masked.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const body = m[1] ?? '';
    const offset = (m.index ?? 0) + m[0].length - body.length - '</style>'.length;
    out.push({ css: source.text.slice(offset, offset + body.length), offset });
  }
  return out;
}

/** 1-based line number for an offset in `text`. */
function lineIndexer(text: string): (offset: number) => number {
  const starts: number[] = [0];
  for (let i = 0; i < text.length; i += 1) if (text[i] === '\n') starts.push(i + 1);
  return (offset: number) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= offset) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}

function skipString(s: string, i: number, to: number): number {
  const quote = s[i];
  let j = i + 1;
  while (j < to) {
    if (s[j] === '\\') { j += 2; continue; }
    if (s[j] === quote) return j + 1;
    j += 1;
  }
  return to;
}

/** Index of the `}` matching the `{` at `open`, or `to` if it is unterminated. */
function matchBrace(s: string, open: number, to: number): number {
  let depth = 0;
  let i = open;
  while (i < to) {
    const c = s[i]!;
    if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); i = e === -1 ? to : e + 2; continue; }
    if (c === '"' || c === "'") { i = skipString(s, i, to); continue; }
    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) return i; }
    i += 1;
  }
  return to;
}

/** Index of the `)` matching the `(` at `open`. */
function matchParen(s: string, open: number, to: number): number {
  let depth = 0;
  let i = open;
  while (i < to) {
    const c = s[i]!;
    if (c === '"' || c === "'") { i = skipString(s, i, to); continue; }
    if (c === '(') depth += 1;
    else if (c === ')') { depth -= 1; if (depth === 0) return i; }
    i += 1;
  }
  return to;
}

/** At-rules that wrap ordinary style rules rather than declarations. */
const NESTING_AT_RULES = new Set(['media', 'supports', 'layer', 'container', 'scope', 'document']);

function normaliseSelector(selector: string): string {
  return selector
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s*([>+~])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ScanContext {
  file: string;
  base: number;
  lineAt: (offset: number) => number;
  out: Rule[];
}

function scanRules(s: string, from: number, to: number, ctx: ScanContext, at: string[]): void {
  let i = from;
  let start = i;
  while (i < to) {
    const c = s[i]!;
    if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); i = e === -1 ? to : e + 2; continue; }
    if (c === '"' || c === "'") { i = skipString(s, i, to); continue; }
    if (c === '{') {
      const prelude = s.slice(start, i).replace(/\/\*[\s\S]*?\*\//g, ' ').trim();
      const close = matchBrace(s, i, to);
      if (prelude.startsWith('@')) {
        const name = (/^@([\w-]+)/.exec(prelude)?.[1] ?? '').toLowerCase();
        if (NESTING_AT_RULES.has(name)) scanRules(s, i + 1, close, ctx, [...at, prelude]);
      } else if (prelude.length > 0) {
        readStyleRule(s, prelude, start, i + 1, close, ctx, at);
      }
      i = close + 1;
      start = i;
      continue;
    }
    if (c === ';' || c === '}') { i += 1; start = i; continue; }
    i += 1;
  }
}

/** One style rule's declarations, plus any rule nested inside it. */
function readStyleRule(
  s: string, prelude: string, preludeStart: number, from: number, to: number,
  ctx: ScanContext, at: string[],
): void {
  const selectors = prelude.split(',').map(normaliseSelector).filter((x) => x.length > 0);
  const rule: Rule = {
    file: ctx.file,
    line: ctx.lineAt(ctx.base + preludeStart),
    selectors,
    declarations: [],
    at,
  };
  ctx.out.push(rule);

  const push = (start: number, end: number): void => {
    const raw = s.slice(start, end);
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').trim();
    if (stripped.length === 0) return;
    const colon = stripped.indexOf(':');
    if (colon === -1) return;
    rule.declarations.push({
      property: stripped.slice(0, colon).trim().toLowerCase(),
      value: stripped.slice(colon + 1).trim(),
      line: ctx.lineAt(ctx.base + start + (raw.length - raw.trimStart().length)),
    });
  };

  let i = from;
  let start = i;
  while (i < to) {
    const c = s[i]!;
    if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); i = e === -1 ? to : e + 2; continue; }
    if (c === '"' || c === "'") { i = skipString(s, i, to); continue; }
    if (c === '(') { i = matchParen(s, i, to) + 1; continue; }
    if (c === ';') { push(start, i); i += 1; start = i; continue; }
    if (c === '{') {
      // CSS nesting: compose the child selector against every parent selector,
      // so a nested rule is judged with the size context it really has.
      const nested = s.slice(start, i).replace(/\/\*[\s\S]*?\*\//g, ' ').trim();
      const close = matchBrace(s, i, to);
      const composed = selectors.flatMap((parent) => nested.split(',').map((part) => {
        const child = normaliseSelector(part);
        return child.includes('&') ? child.replaceAll('&', parent) : `${parent} ${child}`;
      }));
      readStyleRule(s, composed.join(','), start, i + 1, close, ctx, at);
      i = close + 1;
      start = i;
      continue;
    }
    i += 1;
  }
  push(start, to);
}

export function parseStylesheet(source: Source): Rule[] {
  const lineAt = lineIndexer(source.text);
  const out: Rule[] = [];
  for (const chunk of cssChunks(source)) {
    scanRules(chunk.css, 0, chunk.css.length, { file: source.file, base: chunk.offset, lineAt, out }, []);
  }
  return out;
}

/* ── custom properties ────────────────────────────────────────────────────── */

/** Selectors whose custom properties are treated as document-wide. */
function isRootRule(rule: Rule): boolean {
  return rule.selectors.some((s) => /^(:root|html|body)\b/.test(s));
}

export function customProperties(rules: Rule[]): Map<string, string> {
  const vars = new Map<string, string>();
  for (const rule of rules) {
    if (!isRootRule(rule)) continue;
    for (const decl of rule.declarations) {
      if (decl.property.startsWith('--')) vars.set(decl.property, decl.value);
    }
  }
  return vars;
}

export interface Resolution {
  text: string;
  /** Every custom property the value reached, resolved or not. */
  used: Set<string>;
  unresolved: string[];
}

export function resolveValue(value: string, vars: Map<string, string>): Resolution {
  const used = new Set<string>();
  const unresolved: string[] = [];
  const walk = (input: string, seen: Set<string>, depth: number): string => {
    if (depth > 16) return input;
    let out = '';
    let i = 0;
    while (i < input.length) {
      const at = input.indexOf('var(', i);
      if (at === -1) { out += input.slice(i); break; }
      out += input.slice(i, at);
      const close = matchParen(input, at + 3, input.length);
      const inner = input.slice(at + 4, close);
      let comma = -1;
      let parens = 0;
      for (let k = 0; k < inner.length; k += 1) {
        if (inner[k] === '(') parens += 1;
        else if (inner[k] === ')') parens -= 1;
        else if (inner[k] === ',' && parens === 0) { comma = k; break; }
      }
      const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
      const fallback = comma === -1 ? null : inner.slice(comma + 1).trim();
      used.add(name);
      const definition = vars.get(name);
      if (definition !== undefined && !seen.has(name)) {
        out += walk(definition, new Set([...seen, name]), depth + 1);
      } else if (fallback !== null) {
        out += walk(fallback, seen, depth + 1);
      } else {
        unresolved.push(name);
        out += `var(${name})`;
      }
      i = close + 1;
    }
    return out;
  };
  return { text: walk(value, new Set<string>(), 0), used, unresolved };
}

/* ── font size and weight ─────────────────────────────────────────────────── */

export type SizeValue =
  | { kind: 'abs'; px: number }
  | { kind: 'parent'; factor: number }
  | { kind: 'root'; factor: number }
  | { kind: 'inherit' };

/** Absolute-size keywords, as multiples of the 16px initial size. */
const SIZE_KEYWORDS = new Map<string, number>([
  ['xx-small', 0.5625], ['x-small', 0.625], ['small', 0.8125], ['medium', 1],
  ['large', 1.125], ['x-large', 1.5], ['xx-large', 2], ['xxx-large', 3],
]);

const GLOBAL_KEYWORDS = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

export function parseSize(raw: string): SizeValue | null {
  const value = raw.trim().toLowerCase();
  if (GLOBAL_KEYWORDS.has(value)) return { kind: 'inherit' };
  if (value === 'smaller') return { kind: 'parent', factor: 1 / 1.2 };
  if (value === 'larger') return { kind: 'parent', factor: 1.2 };
  const keyword = SIZE_KEYWORDS.get(value);
  if (keyword !== undefined) return { kind: 'abs', px: keyword * 16 };
  const m = /^(-?\d*\.?\d+)(px|pt|pc|in|cm|mm|q|rem|em|ex|ch|%)$/.exec(value);
  if (m === null) return null;
  const n = Number(m[1]);
  switch (m[2]) {
    case 'px': return { kind: 'abs', px: n };
    case 'pt': return { kind: 'abs', px: n * (4 / 3) };
    case 'pc': return { kind: 'abs', px: n * 16 };
    case 'in': return { kind: 'abs', px: n * 96 };
    case 'cm': return { kind: 'abs', px: n * (96 / 2.54) };
    case 'mm': return { kind: 'abs', px: n * (96 / 25.4) };
    case 'q': return { kind: 'abs', px: n * (96 / 101.6) };
    case 'rem': return { kind: 'root', factor: n };
    case 'em': return { kind: 'parent', factor: n };
    case 'ex': return { kind: 'parent', factor: n * 0.5 };
    case 'ch': return { kind: 'parent', factor: n * 0.5 };
    case '%': return { kind: 'parent', factor: n / 100 };
    default: return null;
  }
}

export function parseWeight(raw: string): number | null {
  const value = raw.trim().toLowerCase();
  if (value === 'normal') return 400;
  if (value === 'bold') return 700;
  if (GLOBAL_KEYWORDS.has(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 1000 ? n : null;
}

/** The size and weight carried by a resolved `font:` shorthand. */
export function parseFontShorthand(raw: string): { size: SizeValue | null; weight: number | null } {
  const value = raw.trim();
  if (GLOBAL_KEYWORDS.has(value.toLowerCase())) return { size: { kind: 'inherit' }, weight: null };
  const tokens = value.split(/\s+/);
  let weight: number | null = null;
  for (const token of tokens) {
    const head = token.split('/')[0]!;
    const size = parseSize(head);
    if (size !== null && size.kind !== 'inherit') return { size, weight };
    if (/^(?:normal|bold|[1-9]00)$/.test(token.toLowerCase())) {
      const asWeight = parseWeight(token);
      if (asWeight !== null) weight = asWeight;
    }
  }
  return { size: null, weight };
}

/* ── the cascade model ────────────────────────────────────────────────────── */

/** The ancestor selectors of `sel`, longest first. */
export function ancestorSelectors(sel: string): string[] {
  const tokens = sel.split(' ');
  const out: string[] = [];
  let end = tokens.length - 1;
  while (end > 0) {
    let slice = tokens.slice(0, end);
    while (slice.length > 0 && ['>', '+', '~'].includes(slice[slice.length - 1]!)) slice = slice.slice(0, -1);
    if (slice.length === 0) break;
    const candidate = slice.join(' ');
    if (!out.includes(candidate)) out.push(candidate);
    end = slice.length - 1;
  }
  return out;
}

export interface Resolved { px: number; from: string }

export interface Cascade {
  sizeOf: (selector: string) => Resolved;
  weightOf: (selector: string) => { weight: number; from: string };
  baseSize: () => Resolved;
}

/**
 * A size and weight model over one stylesheet.
 *
 * Not a cascade engine and not trying to be one: it answers "how big is the
 * text this rule paints" using the rule itself, then the longest ancestor
 * SELECTOR the sheet declares, then the document base. See the header for what
 * that approximation can and cannot get wrong.
 */
export function buildCascade(
  rules: Rule[], vars: Map<string, string>, file: string, problems: Problem[],
): Cascade {
  const bySelector = new Map<string, Rule[]>();
  for (const rule of rules) {
    for (const selector of rule.selectors) {
      const list = bySelector.get(selector);
      if (list === undefined) bySelector.set(selector, [rule]);
      else list.push(rule);
    }
  }

  const complain = (resolution: Resolution, decl: Declaration, selector: string): void => {
    for (const name of resolution.unresolved) {
      problems.push({
        file,
        line: decl.line,
        detail: `\`${selector}\` sets \`${decl.property}\` from \`var(${name})\`, which nothing defines. `
          + 'A size that cannot be resolved cannot be judged, so this is an error rather than a pass.',
      });
    }
  };

  /** The last size this exact selector declares, from its own rules only. */
  const ownSize = (selector: string): SizeValue | null => {
    let found: SizeValue | null = null;
    for (const rule of bySelector.get(selector) ?? []) {
      for (const decl of rule.declarations) {
        if (decl.property === 'font-size') {
          const resolution = resolveValue(decl.value, vars);
          complain(resolution, decl, selector);
          const parsed = parseSize(resolution.text);
          if (parsed !== null) found = parsed;
        } else if (decl.property === 'font') {
          const resolution = resolveValue(decl.value, vars);
          complain(resolution, decl, selector);
          const parsed = parseFontShorthand(resolution.text);
          if (parsed.size !== null) found = parsed.size;
        }
      }
    }
    return found;
  };

  const ownWeight = (selector: string): number | null => {
    let found: number | null = null;
    for (const rule of bySelector.get(selector) ?? []) {
      for (const decl of rule.declarations) {
        if (decl.property === 'font-weight') {
          const parsed = parseWeight(resolveValue(decl.value, vars).text);
          if (parsed !== null) found = parsed;
        } else if (decl.property === 'font') {
          const parsed = parseFontShorthand(resolveValue(decl.value, vars).text);
          if (parsed.weight !== null) found = parsed.weight;
          else if (parsed.size !== null) found = 400;
        }
      }
    }
    return found;
  };

  let rootPx = 16;
  let base: Resolved = { px: 16, from: NO_DOCUMENT_SIZE };
  for (const name of [':root', 'html']) {
    const size = ownSize(name);
    if (size !== null && size.kind === 'abs') {
      rootPx = size.px;
      base = { px: size.px, from: `\`${name}\`` };
    }
  }
  const bodySize = ownSize('body');
  if (bodySize !== null) {
    if (bodySize.kind === 'abs') base = { px: bodySize.px, from: '`body`' };
    else if (bodySize.kind === 'root') base = { px: bodySize.factor * rootPx, from: '`body`' };
    else if (bodySize.kind === 'parent') base = { px: bodySize.factor * base.px, from: '`body`' };
  }

  /** The nearest ancestor selector this stylesheet actually declares. */
  const parentOf = (selector: string): string | null => {
    for (const candidate of ancestorSelectors(selector)) {
      if (bySelector.has(candidate)) return candidate;
    }
    return null;
  };

  const sizeMemo = new Map<string, Resolved>();
  const sizeOf = (selector: string, guard: Set<string>): Resolved => {
    const memo = sizeMemo.get(selector);
    if (memo !== undefined) return memo;
    if (guard.has(selector)) return base;
    const next = new Set([...guard, selector]);
    const parent = (): Resolved => {
      const up = parentOf(selector);
      return up === null ? base : sizeOf(up, next);
    };
    const own = ownSize(selector);
    let out: Resolved;
    if (own === null || own.kind === 'inherit') {
      const from = parent();
      out = {
        px: from.px,
        from: from.from.startsWith('inherited from') ? from.from : `inherited from ${from.from}`,
      };
    } else if (own.kind === 'abs') {
      out = { px: own.px, from: `\`${selector}\`` };
    } else if (own.kind === 'root') {
      out = { px: own.factor * rootPx, from: `\`${selector}\`, relative to the root size` };
    } else {
      const from = parent();
      out = { px: own.factor * from.px, from: `\`${selector}\`, relative to ${from.from}` };
    }
    sizeMemo.set(selector, out);
    return out;
  };

  const weightMemo = new Map<string, { weight: number; from: string }>();
  const weightOf = (selector: string, guard: Set<string>): { weight: number; from: string } => {
    const memo = weightMemo.get(selector);
    if (memo !== undefined) return memo;
    if (guard.has(selector)) return { weight: 400, from: 'the initial weight' };
    const own = ownWeight(selector);
    let out: { weight: number; from: string };
    if (own !== null) {
      out = { weight: own, from: `\`${selector}\`` };
    } else {
      const up = parentOf(selector);
      if (up === null) out = { weight: 400, from: 'the initial weight' };
      else {
        const from = weightOf(up, new Set([...guard, selector]));
        out = {
          weight: from.weight,
          from: from.from.startsWith('inherited from') ? from.from : `inherited from ${from.from}`,
        };
      }
    }
    weightMemo.set(selector, out);
    return out;
  };

  return {
    sizeOf: (selector: string) => sizeOf(selector, new Set<string>()),
    weightOf: (selector: string) => weightOf(selector, new Set<string>()),
    baseSize: () => base,
  };
}

/* ── classification ───────────────────────────────────────────────────────── */

const TEXT_COLOUR_PROPERTIES = new Set(['color', '-webkit-text-fill-color']);

/** An SVG selector naming a text-bearing element. */
function targetsSvgText(selectors: string[]): boolean {
  return selectors.some((s) => /(^|[\s>+~])(text|tspan|textpath)([.#:[]|$|[\s>+~])/i.test(s));
}

function declaresFont(rule: Rule): boolean {
  return rule.declarations.some(
    (d) => d.property === 'font-size' || d.property === 'font' || d.property === 'font-family',
  );
}

/**
 * Whether this declaration paints TEXT.
 *
 * A border, a hatched background, an SVG node's stroke and an edge line are all
 * non-text, and non-text owes 3:1 — which 3.83 clears. Confusing the two would
 * make the checker either useless or a nag, so `fill` is the one that needs
 * care: it paints text on a `<text>` element and a shape everywhere else.
 */
export function isTextColour(rule: Rule, decl: Declaration): boolean {
  if (TEXT_COLOUR_PROPERTIES.has(decl.property)) return true;
  if (decl.property === 'fill') return targetsSvgText(rule.selectors) || declaresFont(rule);
  return false;
}

/** True when the size clears the bar at which a 3:1 ratio is allowed. */
export function isLargeText(px: number, weight: number): boolean {
  return weight >= BOLD_WEIGHT ? px >= LARGE_BOLD_PX : px >= LARGE_TEXT_PX;
}

/* ── the analysis ─────────────────────────────────────────────────────────── */

export function analyse(sources: Source[]): Report {
  const report: Report = {
    declaredAs: [],
    filesScanned: sources.length,
    rulesParsed: 0,
    textUses: 0,
    nonTextUses: 0,
    legal: [],
    offenders: [],
    unjudged: [],
    problems: [],
  };

  for (const source of sources) {
    const rules = parseStylesheet(source);
    report.rulesParsed += rules.length;
    const vars = customProperties(rules);
    const declared = vars.get(TOKEN);
    if (declared !== undefined) report.declaredAs.push({ file: source.file, value: declared });
    const cascade = buildCascade(rules, vars, source.file, report.problems);

    for (const rule of rules) {
      for (const decl of rule.declarations) {
        if (decl.property.startsWith('--')) continue;
        const resolution = resolveValue(decl.value, vars);
        if (!resolution.used.has(TOKEN)) continue;
        if (!isTextColour(rule, decl)) { report.nonTextUses += 1; continue; }
        report.textUses += 1;
        for (const selector of rule.selectors) {
          const size = cascade.sizeOf(selector);
          const weight = cascade.weightOf(selector);
          const use: Use = {
            file: source.file,
            line: decl.line,
            selector,
            property: decl.property,
            text: `${decl.property}:${decl.value}`,
            sizePx: size.px,
            sizeFrom: size.from,
            weight: weight.weight,
            weightFrom: weight.from,
            at: rule.at,
          };
          if (isLargeText(size.px, weight.weight)) report.legal.push(use);
          else report.offenders.push(use);
        }
      }
    }

    for (const hit of outsideStylesheet(source)) report.unjudged.push(hit);
  }

  if (report.declaredAs.length === 0) {
    report.problems.push({
      file: SCANNED_FILES[0]!,
      line: 0,
      detail: `nothing declares \`${TOKEN}\`. Either the token block moved out of the scanned files or `
        + 'the token was renamed, and a rule cannot be enforced against a name that no longer exists. '
        + 'Point SCANNED_FILES at the token block, or retire this checker deliberately.',
    });
  }
  return report;
}

/** `--faint` mentioned outside any `<style>` block: script, or a style attribute. */
function outsideStylesheet(source: Source): Unjudged[] {
  const lineAt = lineIndexer(source.text);
  const spans = cssChunks(source).map((c) => [c.offset, c.offset + c.css.length] as const);
  const out: Unjudged[] = [];
  for (const m of source.text.matchAll(new RegExp(`var\\(\\s*${TOKEN}\\b`, 'g'))) {
    const at = m.index ?? 0;
    if (spans.some(([from, to]) => at >= from && at < to)) continue;
    out.push({ file: source.file, line: lineAt(at), what: `\`var(${TOKEN})\` outside any stylesheet` });
  }
  return out;
}

export function readSources(files: string[] = SCANNED_FILES): Source[] {
  const out: Source[] = [];
  for (const file of files) {
    const abs = path.join(REPO, file);
    if (!existsSync(abs)) continue;
    out.push({ file, text: readFileSync(abs, 'utf8') });
  }
  return out;
}

/* ── the report ───────────────────────────────────────────────────────────── */

export function describe(use: Use): string[] {
  const size = `${Number(use.sizePx.toFixed(2))}px`;
  const bar = use.weight >= BOLD_WEIGHT ? `${LARGE_BOLD_PX}px at this weight` : `${LARGE_TEXT_PX}px`;
  const context = use.at.length > 0 ? `${use.at.join(' ')} ` : '';
  return [
    `${TOKEN} below large-text size  ${use.file}  line ${use.line}`,
    `     ${context}${use.selector}  {  ${use.text}  }`,
    `     size ${size} (${use.sizeFrom}), weight ${use.weight} (${use.weightFrom})`,
    `     large text starts at ${bar}, and ${TOKEN} is legal only there.`,
    `     It measures 3.83 against the glass and owes 4.5 at this size. Use ${REPLACEMENT}.`,
  ];
}

function main(argv: string[]): number {
  const report = analyse(readSources());
  const failed = report.offenders.length > 0 || report.problems.length > 0;

  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return failed ? 1 : 0;
  }

  process.stdout.write('\n');
  for (const use of report.offenders) process.stdout.write(`${describe(use).join('\n')}\n\n`);
  for (const problem of report.problems) {
    process.stdout.write(`unjudgeable  ${problem.file}  line ${problem.line}\n     ${problem.detail}\n\n`);
  }
  for (const declared of report.declaredAs) {
    process.stdout.write(`${TOKEN} is declared as \`${declared.value}\` in ${declared.file}.\n`);
  }
  process.stdout.write(
    `${report.filesScanned} file(s), ${report.rulesParsed} rule(s): ${report.textUses} text use(s) of `
    + `${TOKEN} (${report.legal.length} large enough, ${report.offenders.length} not), and `
    + `${report.nonTextUses} non-text use(s), which owe 3:1 and are fine.\n`,
  );
  for (const hit of report.unjudged) {
    process.stdout.write(`not judged: ${hit.what}, ${hit.file} line ${hit.line}.\n`);
  }

  if (!failed) {
    process.stdout.write(`no ${TOKEN} on text below large-text size.\n`);
    return 0;
  }
  process.stdout.write(
    `\n${report.offenders.length} rule(s) apply ${TOKEN} to text too small for it, and `
    + `${report.problems.length} could not be judged. Both fail.\n`,
  );
  return 1;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  process.exit(main(process.argv.slice(2)));
}
