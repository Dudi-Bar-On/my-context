/**
 * **The maintenance tool's routes — one pure function from a request to an
 * answer.**
 *
 * D41 spec §11.3, `plan:store seq:3` Tasks 9–12. `server.ts` owns the socket
 * and nothing else; everything a request MEANS is decided here, and decided
 * synchronously from values. That split is what makes the tool testable
 * without a browser: `handle(ctx, 'POST', url, body)` is the same call the
 * socket makes, so a node test and a browser exercise one code path rather
 * than two that agree today.
 *
 * The browser is still where the work is verified — `e2e/rules-maintenance.spec.ts`
 * drives the real screens in real Chrome, under
 * `RULE-drive-the-ui-through-playwright-while-doing-the-work-not`. A pure
 * function is what makes the node half cheap; it is not evidence that a screen
 * works.
 *
 * ── A WRITE ANSWERS WITH A REDIRECT, NEVER WITH A PAGE ─────────────────────
 *
 * `RULE-a-screen-shows-the-new-state-after-the-reader-acts-on-it`: after the
 * reader acts, the screen shows the resulting state without being asked. Here
 * that is a 303 back to the screen they acted on, which also means a reload
 * after a save does not re-post the save. A refusal is the one case that
 * answers with a page, because the page is carrying the words they need and
 * the values they typed.
 */
import {
  budgetReport, planPublish, publishStore, type PublishPlan,
} from '../../rules/manifest.ts';
import { KINDS, partsOf, parseEntry, type Kind, type Tier } from '../../rules/schema.ts';
import { loadRules } from '../../rules/store.ts';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  fileOf, moveTier, parseFormBody, renderForm, saveFromForm,
} from './screens/form.ts';
import { renderList } from './screens/list.ts';
import { renderPublish } from './screens/publish.ts';
import { escapeHtml, nav, page } from './screens/page.ts';

export interface MaintenanceContext {
  /** The store being maintained. */
  storeDir: string;
  /** The `product` tier's recommended size, in bytes. Spec §10. */
  budgetBytes?: number;
}

