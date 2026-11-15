import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/pages/sales-reports.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("sales-reports.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helper = file.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "formatReportPeriod");
assert.ok(helper);
const context = vm.createContext({});
vm.runInContext(ts.transpileModule(helper.getText(file), {}).outputText, context);
for (const [period, custom, description, expected] of [
  ["Last 30 Days", false, "All dates Â· All payment methods Â· All order types Â· All platforms", "Last 30 Days | All payment methods | All order types | All platforms"],
  ["Today", false, "All dates · Cash · Dine In", "Today | Cash | Dine In"],
  ["All Time", false, "All dates | All payment methods", "All Time | All payment methods"],
  ["Last 30 Days", true, "Date: Nov 1, 2026 to Nov 15, 2026 Â· Cash", "Date: Nov 1, 2026 to Nov 15, 2026 | Cash"],
  ["Today", false, "Beginning to Today | Completed | All", "Today | Completed | All"],
  ["Today", true, "Nov 1, 2026 to Today | Completed | Cash", "Nov 1, 2026 to Today | Completed | Cash"],
  ["Today", false, "All orders", "Today"],
]) {
  const actual = context.formatReportPeriod(period, custom, description);
  assert.equal(actual, expected);
  assert.doesNotMatch(actual, /[Â·]/);
}
assert.match(source, /reportDescription=\{formatReportPeriod\(period, hasReportRange,/);
const printReport = file.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "PrintReport").getText(file);
assert.match(printReport, /salesReportMarkup\(orders, restaurantSettings, formatReportPeriod\(period, hasLogRange, filterDescription\), generatedBy\)/);
assert.match(source, /const reportingPeriod = reportDescription \|\| period/);
assert.match(source, /<h1>Sales Report<\/h1>/);
assert.match(source, /escapePrintHtml\(settings.restaurantName \|\| "The Crunch"\)/);
assert.match(source, /Prepared by: \$\{escapePrintHtml\(generatedBy/);
// Check screen literals and the actual export formatter without altering API data.
assert.doesNotMatch(source, /[\u00c2\u00c3\u00e2\ufffd]/);
assert.ok(source.includes("x{log.quantity}") && source.includes("x{item.quantity}"));
assert.ok(source.includes("records |") && source.includes('].join(" | ")'));
assert.ok(source.includes('log.total === 0 ? "-"'));
const compile = (text) => ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const settingsModule = { exports: {} };
vm.runInNewContext(compile(readFileSync(new URL("../src/lib/restaurantSettings.ts", import.meta.url), "utf8")), {
  exports: settingsModule.exports, require: () => ({ api: {} }),
});
const financialModule = { exports: {} };
vm.runInNewContext(compile(readFileSync(new URL("../src/lib/financialStatus.ts", import.meta.url), "utf8")), { exports: financialModule.exports });
Object.assign(context, {
  formatCurrencyAmount: settingsModule.exports.formatCurrencyAmount,
  formatInSettingsTimezone: settingsModule.exports.formatInSettingsTimezone,
  isFinalizedSale: financialModule.exports.isFinalizedSale,
});
const names = ["salesReportMarkup", "buildSalesExport", "normalizePaymentMethod", "parseDateSafe", "formatReportCurrency", "formatDisplayDate", "formatDisplayTime", "formatOrderType"];
const functions = file.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
const constants = file.statements.filter((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((entry) => ["escapePrintHtml", "formatPrintCurrency"].includes(entry.name.getText(file))));
vm.runInContext(compile([...functions, ...constants].map((node) => node.getText(file)).join("\n")), context);
const settings = settingsModule.exports.GENERAL_SETTINGS_DEFAULTS;
const date = new Date("2026-11-16T01:05:00Z");
assert.equal(context.formatOrderType(""), "-");
assert.match(context.formatDisplayDate(date), /Nov 16, 2026/);
assert.match(context.formatDisplayTime(date), /9:05/);
assert.ok(context.formatReportCurrency(1234.56, settings).includes("1,234.56"));
const html = context.salesReportMarkup([{
  id: 42, date: date.toISOString(), status: "Completed", paymentStatus: "Paid", total: 1234.56,
  discountAmount: 10, invoiceNumber: "INV-000042", orderNumber: "#42", paymentCategory: "Cash",
}], settings, "Today | All payment methods", "Admin", date);
assert.doesNotMatch(html, /[\u00c2\u00c3\u00e2\ufffd]/);
for (const text of ["INV-000042", "#42", "Cash", "1,234.56", "Prepared by: Admin", "Today | All payment methods", "POS System | Confidential"]) assert.ok(html.includes(text));
assert.match(html, /&mdash;/, "unused payment cells retain the safe HTML dash entity");
console.log("Sales Reports screen literals, quantities, dashes, date/currency formatting, invoice references, and both export headers passed");
