#!/usr/bin/env node
/**
 * **No module may restate, through the CSSOM, a declaration `styles.css`
 * already owns for a selector that element matches.**
 *
 * ── THE GATE `styles-parity` CANNOT BE ─────────────────────────────────────
 *
 * `styles-parity` compares the mockup's rule bodies against `styles.css` byte
 * for byte. It is blind, by construction, to a THIRD copy of the same
 * declarations applied at runtime through `el.style` — which outranks both of
 * the files it compares. So the gate can be green, the stylesheet can be
 * correct, and the screen can be wrong, all at once.
 *
 * That is not a hypothetical. `screens/decay.js` carried a CSSOM copy of
 * `svg.chart{…}` and `svg.chart text.mono{…}`, justified by a comment saying
 * the shell's stylesheet had no `svg.chart` block. The block landed on
 * 2026-08-23; the copy outlived its own reason by six days and defeated two
 * separate fixes in one day:
 *
 *   `plan:walk seq:62`  the four chart type sizes were restored behind new
 *                       tokens. The comb's inline `font-size` won, so it alone
 *                       would have kept the large type while every other chart
 *                       shrank.
 *   `plan:walk seq:47`  `svg.chart` moved `inline-size:100%` →
 *                       `max-inline-size:100%`. The comb's inline
 *                       `inline-size:100%` won: staircase 1.000, ego graph
 *                       1.000, comb **1.267**. Green stylesheet, wrong page.
 *
 * Both were caught by a person opening the screen. This file is the attempt to
 * stop needing that.
 *
 * ── THE LINE: A DYNAMIC VALUE IS NOT A RESTATEMENT ─────────────────────────
 *
 * **Inline style is not the defect and is not banned here.** Charts set
 * per-datum geometry at runtime and always will — `bar.style.setProperty(
 * 'inline-size', `${pct}%`)` is a number that exists only once the data has
 * been read, and no stylesheet can hold it. A check that flagged those would
 * be a check people mute.
 *
 * The defect is narrower and is entirely mechanical: **a STATIC literal, equal
 * to what the stylesheet already declares for a selector the element matches.**
 * Both halves are load-bearing.
 *
 *   - STATIC, because a value computed from data cannot be in a stylesheet and
 *     so cannot be a duplicate of one. Anything that is not a bare string or a
 *     template with no `${}` is passed and counted as `dynamic`.
 *   - EQUAL, because an inline value that DIFFERS from the sheet's is a
 *     deliberate local override — the mockup's own `style="margin-block-start:
 *     10px"` on a `.small` that the sheet spaces differently — and deleting it
 *     would change the page. Those are reported under `overrides` for a reader
 *     and are never failures.
 *
 * What is left, when both halves hold, is a declaration that changes NOTHING
 * today and can only ever do one thing: silently win the next time somebody
 * edits the stylesheet. There is no version of that which is worth keeping,
 * which is why this can be a gate rather than a lint with a mute list.
 *
 * `direction:ltr` on a chart root is the worked example of what passes. No
 * rule in `styles.css` gives an `svg.chart` a direction, so there is nothing
 * to be equal to — and `screens/simulate.js` sets exactly the same line for
 * exactly the same reason. It is a value the stylesheet does not own, not a
 * copy of one it does.
 *
 * ── WHAT THIS CHECKER CANNOT DO, SAID PLAINLY ──────────────────────────────
 *
 * A green run should not be read as more than it is.
 *
 *   - **It matches the selector's RIGHTMOST COMPOUND, never its ancestors.**
 *     For `svg.chart text.mono` it verifies that the element is a `text` with
 *     class `mono`; it does not verify that a `svg.chart` is above it. This is
 *     the one place a false positive could live, and the value-equality half
 *     is what makes it survivable: to be flagged wrongly, code would have to
 *     set, on a matching compound, the exact value the sheet sets for that
 *     compound, and be outside the ancestor. If that ever happens, the honest
 *     fix is to name the class the sheet does not reach — not to mute this.
 *   - **It resolves the element from the file's own two factories** — `el(tag,
 *     classes)` and each screen's local `sv(tag, {class})` — plus
 *     `document.createElement`/`createElementNS`, and any later `className`,
 *     `classList.add` or `setAttribute('class', …)` on the same name. A target
 *     it cannot resolve (a function parameter, a member expression) is
 *     reported under `unjudged` and never failed. Unjudged is a hole, and it
 *     is printed so the hole is visible rather than silent.
 *   - **It judges SOURCE, not the page.** `e2e/chart-css-authority.spec.ts` is
 *     the other half: it drives the stylesheet at runtime and asserts every
 *     chart follows it. This file cannot see a restatement built by string
 *     concatenation; that spec can, because it measures the rendered element.
 *   - **It says nothing about `styles.css` being right.** It only says nothing
 *     is secretly outranking it.
 *
 * Zero dependencies, erasable syntax only, run by Node from source — the same
 * constraints as `src/`. The stylesheet parser is
 * `scripts/check-faint-usage.ts`'s, reused rather than rewritten: a second CSS
 * parser in this repository would be a second thing to be wrong.
 *
 * The gate is `test/ui/cssom-restatement.test.ts`, which runs inside
 * `npm test` and carries the positive controls that prove this can still fail.
 * There is deliberately no eighth `npm run check:*` entry, for the reason
 * `check-faint-usage.ts` already gives: the seven-gate list is written down in
 * several places, and a rule already inside `npm test` does not need its own
 * script to have teeth.
 *
 * Usage:
 *   node scripts/check-cssom-restatement.ts          report, exit 1 on any offender
 *   node scripts/check-cssom-restatement.ts --json   the same report, machine-readable
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseStylesheet } from './check-faint-usage.ts';
import type { Rule } from './check-faint-usage.ts';

const REPO = path.resolve(import.meta.dirname, '..');

/** The tree whose modules are judged. */
export const SCANNED_DIR = 'src/ui/public';
/** The one stylesheet that owns this tree's static presentation. */
export const STYLESHEET = 'src/ui/public/styles.css';

