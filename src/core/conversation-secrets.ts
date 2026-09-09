/**
 * **What in a conversation LOOKS private — proposed, never acted on.**
 * `plan:archive seq:46`, steps 1, 2 and 4 of four.
 *
 * ── THE ONE RULE THIS MODULE EXISTS TO OBEY ───────────────────────────────
 *
 * The owner's design, in his words: *"when user requesting export it should be
 * askd to list private details or sensitive info from the conversation and
 * uppon it's selection the exported version will include a replacement faked
 * place holder"*. **DETECTION PROPOSES, IT NEVER ACTS.**
 *
 * Two designs were offered before his and both were worse in the same way:
 * automatic scrubbing — on the display path or on the export path — puts a
 * pattern list in charge of what a reader may see. A false positive then
 * silently HIDES his own work, and a false negative silently reassures him.
 * His shape has neither failure mode: a candidate that is wrong sits in a list
 * unchecked, and a candidate that is missed is a gap he can SEE is a gap,
 * because he is the one reading the list.
 *
 * So nothing here replaces anything. `scanSessionSecrets` answers *what looks
 * private and where*, and `redactString` replaces exactly the candidate ids it
 * is handed and nothing else. Hand it an empty set and it returns its input,
 * identically — which is what makes `seq:46`'s other rule enforceable: an
 * export nobody read must be byte-faithful, because a silent alteration is
 * worse than a silent inclusion when the file's whole purpose is to be a
 * record.
 *
 * ── THE HIT RATE IS BAD ON PURPOSE, AND IT IS MEASURED ────────────────────
 *
 * `plan:archive seq:27` scanned every transcript on this machine on
 * 2026-09-08 — 867 files, 1.7 GB — for thirteen credential shapes and found
 * eight newly-exposed matches, of which ONE was a real secret, five were
 * deliberate test probes and one was the identifier `secret` in
 * `secret = cryptoRandomBytes`. A machine cannot tell those apart. He can, at
 * a glance, from a list. A detector with that hit rate is not a broken
 * detector here; it is a PROPOSER, and the ratio is the argument for the form
 * rather than an argument against the scan.
 *
 * ── NO SECRET EVER LEAVES THIS MODULE WHOLE ───────────────────────────────
 *
 * A candidate carries a MASK, a shape, a context window and a count — enough
 * to judge, and never the value. Its `id` is a hash of the value, so the CLI
 * report, the `--json` a form renders, and the accepted list handed back are
 * all free of credential material: the redactor re-derives the values by
 * re-scanning. That is deliberate and it is this project's own history
 * speaking — the lane that REPORTED the 2026-09-08 finding wrote a complete
 * bearer token into a corpus item, which is committed and pushed, and it had
 * to be redacted before it shipped. A reporting surface that has to carry the
 * secret in order to describe it is a surface that will eventually publish
 * one.
 *
 * The hash is what also gives `seq:46` its stability requirement for free:
 * *"the same secret appearing twice must get the same placeholder, or a reader
 * of the export cannot tell that two occurrences were one value."* One value
 * hashes to one id, hence to one placeholder — in this record, in the next
 * one, and in every tail appended afterwards.
 *
 * This module touches no filesystem beyond READING the transcript it is
 * pointed at. The writes — the redacted copy and the choice that produces it —
 * are `core/conversation-redaction.ts`, for the split `conversation-mirror.ts`
 * already keeps and `test/ui/no-writes.test.ts` enforces.
 */
import { createHash } from 'node:crypto';
import { MAX_SCAN_BYTES, iterateTranscript, type TranscriptCursor } from './conversation-index.ts';

/**
 * One thing that looks like a credential, and what a reader should be told
 * about it.
 *
 * `added` is not decoration. `seq:46` names the thirteen shapes the
 * 2026-09-08 scan covered and says in as many words that they are *"the
 * starting set, not the finished one"* — so the set has to be able to say
 * which of its members are the thirteen and which this build added, or the
 * next reader cannot tell a widened detector from a remembered one.
 */
export interface SecretShape {
  /** Stable across builds: it is half of every candidate id. */
  id: string;
  /** What a person calls it. */
  title: string;
  /** `false` for the thirteen `seq:46` names; `true` for what this build added. */
  added: boolean;
  /** Why this shape, and what it is likely to be wrong about. */
  note: string;
  /** Global, applied to one decoded string at a time. */
  pattern: RegExp;
  /** Which capture group holds the value itself. `0` is the whole match. */
  group: number;
}

