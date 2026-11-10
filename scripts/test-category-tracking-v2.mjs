import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/pages/settings.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  fileName: "settings.tsx",
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
const errors = (compiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, {
  getCurrentDirectory: () => "", getCanonicalFileName: (name) => name, getNewLine: () => "\n",
}));

// Exercise the actual form callback without rendering or making network requests.
const start = source.indexOf("  const createCategory = async () =>");
const end = source.indexOf("  const saveCategoryTracking", start);
assert.ok(start > 0 && end > start);
const callback = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
for (const categoryTracking of ["none", "expiry", "shelf_life"]) {
  const requests = [];
  const context = {
    categoryName: "Packaging", categoryTracking,
    busy: false,
    setBusy() {}, setError(message) { assert.equal(message, null); },
    setCategories() {}, setCategoryDrafts() {}, setCategoryTrackingDrafts() {},
    setCategoryName() {}, setCategoryTracking() {},
    api: { async post(endpoint, body) {
      requests.push({ endpoint, body: JSON.parse(JSON.stringify(body)) });
      return { category_id: 8, name: body.name, date_tracking_type: body.date_tracking_type ?? "none" };
    } },
  };
  vm.createContext(context);
  await vm.runInContext(`${callback}\ncreateCategory();`, context);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].endpoint, "/settings/inventory-categories");
  assert.deepEqual(requests[0].body, { name: "Packaging", date_tracking_type: categoryTracking });
}
const renameStart = source.indexOf("  const renameCategory = async (");
const renameEnd = source.indexOf("  const toggleMenuCategory", renameStart);
assert.ok(renameStart > 0 && renameEnd > renameStart);
const renameCallback = ts.transpileModule(source.slice(renameStart, renameEnd), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const edits = [];
const renameContext = {
  categoryDrafts: { 8: " Food Containers " }, busy: false,
  setBusy() {}, setError(message) { assert.equal(message, null); },
  setCategories() {}, setCategoryDrafts() {},
  api: { async patch(endpoint, body) {
    edits.push({ endpoint, body: JSON.parse(JSON.stringify(body)) });
    return { category_id: 8, name: body.name, date_tracking_type: "none" };
  } },
};
vm.createContext(renameContext);
await vm.runInContext(`${renameCallback}\nrenameCategory({ category_id: 8, name: "Packaging" });`, renameContext);
assert.deepEqual(edits, [{ endpoint: "/settings/inventory-categories/8", body: { name: "Food Containers" } }]);
// Exercise the original save-and-reload callback against a persistent fake API.
const saveStart = source.indexOf("  const saveCategoryTracking = async (");
const saveEnd = source.indexOf("  const renameMenuCategory", saveStart);
assert.ok(saveStart > 0 && saveEnd > saveStart);
const saveCallback = ts.transpileModule(source.slice(saveStart, saveEnd), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
for (const selected of ["none", "expiry", "shelf_life"]) {
  let stored = { category_id: 8, name: "Packaging", date_tracking_type: selected === "none" ? "expiry" : "none" };
  let reloaded;
  const requests = [];
  const context = {
    categoryTrackingDrafts: { 8: selected }, busy: false,
    inventoryTrackingLabel: (value) => value,
    window: { confirm: () => true },
    setBusy() {}, setError(message) { assert.equal(message, null); },
    setCategories(value) { reloaded = JSON.parse(JSON.stringify(value)); },
    setCategoryTrackingDrafts() {},
    api: {
      async patch(endpoint, body) {
        requests.push({ endpoint, body: JSON.parse(JSON.stringify(body)) });
        stored = { ...stored, ...body };
        return stored;
      },
      async get(endpoint) {
        assert.equal(endpoint, "/settings/inventory-categories");
        return [stored];
      },
    },
    category: { ...stored },
  };
  vm.createContext(context);
  await vm.runInContext(`${saveCallback}\nsaveCategoryTracking(category);`, context);
  assert.deepEqual(requests, [{ endpoint: "/settings/inventory-categories/8", body: { date_tracking_type: selected } }]);
  assert.equal(reloaded[0].date_tracking_type, selected);
  assert.equal(reloaded[0].name, "Packaging");
}
assert.doesNotMatch(source, /materialDateTracking|includeTrackingScope/);
assert.match(source, /This applies to all materials in that category/);
assert.match(source, /Existing batch dates are not automatically created or converted/);
for (const value of ["none", "expiry", "shelf_life"]) {
  assert.ok(source.includes(`{ value: "${value}", label:`));
}

// Test the existing category-to-material lookup without loading any inventory UI.
const utils = fs.readFileSync(new URL("../src/pages/stockmanager/utils/stockUtils.ts", import.meta.url), "utf8");
const utilityContext = { exports: {}, require: () => ({}) };
vm.createContext(utilityContext);
vm.runInContext(ts.transpileModule(utils, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, utilityContext);
const names = new Map([["packaging", "Packaging"]]);
for (const value of ["none", "expiry", "shelf_life"]) {
  const actual = utilityContext.exports.getPOItemDateTrackingType(
    { category: "Packaging" }, names, new Map([["packaging", value]]),
  );
  assert.equal(actual, value);
}
assert.equal(utilityContext.exports.getPOItemDateTrackingType(
  { category: "Packaging", trackingMethod: "expiry" }, names, new Map(),
), "expiry");
assert.equal(utilityContext.exports.getPOItemDateTrackingType(
  { category: "Packaging", trackingMethod: "expiry" }, names, new Map([["packaging", "none"]]),
), "none");
console.log("Restored category create/edit/save/reload payloads, category tracking lookup, and TSX syntax passed (no network; persistence mocked).");
