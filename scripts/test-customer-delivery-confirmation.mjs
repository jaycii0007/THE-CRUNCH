import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const customer = read('../src/pages/usersmenu.tsx');
const cashier = read('../src/pages/menu.tsx');
const extract = (source, names) => {
  const file = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return file.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(file)).join('\n');
};
let state, cursor, role, calls, refreshed, resolveRequest, rejectRequest, effects, timers;
const context = vm.createContext({
  URL, Error,
  React: { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) },
  useState: initial => {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
  },
  useRef: initial => {
    const index = cursor++;
    if (!(index in state)) state[index] = { current: initial };
    return state[index];
  },
  useEffect: effect => { effects.push(effect); },
  window: { setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; }, clearTimeout: () => {} },
  useAuth: () => ({ user: { role } }), normalizeRole: value => value,
  norm: value => String(value).toLowerCase(),
  isPaid: value => value === 'Paid',
  Modal: 'Modal', Button: 'Button', C: {}, FONT: 'Poppins', ACT: { dark: '', green: '' },
  api: { patch: (...args) => {
    calls.push(args);
    return new Promise((resolve, reject) => { resolveRequest = resolve; rejectRequest = reject; });
  } },
});
vm.runInContext(ts.transpileModule(extract(customer, ['DeliveryReceiptConfirmation']) + extract(cashier, ['DeliveryFulfillmentForm', 'cashierDeliveryStage']), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : node && typeof node === 'object' ? [node, ...node.children.flatMap(flatten)] : [node];
const text = node => flatten(node).filter(value => typeof value === 'string').join(' ');
const render = (name, props) => { cursor = 0; return context[name](props); };
const reset = () => { state = []; calls = []; refreshed = 0; effects = []; timers = []; role = 'cashier'; };
const order = { id: 50, trackingStatus: 'Ready for Pickup', paymentStatus: 'Paid', handoverTimestamp: 'pickup', delivery: { preferredCourier: 'Grab', processedAt:'processed',courierService:'Grab',bookingReference:'BOOK' }, riderName:'Actual rider' };
const props = { order, onRefresh: async () => { refreshed++; } };
const button = (tree, label) => flatten(tree).find(node => ['button', 'Button'].includes(node?.type) && text(node) === label);
for (const changes of [{ delivery: null }, { handoverTimestamp: null }, { paymentStatus: 'Pending Payment' }, ...['Completed', 'Cancelled', 'Refunded'].map(trackingStatus => ({ trackingStatus })), { delivery: { deliveredAt: 'done' } }]) {
  reset(); assert.equal(render('DeliveryReceiptConfirmation', { ...props, order: { ...order, ...changes } }), null);
}
reset();
let tree = render('DeliveryReceiptConfirmation', props);
assert.match(text(tree), /Your order is on its way/);
button(tree, 'Confirm Received').props.onClick();
tree = render('DeliveryReceiptConfirmation', props);
assert.match(text(tree), /Have you received your order\?/);
button(tree, 'Not Yet').props.onClick();
assert.equal(flatten(render('DeliveryReceiptConfirmation', props)).some(node => node?.type === 'Modal'), false);
assert.equal(calls.length, 0);
button(render('DeliveryReceiptConfirmation', props), 'Confirm Received').props.onClick();
tree = render('DeliveryReceiptConfirmation', props);
button(tree, 'Yes, I Received It').props.onClick();
button(tree, 'Yes, I Received It').props.onClick();
assert.equal(calls.length, 1, 'Ref guard blocks a second click before React renders');
assert.equal(calls[0][0], '/orders/50/delivery-fulfillment');
assert.equal(calls[0][1].action, 'delivered');
tree = render('DeliveryReceiptConfirmation', props);
assert.equal(button(tree, 'Confirming...').props.disabled, true);
resolveRequest({}); await new Promise(setImmediate);
assert.equal(refreshed, 1);
assert.equal(flatten(render('DeliveryReceiptConfirmation', props)).some(node => node?.type === 'Modal'), false);
reset();
button(render('DeliveryReceiptConfirmation', props), 'Confirm Received').props.onClick();
button(render('DeliveryReceiptConfirmation', props), 'Yes, I Received It').props.onClick();
rejectRequest(new Error('Unable to confirm receipt')); await new Promise(setImmediate);
tree = render('DeliveryReceiptConfirmation', props);
assert.equal(refreshed, 0);
assert.ok(flatten(tree).some(node => node?.type === 'Modal'));
assert.match(text(flatten(tree).find(node => node?.props?.role === 'alert')), /Unable to confirm receipt/);
assert.ok(button(tree, 'Yes, I Received It'));
for (const actor of ['cashier', 'administrator']) {
  reset(); role = actor;
  tree = render('DeliveryFulfillmentForm', { order, onSaved: async () => {} });
  assert.match(text(tree), /Waiting for Customer Confirmation/);
  assert.equal(Boolean(button(tree, 'Confirm Delivered (Admin exception)')), actor === 'administrator');
  assert.equal(flatten(tree).some(node => node?.type === 'select'), actor === 'administrator');
  assert.equal(Boolean(button(tree, 'Confirm Rider Pickup')), false);
  if (actor === 'administrator') {
    assert.equal(button(tree, 'Confirm Delivered (Admin exception)').props.disabled, true);
    flatten(tree).find(node => node?.type === 'select').props.onChange({ target: { value: 'courier' } });
    tree = render('DeliveryFulfillmentForm', { order, onSaved: async () => {} });
    assert.equal(button(tree, 'Confirm Delivered (Admin exception)').props.disabled, true);
    flatten(tree).find(node => node?.type === 'input' && node.props.maxLength === 1000).props.onChange({ target: { value: 'Courier booking verified by phone' } });
    tree = render('DeliveryFulfillmentForm', { order, onSaved: async () => {} });
    assert.equal(button(tree, 'Confirm Delivered (Admin exception)').props.disabled, false);
  }
}
reset();
tree = render('DeliveryFulfillmentForm', { order: { ...order, handoverTimestamp: null }, onSaved: async () => {} });
assert.ok(button(tree, 'Confirm Rider Pickup'));
assert.ok(!text(tree).includes('Confirm Delivered'));
reset();
tree = render('DeliveryFulfillmentForm', { order: { ...order, trackingStatus: 'Awaiting Cashier Review', handoverTimestamp: null }, onSaved: async () => { refreshed++; } });
assert.ok(button(tree, 'Process Order')); assert.ok(!text(tree).includes('Rider name'));
button(tree, 'Process Order').props.onClick(); button(tree, 'Process Order').props.onClick();
assert.equal(calls.length, 1); assert.equal(calls[0][1].action, 'process');
resolveRequest({}); await new Promise(setImmediate); assert.equal(refreshed, 1);
reset();
tree = render('DeliveryFulfillmentForm', { order: { ...order, handoverTimestamp: null, delivery: { ...order.delivery, bookingReference: '' } }, onSaved: async () => {} });
assert.equal(button(tree, 'Confirm Rider Pickup').props.disabled, true);
for (const [changes, label] of [
  [{ paymentStatus: 'Pending Payment', delivery: { fee: null } }, 'Waiting for Delivery Fee'],
  [{ paymentStatus: 'Pending Payment', delivery: { fee: 50 } }, 'Waiting for Customer Payment'],
  [{ trackingStatus: 'Awaiting Cashier Review' }, 'Paid - Waiting for Cashier'],
  [{ trackingStatus: 'Queued' }, 'Sent to Kitchen - Queued'],
  [{ trackingStatus: 'Preparing' }, 'Sent to Kitchen - Preparing'],
  [{ trackingStatus: 'Ready for Pickup' }, 'Ready for Rider'],
]) assert.equal(context.cashierDeliveryStage({ ...order, handoverTimestamp: null, ...changes }), label);
assert.equal(context.cashierDeliveryStage(order), 'Out for Delivery');
assert.equal(context.cashierDeliveryStage({ ...order, delivery: { ...order.delivery, confirmationOverdue: true } }), 'Confirmation Overdue');
reset();
tree = render('DeliveryReceiptConfirmation', { ...props, order: { ...order, delivery: { ...order.delivery, confirmationOverdue: true } } });
assert.ok(button(tree, 'Confirm Received'), 'Owner confirmation remains available after the deadline');
effects.at(-1)(); assert.equal(timers.length, 0, 'Already-overdue data does not schedule repeated refreshes');
reset();
render('DeliveryReceiptConfirmation', { ...props, order: { ...order, delivery: { ...order.delivery, confirmationRemainingMs: 3600000 } } });
effects.at(-1)(); assert.equal(timers.length, 1); assert.equal(timers[0].delay, 3601000);
timers[0].callback(); await new Promise(setImmediate);
assert.equal(refreshed, 1); assert.equal(calls.length, 0, 'Deadline only refreshes authoritative server data; never completes an order');
assert.match(customer, /topics: \["orders.changed"\],\s*onInvalidate: fetchOrders/);
assert.match(customer, /setActiveOrders\(d.activeOrders \?\? \[\]\)/);
assert.match(customer, /setOrderHistory\(d.historyOrders \?\? \[\]\)/);
assert.match(customer, /<DeliveryReceiptConfirmation order=\{o\} onRefresh=\{onRefresh\}/);
console.log('Customer receipt UI: pickup/payment guards, confirmation dialog, double-click protection, refresh, error retention, Cashier pickup and Admin-only exception passed. Mock requests only.');