/**
 * **The shapes, most specific first — and the order is load-bearing.**
 *
 * A vendor prefix and a generic `secret=` assignment routinely match the same
 * bytes: `Authorization: Bearer sk-ant-…` is three shapes at once. Matches are
 * resolved by taking shapes in THIS order and dropping any that overlaps one
 * already taken, so the candidate a person reads is labelled by the narrowest
 * shape that explains it rather than by whichever regex ran first. The generic
 * assignment forms are therefore last, and they are last on purpose: they are
 * where nearly all of the false positives live, and a false positive labelled
 * `key-assignment` is one a reader dismisses in a second.
 */
export const SECRET_SHAPES: SecretShape[] = [
  {
    id: 'anthropic-key',
    title: 'Anthropic API key',
    added: false,
    note: 'sk-ant-… — the shape of the key `plan:archive seq:27` found already on screen, read '
      + 'out of ~/.claude.json by a `cat` whose result the transcript kept whole.',
    pattern: /sk-ant-[A-Za-z0-9_-]{16,}/g,
    group: 0,
  },
  {
    id: 'openai-key',
    title: 'OpenAI API key',
    added: false,
    note: 'sk-… and sk-proj-…. Anthropic keys share the prefix and are matched by the shape '
      + 'above, which is why that one is declared first.',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
    group: 0,
  },
  {
    id: 'github-token',
    title: 'GitHub token',
    added: false,
    note: 'ghp_/gho_/ghu_/ghs_/ghr_ and the fine-grained github_pat_ form.',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g,
    group: 0,
  },
  {
    id: 'aws-access-key-id',
    title: 'AWS access key id',
    added: false,
    note: 'AKIA/ASIA/ABIA/ACCA and the A3T… form. The id alone is not the credential, but it '
      + 'names the account and it is what appears beside the secret.',
    pattern: /\b(?:AKIA|ASIA|ABIA|ACCA|A3T[A-Z0-9])[A-Z0-9]{16}\b/g,
    group: 0,
  },
  {
    id: 'slack-token',
    title: 'Slack token',
    added: false,
    note: 'xoxb-/xoxa-/xoxp-/xoxr-/xoxs-.',
    pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
    group: 0,
  },
  {
    id: 'google-api-key',
    title: 'Google API key',
    added: false,
    note: 'AIza followed by 35 characters — a fixed length, so this shape is one of the few '
      + 'here with a genuinely low false-positive rate.',
    pattern: /\bAIza[0-9A-Za-z_-]{35}/g,
    group: 0,
  },
  {
    id: 'pem-private-key',
    title: 'PEM private key block',
    added: false,
    note: 'The WHOLE block, header to footer, and not just the BEGIN line — replacing the '
      + 'header alone would leave the key material sitting under a placeholder that says it was '
      + 'removed, which is the worst of both answers.',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    group: 0,
  },
  {
    id: 'jwt',
    title: 'JSON Web Token',
    added: false,
    note: 'header.payload.signature, base64url. A JWT in a transcript is usually an access '
      + 'token that has since expired; whether that matters is his call, not this list\'s.',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    group: 0,
  },
  {
    id: 'stripe-key',
    title: 'Stripe key or webhook secret',
    added: true,
    note: 'ADDED past the thirteen. sk_live_/rk_live_/sk_test_/rk_test_ and whsec_. The live '
      + 'forms are the only ones here that move money.',
    pattern: /\b(?:(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,})/g,
    group: 0,
  },
  {
    id: 'npm-token',
    title: 'npm access token',
    added: true,
    note: 'ADDED past the thirteen. npm_ plus 36 characters. This project publishes a plugin, '
      + 'so a publish token on a command line is a shape it can actually produce.',
    pattern: /\bnpm_[A-Za-z0-9]{36}\b/g,
    group: 0,
  },
  {
    id: 'google-oauth-secret',
    title: 'Google OAuth client secret',
    added: true,
    note: 'ADDED past the thirteen. GOCSPX-… , which the Google API key shape does not cover.',
    pattern: /\bGOCSPX-[A-Za-z0-9_-]{20,}/g,
    group: 0,
  },
  {
    id: 'sendgrid-key',
    title: 'SendGrid API key',
    added: true,
    note: 'ADDED past the thirteen. SG.<id>.<secret>, which reads like a JWT and is not one.',
    pattern: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g,
    group: 0,
  },
  {
    id: 'json-credential-field',
    title: 'a credential named by a JSON field',
    added: true,
    note: 'ADDED past the thirteen, and it is the shape that would have caught the key '
      + '`seq:27` actually found: primaryApiKey, accessToken, refreshToken, clientSecret, '
      + 'private_key and their spellings, matched by the FIELD NAME rather than by the value, '
      + 'so a credential with no recognisable prefix is still proposed.',
    pattern:
      /"(?:primaryApiKey|accessToken|access_token|refreshToken|refresh_token|idToken|id_token|clientSecret|client_secret|private_key|privateKey|apiKey|api_key|password)"\s*:\s*"([^"]{8,})"/g,
    group: 1,
  },
  {
    id: 'aws-secret-access-key',
    title: 'AWS secret access key',
    added: false,
    note: 'The 40-character secret, found by the name beside it — the value alone is '
      + 'indistinguishable from any other base64 run.',
    pattern: /aws_secret_access_key\s*[=:]\s*["']?([A-Za-z0-9/+=]{40})/gi,
    group: 1,
  },
  {
    id: 'exported-token',
    title: 'export of a *_TOKEN / *_KEY / *_SECRET',
    added: false,
    note: '`export GEMINI_API_KEY=…` and its family. `seq:27` found five of these on the '
      + 'already-captured tool-result path.',
    pattern: /\bexport\s+[A-Z][A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD|PASSWD)\s*=\s*["']?([^\s"']{6,})/g,
    group: 1,
  },
  {
    id: 'bearer-header',
    title: 'a Bearer credential',
    added: false,
    note: 'The token after `Bearer`, not the word. The ONE true positive of 2026-09-08 was of '
      + 'this shape: a lane curling this product\'s own UI server with its auth token on the '
      + 'command line, captured in a subagent transcript.',
    pattern: /\b[Bb]earer\s+([A-Za-z0-9._~+/=-]{16,})/g,
    group: 1,
  },
  {
    id: 'url-userinfo',
    title: 'a password inside a URL',
    added: false,
    note: 'scheme://user:PASSWORD@host. Only the password is proposed, so a redacted URL still '
      + 'says which user and which host — which is usually the part worth keeping.',
    pattern: /\b[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/\s:@]+:([^/\s:@]{1,200})@/g,
    group: 1,
  },
  {
    id: 'local-auth-hex',
    title: 'a hex token named by what sits beside it',
    added: true,
    note: 'ADDED past the thirteen. A 32/40/64-character hex run with an auth-ish word within '
      + '24 characters before it. The keyword is the whole guard: this corpus is full of '
      + '16-character checksums and 40-character git shas, and an ungated hex shape would '
      + 'propose every one of them.',
    pattern:
      /(?:token|auth|bearer|secret|password|apikey|api_key)[^A-Za-z0-9]{0,24}([0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64})\b/gi,
    group: 1,
  },
  {
    id: 'key-assignment',
    title: 'an assignment to something called key, secret, token or password',
    added: false,
    note: 'The widest shape and the noisiest, declared LAST so anything a narrower shape '
      + 'explains is labelled by that one instead. This is where `secret = cryptoRandomBytes` '
      + 'lands, and that match is the point rather than a bug: it costs one unticked box.',
    pattern:
      /\b(?:api[_-]?key|secret|password|passwd|passphrase|token|access[_-]?key)\s*[=:]\s*["']?([A-Za-z0-9._~+/=-]{8,})/gi,
    group: 1,
  },
];

/** One shape's match inside one decoded string. */
export interface SecretMatch {
  shape: string;
  value: string;
  /** Offset of the VALUE inside the string it was found in. */
  start: number;
  end: number;
}

/**
 * The mark every placeholder carries, and the reason it is spelled in shouting
 * capitals.
 *
 * `seq:46` step 4: *"Make the placeholder unmistakably fake so no reader ever
 * tries to use it, and so a diff against the original shows exactly what
 * moved."* Two readers have to be served at once — a person skimming, and a
 * `grep`. `FAKE-` in front puts it at the start of the token for the person;
 * `-NOT-A-REAL-VALUE` at the end survives a middle truncation; and both are
 * made of characters JSON never escapes, so the placeholder occupies exactly
 * the bytes it appears to and a diff is readable.
 */
const PLACEHOLDER_PREFIX = 'FAKE-';
const PLACEHOLDER_SUFFIX = '-NOT-A-REAL-VALUE';

/**
 * `FAKE-<shape>-<id>-NOT-A-REAL-VALUE` — a stand-in, never a deletion.
 *
 * A deletion changes the shape of the record and can break whatever reads it;
 * this keeps the file valid JSONL, keeps the record readable, and says out
 * loud that something was replaced. The `<id>` is what makes two occurrences
 * of one value visibly one value, and two different values visibly two.
 */
export function placeholderFor(shapeId: string, candidateId: string): string {
  return `${PLACEHOLDER_PREFIX}${shapeId}-${candidateId}${PLACEHOLDER_SUFFIX}`;
}

/** Is this text one of our own stand-ins? Nothing proposes a placeholder twice. */
export function isPlaceholder(text: string): boolean {
  return text.startsWith(PLACEHOLDER_PREFIX) && text.endsWith(PLACEHOLDER_SUFFIX);
}

/**
 * **A candidate's id is a hash of its value, and that is a security property
 * rather than a naming convention.**
 *
 * It makes the id stable — the same value proposes the same id on every scan,
 * so a choice made once applies to every occurrence and to every record
 * appended afterwards — and it makes every surface downstream of the scan free
 * of credential material. The report prints ids, the form ticks ids, the
 * accepted list is ids, and the redactor recovers the values by scanning the
 * file again rather than by being told them.
 *
 * Twelve hex characters. The population is the distinct credential-shaped
 * strings in one conversation, which is tens; 48 bits is not where this
 * design's risk lives.
 */
export function candidateId(shapeId: string, value: string): string {
  return createHash('sha256').update(`${shapeId} ${value}`).digest('hex').slice(0, 12);
}

/**
 * Every shape's matches in one string, with overlaps resolved by declaration
 * order.
 *
 * Pure, and the same function the scan and the redaction both call — which is
 * what makes an accepted id mean the same thing on both sides. A redactor with
 * its own matcher would eventually replace something the report never offered.
 */
export function matchSecrets(text: string): SecretMatch[] {
  if (text.length < 8) return [];
  const taken: SecretMatch[] = [];
  for (const shape of SECRET_SHAPES) {
    for (const found of text.matchAll(shape.pattern)) {
      const whole = found[0];
      const value = shape.group === 0 ? whole : found[shape.group];
      if (value === undefined || value.length === 0) continue;
      if (isPlaceholder(value)) continue;
      const at = found.index + (shape.group === 0 ? 0 : whole.indexOf(value));
      const end = at + value.length;
      if (taken.some((m) => at < m.end && m.start < end)) continue;
      taken.push({ shape: shape.id, value, start: at, end });
    }
  }
  return taken.sort((a, b) => a.start - b.start);
}

/**
 * What a reader is shown instead of the value: the first and last four
 * characters of anything long enough for that to be uninformative on its own,
 * and nothing at all below that length.
 *
 * The prefix is what tells a person `sk-ant-…` from `sk-proj-…` without the
 * report carrying either whole, and the length is what tells a 32-character
 * token from a word that happened to sit after `secret=`.
 */
export function maskSecret(value: string): string {
  const flat = value.replace(/\s+/g, ' ');
  if (flat.length < 16) return '*'.repeat(flat.length);
  return `${flat.slice(0, 4)}…${flat.length - 8} more…${flat.slice(-4)}`;
}

/** How much text either side of a match a candidate carries as its context. */
const CONTEXT_RADIUS = 48;

/**
 * The text around a match, with EVERY match in the window masked — including
 * the one being described and any other that happens to sit beside it.
 *
 * This is the field that does the actual work of the form. The shape and the
 * count say what a candidate is; the context is what tells
 * `secret = cryptoRandomBytes` from a credential, and that distinction is the
 * whole reason a person is being asked.
 */
export function contextAround(text: string, match: SecretMatch): string {
  const from = Math.max(0, match.start - CONTEXT_RADIUS);
  const to = Math.min(text.length, match.end + CONTEXT_RADIUS);
  const window = text.slice(from, to);
  let masked = '';
  let at = 0;
  for (const found of matchSecrets(window)) {
    masked += window.slice(at, found.start) + maskSecret(found.value);
    at = found.end;
  }
  masked += window.slice(at);
  const head = from > 0 ? '…' : '';
  const tail = to < text.length ? '…' : '';
  return `${head}${masked.replace(/\s+/g, ' ').trim()}${tail}`;
}

/**
 * **Replace exactly what was accepted, and return the input unchanged when
 * nothing was.**
 *
 * The identity on an empty set is not an optimisation; it is the guarantee
 * `seq:46` asks for in as many words — *"Nothing is replaced by default — an
 * export he did not read must be byte-faithful"* — expressed at the one place
 * it can be tested rather than promised. The whole redaction path is built on
 * top of this function returning its argument.
 */
export function redactString(
  text: string, accepted: ReadonlySet<string>,
): { text: string; replaced: number; ids: string[] } {
  if (accepted.size === 0) return { text, replaced: 0, ids: [] };
  const matches = matchSecrets(text);
  if (matches.length === 0) return { text, replaced: 0, ids: [] };
  let out = '';
  let at = 0;
  let replaced = 0;
  const ids: string[] = [];
  for (const match of matches) {
    const id = candidateId(match.shape, match.value);
    if (!accepted.has(id)) continue;
    out += text.slice(at, match.start) + placeholderFor(match.shape, id);
    at = match.end;
    replaced += 1;
    if (!ids.includes(id)) ids.push(id);
  }
  if (replaced === 0) return { text, replaced: 0, ids: [] };
  return { text: out + text.slice(at), replaced, ids };
}

/**
 * One record's strings, redacted in place on a COPY — the pure half of the
 * export.
 *
 * Values only, never keys: a key is structure, and a structure that moved
 * under a placeholder would break the reader this is trying to keep working.
 */
function redactValue(
  value: unknown, accepted: ReadonlySet<string>, report: { replaced: number; ids: string[] },
): unknown {
  if (typeof value === 'string') {
    const done = redactString(value, accepted);
    report.replaced += done.replaced;
    for (const id of done.ids) if (!report.ids.includes(id)) report.ids.push(id);
    return done.text;
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item, accepted, report));
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = redactValue(inner, accepted, report);
    }
    return out;
  }
  return value;
}

