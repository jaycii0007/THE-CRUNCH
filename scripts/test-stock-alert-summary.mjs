import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../src/pages/stockmanager/${path}`, import.meta.url), "utf8");
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const source = read("utils/stockUtils.ts");
const file = ts.createSourceFile("stockUtils.ts", source, ts.ScriptTarget.Latest, true);
const helpers = file.statements.filter((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => ["getAlertSeverity", "getAppliedThresholds"].includes(declaration.name.getText(file))));
assert.equal(helpers.length, 2);
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const utils = { exports: {} };
vm.runInNewContext(compile(helpers.map((node) => node.getText(file)).join("\n")), { exports: utils.exports, toNumber });
const hook = { exports: {} };
vm.runInNewContext(compile(read("hooks/useDashboard.ts")), {
  exports: hook.exports,
  require: (name) => {
    if (name === "react") return { useMemo: (fn) => fn(), useCallback: (fn) => fn, useState: (initial) => [initial, () => {}] };
    if (name.endsWith("formatters")) return { toNumber, fmtInt: (value) => String(value) };
    if (name.endsWith("stockUtils")) return { ...utils.exports, isCountedInTotalProducts: () => true, isMainStockDashboardCategory: () => true };
    throw new Error(`Unexpected dependency ${name}`);
  },
});
const products = [
  { product_id: 1, mainStock: 0 }, { product_id: 2, mainStock: -1 },
  { product_id: 3, mainStock: 1 }, { product_id: 4, mainStock: 5 },
  { product_id: 5, mainStock: 6 }, { product_id: 6, mainStock: 10 },
  { product_id: 7, mainStock: 11 },
  { product_id: 8, mainStock: 3, useDefaultThresholds: false, lowStockThreshold: 4, criticalStockThreshold: 2 },
  { product_id: 9, mainStock: 0, item_type: "menu_item" },
].map((product) => ({ product_name: `Material ${product.product_id}`, category: "Materials", unit: "kg", ...product }));
const result = hook.exports.useDashboard({
  products, mainStockProducts: [], purchaseOrders: [], completedPurchaseOrders: [],
  stockAlertSettings: { defaultLowStockThreshold: 10, defaultCriticalStockThreshold: 5 },
  inventoryCategoryDateTrackingLookup: new Map(),
  isMenuFoodProduct: (product) => product.item_type === "menu_item",
  isWholeChicken: () => false, isChoppedChicken: () => false,
});
assert.deepEqual(Array.from(result.lowStockItems, (product) => product.product_id), [5, 6, 8]);
assert.deepEqual(Array.from(result.alertCriticalStock, (product) => product.product_id), [3, 4]);
assert.deepEqual(Array.from(result.outOfStockItems, (product) => product.product_id), [1, 2]);
const allAlerts = [...result.lowStockItems, ...result.alertCriticalStock, ...result.outOfStockItems];
assert.equal(new Set(allAlerts.map((product) => product.product_id)).size, allAlerts.length);
assert.equal(result.attentionItems.length, allAlerts.length);
assert.equal(result.dashboardSummaryConfig.low.title, "Reorder Stock Summary");
assert.equal(result.dashboardSummaryConfig.critical.title, "Low Stock Summary");
assert.equal(result.dashboardSummaryConfig.out.totalValue, "2");
assert.equal(result.dashboardSummaryConfig.attention.totalValue, "7");
const alerts = read("components/tabs/AlertsTab.tsx");
assert.match(alerts, /label="Reorder Stock"\s+value=\{lowStock.length/);
assert.match(alerts, /label="Low Stock"\s+value=\{alertCriticalStock.length/);
assert.match(alerts, /label="Out of Stock"\s+value=\{outOfStockItems.length/);
const index = read("index.tsx");
const indexFile = ts.createSourceFile("index.tsx", index, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let summaryNavigation, createPO;
function visit(node) {
  if (ts.isJsxAttribute(node)) {
    const expression = node.initializer?.expression;
    if (node.name.text === "onSummarySelect" && expression?.getText(indexFile).includes('setTab("alerts")')) summaryNavigation = expression.getText(indexFile);
    if (node.name.text === "onCreatePO") createPO = expression.getText(indexFile);
  }
  ts.forEachChild(node, visit);
}
visit(indexFile);
assert.ok(summaryNavigation && createPO);
for (const key of ["low", "critical", "out"]) {
  const calls = [];
  const context = { key, setTab: (tab) => calls.push(tab), dashboard: {
    dashboardSummary: key, selectDashboardSummary: (summary) => calls.push(summary), closeDashboardSummary: () => calls.push("close"),
  }, po: { setPrefillPOProduct: (value) => calls.push(value) } };
  vm.runInNewContext(`(${summaryNavigation})(key)`, context);
  assert.deepEqual(calls, ["alerts", key]);
  calls.length = 0;
  vm.runInNewContext(`(${createPO})()`, context);
  assert.deepEqual(calls, ["close", "purchases", null], "open existing PO form without creating an order");
}
assert.doesNotMatch(index, /Up to date/);
assert.match(read("components/DashboardSummaryModal.tsx"), /onClick=\{onCreatePO\}[\s\S]*Create PO/);
assert.match(read("components/tabs/DashboardTab.tsx"), /label="Out of Stock" value=\{outOfStockValue\}/);
console.log("Stock alert labels, threshold boundaries, custom thresholds, zero stock, menu exclusion, and exclusive summary totals passed");
