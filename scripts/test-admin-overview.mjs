import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
const financialModule = { exports: {} };
vm.runInNewContext(compile(readFileSync(new URL("../src/lib/financialStatus.ts", import.meta.url), "utf8")), {
  module: financialModule, exports: financialModule.exports,
});
const settings = { restaurantName: "The Crunch", currency: "PHP", timezone: "Asia/Manila" };
let states = [], cursor = 0;
const element = ({ children }) => React.createElement("div", null, children);
const dependencies = {
  react: { ...React, useState: (initial) => [states[cursor++] ?? initial, () => {}], useEffect: () => {}, useCallback: (fn) => fn, useMemo: (fn) => fn(), useRef: () => ({ current: false }) },
  "react-router-dom": { Link: ({ to, children }) => React.createElement("a", { href: to }, children) },
  "lucide-react": Object.fromEntries(["ShoppingBag", "DollarSign", "Layers", "CheckCircle"].map((key) => [key, () => React.createElement("svg")])),
  recharts: Object.fromEntries(["Line", "LineChart", "ResponsiveContainer", "Tooltip", "XAxis", "YAxis"].map((key) => [key, element])),
  "@/components/Sidebar": { Sidebar: () => React.createElement("nav", null, "Sidebar") },
  "@/lib/api": { api: {} },
  "@/hooks/use-event-invalidation": { useEventInvalidation: () => {} },
  "@/lib/restaurantSettings": { GENERAL_SETTINGS_DEFAULTS: settings, formatCurrencyAmount: (value) => `PHP ${value.toFixed(2)}`, formatInSettingsTimezone: () => "Today" },
  "@/lib/financialStatus": financialModule.exports,
  "@/components/ui/skeleton": { SkeletonKPICard: () => React.createElement("div", null, "Loading summary") },
  "./stockmanager/navigation": { requestStockManagerTab: () => {} },
};
const dashboardModule = { exports: {} };
const source = readFileSync(new URL("../src/pages/index.tsx", import.meta.url), "utf8");
vm.runInNewContext(compile(source) + "\nexports.test = { groupOrderRows, summarizeOperations, resourceResult, dayKey };", {
  module: dashboardModule, exports: dashboardModule.exports,
  require: (name) => { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; },
});
const { groupOrderRows, summarizeOperations, resourceResult, dayKey } = dashboardModule.exports.test;
const now = new Date("2026-11-15T04:00:00Z");
const base = { total: 100, date: "2026-11-14T17:00:00Z", paymentStatus: "Paid" };
const rows = [
  { ...base, id: 1, status: "Completed", productId: 1, productName: "Chicken", quantity: 2, includedSelections: [{ name: "Included Coke", qty: 1 }] },
  { ...base, id: 1, status: "Completed", productId: 2, productName: "Rice", quantity: 1 },
  { ...base, id: 2, status: "Picked Up", total: 250 },
  { ...base, id: 3, status: "Queued", date: "2026-11-13T10:00:00Z" },
  { ...base, id: 4, status: "Preparing" },
  { ...base, id: 5, status: "Ready for Pickup" },
  { ...base, id: 6, status: "Ready" },
  { ...base, id: 7, status: "Awaiting Cashier Review", paymentStatus: "Pending Payment" },
  { ...base, id: 8, status: "Awaiting Cashier Review" },
  { ...base, id: 9, status: "Refunded", total: 500 },
  { ...base, id: 10, status: "Cancelled", total: 500 },
  { ...base, id: 11, status: "Completed", total: 70, date: "2026-11-13T10:00:00Z", handoverTimestamp: "2026-11-15T01:00:00Z" },
];
const grouped = groupOrderRows(rows);
const summary = summarizeOperations(grouped, settings.timezone, now);
assert.equal(grouped.length, 11);
assert.equal(summary.sales, 420, "only completed paid orders, counted once");
assert.equal(summary.totalOrders, 9, "count creation dates, not later handover dates");
assert.equal(summary.completedOrders, 3);
assert.equal(summary.activeOrders, 6, "include prior-day work, exclude terminal statuses");
assert.equal([...summary.statuses.values()].reduce((sum, count) => sum + count, 0), 6);
for (const label of ["Pending Payment", "Awaiting cashier review", "Queued", "Preparing", "Ready", "Ready for pickup / handover"]) assert.equal(summary.statuses.get(label), 1);
const review = summarizeOperations(groupOrderRows([
  { ...base, id: 20, status: "Awaiting Cashier Review", paymentStatus: "Pending Verification" },
  { ...base, id: 21, status: "Pending", paymentStatus: "" },
]), settings.timezone, now);
assert.equal(review.statuses.get("Pending Payment"), undefined, "do not infer unpaid from missing or unverified payment data");
assert.equal(review.statuses.get("Awaiting cashier review"), 1);
assert.equal(dayKey("2026-11-14T16:00:00Z", settings.timezone), "2026-11-15");
assert.equal(dayKey("2026-11-14T15:59:59Z", settings.timezone), "2026-11-14");
assert.equal(resourceResult({ status: "rejected", reason: new Error("offline") }).data, null);