/**
 * **One transcript line in, one transcript line out — and BYTE-IDENTICAL
 * unless something accepted was actually in it.**
 *
 * A line that changes is re-serialised, which can reorder nothing and can
 * still reformat whitespace the harness wrote; a line that does not change is
 * returned as the same string object it arrived as, so the caller writes the
 * ORIGINAL BYTES back. That asymmetry is deliberate and it is what keeps the
 * default export exact: with an empty accepted set every line takes the second
 * path, and the copy is the file.
 *
 * A line that will not parse is returned unchanged and counted by the caller.
 * The alternative — a regex over the raw JSON text — would replace inside keys
 * and inside escapes, and would be a silent alteration of a record nobody
 * could check.
 */
export function redactLine(
  line: string, accepted: ReadonlySet<string>,
): { text: string; replaced: number; ids: string[]; unreadable: boolean } {
  if (accepted.size === 0) return { text: line, replaced: 0, ids: [], unreadable: false };
  let record: unknown;
  try {
    record = JSON.parse(line);
  } catch {
    return { text: line, replaced: 0, ids: [], unreadable: true };
  }
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    return { text: line, replaced: 0, ids: [], unreadable: true };
  }
  const report = { replaced: 0, ids: [] as string[] };
  const redacted = redactValue(record, accepted, report);
  if (report.replaced === 0) return { text: line, replaced: 0, ids: [], unreadable: false };
  return { text: JSON.stringify(redacted), replaced: report.replaced, ids: report.ids, unreadable: false };
}

