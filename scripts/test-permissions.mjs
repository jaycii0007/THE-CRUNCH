import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";

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
  cook: {
    overview: false,
    orders: true,
    menuManagement: false,
    menus: false,
    stockManager: false,
    userAccounts: false,
    salesReports: false,
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

const require = createRequire(import.meta.url);
const { DEFAULT_ROLE_PERMISSIONS: backendDefaults } = require(
  path.resolve(root, "../Backend/src/services/settingsDefaults.js"),
);
for (const role of permissions.STAFF_ROLES) {
  assert.deepEqual(
    JSON.parse(JSON.stringify(backendDefaults[role])),
    expected[role],
    `Frontend and backend defaults differ for ${role}`,
  );
}

assert.equal(permissions.normalizeRole("inventory_manager"), "inventory_manager");
assert.equal(permissions.normalizeRole("INVENTORY_MANAGER"), "inventory_manager");
assert.equal(permissions.normalizeRole("stock_manager"), null);

const missingLegacy = permissions.normalizePermissionsMap({
  cashier: { menus: false },
});
assert.equal(missingLegacy.cashier.menus, false);
assert.equal(missingLegacy.cashier.salesReports, true);
assert.equal(missingLegacy.inventory_manager.menuManagement, true);

const legacyRolePayload = permissions.normalizePermissionsMap({
  "Stock Manager": { menus: true, salesReports: true },
});
assert.equal(legacyRolePayload.inventory_manager.menus, false);
assert.equal(legacyRolePayload.inventory_manager.salesReports, false);

const savedChange = permissions.normalizePermissionsMap({
  cashier: { salesReports: false },
  administrator: { overview: false, settings: false },
});
assert.equal(savedChange.cashier.salesReports, false);
assert.equal(
  permissions.hasPagePermission("cashier", "salesReports", savedChange),
  false,
);
for (const key of permissions.PERMISSION_KEYS) {
  assert.equal(savedChange.administrator[key], true);
  assert.equal(
    permissions.hasPagePermission("administrator", key, savedChange),
    true,
  );
}

for (const [role, matrix] of Object.entries(expected)) {
  for (const [permissionKey, allowed] of Object.entries(matrix)) {
    assert.equal(
      permissions.hasPagePermission(role, permissionKey, permissions.DEFAULT_PERMISSIONS),
      allowed,
      `${role} direct-route authorization mismatch for ${permissionKey}`,
    );
  }
}

const sidebarSource = fs.readFileSync(path.join(root, "src/components/Sidebar.tsx"), "utf8");
const appSource = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
const settingsSource = fs.readFileSync(path.join(root, "src/pages/settings.tsx"), "utf8");
assert.match(sidebarSource, /SIDEBAR_ITEMS\.filter/);
assert.match(sidebarSource, /hasPagePermission\(staffRole/);
assert.match(appSource, /hasPagePermission\(userRole/);
assert.match(appSource, /permissionsReady/);
assert.match(settingsSource, /api\.get<Record<string, unknown>>\("\/settings\/permissions"\)/);
assert.match(settingsSource, /const pages = Array\.from/);

console.log("Frontend permission policy and navigation regression tests passed");
