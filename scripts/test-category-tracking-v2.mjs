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
for (const [materialDateTracking, categoryTracking] of [
  [true, ""], [true, "expiry"], [true, "shelf_life"], [false, "expiry"],
]) {
  const requests = [];
  const context = {
    categoryName: "Packaging", categoryTracking,
    materialDateTracking, busy: false,
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
  assert.deepEqual(requests[0].body, materialDateTracking
    ? { name: "Packaging" }
    : { name: "Packaging", date_tracking_type: "expiry" });
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
assert.match(source, /inventory-categories\?includeTrackingScope=1/);
assert.match(source, /Expiry and shelf-life tracking are configured per inventory material/);
console.log("Category tracking form checks and settings TSX syntax passed (no network).");
