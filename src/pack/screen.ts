/**
 * The Unicode screen at the door: the code points an arriving artefact may
 * not carry, and where in it they were found.
 *
 * ## What this is for
 *
 * The corpus is NORMATIVE TEXT, not prose for display. An invisible
 * reordering control inside a rule can make that rule read as its opposite to
 * a human while the model reads the other one — the person approving the
 * import and the machine acting on it are then looking at two different
 * rules, and neither of them can tell. The Tags block (U+E0000–U+E007F) is
 * worse still: it is a whole alphabet that renders as nothing at all, and it
 * is the channel the Rules File Backdoor smuggles instructions through.
 *
 * So an artefact from a stranger passes this screen before anything in it is
 * parsed, planned or applied.
 *
 * ## The screen never normalises
 *
 * It REPORTS and the caller REFUSES; it does not clean. Rewriting the text
 * would change the bytes `manifest.json` hashed, so a cleaning screen would
 * hand the verifier a file the manifest no longer describes — and it would
 * silently alter a stranger's normative text, which is the one thing an
 * importer must never do. Offsets are therefore counted on the text exactly
 * as it arrived, in UTF-16 code units, so `text.codePointAt(offset)` is the
 * code point the finding names and a caller slicing the text it was handed
 * cuts out the character the message pointed at.
 *
 * ## The cost, named rather than discovered
 *
 * U+200E and U+200F are legitimately used in mixed Hebrew/Latin text, and
 * this repository ships a Hebrew README that uses directional markup
 * elsewhere. Refusing them means a Hebrew- or Arabic-authored pack can be
 * refused for content its author considers correct. U+200D costs more than it
 * looks: every ZWJ emoji sequence — the family and profession emoji — is
 * refused with it. Both costs are accepted, because the alternative is a
 * normative item that displays as its opposite, and because the refusal names
 * the item, the field, the code point and the offset, so an author removes it
 * in one edit.
 *
 * **There is no `--allow-bidi` flag**, for the reason the product refuses a
 * `--trust` flag: a boundary a flag can override is not a boundary.
 *
 * ## Why U+000D is not screened and U+0009 and U+000A are not either
 *
 * The table's control row is written as four spans rather than "C0 and C1",
 * and the three code points those spans step over are the three that make
 * text into lines: tab, newline and the carriage return that precedes a
 * newline on Windows. Screening CR would refuse every item file a Windows
 * editor wrote with CRLF endings, which is a formatting difference and not an
 * attack. The spans are the rule; the row's name is the summary.
 *
 * ## Why the BOM is the one code point whose POSITION decides it
 *
 * U+FEFF at offset 0 is an encoding mark a text editor wrote. Anywhere else
 * it is a zero-width no-break space — invisible content in the middle of a
 * sentence. The exemption is positional and nothing else about it is special.
 * It applies to whatever text is being screened, so a FIELD whose first
 * character is U+FEFF is accepted as well; that is the narrowness of an
 * offset-based rule, stated rather than hidden. It is the cheap side of the
 * trade: U+FEFF neither reorders nor conceals its neighbours, so a leading
 * one costs a strange-looking title, where refusing every file that opens
 * with a BOM would cost artefacts that are entirely well formed.
 */
import type { Item } from '../core/types.ts';

/**
 * One row of the screened table: the code point spans it covers, what it is
 * called in a message, and why it is refused.
 *
 * Exported as DATA rather than compiled into a regular expression because the
 * test enumerates it and the message reads from it — one list, so a row
 * cannot be screened without being nameable, or named without being screened.
 * A row carries `spans` rather than a single `from`/`to` so that the eleven
 * rows here are the eleven rows of the spec's table, one for one, instead of
 * fourteen entries a reader has to regroup mentally.
 */
export interface ScreenedRange {
  /** Inclusive code-point spans, in ascending order. */
  spans: readonly { from: number; to: number }[];
  /** The row's name, as it appears in a finding. */
  name: string;
  /** One sentence saying why the row exists, carried into the message. */
  why: string;
}

/**
 * One screened code point, and where it was found.
 *
 * `message` is the four other fields rendered into the sentence a person
 * reads; it is a field rather than something the caller composes so that
 * every surface — the CLI, the import report, a test — says it the same way,
 * and so that the escaping below cannot be forgotten at one of them.
 */
export interface ScreenFinding {
  /** The file, or the item and field, the text came from. */
  where: string;
  /** `U+200E` — at least four uppercase hex digits. */
  codePoint: string;
  /** The name of the `SCREENED_RANGES` row that refused it. */
  name: string;
  /** UTF-16 code units into the text as it arrived. Never normalised first. */
  offset: number;
  /** The whole finding as one sentence, with no invisible character in it. */
  message: string;
}

