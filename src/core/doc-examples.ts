/**
 * **The example-block grammar, in a module with no write surface.**
 *
 * `scripts/gen-doc-examples.ts` is the mechanism that makes every documented
 * example true: a marked block in the Markdown names a command, the script
 * RUNS that command against the committed documentation fixture, and the real
 * stdout is written back into the block. `test/docs/examples.test.ts` re-runs
 * the same commands through the same code path and fails when a block no
 * longer matches, so a stale example is a red test rather than prose nobody
 * noticed.
 *
 * The PARSE half of that — where a block starts, what command it names, and
 * how a marker splits into argv — used to live in the generator beside the
 * execution. It moved here for the same reason `COMMAND_FLAGS` moved out of
 * the command modules (`core/command-flags.ts`, and the argument in its
 * header): the generator imports `writeFileSync` and `execFileSync`, so
 * `test/ui/no-writes.test.ts` puts it out of a read surface's reach entirely,
 * and `TASK-the-library-explains-the-command-line-every-switch-parameter`
 * needs a read surface to be able to ask "which of these blocks demonstrates
 * `mycontext review promote`, and what did it actually print".
 *
 * **Nothing here runs anything.** It reads a string and returns offsets and
 * tokens; the fixture, the child process, the pinned clock and the scrubbing
 * all stay in the generator, which re-exports these four names so its own
 * importers — and `test/docs/examples.test.ts` — are unmoved. That is what
 * makes the Library screen's worked examples the SAME blocks the drift test
 * verifies, rather than a second set of examples nothing re-runs.
 */

export interface Example {
  /** The command as written in the marker, without the `mycontext` prefix. */
  command: string;
  /** The block's current contents, newlines normalized to `\n`. */
  body: string;
  /** Offset of the first character of the block body in the source string. */
  start: number;
  /** Offset just past the last character of the block body. */
  end: number;
  /**
   * The block's opening fence — three backticks or more, verbatim — or the
   * empty string for a `markdown` block, which has no fence.
   */
  fence: string;
  /**
   * How the command's output is written into the document.
   *
   * `text` is the original form: the raw stdout inside a ```` ```text ````
   * fence, byte for byte, which is what a reader would see in a terminal.
   *
   * `markdown` writes the same output as document-native Markdown, through
   * `toDocumentMarkdown` below, so a command whose output IS Markdown renders
   * as Markdown on GitHub instead of as literal pipes and hashes. It is still
   * generated and still diffed — `test/docs/examples.test.ts` re-runs the
   * command and applies the same transform — so the block is verified output
   * under a named transformation rather than prose.
   */
  kind: 'text' | 'markdown';
}

/**
 * `\r?\n` throughout, because `.gitattributes` asks for LF but a working tree
 * checked out before it was added still has CRLF `.md` files — and a marker
 * regex anchored on bare `\n` finds NOTHING there. Silently finding nothing
 * is the worst available failure for a drift harness: the generator writes no
 * blocks and the test verifies no blocks, and both report success.
 */
const OPEN = /<!-- example(-md)?: (.+?) -->\r?\n/g;

