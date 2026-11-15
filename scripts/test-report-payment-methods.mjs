import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/pages/sales-reports.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("sales-reports.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["normalizePaymentMethod", "normalizeStatus", "normalizeLogType", "formatPaymentStatus", "formatDisplayDate", "formatDisplayTime", "processRawRows", "getPaymentFilterOptions", "filterOrdersByRange", "isDateInRange", "parseDateSafe", "formatOrderType"];
const functions = file.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
assert.equal(functions.length, names.length);
const context = vm.createContext({
  formatInSettingsTimezone: (value) => new Date(value).toISOString(),
});
vm.runInContext(ts.transpileModule(functions.map((node) => node.getText(file)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, context);

for (const [value, label] of [
  ["Cash", "Cash"], ["cash_on_pickup", "Cash on Pickup"],
  ["pickup_cash", "Cash on Pickup"], ["GCash", "Online Payment"],
  ["Onsite GCash / E-Payment", "Online Payment"], ["paymongo", "Online Payment"],
  ["GrabFood", "GrabFood"], ["foodpanda", "Foodpanda"], ["Other", "Other"],
  [null, "Unknown"], ["", "Unknown"], ["unexpected", "Unknown"],
]) assert.equal(context.normalizePaymentMethod(value), label);

const base = { id: 1, total: 150, discountAmount: 10, date: "2026-11-01T10:00:00Z", status: "Completed", paymentStatus: "Paid", productName: "Chicken", quantity: 1 };
for (const [fields, expected] of [
  [{ paymentMethod: null, paymentRecordMethod: "Cash" }, "Cash"],
  [{ paymentMethod: "  ", paymentRecordMethod: "GCash" }, "Online Payment"],
  [{ payment_method: "cash_on_pickup", paymentRecordMethod: "Cash" }, "Cash on Pickup"],
  [{ paymentMethod: "GCash", paymentRecordMethod: "Cash" }, "Online Payment"],
  [{ paymentMethod: "unexpected", paymentRecordMethod: "Cash" }, "Unknown"],
  [{ paymentMethod: null, paymentRecordMethod: null }, "Unknown"],
]) {
  const { logs, orders } = context.processRawRows([
    { ...base, ...fields }, { ...base, ...fields, productName: "Rice", quantity: 2 },
  ]);
  assert.equal(logs.length, 1);
  assert.equal(orders.length, 1);
  assert.equal(logs[0].paymentMethod, expected);
  assert.equal(orders[0].paymentCategory, expected);
  assert.equal(logs[0].total, 150);
  assert.equal(orders[0].total, 150);
  assert.equal(logs[0].discountAmount, 10);
  assert.equal(logs[0].quantity, 3);
  assert.equal(orders[0].paymentStatus, "Paid");
}
assert.equal(context.getPaymentFilterOptions(["Cash", "GCash"]).includes("Unknown"), false);
assert.equal(context.getPaymentFilterOptions([]).includes("Unknown"), false);
assert.equal(context.getPaymentFilterOptions(["Cash", "unrecognized"]).includes("Unknown"), true);
const ordersTab = file.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "OrdersTab");
const statements = ordersTab.body.statements;
const start = statements.findIndex((node) => node.getText(file).startsWith("const dateFiltered ="));
const end = statements.findIndex((node) => node.getText(file).includes("onReportChange({"));
const pipeline = ts.transpileModule(statements.slice(start, end).map((node) => node.getText(file)).join("\n"), {}).outputText;
for (const [unknownDate, unknownStatus, expectedUnknown] of [
  ["2026-11-01", "Completed", true], ["2026-10-01", "Completed", false], ["2026-11-01", "Cancelled", false],
]) {
  context.inputOrders = [{ date: "2026-11-01", status: "Completed", paymentCategory: "Cash", total: 100 }, { date: unknownDate, status: unknownStatus, paymentCategory: "Unknown", total: 50 }];
  const result = vm.runInContext(`(() => {
    const orders = inputOrders, fromDate = new Date("2026-11-01"), toDate = new Date("2026-11-30"), statusFilter = "Completed", paymentMethodFilter = "Unknown", orderTypeFilter = "All", deliveryPlatformFilter = "All Platforms", loading = false;
    let reset, page;
    const setPaymentMethodFilter = (value) => { reset = value; }, setCurrentPage = (value) => { page = value; }, useEffect = (fn) => fn();
    ${pipeline}
    return { hasUnknownPayment, effectivePaymentFilter, reset, page, total: filtered.reduce((sum, row) => sum + row.total, 0) };
  })()`, context);
  assert.equal(result.hasUnknownPayment, expectedUnknown);
  assert.equal(result.effectivePaymentFilter, expectedUnknown ? "Unknown" : "All");
  assert.equal(result.reset, expectedUnknown ? undefined : "All");
  assert.equal(result.total, expectedUnknown ? 50 : 100);
}
const financialModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/financialStatus.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: financialModule.exports });
context.isFinalizedSale = financialModule.exports.isFinalizedSale;
const salesReports = file.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "SalesReports");
const logStatements = salesReports.body.statements;
const logStart = logStatements.findIndex((node) => node.getText(file).startsWith("const nonPaymentFilteredLogs ="));
const logEnd = logStatements.findIndex((node) => node.getText(file).startsWith("const logTotalPages ="));
const logPipeline = ts.transpileModule(logStatements.slice(logStart, logEnd).map((node) => node.getText(file)).join("\n"), {}).outputText;
for (const [status, category, expectedUnknown] of [["Completed", "dine-in", true], ["Cancelled", "dine-in", false], ["Completed", "take-out", false]]) {
  context.testLogs = [{ paymentMethod: "Cash", total: 100, status: "Completed", paymentStatus: "Paid", category: "dine-in" }, { paymentMethod: "Unknown", total: 50, status, paymentStatus: "Paid", category }];
  const result = vm.runInContext(`(() => {
    const dateFilteredLogs = testLogs, logPaymentFilter = "Unknown", logOrderTypeFilter = "Dine In", logDeliveryPlatformFilter = "All Platforms", isLoading = false;
    let reset;
    const setLogPaymentFilter = (value) => { reset = value; }, setLogPage = () => {}, useEffect = (fn) => fn();
    ${logPipeline}
    return { hasUnknownLogPayment, reset, total: filteredLogs.reduce((sum, log) => sum + log.total, 0) };
  })()`, context);
  assert.equal(result.hasUnknownLogPayment, expectedUnknown);
  assert.equal(result.reset, expectedUnknown ? undefined : "All");
  assert.equal(result.total, expectedUnknown ? 50 : 100);
}
assert.match(source, /options=\{logPaymentOptions\}/);
assert.match(source, /nonPaymentFilteredLogs\.filter\(isFinalizedSale\)/);
assert.match(source, /logPaymentFilter === "Unknown" && !hasUnknownLogPayment/);
console.log("Report payment mapping, dynamic filters, reset, date/status scope, and aggregation tests passed");
