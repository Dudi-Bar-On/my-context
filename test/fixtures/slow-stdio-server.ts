/**
 * A JSON-RPC-over-stdio server that is deliberately slow to become ready, and
 * fast once it is — the exact shape of a `node` cold start on a cold module
 * cache, reproduced deterministically so a test can pin the readiness gate in
 * `test/helpers/stdio.ts` without depending on how loaded the machine is.
 *
 * Requests arriving during the cold period are queued, not dropped: a real
 * cold start does not lose the bytes written to its stdin while it boots.
 *
 * Usage: node slow-stdio-server.ts <coldMs>
 */
const coldMs = Number(process.argv[2] ?? '1500');

const queue: string[] = [];
let warm = false;

function answer(line: string): void {
  let message: { id?: unknown } = {};
  try {
    message = JSON.parse(line) as { id?: unknown };
  } catch {
    return;
  }
  if (message.id === undefined) return;
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: {} }) + '\n');
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => {
  buffer += chunk;
  for (;;) {
    const newline = buffer.indexOf('\n');
    if (newline < 0) break;
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line === '') continue;
    if (warm) answer(line);
    else queue.push(line);
  }
});

setTimeout(() => {
  warm = true;
  for (const line of queue.splice(0)) answer(line);
}, coldMs);
