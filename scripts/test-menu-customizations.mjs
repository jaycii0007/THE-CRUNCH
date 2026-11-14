import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../src/pages/inventory.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source + '\nexport { MenuFormModal, toMenuItem, defaultCustomizations };', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
let slots = [], cursor = 0, sent;
const errors = [];
const api = { post: async (url, body) => { sent = { url, body }; } };
const exports = {};
vm.runInNewContext(compiled, { exports, console, URL,
  require(id) {
    if (id === 'react') return { ...React, useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    } };
    if (id === 'react/jsx-runtime') return require(id);
    if (id === 'framer-motion') return { motion: { div: 'div' } };
    return { api, apiCall: async () => {}, GENERAL_SETTINGS_DEFAULTS: {}, formatCurrencyAmount: String };
  },
});
const item = (id, name, category, product_type = 'menu_item', category_system_key = '') => exports.toMenuItem({
  id, name, category, product_type, category_system_key, price: 100, availability_status: 'Available',
});
const drink = item(2, 'Mango Drink', 'Beverages');
const sauce = item(3, 'Garlic', 'Chicken Flavors', 'selection_option', 'chicken_flavors');
const rice = item(4, 'Kimchi Rice', 'Menu Food');
const props = { item: null, categories: ['Menu Food', 'Chicken Flavors'], chickenFlavorCategoryName: 'Chicken Flavors',
  ingredientOptions: [{ id: 8, name: 'Chicken', category: 'Raw Materials', unit: 'g' }],
  menuItems: [drink, sauce, rice], toast: (message, type) => { if (type === 'error') errors.push(message); }, onClose() {}, onSaved() {},
};
const render = () => { cursor = 0; return exports.MenuFormModal(props); };
function all(node) {
  if (Array.isArray(node)) return node.flatMap(all);
  if (!node || typeof node !== 'object' || !node.props) return [];
  return [node, ...all(node.props.children), ...all(node.props.footer)];
}
let tree = render();
assert.equal(all(tree).filter((node) => node.props.role === 'switch').length, 2);
assert.ok(all(tree).filter((node) => node.props.role === 'switch').every((node) => node.props.checked === false));
slots[0] = { ...slots[0], name: 'Meal', category: 'Menu Food', price: '100', ingredients: [{ productId: '8', quantityRequired: '250' }] };
tree = render();
assert.ok(all(tree).some((node) => node.type === 'span' && node.props.children === 'g'));
all(tree).find((node) => node.props.role === 'switch').props.onChange({ target: { checked: true } });
tree = render();
assert.equal(all(tree).find((node) => node.props.label === 'Included Quantity').props.value, '1');
assert.equal(all(tree).filter((node) => node.type === 'input' && node.props.type === 'checkbox' && !node.props.role).length, 1, 'Only the existing promotion checkbox remains; no product checkboxes');
tree = render();
assert.ok(!all(tree).some((node) => String(node.props.label).includes('Extra Fee')));
tree = render();
await all(tree).find((node) => node.props.variant === 'solid' && node.props.onClick).props.onClick();
assert.deepEqual(errors, []);
assert.equal(sent.url, '/products');
assert.equal(sent.body.customizations.drinks.enabled, true);
assert.equal(sent.body.customizations.drinks.extraFee, undefined);
assert.equal(sent.body.customizations.drinks.productIds, undefined);
assert.equal(sent.body.customizations.sauces.enabled, false);
assert.equal(sent.body.ingredients[0].quantity_required, 250);
const reloaded = exports.toMenuItem({ id: 1, name: 'Meal', category: 'Menu Food', customizations: sent.body.customizations });
props.item = reloaded;
slots = [];
tree = render();
assert.equal(all(tree).find((node) => node.props.role === 'switch').props.checked, true);
assert.equal(all(tree).find((node) => node.props.label === 'Included Quantity').props.value, '1');
props.item = sauce;
slots = [];
assert.equal(all(render()).filter((node) => node.props.role === 'switch').length, 0);
console.log('Menu form: default OFF, linked drinks, included quantity payload, edit reload, ingredient units and Chicken Flavor exclusion passed (mock API).');

