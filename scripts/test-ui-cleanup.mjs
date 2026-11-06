import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const dashboard = read("src/pages/index.tsx");
const menu = read("src/pages/menu.tsx");
const sidebar = read("src/components/Sidebar.tsx");
const reports = read("src/pages/sales-reports.tsx");
const menuManagement = read("src/pages/inventory.tsx");

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

assert.doesNotMatch(menuManagement, /label="Menu value"/i);

console.log("UI cleanup and Sales & Reports static checks passed");
