/**
 * **THE FORM IS THE TEMPLATE.**
 *
 * D41 spec §11.3, `plan:store seq:3` Task 10. The governing item says it in
 * one sentence and this module is the whole of what it asks for:
 *
 * > *A prohibition's form has a `why` field and will not save without one,
 * > **from the same table the schema and the check read**. Three things that
 * > can drift are one thing.*
 *
 * So there is **no field list in this file.** `renderForm` walks
 * `partsOf(kind)` and draws one control per part, labelled with that part's
 * own `asks`; `saveFromForm` composes the entry with `composeEntry` — which
 * also walks `partsOf` — and then validates it by handing it to `parseEntry`,
 * the same function the loader uses. A part added to `TEMPLATE` appears in the
 * form, is written to disk and is required at save with no edit here; a part
 * renamed there is renamed here.
 *
 * **And the refusal is the SCHEMA'S refusal, verbatim.** `saveFromForm`
 * returns `parseEntry`'s own sentence rather than composing a friendlier one,
 * because a second sentence is a second validator wearing a nicer face: the
 * day the two disagree, the form says one thing and the store does another and
 * only one of them is what actually loads. `test/rules/maintenance-form.test.ts`
 * asserts the two strings are equal, character for character.
 *
 * ── WHAT THE FORM ADDS THAT THE TABLE DOES NOT HOLD ────────────────────────
 *
 * The FRAME — `id`, `title`, `kind`, `tier` — and the optional fields
 * `request`, `movedFrom`, `movedOn` and `body`. These are not parts of any
 * kind's template; they are what every entry carries regardless of kind, and
 * `parseEntry` names them in its own `FRAME`/`OPTIONAL` constants. They are
 * listed here because a form has to draw them, and they are drawn in a
 * separate pass from the parts so that the part pass has nothing in it but the
 * table.
 *
 * **Every one of them has to be drawn, and that is not a style choice.**
 * `saveFromForm` composes a WHOLE entry from what was posted, so a field the
 * form does not draw is a field the next save deletes — silently, on an edit
 * about something else. `test/rules/maintenance-form.test.ts` holds that for
 * `movedFrom` and `movedOn`, which `deliver.ts` reads to decide whether a
 * reader is told where an entry came from.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { writeEntry } from '../../../rules/manifest.ts';
import {
  KINDS, TIERS, composeEntry, parseEntry, partsOf,
  type Kind, type Tier,
} from '../../../rules/schema.ts';
import { escapeHtml } from './page.ts';

/**
 * The one thing an entry id may be: a file-name slug.
 *
 * It is a REFUSAL rather than a sanitisation, because silently rewriting
 * somebody's id produces an entry filed under a name they did not choose and
 * cannot find. It is also what keeps a POSTed id from naming a path — the tool
 * writes `<id>.md` into the store directory and nowhere else.
 */
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface RenderFormOptions {
  kind: Kind;
  /** What the controls are pre-filled with, by control name. */
  values: Record<string, string>;
  /** Where the form POSTs. */
  action: string;
  /** A refusal to show above the fields — the schema's own words. */
  error?: string;
  /** Set when editing: the id is fixed and shown read-only. */
  editing?: boolean;
}

function control(
  name: string, label: string, asks: string, tag: 'input' | 'textarea', value: string,
  extra = '',
): string {
  const id = `f-${name}`;
  const head = `<label for="${escapeHtml(id)}">${escapeHtml(label)}`
    + (asks === '' ? '' : `<span class="asks">${escapeHtml(asks)}</span>`)
    + '</label>';
  return tag === 'textarea'
    ? `${head}<textarea id="${escapeHtml(id)}" name="${escapeHtml(name)}"${extra}>${escapeHtml(value)}</textarea>`
    : `${head}<input id="${escapeHtml(id)}" name="${escapeHtml(name)}" value="${escapeHtml(value)}"${extra}>`;
}

