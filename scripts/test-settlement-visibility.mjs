import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const permissions = read("src/lib/permissions.ts");
const menu = read("src/pages/menu.tsx");
const orders = read("src/pages/Order.tsx");
const reports = read("src/pages/sales-reports.tsx");

assert.match(
  permissions,
  /role === SUPERUSER_ROLE \|\| role === "inventory_manager"/,
  "Only Administrator and Inventory Manager should receive settlement controls",
);

assert.match(menu, /canSettle=\{canManagePersistedSettlements\}/);
assert.match(menu, /canManagePersistedSettlements && action/);
assert.match(orders, /canSettle && settlement/);
assert.match(reports, /const showSettlement = canSettle && settlementAction !== null/);

const draftVoidStart = menu.indexOf("const voidCurrentOrder = () =>");
const draftVoidEnd = menu.indexOf("const selectDiscount =", draftVoidStart);
assert.ok(draftVoidStart >= 0 && draftVoidEnd > draftVoidStart);
const draftVoidSource = menu.slice(draftVoidStart, draftVoidEnd);
assert.match(draftVoidSource, /setCart\(\[\]\)/);
assert.doesNotMatch(draftVoidSource, /api\.|fetch\(/);
assert.match(menu, /title="Void current order"/);

assert.match(menu, /status = action === "refund" \? "Refunded" : "Cancelled"/);
assert.match(orders, /status: action === "refund" \? "Refunded" : "Cancelled"/);
assert.match(reports, /settlementAction === "refund" \? "Refunded" : "Cancelled"/);

console.log("Frontend settlement visibility tests passed");
