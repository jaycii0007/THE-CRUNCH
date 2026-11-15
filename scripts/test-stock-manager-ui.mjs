import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../src/pages/stockmanager/${path}`, import.meta.url), "utf8");
const source = read("index.tsx");
const file = ts.createSourceFile("index.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks = [];
let category;
function visit(node) {
  if (ts.isJsxAttribute(node) && ["removeSupplier", "onDeleteOrder"].includes(node.name.text) && node.initializer?.expression) {
    callbacks.push(node.initializer.expression.getText(file));
  }
  if (ts.isVariableDeclaration(node) && node.name.getText(file) === "getCategoryStyle") category = node.initializer.getText(file);
  ts.forEachChild(node, visit);
}
visit(file);
assert.equal(callbacks.length, 2);
for (const callback of callbacks) {
  for (const accepted of [false, true]) {
    let prompts = 0;
    const calls = [];
    const context = vm.createContext({
      window: { confirm: () => { prompts++; return accepted; } },
      supplier: { removeSupplier: (id) => calls.push(id) },
      po: { handlePODelete: (id) => calls.push(id) },
    });
    vm.runInContext(`(${callback})(42)`, context);
    assert.equal(prompts, 1);
    assert.deepEqual(calls, accepted ? [42] : []);
  }
}
const categoryStyle = vm.runInNewContext(ts.transpileModule(`const categoryStyle = ${category}; categoryStyle;`, {}).outputText);
for (const [label, variant] of [["Whole Chicken", "whole"], ["Chopped Chicken", "chopped"], ["Sauces", "sauce"], ["Other", "default"]]) {
  assert.equal(categoryStyle(label), `sm-category-badge--${variant}`);
}
const css = read("styles/stockManager.css");
for (const variant of ["slate", "amber", "critical", "info", "indigo"]) {
  assert.match(css, new RegExp(`\\.sm-kpi-card--${variant}[^}]*background:`));
}
assert.match(css, /\.sm-action-btn \{[^}]*color: var\(--sm-primary\)/);
assert.match(css, /\.sm-action-btn--edit \{/);
assert.match(css, /\.sm-action-btn--delete \{/);
assert.match(css, /\.sm-action-btn:focus-visible/);
assert.match(css, /\.sm-table-wrapper \{[^}]*overflow-x: auto/);
const suppliers = read("components/tabs/SuppliersTab.tsx");
assert.match(suppliers, /sm-table-wrapper[\s\S]*min-w-\[680px\]/);
assert.match(suppliers, /grid-cols-1 sm:grid-cols-3/);
assert.doesNotMatch(suppliers, /className="col-span-3/);
assert.match(suppliers, /flex w-full flex-wrap items-center/);
assert.match(suppliers, /bg-slate-50 flex flex-wrap/);
const purchaseOrders = read("components/tabs/PurchaseOrdersTab.tsx");
assert.equal((purchaseOrders.match(/aria-label=\{`Cancel purchase order/g) ?? []).length, 2);
assert.match(purchaseOrders, /flex flex-wrap items-start/);
assert.match(purchaseOrders, /grid-cols-1 sm:grid-cols-2/);
const drawer = read("components/purchase-orders/PODetailDrawer.tsx");
assert.match(drawer, /onClick=\{\(\) => setShowDeleteConfirm\(true\)\}/);
assert.match(drawer, /showDeleteConfirm &&/);
assert.match(drawer, /onDelete\(order.id\)/);
assert.doesNotMatch(drawer, /window.confirm/);
console.log("Stock Manager confirmation, category, color, and responsive UI checks passed");
