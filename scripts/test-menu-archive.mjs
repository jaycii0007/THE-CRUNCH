import assert from "node:assert/strict";
import fs from "node:fs";

const management = fs.readFileSync(new URL("../src/pages/inventory.tsx", import.meta.url), "utf8");
const cashier = fs.readFileSync(new URL("../src/pages/menu.tsx", import.meta.url), "utf8");
const customer = fs.readFileSync(new URL("../src/pages/usersmenu.tsx", import.meta.url), "utf8");
const customerHome = fs.readFileSync(new URL("../src/pages/products.tsx", import.meta.url), "utf8");

assert.match(management, /value:\s*"archived",\s*label:\s*"Archived"/);
assert.match(management, /\/products\/\$\{productId\}\/\$\{action\}/);
assert.match(management, /PRODUCT_HAS_PROTECTED_HISTORY/);
assert.match(management, /Historical records protected/);
assert.match(management, /Live ingredient and stock availability still applies/);
assert.match(cashier, /availability_status\)\s*===\s*"hidden"\)\s*continue/);
assert.match(customer, /availability_status\)\s*===\s*"hidden"\)\s*continue/);
assert.match(customerHome, /archived:\s*String\(r\?\.availability_status\s*\?\?\s*r\?\.availabilityStatus/);
assert.match(customerHome, /products\.filter\(p\s*=>\s*!p\.archived/);
assert.match(customerHome, /if \(matchedProduct\?\.archived\) return \[\]/);
assert.match(customerHome, /feedbackOptions[\s\S]*?products\.filter\(p\s*=>\s*!p\.archived\)/);

console.log("Menu Management archive UI checks passed");
