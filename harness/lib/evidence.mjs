import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const EVIDENCE_DIR = join(here, '..', 'evidence');

function file(surface) {
  return join(EVIDENCE_DIR, `${surface}.jsonl`);
}

export async function load(surface) {
  const path = file(surface);
  if (!existsSync(path)) return [];
  const text = await readFile(path, 'utf8');
  const records = [];
  const malformed = [];
  text.split('\n').forEach((line, i) => {
    if (!line) return;
    try {
      records.push(JSON.parse(line));
    } catch {
      malformed.push(i + 1);
    }
  });
  if (malformed.length) {
    process.stderr.write(
      `evidence: ${surface}.jsonl has ${malformed.length} unparseable line(s) at ${malformed.join(', ')} — skipped\n`,
    );
  }
  return records;
}

const chains = new Map();

async function appendRecord(surface, caseId, data) {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const id = `${surface}/${caseId}`;
  const existing = await load(surface);
  // A silently overwritten record would make a finding untraceable.
  if (existing.some((r) => r.id === id)) {
    throw new Error(`duplicate evidence id: ${id}`);
  }
  await appendFile(file(surface), `${JSON.stringify({ ...data, id, surface, caseId })}\n`);
  return id;
}

export function record(surface, caseId, data) {
  const prev = chains.get(surface) ?? Promise.resolve();
  const next = prev.then(() => appendRecord(surface, caseId, data));
  // Keep the chain alive even if this write rejects, so one failure
  // does not wedge every later record() for the surface.
  chains.set(surface, next.catch(() => {}));
  return next;
}