const BIDI = 'A bidirectional control reorders what a person reads without changing what a '
  + 'model reads, so a normative item can display as its opposite to the human approving it.';

const INVISIBLE = 'It renders as nothing, so it carries content into a normative item that no '
  + 'reader can see.';

const U_FEFF = 'Away from offset 0 it is not an encoding mark but a zero-width no-break space '
  + '— invisible content in the middle of a sentence.';

const TAGS = 'The Tags block renders as nothing and spells out ASCII, so it is an entire hidden '
  + 'alphabet — it is the channel the Rules File Backdoor smuggles instructions through.';

const CONTROL = 'A control character is invisible and changes how the text is handled rather '
  + 'than what it says.';

const SURROGATE = 'An unpaired surrogate is not a character and has no UTF-8 encoding, so what '
  + 'arrives depends on which reader guesses.';

/**
 * The whole screen, in the order the spec's table lists it: bidi first,
 * invisibles second, the controls and the unpaired surrogates last.
 *
 * `U+2061`–`U+2064` (the invisible maths operators) and `U+206A`–`U+206F` (the
 * deprecated format characters) are NOT here, and their absence is deliberate
 * rather than an oversight: the table is the list this product refuses, and
 * widening it is a decision someone takes with a reason, not something an
 * implementer does because a neighbouring code point looked similar. The
 * test asserts the code point on each side of every span passes, so adding
 * one here without adding it to the table is caught.
 */
export const SCREENED_RANGES: readonly ScreenedRange[] = [
  { spans: [{ from: 0x061c, to: 0x061c }], name: 'Arabic letter mark', why: BIDI },
  { spans: [{ from: 0x200e, to: 0x200f }], name: 'LRM, RLM', why: BIDI },
  { spans: [{ from: 0x202a, to: 0x202e }], name: 'embedding and override', why: BIDI },
  { spans: [{ from: 0x2066, to: 0x2069 }], name: 'isolates', why: BIDI },
  { spans: [{ from: 0x200b, to: 0x200b }], name: 'zero-width space', why: INVISIBLE },
  { spans: [{ from: 0x200c, to: 0x200d }], name: 'ZWNJ, ZWJ', why: INVISIBLE },
  { spans: [{ from: 0x2060, to: 0x2060 }], name: 'word joiner', why: INVISIBLE },
  {
    spans: [{ from: 0xfeff, to: 0xfeff }],
    name: 'BOM anywhere but offset 0 of a file',
    why: U_FEFF,
  },
  { spans: [{ from: 0xe0000, to: 0xe007f }], name: 'the Tags block', why: TAGS },
  {
    spans: [
      { from: 0x0000, to: 0x0008 },
      { from: 0x000b, to: 0x000c },
      { from: 0x000e, to: 0x001f },
      { from: 0x007f, to: 0x009f },
    ],
    name: 'C0 and C1 controls other than tab and newline',
    why: CONTROL,
  },
  { spans: [{ from: 0xd800, to: 0xdfff }], name: 'unpaired surrogate', why: SURROGATE },
];

/** U+FEFF, whose row is the only one an offset can excuse. */
const BOM = 0xfeff;

/** `U+200E`, `U+0009`, `U+E0001` — at least four digits, uppercase. */
function spell(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** The row covering `codePoint`, or `null` when nothing screens it. */
function rowFor(codePoint: number): ScreenedRange | null {
  for (const row of SCREENED_RANGES) {
    for (const span of row.spans) {
      if (codePoint >= span.from && codePoint <= span.to) return row;
    }
  }
  return null;
}

/**
 * A value fit to appear inside a message: every screened code point becomes
 * its own spelling.
 *
 * A refusal that interpolated a raw id would carry the override it is
 * refusing into the very sentence a person reads to decide what to do about
 * it — the message would then be reordered by the attack it describes.
 * `JSON.stringify` is not enough on its own: it escapes C0 controls and
 * leaves U+202E alone.
 */
function printable(value: string): string {
  let out = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0) as number;
    out += rowFor(codePoint) === null ? character : `<${spell(codePoint)}>`;
  }
  return out;
}

function finding(where: string, codePoint: number, row: ScreenedRange, offset: number): ScreenFinding {
  const spelling = spell(codePoint);
  return {
    where,
    codePoint: spelling,
    name: row.name,
    offset,
    message: `${where} contains ${spelling} (${row.name}) at offset ${offset}. ${row.why}`,
  };
}

