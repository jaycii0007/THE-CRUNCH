import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../src/components/ui/skeleton.tsx", import.meta.url), "utf8");
const context = {
  exports: {},
  require(id) { return id === "@/lib/utils" ? { cn: (...classes) => classes.filter(Boolean).join(" ") } : require(id); },
};
vm.createContext(context);
vm.runInContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText, context);
const inventory = fs.readFileSync(new URL("../src/pages/inventory.tsx", import.meta.url), "utf8");
const start = inventory.indexOf("{loading ? (", inventory.indexOf("<tbody>"));
const end = inventory.indexOf(") : visible.length", start);
assert.ok(start >= 0 && end > start);
const actualExpression = inventory.slice(start + "{loading ? (".length, end).trim();
assert.doesNotMatch(actualExpression, /<SkeletonTable\b/);
const expression = ts.transpileModule(`exports.rows = (${actualExpression});`, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const rowContext = { exports: {}, SkeletonTableRow: context.exports.SkeletonTableRow, require };
vm.createContext(rowContext);
vm.runInContext(expression, rowContext);
const html = renderToStaticMarkup(React.createElement("table", null, React.createElement("tbody", null, rowContext.exports.rows)));
assert.match(html, /<tbody><tr\b/);
assert.equal((html.match(/<tr\b/g) ?? []).length, 5);
assert.equal((html.match(/<td\b/g) ?? []).length, 25);
assert.equal((html.match(/<table\b/g) ?? []).length, 1);
assert.doesNotMatch(html, /<tbody><div/);
assert.match(html, /padding:14px 16px/);
for (const filename of ["pages/inventory.tsx", "pages/stockmanager/index.tsx", "pages/stockmanager/types/inventory.ts", "pages/stockmanager/utils/stockUtils.ts", "pages/stockmanager/components/purchase-orders/ReceivePOModal.tsx"]) {
  const file = fs.readFileSync(new URL(`../src/${filename}`, import.meta.url), "utf8");
  const result = ts.transpileModule(file, {
    fileName: filename, reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal((result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0, filename);
}
console.log("Actual menu loading skeleton renders five valid table rows with existing cell styles; changed TS/TSX syntax passed.");
