import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const customer = read('../src/pages/usersmenu.tsx');
const cashier = read('../src/pages/menu.tsx');
const included = read('../src/components/included-menu-selections.tsx');
const extract = (source, names) => {
  const file = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return file.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(file).replace(/^export /, '')).join('\n');
};
const stores = new Map(); let key, cursor, calls = [], confirmed, cancelled = 0;
const ctx = vm.createContext({
  URL,
  React: { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) },
  useState: initial => { const state = stores.get(key), index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
  useRef: initial => { const state = stores.get(key), index = cursor++; if (!(index in state)) state[index] = { current: initial }; return state[index]; },
  useEffect: () => {}, useAuth: () => ({ user: { role: 'cashier' } }), normalizeRole: value => value,
  norm: value => String(value).toLowerCase(), formatPHP: value => Number(value).toFixed(2),
  formatInSettingsTimezone: value => value, DATE_FORMAT: {}, D: { chevron: '' },
  Badge: 'Badge', Icon: 'Icon', IncludedChoices: 'IncludedChoices', DeliveryPayment: 'DeliveryPayment', DeliveryReceiptConfirmation: 'DeliveryReceiptConfirmation', ACT: { dark: '', green: '' },
  api: { patch: async (...args) => { calls.push(args); } },
});
vm.runInContext(ts.transpileModule(extract(customer, ['CustomerActiveOrderCard', 'deliveryLabel', 'riderLink']) + extract(cashier, ['DeliveryFulfillmentForm']) + extract(included, ['IncludedSelectionModal']), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText, ctx);
const render = (name, props, id = name) => { key = id; cursor = 0; if (!stores.has(key)) stores.set(key, []); return ctx[name](props); };
const flat = (node, visible = false) => Array.isArray(node) ? node.flatMap(child => flat(child, visible)) : node && typeof node === 'object' ? visible && node.props.hidden ? [] : [node, ...node.children.flatMap(child => flat(child, visible))] : [node];
const text = (node, visible = false) => flat(node, visible).filter(value => typeof value === 'string' || typeof value === 'number').join(' ').replace(/\s+/g, ' ');
const findButton = (tree, label) => flat(tree).find(node => node?.type === 'button' && text(node) === label);
const order = { id: 1, orderNumber: '#1', createdAt: '2026-11-19 12:00', orderType: 'delivery', trackingStatus: 'Awaiting Cashier Review', paymentStatus: 'Pending Payment', total: 200, items: [{ name: 'Dynamic meal', quantity: 2, price: 100, includedSelections: [{ name: 'Dynamic sauce', kind: 'sauces', qty: 1 }] }], delivery: { recipientName: 'Recipient', recipientPhone: '09123456789', address: 'Full address\nSecond line', preferredCourier: 'Foodpanda', subtotal: 200, discount: 0, tax: 20, serviceCharge: 0, fee: null } };
const props = { o: order, onRefresh: async () => {} };
let tree = render('CustomerActiveOrderCard', props, 'first');
for (const value of ['#1', 'Dynamic meal', 'Delivery', 'Foodpanda', 'Food subtotal', '200.00']) assert.ok(text(tree, true).includes(value));
for (const value of ['Full address', 'Dynamic sauce', 'Payment Summary', 'Grand total']) assert.ok(!text(tree, true).includes(value));
findButton(tree, 'See Details').props.onClick(); tree = render('CustomerActiveOrderCard', props, 'first');
for (const value of ['Full address', 'Order Items', 'Payment Summary', 'Delivery Information', 'Order Progress', 'Pending', '20.00', '100.00']) assert.ok(text(tree, true).includes(value), value);
assert.equal(flat(tree).find(node => node?.type === 'IncludedChoices').props.choices[0].name, 'Dynamic sauce');
assert.equal(flat(render('CustomerActiveOrderCard', { ...props, o: { ...order, id: 2 } }, 'second')).find(node => node?.props?.['aria-expanded'] !== undefined)?.props['aria-expanded'], false);
assert.equal(calls.length, 0, 'Expanding cannot mutate an order');
findButton(tree, 'Hide Details').props.onClick(); assert.ok(findButton(render('CustomerActiveOrderCard', props, 'first'), 'See Details'));
for (const fee of [0, 50]) {
  const quoted = render('CustomerActiveOrderCard', { ...props, o: { ...order, delivery: { ...order.delivery, fee } } }, 'quote-' + fee);
  assert.match(text(quoted, true), /Review Total & Pay/);
  assert.ok(flat(quoted).some(node => node?.type === 'DeliveryPayment'));
}
const delivered = render('CustomerActiveOrderCard', { ...props, o: { ...order, paymentStatus: 'Paid', handoverTimestamp: 'pickup' } }, 'on-way');
assert.match(text(delivered, true), /Confirm Received/);
assert.ok(flat(delivered).some(node => node?.type === 'DeliveryReceiptConfirmation'));
const pickup = render('CustomerActiveOrderCard', { ...props, o: { ...order, orderType: 'take-out', delivery: null, subtotal: 200, taxAmount: 20 } }, 'pickup');
assert.match(text(pickup, true), /Pickup/); assert.ok(!text(pickup).includes('Delivery Information'));
const options = [{ id: 11, name: 'Dynamic option A', categoryKey: 'category:sauce', stock: 2, available: true }, { id: 12, name: 'Dynamic option B', categoryKey: 'category:sauce', stock: 1, available: true }];
const selectionProps = { name: 'Dynamic meal', config: { 'category:sauce': { enabled: true, includedQuantity: 2, label: 'Sauce', sauce: true } }, options, onConfirm: choices => { confirmed = choices; }, onCancel: () => { cancelled++; } };
tree = render('IncludedSelectionModal', selectionProps);
assert.equal(findButton(tree, 'Add to cart').props.disabled, true);
flat(tree).filter(node => node?.type === 'select')[0].props.onChange({ target: { value: '11' } });
tree = render('IncludedSelectionModal', selectionProps);
flat(tree).filter(node => node?.type === 'select')[1].props.onChange({ target: { value: '12' } });
tree = render('IncludedSelectionModal', selectionProps);
assert.equal(findButton(tree, 'Add to cart').props.disabled, false); findButton(tree, 'Add to cart').props.onClick();
assert.equal(confirmed.length, 2); assert.equal(confirmed[0].name, 'Dynamic option A'); assert.equal(confirmed[1].qty, 1);
findButton(tree, 'Cancel').props.onClick(); assert.equal(cancelled, 1);
const reducedStock = render('IncludedSelectionModal', { ...selectionProps, options: options.map(option => ({ ...option, available: false })) });
assert.equal(findButton(reducedStock, 'Add to cart').props.disabled, true);
const courierOrder = { ...order, riderName: 'Rider', trackingStatus: 'Ready for Pickup', paymentStatus: 'Paid', delivery: { ...order.delivery, courierService: 'Foodpanda', processedAt: 'processed', bookingReference: 'BOOK', trackingUrl: 'https://www.foodpanda.ph/historical' } };
tree = render('DeliveryFulfillmentForm', { order: courierOrder, onSaved: async () => {} });
assert.ok(!flat(tree).some(node => node?.type === 'input' && node.props.type === 'url'));
assert.ok(!text(tree).includes('HTTPS tracking'));
findButton(tree, 'Save courier details').props.onClick(); await new Promise(setImmediate);
assert.equal(calls[0][0], '/orders/1/delivery-fulfillment'); assert.equal(calls[0][1].bookingReference, 'BOOK');
assert.equal(Object.hasOwn(calls[0][1], 'trackingUrl'), false, 'Removed input is absent from frontend state and payload');
assert.equal(findButton(tree, 'Confirm Rider Pickup').props.disabled, false);
const formSource = cashier.slice(cashier.indexOf('function DeliveryFulfillmentForm'), cashier.indexOf('function DeliveryQuoteForm'));
assert.ok(!formSource.includes('trackingUrl'));
console.log('Targeted UI checks passed: dynamic selections/stock validation, independent active-order toggles, accurate details and action components, Pickup support, URL-free courier payload and pickup readiness. Mock requests only.');