export interface Module { file: string; text: string }

export type Form = 'setProperty' | 'assignment' | 'cssText';

/** One CSSOM write found in a module. */
export interface Write {
  file: string;
  line: number;
  /** The identifier written through, e.g. `svg` in `svg.style.setProperty(…)`. */
  target: string;
  /** Kebab-case property, or `null` when the property itself is computed. */
  property: string | null;
  /** The literal value, or `null` when the value is computed. */
  value: string | null;
  form: Form;
  raw: string;
}

/** What a target was resolved to, as far as the file says. */
export interface Element {
  tag: string | null;
  classes: string[];
  /** The construction this was read from, for the report. */
  from: string;
}

export interface Offender {
  file: string;
  line: number;
  target: string;
  element: string;
  property: string;
  value: string;
  /** The stylesheet selector that already says it. */
  selector: string;
  sheetLine: number;
  at: string[];
}

/** A static write the sheet also declares, with a DIFFERENT value. Never a failure. */
export interface Override extends Omit<Offender, 'value'> {
  value: string;
  sheetValue: string;
}

export interface Unjudged {
  file: string;
  line: number;
  what: string;
  why: string;
}

export interface Report {
  modulesScanned: number;
  rulesParsed: number;
  /** Every CSSOM write seen, however classified. */
  writes: number;
  /** Writes whose value or property is computed — legitimate by construction. */
  dynamic: number;
  /** Static writes of a property the stylesheet never declares for this element. */
  unowned: number;
  overrides: Override[];
  unjudged: Unjudged[];
  offenders: Offender[];
}

/* ── reading the tree ─────────────────────────────────────────────────────── */

/**
 * **`lib/vendor/` is not scanned, and the reason is the checker's own claim.**
 *
 * What this file asserts is that no module OF OURS restates, through the CSSOM,
 * a declaration `styles.css` already owns for a selector that element matches.
 * All three halves of that fail over a vendored component:
 *
 *   - it is not ours, and the one repair this checker offers — "delete the
 *     write" — is the one thing `VENDOR.md` says a vendored file never gets;
 *   - its writes land inside its own SHADOW ROOT, which no selector in
 *     `styles.css` can reach, so there is no rule for them to restate. Web
 *     Awesome's `wa-tree-item` sets `--indent` on itself per nesting level:
 *     a value that exists only once the DOM has been walked, and the exact
 *     shape this file calls `dynamic` and passes;
 *   - and it is already gated, harder, by `scripts/check-vendor.ts` — byte
 *     count, SHA-256, a closed import graph and the `FORBIDDEN` scan.
 *
 * Scanning it produced one `unjudged` entry, which is the worst of both
 * outcomes: a hole reported against a file nobody may edit. Excluded by
 * DIRECTORY rather than by silencing the finding, so the exclusion is visible
 * here and the checker keeps reporting every hole it has in code we write.
 */