/**
 * **One distinct value that looks private** — the unit a checkbox sits beside.
 *
 * The unit is the VALUE and not the occurrence, because that is the question a
 * person is being asked: *is this thing a secret*, once, however many times it
 * appears. `occurrences` is then the number that tells a real credential from
 * a one-off paste, and the record list is what lets a form link to where it
 * appears.
 */
export interface SecretCandidate {
  /** The checkbox's value, and the only handle the redactor needs. */
  id: string;
  shape: string;
  shapeTitle: string;
  /** `true` when this shape is one this build added past `seq:46`'s thirteen. */
  added: boolean;
  /** What it looks like, with the middle withheld. Never the value. */
  preview: string;
  /** Characters in the value — the part a mask cannot carry. */
  length: number;
  /** How many times the value appears across the session. */
  occurrences: number;
  /** Records it appears in, capped; `recordsOmitted` says how many are not listed. */
  records: number[];
  recordsOmitted: number;
  firstRecord: number;
  lastRecord: number;
  /** Where inside those records — `message.content[0].input.command`. Capped. */
  paths: string[];
  /** Text around the first few occurrences, every match in it masked. Capped. */
  contexts: string[];
  /** What it becomes if it is ticked. Shown BEFORE the choice, not after. */
  placeholder: string;
}

