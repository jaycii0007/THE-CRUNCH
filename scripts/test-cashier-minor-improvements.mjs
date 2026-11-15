import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/pages/menu.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("menu.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = file.statements.filter((node) => ts.isFunctionDeclaration(node) && ["CartIncludedChoices", "AmountModal"].includes(node.name?.text));
assert.equal(functions.length, 2);
let state = [], cursor = 0;
const context = vm.createContext({
  React: { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }), Fragment: "fragment" },
  useState: (initial) => {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], (value) => { state[index] = value; }];
  },
  useEffect: () => {}, useMemo: (fn) => fn(), useRef: () => ({ current: null }),
  useFmt: () => ({ money: (value) => value.toFixed(2), s: {} }),
  getCurrencySymbol: () => "₱", MAX_CASH_TENDERED: 100000,
  Modal: "Modal", Delete: "Delete", eyebrow: "", B: { dark: "", ghost: "" },
});
vm.runInContext(ts.transpileModule(functions.map((node) => node.getText(file)).join("\n"), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const flatten = (node) => Array.isArray(node) ? node.flatMap(flatten) :
  node && typeof node === "object" ? [node, ...node.children.flatMap(flatten)] : [node];
const text = (node) => flatten(node).filter((value) => typeof value === "string" || typeof value === "number").join("");

const labels = context.CartIncludedChoices({ item: {
  includedSelections: [{ kind: "category:1", product_id: 1, name: "Coke solo", qty: 1 }, { kind: "sauces", product_id: 2, name: "Flavor", qty: 1 }],
  selectedFlavorProductId: 2, customizations: { "category:1": { label: "Drinks" } },
} });
assert.equal(text(labels), "Coke solo × 1");
assert.equal(flatten(labels).find((node) => node?.type === "span").props.title, "Drinks");

for (const amountDue of [0, 99.95, 150, 1234.56, 100000]) {
  state = []; cursor = 0;
  let confirmed;
  const props = { show: true, method: "cash", amountDue, onConfirm: (value) => { confirmed = value; } };
  const render = () => { cursor = 0; return context.AmountModal(props); };
  const exact = flatten(render()).find((node) => node?.type === "button" && text(node) === "Exact Amount");
  exact.props.onClick();
  const tree = flatten(render());
  assert.equal(tree.find((node) => node?.type === "input").props.value, amountDue.toFixed(2));
  assert.ok(tree.some((node) => node?.type === "div" && text(node) === "Change0.00"));
  assert.equal(confirmed, undefined, "exact amount must not submit payment");
  const confirm = tree.find((node) => node?.type === "button" && text(node) === "Confirm payment");
  assert.equal(confirm.props.disabled, false);
  confirm.props.onClick();
  assert.equal(confirmed.tendered, amountDue);
}

for (const [label, list, color] of [["Awaiting cashier review", "review", "amber"], ["Ready for pickup", "ready", "green"]]) {
  const section = source.match(new RegExp(`<section aria-label="${label}"[\\s\\S]*?</section>`))?.[0];
  assert.ok(section);
  assert.ok(section.includes(`${list}.map`));
  assert.ok(section.includes(`border-${color}`));
}
assert.match(source, /onRemove=\{setRemoveCartKey\}/);
assert.match(source, /message="Remove this item from your cart\?"/);
assert.match(source, /if \(removeCartKey !== null\) removeFromCart\(removeCartKey\);/);
assert.match(source, /onCancel=\{\(\) => setRemoveCartKey\(null\)\}/);
assert.match(source, /onQty=\{updateQty\}/);
const decrement = source.match(/onClick=\{\(\) => (item.quantity === 1 \? onRemove\(item.cartKey\) : onQty\(item.cartKey, -1\))\}/)?.[1];
assert.ok(decrement);
for (const quantity of [1, 2, 3]) {
  const calls = [];
  vm.runInNewContext(decrement, {
    item: { quantity, cartKey: "meal" },
    onRemove: (key) => calls.push(["confirm", key]),
    onQty: (key, delta) => calls.push(["quantity", key, delta]),
  });
  assert.deepEqual(calls, quantity === 1 ? [["confirm", "meal"]] : [["quantity", "meal", -1]]);
}
console.log("Cashier grouping, cart labels, removal confirmation, and exact amount checks passed");
