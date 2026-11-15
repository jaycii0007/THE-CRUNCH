import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const financial = { exports: {} };
vm.runInNewContext(compile(readFileSync(new URL("../src/lib/financialStatus.ts", import.meta.url), "utf8")), { exports: financial.exports });
const source = readFileSync(new URL("../src/pages/sales-reports.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("sales-reports.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["buildSalesChartData", "normalizePaymentMethod", "formatOrderType", "processRawRows", "normalizeStatus", "normalizeLogType", "formatPaymentStatus", "formatDisplayDate", "formatDisplayTime"];
const helpers = file.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
assert.equal(helpers.length, names.length);
const context = vm.createContext({ isFinalizedSale: financial.exports.isFinalizedSale, formatInSettingsTimezone: (date) => new Date(date).toISOString() });
vm.runInContext(compile(helpers.map((node) => node.getText(file)).join("\n")), context);
const base = { status: "Completed", paymentStatus: "Paid", date: "2026-11-14T16:10:00Z", total: 90, paymentMethod: "Cash", orderType: "dine-in" };
const input = [
  { ...base, id: 1, productId: 101, productName: "Chicken", quantity: 2, includedSelections: [{ name: "Included Coke", qty: 1 }] },
  { ...base, id: 1, productId: 102, productName: "Rice", quantity: 1 },
  { ...base, id: 2, date: "2026-11-14T17:30:00Z", total: 40, paymentMethod: null, paymentRecordMethod: "GCash", productId: 101, productName: "Chicken renamed", quantity: 3 },
  { ...base, id: 3, date: "2026-11-14T17:45:00Z", total: 25, paymentMethod: "cash_on_pickup", orderType: "take-out", productId: 103, productName: "Burger", quantity: 4 },
  { ...base, id: 4, date: "2026-11-15T16:10:00Z", total: 70, paymentMethod: "GrabFood", orderType: "delivery", productId: 104, productName: "Sandwich", quantity: 1 },
  { ...base, id: 5, status: "Queued", productId: 101, productName: "Chicken", quantity: 500 },
  { ...base, id: 6, status: "Refunded", productId: 101, productName: "Chicken", quantity: 500 },
  { ...base, id: 7, date: "2026-11-14T16:50:00Z", total: 5, paymentMethod: null, orderType: "", productId: 105, productName: "Side", quantity: 1 },
  { ...base, id: 8, date: "2026-11-14T18:30:00Z", total: 10, paymentMethod: "foodpanda", orderType: "take-out", productId: 101, productName: "Chicken", quantity: 1 },
  { ...base, id: 9, paymentStatus: "Pending Payment", productId: 101, productName: "Chicken", quantity: 500 },
];
const { logs, orders } = context.processRawRows(input);
const daily = context.buildSalesChartData([...logs, logs[0]], orders, false, "Asia/Manila");
assert.deepEqual(Array.from(daily.trendData, (row) => [row.date, row.revenue]), [["2026-11-15", 170], ["2026-11-16", 70]]);
assert.equal(daily.bestSellerData[0].name, "Chicken");
assert.equal(daily.bestSellerData[0].quantity, 6);
assert.equal(daily.bestSellerData[1].name, "Burger");
assert.ok(!daily.bestSellerData.some((row) => row.name === "Included Coke"));
assert.deepEqual(Object.fromEntries(daily.paymentData.map((row) => [row.method, row.revenue])), { Cash: 90, "Online Payment": 40, "Cash on Pickup": 25, GrabFood: 70, Unknown: 5, Foodpanda: 10 });
assert.deepEqual(Object.fromEntries(daily.orderTypeData.map((row) => [row.type, row.revenue])), { "Dine-in": 130, Takeout: 35, Delivery: 70, Unknown: 5 });
for (const data of [daily.trendData, daily.paymentData, daily.orderTypeData]) assert.equal(data.reduce((sum, row) => sum + row.revenue, 0), 240);
const sameDay = logs.filter((log) => log._dateObj < new Date("2026-11-15T16:00:00Z"));
const hourly = context.buildSalesChartData(sameDay, orders, true, "Asia/Manila");
assert.deepEqual(Array.from(hourly.trendData, (row) => [row.date, row.revenue]), [["00:00", 95], ["01:00", 65], ["02:00", 10]]);
const selected = context.buildSalesChartData(logs.filter((log) => log.orderId === 2), orders, true, "Asia/Manila");
assert.equal(selected.bestSellerData[0].quantity, 3);
assert.equal(selected.paymentData[0].revenue, 40);
assert.equal(selected.orderTypeData[0].revenue, 40);
const empty = context.buildSalesChartData([], orders, false, "Asia/Manila");
for (const data of Object.values(empty)) assert.equal(data.length, 0);
const capped = context.buildSalesChartData([logs.find((log) => log.orderId === 1)], [{ ...orders.find((order) => order.id === 1), items: Array.from({ length: 7 }, (_, index) => ({ productId: index, name: `Item ${index}`, quantity: index + 1 })) }], false, "Asia/Manila");
assert.deepEqual(Array.from(capped.bestSellerData, (row) => row.quantity), [7, 6, 5, 4, 3]);
const chartSection = source.slice(source.indexOf('<section className="mb-6 grid min-w-0'), source.indexOf('{/* Tabs */}'));
assert.ok(chartSection.includes("grid-cols-1") && chartSection.includes("lg:grid-cols-2") && chartSection.includes("print:hidden"));
assert.ok(!chartSection.includes("screen-only"), "avoid global display rule that overrides the grid");
assert.equal((chartSection.match(/className=\{chartCardClass\}/g) ?? []).length, 4);
assert.match(source, /const chartCardClass = "flex h-\[340px\] min-w-0/);
assert.match(source, /buildSalesChartData\(chartLogs, orders, hourlyTrend/);
assert.match(source, /reportFromDate\.toDateString\(\) === reportToDate\.toDateString\(\)/);
assert.match(source, /hasReportRange \|\| isInReportPeriod/);
console.log("Sales chart layout, responsive/print classes, hourly/daily grouping, product quantities, payment/order-type totals, and filter scope passed");
