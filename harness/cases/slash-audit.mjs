// harness/cases/slash-audit.mjs
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { REPO } from '../lib/workspace.mjs';
import { record } from '../lib/evidence.mjs';

const execFileAsync = promisify(execFile);
const dir = join(REPO, 'commands');
const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));

await record('slash', 'file-count', {
  expected: 66, actual: files.length, pass: files.length === 66,
  note: 'README 1723 claims 66 slash commands',
});

const addFiles = files.filter((f) => f.startsWith('add-'));
const listFiles = files.filter((f) => f.startsWith('list-'));
await record('slash', 'add-count', { expected: 21, actual: addFiles.length, pass: addFiles.length === 21 });
await record('slash', 'list-count', { expected: 21, actual: listFiles.length, pass: listFiles.length === 21 });

const missingDisable = [];
const unquotedHint = [];
const noFrontmatter = [];

for (const f of files) {
  const text = await readFile(join(dir, f), 'utf8');
  if (!text.startsWith('---')) { noFrontmatter.push(f); continue; }
  const fm = text.slice(3, text.indexOf('\n---', 3));
  if (f !== 'LoadMyContext.md' && !/disable-model-invocation:\s*true/.test(fm)) {
    missingDisable.push(f);
  }
  const hint = fm.match(/argument-hint:\s*(.*)/);
  // An unquoted hint containing [ or | is invalid YAML — the defect README 1886 describes.
  if (hint && !/^".*"$/.test(hint[1].trim()) && /[[|]/.test(hint[1])) unquotedHint.push(f);
}

await record('slash', 'frontmatter-present', {
  offenders: noFrontmatter, pass: noFrontmatter.length === 0,
});
await record('slash', 'disable-model-invocation', {
  offenders: missingDisable, pass: missingDisable.length === 0,
  note: 'README 1882: all 65 carry it, LoadMyContext is the sole exception',
});
await record('slash', 'loadmycontext-is-the-exception', {
  pass: !(await readFile(join(dir, 'LoadMyContext.md'), 'utf8')).includes('disable-model-invocation'),
});
await record('slash', 'argument-hint-quoted', {
  offenders: unquotedHint, pass: unquotedHint.length === 0,
  note: 'README 1886: nineteen once shipped invalid YAML; hints are quoted now',
});

// Generator parity: regenerating must not change any committed file.
// Guard first — the restore below is `git checkout --`, which would discard
// pre-existing uncommitted work in the clone. Refuse rather than destroy it.
const preState = await execFileAsync('git', ['status', '--short', 'commands'], { cwd: REPO });
if (preState.stdout.trim() !== '') {
  throw new Error(`refusing to run: my-context/commands is dirty:\n${preState.stdout}`);
}
const gen = await execFileAsync('npm', ['run', 'gen:commands'], { cwd: REPO, shell: true })
  .catch((e) => ({ stdout: e.stdout ?? '', stderr: e.stderr ?? '' }));
const status = await execFileAsync('git', ['status', '--short', 'commands'], { cwd: REPO });
await record('slash', 'generator-parity', {
  stdout: gen.stdout, gitStatus: status.stdout, pass: status.stdout.trim() === '',
  note: 'README 1878: a test fails if committed files and the generator disagree',
});

// Restore the clone regardless of outcome.
await execFileAsync('git', ['checkout', '--', 'commands'], { cwd: REPO });

// A. Category-command parity: verify each of 21 categories has corresponding add-* and list-* files.
const categoriesTsPath = join(REPO, 'src/core/categories.ts');
const categoriesTsText = await readFile(categoriesTsPath, 'utf8');
const categories = [];
for (const match of categoriesTsText.matchAll(/\s+(\w+):\s*def\(/g)) {
  categories.push(match[1]);
}

function toSlug(name) {
  return name.replace(/_/g, '-');
}

const missingAdd = [];
const missingList = [];
const orphanAdd = [];
const orphanList = [];

for (const cat of categories) {
  const slug = toSlug(cat);
  if (!addFiles.includes(`add-${slug}.md`)) missingAdd.push(cat);
  if (!listFiles.includes(`list-${slug}.md`)) missingList.push(cat);
}

for (const f of addFiles) {
  const slug = f.slice(4, -3); // remove "add-" and ".md"
  const cat = slug.replace(/-/g, '_');
  if (!categories.includes(cat)) orphanAdd.push(f);
}

for (const f of listFiles) {
  const slug = f.slice(5, -3); // remove "list-" and ".md"
  const cat = slug.replace(/-/g, '_');
  if (!categories.includes(cat)) orphanList.push(f);
}

// Build category-to-slug mapping for documentation
const categorySlugMapping = categories.map((cat) => ({ category: cat, slug: toSlug(cat) }));

await record('slash', 'category-command-parity', {
  categories,
  categorySlugMapping,
  missingAdd, missingList, orphanAdd, orphanList,
  pass: missingAdd.length === 0 && missingList.length === 0 && orphanAdd.length === 0 && orphanList.length === 0,
});

// B. Command references: extract CLI subcommands and verify they exist.
const cliIndexPath = join(REPO, 'src/cli/index.ts');
const cliIndexText = await readFile(cliIndexPath, 'utf8');
const builtins = [];
for (const match of cliIndexText.matchAll(/registerCommand\(\{[^}]*name:\s*['"](\w+)['"]/g)) {
  builtins.push(match[1]);
}

const commandFilesPath = join(REPO, 'src/cli/commands');
const commandFiles = await readdir(commandFilesPath);
let allRegisteredCommands = new Set(builtins);
for (const f of commandFiles.filter((n) => n.endsWith('.ts'))) {
  const text = await readFile(join(commandFilesPath, f), 'utf8');
  for (const match of text.matchAll(/registerCommand\(\{[^}]*name:\s*[']([\w-]+)['"]/g)) {
    allRegisteredCommands.add(match[1]);
  }
}

const subcommandsReferenced = new Set();
const flagsReferenced = new Set();

for (const f of files) {
  const text = await readFile(join(dir, f), 'utf8');

  // Extract subcommands from both patterns:
  // 1. mycontext <subcommand>
  const pattern1Matches = text.match(/mycontext\s+([\w-]+)/g) || [];
  pattern1Matches.forEach((m) => {
    const cmd = m.slice(10).trim(); // remove "mycontext "
    subcommandsReferenced.add(cmd);
  });

  // 2. node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" <subcommand>
  // This pattern may span multiple lines, so we need to be flexible
  const pattern2Matches = text.match(/(?:node\s+"?\$\{?CLAUDE_PLUGIN_ROOT\}?\/src\/cli\/index\.ts"?\s+)([\w-]+)/g) || [];
  pattern2Matches.forEach((m) => {
    // Extract just the subcommand part (last word in the match)
    const parts = m.trim().split(/\s+/);
    const cmd = parts[parts.length - 1];
    if (cmd && /^[\w-]+$/.test(cmd)) {
      subcommandsReferenced.add(cmd);
    }
  });

  // Also try a simpler pattern for the node invocation
  for (const line of text.split('\n')) {
    const simpleMatch = line.match(/src\/cli\/index\.ts['"]\s+([\w-]+)/);
    if (simpleMatch) {
      subcommandsReferenced.add(simpleMatch[1]);
    }
  }

  const flagMatches = text.match(/--[\w-]+/g) || [];
  flagMatches.forEach((m) => flagsReferenced.add(m));
}

// Remove the frontmatter delimiter artifact
flagsReferenced.delete('---');

const unknownSubcommands = [...subcommandsReferenced].filter((cmd) => !allRegisteredCommands.has(cmd));

await record('slash', 'command-references-real-surface', {
  subcommandsReferenced: [...subcommandsReferenced].sort(),
  unknownSubcommands: unknownSubcommands.sort(),
  flagsReferenced: [...flagsReferenced].sort(),
  pass: unknownSubcommands.length === 0,
});

// C. Non-per-category inventory: capture metadata of 24 non-per-category commands.
const perCategoryFiles = new Set([...addFiles, ...listFiles]);
const otherFiles = files.filter((f) => !perCategoryFiles.has(f));

const nonPerCategoryCommands = [];
for (const f of otherFiles.sort()) {
  const text = await readFile(join(dir, f), 'utf8');
  if (!text.startsWith('---')) continue;
  const fmEnd = text.indexOf('\n---', 3);
  const fm = text.slice(3, fmEnd);

  // Name is derived from filename (without .md extension)
  const name = f.slice(0, -3); // remove ".md"

  let description = null;
  let argumentHint = null;

  const descMatch = fm.match(/^description:\s*(.+)$/m);
  if (descMatch) {
    description = descMatch[1].trim().replace(/^["']|["']$/g, '');
  }

  const hintMatch = fm.match(/^argument-hint:\s*(.+)$/m);
  if (hintMatch) {
    argumentHint = hintMatch[1].trim().replace(/^["']|["']$/g, '');
  }

  nonPerCategoryCommands.push({
    name,
    description,
    argumentHint,
  });
}

await record('slash', 'non-per-category-inventory', {
  commands: nonPerCategoryCommands,
  count: nonPerCategoryCommands.length,
  note: 'name derived from filename (basename without .md extension)',
});

console.log(`slash audit recorded ${11} assertions`);