function select(
  name: string, label: string, asks: string, options: readonly string[], value: string,
): string {
  const id = `f-${name}`;
  const head = `<label for="${escapeHtml(id)}">${escapeHtml(label)}`
    + (asks === '' ? '' : `<span class="asks">${escapeHtml(asks)}</span>`)
    + '</label>';
  const body = options.map((option) =>
    `<option value="${escapeHtml(option)}"${option === value ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('');
  return `${head}<select id="${escapeHtml(id)}" name="${escapeHtml(name)}">${body}</select>`;
}

/**
 * One form for one kind.
 *
 * The `kind` control reloads the form rather than submitting it — choosing a
 * kind CHANGES WHICH PARTS EXIST, so a form that kept yesterday's fields after
 * the kind changed would be offering a template that no longer applies. It is
 * a link-shaped choice on the new-entry screen and fixed once an entry exists,
 * because changing an existing entry's kind silently discards the parts the
 * old kind required.
 */
export function renderForm(options: RenderFormOptions): string {
  const { kind, values, action } = options;
  const value = (name: string): string => values[name] ?? '';
  const blocks: string[] = [];

  if (options.error !== undefined) {
    blocks.push(`<p class="refusal" id="refusal">${escapeHtml(options.error)}</p>`);
  }

  blocks.push(`<form method="post" action="${escapeHtml(action)}">`);
  blocks.push(`<input type="hidden" name="kind" value="${escapeHtml(kind)}">`);
  blocks.push(control(
    'id', 'id', 'lowercase words joined by hyphens — this is how the entry is cited',
    'input', value('id'), options.editing === true ? ' readonly' : '',
  ));
  blocks.push(control('title', 'title', 'one line, in plain words', 'input', value('title')));
  blocks.push(select(
    'tier', 'tier',
    'product reaches every user; developer applies only inside my_context itself',
    TIERS, value('tier') === '' ? 'developer' : value('tier'),
  ));

  /**
   * **The part pass, and there is nothing in it but the table.** Every line
   * below reads `part` — a name, a label and a shape that came from
   * `TEMPLATE`. This loop is the whole reason the form cannot disagree with
   * the schema.
   */
  for (const part of partsOf(kind)) {
    blocks.push(control(
      part.name, part.name, part.asks, 'textarea', value(part.name),
      part.shape === 'list' ? ' data-shape="list" placeholder="one step per line"' : '',
    ));
  }

  blocks.push(control(
    'request', 'request (optional)',
    'the owner’s own words, verbatim — recorded, never injected (spec §6)',
    'textarea', value('request'),
  ));
  /**
   * **Drawn because a field the form does not draw is a field the next save
   * DELETES** — `saveFromForm` composes a whole entry out of what was posted,
   * so an unrendered field survives exactly until somebody edits the entry for
   * an unrelated reason. That is the same argument that puts `request` above.
   *
   * It matters twice over here: `deliver.ts` reads `movedFrom` to decide
   * whether the reader is told where an entry came from (developer yes,
   * product no — owner's ruling, 2026-09-11), so losing it does not merely
   * lose a note, it silently withdraws a developer entry's provenance from
   * every session in this repository.
   */
  blocks.push(control(
    'movedFrom', 'movedFrom (optional)',
    'the corpus item this entry was moved out of, if it was — shown only to the developer tier',
    'input', value('movedFrom'),
  ));
  blocks.push(control(
    'movedOn', 'movedOn (optional)', 'the day of that move, YYYY-MM-DD',
    'input', value('movedOn'),
  ));
  blocks.push(control(
    'body', 'body (optional)', 'the prose under the frontmatter', 'textarea', value('body'),
  ));
  blocks.push('<button type="submit" id="save">save</button>');
  blocks.push('</form>');
  return blocks.join('\n');
}

export type SaveResult =
  | { ok: true; id: string; file: string }
  | { ok: false; error: string };

/** `application/x-www-form-urlencoded` into a flat record. */
export function parseFormBody(body: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(body)) values[key] = value;
  return values;
}

/**
 * The file one id lives in, or `null`.
 *
 * Found by PARSING rather than by assuming `<id>.md`: an entry's id is a field
 * and the file name is a convention, and a lookup that trusted the convention
 * would fail to find an entry somebody renamed the file of — silently creating
 * a second file claiming the same id, which `loadRules` then refuses as a
 * duplicate.
 */
export function fileOf(dir: string, id: string): string | null {
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const parsed = parseEntry(readFileSync(path.join(dir, name), 'utf8'), path.join(dir, name));
    if ('error' in parsed ? parsed.id === id : parsed.id === id) return name;
  }
  return null;
}

/**
 * Save what the form posted, or refuse in the schema's own words.
 *
 * Nothing is written on a refusal. That is worth stating because the obvious
 * implementation — write, then validate, then delete — leaves a window in
 * which the store holds an entry the form rejected, and this project has
 * already found one place where a failed write left a half-state behind.
 */
export function saveFromForm(dir: string, values: Record<string, string>): SaveResult {
  const id = (values.id ?? '').trim();
  if (!ID.test(id)) {
    return {
      ok: false,
      error: `\`id\` must be lowercase words joined by hyphens (got ${JSON.stringify(id)}). ` +
        `It is how the entry is cited and it is also its file name, so it may not contain a ` +
        `path separator, a space or a capital.`,
    };
  }
  const kind = (values.kind ?? '').trim();
  if (!(KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: `\`kind\` must be one of ${KINDS.join(', ')} (got ${JSON.stringify(kind)}).` };
  }
  const tier = (values.tier ?? '').trim();
  if (!(TIERS as readonly string[]).includes(tier)) {
    return { ok: false, error: `\`tier\` must be one of ${TIERS.join(', ')} (got ${JSON.stringify(tier)}).` };
  }

  const parts: Record<string, string | undefined> = {};
  for (const part of partsOf(kind as Kind)) {
    const raw = values[part.name];
    if (raw === undefined || raw.trim() === '') continue;
    parts[part.name] = raw;
  }

  const text = composeEntry({
    id,
    kind: kind as Kind,
    tier: tier as Tier,
    title: (values.title ?? '').trim(),
    parts,
    ...(values.request === undefined || values.request.trim() === ''
      ? {} : { request: values.request }),
    ...(values.movedFrom === undefined || values.movedFrom.trim() === ''
      ? {} : { movedFrom: values.movedFrom }),
    ...(values.movedOn === undefined || values.movedOn.trim() === ''
      ? {} : { movedOn: values.movedOn }),
    ...(values.body === undefined ? {} : { body: values.body }),
  });

  const file = `${id}.md`;
  const parsed = parseEntry(text, path.join(dir, file));
  // THE refusal, and it is `parseEntry`'s rather than a second one that agrees.
  if ('error' in parsed) return { ok: false, error: parsed.error };

  const existing = fileOf(dir, id);
  writeEntry(dir, existing ?? file, text);
  return { ok: true, id, file: existing ?? file };
}