/**
 * Every screened code point in `text`, in the order it appears, each named
 * with `where` it was found.
 *
 * **Every finding, never the first.** A screen that stopped at one would send
 * an author round the loop once per character, and — worse — would let a
 * reviewer reading the report believe they had seen the whole of what
 * arrived.
 *
 * Iteration is by code POINT (`for…of` over a string), which is what makes
 * the unpaired-surrogate row reachable at all: a well-formed pair arrives
 * here as one astral code point and never as two surrogates, so anything in
 * D800–DFFF that reaches `rowFor` is by construction a lone one. `offset`
 * still advances by code UNITS, because that is the index every other string
 * operation in this codebase uses.
 */
export function screenText(text: string, where: string): ScreenFinding[] {
  const found: ScreenFinding[] = [];
  let offset = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) as number;
    const row = rowFor(codePoint);
    // The BOM's row is the one an offset can excuse, and only at 0. See the
    // module comment for why the exemption is positional and nothing else.
    if (row !== null && !(codePoint === BOM && offset === 0)) {
      found.push(finding(where, codePoint, row, offset));
    }
    offset += character.length;
  }
  return found;
}

/** `item "RULE-x" title` — the item named safely, then the field within it. */
function at(item: Item, field: string): string {
  return `item ${JSON.stringify(printable(item.id))} ${field}`;
}

/**
 * Every screened code point in everything a person AUTHORED on this item.
 *
 * The fields, in the order they are screened: `title`, `body`, each
 * observation's `text`, `context` and `tags`, each `tag`, each `scope` glob,
 * each relation's `target`, each `extra` value, each step's text, and the
 * `id`.
 *
 * **What is deliberately not screened, and why it is not a hole.** `type`,
 * `status`, `severity`, `origin`, an observation's `category` and a
 * relation's `type` are closed vocabularies validated against their own lists
 * elsewhere; a screened code point in one of them fails that validation as an
 * unknown member, which is a better message than this one would be. `extra`
 * KEYS are checked against the category's declared fields for the same
 * reason — but every `extra` VALUE is free text and is screened. `checksum`,
 * `filePath` and `layer` are computed by this build, not authored by the
 * sender.
 *
 * **`steps` is screened although the plan's field list does not name it.**
 * The list was written before the `procedure` category added the field
 * (`core/types.ts` · `export interface Step {` · ~50); a step's text is free
 * text a stranger wrote, `renderItem` writes it into the travelling file
 * (`core/item.ts` · `    parts.push('## Steps', ...item.steps.map(renderStep), '');` · ~427),
 * and a screen that reached every other authored field but that one would be
 * a door with a window beside it.
 */
export function screenItem(item: Item): ScreenFinding[] {
  const found: ScreenFinding[] = [];
  found.push(...screenText(item.title, at(item, 'title')));
  found.push(...screenText(item.body, at(item, 'body')));

  item.observations.forEach((observation, index) => {
    const nth = `observation ${index + 1}`;
    found.push(...screenText(observation.text, at(item, `${nth} text`)));
    if (observation.context !== null) {
      found.push(...screenText(observation.context, at(item, `${nth} context`)));
    }
    observation.tags.forEach((tag, tagIndex) => {
      found.push(...screenText(tag, at(item, `${nth} tag ${tagIndex + 1}`)));
    });
  });

  item.tags.forEach((tag, index) => {
    found.push(...screenText(tag, at(item, `tag ${index + 1}`)));
  });
  item.scope.forEach((glob, index) => {
    found.push(...screenText(glob, at(item, `scope ${index + 1}`)));
  });
  item.relations.forEach((relation, index) => {
    found.push(...screenText(relation.target, at(item, `relation ${index + 1} target`)));
  });
  for (const [key, value] of Object.entries(item.extra)) {
    found.push(...screenText(value, at(item, `extra ${JSON.stringify(printable(key))}`)));
  }
  item.steps.forEach((step, index) => {
    found.push(...screenText(step.text, at(item, `step ${index + 1}`)));
  });

  // Last, because it is the field every other message above already names:
  // a finding about the id itself reads as a statement about the label, not
  // about something inside the item.
  found.push(...screenText(item.id, at(item, 'id')));
  return found;
}

/**
 * The two strings a pack carries about itself.
 *
 * They are screened separately from the items because they are the strings
 * every surface prints WITHOUT the item beside them — a pack list, a
 * confirmation prompt, an import record — so a reordering control in a name
 * reaches a reader who never opened the artefact. `refusePackName` and
 * `refuseDescriptiveVersion` do not catch them: neither is a C0 or C1
 * control, none changes under NFC, and each costs one code point, so every
 * rule those functions have lets them through (`manifest.ts` ·
 * `export function refusePackName(v: unknown): string | null {` · ~230).
 */
export function screenPackMeta(name: string, version: string): ScreenFinding[] {
  return [
    ...screenText(name, 'the pack name'),
    ...screenText(version, 'the pack version'),
  ];
}