const selectionsSource = fs.readFileSync(new URL('../src/components/included-menu-selections.tsx', import.meta.url), 'utf8');
const selectionsExports = {};
vm.runInNewContext(ts.transpileModule(selectionsSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: selectionsExports, require(id) {
  if (id === 'react') return { useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; } };
  return require(id);
} });
slots = [];
let chosen;
const selectionProps = { name: 'Meal', config: { drinks: { enabled: true, includedQuantity: 2, productIds: [999] } },
  options: [{ id: 2, name: 'Lychee', stock: 10, available: true, kind: 'drinks' }, { id: 5, name: 'Mango', stock: 10, available: true, kind: 'drinks' }, { id: 6, name: 'Fries', stock: 10, available: true, kind: null }],
  requireFlavor: true, flavors: [{ id: 3, name: 'Garlic' }], onCancel() {}, onConfirm(value) { chosen = value; } };
const popup = () => { cursor = 0; return selectionsExports.IncludedSelectionModal(selectionProps); };
let choiceTree = popup();
const confirm = (root) => all(root).find((node) => node.type === 'button' && node.props.children === 'Add to cart');
assert.equal(confirm(choiceTree).props.disabled, true);
assert.equal(all(choiceTree).filter((node) => node.props.type === 'number').length, 0);
assert.equal(all(choiceTree).filter((node) => node.props['aria-label']?.startsWith('Included drinks')).length, 2);
all(choiceTree).find((node) => node.type === 'select').props.onChange({ target: { value: '3' } });
for (const [index, id] of [2, 5].entries()) {
  choiceTree = popup();
  all(choiceTree).find((node) => node.props['aria-label'] === `Included drinks ${index + 1}`).props.onChange({ target: { value: String(id) } });
}
choiceTree = popup();
assert.equal(confirm(choiceTree).props.disabled, false);
confirm(choiceTree).props.onClick();
assert.equal(chosen.length, 2);
assert.equal(chosen[0].qty, 1);
const display = renderToStaticMarkup(React.createElement(selectionsExports.IncludedChoices, { choices: chosen }));
assert.match(display, /Included Drink: Lychee/);
assert.match(display, /Included Drink: Mango/);
assert.match(fs.readFileSync(new URL('../src/pages/Order.tsx', import.meta.url), 'utf8'), /IncludedChoices choices=\{item.includedSelections\}/);
selectionProps.options.push({ id: 7, name: 'New Juice', stock: 5, available: true, kind: 'drinks' });
assert.ok(all(popup()).some((node) => node.type === 'option' && node.props.value === 7), 'New category product appears automatically');
selectionProps.options[0].available = false;
assert.equal(confirm(popup()).props.disabled, true);
// One included serving gets one dropdown. Exact totals and stock still gate Add.
slots = [];
selectionProps.requireFlavor = false;
selectionProps.config = { drinks: { enabled: true, includedQuantity: 1 } };
selectionProps.options[0].available = true;
choiceTree = popup();
assert.equal(all(choiceTree).filter((node) => node.type === 'select').length, 1);
assert.equal(confirm(choiceTree).props.disabled, true);
all(choiceTree).find((node) => node.type === 'select').props.onChange({ target: { value: '2' } });
assert.equal(confirm(popup()).props.disabled, false);

// Required Chicken Flavor is displayed once and fulfills selection-only sauces.
slots = [];
selectionProps.requireFlavor = true;
selectionProps.config = { sauces: { enabled: true, includedQuantity: 1 } };
selectionProps.options.push({ id: 3, name: 'Garlic', stock: 999, available: true, kind: 'sauces' });
choiceTree = popup();
all(choiceTree).find((node) => node.props['aria-label'] === 'Required Chicken Flavor').props.onChange({ target: { value: '3' } });
choiceTree = popup();
assert.equal(all(choiceTree).filter((node) => node.type === 'select').length, 1, 'No duplicated flavor selector');
assert.equal(confirm(choiceTree).props.disabled, false);
confirm(choiceTree).props.onClick();
assert.equal(chosen[0].product_id, 3);
assert.equal(chosen[0].qty, 1);

