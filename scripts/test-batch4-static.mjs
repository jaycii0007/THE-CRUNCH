import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const purchaseHook = read("src/pages/stockmanager/hooks/usePurchaseOrders.ts");
assert.match(
  purchaseHook,
  /o\.status !== "Received" && o\.status !== "Cancelled"/,
  "Active purchase orders must include every nonterminal status",
);
assert.match(
  purchaseHook,
  /o\.status === "Received" \|\| o\.status === "Cancelled"/,
  "PO history must contain only Received and Cancelled orders",
);

const createPO = read(
  "src/pages/stockmanager/components/purchase-orders/CreatePOModal.tsx",
);
assert.match(
  createPO,
  /unitCost/,
  "The approved unit-cost field must remain in PO creation",
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
  /normalizedRole === "inventory_manager" \|\| normalizedRole === "administrator"/,
  "Both approved roles must receive low, critical, and out-of-stock alerts",
);
assert.match(notificationCenter, /"refundRequests\.changed"/);
assert.match(notificationCenter, /"purchaseOrders\.changed"/);
assert.match(notificationCenter, /onInvalidate: loadNotifications/);
assert.match(notificationCenter, /\/staff-notifications/);
assert.match(notificationCenter, /\/inventory\/alerts\/\$\{notification\.id\}\/read/);
assert.match(notificationCenter, /\/inventory\/alerts\/read-all/);
assert.match(notificationCenter, /\/staff-notifications\/read-all/);
assert.match(notificationCenter, /inventoryUnread \+ staffUnread/);
assert.match(notificationCenter, /notification\.source === "inventory" \? "alerts" : "purchases"/);
assert.match(notificationCenter, /\/refund-requests\/\$\{requestId\}\/ignore/);
assert.match(notificationCenter, /status:\s*["']Refunded["']/);

const cashier = read("src/pages/menu.tsx");
const online = read("src/pages/usersmenu.tsx");
assert.match(cashier, /\/products\?item_type=menu_item/);
assert.match(online, /\/products\?item_type=menu_item/);

console.log("Batch 4 frontend static tests passed");
