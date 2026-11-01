import { motion } from "framer-motion";
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

const NAME_MAX_LENGTH = 100;
const QUANTITY_MAX = 999;
const MAX_SUGGESTIONS = 7;
let nextDraftItemUid = 1;

type DraftItem = {
  uid: number;
  productId: number | null;
  name: string;
  category: string;
  unit: string;
  quantity: string;
  // Retained only to avoid erasing a legacy draft's stored price when edited.
  // New wizard rows omit it and the backend keeps its existing zero default.
  unitCost?: number | null;
  nameTouched: boolean;
  quantityTouched: boolean;
};

type ItemErrors = { name?: string; quantity?: string };

const normalize = (value: string) => value.trim().toLowerCase();

function toLocalISODate(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function suggestedQuantity(product: Product) {
  const shortfall = Math.ceil(toNumber(product.reorderPoint) - toNumber(product.mainStock));
  return Math.min(QUANTITY_MAX, Math.max(1, shortfall));
}

const fieldClass = (invalid = false) =>
  `w-full min-w-0 rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-2 ${
    invalid
      ? "border-red-300 focus:ring-red-100"
      : "border-slate-200 focus:border-slate-400 focus:ring-slate-100"
  }`;

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function CreatePOModal({
  onClose,
  onCreate,
  quickOrderProducts,
  allProducts,
  allSuppliers,
  prefillProduct,
  initialOrder,
  onShowToast,
  isMenuFoodProduct,
  onAddSupplier,
  onAddMaterial,
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
    productId: number;
    name: string;
    category: string;
    unit: string;
    supplier: string;
  } | null;
  initialOrder?: PurchaseOrder | null;
  onShowToast: (message: string, type: "success" | "error") => void;
  isMenuFoodProduct: (product: Pick<Product, "item_type">) => boolean;
  onAddSupplier: () => void;
  onAddMaterial: () => void;
}) {
  const makeItem = (overrides: Partial<Omit<DraftItem, "uid">> = {}): DraftItem => ({
    uid: nextDraftItemUid++,
    productId: null,
    name: "",
    category: "",
    unit: "",
    quantity: "",
    unitCost: null,
    nameTouched: false,
    quantityTouched: false,
    ...overrides,
  });

  const today = useMemo(() => toLocalISODate(), []);
  const productById = useMemo(
    () => new Map(allProducts.map((product) => [product.product_id, product])),
    [allProducts],
  );
  const productByName = useMemo(() => {
    const result = new Map<string, Product>();
    const duplicates = new Set<string>();
    allProducts.forEach((product) => {
      const key = normalize(product.product_name);
      if (result.has(key)) {
        result.delete(key);
        duplicates.add(key);
      } else if (!duplicates.has(key)) {
        result.set(key, product);
      }
    });
    return result;
  }, [allProducts]);
  const orderableProducts = useMemo(
    () => allProducts.filter((product) => !isMenuFoodProduct(product)),
    [allProducts, isMenuFoodProduct],
  );

  const initialSupplierId = useMemo(() => {
    const name = initialOrder?.supplier || prefillProduct?.supplier;
    if (!name) return "";
    return (
      allSuppliers.find((supplier) => normalize(supplier.supplier_name) === normalize(name))
        ?.supplier_id ?? ""
    );
  }, [allSuppliers, initialOrder?.supplier, prefillProduct?.supplier]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | "">(initialSupplierId);
  const initialSupplier = allSuppliers.find((supplier) => supplier.supplier_id === initialSupplierId);
  const [supplierSearch, setSupplierSearch] = useState(initialSupplier?.supplier_name ?? "");
  const [supplierTouched, setSupplierTouched] = useState(false);
  const [notes, setNotes] = useState(initialOrder?.notes || "");
  const [showRestockSuggestions, setShowRestockSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [suggestionState, setSuggestionState] = useState<{
    uid: number;
    highlight: number;
  } | null>(null);
  const supplierSearchRef = useRef<HTMLInputElement>(null);
  const pendingFocusId = useRef<string | null>(null);

  const [items, setItems] = useState<DraftItem[]>(() => {
    if (initialOrder) {
      return initialOrder.items.map((item) =>
        makeItem({
          productId: item.productId ?? null,
          name: item.name,
          category: item.category,
          unit: item.unit,
          quantity: String(item.quantity),
          unitCost: item.unitCost,
          nameTouched: true,
          quantityTouched: true,
        }),
      );
    }
    if (prefillProduct) {
      const product =
        productById.get(prefillProduct.productId) ??
        productByName.get(normalize(prefillProduct.name));
      return [
        makeItem({
          productId: product?.product_id ?? prefillProduct.productId,
          name: product?.product_name ?? prefillProduct.name,
          category: product?.category ?? prefillProduct.category,
          unit: product?.unit ?? prefillProduct.unit,
          quantity: product ? String(suggestedQuantity(product)) : "",
        }),
      ];
    }
    return [makeItem()];
  });

  const selectedSupplier = allSuppliers.find(
    (supplier) => supplier.supplier_id === selectedSupplierId,
  );
  const supplierName = selectedSupplier?.supplier_name ?? "";
  const supplierProducts = useMemo(
    () => parseSupplierProducts(selectedSupplier?.products_supplied),
    [selectedSupplier?.products_supplied],
  );
  const supplierProductSet = useMemo(
    () => new Set(supplierProducts.map(normalize)),
    [supplierProducts],
  );
  const usedProductNames = useMemo(
    () => new Set(items.map((item) => normalize(item.name)).filter(Boolean)),
    [items],
  );
  const filteredSuppliers = useMemo(() => {
    const query = normalize(supplierSearch);
    if (!query) return allSuppliers;
    return allSuppliers.filter((supplier) =>
      [supplier.supplier_name, supplier.contact_number, supplier.email]
        .filter(Boolean)
        .some((value) => normalize(String(value)).includes(query)),
    );
  }, [allSuppliers, supplierSearch]);

  const itemErrors = useMemo<ItemErrors[]>(() => {
    const firstRowByName = new Map<string, number>();
    return items.map((item, index) => {
      const errors: ItemErrors = {};
      const key = normalize(item.name);
      const product =
        (item.productId ? productById.get(item.productId) : undefined) ??
        productByName.get(key);
      if (!key) errors.name = "Select an inventory material.";
      else if (!product) errors.name = "Pick a material from inventory.";
      else if (!String(product.unit ?? "").trim()) errors.name = "This material has no inventory unit.";
      else if (firstRowByName.has(key)) {
        errors.name = `Already added as Material ${(firstRowByName.get(key) ?? 0) + 1}.`;
      } else firstRowByName.set(key, index);

      const quantity = toNumber(item.quantity, Number.NaN);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > QUANTITY_MAX) {
        errors.quantity = `Enter a whole number from 1 to ${QUANTITY_MAX}.`;
      }
      return errors;
    });
  }, [items, productById, productByName]);

  const supplierError = selectedSupplierId === "" ? "Select a supplier to continue." : "";
  const itemsAreValid = itemErrors.every(
    (error) => !error.name && !error.quantity,
  );
  const isValid = !supplierError && itemsAreValid;
  const totalUnits = items.reduce((sum, item) => sum + Math.max(0, toNumber(item.quantity)), 0);
  const blockingMessage = useMemo(() => {
    if (supplierError) return supplierError;
    const invalidIndex = itemErrors.findIndex((error) => Object.keys(error).length > 0);
    if (invalidIndex >= 0) {
      const error = itemErrors[invalidIndex];
      return `Material ${invalidIndex + 1}: ${error.name || error.quantity}`;
    }
    return "";
  }, [itemErrors, supplierError]);

  const activeItem = suggestionState
    ? items.find((item) => item.uid === suggestionState.uid)
    : undefined;
  const suggestions = useMemo(() => {
    if (!activeItem) return [];
    const query = normalize(activeItem.name);
    const usedElsewhere = new Set(
      items
        .filter((item) => item.uid !== activeItem.uid)
        .map((item) => normalize(item.name)),
    );
    const available = orderableProducts.filter(
      (product) => !usedElsewhere.has(normalize(product.product_name)),
    );
    if (!query) {
      const preferred = available.filter((product) =>
        supplierProductSet.has(normalize(product.product_name)),
      );
      return (preferred.length > 0 ? preferred : available).slice(0, MAX_SUGGESTIONS);
    }
    if (productByName.has(query)) return [];
    return available
      .filter((product) => normalize(product.product_name).includes(query))
      .sort((left, right) => {
        const leftRank = supplierProductSet.has(normalize(left.product_name)) ? 0 : 1;
        const rightRank = supplierProductSet.has(normalize(right.product_name)) ? 0 : 1;
        return leftRank - rightRank || left.product_name.localeCompare(right.product_name);
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [activeItem, items, orderableProducts, productByName, supplierProductSet]);
  const availableRestockProducts = useMemo(
    () =>
      quickOrderProducts.filter(
        (product) => !usedProductNames.has(normalize(product.product_name)),
      ),
    [quickOrderProducts, usedProductNames],
  );

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    supplierSearchRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!pendingFocusId.current) return;
    const element = document.getElementById(pendingFocusId.current);
    pendingFocusId.current = null;
    element?.focus();
    element?.scrollIntoView({ block: "nearest" });
  }, [items]);

  const requestClose = () => {
    if (isSubmitting) return;
    if (isDirty && !window.confirm("Discard this purchase order? Your changes will be lost.")) return;
    onClose();
  };

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) requestClose();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  });

  const updateItem = (uid: number, patch: Partial<DraftItem>) => {
    setItems((current) =>
      current.map((item) => (item.uid === uid ? { ...item, ...patch } : item)),
    );
  };

  const buildItem = (product: Product) =>
    makeItem({
      productId: product.product_id,
      name: product.product_name,
      category: product.category,
      unit: product.unit,
      quantity: String(suggestedQuantity(product)),
      nameTouched: true,
      quantityTouched: true,
    });

  const addProduct = (product: Product) => {
    if (usedProductNames.has(normalize(product.product_name))) {
      onShowToast(`${product.product_name} is already in this order.`, "error");
      return;
    }
    setItems((current) => [
      ...current.filter((item) => item.name.trim() || item.quantity.trim()),
      buildItem(product),
    ]);
    setIsDirty(true);
  };

  const addSupplierProduct = (name: string) => {
    const product = productByName.get(normalize(name));
    if (product) addProduct(product);
    else onShowToast(`${name} is not yet configured in Inventory Management.`, "error");
  };

  const addBlankItem = () => {
    const item = makeItem();
    pendingFocusId.current = `po-item-name-${item.uid}`;
    setItems((current) => [...current, item]);
    setIsDirty(true);
  };

  const addAllRestockProducts = () => {
    setItems((current) => {
      const existingNames = new Set(
        current.map((item) => normalize(item.name)).filter(Boolean),
      );
      const additions = availableRestockProducts.filter((product) => {
        const name = normalize(product.product_name);
        if (existingNames.has(name)) return false;
        existingNames.add(name);
        return true;
      });
      return [
        ...current.filter((item) => item.name.trim() || item.quantity.trim()),
        ...additions.map(buildItem),
      ];
    });
    setShowRestockSuggestions(false);
    setIsDirty(true);
  };

  const selectProduct = (uid: number, product: Product) => {
    pendingFocusId.current = `po-item-qty-${uid}`;
    setItems((current) =>
      current.map((item) =>
        item.uid === uid
          ? {
              ...item,
              productId: product.product_id,
              name: product.product_name,
              category: product.category,
              unit: product.unit,
              unitCost:
                item.productId === product.product_id ? item.unitCost : null,
              quantity: item.quantity.trim()
                ? item.quantity
                : String(suggestedQuantity(product)),
              nameTouched: true,
            }
          : item,
      ),
    );
    setSuggestionState(null);
    setIsDirty(true);
  };

  const handleNameKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
    uid: number,
  ) => {
    if (!suggestionState || suggestionState.uid !== uid || suggestions.length === 0) return;
    const current = Math.min(suggestionState.highlight, suggestions.length - 1);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setSuggestionState({
        uid,
        highlight: (current + direction + suggestions.length) % suggestions.length,
      });
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectProduct(uid, suggestions[current]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setSuggestionState(null);
    }
  };

  const goToMaterials = () => {
    if (supplierError) {
      setSupplierTouched(true);
      supplierSearchRef.current?.focus();
      return;
    }
    setStep(2);
  };

  const goToReview = () => {
    if (!itemsAreValid) {
      setItems((current) =>
        current.map((item) => ({ ...item, nameTouched: true, quantityTouched: true })),
      );
      onShowToast(blockingMessage || "Please fix the highlighted fields.", "error");
      return;
    }
    setStep(3);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!isValid) {
      onShowToast(blockingMessage || "Please fix the highlighted fields.", "error");
      return;
    }
    const poItems: POItem[] = items.map((item, index) => {
      const product =
        (item.productId ? productById.get(item.productId) : undefined) ??
        productByName.get(normalize(item.name));
      return {
        id: index + 1,
        productId: product?.product_id ?? item.productId,
        name: product?.product_name ?? item.name.trim(),
        category: product?.category ?? item.category,
        unit: product?.unit ?? item.unit,
        quantity: toNumber(item.quantity),
        ...(item.unitCost == null ? {} : { unitCost: item.unitCost }),
      };
    });
    setIsSubmitting(true);
    try {
      await onCreate(
        {
          supplier: supplierName,
          contact: selectedSupplier?.contact_number ?? "",
          date: initialOrder?.date || today,
          // Preserve a legacy draft's real date, but do not invent one for new POs.
          deliveryDate: initialOrder?.deliveryDate,
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
      setIsSubmitting(false);
    }
  };

  const openSetupPage = (kind: "supplier" | "material") => {
    if (isDirty && !window.confirm(`Leave this purchase order to add a ${kind}? Your draft will be discarded.`)) return;
    if (kind === "supplier") onAddSupplier();
    else onAddMaterial();
  };

  const steps = ["Supplier", "Materials", "Review"] as const;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-po-title"
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            if (step === 1) goToMaterials();
            else if (step === 2) goToReview();
            else void handleSubmit();
          }
        }}
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="border-b border-slate-100 px-5 py-4 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="create-po-title" className="text-lg font-semibold text-slate-900">
                {initialOrder ? `Edit ${initialOrder.id}` : "New Purchase Order"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Step {step} of 3: {steps[step - 1]}</p>
            </div>
            <CloseBtn onClick={requestClose} />
          </div>
          <ol aria-label="Purchase order progress" className="mt-4 grid grid-cols-3 gap-2">
            {steps.map((label, index) => {
              const number = index + 1;
              const current = number === step;
              return (
                <li key={label} aria-current={current ? "step" : undefined}>
                  <div className={`h-1.5 rounded-full ${number <= step ? "bg-slate-900" : "bg-slate-200"}`} />
                  <div className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${current ? "text-slate-900" : "text-slate-400"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${number <= step ? "bg-slate-900 text-white" : "bg-slate-100"}`}>
                      {number < step ? <CheckIcon /> : number}
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 sm:px-7">
          {step === 1 && (
            <section aria-labelledby="supplier-step-title" className="mx-auto max-w-2xl">
              <h3 id="supplier-step-title" className="text-base font-semibold text-slate-900">Choose a supplier</h3>
              <p className="mt-1 text-sm text-slate-500">Search by company name, contact number, or email.</p>
              <label htmlFor="po-supplier-search" className="mt-5 block text-xs font-medium text-slate-600">
                Supplier <span className="text-red-500">*</span>
              </label>
              <input
                id="po-supplier-search"
                ref={supplierSearchRef}
                type="search"
                value={supplierSearch}
                onChange={(event) => {
                  setSupplierSearch(event.target.value);
                  if (selectedSupplier && event.target.value !== selectedSupplier.supplier_name) {
                    setSelectedSupplierId("");
                  }
                  setIsDirty(true);
                }}
                onBlur={() => setSupplierTouched(true)}
                placeholder="Search suppliers"
                autoComplete="off"
                aria-invalid={supplierTouched && !!supplierError}
                className={`mt-1 ${fieldClass(supplierTouched && !!supplierError)}`}
              />
              {supplierTouched && supplierError && <p role="alert" className="mt-1 text-xs text-red-500">{supplierError}</p>}

              <div role="listbox" aria-label="Suppliers" className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                {filteredSuppliers.map((supplier) => {
                  const selected = supplier.supplier_id === selectedSupplierId;
                  return (
                    <button
                      key={supplier.supplier_id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setSelectedSupplierId(supplier.supplier_id);
                        setSupplierSearch(supplier.supplier_name);
                        setSupplierTouched(true);
                        setIsDirty(true);
                      }}
                      className={`w-full rounded-xl border p-4 text-left transition ${selected ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900" : "border-slate-200 hover:border-slate-400"}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">{supplier.supplier_name}</span>
                          <span className="mt-1 block text-xs text-slate-500">{supplier.contact_number || "No phone number"}{supplier.email ? ` · ${supplier.email}` : ""}</span>
                        </span>
                        {selected && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">Selected</span>}
                      </span>
                    </button>
                  );
                })}
                {filteredSuppliers.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                    <p className="text-sm text-slate-600">No matching supplier found.</p>
                    <button type="button" onClick={() => openSetupPage("supplier")} className="mt-3 text-sm font-semibold text-slate-900 underline underline-offset-4">Add a new supplier</button>
                  </div>
                )}
              </div>
              {allSuppliers.length > 0 && <button type="button" onClick={() => openSetupPage("supplier")} className="mt-4 text-xs font-semibold text-slate-600 hover:text-slate-900">Supplier not listed? Add Supplier</button>}
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="materials-step-title" className="space-y-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h3 id="materials-step-title" className="text-base font-semibold text-slate-900">Add materials and quantities</h3>
                  <p className="mt-1 text-sm text-slate-500">Search existing inventory materials. Units come from Inventory Management.</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-right"><p className="text-xs text-slate-400">Supplier</p><p className="text-sm font-semibold text-slate-800">{supplierName}</p></div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Materials marked <span className="font-semibold text-amber-700">New to supplier</span> will be added to this supplier automatically after the PO is successfully created.
              </div>

              {supplierProducts.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">Common materials from {supplierName}</p>
                  <div className="flex flex-wrap gap-2">
                    {supplierProducts.map((name) => {
                      const added = usedProductNames.has(normalize(name));
                      return <button key={name} type="button" disabled={added} onClick={() => addSupplierProduct(name)} className={`rounded-full border px-3 py-1 text-xs font-medium ${added ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 hover:border-slate-400"}`}>{added ? "✓ " : "+ "}{name}</button>;
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Materials ({items.length})</p>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => setShowRestockSuggestions((value) => !value)} disabled={quickOrderProducts.length === 0} aria-expanded={showRestockSuggestions} className="text-xs font-semibold text-amber-700 disabled:opacity-40">Restock suggestions</button>
                  <button type="button" onClick={addBlankItem} className="text-xs font-semibold text-slate-700">+ Add another</button>
                  <button type="button" onClick={() => openSetupPage("material")} className="text-xs font-semibold text-slate-500 hover:text-slate-900">Add new material</button>
                </div>
              </div>

              {showRestockSuggestions && quickOrderProducts.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-amber-800">Low-stock restock suggestions</p>{availableRestockProducts.length > 1 && <button type="button" onClick={addAllRestockProducts} className="text-xs font-semibold text-amber-800">Add all ({availableRestockProducts.length})</button>}</div>
                  <div className="flex flex-wrap gap-2">
                    {availableRestockProducts.map((product) => <button key={product.product_id} type="button" onClick={() => addProduct(product)} className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">+ {product.product_name} ({product.unit})</button>)}
                    {availableRestockProducts.length === 0 && <p className="text-xs text-amber-700">All suggested materials are already included.</p>}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {items.map((item, index) => {
                  const errors = itemErrors[index] ?? {};
                  const nameError = item.nameTouched ? errors.name : undefined;
                  const quantityError = item.quantityTouched ? errors.quantity : undefined;
                  const matched = !!((item.productId && productById.get(item.productId)) || productByName.get(normalize(item.name)));
                  const newAssociation = matched && !supplierProductSet.has(normalize(item.name));
                  const showSuggestions = suggestionState?.uid === item.uid && suggestions.length > 0;
                  const highlight = Math.min(suggestionState?.highlight ?? 0, Math.max(0, suggestions.length - 1));
                  return (
                    <div key={item.uid} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">Material {index + 1}</p><button type="button" onClick={() => { if (items.length > 1) { setItems((current) => current.filter((entry) => entry.uid !== item.uid)); setIsDirty(true); } }} disabled={items.length === 1} aria-label={`Remove material ${index + 1}`} className="text-xs font-semibold text-slate-400 hover:text-red-500 disabled:opacity-30">Remove</button></div>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(16rem,1fr)_8rem_9rem]">
                        <div className="relative">
                          <label htmlFor={`po-item-name-${item.uid}`} className="mb-1 block text-[11px] text-slate-500">Inventory material</label>
                          <input id={`po-item-name-${item.uid}`} value={item.name} onChange={(event) => { const name = sanitizeShortTextInput(event.target.value, NAME_MAX_LENGTH); const product = productByName.get(normalize(name)); updateItem(item.uid, { name, productId: product?.product_id ?? null, category: product?.category ?? "", unit: product?.unit ?? "", unitCost: product?.product_id === item.productId ? item.unitCost : null }); setSuggestionState({ uid: item.uid, highlight: 0 }); setIsDirty(true); }} onKeyDown={(event) => handleNameKeyDown(event, item.uid)} onFocus={() => setSuggestionState({ uid: item.uid, highlight: 0 })} onBlur={() => { updateItem(item.uid, { nameTouched: true }); setSuggestionState((current) => current?.uid === item.uid ? null : current); }} maxLength={NAME_MAX_LENGTH} placeholder="Search inventory" autoComplete="off" role="combobox" aria-expanded={showSuggestions} aria-autocomplete="list" aria-controls={`po-item-suggestions-${item.uid}`} aria-invalid={!!nameError} className={fieldClass(!!nameError)} />
                          {showSuggestions && <div id={`po-item-suggestions-${item.uid}`} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">{suggestions.map((product, suggestionIndex) => <button key={product.product_id} type="button" role="option" aria-selected={suggestionIndex === highlight} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setSuggestionState({ uid: item.uid, highlight: suggestionIndex })} onClick={() => selectProduct(item.uid, product)} className={`w-full px-3 py-2 text-left text-xs ${suggestionIndex === highlight ? "bg-slate-100" : "hover:bg-slate-50"}`}><span className="block font-medium text-slate-800">{product.product_name}</span><span className="text-slate-400">{product.category} · {product.unit}</span></button>)}</div>}
                          {nameError && <p role="alert" className="mt-1 text-[11px] text-red-500">{nameError}</p>}
                          {!nameError && newAssociation && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">New to supplier</span>}
                        </div>
                        <div><label htmlFor={`po-item-qty-${item.uid}`} className="mb-1 block text-[11px] text-slate-500">Quantity</label><input id={`po-item-qty-${item.uid}`} type="text" inputMode="numeric" value={item.quantity} onChange={(event) => { updateItem(item.uid, { quantity: String(sanitizeNumberInput(event.target.value, { allowDecimal: false, maxDigits: 3 })) }); setIsDirty(true); }} onKeyDown={(event) => blockInvalidNumberKeys(event, { allowDecimal: false })} onBlur={() => updateItem(item.uid, { quantityTouched: true })} aria-invalid={!!quantityError} className={fieldClass(!!quantityError)} />{quantityError && <p role="alert" className="mt-1 text-[11px] text-red-500">{quantityError}</p>}</div>
                        <div><label className="mb-1 block text-[11px] text-slate-500">Unit</label><input value={item.unit} readOnly tabIndex={-1} placeholder="From inventory" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500" /></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div><label htmlFor="po-notes" className="mb-1 block text-xs font-medium text-slate-600">Notes (optional)</label><textarea id="po-notes" value={notes} onChange={(event) => { setNotes(event.target.value); setIsDirty(true); }} rows={2} placeholder="Special instructions for the supplier" className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100" /></div>
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="review-step-title" className="space-y-5">
              <div><h3 id="review-step-title" className="text-base font-semibold text-slate-900">Review purchase order</h3><p className="mt-1 text-sm text-slate-500">Confirm the supplier, materials, and quantities before saving.</p></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-400">Supplier</p><p className="mt-1 text-sm font-semibold text-slate-900">{supplierName}</p><p className="text-xs text-slate-500">{selectedSupplier?.contact_number}</p></div>
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-400">Order summary</p><p className="mt-1 text-sm font-semibold text-slate-900">{items.length} material{items.length !== 1 ? "s" : ""}</p><p className="text-xs text-slate-500">{totalUnits} units</p></div>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="hidden grid-cols-[1fr_7rem_7rem] gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 sm:grid"><span>Material</span><span>Quantity</span><span>Unit</span></div>
                <div className="divide-y divide-slate-100">{items.map((item) => { const newAssociation = !supplierProductSet.has(normalize(item.name)); return <div key={item.uid} className="grid grid-cols-2 gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_7rem_7rem] sm:gap-3"><div><span className="font-medium text-slate-900">{item.name}</span>{newAssociation && <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">New to supplier</span>}</div><span className="text-slate-600">{item.quantity}</span><span className="text-slate-600">{item.unit}</span></div>; })}</div>
              </div>
              {notes && <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-500">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{notes}</p></div>}
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"><span className="font-semibold">Stock is not changed when this PO is created.</span> Inventory quantities increase only when an authorized staff member receives the purchase order.</div>
            </section>
          )}
        </main>

        <footer className="border-t border-slate-100 px-5 py-4 sm:px-7">
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-500"><span>{step > 1 ? `${items.length} material${items.length !== 1 ? "s" : ""} · ${totalUnits} units` : "Select one supplier to continue"}</span>{step === 2 && !isValid && blockingMessage && <span className="max-w-[60%] truncate text-right text-amber-700">{blockingMessage}</span>}</div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={requestClose} disabled={isSubmitting} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <div className="flex gap-3">
              {step > 1 && <button type="button" onClick={() => setStep((step - 1) as 1 | 2)} disabled={isSubmitting} className="flex-1 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none">Back</button>}
              {step === 1 && <button type="button" onClick={goToMaterials} className="flex-1 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 sm:flex-none">Next: Materials</button>}
              {step === 2 && <button type="button" onClick={goToReview} className="flex-1 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 sm:flex-none">Next: Review</button>}
              {step === 3 && <button type="button" onClick={() => void handleSubmit()} disabled={!isValid || isSubmitting} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">{isSubmitting ? <><Spinner />Saving...</> : initialOrder ? "Save Changes" : "Create Purchase Order"}</button>}
            </div>
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}
