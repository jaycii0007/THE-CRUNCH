import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/receipt.ts", import.meta.url), "utf8");
const receiptModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: receiptModule.exports });
const receipt = {
  id: 41, transactionId: "100111626001", orderNumber: "#1041", invoiceNumber: "0000311",
  orderDate: "2026-11-16T01:00:00Z", orderType: "dine-in", currentStatus: "Queued", currentPaymentStatus: "Paid",
  items: [{ productName: "Chicken Meal", quantity: 1, unitPrice: 110, subtotal: 110, includedSelections: [{ kind: "drinks", name: "Coke solo", qty: 1 }] }],
  subtotal: 110, discount: { amount: 0, rate: 0 }, tax: { amount: 10, rate: 10 }, serviceCharge: { amount: 0, rate: 0 }, total: 110,
  paymentMethod: "cash", amountPaid: 110, cashTendered: 150, change: 40,
  customer: { soldTo: "Juan & Family" }, orderNote: "Extra crispy", currency: "PHP", cashierName: "Cashier One",
  merchant: { name: "The Crunch", timezone: "Asia/Manila" },
};
for (const invoiceNumber of ["0000311", "0000310", "I010016RCHG"]) {
  const snapshot = { ...receipt, invoiceNumber };
  const original = JSON.stringify(snapshot);
  const html = receiptModule.exports.buildReceiptHtml(snapshot);
  const sections = ["<h1>", "Transaction ID", "Invoice No.", "Description", "Chicken Meal", "Coke solo", "Total Sales", "Included tax", "Total Due", "Cash Tendered", "Change", "Customer information", "THANK YOU!"];
  const positions = sections.map((section) => html.indexOf(section));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.equal((html.match(/Customer information/g) ?? []).length, 1);
  assert.match(html, /Sold To \/ Registered Name:<\/b> Juan &amp; Family/);
  assert.match(html, /TIN:<\/b> ________________________/);
  assert.match(html, /Business Address:<\/b> ________________________/);
  assert.ok(html.includes(invoiceNumber) && html.includes(receipt.transactionId));
  assert.match(html, /class="customer"[\s\S]*?<\/div>\s*<hr class="d"\/>\s*<p[^>]*>THANK YOU!/);
  assert.equal(JSON.stringify(snapshot), original, "rendering must not modify historical receipt data");
}
assert.match(readFileSync(new URL("../src/components/receipt-viewer-modal.tsx", import.meta.url), "utf8"), /buildReceiptHtml\(receipt\)/);
const cashierSource = readFileSync(new URL("../src/pages/menu.tsx", import.meta.url), "utf8");
assert.match(cashierSource, /printHtml\(buildReceiptHtml\(/);
assert.match(cashierSource, /downloadHtml\(\s*buildReceiptHtml\(/);
assert.match(readFileSync(new URL("../src/pages/sales-reports.tsx", import.meta.url), "utf8"), /order.invoiceNumber \|\|/);
console.log("Receipt layout, shared view/print/download renderer, leading-zero and historical invoice preservation passed");
