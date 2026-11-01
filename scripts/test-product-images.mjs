import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const component = read("src/components/ProductImage.tsx");
const api = read("src/lib/api.ts");
const menuManagement = read("src/pages/inventory.tsx");
const pos = read("src/pages/menu.tsx");
const onlineOrdering = read("src/pages/usersmenu.tsx");

assert.match(component, /PRODUCT_IMAGE_PLACEHOLDER = "\/img\/placeholder\.jpg"/);
assert.match(component, /const \[failed, setFailed\] = useState\(false\)/);
assert.match(component, /failed \? fallback : source/);
assert.match(component, /if \(!failed && source !== fallback\)/);
assert.match(component, /key=\{resolvedSource\}/);
assert.ok(api.includes('if (/^blob:/i.test(normalized)) return normalized;'));
assert.ok(api.includes('if (/^https?:\\/\\//i.test(normalized)) return normalized;'));
assert.match(api, /normalized\.startsWith\("\/api\/upload-product-image\/files\/"\)/);
assert.match(api, /LEGACY_PRODUCT_IMAGE_CACHE_VERSION = "20261102"/);
assert.match(api, /\?v=\$\{LEGACY_PRODUCT_IMAGE_CACHE_VERSION\}/);

for (const [label, source] of [
  ["Menu Management", menuManagement],
  ["POS", pos],
  ["Online Ordering", onlineOrdering],
]) {
  assert.match(source, /import \{ ProductImage \}/, `${label} must use the shared fallback`);
  assert.match(source, /<ProductImage/, `${label} must render the shared fallback`);
}

console.log("Shared product-image fallback checks passed");
