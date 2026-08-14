/**
 * Argv: <cwd> <round> <index> <startAtEpochMs>
 * Creates ONE item through the real MCP tool path with a title every sibling
 * process in this round also uses and a body no other process uses. Prints
 * the resulting `create_item` message on stdout so the parent can recover the
 * id this process was told it got and compare it against what is on disk.
 *
 * Distinct from `concurrent-writer.ts`, which gives every writer a DISTINCT
 * title: distinct titles allocate into distinct id families and never compute
 * the same candidate id, so that fixture cannot exercise the read-decide-write
 * race in `locateInFamily`/`persist` at all.
 *
 * `startAtEpochMs` is a rendezvous barrier. Without it, the racers' overlap
 * depends entirely on Node startup jitter, which is tens of milliseconds wide
 * and swamps the actual read-decide-write window — measured, that made this
 * test only a 5-in-8 detector of the unfixed code. Sleeping until a wall-clock
 * instant the parent picked far enough ahead of every child's startup means
 * every racer reaches `createItem` inside the same few milliseconds. It is
 * still a probabilistic detector, not a proof — see the test's own comment.
 */
import { sleepMs } from '../../src/core/sleep.ts';
import { createRegistry } from '../../src/mcp/tools.ts';

const [cwd, round, index, startAtArg] = process.argv.slice(2);

try {
  const registry = createRegistry(cwd);
  const startAt = Number(startAtArg);
  for (;;) {
    const remaining = startAt - Date.now();
    if (remaining <= 0) break;
    sleepMs(Math.min(remaining, 5));
  }
  const out = registry.call('create_item', {
    type: 'lesson',
    title: `A contended lesson ${round}`,
    body: `body-${round}-${index}`,
  });
  process.stdout.write(`${String(out)}\n`);
  process.exitCode = 0;
} catch (err) {
  process.stderr.write(`${round}/${index}: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
}