const NOT_OURS = 'vendor';

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== NOT_OURS) walk(full, out);
    } else if (entry.name.endsWith('.js')) out.push(full);
  }
}

export function readModules(): Module[] {
  const roots: string[] = [];
  walk(path.join(REPO, SCANNED_DIR), roots);
  return roots.map((full) => ({
    file: path.relative(REPO, full).replaceAll('\\', '/'),
    text: readFileSync(full, 'utf8'),
  }));
}

export function readStylesheet(): string {
  return readFileSync(path.join(REPO, STYLESHEET), 'utf8');
}

/* ── the stylesheet, as (compound, property, value) ───────────────────────── */

/** A selector's rightmost compound, decomposed — or `null` when unjudgeable. */
export interface Compound {
  tag: string | null;
  classes: string[];
}

/**
 * `svg.chart text.mono` → `{tag:'text', classes:['mono']}`.
 *
 * `null` when the compound cannot be read at all — an id, an attribute, a
 * pseudo — and **`null` for a bare tag under a combinator**, which is the rule
 * that keeps this checker honest.
 *
 * `.ladder > div{display:flex}` has a rightmost compound of `div`, and every
 * `<div>` in the tree matches it. Judged that way, `screens/preview.js`'s event
 * bar — a plain `<div>` on a different screen entirely, laid out with the
 * mockup's own `style=` declarations — was reported as restating a rule from
 * the admission staircase it has never been inside. That is the false positive
 * this whole check has to not have, so an ancestor-qualified selector must
 * name a CLASS on its own last compound to be judged at all: `text.mono`
 * qualifies, `div` does not. `svg.chart` still qualifies as a single compound,
 * where there is no ancestor left unverified.
 */
