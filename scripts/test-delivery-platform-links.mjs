import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const settings = read("src/pages/settings.tsx");
const userMenu = read("src/pages/usersmenu.tsx");

assert.match(settings, /Delivery Platform Links/);
assert.match(settings, /GrabFood Ordering URL/);
assert.match(settings, /Foodpanda Ordering URL/);
assert.match(settings, /api\.put<DeliveryPlatformLinks>\("\/settings\/delivery-links"/);
assert.match(settings, /Clear a field to disable that platform/);
assert.match(settings, /Delivery platform links saved/);

assert.doesNotMatch(userMenu, /const DELIVERY_LINKS\s*=/);
assert.doesNotMatch(userMenu, /foodpanda\.go\.link\/9O718/);
assert.doesNotMatch(userMenu, /r\.grab\.com\/g\/6-20260421/);
assert.match(userMenu, /api\s*\.get<DeliveryPlatformLinks>\("\/settings\/delivery-links"/);
assert.match(userMenu, /grabfoodUrl:\s*null,\s*foodpandaUrl:\s*null/);
assert.match(userMenu, /target="_blank" rel="noopener noreferrer"/);
assert.match(userMenu, /Ordering link is not configured/);
assert.match(userMenu, /Pick-up order/);
assert.match(userMenu, /Delivery order/);

console.log("Administrator delivery-link and public User Menu checks passed.");