export interface Answer {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export function html(status: number, body: string): Answer {
  return { status, headers: { 'content-type': 'text/html; charset=utf-8' }, body };
}

export function redirect(to: string): Answer {
  return { status: 303, headers: { location: to }, body: '' };
}

/**
 * The maintenance tool loads the store with the developer tier IN, always.
 *
 * `loadRules`'s second argument answers "is the workspace being worked on
 * my_context" — which is the right question at a DOOR and the wrong one here.
 * This screen's job is to show the owner everything the store holds, including
 * the entries a user will never see; filtering them out of the maintenance
 * tool would make the one surface that can move an entry between tiers unable
 * to see half of them.
 */
function set(ctx: MaintenanceContext): ReturnType<typeof loadRules> {
  return loadRules(ctx.storeDir, true);
}

function plan(ctx: MaintenanceContext): PublishPlan {
  return planPublish(ctx.storeDir, ctx.budgetBytes === undefined ? {} : { budgetBytes: ctx.budgetBytes });
}

function listScreen(ctx: MaintenanceContext, url: URL, error?: string): Answer {
  const loaded = set(ctx);
  const notice = url.searchParams.get('saved') ?? url.searchParams.get('moved');
  return html(error === undefined ? 200 : 400, renderList({
    entries: loaded.entries,
    refused: loaded.refused,
    budget: budgetReport(ctx.storeDir, ctx.budgetBytes),
    storeDir: ctx.storeDir,
    ...(notice === null ? {} : { notice }),
    ...(error === undefined ? {} : { error }),
  }));
}

function formScreen(
  ctx: MaintenanceContext, kind: Kind, values: Record<string, string>,
  heading: string, editing: boolean, error?: string,
): Answer {
  const chooser = editing
    ? ''
    : `<p class="lede">kind: ${KINDS.map((option) => option === kind
      ? `<strong>${escapeHtml(option)}</strong>`
      : `<a href="/new?kind=${encodeURIComponent(option)}">${escapeHtml(option)}</a>`).join(' · ')}`
      + ' — choosing a kind changes which parts the entry owes, so it reloads the form.</p>';
  const body = [
    nav(),
    `<h1>${escapeHtml(heading)}</h1>`,
    `<p class="lede">a <code>${escapeHtml(kind)}</code> owes `
    + `${partsOf(kind).map((part) => `<code>${escapeHtml(part.name)}</code>`).join(', ')}`
    + ' — the form below is that list, read from the same table the loader validates against.</p>',
    chooser,
    renderForm({ kind, values, action: '/save', editing, ...(error === undefined ? {} : { error }) }),
  ].join('\n');
  return html(error === undefined ? 200 : 400, page(heading, body));
}

function kindFrom(raw: string | null, fallback: Kind = 'fact'): Kind {
  return (KINDS as readonly string[]).includes(raw ?? '') ? (raw as Kind) : fallback;
}

/** The values one existing entry fills a form with. */
function valuesOf(dir: string, id: string): Record<string, string> | null {
  const file = fileOf(dir, id);
  if (file === null) return null;
  const parsed = parseEntry(readFileSync(path.join(dir, file), 'utf8'), path.join(dir, file));
  if ('error' in parsed) return null;
  const values: Record<string, string> = {
    id: parsed.id, kind: parsed.kind, tier: parsed.tier, title: parsed.title,
    body: parsed.body, request: parsed.request ?? '',
    // Carried through for the reason `form.ts` draws them: a value the form is
    // not filled with is a value the save writes back as absent.
    movedFrom: parsed.movedFrom ?? '', movedOn: parsed.movedOn ?? '',
  };
  for (const part of partsOf(parsed.kind)) {
    const value = parsed.parts[part.name];
    values[part.name] = Array.isArray(value) ? value.join('\n') : String(value ?? '');
  }
  return values;
}

export function handle(
  ctx: MaintenanceContext, method: string, url: URL, body: string,
): Answer {
  const route = url.pathname.replace(/\/+$/, '') || '/';

  // Answered rather than 404'd because a browser asks for it unprompted on
  // every navigation, and a console full of errors nobody caused is a console
  // people stop reading — found while driving this tool by hand.
  if (route === '/favicon.ico') return { status: 204, headers: {}, body: '' };

  if (method === 'GET' && route === '/') return listScreen(ctx, url);

  if (method === 'GET' && route === '/new') {
    const kind = kindFrom(url.searchParams.get('kind'));
    // Spec §3: a new entry defaults to `developer`. "The blast radius of a
    // misfiled developer rule is one workspace, and a misfiled product rule
    // ships to everyone."
    return formScreen(ctx, kind, { kind, tier: 'developer' }, `new ${kind}`, false);
  }

  if (method === 'GET' && route === '/edit') {
    const id = url.searchParams.get('id') ?? '';
    const values = valuesOf(ctx.storeDir, id);
    if (values === null) return listScreen(ctx, url, `no entry "${id}" in this store.`);
    return formScreen(ctx, values.kind as Kind, values, `edit ${id}`, true);
  }

  if (method === 'POST' && route === '/save') {
    const values = parseFormBody(body);
    const answer = saveFromForm(ctx.storeDir, values);
    if (answer.ok) {
      return redirect(`/?saved=${encodeURIComponent(`saved ${answer.id} to ${answer.file}.`)}`);
    }
    const editing = fileOf(ctx.storeDir, (values.id ?? '').trim()) !== null;
    return formScreen(
      ctx, kindFrom(values.kind ?? null), values,
      editing ? `edit ${values.id ?? ''}` : `new ${values.kind ?? 'entry'}`, editing, answer.error,
    );
  }

  if (method === 'POST' && route === '/tier') {
    const values = parseFormBody(body);
    const answer = moveTier(ctx.storeDir, (values.id ?? '').trim(), (values.tier ?? '') as Tier);
    if (!answer.ok) return listScreen(ctx, url, answer.error);
    return redirect(`/?moved=${encodeURIComponent(`${values.id} is now ${values.tier}.`)}`);
  }

  if (method === 'GET' && route === '/publish') {
    const published = url.searchParams.get('published');
    return html(200, renderPublish({
      plan: plan(ctx),
      storeDir: ctx.storeDir,
      ...(published === null ? {} : { notice: published }),
    }));
  }

  if (method === 'POST' && route === '/publish') {
    const values = parseFormBody(body);
    const answer = publishStore(ctx.storeDir, {
      confirm: true,
      ...(ctx.budgetBytes === undefined ? {} : { budgetBytes: ctx.budgetBytes }),
      ...(values.note === undefined ? {} : { note: values.note }),
    });
    if (!answer.ok) {
      return html(400, renderPublish({ plan: plan(ctx), storeDir: ctx.storeDir, error: answer.error }));
    }
    const said = `published store version ${answer.version}: `
      + `${answer.changes.map((c) => `${c.how} ${c.id}`).join(', ')}.`;
    return redirect(`/publish?published=${encodeURIComponent(said)}`);
  }

  return html(404, page('not found', `${nav()}<h1>not found</h1>`
    + `<p class="lede">nothing answers <code>${escapeHtml(route)}</code>.</p>`));
}
