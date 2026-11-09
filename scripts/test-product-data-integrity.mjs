import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const menuManagement = readFileSync(
  new URL("../src/pages/inventory.tsx", import.meta.url),
  "utf8",
);
const stockManager = readFileSync(
  new URL("../src/pages/stockmanager/index.tsx", import.meta.url),
  "utf8",
);

assert.doesNotMatch(menuManagement, /latestPerName|new Map<string, ApiRow>/);
assert.match(menuManagement, /function uniqueMenuRowsByProductId/);
assert.match(menuManagement, /seenProductIds\.has\(productId\)/);
assert.doesNotMatch(stockManager, /groupedByName/);
assert.match(stockManager, /const productsById = new Map<number, Product>/);
assert.match(stockManager, /productsById\.set\(productId, item\)/);
assert.match(menuManagement, /await api\.delete\(`\/products\/\$\{productId\}`\)/);
assert.match(menuManagement, /Delete blocked:/);

console.log("Frontend stable product identity checks passed");
