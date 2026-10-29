import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const helperPath = new URL("../src/lib/financialStatus.ts", import.meta.url);
const source = readFileSync(helperPath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const testModule = { exports: {} };
vm.runInNewContext(compiled, {
  module: testModule,
  exports: testModule.exports,
});

const {
  isActiveOrder,
  isFinalizedSale,
  isPendingOrder,
  summarizeFinancialOrders,
} = testModule.exports;

const cases = [
  ["Pending", "Pending Payment", false, true, true],
  ["Queued", "Paid", false, true, false],
  ["Preparing", "Paid", false, true, false],
  ["Ready", "Paid", false, true, false],
  ["Completed", "Paid", true, false, false],
  ["Cancelled", "Paid", false, false, false],
  ["Refunded", "Paid", false, false, false],
];

for (const [status, paymentStatus, finalized, active, pending] of cases) {
  const order = { id: status, status, paymentStatus, total: 100 };
  assert.equal(isFinalizedSale(order), finalized, `${status} finalized`);
  assert.equal(isActiveOrder(order), active, `${status} active`);
  assert.equal(isPendingOrder(order), pending, `${status} pending`);
}

const summary = summarizeFinancialOrders([
  { id: 1, status: "Pending", paymentStatus: "Pending Payment", total: 90 },
  { id: 2, status: "Queued", paymentStatus: "Paid", total: 100 },
  { id: 2, status: "Completed", paymentStatus: "Paid", total: 100 },
  { id: 3, status: "Completed", paymentStatus: "Paid", total: 200 },
  { id: 4, status: "Cancelled", paymentStatus: "Paid", total: 300 },
  { id: 5, status: "Refunded", paymentStatus: "Paid", total: 400 },
  { id: 3, status: "Completed", paymentStatus: "Paid", total: 200 },
]);

assert.equal(summary.totalOrders, 5, "duplicate order IDs count once");
assert.equal(summary.finalizedSalesCount, 2);
assert.equal(summary.totalSales, 300);
assert.equal(summary.averageOrderValue, 150);
assert.equal(summary.activeOrders, 1);
assert.equal(summary.pendingOrders, 1);
assert.equal(summary.cancelledOrders, 1);
assert.equal(summary.refundedOrders, 1);

const dashboard = readFileSync(
  new URL("../src/pages/index.tsx", import.meta.url),
  "utf8",
);
const reports = readFileSync(
  new URL("../src/pages/sales-reports.tsx", import.meta.url),
  "utf8",
);
assert.match(dashboard, /summarizeFinancialOrders\(filteredOrders\)/);
assert.match(reports, /isFinalizedSale/);

console.log("Financial correctness regression tests passed");
