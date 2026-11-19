import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
function load(source, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, require: name => { assert.ok(name in dependencies, name); return dependencies[name]; }, ...globals,
  });
  return module.exports;
}
const helpers = load(read('../src/lib/cashier-order-alerts.ts'));
const now = Date.parse('2026-11-20T12:00:00Z');
const request = { id: 1, createdAt: new Date(now).toISOString(), trackingStatus: 'Awaiting Cashier Review', paymentStatus: 'Pending Payment', delivery: { fee: null } };
for (const [age, label] of [[0, 'Awaiting Delivery Fee'], [179999, 'Awaiting Delivery Fee'], [180000, 'Waiting'], [299999, 'Waiting'], [300000, 'Needs Attention']]) {
  const order = { ...request, createdAt: new Date(now - age).toISOString() };
  assert.equal(helpers.deliveryWaitingState(order, now).label, label);
  assert.equal(load(read('../src/lib/cashier-order-alerts.ts')).deliveryWaitingState(order, now).elapsed, helpers.deliveryWaitingState(order, now).elapsed, 'Reloading never resets server-created waiting time');
}
assert.equal(helpers.deliveryWaitingState({ ...request, createdAt: new Date(now - 84000).toISOString() }, now).elapsed, 'Waiting 1m 24s');
for (const changes of [{ delivery: { fee: 0 } }, { delivery: { fee: 50 } }, { paymentStatus: 'Paid' }, { delivery: null }]) assert.equal(helpers.deliveryWaitingState({ ...request, ...changes }, now), null);
const other = { ...request, id: 4, delivery: { fee: 50 } }, paid = { ...request, id: 3, paymentStatus: 'Paid' };
const old = { ...request, id: 2, createdAt: new Date(now - 400000).toISOString() };
const original = [other, request, paid, old];
assert.deepEqual(Array.from(helpers.prioritizeDeliveryRequests(original), o => o.id), [2, 1, 4, 3]);
assert.deepEqual(original.map(o => o.id), [4, 1, 3, 2], 'Sorting does not mutate source data');
const storageData = new Map();
const storage = { getItem: key => storageData.get(key) || null, setItem: (key, value) => storageData.set(key, value) };
const event = (id, kind = 'delivery', reason = kind === 'delivery' ? 'delivery.requested' : 'order.created') => ({ topic: 'orders.changed', timestamp: 'server time', reason, arrival: { orderId: id, orderNumber: `#${id}`, kind } });
const tracker = helpers.createOnlineArrivalTracker(storage);
assert.equal(tracker.accept(event(1)), null, 'Initial-load events are silent');
tracker.seed([{ id: 1 }, { id: 2 }]);
assert.equal(tracker.accept(event(2)), null);
assert.equal(tracker.accept(event(3, 'pickup')).orderId, 3);
assert.equal(tracker.accept(event(4)).orderId, 4);
for (const duplicate of [event(3, 'pickup'), event(4), event(4)]) assert.equal(tracker.accept(duplicate), null);
for (const reason of ['order.updated', 'delivery.quoted', 'delivery.process', 'delivery.pickup', 'delivery.delivered', 'payment.verified']) assert.equal(tracker.accept(event(99, 'delivery', reason)), null);
assert.equal(tracker.accept({ ...event(99), topic: 'payments.changed' }), null);
const refreshedTracker = helpers.createOnlineArrivalTracker(storage); refreshedTracker.seed([]);
assert.equal(refreshedTracker.accept(event(3, 'pickup')), null, 'A previously notified order stays silent across refresh/reconnect');

let state, cursor, effects, contexts, blocked, messages;
class AudioMock {
  state = 'suspended'; currentTime = 10; destination = {}; tones = 0; volumes = []; stops = [];
  constructor() { contexts.push(this); }
  async resume() { if (blocked) throw new Error('Autoplay blocked'); this.state = 'running'; }
  async close() { this.state = 'closed'; }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime: value => this.volumes.push(value), exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, disconnect() {}, start: () => { this.tones++; }, stop: time => this.stops.push(time) }; }
}
const react = {
  useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = value; }]; },
  useRef: initial => { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i]; },
  useMemo: fn => { const i = cursor++; if (!(i in state)) state[i] = fn(); return state[i]; },
  useCallback: fn => fn, useEffect: effect => effects.push(effect),
};
const hook = load(read('../src/hooks/use-online-order-alerts.ts'), { react, '@/lib/cashier-order-alerts': helpers }, { AudioContext: AudioMock, window: { sessionStorage: storage } });
const toast = (...args) => messages.push(args);
const render = () => { cursor = 0; return hook.useOnlineOrderAlerts(7, toast); };
const reset = () => { state = []; effects = []; contexts = []; messages = []; blocked = false; storageData.clear(); };
reset();
let alerts = render(); alerts.seed([{ id: 1 }]);
alerts.onEvent(event(1)); assert.equal(messages.length, 0); assert.equal(contexts.length, 0);
alerts.onEvent(event(2)); assert.equal(messages.length, 1); assert.equal(contexts.length, 0, 'Visual alert works while muted without creating audio');
await alerts.toggleSound(); alerts = render();
assert.equal(alerts.soundState, 'enabled'); assert.equal(contexts[0].tones, 1, 'Explicit enable click plays a short test tone');
alerts.onEvent(event(3, 'pickup')); alerts.onEvent(event(3, 'pickup'));
assert.equal(contexts[0].tones, 2); assert.match(messages.at(-1)[1], /New Pickup Order #3/);
alerts.onEvent(event(4)); assert.equal(contexts[0].tones, 3); assert.match(messages.at(-1)[1], /New Delivery Request #4/);
alerts.onEvent(event(100, 'delivery', 'delivery.quoted')); assert.equal(contexts[0].tones, 3);
await alerts.toggleSound(); alerts = render(); assert.equal(alerts.soundState, 'muted');
alerts.onEvent(event(5)); assert.equal(contexts[0].tones, 3); assert.match(messages.at(-1)[1], /#5/);
assert.ok(contexts[0].volumes.every(value => value <= 0.07)); assert.ok(contexts[0].stops.every(time => time <= 10.37));
reset(); blocked = true; alerts = render(); alerts.seed([]);
await alerts.toggleSound(); alerts = render(); assert.equal(alerts.soundState, 'blocked');
assert.equal(contexts[0].tones, 0); alerts.onEvent(event(6)); assert.match(messages.at(-1)[1], /New Delivery Request #6/);
assert.equal(contexts[0].tones, 0);
const cashier = read('../src/pages/menu.tsx');
assert.match(cashier, /key=\{`customer-delivery-\$\{o.id\}`\}/, 'Stable card keys preserve expansion and unsaved edits during sorting');
assert.match(cashier, /window.setInterval\(\(\) => setDeliveryNow\(Date.now\(\)\), 1000\)/);
assert.match(read('../src/pages/usersmenu.tsx'), /Checking your delivery fee/);
console.log('Cashier alert checks passed: server timestamp/thresholds, stable oldest-first sorting, silent initial load, Pickup/Delivery arrival dedupe, replay/reconnect safety, mute/unmute, moderate short tone, and autoplay-blocked visual fallback. Audio engine mocked.');
