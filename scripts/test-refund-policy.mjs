import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const financialSource = readFileSync(
  new URL("../src/lib/financialStatus.ts", import.meta.url),
  "utf8",
);
const financialCompiled = ts.transpileModule(financialSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const financialModule = { exports: {} };
vm.runInNewContext(financialCompiled, {
  module: financialModule,
  exports: financialModule.exports,
});

const refundSource = readFileSync(
  new URL("../src/lib/refundEligibility.ts", import.meta.url),
  "utf8",
).replace(
  /import \{ isPaidPaymentStatus \} from "@\/lib\/financialStatus";/,
  "const { isPaidPaymentStatus } = require('financialStatus');",
);
const refundCompiled = ts.transpileModule(refundSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const refundModule = { exports: {} };
vm.runInNewContext(refundCompiled, {
  module: refundModule,
  exports: refundModule.exports,
  require(id) {
    if (id === "financialStatus") return financialModule.exports;
    throw new Error(`Unexpected test import: ${id}`);
  },
});

const { getRefundEligibility, getSettlementAction } = refundModule.exports;
const cases = [
  ["Pending Payment", "Pending Payment", false, "cancel"],
  ["Queued", "Paid", true, "refund"],
  ["Preparing", "Paid", false, null],
  ["Ready", "Paid", false, null],
  ["Completed", "Paid", false, null],
  ["Picked Up", "Paid", false, null],
  ["Refunded", "Paid", false, null],
  ["Cancelled", "Paid", false, null],
];

for (const [status, paymentStatus, eligible, action] of cases) {
  const order = { status, paymentStatus };
  assert.equal(getRefundEligibility(order).eligible, eligible, `${status} eligibility`);
  assert.equal(getSettlementAction(order), action, `${status} action`);
}

const revertedAfterPreparation = {
  status: "Queued",
  paymentStatus: "Paid",
  prepStartedAt: Date.now(),
};
assert.equal(getRefundEligibility(revertedAfterPreparation).eligible, false);
assert.equal(getSettlementAction(revertedAfterPreparation), null);

for (const file of [
  "src/pages/menu.tsx",
  "src/pages/Order.tsx",
  "src/pages/sales-reports.tsx",
  "src/components/AdminRefundNotificationCenter.tsx",
]) {
  assert.match(
    readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
    /refundEligibility/,
    `${file} must use the shared refund policy`,
  );
}

console.log("Frontend refund policy regression tests passed");