const ok = (data) => ({ data, error: null });
const stock = { summary: { totalItems: 10, normal: 4, low: 2, critical: 3, outOfStock: 1 } };
const pos = [{ id: "PO1", status: "Draft" }, { id: "PO1", status: "Draft" }, { id: "PO2", status: "Ordered" }, { id: "PO3", status: "Cancelled" }, { id: "PO4", status: "Received" }];
const refunds = [{ id: 1, status: "Pending" }, { id: 1, status: "Pending" }, { id: 2, status: "Actioned" }];
function render(resources, loading = false) {
  cursor = 0; states = [...resources.slice(0, 3), settings, loading];
  return renderToStaticMarkup(React.createElement(dashboardModule.exports.default));
}
const html = render([ok(grouped), ok(stock), ok(pos), ok(refunds)]);
for (const heading of ["Business overview", "Order operations", "Inventory health", "Purchase Orders", "Needs Your Attention", "Best Sellers"]) assert.ok(html.includes(heading));
assert.match(html, /1\. Chicken<\/span><strong[^>]*>2<\/strong>/);
assert.ok(!html.includes("Included Coke"));
assert.ok(!html.includes("Refund requests"));
assert.match(html, /Reorder Stock<\/span><strong[^>]*>2<\/strong>/);
assert.match(html, /Low Stock<\/span><strong[^>]*>3<\/strong>/);
assert.match(html, /Out of Stock<\/span><strong[^>]*>1<\/strong>/);
assert.ok(html.includes('href="/orders"') && html.includes('href="/sales-reports"') && html.includes('href="/stockmanager"'));
const empty = render([ok([]), ok({ summary: { totalItems: 0, normal: 0, low: 0, critical: 0, outOfStock: 0 } }), ok([]), ok([])]);
for (const message of ["No active orders", "No inventory materials", "No purchase orders awaiting action", "No completed paid menu sales yet"]) assert.ok(empty.includes(message));
const failed = render([{ data: null, error: "Offline" }, ok(stock), { data: null, error: "Offline" }, ok(refunds)]);
assert.ok(failed.includes("Order summary unavailable") && failed.includes("Inventory health"));
assert.ok(failed.includes("Offline"));
const loading = render(Array.from({ length: 4 }, () => ({ data: null, error: null })), true);
assert.ok(loading.includes("Loading summary") && loading.includes("Loading…"));
assert.ok(!loading.includes("No pending refund requests"));
const overviewFile = ts.createSourceFile("index.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const destinations = new Map();
function inspectLinks(node) {
  if (ts.isJsxOpeningElement(node) && node.tagName.getText(overviewFile) === "Link") {
    const attributes = node.attributes.properties;
    const label = attributes.find((attribute) => attribute.name?.text === "aria-labelledby")?.initializer?.text;
    const to = attributes.find((attribute) => attribute.name?.text === "to")?.initializer?.text;
    if (label) {
      destinations.set(label, to);
      const click = attributes.find((attribute) => attribute.name?.text === "onClick")?.initializer?.expression;
      if (click) {
        const tabs = [];
        vm.runInNewContext(`(${click.getText(overviewFile)})()`, { requestStockManagerTab: (tab) => tabs.push(tab) });
        assert.deepEqual(tabs, [label === "purchase-heading" ? "purchases" : "alerts"]);
      }
    }
  }
  ts.forEachChild(node, inspectLinks);
}
inspectLinks(overviewFile);
assert.equal(destinations.get("purchase-heading"), "/stockmanager");
assert.equal(destinations.get("attention-heading"), "/stockmanager");
assert.equal(destinations.get("best-sellers-heading"), "/sales-reports");
assert.ok(source.includes("focus-visible:ring-2"));
console.log("Admin Overview calculation, deduplication, timezone, rendering, loading, partial-error, and empty-state checks passed");
