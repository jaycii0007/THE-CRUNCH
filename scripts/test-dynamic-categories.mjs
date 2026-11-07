import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const settings = read("../src/pages/settings.tsx");
const management = read("../src/pages/inventory.tsx");
const cashier = read("../src/pages/menu.tsx");
const customerMenu = read("../src/pages/usersmenu.tsx");
const customerHome = read("../src/pages/products.tsx");
const stockManager = read("../src/pages/stockmanager/index.tsx");
const stockManagerApi = read("../src/pages/stockmanager/services/api.ts");

assert.match(settings, /\/settings\/menu-categories\?activeOnly=0/);
assert.match(settings, /\/settings\/inventory-categories/);
assert.match(settings, /\/settings\/menu-categories\/\$\{category\.category_id\}/);
assert.match(settings, /\/settings\/inventory-categories\/\$\{category\.category_id\}/);

assert.match(management, /\/settings\/menu-categories\?activeOnly=1/);
assert.match(stockManager, /api\.getInventoryCategories\(\)/);
assert.match(stockManagerApi, /\/settings\/inventory-categories\?activeOnly=1/);
assert.doesNotMatch(stockManager, /RAW_MATERIAL_CATEGORIES/);

assert.match(cashier, /new Set\(products\.map\(\(p\) => p\.category\)\)/);

assert.doesNotMatch(customerMenu, /CATEGORY_ORDER/);
assert.doesNotMatch(customerMenu, /includes\("drink"\)|includes\("side"\)|includes\("combo"\)/);
assert.match(customerMenu, /category:\s*normalizeCategory\(row\.category\)/);
assert.match(customerMenu, /\/settings\/menu-categories\?activeOnly=1/);

assert.doesNotMatch(customerHome, /const CATEGORIES\s*=\s*\[/);
assert.doesNotMatch(customerHome, /includes\('drink'\)|includes\('side'\)|includes\('combo'\)/);
assert.match(customerHome, /category:\s*normCat\(r\?\.category\)/);
assert.match(customerHome, /\/settings\/menu-categories\?activeOnly=1/);
assert.match(customerHome, /products\.filter\(p => !p\.archived\)/);

console.log("Dynamic category source checks passed");
