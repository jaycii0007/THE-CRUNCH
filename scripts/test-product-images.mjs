import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

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

const require = createRequire(import.meta.url);
const fallback = '/images/menu-placeholder.jpg';
assert.ok(readFileSync(new URL('../public/images/menu-placeholder.jpg', import.meta.url)).length > 0);
assert.doesNotMatch(menuManagement, /image: image \?\? PLACEHOLDER_IMG/, 'Do not persist the display placeholder');
assert.match(menuManagement, /image: image \?\? null/);
assert.match(menuManagement, /if \(imageFile\) image = await uploadProductImage\(imageFile\)/);
assert.match(menuManagement, /if \(image\) payload.image = image/);
let failed = false, stateChanges = 0;
const compiled = ts.transpileModule(component, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const imageExports = {};
vm.runInNewContext(compiled, { exports: imageExports, require(id) {
  if (id === 'react') return { useState: () => [failed, (value) => { failed = value; stateChanges++; }] };
  if (id === '@/lib/api') return { resolveAssetUrl(value) {
    const text = String(value || '').trim();
    return /^(https?:|blob:|\/img\/)/.test(text) ? text : '/img/placeholder.jpg';
  } };
  return require(id);
} });
function mount(src, fallbackSrc = fallback) {
  failed = false; stateChanges = 0;
  const child = imageExports.ProductImage({ src, fallbackSrc, className: 'h-full w-full object-cover' });
  return () => child.type(child.props);
}
for (const src of [null, undefined, '', '   ', '/img/placeholder.jpg', fallback]) {
  const render = mount(src);
  assert.equal(render().props.src, fallback);
  render().props.onError({}); render().props.onError({});
  assert.equal(stateChanges, 0, 'A failed placeholder must not start another fallback');
}
const valid = mount('https://example.test/upload.jpg');
assert.equal(valid().props.src, 'https://example.test/upload.jpg');
assert.equal(valid().props.className, 'h-full w-full object-cover');
valid().props.onError({});
assert.equal(valid().props.src, fallback);
valid().props.onError({});
assert.equal(stateChanges, 1, 'Broken upload falls back once');
assert.equal(mount('blob:upload-preview')().props.src, 'blob:upload-preview');
assert.equal(mount(null, '/img/placeholder.jpg')().props.src, '/img/placeholder.jpg', 'Other consumers retain their existing default');
console.log('Menu placeholder: missing/blank/legacy/broken/valid images, upload preview, styling, no database placeholder and no fallback loop passed.');
