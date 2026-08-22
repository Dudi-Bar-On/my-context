// Command-string composition for every composed write in the UI — the ONE
// place quoting lives, used by the palette, Work and Configure screens alike.
// The composed string is always SHOWN before it is copied: quoting here aims
// at POSIX shells and PowerShell for the characters mycontext values actually
// carry, and anything exotic is visible to the user before they run it.
//
// WHAT THIS MODULE CANNOT DO, structurally rather than by intention. It binds
// no network primitive, no dynamic-evaluation primitive and no navigation
// primitive. It imports nothing. It takes strings and returns a string.
//
// That is CHECKED, not promised: `the composing modules bind nothing that can
// run, send or navigate` in `test/ui/palette-lib.test.ts` reads every file in
// this directory and fails on any of those names. The forbidden names are
// spelled in the test and deliberately NOT here — a checker that scans bytes
// is defeated by a comment that lists what it looks for, which is the mistake
// `faint-usage.test.ts` records making on its own first run.
//
// It is the browser-side counterpart of `no-writes.test.ts`, which proves the
// same property over the SERVER half. Between them the §8 risk row "a UI write
// silently voids the user's Bash deny rules" has no surface left: the server
// binds one ruled write symbol and the page cannot call what nothing here
// reaches.

const SAFE = /^[A-Za-z0-9@%_+=:,.\/\-]+$/;

export function quoteArg(value) {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`quoteArg: not a composable value: ${String(value)}`);
  }
  if (SAFE.test(value)) return value;
  // Globs (*, ?) fall through to quoting on purpose: an unquoted src/** would
  // be expanded by the user's shell before mycontext ever saw it.
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function composeCommand(argv) {
  if (!Array.isArray(argv) || argv.length === 0) {
    throw new Error('composeCommand: empty argv');
  }
  return argv.map(quoteArg).join(' ');
}
