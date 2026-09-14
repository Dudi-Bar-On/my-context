// @basis TASK-two-nonces-are-both-plain-strings-so-either-store-redeems, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The two nonces are two TYPES, and this file is the proof — at compile
 * time, because that is the only time the claim can be false.**
 *
 * `TASK-two-nonces-are-both-plain-strings-so-either-store-redeems` measured the
 * defect: `NonceStore.redeem` and `ExecutionNonceStore.redeem` both took a
 * plain `string`, so `handoffNonces.redeem(executionNonce)` compiled and so did
 * the mirror image. Neither would have SUCCEEDED — the stores are separate
 * `Map`s and always were — which is exactly why a runtime test cannot hold this
 * guarantee up. A test that feeds one store the other's token and asserts
 * `false` passes just as happily when the types are interchangeable, because it
 * is measuring the Map lookup and not the signature. **The signature is the
 * subject, so the assertion has to be a compile error.**
 *
 * So every assertion below is a `@ts-expect-error`, and `npm run typecheck` is
 * what runs them: that directive is itself an error when the line beneath it
 * COMPILES, which makes each one a two-sided assertion — it reddens if the
 * brands stop being distinct, and it reddens if the code it guards stops being
 * a type error for any other reason. The `test()` bodies exist only so the file
 * is a real member of the suite and so the runtime half (the brands erase, and
 * a nonce is still a `string` on the wire) is measured rather than asserted.
 *
 * Removal proofs for every directive here are recorded in the lane report:
 * each was removed in turn and `tsc` was watched to redden at that exact line.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asHandoffNonce, NonceStore } from '../../src/ui/security.ts';
import { asExecutionNonce, ExecutionNonceStore } from '../../src/ui/execute-nonce.ts';

test('a handoff nonce is not redeemable by the execution store — a COMPILE error', () => {
  const handoff = new NonceStore();
  const execution = new ExecutionNonceStore();
  const handoffNonce = handoff.mint(10_000, 0);

  // @ts-expect-error -- a HandoffNonce authorises a SESSION; this store authorises one command.
  execution.redeem(handoffNonce, 'pin', ['pin', 'A']);

  // The runtime half, which is all a non-type test could ever have said: it
  // refuses. True before the brands existed too — stated here so nobody later
  // mistakes this line for the guarantee the file is named for.
  assert.equal(
    execution.redeem(asExecutionNonce(handoffNonce), 'pin', ['pin', 'A']), false,
    'even coerced through the boundary door, a handoff nonce was never minted here',
  );
});

test('an execution nonce is not redeemable by the handoff store — a COMPILE error', () => {
  const handoff = new NonceStore();
  const execution = new ExecutionNonceStore();
  const executionNonce = execution.mint('pin', ['pin', 'A'], 10_000, 0);

  // @ts-expect-error -- the mirror image, and it has to be asserted separately:
  // two brands could be distinct in one direction and assignable in the other
  // if either were ever declared as a subtype of the other rather than as a
  // sibling.
  handoff.redeem(executionNonce, 0);

  assert.equal(
    handoff.redeem(asHandoffNonce(executionNonce), 0), false,
    'even coerced, an execution nonce was never minted by the handoff store',
  );
});

test('a bare string is not a credential to either store — two COMPILE errors', () => {
  const handoff = new NonceStore();
  const execution = new ExecutionNonceStore();

  // @ts-expect-error -- the door is `asHandoffNonce`, and there is no other way in.
  handoff.redeem('0'.repeat(32), 0);

  // @ts-expect-error -- the door is `asExecutionNonce`, and there is no other way in.
  execution.redeem('0'.repeat(32), 'pin', ['pin', 'A']);

  // This is the property that makes the brands worth having at all: an
  // unbranded 32-hex string is exactly what a JSON body carries, so if it were
  // assignable the boundary would have no boundary.
  assert.equal(handoff.redeem(asHandoffNonce('0'.repeat(32)), 0), false, 'still refused');
  assert.equal(
    execution.redeem(asExecutionNonce('0'.repeat(32)), 'pin', ['pin', 'A']), false,
    'still refused',
  );
});

/**
 * **What the brands cost at run time: nothing, and this is the measurement
 * rather than the assumption.**
 *
 * `CONST-node-24-no-build-step` allows only erasable syntax, and a brand that
 * survived erasure would break two things this product already relies on: the
 * nonce is interpolated into a URL fragment (`urlWithNonce`) and serialised
 * into a JSON body (`POST /api/nonce`). Both need a primitive `string`, not a
 * wrapper. So the test is `typeof` and a round trip through `JSON`, not a claim
 * in a comment.
 */
test('the brands erase: a minted nonce is a primitive string on the wire', () => {
  const handoffNonce = new NonceStore().mint(10_000, 0);
  const executionNonce = new ExecutionNonceStore().mint('pin', ['pin', 'A'], 10_000, 0);

  assert.equal(typeof handoffNonce, 'string', 'a handoff nonce is a primitive at run time');
  assert.equal(typeof executionNonce, 'string', 'an execution nonce is a primitive at run time');
  assert.match(handoffNonce, /^[0-9a-f]{32}$/, '128 bits of hex, unchanged by the brand');
  assert.match(executionNonce, /^[0-9a-f]{32}$/, '128 bits of hex, unchanged by the brand');

  // The two ways a nonce actually leaves this process.
  assert.equal(
    JSON.parse(JSON.stringify({ nonce: handoffNonce })).nonce, handoffNonce,
    'it round-trips through JSON as itself — no wrapper, no extra key',
  );
  assert.equal(
    new URL(`http://127.0.0.1:1/#${handoffNonce}`).hash.slice(1), handoffNonce,
    'and interpolates into a URL fragment exactly as before',
  );
  assert.deepEqual(
    Object.keys({ ...({ n: handoffNonce }) }), ['n'],
    'the phantom property is a type, so spreading a value carrying one adds nothing',
  );
});
