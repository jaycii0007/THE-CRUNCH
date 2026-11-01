import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const suppliersHook = readFileSync(
  new URL("../src/pages/stockmanager/hooks/useSuppliers.ts", import.meta.url),
  "utf8",
);
const supplierTypes = readFileSync(
  new URL("../src/pages/stockmanager/types/inventory.ts", import.meta.url),
  "utf8",
);
const purchaseOrdersHook = readFileSync(
  new URL(
    "../src/pages/stockmanager/hooks/usePurchaseOrders.ts",
    import.meta.url,
  ),
  "utf8",
);

const blankSupplier = suppliersHook.match(
  /const BLANK_SUPPLIER:[\s\S]*?=\s*\{([\s\S]*?)\n\};/,
);
assert.ok(blankSupplier, "BLANK_SUPPLIER definition was not found");
assert.doesNotMatch(
  blankSupplier[1],
  /product_id\s*:/,
  "a new supplier must not manufacture a zero/placeholder product_id",
);
assert.match(
  suppliersHook,
  /api\.postSupplier\(supplierForm\)/,
  "the supplier form must be posted through the supplier API service",
);
assert.match(
  supplierTypes,
  /product_id\?\s*:\s*number\s*\|\s*null/,
  "supplier product association must be optional and nullable",
);
assert.match(
  purchaseOrdersHook,
  /api\.mergeSupplierProducts\(/,
  "purchase-order creation must continue to merge products into the supplier",
);

console.log(
  "Supplier zero-product payload and purchase-order association regression tests passed",
);