/** The fence line that must follow a `<!-- example: … -->` marker. */
const FENCE = /^(`{3,})text\r?\n/;

/**
 * Every marked example block, in document order, in either form.
 *
 * `body` is normalized to `\n` so it can be compared against a child
 * process's stdout on any checkout; `start` and `end` are raw offsets into
 * the string that was passed in, so `markdown.slice(0, start) + text +
 * markdown.slice(end)` replaces the block exactly.
 *
 * For a ```` ```text ```` block the closing fence is built from the opening
 * one rather than being a constant, so a four-backtick block is closed by four
 * backticks and a bare ```` ``` ```` line inside it is body, not a terminator.
 * That is what lets a block hold output which itself contains a fence. An
 * `example-md` block has no fence at all: it runs from the marker to the
 * closing marker, and `assertMarkdownBlockHolds` is what keeps its body from
 * ending the block or the document early.
 */
export function collectExamples(markdown: string): Example[] {
  const out: Example[] = [];
  OPEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OPEN.exec(markdown)) !== null) {
    const kind = m[1] === undefined ? 'text' : 'markdown';
    const command = m[2].trim();
    const afterMarker = m.index + m[0].length;

    let fence = '';
    let start = afterMarker;
    if (kind === 'text') {
      const opened = FENCE.exec(markdown.slice(afterMarker));
      // A `<!-- example: … -->` with no fence under it used to be skipped in
      // silence by a regex that required both halves in one match — the block
      // was neither generated nor verified, and both reported success.
      if (opened === null) {
        throw new Error(
          `my_context: example block "${command}" is not followed by a \`\`\`text fence. ` +
          `Use <!-- example-md: ${command} --> for a block written as Markdown.`,
        );
      }
      fence = opened[1];
      start = afterMarker + opened[0].length;
    }

    // Anchored on the exact fence, and on a line that holds nothing else —
    // a LONGER run of backticks does not match, because the character after
    // the fence must be the line ending. A markdown block closes on the
    // marker alone.
    const CLOSE = new RegExp(
      kind === 'text'
        ? `\\r?\\n${fence}\\r?\\n<!-- \\/example -->`
        : `\\r?\\n<!-- \\/example -->`,
      'g',
    );
    CLOSE.lastIndex = start;
    const close = CLOSE.exec(markdown);
    if (close === null) throw new Error(`my_context: unterminated example block: ${command}`);
    out.push({
      command,
      body: markdown.slice(start, close.index).replaceAll('\r\n', '\n'),
      start,
      end: close.index,
      fence,
      kind,
    });
    // Resume after the block, so a `<!-- example:` inside one cannot open a
    // second, overlapping block.
    OPEN.lastIndex = close.index + close[0].length;
  }
  return out;
}

/**
 * Splits a marker into argv.
 *
 * Quoted runs are held together wherever they appear, so both
 * `add constraint "Postgres pool capped at 20"` and `--scope="src/**"` survive
 * as single arguments. The quotes themselves are removed, exactly as a shell
 * would remove them — a marker cannot pass a literal `"` through to the CLI.
 */
export function splitCommand(command: string): string[] {
  return tokenize(command).map(unquote);
}

/**
 * One shell-like token: a run of non-space characters, with quoted runs held
 * together wherever they appear. Shared by `splitCommand` and
 * `splitPipeline` so a `&&` INSIDE quotes — `add rule "Do X && Y"` — is one
 * token including its quotes and therefore never string-equal to the bare
 * `&&` separator.
 */
function tokenize(command: string): string[] {
  return command.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
}

function unquote(token: string): string {
  return token.replaceAll('"', '');
}

/**
 * Splits a marker into the sequence of commands it names, on a bare `&&`.
 *
 * Every example runs against its OWN materialized fixture
 * (`runExampleInFixture`), so nothing an earlier BLOCK did is visible to a
 * later one. That is deliberate and load-bearing — but it means a
 * walkthrough whose last step can only exist because of its earlier steps
 * (`review promote` on a draft that `ingest-apply` created; `show` on a rule
 * that `lesson-accept` created) cannot be spelled as one command per block.
 * A marker may therefore name several commands; they run in order in one
 * workspace, and the block shows the LAST one's output. The setup is real
 * execution, not committed state pretending to be it: nothing is pasted that
 * the preceding commands did not actually produce on this run.
 *
 * A marker with an empty stage (`list &&`, `&& list`, `a && && b`) throws
 * rather than silently running the non-empty half.
 */
export function splitPipeline(command: string): string[][] {
  const stages: string[][] = [];
  let current: string[] = [];
  for (const token of tokenize(command)) {
    if (token === '&&') {
      stages.push(current);
      current = [];
      continue;
    }
    current.push(unquote(token));
  }
  stages.push(current);

  if (stages.length > 1 && stages.some((s) => s.length === 0)) {
    throw new Error(`my_context: example marker has an empty command around "&&": ${command}`);
  }
  return stages;
}
