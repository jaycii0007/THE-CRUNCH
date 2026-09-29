import { AnimatePresence, motion } from "framer-motion";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { CloseBtn } from "../CloseBtn";
import type { POItem, Product, PurchaseOrder, Supplier } from "../../types/inventory";
import { toNumber } from "../../utils/formatters";
import {
  blockInvalidNumberKeys,
  sanitizeNumberInput,
  sanitizeShortTextInput,
} from "../../utils/inputUtils";
import { parseSupplierProducts } from "../../utils/supplierUtils";

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------
const PURCHASE_ORDER_NAME_MAX_LENGTH = 100;
const PURCHASE_ORDER_QUANTITY_MAX = 999;
const MAX_SUGGESTIONS = 6;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// One row in the form. "uid" is a stable key so rows animate and keep focus
// correctly when items are added or removed (an array index would not).
// Quantity is kept as a string while typing and converted to a number on save.
type DraftItem = {
  uid: number;
  name: string;
  category: string;
  unit: string;
  quantity: string;
  nameTouched: boolean;
  quantityTouched: boolean;
};

type ItemErrors = { name?: string; quantity?: string };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Lowercase + trim so "  Flour " and "flour" count as the same product.
const normalize = (value: string) => value.trim().toLowerCase();

// Today's date in the user's LOCAL timezone as YYYY-MM-DD.
// (toISOString() uses UTC, which gives yesterday's date in the early morning
// for users ahead of UTC, such as the Philippines.)
function toLocalISODate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// How many units are needed to get back up to the reorder point (at least 1).
function getSuggestedQuantity(product: Product): number {
  const shortfall = Math.ceil(
    toNumber(product.reorderPoint) - toNumber(product.mainStock),
  );
  return Math.min(PURCHASE_ORDER_QUANTITY_MAX, Math.max(1, shortfall));
}

