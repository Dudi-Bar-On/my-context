// Prints the argv a shell handed it, as JSON. The only program `shellSplit`
// (`e2e/composer.ts`) ever runs: it is how a REAL shell's word splitting and
// quote removal are observed without running the command whose line is under
// test. `plan:builder seq:11` (D12) — "what the screen produces is text a
// person pastes into a shell, so quoting is the failure mode that matters most".
process.stdout.write(JSON.stringify(process.argv.slice(2)));