// Legitimate inventory-tracked sauces remain selectable alongside that flavor.
selectionProps.options.push({ id: 8, name: 'Extra Sauce', stock: 5, available: true, kind: 'sauces' });
choiceTree = popup();
const sauceSelect = all(choiceTree).find((node) => node.props['aria-label'] === 'Included sauces 1');
assert.ok(sauceSelect);
assert.ok(all(sauceSelect).some((node) => node.type === 'option' && node.props.value === 8));
assert.ok(!all(sauceSelect).some((node) => node.props.children === 'Garlic'), 'Full Chicken Flavor list is not duplicated');
sauceSelect.props.onChange({ target: { value: '8' } });
confirm(popup()).props.onClick();
assert.equal(chosen[0].product_id, 8);
assert.equal(chosen[0].qty, 1);

slots = [];
selectionProps.requireFlavor = false;
selectionProps.config = { drinks: { enabled: true, includedQuantity: 2 } };
selectionProps.options[0].stock = 1;
for (const index of [1, 2]) all(popup()).find((node) => node.props['aria-label'] === `Included drinks ${index}`).props.onChange({ target: { value: '2' } });
assert.equal(confirm(popup()).props.disabled, true, 'Repeated serving cannot exceed usable stock');
assert.match(selectionsSource, /min-h-0 overflow-y-auto/);
assert.match(selectionsSource, /flex shrink-0 justify-end/, 'Action footer stays outside scrolling choices');
for (const page of ['menu.tsx', 'usersmenu.tsx']) {
  const code = fs.readFileSync(new URL(`../src/pages/${page}`, import.meta.url), 'utf8');
  assert.match(code, /included_selections: .*includedSelections/);
  assert.match(code, /IncludedSelectionModal/);
}
const customerSource = fs.readFileSync(new URL('../src/pages/usersmenu.tsx', import.meta.url), 'utf8');
assert.match(customerSource, /lineId: item.lineId, includedSelections: item.includedSelections/);
assert.match(customerSource, /selectedFlavorProductId: item.selectedFlavorProductId, lineId: item.lineId, includedSelections: item.includedSelections/);
console.log('Shared included popup: exact mixed counts, required independent flavor, automatic category options only, stale stock rejection, both ordering payloads and guest-cart persistence passed.');

const quantityExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/orderQuantity.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: quantityExports });
const catalog = [
  { id: 1, ingredients: [{ product_id: 10, quantity_required: 2, stock: 1000 }] },
  { id: 2, ingredients: [{ product_id: 20, quantity_required: 5, stock: 995 }] },
  { id: 3, ingredients: [{ product_id: 20, quantity_required: 10, stock: 995 }] },
  { id: 4, ingredients: [] },
];
const meals = { id: 1, quantity: 189, includedSelections: [{ product_id: 2, qty: 1 }, { product_id: 4, qty: 1 }] };
assert.equal(quantityExports.cartFitsInventory([meals, { id: 2, quantity: 10 }], catalog), true);
assert.equal(quantityExports.cartFitsInventory([meals, { id: 2, quantity: 11 }], catalog), false);
assert.equal(quantityExports.cartFitsInventory([meals, { id: 2, quantity: 199 }], catalog), false);
assert.equal(quantityExports.cartFitsInventory([meals, { id: 3, quantity: 5 }], catalog), true);
assert.equal(quantityExports.cartFitsInventory([meals, { id: 3, quantity: 6 }], catalog), false);
const colored = renderToStaticMarkup(React.createElement(selectionsExports.IncludedChoices, {
  flavorId: 3, choices: [{ kind: 'sauces', product_id: 3, name: 'Garlic', qty: 1 },
    { kind: 'sauces', product_id: 8, name: 'Real Sauce', qty: 1 }, { kind: 'drinks', name: 'Lychee', qty: 1 },
    { kind: 'rice', name: 'Rice', qty: 1 }, { kind: 'future', name: 'Future', qty: 1 }],
}));
assert.doesNotMatch(colored, /Garlic/);
assert.match(colored, /Real Sauce/);
for (const color of ['orange', 'blue', 'green', 'purple']) assert.match(colored, new RegExp(`text-${color}-700 dark:text-${color}-300`));
console.log('Cart regression: 189 included + 10 separate drinks allowed; 11 rejected; shared ingredients, flavor deduplication and label colors passed.');

