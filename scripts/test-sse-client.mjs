import assert from "node:assert/strict";
import {
  createConnectionRecoveryTracker,
  createDebouncedInvalidator,
  getReconnectDelay,
  parseSseBlock,
} from "../src/lib/event-stream.ts";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const heartbeat = parseSseBlock(": heartbeat");
assert.equal(heartbeat, null);

const parsed = parseSseBlock(
  'event: invalidation\r\ndata: {"topic":"orders.changed"}\r\n',
);
assert.deepEqual(parsed, {
  event: "invalidation",
  data: '{"topic":"orders.changed"}',
});

let refreshCount = 0;
const debounced = createDebouncedInvalidator(() => {
  refreshCount += 1;
}, 30);
debounced.schedule();
debounced.schedule();
debounced.schedule();
await wait(60);
assert.equal(refreshCount, 1, "rapid events should coalesce into one refresh");

debounced.schedule();
debounced.cancel();
await wait(60);
assert.equal(refreshCount, 1, "cancel should prevent refresh after unmount");

assert.deepEqual(
  [0, 1, 2, 3, 4, 9].map((attempt) => getReconnectDelay(attempt)),
  [1_000, 2_000, 4_000, 8_000, 15_000, 15_000],
);
let recoveryRefreshes = 0;
const recovery = createConnectionRecoveryTracker(() => {
  recoveryRefreshes += 1;
});
assert.equal(recovery.markConnected(), false);
assert.equal(recoveryRefreshes, 0);
assert.equal(recovery.markConnected(), true);
assert.equal(recoveryRefreshes, 1);

console.log(JSON.stringify({
  sseFrameParsing: "pass",
  heartbeatIgnored: "pass",
  debounceCoalescing: "pass",
  debounceCleanup: "pass",
  reconnectBackoff: "pass",
  reconnectRecoveryRefresh: "pass",
}, null, 2));
