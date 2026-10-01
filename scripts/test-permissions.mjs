import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "src/lib/permissions.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

const moduleRecord = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleRecord,
  exports: moduleRecord.exports,
  require(specifier) {
    if (specifier === "./api") {
      return {
        api: { get: async () => ({}) },
        getStoredAuthToken: () => null,
      };
    }
    throw new Error(`Unexpected test dependency: ${specifier}`);
  },
  console,
});

const permissions = moduleRecord.exports;
const expected = {
  administrator: {
    overview: true,
    orders: true,
    menuManagement: true,
    menus: true,
    stockManager: true,
    userAccounts: true,
    salesReports: true,
    settings: true,
  },
  cashier: {
    overview: true,
    orders: true,
    menuManagement: false,
    menus: true,
    stockManager: false,
    userAccounts: false,
    salesReports: true,
    settings: false,
  },
  inventory_manager: {
    overview: true,
    orders: true,
    menuManagement: true,
    menus: false,
    stockManager: true,
    userAccounts: false,
    salesReports: false,
    settings: false,
  },
};

assert.deepEqual(JSON.parse(JSON.stringify(permissions.DEFAULT_PERMISSIONS)), expected);

const backendSettingsSource = fs.readFileSync(
  path.resolve(root, "../Backend/src/routes/settingsRoutes.js"),
  "utf8",
);
const backendDefaultsMatch = backendSettingsSource.match(
  /const DEFAULT_ROLE_PERMISSIONS = (\{[\s\S]*?\n\});/,
);
assert.ok(backendDefaultsMatch, "Backend permission defaults were not found");
const backendDefaults = vm.runInNewContext(`(${backendDefaultsMatch[1]})`);
for (const role of permissions.STAFF_ROLES) {
  assert.deepEqual(
    JSON.parse(JSON.stringify(backendDefaults[role])),
    expected[role],
    `Frontend and backend defaults differ for ${role}`,
  );
}

assert.deepEqual(
  JSON.parse(JSON.stringify(
    permissions.STAFF_PAGE_DEFINITIONS.map(({ permissionKey, label, path }) => ({ permissionKey, label, path })),
  )),
  [
    { permissionKey: "overview", label: "Overview", path: "/dashboard" },
    { permissionKey: "orders", label: "Orders", path: "/orders" },
    { permissionKey: "menuManagement", label: "Menu Management", path: "/inventory" },
    { permissionKey: "menus", label: "Menus", path: "/menu" },
    { permissionKey: "stockManager", label: "Stock Manager", path: "/stockmanager" },
    { permissionKey: "userAccounts", label: "User Accounts", path: "/users" },
    { permissionKey: "salesReports", label: "Sales Reports", path: "/sales-reports" },
    { permissionKey: "settings", label: "Settings", path: "/settings" },
  ],
);

for (const alias of [
  "Inventory Manager",
  "InventoryManager",
  "stock_manager",
  "Stock Manager",
  "StockManager",
]) {
  assert.equal(permissions.normalizeRole(alias), "inventory_manager");
}

const missingLegacy = permissions.normalizePermissionsMap({
  cashier: { menus: false },
});
assert.equal(missingLegacy.cashier.menus, false);
assert.equal(missingLegacy.cashier.salesReports, true);
assert.equal(missingLegacy.inventory_manager.menuManagement, true);

const legacyRolePayload = permissions.normalizePermissionsMap({
  "Stock Manager": { menus: true, salesReports: true },
});
assert.equal(legacyRolePayload.inventory_manager.menus, true);
assert.equal(legacyRolePayload.inventory_manager.salesReports, true);

const savedChange = permissions.normalizePermissionsMap({
  cashier: { salesReports: false },
  administrator: { overview: false, settings: false },
});
assert.equal(savedChange.cashier.salesReports, false);
assert.equal(
  permissions.canAccessStaffPage("cashier", "salesReports", savedChange),
  false,
);
for (const key of permissions.PERMISSION_KEYS) {
  assert.equal(savedChange.administrator[key], true);
  assert.equal(
    permissions.canAccessStaffPage("administrator", key, savedChange),
    true,
  );
}

for (const [role, matrix] of Object.entries(expected)) {
  for (const [permissionKey, allowed] of Object.entries(matrix)) {
    assert.equal(
      permissions.canAccessStaffPage(role, permissionKey, permissions.DEFAULT_PERMISSIONS),
      allowed,
      `${role} direct-route authorization mismatch for ${permissionKey}`,
    );
  }
}

const sidebarSource = fs.readFileSync(path.join(root, "src/components/Sidebar.tsx"), "utf8");
const appSource = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
const settingsSource = fs.readFileSync(path.join(root, "src/pages/settings.tsx"), "utf8");
assert.match(sidebarSource, /STAFF_PAGE_DEFINITIONS\.filter/);
assert.match(sidebarSource, /canAccessStaffPage\(staffRole/);
assert.doesNotMatch(sidebarSource, /const\s+SIDEBAR_ITEMS/);
assert.match(appSource, /canAccessStaffPage\(userRole/);
assert.match(appSource, /loadedPermissionSession === staffPermissionSession/);
assert.match(settingsSource, /fetchPermissions\(\)/);
assert.match(settingsSource, /const pages = STAFF_PAGE_DEFINITIONS/);

console.log("Frontend permission policy and navigation regression tests passed");