export function rightmostCompound(selector: string): Compound | null {
  const parts = selector.split(' ').filter((p) => p.length > 0);
  const last = parts[parts.length - 1];
  if (last === undefined || last === '>' || last === '+' || last === '~') return null;
  if (/[#[:%&*]/.test(last)) return null;
  const m = /^([a-zA-Z][\w-]*)?((?:\.[\w-]+)*)$/.exec(last);
  if (m === null) return null;
  const classes = (m[2] ?? '').split('.').filter((c) => c.length > 0);
  const tag = m[1] === undefined ? null : m[1].toLowerCase();
  if (classes.length === 0 && (tag === null || parts.length > 1)) return null;
  return { tag, classes };
}

export interface Declared {
  selector: string;
  compound: Compound;
  property: string;
  value: string;
  line: number;
  at: string[];
}

/** Whitespace-flattened, `!important` dropped, lowercased — for comparison only. */
export function normaliseValue(value: string): string {
  return value.replace(/!\s*important\s*$/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function declarations(rules: Rule[]): Declared[] {
  const out: Declared[] = [];
  for (const rule of rules) {
    for (const selector of rule.selectors) {
      const compound = rightmostCompound(selector);
      if (compound === null) continue;
      for (const decl of rule.declarations) {
        if (decl.property.startsWith('--')) continue;
        out.push({
          selector,
          compound,
          property: decl.property,
          value: normaliseValue(decl.value),
          line: decl.line,
          at: rule.at,
        });
      }
    }
  }
  return out;
}

/* ── reading the modules ──────────────────────────────────────────────────── */

/**
 * The text with every comment blanked to spaces, same length, newlines kept.
 *
 * Not an optimisation. `screens/doctor.js` quotes another file's
 * `e.style.setProperty('margin-block-start', '8px')` inside a comment, and a
 * scanner that read it would report a line that does not execute.
 */
export function maskComments(text: string): string {
  let out = '';
  let i = 0;
  const blank = (s: string): string => s.replace(/[^\n]/g, ' ');
  while (i < text.length) {
    const c = text[i]!;
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += blank(text.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? text.length : end;
      out += blank(text.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === c) { j += 1; break; }
        j += 1;
      }
      out += text.slice(i, j);
      i = j;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function lineAt(text: string, offset: number): number {
  let n = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) if (text[i] === '\n') n += 1;
  return n;
}

/** The literal a value expression is, or `null` when it is computed. */
export function literal(expression: string): string | null {
  const e = expression.trim();
  const quoted = /^'([^'\\]*)'$/.exec(e) ?? /^"([^"\\]*)"$/.exec(e);
  if (quoted !== null) return quoted[1] ?? '';
  const template = /^`([^`\\$]*)`$/.exec(e);
  if (template !== null) return template[1] ?? '';
  return null;
}

/** `blockSize` → `block-size`. The CSSOM's camel form is the same property. */
export function kebab(property: string): string {
  return property.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
}

/** Split a call's argument list at top-level commas. */
function splitArgs(source: string, open: number): { args: string[]; end: number } | null {
  const args: string[] = [];
  let depth = 0;
  let start = open + 1;
  let i = open;
  while (i < source.length) {
    const c = source[i]!;
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === '\\') { j += 2; continue; }
        if (source[j] === c) { j += 1; break; }
        j += 1;
      }
      i = j;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
      if (depth === 0) {
        args.push(source.slice(start, i));
        return { args, end: i };
      }
    } else if (c === ',' && depth === 1) {
      args.push(source.slice(start, i));
      start = i + 1;
    }
    i += 1;
  }
  return null;
}

const TARGET = '[A-Za-z_$][\\w$]*';

export function writes(module: Module): Write[] {
  const src = maskComments(module.text);
  const out: Write[] = [];

  for (const m of src.matchAll(new RegExp(`(${TARGET})\\.style\\.setProperty\\(`, 'g'))) {
    const open = (m.index ?? 0) + m[0].length - 1;
    const call = splitArgs(src, open);
    if (call === null) continue;
    const prop = literal(call.args[0] ?? '');
    const value = call.args.length > 1 ? literal(call.args[1] ?? '') : null;
    out.push({
      file: module.file,
      line: lineAt(src, m.index ?? 0),
      target: m[1] ?? '',
      property: prop === null ? null : kebab(prop.trim().toLowerCase()),
      value,
      form: 'setProperty',
      raw: src.slice(m.index ?? 0, call.end + 1).replace(/\s+/g, ' '),
    });
  }

  for (const m of src.matchAll(new RegExp(`(${TARGET})\\.style\\.([A-Za-z][\\w]*)\\s*=\\s*([^;\\n]+)`, 'g'))) {
    const property = m[2] ?? '';
    const expression = (m[3] ?? '').trim();
    if (property === 'cssText') {
      out.push({
        file: module.file,
        line: lineAt(src, m.index ?? 0),
        target: m[1] ?? '',
        property: null,
        value: literal(expression),
        form: 'cssText',
        raw: (m[0] ?? '').replace(/\s+/g, ' '),
      });
      continue;
    }
    out.push({
      file: module.file,
      line: lineAt(src, m.index ?? 0),
      target: m[1] ?? '',
      property: kebab(property),
      value: literal(expression),
      form: 'assignment',
      raw: (m[0] ?? '').replace(/\s+/g, ' '),
    });
  }

  return out.sort((a, b) => a.line - b.line);
}

/* ── what an identifier was made into ─────────────────────────────────────── */

/**
 * The element `name` holds at `offset`, read from the nearest preceding
 * construction in the same file.
 *
 * The two factories this tree builds elements with are `el(tag, classes)` from
 * `screens/parts.js` and each chart screen's local `sv(tag, attrs)`; raw
 * `document.createElement` is the third. Nothing else is guessed: an
 * unrecognised construction resolves to `null`, which reports the site as
 * unjudged rather than passing it.
 */
export function resolveElement(src: string, name: string, offset: number): Element | null {
  const escaped = name.replace(/[$]/g, '\\$&');
  const patterns: { re: RegExp; read: (m: RegExpExecArray) => Element | null }[] = [
    {
      re: new RegExp(`\\b(?:const|let|var)\\s+${escaped}\\s*=\\s*el\\(`, 'g'),
      read: (m) => {
        const call = splitArgs(src, m.index + m[0].length - 1);
        if (call === null) return null;
        const tag = literal(call.args[0] ?? '');
        if (tag === null) return null;
        const classes = call.args.length > 1 ? literal(call.args[1] ?? '') : '';
        return {
          tag: tag.toLowerCase(),
          classes: (classes ?? '').split(/\s+/).filter((c) => c.length > 0),
          from: `el('${tag}'${classes === null || classes === '' ? '' : `, '${classes}'`})`,
        };
      },
    },
    {
      re: new RegExp(`\\b(?:const|let|var)\\s+${escaped}\\s*=\\s*sv\\(`, 'g'),
      read: (m) => {
        const call = splitArgs(src, m.index + m[0].length - 1);
        if (call === null) return null;
        const tag = literal(call.args[0] ?? '');
        if (tag === null) return null;
        const attrs = call.args.slice(1).join(',');
        const cls = /(?:^|[\s{,])class\s*:\s*(['"`])([^'"`]*)\1/.exec(attrs);
        return {
          tag: tag.toLowerCase(),
          classes: (cls?.[2] ?? '').split(/\s+/).filter((c) => c.length > 0),
          from: `sv('${tag}'${cls === null ? '' : `, {class:'${cls[2]}'}`})`,
        };
      },
    },
    {
      re: new RegExp(`\\b(?:const|let|var)\\s+${escaped}\\s*=\\s*document\\.createElement(?:NS)?\\(`, 'g'),
      read: (m) => {
        const call = splitArgs(src, m.index + m[0].length - 1);
        if (call === null) return null;
        const tag = literal(call.args[call.args.length - 1] ?? '');
        if (tag === null) return null;
        return { tag: tag.toLowerCase(), classes: [], from: `createElement('${tag}')` };
      },
    },
  ];

  let best: Element | null = null;
  let bestAt = -1;
  for (const { re, read } of patterns) {
    for (let m = re.exec(src); m !== null; m = re.exec(src)) {
      if (m.index > offset || m.index < bestAt) continue;
      const element = read(m);
      if (element === null) continue;
      best = element;
      bestAt = m.index;
    }
  }
  if (best === null) return null;

  // Classes the file adds to the same name afterwards, wherever it does it.
  const extra = new Set(best.classes);
  const add = new RegExp(
    `\\b${escaped}\\.(?:className\\s*=\\s*(['"\`])([^'"\`]*)\\1`
    + `|classList\\.add\\(([^)]*)\\)`
    + `|setAttribute\\(\\s*['"]class['"]\\s*,\\s*(['"\`])([^'"\`]*)\\4\\s*\\))`,
    'g',
  );
  for (let m = add.exec(src); m !== null; m = add.exec(src)) {
    const words = `${m[2] ?? ''} ${(m[3] ?? '').replaceAll(/['"`,]/g, ' ')} ${m[5] ?? ''}`;
    for (const c of words.split(/\s+/)) if (c.length > 0) extra.add(c);
  }
  return { tag: best.tag, classes: [...extra], from: best.from };
}

export function matches(element: Element, compound: Compound): boolean {
  if (compound.tag !== null && compound.tag !== element.tag) return false;
  return compound.classes.every((c) => element.classes.includes(c));
}

function describe(element: Element): string {
  return `${element.tag ?? '*'}${element.classes.map((c) => `.${c}`).join('')}`;
}

/* ── the judgement ────────────────────────────────────────────────────────── */

export function analyse(modules: Module[], css: string): Report {
  const rules = parseStylesheet({ file: STYLESHEET, text: css });
  const declared = declarations(rules);
  const report: Report = {
    modulesScanned: modules.length,
    rulesParsed: rules.length,
    writes: 0,
    dynamic: 0,
    unowned: 0,
    overrides: [],
    unjudged: [],
    offenders: [],
  };

  for (const module of modules) {
    const src = maskComments(module.text);
    for (const write of writes(module)) {
      report.writes += 1;
      if (write.form === 'cssText') {
        report.unjudged.push({
          file: write.file,
          line: write.line,
          what: write.raw,
          why: 'cssText replaces a whole declaration block; this checker judges one property at '
            + 'a time and will not guess at a block. If a module ever needs it, teach this file '
            + 'to split it rather than exempting the line.',
        });
        continue;
      }
      if (write.property === null || write.value === null) {
        report.dynamic += 1;
        continue;
      }
      // The end of the write's own line: `resolveElement` takes the nearest
      // construction at or before this, so a name reassigned LATER in the file
      // cannot be the one judged.
      const at = src.split('\n').slice(0, write.line).join('\n').length;
      const element = resolveElement(src, write.target, at);
      if (element === null) {
        report.unjudged.push({
          file: write.file,
          line: write.line,
          what: write.raw,
          why: `\`${write.target}\` is not constructed by name in this file — a parameter or a `
            + 'member expression — so no selector can be matched against it.',
        });
        continue;
      }
      // **Scoped to UNCONDITIONAL declarations — `d.at.length === 0` — found
      // 2026-09-05 while adding this project's print register.** A rule
      // inside `@media print{}` (or any other feature query — reduced motion,
      // a width breakpoint) applies only when that condition holds; a
      // module's `el.style.setProperty(...)` applies whenever that line runs,
      // which on screen is every time. The two are not a restatement of one
      // another — the CONDITIONAL rule cannot make the UNCONDITIONAL write
      // redundant, since removing the write would leave nothing set for every
      // context the rule's own `@media` does not match. Measured: `styles.css`
      // gained `@media print{ .pane,.card{box-shadow:none!important…} }`, and
      // without this line `screens/palette.js`'s own on-screen
      // `globCard.style.setProperty('box-shadow', 'none')` — unrelated to
      // print, matching the mockup's own nested-card style — was flagged as a
      // redundant restatement of a rule that, in truth, only ever fires at
      // print time.
      const owned = declared.filter(
        (d) => d.at.length === 0 && d.property === write.property && matches(element, d.compound),
      );
      if (owned.length === 0) {
        report.unowned += 1;
        continue;
      }
      const value = normaliseValue(write.value);
      const same = owned.find((d) => d.value === value);
      const base = {
        file: write.file,
        line: write.line,
        target: write.target,
        element: describe(element),
        property: write.property,
      };
      if (same !== undefined) {
        report.offenders.push({
          ...base,
          value,
          selector: same.selector,
          sheetLine: same.line,
          at: same.at,
        });
      } else {
        const first = owned[0]!;
        report.overrides.push({
          ...base,
          value,
          sheetValue: first.value,
          selector: first.selector,
          sheetLine: first.line,
          at: first.at,
        });
      }
    }
  }
  return report;
}