// Exercise the actual POS persistence effects without mounting or calling APIs.
const posSource = fs.readFileSync(new URL('../src/pages/menu.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const restoreStart = posSource.indexOf('  useEffect(() => {\n    if (!cashierId || !products.length || draftRestored.current)');
const restoreEnd = posSource.indexOf('  }, [cashierId, products]);', restoreStart) + '  }, [cashierId, products]);'.length;
const saveEnd = posSource.indexOf('  }, [cart, cashierId, orderType, paymentMethod, customerType, orderNote, soldToName, done]);', restoreEnd) + '  }, [cart, cashierId, orderType, paymentMethod, customerType, orderNote, soldToName, done]);'.length;
const effectCode = ts.transpileModule(posSource.slice(restoreStart, saveEnd), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const storage = new Map();
const context = { cashierId: 9, products: [{ id: 1, name: 'Current meal', price: 120 }, { id: 2, name: 'Current drink' }, { id: 3, name: 'Garlic', categorySystemKey: 'chicken_flavors' }],
  draftRestored: { current: false }, draftKey: 'the-crunch:cashier-draft', cart: [], done: null,
  orderType: 'dine-in', paymentMethod: 'cash', customerType: '', orderNote: '', soldToName: '',
  includedKey: selectionsExports.includedKey,
  sessionStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
  useEffect: (callback) => callback(),
};
for (const [setter, field] of Object.entries({ setCart: 'cart', setOrderType: 'orderType', setPaymentMethod: 'paymentMethod', setCustomerType: 'customerType', setOrderNote: 'orderNote', setSoldToName: 'soldToName' })) context[setter] = (value) => { context[field] = value; };
const draft = { version: 1, cashierId: 9, orderType: 'take-out', paymentMethod: 'cash', customerType: 'Regular', orderNote: 'Keep warm', items: [{ id: 1, quantity: 2, flavorId: 3, choices: [{ kind: 'drinks', product_id: 2, qty: 1 }], note: 'No spice', price: 1 }] };
const runEffects = () => vm.runInNewContext(effectCode, context);
for (const lifecycle of ['refresh', 'navigation']) {
  storage.set(context.draftKey, JSON.stringify(draft)); context.draftRestored.current = false; context.cart = [];
  runEffects();
  assert.equal(context.cart[0].price, 120, lifecycle + ' uses current catalog price');
  assert.equal(context.cart[0].includedSelections[0].product_id, 2);
  assert.equal(context.cart[0].selectedFlavorProductId, 3);
  assert.equal(context.cart[0].note, 'No spice');
  const saved = JSON.parse(storage.get(context.draftKey));
  assert.equal(saved.items[0].price, undefined); assert.equal(saved.token, undefined);
}
context.done = { id: 1 }; runEffects(); assert.equal(storage.has(context.draftKey), false);
context.done = null; context.cart = []; runEffects(); assert.equal(storage.has(context.draftKey), false);
for (const value of ['broken JSON', JSON.stringify({ ...draft, cashierId: 10 }), JSON.stringify({ ...draft, version: 0 })]) {
  storage.set(context.draftKey, value); context.draftRestored.current = false; context.cart = []; runEffects();
  assert.equal(context.cart.length, 0); assert.equal(storage.has(context.draftKey), false);
}
const authSource = fs.readFileSync(new URL('../src/context/authcontext.tsx', import.meta.url), 'utf8');
assert.match(authSource, /function clearStoredAuth\(\) \{[\s\S]*?sessionStorage.removeItem\('the-crunch:cashier-draft'\)/);
assert.match(posSource, /currentProducts = mapProducts\(await api.get/);
assert.match(posSource, /invalid \|\| !cartFitsInventory\(cart, currentProducts\)/);
console.log('Cashier draft effects: refresh/navigation restore, current prices, included/flavor metadata, notes/options, completion/clear, account isolation and malformed data passed; no API or stock mutation during restore.');
