import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const dashboard = read("src/pages/index.tsx");
const menu = read("src/pages/menu.tsx");
const sidebar = read("src/components/Sidebar.tsx");
const reports = read("src/pages/sales-reports.tsx");
const menuManagement = read("src/pages/inventory.tsx");
const stockManager = read("src/pages/stockmanager/index.tsx");
const stockManagerDashboard = read(
  "src/pages/stockmanager/components/tabs/DashboardTab.tsx",
);

assert.doesNotMatch(dashboard, /label="Active Orders"/);
assert.doesNotMatch(dashboard, /title="Peak Hours"/);
assert.match(dashboard, /label="Total Revenue"/);

assert.doesNotMatch(menu, /title="Add note"/);
assert.match(menu, /title="Remove"/);
assert.match(menu, /Add Other Note/);
assert.doesNotMatch(menu, /value: "other", label: "Other platform"/);

assert.match(
  sidebar,
  /const cashierOrder = \["Cashier View", "Cook View", "Overview", "Sales & Reports"\]/,
);
assert.match(sidebar, /const primaryItems = visibleItems\.filter/);
assert.match(sidebar, /const settingsItems = visibleItems\.filter/);
assert.ok(sidebar.indexOf("{profileLink}") > sidebar.indexOf("primaryItems.map"));
assert.ok(sidebar.indexOf("{profileLink}") < sidebar.indexOf("settingsItems.map"));

for (const label of [
  "Total Sales",
  "Completed Orders",
  "GCash Sales",
  "Cash Sales",
  "Cash on Pickup",
  "GrabFood",
  "Foodpanda",
]) {
  assert.match(reports, new RegExp(`label: "${label}"`));
}
assert.match(reports, /aria-label": "Open Total Sales summary"/);
assert.doesNotMatch(reports, /label="Cashier"/);
assert.doesNotMatch(reports, /placeholder="Search by transaction ID/);
assert.doesNotMatch(reports, /"GrabFood",\s*"Foodpanda",\s*"Other"/);
assert.match(reports, /"Online Payment"/);
assert.match(reports, /leadingCard=\{\([\s\S]*?<RevenueDropdown/);
assert.match(reports, /<th>Transaction ID<\/th><th>Date &amp; Time<\/th><th>Items<\/th>/);
assert.match(reports, /<th>Payment \/ Reference<\/th><th>Cashier<\/th>/);
assert.match(reports, /size: A4 landscape/);
assert.match(reports, /\.txn, \.amount \{ white-space: nowrap/);
assert.match(reports, /class="delivery-details"/);
assert.match(reports, /class="amount"/);
assert.match(reports, /const formatPrintCurrency[\s\S]*?minimumFractionDigits: 2,[\s\S]*?maximumFractionDigits: 2/);

assert.match(menu, /const MAX_CASH_TENDERED = 100_000/);
assert.match(menu, /\^\\d\+\(\?:\\\.\\d\{0,2\}\)\?\$/);
assert.match(menu, /Cash tendered cannot exceed/);
assert.match(menu, /inputMode="decimal"/);

assert.doesNotMatch(menuManagement, /label="Menu value"/i);
assert.doesNotMatch(menuManagement, />Menu administration<\/p>/);
assert.match(menuManagement, />Menu Management<\/h1>/);

assert.match(stockManagerDashboard, /label="Pending POs"/);
assert.match(stockManagerDashboard, /sub="awaiting receipt"/);
assert.match(stockManagerDashboard, /accent="indigo"/);
assert.match(stockManagerDashboard, /onClick=\{onPendingPOSelect\}/);
assert.doesNotMatch(stockManagerDashboard, /label="Needs Attention"/);
assert.match(stockManager, /activeTab === "dashboard" \|\|/);
assert.match(stockManager, /filter\(\(order\) => order\.status === "Ordered"\)/);
assert.match(stockManager, /onPendingPOSelect=\{\(\) => setTab\("purchases"\)\}/);

console.log("UI cleanup and Sales & Reports static checks passed");
