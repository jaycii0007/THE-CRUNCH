import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const purchaseHook = read("src/pages/stockmanager/hooks/usePurchaseOrders.ts");
assert.match(
  purchaseHook,
  /poOrders\.filter\(\(o\) => o\.status === "Draft"\)/,
  "Active purchase orders must be Draft-only",
);
assert.match(
  purchaseHook,
  /poOrders\.filter\(\(o\) => o\.status !== "Draft"\)/,
  "All non-Draft purchase orders must remain in history",
);

const createPO = read(
  "src/pages/stockmanager/components/purchase-orders/CreatePOModal.tsx",
);
assert.doesNotMatch(
  createPO,
  /unitCost|unit_cost|Unit Cost|Unit Price/,
  "PO creation must not request or display a price",
);

const history = read(
  "src/pages/stockmanager/components/tabs/PurchaseHistoryTab.tsx",
);
assert.match(history, /<span>Inventory<\/span>/);
assert.match(history, /item\.name/);
assert.match(history, /item\.quantity/);
assert.match(history, /item\.unit/);

const notificationCenter = read("src/components/InventoryNotificationCenter.tsx");
assert.match(notificationCenter, /normalizedRole === "administrator"/);
assert.match(notificationCenter, /normalizedRole === "inventory_manager"/);
assert.match(
  notificationCenter,
  /alert\.severity === "critical" \|\| alert\.severity === "out"/,
  "Stock Manager notifications must be restricted to critical/out alerts",
);

const cashier = read("src/pages/menu.tsx");
const online = read("src/pages/usersmenu.tsx");
assert.match(cashier, /\/products\?item_type=menu_item/);
assert.match(online, /\/products\?item_type=menu_item/);

console.log("Batch 4 frontend static tests passed");
