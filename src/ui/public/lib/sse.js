// src/ui/public/lib/sse.js
// Incremental SSE-frame parsing for a fetch()-reader stream. The page cannot
// use EventSource: EventSource sends no custom headers, and the token travels
// in X-Mycontext-Token on EVERY /api request (spec §2) — so the stream is a
// token-carrying fetch and this parser does what EventSource would have.
// No auto-reconnect lives here or anywhere: a closed stream is rendered as
// closed (spec §2 — silent reconnection reintroduces the daemon).
//
// **A frame is not "the bytes up to the next doubled newline".** A chunk off a
// socket splits wherever the socket flushed: mid-JSON, mid-field-name, between
// the two characters that end a frame, or one byte at a time. So this is a
// LINE machine — it consumes complete lines and dispatches on an empty one —
// and the whole of its state is three variables that survive between chunks.
// Written the short way, against `indexOf('\n\n')`, it works on our own server
// and on nothing else: the grammar's other two line terminators (CRLF, and a
// lone CR) never produce that pair, so such a parser delivers NOTHING over a
// stream that uses them, in silence.
//
// What it does with each field, and why:
//
//   `event:`  the frame's type — `hello`, `record`, `resync`, `fault`
//             (`ui/watch-model.ts` · `sseSend(res, 'hello', { pollMs: poll });` · ~445).
//   `data:`   the payload. Multiple `data:` lines in one frame are joined with
//             a newline, per the grammar. `sseSend` writes one line of
//             `JSON.stringify` output, which cannot contain a raw newline — a
//             newline inside a string arrives as the two characters `\` and
//             `n` — so the join is what the grammar says rather than what this
//             server needs, which is the point: the day a payload wraps, it
//             wraps correctly instead of silently losing a character.
//   `id:`     DROPPED, deliberately. It exists to be replayed as Last-Event-ID
//             on a reconnect, and the one thing this client must never do is
//             reconnect by itself.
//   `retry:`  DROPPED, for the same reason: it is a reconnection delay, and
//             there is no reconnection to delay.
//   `: …`     a comment (a keep-alive), and comments are not events.
//
// **A frame with no `data:` field at all dispatches nothing**, which is what
// keeps a keep-alive comment or a bare `retry:` from arriving at a screen as a
// phantom `message` event with no payload. A frame that carries `data:` with
// an EMPTY value does dispatch, with `null` — that is a server saying
// something, and swallowing it would be this parser deciding it did not.
//
// `JSON.parse` is allowed to throw. Every frame this server sends is JSON, so
// a payload that is not JSON is a broken stream, and a broken stream is
// reported rather than skipped (INV-nothing-is-dropped-silently). The frame's
// state is reset BEFORE the dispatch, so a throw — from the parse or from the
// consumer — cannot leave half a frame attached to the next one.

export function createSseParser(onEvent) {
  let buffer = '';
  let event = 'message';
  /** `null` until a `data:` field appears in the frame being assembled. */
  let data = null;

  const dispatch = () => {
    const [type, payload] = [event, data];
    event = 'message';
    data = null;
    if (payload === null) return;                      // no data field: not an event
    onEvent(type, payload === '' ? null : JSON.parse(payload));
  };

  const line = (text) => {
    if (text === '') return dispatch();
    if (text.startsWith(':')) return;                  // a comment — a keep-alive
    const colon = text.indexOf(':');
    const field = colon === -1 ? text : text.slice(0, colon);
    // One optional space after the colon belongs to the grammar, not to the
    // value; `sseSend` writes it and a hand-written frame may not.
    let value = colon === -1 ? '' : text.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data = data === null ? value : `${data}\n${value}`;
  };

  return (chunk) => {
    buffer += chunk;
    for (;;) {
      const match = /\r\n|\n|\r/.exec(buffer);
      if (match === null) break;
      // A lone CR at the very end of what has arrived is AMBIGUOUS — the next
      // byte may be the LF that makes it one CRLF terminator — so it is held
      // until more arrives rather than guessed at. Guessing splits one line
      // into two, and the second of them starts with a stray `\n` that no
      // field name matches, so the frame loses its payload.
      if (match[0] === '\r' && match.index === buffer.length - 1) break;
      const text = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      line(text);
    }
  };
}