// Shared input styling. Red border when the field has an error.
const fieldClass = (hasError: boolean) =>
  `w-full min-w-0 border rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 bg-white focus:outline-none focus:ring-2 transition-colors ${
    hasError
      ? "border-red-300 focus:ring-red-100"
      : "border-gray-200 focus:ring-gray-200"
  }`;

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CreatePOModal({
  onClose,
  onCreate,
  quickOrderProducts,
  allProducts,
  allSuppliers,
  prefillProduct,
  onShowToast,
  isMenuFoodProduct,
}: {
  onClose: () => void;
  onCreate: (
    po: Omit<PurchaseOrder, "id">,
    meta: { supplierId: number; itemNames: string[] },
  ) => Promise<void>;
  quickOrderProducts: Product[];
  allProducts: Product[];
  allSuppliers: Supplier[];
  prefillProduct?: {
    name: string;
    category: string;
    unit: string;
    supplier: string;
  } | null;
  onShowToast: (message: string, type: "success" | "error") => void;
  isMenuFoodProduct: (p: Pick<Product, "item_type">) => boolean;
}) {
  // Counter used to give every item row a stable id.
  const nextUid = useRef(1);
  const makeItem = (overrides: Partial<Omit<DraftItem, "uid">> = {}): DraftItem => ({
    uid: nextUid.current++,
    name: "",
    category: "",
    unit: "",
    quantity: "",
    nameTouched: false,
    quantityTouched: false,
    ...overrides,
  });

  // Today (local time). Used as the order date and the earliest delivery date.
  const today = useMemo(() => toLocalISODate(), []);

  // ---- Lookups built from the data passed in by the parent ----------------

  // Find any product by its (case-insensitive) name.
  const productByName = useMemo(() => {
    const map = new Map<string, Product>();
    allProducts.forEach((p) => {
      const key = normalize(p.product_name);
      if (!map.has(key)) map.set(key, p);
    });
    return map;
  }, [allProducts]);

  // Products that can be suggested in the item field (menu food is excluded).
  const orderableProducts = useMemo(
    () => allProducts.filter((p) => !isMenuFoodProduct(p)),
    [allProducts, isMenuFoodProduct],
  );

  // ---- Form state ---------------------------------------------------------
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | "">(() => {
    if (!prefillProduct?.supplier) return "";
    const found = allSuppliers.find(
      (s) => normalize(s.supplier_name) === normalize(prefillProduct.supplier),
    );
    return found?.supplier_id ?? "";
  });
  const [supplierTouched, setSupplierTouched] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>(() => {
    if (prefillProduct) {
      // Use the live inventory record when we can find it, so the
      // suggested quantity matches the current stock level.
      const match = productByName.get(normalize(prefillProduct.name));
      return [
        makeItem({
          name: prefillProduct.name,
          category: match?.category ?? prefillProduct.category,
          unit: match?.unit ?? prefillProduct.unit,
          quantity: match ? String(getSuggestedQuantity(match)) : "",
        }),
      ];
    }
    return [makeItem()];
  });

  // ---- UI state -----------------------------------------------------------
  const [showQuickOrder, setShowQuickOrder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false); // true once the user changes anything
  // Which item's suggestion list is open, and which suggestion is highlighted.
  const [suggestionState, setSuggestionState] = useState<{
    uid: number;
    highlight: number;
  } | null>(null);

  const markDirty = () => setIsDirty(true);

  // ---- Supplier -----------------------------------------------------------
  const selectedSupplier = allSuppliers.find(
    (s) => s.supplier_id === selectedSupplierId,
  );
  const supplierName = selectedSupplier?.supplier_name ?? "";
  const contact = selectedSupplier?.contact_number ?? "";

  const supplierProductNames = useMemo(
    () => parseSupplierProducts(selectedSupplier?.products_supplied),
    [selectedSupplier?.products_supplied],
  );
  const supplierProductNameSet = useMemo(
    () => new Set(supplierProductNames.map((name) => normalize(name))),
    [supplierProductNames],
  );

  // Names already used in the order (used to block duplicates).
  const usedNameSet = useMemo(
    () => new Set(items.map((i) => normalize(i.name)).filter(Boolean)),
    [items],
  );

  // ---- Validation ---------------------------------------------------------
  const itemErrors = useMemo<ItemErrors[]>(() => {
    // Remembers which row first used a product, to report duplicates.
    const firstRowByName = new Map<string, number>();

    return items.map((item, idx) => {
      const errors: ItemErrors = {};
      const key = normalize(item.name);
      const product = productByName.get(key);

      if (!key) {
        errors.name = "Enter an item name.";
      } else if (!product) {
        errors.name = "Pick a product from inventory.";
      } else if (!String(product.unit ?? "").trim()) {
        errors.name = "This product has no unit set in inventory.";
      } else if (firstRowByName.has(key)) {
        errors.name = `Already added as Item ${(firstRowByName.get(key) ?? 0) + 1}.`;
      } else {
        firstRowByName.set(key, idx);
      }

      const quantity = toNumber(item.quantity, Number.NaN);
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > PURCHASE_ORDER_QUANTITY_MAX
      ) {
        errors.quantity = `Enter a whole number from 1 to ${PURCHASE_ORDER_QUANTITY_MAX}.`;
      }

      return errors;
    });
  }, [items, productByName]);

  const supplierError = selectedSupplierId === "" ? "Select a supplier." : "";
  const deliveryDateError = !deliveryDate
    ? "Choose a delivery date."
    : deliveryDate < today
      ? "Delivery date can't be before today."
      : "";

  const isValid =
    !supplierError &&
    !deliveryDateError &&
    itemErrors.every((e) => !e.name && !e.quantity);

  // The first thing blocking the Save button, shown next to it.
  const blockingMessage = useMemo(() => {
    if (supplierError) return supplierError;
    for (let i = 0; i < itemErrors.length; i++) {
      const message = itemErrors[i].name || itemErrors[i].quantity;
      if (message) return `Item ${i + 1}: ${message}`;
    }
    return deliveryDateError;
  }, [supplierError, itemErrors, deliveryDateError]);

  // Totals for the footer summary (only counts valid quantities).
  const totalUnits = items.reduce((sum, item) => {
    const quantity = toNumber(item.quantity);
    return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
  }, 0);

  // ---- Focus handling -----------------------------------------------------
  // Set an element id here and it is focused after the next render.
  const pendingFocusId = useRef<string | null>(null);
  const supplierSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!pendingFocusId.current) return;
    const el = document.getElementById(pendingFocusId.current);
    pendingFocusId.current = null;
    el?.focus();
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [items]);

  // Start on the supplier field when nothing is pre-selected.
  useEffect(() => {
    if (selectedSupplierId === "") supplierSelectRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop the page behind the modal from scrolling while it is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // ---- Closing ------------------------------------------------------------
  // Esc and backdrop clicks ask before throwing away unsaved changes.
  const requestClose = () => {
    if (isSubmitting) return;
    if (isDirty && !window.confirm("Discard this purchase order? Your changes will be lost.")) {
      return;
    }
    onClose();
  };

  // Esc closes the quick-order panel first, then the modal.
  // A ref keeps the listener up to date without re-subscribing every render.
  const escapeHandlerRef = useRef<() => void>(() => {});
  escapeHandlerRef.current = () => {
    if (showQuickOrder) setShowQuickOrder(false);
    else requestClose();
  };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Skip if something else (like the suggestion list) already handled Esc.
      if (e.key === "Escape" && !e.defaultPrevented) escapeHandlerRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ---- Item helpers -------------------------------------------------------
  const updateItem = (uid: number, patch: Partial<DraftItem>) =>
    setItems((prev) =>
      prev.map((item) => (item.uid === uid ? { ...item, ...patch } : item)),
    );

  const removeItem = (uid: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.uid !== uid) : prev));
    markDirty();
  };

  // Add rows to the end of the list. Completely empty rows are dropped first
  // so adding a product doesn't leave a blank row behind.
  const appendItems = (newItems: DraftItem[]) => {
    setItems((prev) => [
      ...prev.filter((i) => i.name.trim() || i.quantity.trim()),
      ...newItems,
    ]);
    markDirty();
  };

  const buildItemFromProduct = (product: Product): DraftItem =>
    makeItem({
      name: product.product_name,
      category: product.category,
      unit: product.unit,
      quantity: String(getSuggestedQuantity(product)),
      nameTouched: true,
      quantityTouched: true,
    });

  const addBlankItem = () => {
    const item = makeItem();
    pendingFocusId.current = `po-item-name-${item.uid}`;
    setItems((prev) => [...prev, item]);
    markDirty();
  };

  // Adds a product unless it is already in the order.
  const addProductItem = (product: Product) => {
    if (usedNameSet.has(normalize(product.product_name))) {
      onShowToast(`${product.product_name} is already in this order.`, "error");
      return;
    }
    appendItems([buildItemFromProduct(product)]);
  };

  // Clicking a supplier product chip.
  const addSupplierProductItem = (productName: string) => {
    const match = productByName.get(normalize(productName));
    if (match) {
      addProductItem(match);
      return;
    }
    if (usedNameSet.has(normalize(productName))) {
      onShowToast(`${productName} is already in this order.`, "error");
      return;
    }
    // Not in inventory: add it so the user sees the error and can fix it.
    appendItems([makeItem({ name: productName, nameTouched: true })]);
  };

  // Products from the quick-order list that are not in the order yet.
  const availableQuickOrder = useMemo(
    () =>
      quickOrderProducts.filter((p) => !usedNameSet.has(normalize(p.product_name))),
    [quickOrderProducts, usedNameSet],
  );

  const addAllQuickOrder = () => {
    if (availableQuickOrder.length === 0) return;
    appendItems(availableQuickOrder.map(buildItemFromProduct));
    setShowQuickOrder(false);
  };

  // ---- Field handlers -----------------------------------------------------
  const handleSupplierChange = (value: string) => {
    setSelectedSupplierId(Number(value) || "");
    markDirty();
  };

  // Typing a name: if it matches an inventory product exactly, the unit and
  // category fill in automatically. Otherwise they are cleared.
  const handleNameChange = (uid: number, rawValue: string) => {
    const name = sanitizeShortTextInput(rawValue, PURCHASE_ORDER_NAME_MAX_LENGTH);
    const match = productByName.get(normalize(name));
    updateItem(uid, {
      name,
      category: match?.category ?? "",
      unit: match?.unit ?? "",
    });
    setSuggestionState({ uid, highlight: 0 });
    markDirty();
  };

  const handleQuantityChange = (uid: number, rawValue: string) => {
    const quantity = String(
      sanitizeNumberInput(rawValue, { allowDecimal: false, maxDigits: 3 }),
    );
    updateItem(uid, { quantity });
    markDirty();
  };

  // Choosing a suggestion fills the row, suggests a quantity if the field is
  // empty, and moves focus to the quantity input.
  const applyProductToItem = (uid: number, product: Product) => {
    pendingFocusId.current = `po-item-qty-${uid}`;
    setItems((prev) =>
      prev.map((item) =>
        item.uid === uid
          ? {
              ...item,
              name: product.product_name,
              category: product.category,
              unit: product.unit,
              quantity: item.quantity.trim()
                ? item.quantity
                : String(getSuggestedQuantity(product)),
              nameTouched: true,
            }
          : item,
      ),
    );
    setSuggestionState(null);
    markDirty();
  };

  // ---- Suggestions for the item currently being edited ---------------------
  const activeItem = suggestionState
    ? items.find((i) => i.uid === suggestionState.uid)
    : undefined;

  const suggestions = useMemo<Product[]>(() => {
    if (!activeItem) return [];

    const query = normalize(activeItem.name);
    // Don't offer products that are already used in another row.
    const usedElsewhere = new Set(
      items
        .filter((i) => i.uid !== activeItem.uid)
        .map((i) => normalize(i.name)),
    );
    const pool = orderableProducts.filter(
      (p) => !usedElsewhere.has(normalize(p.product_name)),
    );

    // Empty field: offer the selected supplier's products.
    if (!query) {
      if (supplierProductNameSet.size === 0) return [];
      return pool
        .filter((p) => supplierProductNameSet.has(normalize(p.product_name)))
        .sort((a, b) => a.product_name.localeCompare(b.product_name))
        .slice(0, MAX_SUGGESTIONS);
    }

    // The name already matches a product exactly: nothing more to suggest.
    if (productByName.has(query)) return [];

    // Typing: match by name, supplier products first.
    return pool
      .filter((p) => normalize(p.product_name).includes(query))
      .sort((a, b) => {
        const aRank = supplierProductNameSet.has(normalize(a.product_name)) ? 0 : 1;
        const bRank = supplierProductNameSet.has(normalize(b.product_name)) ? 0 : 1;
        return aRank - bRank || a.product_name.localeCompare(b.product_name);
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [activeItem, items, orderableProducts, supplierProductNameSet, productByName]);

  // Arrow keys move through suggestions, Enter picks, Esc closes the list.
  const handleNameKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>, uid: number) => {
    if (!suggestionState || suggestionState.uid !== uid || suggestions.length === 0) {
      return;
    }
    const count = suggestions.length;
    const current = Math.min(suggestionState.highlight, count - 1);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSuggestionState({ uid, highlight: (current + 1) % count });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSuggestionState({ uid, highlight: (current - 1 + count) % count });
    } else if (e.key === "Enter") {
      e.preventDefault();
      applyProductToItem(uid, suggestions[current]);
    } else if (e.key === "Escape") {
      e.preventDefault(); // stops the modal-level Esc handler
      setSuggestionState(null);
    }
  };

  // ---- Save ---------------------------------------------------------------
  const handleSubmit = async () => {
    if (isSubmitting) return; // prevents double submits

    // If something is invalid (for example via Ctrl+Enter), reveal every error.
    if (!isValid) {
      setSupplierTouched(true);
      setItems((prev) =>
        prev.map((i) => ({ ...i, nameTouched: true, quantityTouched: true })),
      );
      onShowToast(blockingMessage || "Please fix the highlighted fields.", "error");
      return;
    }

    // Build the items from the inventory record so name, category and unit
    // always match inventory exactly.
    const poItems: POItem[] = items.map((item, idx) => {
      const product = productByName.get(normalize(item.name));
      return {
        id: idx + 1,
        name: product ? product.product_name : item.name.trim(),
        category: product ? product.category : item.category,
        unit: product ? product.unit : item.unit,
        quantity: toNumber(item.quantity),
      };
    });

    setIsSubmitting(true);
    try {
      await onCreate(
        {
          supplier: supplierName,
          contact,
          date: today,
          deliveryDate,
          status: "Draft",
          notes: notes.trim(),
          items: poItems,
        },
        {
          supplierId: Number(selectedSupplierId),
          itemNames: poItems.map((item) => item.name),
        },
      );
      onClose();
    } catch {
      // The parent shows the error toast. Keep the form open and editable.
      setIsSubmitting(false);
    }
  };

  // ---- Render -------------------------------------------------------------
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      // Clicking the dark backdrop (not the dialog) closes the modal.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-po-title"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        // Ctrl/Cmd + Enter saves from anywhere in the form.
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 id="create-po-title" className="text-lg font-semibold text-gray-800">
              New Purchase Order
            </h2>
            {prefillProduct && (
              <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                Pre-filled from stock alert: {prefillProduct.name}
              </p>
            )}
          </div>
          <CloseBtn onClick={onClose} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-5">
          {/* Supplier + delivery date */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_12rem] gap-4">
            <div className="min-w-0">
              <label
                htmlFor="po-supplier"
                className="text-xs text-gray-400 font-medium block mb-1"
              >
                Supplier <span className="text-red-400">*</span>
              </label>
              <select
                id="po-supplier"
                ref={supplierSelectRef}
                value={selectedSupplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                onBlur={() => setSupplierTouched(true)}
                aria-invalid={supplierTouched && !!supplierError}
                className={fieldClass(supplierTouched && !!supplierError)}
              >
                <option value="">- Select a supplier -</option>
                {allSuppliers.map((s) => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.supplier_name}
                  </option>
                ))}
              </select>
              {supplierTouched && supplierError && (
                <p role="alert" className="mt-1 text-[11px] text-red-500">
                  {supplierError}
                </p>
              )}
            </div>

            <div className="min-w-0">
              <label
                htmlFor="po-delivery-date"
                className="text-xs text-gray-400 font-medium block mb-1"
              >
                Expected delivery <span className="text-red-400">*</span>
              </label>
              <input
                id="po-delivery-date"
                type="date"
                min={today}
                value={deliveryDate}
                onChange={(e) => {
                  setDeliveryDate(e.target.value);
                  markDirty();
                }}
                aria-invalid={!!deliveryDateError}
                className={fieldClass(!!deliveryDateError)}
              />
              {deliveryDateError && (
                <p role="alert" className="mt-1 text-[11px] text-red-500">
                  {deliveryDateError}
                </p>
              )}
            </div>
          </div>

          {/* Supplier details + clickable product chips */}
          {selectedSupplier && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                {selectedSupplier.supplier_name}
              </p>
              <p className="text-xs text-slate-500">
                {selectedSupplier.contact_number}
                {selectedSupplier.email && ` \u00B7 ${selectedSupplier.email}`}
              </p>
              {supplierProductNames.length > 0 && (
                <div className="pt-1">
                  <p className="text-[11px] text-slate-400 mb-1.5">
                    Supplies these products. Click one to add it to the order.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {supplierProductNames.map((name) => {
                      const added = usedNameSet.has(normalize(name));
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => addSupplierProductItem(name)}
                          disabled={added}
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 ${
                            added
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700 cursor-default"
                              : "bg-white border-slate-200 text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                          }`}
                        >
                          {added && <CheckIcon />}
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Items ({items.length})
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowQuickOrder((v) => !v)}
                  disabled={quickOrderProducts.length === 0}
                  aria-expanded={showQuickOrder}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <BoltIcon />
                  Quick Order
                </button>
                <button
                  type="button"
                  onClick={addBlankItem}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1 transition-colors"
                >
                  <PlusIcon />
                  Add Item
                </button>
              </div>
            </div>

            {/* Quick order panel: products that need restocking */}
            {showQuickOrder && quickOrderProducts.length > 0 && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
                    Products needing reorder
                  </p>
                  {availableQuickOrder.length > 1 && (
                    <button
                      type="button"
                      onClick={addAllQuickOrder}
                      className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 transition-colors"
                    >
                      Add all ({availableQuickOrder.length})
                    </button>
                  )}
                </div>

                {availableQuickOrder.length === 0 ? (
                  <p className="text-xs text-amber-700/80 px-0.5 py-1">
                    Every product needing reorder is already in this order.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {availableQuickOrder.map((product) => (
                      <button
                        key={product.product_id}
                        type="button"
                        onClick={() => addProductItem(product)}
                        className="w-full text-left rounded-lg bg-white border border-amber-100 hover:border-amber-300 px-3 py-2 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {product.product_name}
                          </span>
                          <span className="text-[11px] font-semibold text-amber-700 whitespace-nowrap">
                            Need{" "}
                            {Math.max(
                              0,
                              toNumber(product.reorderPoint) -
                                toNumber(product.mainStock),
                            )}{" "}
                            {product.unit}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {product.category}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Item rows */}
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {items.map((item, idx) => {
                  const errors = itemErrors[idx] ?? {};
                  const nameError = item.nameTouched ? errors.name : undefined;
                  const quantityError = item.quantityTouched
                    ? errors.quantity
                    : undefined;
                  const isMatched = !!productByName.get(normalize(item.name));
                  const notListedBySupplier =
                    isMatched &&
                    !!selectedSupplier &&
                    supplierProductNames.length > 0 &&
                    !supplierProductNameSet.has(normalize(item.name));
                  const showSuggestions =
                    suggestionState?.uid === item.uid && suggestions.length > 0;
                  const highlight = Math.min(
                    suggestionState?.highlight ?? 0,
                    Math.max(0, suggestions.length - 1),
                  );

                  return (
                    <motion.div
                      key={item.uid}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="rounded-lg border border-slate-100 p-3 min-w-0"
                    >
                      {/* Row header: label + remove button */}
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor={`po-item-name-${item.uid}`}
                          className="block text-[11px] text-gray-400"
                        >
                          Item {idx + 1}
                        </label>
                        <button
                          type="button"
                          onClick={() => removeItem(item.uid)}
                          disabled={items.length === 1}
                          aria-label={`Remove item ${idx + 1}`}
                          title={
                            items.length === 1
                              ? "An order needs at least one item"
                              : "Remove item"
                          }
                          className="text-gray-300 hover:text-red-400 disabled:opacity-20 disabled:hover:text-gray-300 transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      </div>

                      {/* Item name with suggestions */}
                      <div className="relative">
                        <input
                          id={`po-item-name-${item.uid}`}
                          value={item.name}
                          onChange={(e) => handleNameChange(item.uid, e.target.value)}
                          onKeyDown={(e) => handleNameKeyDown(e, item.uid)}
                          onFocus={() =>
                            setSuggestionState({ uid: item.uid, highlight: 0 })
                          }
                          onBlur={() => {
                            updateItem(item.uid, { nameTouched: true });
                            setSuggestionState((current) =>
                              current?.uid === item.uid ? null : current,
                            );
                          }}
                          maxLength={PURCHASE_ORDER_NAME_MAX_LENGTH}
                          placeholder="Search or type an item name"
                          autoComplete="off"
                          role="combobox"
                          aria-expanded={showSuggestions}
                          aria-autocomplete="list"
                          aria-controls={`po-item-suggestions-${item.uid}`}
                          aria-invalid={!!nameError}
                          className={fieldClass(!!nameError)}
                        />
                        {showSuggestions && (
                          <div
                            id={`po-item-suggestions-${item.uid}`}
                            role="listbox"
                            className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-slate-200 bg-white shadow-lg z-20 overflow-hidden"
                          >
                            {suggestions.map((product, sIdx) => (
                              <button
                                key={product.product_id}
                                type="button"
                                role="option"
                                aria-selected={sIdx === highlight}
                                // Keeps the input focused so the click registers.
                                onMouseDown={(e) => e.preventDefault()}
                                onMouseEnter={() =>
                                  setSuggestionState({
                                    uid: item.uid,
                                    highlight: sIdx,
                                  })
                                }
                                onClick={() => applyProductToItem(item.uid, product)}
                                className={`w-full px-3 py-2 text-left text-xs text-slate-600 transition-colors ${
                                  sIdx === highlight ? "bg-slate-100" : "hover:bg-slate-50"
                                }`}
                              >
                                <span className="block font-medium text-slate-700">
                                  {product.product_name}
                                </span>
                                <span className="block text-[11px] text-slate-400">
                                  {product.category}
                                  {product.unit ? ` \u00B7 ${product.unit}` : ""}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {nameError && (
                        <p role="alert" className="mt-1 text-[11px] text-red-500">
                          {nameError}
                        </p>
                      )}
                      {!nameError && isMatched && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          {item.category}
                          {notListedBySupplier && (
                            <span className="ml-2 text-amber-600">
                              Not on this supplier&apos;s product list
                            </span>
                          )}
                        </p>
                      )}

                      {/* Qty first, then Unit */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="min-w-0">
                          <label
                            htmlFor={`po-item-qty-${item.uid}`}
                            className="block text-[11px] text-gray-400 mb-1"
                          >
                            Qty
                          </label>
                          <input
                            id={`po-item-qty-${item.uid}`}
                            type="text"
                            inputMode="numeric"
                            value={item.quantity}
                            onChange={(e) =>
                              handleQuantityChange(item.uid, e.target.value)
                            }
                            onKeyDown={(e) =>
                              blockInvalidNumberKeys(e, { allowDecimal: false })
                            }
                            onBlur={() =>
                              updateItem(item.uid, { quantityTouched: true })
                            }
                            placeholder="0"
                            aria-invalid={!!quantityError}
                            className={fieldClass(!!quantityError)}
                          />
                        </div>
                        <div className="min-w-0">
                          <label
                            htmlFor={`po-item-unit-${item.uid}`}
                            className="block text-[11px] text-gray-400 mb-1"
                          >
                            Unit
                          </label>
                          {/* Read-only: the unit always comes from the inventory product */}
                          <input
                            id={`po-item-unit-${item.uid}`}
                            type="text"
                            value={item.unit}
                            readOnly
                            tabIndex={-1}
                            placeholder="Auto from material"
                            className="w-full min-w-0 border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50 text-slate-500 placeholder-gray-300 cursor-not-allowed focus:outline-none"
                          />
                        </div>
                      </div>
                      {quantityError && (
                        <p role="alert" className="mt-1 text-[11px] text-red-500">
                          {quantityError}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="po-notes"
              className="text-xs text-gray-400 font-medium block mb-1"
            >
              Notes (optional)
            </label>
            <textarea
              id="po-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                markDirty();
              }}
              placeholder="Special instructions for supplier..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-200 placeholder-gray-300 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100">
          <div className="flex items-center justify-between gap-3 mb-3 text-xs">
            <span className="text-slate-500">
              {items.length} item{items.length !== 1 ? "s" : ""} {"\u00B7"}{" "}
              {totalUnits} unit{totalUnits !== 1 ? "s" : ""} total
            </span>
            {!isValid && blockingMessage && (
              <span className="text-amber-600 text-right truncate">
                {blockingMessage}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="flex-1 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900"
            >
              {isSubmitting ? (
                <>
                  <Spinner />
                  Saving...
                </>
              ) : (
                "Save as Draft"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}