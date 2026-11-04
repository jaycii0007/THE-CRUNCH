import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const cashier = read("src/pages/menu.tsx");
const reports = read("src/pages/sales-reports.tsx");

assert.match(cashier, /value: "grabfood", label: "GrabFood"/);
assert.match(cashier, /value: "foodpanda", label: "foodpanda"/);
assert.match(cashier, /setPlatformReference\("GF-"\)/);
assert.match(
  cashier,
  /setPlatformReference\(paymentMethod === "grabfood" \? "GF-" : ""\)/,
);
assert.match(cashier, /Complete the GrabFood reference after GF-/);
assert.match(cashier, /Enter complete Foodpanda order reference/);
assert.match(cashier, /no prefix is added/);
assert.match(cashier, /PLATFORM_REFERENCE_PATTERN/);
assert.match(cashier, /\^\[A-Za-z0-9\]\+\(\?:-\[A-Za-z0-9\]\+\)\*\$/);
assert.match(cashier, /MAX_PLATFORM_REFERENCE_LENGTH = 255/);
assert.doesNotMatch(cashier, /5 to 15|5–15|slice\(0, 15\)/);
assert.doesNotMatch(cashier, /setPlatformReference\("FP-"\)/);
assert.match(cashier, /payment_reference: platformReference\.trim\(\)/);
assert.match(cashier, /order\.paymentReference \|\| "—"/);
assert.match(reports, /Platform Reference/);
assert.match(reports, /order\.paymentReference \|\| "—"/);

console.log("Cashier third-party delivery reference checks passed");
