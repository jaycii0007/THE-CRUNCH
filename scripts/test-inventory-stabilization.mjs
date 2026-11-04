import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const menuManagement = read("src/pages/inventory.tsx");
const notificationCenter = read(
  "src/components/InventoryNotificationCenter.tsx",
);
const settings = read("src/pages/settings.tsx");
const cashierMenu = read("src/pages/menu.tsx");

assert.match(menuManagement, /Current stock \(read-only\)/);
assert.match(
  menuManagement,
  /Stock changes only through authorized receiving and stock-movement workflows/,
);
assert.doesNotMatch(
  menuManagement,
  /payload\.quantity\s*=/,
  "Menu Management must not send a direct stock overwrite",
);
assert.deepEqual(
  [...menuManagement.matchAll(/const OVERRIDE_MODES:[^=]+= \[([^\]]+)\]/g)].map(
    (match) => match[1],
  ),
  ['"Auto", "Force Out of Stock"'],
);

assert.match(settings, /lowStockAlertsEnabled: true/);
assert.match(
  notificationCenter,
  /settings\.lowStockAlertsEnabled !== false/,
  "the notification bell must honor the saved low-stock preference",
);
assert.match(
  notificationCenter,
  /notifications: \[\],[\s\S]*?unreadCount: 0/,
  "disabled low-stock alerts must clear their badge contribution",
);
assert.match(
  cashierMenu,
  /error instanceof Error[\s\S]*?error\.message[\s\S]*?Failed to confirm order/,
  "online acceptance must surface the backend insufficient-stock response",
);

console.log("Frontend inventory stabilization checks passed");