/** What one pass over one session found. */
export interface SecretScan {
  file: string;
  /** Records read. */
  records: number;
  /** Lines that would not parse — counted, never skipped. */
  unreadable: number;
  scannedBytes: number;
  /** The scan stopped at the cap rather than at the end of the file. */
  truncated: boolean;
  /** Total occurrences, which is at least `candidates.length`. */
  occurrences: number;
  candidates: SecretCandidate[];
  ms: number;
}

/** How many records, paths and contexts one candidate carries. */
const PER_CANDIDATE_CAP = 8;

/** Walk one record's strings, handing each to `visit` with its path. */
function walkStrings(
  value: unknown, path: string, visit: (text: string, path: string) => void,
): void {
  if (typeof value === 'string') { visit(value, path); return; }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) walkStrings(value[i], `${path}[${i}]`, visit);
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      walkStrings(inner, path === '' ? key : `${path}.${key}`, visit);
    }
  }
}

/** A candidate under construction — the grouping the report is built from. */
interface Building {
  shape: string;
  value: string;
  occurrences: number;
  records: number[];
  recordsOmitted: number;
  paths: string[];
  contexts: string[];
  firstRecord: number;
  lastRecord: number;
}

/**
 * **Read one session and propose what looks private.**
 *
 * Reads through `iterateTranscript`, so it inherits the archive's own bounded
 * chunked read, its `MAX_SCAN_BYTES` cap and its refusal to throw on a file
 * that will not open — a scan that aborted on one bad record would report
 * nothing and look like a clean session, which is the failure mode this whole
 * feature exists to avoid.
 *
 * The candidates come back ordered by how many times each appears and then by
 * id, so the list a person reads is stable between runs and the thing that
 * appears twenty times is at the top.
 */