export type TierResult = { ok: true; file: string } | { ok: false; error: string };

/**
 * **Demotion and promotion — spec §10's "removal is demotion ... reversibly".**
 *
 * It edits the ONE LINE, rather than re-composing the file from its parsed
 * parts. Re-composing would reformat prose the owner wrote — re-wrapping a
 * quotation, re-quoting a string, dropping a blank line — so a demotion and a
 * promotion would not return the file to the bytes it started with, and
 * "reversibly" would be true of the tier and false of the entry.
 */
export function moveTier(dir: string, id: string, tier: Tier): TierResult {
  if (!(TIERS as readonly string[]).includes(tier)) {
    return { ok: false, error: `\`tier\` must be one of ${TIERS.join(', ')} (got ${JSON.stringify(tier)}).` };
  }
  const file = fileOf(dir, id);
  if (file === null) return { ok: false, error: `no entry "${id}" in ${dir}.` };

  const text = readFileSync(path.join(dir, file), 'utf8');
  const fence = /^(---\r?\n)([\s\S]*?)(\r?\n---)/.exec(text);
  if (fence === null) return { ok: false, error: `${file} has no frontmatter to move.` };
  const moved = fence[2].replace(/^tier:[ \t]*.*$/m, `tier: ${tier}`);
  if (moved === fence[2] && !new RegExp(`^tier:[ \\t]*${tier}\\s*$`, 'm').test(moved)) {
    return { ok: false, error: `${file} states no \`tier\`, so there is nothing to move.` };
  }
  const next = text.slice(0, fence[1].length) + moved + text.slice(fence[1].length + fence[2].length);

  const parsed = parseEntry(next, path.join(dir, file));
  if ('error' in parsed) return { ok: false, error: parsed.error };
  writeEntry(dir, file, next);
  return { ok: true, file };
}
