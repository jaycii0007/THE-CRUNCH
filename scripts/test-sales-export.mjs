import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const financial = { exports: {} };
vm.runInNewContext(compile(readFileSync(new URL("../src/lib/financialStatus.ts", import.meta.url), "utf8")), { exports: financial.exports });
const source = readFileSync(new URL("../src/pages/sales-reports.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("sales-reports.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["buildSalesExport", "salesReportMarkup", "normalizePaymentMethod", "parseDateSafe"];
const helpers = file.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
const constants = file.statements.filter((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((entry) => ["escapePrintHtml", "formatPrintCurrency"].includes(entry.name.getText(file))));
assert.equal(helpers.length, names.length);
const context = vm.createContext({
  isFinalizedSale: financial.exports.isFinalizedSale,
  formatCurrencyAmount: (value) => value.toFixed(2),
  formatInSettingsTimezone: (value) => new Date(value).toISOString().slice(0, 10),
});
vm.runInContext(compile([...helpers, ...constants].map((node) => node.getText(file)).join("\n")), context);
const base = { status: "Completed", paymentStatus: "Paid", date: "2026-11-15T01:00:00Z", invoiceNumber: "INV-OLD/031", orderNumber: "#901", discountAmount: 0 };
const input = [
  { ...base, id: 1, total: 90, discountAmount: 10, paymentCategory: "Cash" },
  { ...base, id: 1, total: 90, discountAmount: 10, paymentCategory: "Cash", items: [{ name: "Included Coke", quantity: 1 }] },
  { ...base, id: 2, total: 45.5, discountAmount: 4.5, paymentCategory: "Onsite GCash / E-Payment" },
  { ...base, id: 3, total: 20, paymentCategory: "Cash on Pickup" },
  { ...base, id: 4, total: 30, paymentCategory: "GrabFood" },
  { ...base, id: 5, total: 12.3, paymentCategory: "foodpanda" },
  { ...base, id: 6, total: 6, paymentCategory: "Other" },
  { ...base, id: 7, total: 2, paymentCategory: "Unknown", invoiceNumber: null },
  { ...base, id: 8, total: 100, paymentCategory: "Cash on Pickup", paymentStatus: "Pending Payment" },
  { ...base, id: 9, total: 100, paymentCategory: "Cash on Pickup", status: "Ready" },
  { ...base, id: 10, total: 100, paymentCategory: "Cash", status: "Refunded" },
];
const report = context.buildSalesExport(input);
assert.equal(report.rows.length, 7);
assert.equal(report.net, 20580);
assert.equal(report.food, 22030);
assert.equal(report.discount, 1450);
assert.equal(report.payments.get("Cash"), 11000);
assert.equal(report.payments.get("GCash"), 4550);
assert.equal([...report.payments.values()].reduce((sum, amount) => sum + amount, 0), report.net);
assert.deepEqual(Array.from(report.methods), ["Cash", "GCash", "GrabFood", "Foodpanda", "Other", "Unknown"]);
const settings = { restaurantName: "The Crunch", timezone: "Asia/Manila" };
const html = context.salesReportMarkup(input, settings, "Nov 1–15 · Cash and online", "Admin");
assert.match(html, /Date<\/th><th>Invoice No\.<\/th><th>Order No\.<\/th><th[^>]*>Food Price<\/th><th[^>]*>Discount/);
assert.match(html, /GRAND TOTAL — NET SALES: 205\.80/);
assert.ok(html.includes("INV-OLD/031") && html.includes("#901") && html.includes("Nov 1–15"));
assert.ok(!html.includes("Included Coke") && !html.includes("summary-card"));
assert.match(html, /&mdash;/);
const historical = context.buildSalesExport([{ ...base, id: 11, total: 123.45, paymentCategory: "Cash", discountAmount: null }]);
assert.equal(historical.net, 12345);
assert.equal(historical.food, null);
assert.equal(historical.discount, null);
assert.match(context.salesReportMarkup([{ ...base, id: 11, total: 123.45, paymentCategory: "Cash", discountAmount: null }], settings, "All dates", "Admin"), /no recorded discount amount/);
assert.match(context.salesReportMarkup([], settings, "Today", "Admin"), /No completed, paid transactions/);
assert.doesNotMatch(source, /<span>Print Report<\/span>/);
assert.match(source, /function triggerPrint\([\s\S]*salesReportMarkup\(/);
assert.match(source, /function PrintReport\([\s\S]*salesReportMarkup\(/);
console.log("Sales export order rows, historical references, discounts, payment reconciliation, pickup settlement, net totals, and empty states passed");
