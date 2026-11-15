import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const receiptSource = read("src/lib/receipt.ts");
const compiled = ts.transpileModule(receiptSource, {
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
const { buildReceiptHtml } = testModule.exports;

const receipt = {
  id: 41,
  transactionId: "TSN-QUEUE-41",
  orderNumber: "ORD-000041",
  orderDate: "2026-11-06T10:00:00.000Z",
  orderType: "dine-in",
  currentStatus: "Queued",
  currentPaymentStatus: "Paid",
  items: [{ productName: "Chicken Meal", quantity: 1, unitPrice: 100, subtotal: 100, note: null }],
  subtotal: 100,
  discount: { name: null, rate: 0, amount: 0 },
  tax: { rate: 0, amount: 0 },
  serviceCharge: { rate: 0, amount: 0 },
  total: 100,
  paymentMethod: "cash",
  amountPaid: 100,
  cashTendered: 100,
  change: 0,
  customerType: null,
  customer: { soldTo: null },
  tableNumber: null,
  orderNote: "Extra spicy please\nKeep sauce separate",
  currency: "PHP",
  cashierName: "Cashier One",
  merchant: {
    name: "The Crunch",
    tagline: null,
    email: null,
    phone: null,
    address: null,
    timezone: "Asia/Manila",
  },
  isLegacyReceipt: false,
  usesCurrentProductNameFallback: false,
  missingHistoricalFields: [],
};

const walkInHtml = buildReceiptHtml(receipt);
const includedHtml = buildReceiptHtml({ ...receipt, items: [{ ...receipt.items[0], includedSelections: [{ kind: 'drinks', name: 'Lychee <Drink>', qty: 1 }] }] });
assert.match(includedHtml, /Included Drink: Lychee &lt;Drink&gt; x1/);
assert.equal((includedHtml.match(/100\.00/g) || []).length, (walkInHtml.match(/100\.00/g) || []).length, 'Included selection adds no independently charged receipt row');
assert.match(
  walkInHtml,
  /Sold To \/ Registered Name:<\/b> ________________________<\/p><p><b>TIN:<\/b>/,
  "walk-in Sold To must stay blank",
);
assert.match(walkInHtml, /<b>Note:<\/b> Extra spicy please\nKeep sauce separate/);
assert.equal(
  (walkInHtml.match(/THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX/g) || []).length,
  1,
  "the exact input-tax disclaimer must appear once in the shared receipt HTML",
);
assert.match(walkInHtml, /<b>TIN:<\/b> ________________________/);
assert.match(walkInHtml, /<b>Business Address:<\/b> ________________________/);

const onlineHtml = buildReceiptHtml({
  ...receipt,
  customer: { soldTo: "Juan Dela Cruz" },
});
assert.match(onlineHtml, /Sold To \/ Registered Name:<\/b> Juan Dela Cruz/);
assert.doesNotMatch(
  onlineHtml,
  /Sold To \/ Registered Name:<\/b> Extra spicy please/,
  "order notes must never render as customer identity",
);

const menuSource = read("src/pages/menu.tsx");
assert.match(menuSource, /const \[orderNote, setOrderNote\] = useState\(""\)/);
assert.match(menuSource, /const \[soldToName, setSoldToName\] = useState\(""\)/);
assert.match(menuSource, /customer_name: soldToName\.trim\(\)/);
assert.match(menuSource, /order_note: orderNote\.trim\(\)/);
assert.doesNotMatch(menuSource, /customer_name:\s*orderNote/);

const cookSource = read("src/pages/Order.tsx");
assert.match(cookSource, /aria-label=\{showNotes \? "Hide order notes" : "Show order notes"\}/);
assert.match(cookSource, /aria-controls=\{`order-notes-\$\{order\.id\}`\}/);
assert.match(cookSource, /event\.key === "Escape"/);
assert.match(cookSource, /whitespace-pre-wrap/);
assert.match(cookSource, /useEventInvalidation\(\{ topics: \["orders\.changed", "payments\.changed"\]/);
assert.match(cookSource, /api\.get<OrderCard\[]>\("\/orders\/queue"\)/);

for (const sourcePath of [
  "src/components/receipt-viewer-modal.tsx",
  "src/pages/menu.tsx",
]) {
  assert.match(read(sourcePath), /buildReceiptHtml/);
}
assert.match(read("src/pages/sales-reports.tsx"), /<ReceiptViewerModal/);

console.log("Order notes and shared receipt regression tests passed");