export function scanSessionSecrets(
  file: string, options: { cap?: number } = {},
): SecretScan {
  const startedMs = Date.now();
  const cursor: TranscriptCursor = { scannedBytes: 0, reachedEnd: false, unreadable: 0 };
  const cap = options.cap ?? MAX_SCAN_BYTES;
  const building = new Map<string, Building>();
  let records = 0;
  let occurrences = 0;

  for (const entry of iterateTranscript(file, { cap, cursor })) {
    records += 1;
    if (entry.record === null) continue;
    walkStrings(entry.record, '', (text, path) => {
      for (const match of matchSecrets(text)) {
        const id = candidateId(match.shape, match.value);
        occurrences += 1;
        let held = building.get(id);
        if (held === undefined) {
          held = {
            shape: match.shape,
            value: match.value,
            occurrences: 0,
            records: [],
            recordsOmitted: 0,
            paths: [],
            contexts: [],
            firstRecord: entry.index,
            lastRecord: entry.index,
          };
          building.set(id, held);
        }
        held.occurrences += 1;
        held.lastRecord = entry.index;
        if (!held.records.includes(entry.index)) {
          if (held.records.length < PER_CANDIDATE_CAP) held.records.push(entry.index);
          else held.recordsOmitted += 1;
        }
        if (held.paths.length < PER_CANDIDATE_CAP && !held.paths.includes(path)) {
          held.paths.push(path);
        }
        if (held.contexts.length < PER_CANDIDATE_CAP) {
          const context = contextAround(text, match);
          if (!held.contexts.includes(context)) held.contexts.push(context);
        }
      }
    });
  }

  const candidates: SecretCandidate[] = [...building]
    .map(([id, held]) => {
      const shape = SECRET_SHAPES.find((s) => s.id === held.shape);
      return {
        id,
        shape: held.shape,
        shapeTitle: shape?.title ?? held.shape,
        added: shape?.added ?? false,
        preview: maskSecret(held.value),
        length: held.value.length,
        occurrences: held.occurrences,
        records: held.records,
        recordsOmitted: held.recordsOmitted,
        firstRecord: held.firstRecord,
        lastRecord: held.lastRecord,
        paths: held.paths,
        contexts: held.contexts,
        placeholder: placeholderFor(held.shape, id),
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences || a.id.localeCompare(b.id));

  return {
    file,
    records,
    unreadable: cursor.unreadable,
    scannedBytes: cursor.scannedBytes,
    truncated: !cursor.reachedEnd,
    occurrences,
    candidates,
    ms: Date.now() - startedMs,
  };
}
