import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const notificationCenter = readFileSync(
  new URL("../src/components/InventoryNotificationCenter.tsx", import.meta.url),
  "utf8",
);

assert.match(
  notificationCenter,
  /category:\s*"refund_request"\s*\|\s*"purchase_order"\s*\|\s*"inventory_change"/,
  "the notification type must preserve refund/PO categories and add inventory_change",
);
assert.match(
  notificationCenter,
  /notification\.category === "inventory_change"[\s\S]*?normalizedRole === "administrator"/,
  "inventory-change notifications must be visible only to Administrators",
);
assert.match(
  notificationCenter,
  /notification\.item\.category === "inventory_change"[\s\S]*?requestStockManagerTab\("alerts"\)/,
  "inventory-change notifications must navigate to Monitor Stock",
);
assert.match(notificationCenter, /Inventory write-off/);
assert.match(notificationCenter, /\/staff-notifications\/\$\{notification\.id\}\/read/);
assert.match(notificationCenter, /\/staff-notifications\/read-all/);

console.log("Inventory-change notification bell regression tests passed");
