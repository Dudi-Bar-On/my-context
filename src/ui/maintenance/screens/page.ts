/**
 * **The tool's one HTML shell, and its one escaper.**
 *
 * D41 spec §11.3, `plan:store seq:3` Task 10. Nothing here is styling for its
 * own sake: the tool is a real editing surface the owner writes prose in, and
 * the two things that decide whether that is possible are the size of a text
 * area and whether the page tells you what went wrong. Both live here.
 *
 * **Escaping is not optional even though this tool does not ship.** An entry's
 * `example` is a quotation — it holds angle brackets, quotes and ampersands by
 * its nature — and an unescaped one would silently truncate the form it is
 * being edited in, which reads exactly like data loss. The reason is
 * correctness, not defence.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Dark, monospaced-where-it-matters, and one column. The shipped UI's stylesheet
 * is deliberately NOT reused: it belongs to a product surface with its own
 * rules, and importing it here would make a change to that surface able to
 * break this one.
 */
const STYLE = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0; padding: 1.5rem 2rem 4rem; background: #12141a; color: #e6e8ee;
  font: 15px/1.55 ui-sans-serif, system-ui, "Segoe UI", sans-serif;
}
a { color: #8ab4f8; }
h1 { font-size: 1.3rem; margin: 0 0 .25rem; }
h2 { font-size: 1.05rem; margin: 1.75rem 0 .5rem; }
.lede { color: #99a0b0; margin: 0 0 1.5rem; max-width: 62rem; }
main { max-width: 62rem; }
label { display: block; margin: 1.1rem 0 .3rem; color: #c9cfdd; font-weight: 600; }
label .asks { display: block; font-weight: 400; color: #99a0b0; font-size: .9rem; }
input, textarea, select {
  width: 100%; padding: .55rem .7rem; border-radius: 6px; border: 1px solid #2b3040;
  background: #1a1d26; color: #e6e8ee; font: inherit;
}
textarea { min-height: 7rem; resize: vertical; font: 14px/1.6 ui-monospace, "Cascadia Code", monospace; }
button, .button {
  display: inline-block; margin-top: 1.25rem; padding: .55rem 1.1rem; border-radius: 6px;
  border: 1px solid #3a6ea5; background: #23405e; color: #e6e8ee; font: inherit; cursor: pointer;
  text-decoration: none;
}
button.quiet, .button.quiet { background: #1a1d26; border-color: #2b3040; }
table { border-collapse: collapse; width: 100%; margin-top: .75rem; }
th, td { text-align: left; padding: .4rem .6rem; border-bottom: 1px solid #242836; vertical-align: top; }
th { color: #99a0b0; font-weight: 600; }
code { font-family: ui-monospace, "Cascadia Code", monospace; }
.error, .refusal {
  border: 1px solid #7a3b3b; background: #2a1a1c; color: #f3d6d6;
  padding: .8rem 1rem; border-radius: 6px; margin: 1rem 0;
}
.ok { border: 1px solid #3b6b45; background: #16251b; color: #cfe9d6;
  padding: .8rem 1rem; border-radius: 6px; margin: 1rem 0; }
.meter { height: 10px; border-radius: 5px; background: #242836; overflow: hidden; margin: .4rem 0; }
.meter > span { display: block; height: 100%; background: #3a7d4f; }
.meter.over > span { background: #a5493a; }
.diff { white-space: pre-wrap; font: 13px/1.55 ui-monospace, monospace; background: #1a1d26;
  border: 1px solid #2b3040; border-radius: 6px; padding: .9rem 1rem; }
.diff .add { color: #7fd19a; }
.diff .del { color: #e08b84; }
.nav { margin-bottom: 1.25rem; display: flex; gap: .75rem; flex-wrap: wrap; }
`;

export function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · my_context rule store</title>
<style>${STYLE}</style>
</head><body><main>${body}</main></body></html>`;
}

/** The bar every screen carries, so no screen is a dead end. */
export function nav(): string {
  return '<nav class="nav">'
    + '<a class="button quiet" href="/">entries</a>'
    + '<a class="button quiet" href="/new">new entry</a>'
    + '<a class="button quiet" href="/publish">publish</a>'
    + '</nav>';
}
