import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const modal = read(
  "src/pages/stockmanager/components/purchase-orders/CreatePOModal.tsx",
);
const purchaseOrdersHook = read(
  "src/pages/stockmanager/hooks/usePurchaseOrders.ts",
);
const purchaseOrdersTab = read(
  "src/pages/stockmanager/components/tabs/PurchaseOrdersTab.tsx",
);
const detailDrawer = read(
  "src/pages/stockmanager/components/purchase-orders/PODetailDrawer.tsx",
);
const receiveModal = read(
  "src/pages/stockmanager/components/purchase-orders/ReceivePOModal.tsx",
);
const apiSource = read("src/pages/stockmanager/services/api.ts");
const printModal = read(
  "src/pages/stockmanager/components/purchase-orders/POPrintModal.tsx",
);
const historyTab = read(
  "src/pages/stockmanager/components/tabs/PurchaseHistoryTab.tsx",
);

assert.match(modal, /const \[step, setStep\] = useState<1 \| 2 \| 3>/);
assert.match(modal, /const steps = \["Supplier", "Materials", "Review"\]/);
assert.match(modal, /type="search"[\s\S]*?placeholder="Search suppliers"/);
assert.match(modal, /placeholder="Search inventory"/);
assert.match(modal, /\+ Add another/);
assert.match(modal, /Already added as Material/);
assert.match(modal, /Enter a whole number from 1 to/);
assert.match(modal, /onClick=\{\(\) => setStep\(\(step - 1\) as 1 \| 2\)\}/);
assert.match(modal, /New to supplier/);
assert.match(modal, /will be added to this supplier automatically after the PO is successfully created/);
assert.match(modal, /Stock is not changed when this PO is created/);
assert.doesNotMatch(modal, /Unit price \(PHP\)/i);
assert.doesNotMatch(modal, /Expected delivery/i);
assert.doesNotMatch(modal, /type="date"/i);
assert.doesNotMatch(modal, /Estimated total|Line total/i);
assert.doesNotMatch(modal, /totalCost/);
assert.match(
  modal,
  /deliveryDate: initialOrder\?\.deliveryDate/,
  "editing must preserve a legacy draft's real delivery date without inventing one",
);
assert.equal(
  Object.hasOwn(JSON.parse(JSON.stringify({ deliveryDate: undefined })), "deliveryDate"),
  false,
  "new PO JSON must omit an undefined expected delivery date",
);
assert.match(
  modal,
  /item\.unitCost == null \? \{\} : \{ unitCost: item\.unitCost \}/,
  "editing must preserve legacy unit cost values even though the field is hidden",
);
assert.match(modal, /if \(isSubmitting\) return/);
assert.match(modal, /disabled=\{!isValid \|\| isSubmitting\}/);
assert.match(modal, /Discard this purchase order\?/);
assert.match(modal, /onAddSupplier/);
assert.match(modal, /onAddMaterial/);

assert.match(purchaseOrdersHook, /api\.mergeSupplierProducts\(/);
assert.match(purchaseOrdersHook, /mergeSupplierProducts\(/);
assert.match(
  purchaseOrdersHook,
  /Purchase order created\. Open it from Active Purchase Orders when it is ready to receive/,
);
assert.match(purchaseOrdersHook, /setPoOrders\(\(prev\) => \[created, \.\.\.prev\]\)/);
assert.match(purchaseOrdersHook, /api\.po\.markReceived\(/);
assert.match(detailDrawer, /Receive/);
assert.match(receiveModal, /Actual Receipt Date/);
assert.match(receiveModal, /type="date"/);
assert.match(receiveModal, /max=\{today\}/);
assert.match(receiveModal, /receivedDate,/);
assert.match(apiSource, /receiptNo,[\s\S]*receivedBy,[\s\S]*receivedDate,/);
assert.doesNotMatch(
  apiSource,
  /receivedDate:\s*new Date\(\)\.toISOString\(\)/,
);
assert.match(detailDrawer, /Actual Receipt Date/);
assert.match(printModal, /Actual Receipt Date/);
assert.match(historyTab, /Actual receipt/);
assert.doesNotMatch(purchaseOrdersTab, /Quick Order \{"\\u2014"\} All Products/);
assert.match(purchaseOrdersTab, /Active Purchase Orders/);

console.log("Guided purchase-order wizard regression checks passed");
