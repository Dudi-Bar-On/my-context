/**
 * Argv: <cwd> <label> <count>
 * Creates <count> items through the real MCP tool path, exactly as a second
 * Claude session would. Exits 0 on success, 1 with a message on stderr on
 * failure, so the parent can report which writer lost.
 */
import { createRegistry } from '../../src/mcp/tools.ts';

const [cwd, label, countArg] = process.argv.slice(2);
const count = Number(countArg);

try {
  const registry = createRegistry(cwd);
  for (let i = 0; i < count; i++) {
    registry.call('create_item', {
      type: 'lesson',
      title: label === 'same' ? 'A contended lesson' : `Lesson ${label} ${i}`,
      body: 'Written under contention.',
    });
  }
  process.exitCode = 0;
} catch (err) {
  process.stderr.write(`${label}: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
}
