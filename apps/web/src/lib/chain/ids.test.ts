// Run: node --test src/lib/chain/ids.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { batchIdOf, dayToSeconds, projectIdOf, toHundredths } from "./ids.ts";

test("project id is the uuid in a bytes32", () => {
  assert.equal(projectIdOf("0f8fad5b-d9cb-469f-a165-70867728950e"), "0x0f8fad5bd9cb469fa16570867728950e00000000000000000000000000000000");
  assert.throws(() => projectIdOf("nope"));
});

test("dates and quantities", () => {
  assert.equal(dayToSeconds("2024-07-01"), 1719792000n);
  assert.equal(toHundredths(800), 80000n);
  assert.equal(toHundredths(12.34), 1234n);
  assert.throws(() => toHundredths(0));
});

test("batch id matches the deployed contract's batchIdOf", () => {
  // Value returned by BlueCarbonRegistry.batchIdOf on Sepolia (0x9941…b031) for these inputs.
  const pid = projectIdOf("0f8fad5b-d9cb-469f-a165-70867728950e");
  assert.equal(batchIdOf(pid, 1719792000n, 1751328000n), 4650809286546554706887605645468933379269972617518631675833838939587303911835n);
});