/* ── the report ───────────────────────────────────────────────────────────── */

export function render(report: Report): string {
  const lines: string[] = [];
  lines.push(
    `scanned ${report.modulesScanned} modules under ${SCANNED_DIR} against `
    + `${report.rulesParsed} rules in ${STYLESHEET}`,
  );
  lines.push(
    `${report.writes} CSSOM writes: ${report.dynamic} dynamic, ${report.unowned} of a property `
    + `the stylesheet does not give this element, ${report.overrides.length} deliberate `
    + `overrides, ${report.unjudged.length} unjudged, ${report.offenders.length} restatements`,
  );
  if (report.overrides.length > 0) {
    lines.push('', 'overrides — a different value from the sheet\'s, so deleting one would change the page:');
    for (const o of report.overrides) {
      lines.push(
        `  ${o.file}:${o.line}  ${o.element}  ${o.property}: ${o.value}   `
        + `(${STYLESHEET}:${o.sheetLine} \`${o.selector}\` says ${o.sheetValue})`,
      );
    }
  }
  if (report.unjudged.length > 0) {
    lines.push('', 'unjudged — holes in this check, printed so they are visible:');
    for (const u of report.unjudged) lines.push(`  ${u.file}:${u.line}  ${u.what}\n      ${u.why}`);
  }
  if (report.offenders.length > 0) {
    lines.push('', 'RESTATEMENTS — the stylesheet already says exactly this, and the inline copy outranks it:');
    for (const o of report.offenders) {
      lines.push(
        `  ${o.file}:${o.line}  ${o.element}  ${o.property}: ${o.value}`,
        `      ${STYLESHEET}:${o.sheetLine} \`${o.selector}\``
        + `${o.at.length > 0 ? ` (inside ${o.at.join(' ')})` : ''}`,
        '      Delete the write. It changes nothing today and will silently beat the next edit'
        + ' to that rule.',
      );
    }
  }
  return lines.join('\n');
}

function main(): void {
  const report = analyse(readModules(), readStylesheet());
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${render(report)}\n`);
  }
  if (report.rulesParsed === 0) {
    process.stderr.write(
      `\n${STYLESHEET} parsed to zero rules. A checker that finds nothing agrees with a file `
      + 'that violates nothing — this is a parse failure, not a pass.\n',
    );
    process.exitCode = 1;
    return;
  }
  if (report.offenders.length > 0) process.exitCode = 1;
}

if (process.argv[1] !== undefined && import.meta.filename === path.resolve(process.argv[1])) main();
