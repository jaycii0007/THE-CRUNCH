import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  motion,
  AnimatePresence,
  type Variants,
  type Transition,
} from "framer-motion";
import { Sidebar } from "@/components/Sidebar";
import { useNotifications } from "@/lib/NotificationContext";
import { useAuth } from "../../context/authcontext";
import {
  fetchGeneralSettingsPayload,
  GENERAL_SETTINGS_DEFAULTS,
  formatInSettingsTimezone,
  normalizeGeneralSettings,
} from "@/lib/restaurantSettings";
import { api } from "./services/api";
import type {
  InventoryAlertsPayload,
  InventoryCategoryMaster,
  InventoryUnitMaster,
  Product,
  RawMaterialForm,
  StockAlertSettings,
  StockStatus,
  Tab,
} from "./types/inventory";
import { DashboardSummaryModal } from "./components/DashboardSummaryModal";
import { ErrorBanner } from "./components/ErrorBanner";
import { ExpiryChip } from "./components/ExpiryChip";
import { RawMaterialTimingCell } from "./components/RawMaterialTimingCell";
import { SectionCard } from "./components/SectionCard";
import { SupplierProductsModal } from "./components/SupplierProductsModal";
import { PODetailDrawer } from "./components/purchase-orders/PODetailDrawer";
import { CreatePOModal } from "./components/purchase-orders/CreatePOModal";
import { POPrintModal } from "./components/purchase-orders/POPrintModal";
import { ReceivePOModal } from "./components/purchase-orders/ReceivePOModal";
import { AddMaterialModal } from "./components/modals/AddMaterialModal";
import { StockAlertRestockBanner } from "./components/batches/StockAlertRestockBanner";
import { PurchaseHistoryTab } from "./components/tabs/PurchaseHistoryTab";
import { AlertsTab } from "./components/tabs/AlertsTab";
import { PurchaseOrdersTab } from "./components/tabs/PurchaseOrdersTab";
import { SuppliersTab } from "./components/tabs/SuppliersTab";
import { DashboardTab } from "./components/tabs/DashboardTab";
import { useDashboard } from "./hooks/useDashboard";
import { usePurchaseOrders } from "./hooks/usePurchaseOrders";
import { useSuppliers } from "./hooks/useSuppliers";
import { SkeletonSectionCard, SkeletonTable, SkeletonKPICard, SkeletonListItem } from "@/components/ui/skeleton";
import { toNumber } from "./utils/formatters";
import {
  STOCK_MANAGER_ACTIVE_TAB_STORAGE_KEY,
  STOCK_MANAGER_TAB_REQUEST_EVENT,
} from "./navigation";
import {
  DEFAULT_STOCK_ALERT_SETTINGS,
  getAlertSeverity,
  getAppliedThresholds,
  getShelfLifeStatus,
  getProductUiStatus,
  getStockStatus,
  isStrictRawMaterialCategory,
  normalizeInventoryCategoryName,
  normalizeStockAlertSettings,
} from "./utils/stockUtils";

import "./styles/stockManager.css";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "alerts", label: "Monitor Stock" },
  { id: "suppliers", label: "Suppliers" },
  { id: "purchases", label: "Purchase Orders" },
  { id: "purchase-history", label: "Purchase Order History" },
];
const REMOVED_STOCK_MANAGER_TABS = new Set([
  "withdrawal",
  "kitchen",
  "kitchen-stock",
]);
const FALLBACK_TAB: Tab = "dashboard";

function isValidStockManagerTab(value: unknown): value is Tab {
  const normalized = String(value ?? "").trim().toLowerCase();
  return TABS.some((tab) => tab.id === normalized);
}

function sanitizeStockManagerTab(value: unknown): Tab {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (REMOVED_STOCK_MANAGER_TABS.has(normalized)) {
    return FALLBACK_TAB;
  }
  return isValidStockManagerTab(normalized) ? normalized : FALLBACK_TAB;
}

const BLANK_RAW_MATERIAL: RawMaterialForm = {
  name: "",
  category: "Sauces",
  unit: "liter",
  description: "",
  useDefaultThresholds: false,
  lowStockThreshold: "",
  criticalStockThreshold: "",
};
const RAW_MATERIAL_UNITS = [
  "kg",
  "g",
  "liter",
  "ml",
  "piece",
  "pack",
  "bottle",
  "case",
] as const;
const RAW_MATERIAL_CATEGORIES = [
  "Sauces",
  "Raw Material",
  "Ingredients",
  "Aromatics",
] as const;
const STATUS_BADGE: Record<StockStatus, string> = {
  critical: "bg-orange-100 text-orange-600",
  low: "bg-yellow-100 text-yellow-700",
  normal: "bg-emerald-100 text-emerald-600",
};
const STATUS_DOT: Record<StockStatus, string> = {
  critical: "bg-orange-500",
  low: "bg-yellow-400",
  normal: "bg-emerald-500",
};
const ease: Transition = { duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] };
const pageVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: ease },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};
const staggerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const inventoryCategoryNameLookup = new Map<string, string>();
const inventoryCategoryDateTrackingLookup = new Map<
  string,
  "none" | "expiry" | "shelf_life"
>();

const isWholeChicken = (p: Product) =>
  p.category.toLowerCase().includes("whole chicken");
const isChoppedChicken = (p: Product) =>
  p.category.toLowerCase().includes("chopped chicken");
const isMenuFoodProduct = (p: Pick<Product, "item_type">) =>
  String(p.item_type ?? "")
    .trim()
    .toLowerCase() === "menu_item";
const getCategoryStyle = (cat: string) => {
  const c = cat.toLowerCase();
  if (c.includes("whole chicken")) return "sm-category-badge--whole";
  if (c.includes("chopped chicken")) return "sm-category-badge--chopped";
  if (c.includes("sauce")) return "sm-category-badge--sauce";
  return "sm-category-badge--default";
};
const MATERIAL_NAME_MAX_LENGTH = 100;
const MATERIAL_DESCRIPTION_MAX_LENGTH = 100;
const MATERIAL_NAME_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9' -]*[A-Za-z0-9]$|^[A-Za-z0-9]$/;

const TrashIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const EditIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L12 15l-4 1 1-4 8.586-8.586z"
    />
  </svg>
);

function validateMaterialThresholds(form: RawMaterialForm) {
  const lowStockThreshold =
    form.lowStockThreshold.trim() === "" ? null : Number(form.lowStockThreshold);
  const criticalStockThreshold =
    form.criticalStockThreshold.trim() === ""
      ? null
      : Number(form.criticalStockThreshold);

  if (form.useDefaultThresholds) {
    return {
      ok: true,
      lowStockThreshold: null,
      criticalStockThreshold: null,
      message: "",
    } as const;
  }

  if (
    lowStockThreshold === null ||
    !Number.isFinite(lowStockThreshold) ||
    lowStockThreshold < 0
  ) {
    return {
      ok: false,
      lowStockThreshold,
      criticalStockThreshold,
      message: "Please enter a valid warning stock level.",
    } as const;
  }

  if (
    criticalStockThreshold === null ||
    !Number.isFinite(criticalStockThreshold) ||
    criticalStockThreshold < 0
  ) {
    return {
      ok: false,
      lowStockThreshold,
      criticalStockThreshold,
      message: "Please enter a valid critical stock level.",
    } as const;
  }

  if (criticalStockThreshold > lowStockThreshold) {
    return {
      ok: false,
      lowStockThreshold,
      criticalStockThreshold,
      message: "Critical stock level cannot be greater than warning stock level.",
    } as const;
  }

  return {
    ok: true,
    lowStockThreshold,
    criticalStockThreshold,
    message: "",
  } as const;
}

export default function StockManager() {
  const { user } = useAuth();
  const [restaurantSettings, setRestaurantSettings] = useState(
    GENERAL_SETTINGS_DEFAULTS,
  );
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") {
      return FALLBACK_TAB;
    }
    return sanitizeStockManagerTab(
      window.localStorage.getItem(STOCK_MANAGER_ACTIVE_TAB_STORAGE_KEY),
    );
  });
  const activeTab = sanitizeStockManagerTab(tab);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRawMaterialForm, setShowRawMaterialForm] = useState(false);
  const [rawMaterialForm, setRawMaterialForm] =
    useState<RawMaterialForm>(BLANK_RAW_MATERIAL);
  const [editingMaterial, setEditingMaterial] = useState<Product | null>(null);
  const [inventoryCategories, setInventoryCategories] = useState<
    InventoryCategoryMaster[]
  >([]);
  const [inventoryUnits, setInventoryUnits] = useState<InventoryUnitMaster[]>(
    [],
  );
  const [stockAlertSettings, setStockAlertSettings] =
    useState<StockAlertSettings>(DEFAULT_STOCK_ALERT_SETTINGS);
  const [backendAlerts, setBackendAlerts] =
    useState<InventoryAlertsPayload | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [showDashboardBackToTop, setShowDashboardBackToTop] = useState(false);
  const dashboardTopRef = useRef<HTMLDivElement | null>(null);
  const refreshInventoryRef = useRef<() => Promise<void>>(async () => {});
  const alertsLoadStarted = useRef(false);
  const inventoryUnitsLoadStarted = useRef(false);
  const currentStaffDisplayName = useMemo(() => {
    const authUser = user as
      | (typeof user & { full_name?: string | null })
      | null;
    const fullName = String(authUser?.full_name ?? "").trim();
    const username = String(user?.username ?? "").trim();
    return fullName || username;
  }, [user]);

  const { addNotification } = useNotifications();
  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      addNotification({ id: crypto.randomUUID(), label: message, type });
    },
    [addNotification],
  );

  const supplier = useSuppliers({
    products,
    tab: activeTab,
    showToast,
    setSubmitting,
    isMenuFoodProduct,
  });

  const scrollDashboardTo = useCallback((targetId: string) => {
    if (typeof document === "undefined") return;
    const element = document.getElementById(targetId);
    if (!element) return;
    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setIsRefreshing(true);
    setError(null);
    try {
      const [invRes, categoryRes, settingsRes] = await Promise.allSettled([
        api.getInventory(),
        api.getInventoryCategories(),
        fetchGeneralSettingsPayload(),
      ]);

      if (invRes.status !== "fulfilled") {
        const detail =
          invRes.reason instanceof Error
            ? invRes.reason.message
            : String(invRes.reason ?? "Unknown error");
        throw new Error(`Inventory request failed: ${detail}`);
      }
      const inv = invRes.value;
      const categoryList =
        categoryRes.status === "fulfilled" ? categoryRes.value : [];
      const nextStockAlertSettings =
        settingsRes.status === "fulfilled"
          ? normalizeStockAlertSettings(settingsRes.value)
          : DEFAULT_STOCK_ALERT_SETTINGS;
      if (settingsRes.status === "fulfilled") {
        setRestaurantSettings(normalizeGeneralSettings(settingsRes.value));
      }
      inventoryCategoryNameLookup.clear();
      inventoryCategoryDateTrackingLookup.clear();
      for (const category of categoryList) {
        inventoryCategoryNameLookup.set(
          normalizeInventoryCategoryName(category.name),
          category.name,
        );
        inventoryCategoryDateTrackingLookup.set(
          normalizeInventoryCategoryName(category.name),
          category.date_tracking_type ?? "none",
        );
      }
      setInventoryCategories(categoryList);
      setStockAlertSettings(nextStockAlertSettings);

      const candidateProducts: Product[] = inv
        .map((p) => ({
          ...p,
          inventory_id: toNumber(p.inventory_id),
          product_id: toNumber(p.product_id),
          mainStock: toNumber(p.mainStock),
          quantity: toNumber(p.quantity),
          item_purchased: toNumber(p.item_purchased),
          reorderPoint: toNumber(p.reorderPoint),
          criticalPoint: toNumber(p.criticalPoint),
          useDefaultThresholds:
            (p as { useDefaultThresholds?: unknown }).useDefaultThresholds ===
              undefined ||
            (p as { useDefaultThresholds?: unknown }).useDefaultThresholds ===
              null
              ? true
              : Boolean(
                  Number(
                    (p as { useDefaultThresholds?: unknown })
                      .useDefaultThresholds,
                  ),
                ),
          lowStockThreshold:
            (p as { lowStockThreshold?: unknown }).lowStockThreshold ===
              undefined ||
            (p as { lowStockThreshold?: unknown }).lowStockThreshold === null
              ? null
              : toNumber(
                  (p as { lowStockThreshold?: unknown }).lowStockThreshold,
                ),
          criticalStockThreshold:
            (p as { criticalStockThreshold?: unknown })
              .criticalStockThreshold === undefined ||
            (p as { criticalStockThreshold?: unknown })
              .criticalStockThreshold === null
              ? null
              : toNumber(
                  (p as { criticalStockThreshold?: unknown })
                    .criticalStockThreshold,
                ),
          dailyWithdrawn: toNumber(p.dailyWithdrawn),
          returned: toNumber(p.returned),
          wasted: toNumber(p.wasted),
          expiryDate: p.expiryDate ? String(p.expiryDate) : null,
          usableUntil: p.usableUntil ? String(p.usableUntil) : null,
          shelfLifeDays:
            p.shelfLifeDays !== undefined && p.shelfLifeDays !== null
              ? toNumber(p.shelfLifeDays)
              : null,
          shelfLifeHours:
            p.shelfLifeHours !== undefined && p.shelfLifeHours !== null
              ? toNumber(p.shelfLifeHours)
              : null,
          item_type:
            typeof (p as { item_type?: unknown }).item_type === "string"
              ? String((p as { item_type?: unknown }).item_type)
              : "stock_item",
          description:
            typeof (p as { description?: unknown }).description === "string"
              ? String((p as { description?: unknown }).description)
              : "",
          promo: typeof p.promo === "string" ? p.promo : "",
          isRawMaterial: isStrictRawMaterialCategory(
            typeof p.category === "string" ? p.category : "",
            inventoryCategoryDateTrackingLookup,
          ),
        }))
        .filter(
          (p) =>
            String(p.item_type ?? "stock_item")
              .trim()
              .toLowerCase() === "stock_item",
        );

      const groupedByName = new Map<string, Product[]>();
      for (const item of candidateProducts) {
        const key = String(item.product_name ?? "")
          .trim()
          .toLowerCase();
        groupedByName.set(key, [...(groupedByName.get(key) ?? []), item]);
      }
      const normalizedProducts: Product[] = Array.from(
        groupedByName.values(),
      ).map((group) => {
        const pool = group.filter((i) => !i.isRawMaterial);
        return (pool.length > 0 ? pool : group).reduce((latest, current) =>
          toNumber(current.product_id) > toNumber(latest.product_id)
            ? current
            : latest,
        );
      });

      setProducts(normalizedProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);
  refreshInventoryRef.current = fetchAll;

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      setBackendAlerts(await api.getInventoryAlerts());
    } catch (alertError) {
      setAlertsError(
        alertError instanceof Error
          ? alertError.message
          : "Failed to load inventory alerts.",
      );
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "alerts" || alertsLoadStarted.current) return;
    alertsLoadStarted.current = true;
    void fetchAlerts();
  }, [activeTab, fetchAlerts]);

  useEffect(() => {
    if (!showRawMaterialForm || inventoryUnitsLoadStarted.current) return;
    inventoryUnitsLoadStarted.current = true;
    void api
      .getInventoryUnits()
      .then(setInventoryUnits)
      .catch((unitError) => {
        showToast(
          unitError instanceof Error
            ? unitError.message
            : "Failed to load inventory units.",
          "error",
        );
      });
  }, [showRawMaterialForm, showToast]);
  useEffect(() => {
    if (sanitizeStockManagerTab(tab) !== "dashboard") {
      setShowDashboardBackToTop(false);
      return;
    }
    const handleScroll = () => {
      setShowDashboardBackToTop(window.scrollY > 260);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [tab]);

  const lowStock = products.filter(
    (p) =>
      !isMenuFoodProduct(p) &&
      getAlertSeverity(p, stockAlertSettings) === "low",
  );
  const criticalStock = products.filter(
    (p) =>
      !isMenuFoodProduct(p) &&
      getAlertSeverity(p, stockAlertSettings) === "critical",
  );
  const outOfStock = products.filter(
    (p) =>
      !isMenuFoodProduct(p) &&
      getAlertSeverity(p, stockAlertSettings) === "out",
  );
  const po = usePurchaseOrders({
    enabled: activeTab === "purchases" || activeTab === "purchase-history",
    outOfStock,
    criticalStock,
    lowStock,
    suppliers: supplier.suppliers,
    setSuppliers: supplier.setSuppliers,
    refreshInventory: fetchAll,
    showToast,
    addNotification,
  });
  const mainStockProducts = useMemo(
    () => products.filter((p) => !isMenuFoodProduct(p)),
    [products],
  );
  const dashboard = useDashboard({
    products,
    mainStockProducts,
    purchaseOrders: po.poOrders,
    completedPurchaseOrders: po.filteredCompletedPOs,
    stockAlertSettings,
    inventoryCategoryDateTrackingLookup,
    isMenuFoodProduct,
    isWholeChicken,
    isChoppedChicken,
  });
  useEffect(() => {
    const safeTab = sanitizeStockManagerTab(tab);
    if (safeTab !== tab) {
      setTab(safeTab);
    }
  }, [tab]);

  useEffect(() => {
    const handleTabRequest = (event: Event) => {
      const requestedTab = (event as CustomEvent<{ tab?: unknown }>).detail?.tab;
      if (isValidStockManagerTab(requestedTab)) setTab(requestedTab);
    };
    window.addEventListener(STOCK_MANAGER_TAB_REQUEST_EVENT, handleTabRequest);
    return () =>
      window.removeEventListener(STOCK_MANAGER_TAB_REQUEST_EVENT, handleTabRequest);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTab = window.localStorage.getItem(
      STOCK_MANAGER_ACTIVE_TAB_STORAGE_KEY,
    );
    const safeStoredTab = sanitizeStockManagerTab(storedTab);
    if (storedTab !== safeStoredTab) {
      window.localStorage.setItem(
        STOCK_MANAGER_ACTIVE_TAB_STORAGE_KEY,
        safeStoredTab,
      );
    }
    window.localStorage.setItem(
      STOCK_MANAGER_ACTIVE_TAB_STORAGE_KEY,
      sanitizeStockManagerTab(tab),
    );
  }, [tab]);

  useEffect(() => {
    if (activeTab !== "dashboard") return;
    dashboard.selectDashboardSubTab("main-stock");
  }, [activeTab, dashboard.selectDashboardSubTab]);
  const activeInventoryCategoryOptions = useMemo(() => {
    const names = inventoryCategories
      .filter(
        (category) => category.is_active === true || category.is_active === 1,
      )
      .map((category) => category.name.trim())
      .filter(Boolean);
    return names.length > 0 ? names : [...RAW_MATERIAL_CATEGORIES];
  }, [inventoryCategories]);
  const activeInventoryUnitOptions = useMemo(() => {
    const names = inventoryUnits
      .filter((unit) => unit.is_active === true || unit.is_active === 1)
      .map((unit) => unit.name.trim())
      .filter(Boolean);
    return names.length > 0 ? names : [...RAW_MATERIAL_UNITS];
  }, [inventoryUnits]);

  async function addRawMaterial() {
    const name = rawMaterialForm.name.trim();
    const description = rawMaterialForm.description.trim();
    if (!name) {
      showToast("Please enter a raw material name.", "error");
      return;
    }
    if (name.length < 2 || name.length > MATERIAL_NAME_MAX_LENGTH) {
      showToast("Material name must be between 2 and 100 characters.", "error");
      return;
    }
    if (!MATERIAL_NAME_PATTERN.test(name)) {
      showToast(
        "Material name may only use letters, numbers, spaces, apostrophes, and hyphens.",
        "error",
      );
      return;
    }
    if (description.length > MATERIAL_DESCRIPTION_MAX_LENGTH) {
      showToast("Description must not exceed 100 characters.", "error");
      return;
    }
    const existing = products.find(
      (p) => p.product_name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      showToast("This material already exists in inventory.", "error");
      return;
    }
    const thresholdValidation = validateMaterialThresholds(rawMaterialForm);
    if (!thresholdValidation.ok) {
      showToast(thresholdValidation.message, "error");
      return;
    }
    setSubmitting(true);
    try {
      await api.createProduct({
        name,
        price: 0,
        quantity: 0,
        unit: rawMaterialForm.unit.trim(),
        category: rawMaterialForm.category.trim(),
        description: description || undefined,
        raw_material: isStrictRawMaterialCategory(
          rawMaterialForm.category,
          inventoryCategoryDateTrackingLookup,
        ),
        item_type: "stock_item",
        use_default_thresholds: rawMaterialForm.useDefaultThresholds,
        low_stock_threshold: rawMaterialForm.useDefaultThresholds
          ? null
          : thresholdValidation.lowStockThreshold,
        critical_stock_threshold: rawMaterialForm.useDefaultThresholds
          ? null
          : thresholdValidation.criticalStockThreshold,
      });
      await fetchAll();
      setRawMaterialForm(BLANK_RAW_MATERIAL);
      setShowRawMaterialForm(false);
      showToast("Raw material added.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to add raw material.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function openEditMaterial(product: Product) {
    setEditingMaterial(product);
    setRawMaterialForm({
      name: product.product_name,
      category: product.category,
      unit: product.unit,
      description: product.description ?? "",
      useDefaultThresholds:
        product.useDefaultThresholds === true ||
        product.useDefaultThresholds === 1,
      lowStockThreshold:
        product.lowStockThreshold == null
          ? ""
          : String(product.lowStockThreshold),
      criticalStockThreshold:
        product.criticalStockThreshold == null
          ? ""
          : String(product.criticalStockThreshold),
    });
    setShowRawMaterialForm(true);
  }

  async function saveEditedMaterial() {
    if (!editingMaterial) return;

    const name = rawMaterialForm.name.trim();
    const description = rawMaterialForm.description.trim();
    if (!name) {
      showToast("Please enter a raw material name.", "error");
      return;
    }
    if (name.length < 2 || name.length > MATERIAL_NAME_MAX_LENGTH) {
      showToast("Material name must be between 2 and 100 characters.", "error");
      return;
    }
    if (!MATERIAL_NAME_PATTERN.test(name)) {
      showToast(
        "Material name may only use letters, numbers, spaces, apostrophes, and hyphens.",
        "error",
      );
      return;
    }
    if (description.length > MATERIAL_DESCRIPTION_MAX_LENGTH) {
      showToast("Description must not exceed 100 characters.", "error");
      return;
    }
    const duplicate = products.find(
      (p) =>
        p.product_id !== editingMaterial.product_id &&
        p.product_name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      showToast("This material already exists in inventory.", "error");
      return;
    }

    const thresholdValidation = validateMaterialThresholds(rawMaterialForm);
    if (!thresholdValidation.ok) {
      showToast(thresholdValidation.message, "error");
      return;
    }

    setSubmitting(true);
    try {
      await api.updateProduct(editingMaterial.product_id, {
        name,
        unit: rawMaterialForm.unit.trim(),
        category: rawMaterialForm.category.trim(),
        description: description || "",
        use_default_thresholds: rawMaterialForm.useDefaultThresholds,
        low_stock_threshold: rawMaterialForm.useDefaultThresholds
          ? null
          : thresholdValidation.lowStockThreshold,
        critical_stock_threshold: rawMaterialForm.useDefaultThresholds
          ? null
          : thresholdValidation.criticalStockThreshold,
      });
      await fetchAll();
      setEditingMaterial(null);
      setRawMaterialForm(BLANK_RAW_MATERIAL);
      setShowRawMaterialForm(false);
      showToast("Material updated.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update material.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDashboardDeleteProduct(product: Product) {
    if (
      !window.confirm(
        `Delete ${product.product_name}? This removes it from stock records.`,
      )
    )
      return;
    try {
      await api.deleteProduct(product.product_id);
      setProducts((prev) =>
        prev.filter((p) => p.product_id !== product.product_id),
      );
      showToast(`${product.product_name} deleted.`, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete item.",
        "error",
      );
    }
  }

  return (
    <>
      <style>{`@keyframes fadeInRow { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }`}</style>
      <div className="sm-page">
        <Sidebar />

        <header className="sm-header">
          <div className="sm-header-inner">
            <div className="sm-header-brand">
              <h2 className="sm-header-title">Stock Manager</h2>
              <p className="sm-header-date">
                {formatInSettingsTimezone(new Date(), restaurantSettings, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="sm-header-actions">
              {dashboard.attentionItems.length > 0 && (
                <button
                  onClick={() => setTab("alerts")}
                  className="sm-attention-btn"
                >
                  <span className="sm-status-dot sm-status-dot--syncing" />
                  {dashboard.attentionItems.length} item{dashboard.attentionItems.length > 1 ? "s" : ""} need attention
                </button>
              )}
              <div className="sm-status-badge">
                <span className={`sm-status-dot ${isLoading || isRefreshing ? "sm-status-dot--syncing" : "sm-status-dot--synced"}`} />
                <span>{isLoading || isRefreshing ? "Syncing" : "Up to date"}</span>
              </div>
            </div>
          </div>

          <nav className="sm-tabs" aria-label="Main navigation">
            {TABS.map((t) => {
              const badge =
                t.id === "alerts"
                  ? dashboard.attentionItems.length
                  : t.id === "purchases"
                    ? po.poOrders.filter((o) => o.status === "Draft").length
                    : t.id === "purchase-history"
                      ? po.completedPOs.length
                      : 0;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`sm-tab ${active ? "sm-tab--active" : "sm-tab--inactive"}`}
                  aria-current={active ? "page" : undefined}
                >
                  {t.label}
                  {badge > 0 && (
                    <span className={`sm-tab-badge ${active ? "sm-tab-badge--active" : t.id === "purchases" ? "sm-tab-badge--purchases" : t.id === "purchase-history" ? "sm-tab-badge--history" : "sm-tab-badge--alerts"}`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {activeTab === "dashboard" && !isLoading && (
            <div className="sm-subtabs" role="tablist" aria-label="Dashboard views">
              {[
                { id: "main-stock" as const, label: "Main Stock Levels" },
                { id: "last-updates" as const, label: "Last Inventory Updates" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => dashboard.selectDashboardSubTab(item.id)}
                  className={`sm-subtab ${dashboard.dashboardSubTab === item.id ? "sm-subtab--active" : ""}`}
                  role="tab"
                  aria-selected={dashboard.dashboardSubTab === item.id}
                  aria-controls={`dashboard-${item.id}`}
                >
                  {item.label}
                  <span className="sm-subtab-indicator" />
                </button>
              ))}
            </div>
          )}
        </header>

        <main className="sm-main">
          {error && (
            <div style={{ padding: "24px" }}>
              <ErrorBanner message={error} onRetry={fetchAll} />
            </div>
          )}
          {isLoading ? (
            <div style={{ padding: "48px 24px" }}>
              <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading stock manager">
                <div className="sm-kpi-grid" style={{ padding: "24px" }}>
                  <SkeletonKPICard theme="admin" />
                  <SkeletonKPICard theme="admin" />
                  <SkeletonKPICard theme="admin" />
                  <SkeletonKPICard theme="admin" />
                </div>
                <SkeletonSectionCard theme="admin" />
              </div>
            </div>
          ) : error ? null : (
            <AnimatePresence mode="wait">
              {activeTab === "dashboard" && (
                <DashboardTab
                  pageVariants={pageVariants}
                  staggerVariants={staggerVariants}
                  itemVariants={itemVariants}
                  dashboardTopRef={dashboardTopRef}
                  totalProductsValue={dashboard.totalProductsCounted.length.toString()}
                  lowStockValue={dashboard.lowStockItems.length.toString()}
                  criticalStockValue={dashboard.alertCriticalStock.length.toString()}
                  attentionValue={dashboard.attentionItems.length.toString()}
                  wholeChickenProducts={dashboard.wholeChickenProducts}
                  choppedChickenProducts={dashboard.choppedChickenProducts}
                  dashboardSubTab={dashboard.dashboardSubTab}
                  onSummarySelect={dashboard.selectDashboardSummary}
                  mainStockContent={
                    <div
                      id="dashboard-main-stock"
                      style={{ scrollMarginTop: "180px" }}
                    >
                      <motion.div variants={itemVariants}>
                        <SectionCard
                          title="Main Stock Levels"
                          subtitle="Raw materials added from Stock Manager"
                        >
                          <div className="sm-toolbar">
                            <div className="sm-toolbar-left">
                              <div className="sm-search">
                                <svg className="sm-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                  <circle cx="11" cy="11" r="8" />
                                  <path d="m21 21-4.35-4.35" />
                                </svg>
                                <input
                                  type="text"
                                  value={dashboard.dashboardSearch}
                                  onChange={(e) => dashboard.setDashboardSearch(e.target.value)}
                                  placeholder="Search by item name or category..."
                                  className="sm-search-input"
                                />
                              </div>
                            </div>
                            <div className="sm-toolbar-right">
                              <button
                                onClick={() => {
                                  setEditingMaterial(null);
                                  setRawMaterialForm(BLANK_RAW_MATERIAL);
                                  setShowRawMaterialForm(true);
                                }}
                                className="sm-btn sm-btn--primary"
                              >
                                <svg className="sm-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                  <path d="M12 5v14M5 12h14" />
                                </svg>
                                Add Material
                              </button>
                            </div>
                          </div>
                          <div className="sm-table-wrapper">
                            <table className="sm-table">
                              <thead>
                                <tr>
                                  {[
                                    "Item",
                                    "Category",
                                    "Main Stock",
                                    "Qty Purchased",
                                    "Shelf Life / Expiry",
                                    "Status",
                                    "Action",
                                  ].map((h) => (
                                    <th
                                      key={h}
                                      className={["Item", "Category"].includes(h) ? "" : ["Status", "Action"].includes(h) ? "th--center" : "th--right"}
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(
                                  dashboard.dashboardFilteredProducts ?? []
                                ).map((p, i) => {
                                  const shelfLifeStatus = p.isRawMaterial
                                    ? getShelfLifeStatus({
                                        usableUntil: p.usableUntil,
                                        shelfLifeDays: p.shelfLifeDays,
                                        shelfLifeHours: p.shelfLifeHours,
                                      })
                                    : null;
                                  const hasPastShelfLife =
                                    shelfLifeStatus === "Past Shelf Life";
                                  const uiStatus = getProductUiStatus(p);
                                  const status = getStockStatus(
                                    p,
                                    stockAlertSettings,
                                  );
                                  const isOutOfStock =
                                    uiStatus === "Out of Stock";
                                  const statusDotClass = isOutOfStock
                                    ? "bg-slate-500"
                                    : STATUS_DOT[status];
                                  const statusBadgeClass = isOutOfStock
                                    ? "bg-slate-100 text-slate-700"
                                    : p.isRawMaterial
                                      ? uiStatus === "Past Shelf Life"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-emerald-100 text-emerald-700"
                                      : STATUS_BADGE[status];
                                  const statusLabel = p.isRawMaterial
                                    ? uiStatus
                                    : isOutOfStock
                                      ? "Out of Stock"
                                      : status;
                                  return (
                                    <tr
                                      key={p.inventory_id}
                                      style={{
                                        opacity: 0,
                                        animation: `fadeInRow 0.28s ease forwards`,
                                        animationDelay: `${i * 0.04}s`,
                                      }}
                                      className={hasPastShelfLife ? "tr--expired" : ""}
                                    >
                                      <td>
                                        <div className="sm-item-cell">
                                          <span className={`sm-item-dot ${statusDotClass}`} />
                                          <span className="sm-item-name">{p.product_name}</span>
                                        </div>
                                      </td>
                                      <td>
                                        <span className={`sm-category-badge ${getCategoryStyle(p.category).replace("bg-", "sm-category-badge--").replace("text-", "").replace("border-", "")}`}>
                                          {p.category}
                                        </span>
                                      </td>
                                      <td className="td--right">
                                        <div className="sm-stock-qty">
                                          <span className="sm-stock-main">
                                            {p.mainStock}
                                            <span className="sm-stock-unit">{p.unit}</span>
                                          </span>
                                          {hasPastShelfLife && (
                                            <span className="sm-stock-expired">Expired</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="td--right">
                                        <span className="sm-qty-purchased">{p.item_purchased}</span>
                                      </td>
                                      <td className="td--right">
                                        {p.isRawMaterial ? (
                                          <RawMaterialTimingCell product={p} />
                                        ) : (
                                          <ExpiryChip dateStr={p.expiryDate} />
                                        )}
                                      </td>
                                      <td className="td--center">
                                        <span className={`sm-status-badge-table ${(() => {
                                          if (statusBadgeClass.includes("bg-emerald")) return "sm-status-badge-table--normal";
                                          if (statusBadgeClass.includes("bg-yellow")) return "sm-status-badge-table--low";
                                          if (statusBadgeClass.includes("bg-orange")) return "sm-status-badge-table--critical";
                                          if (statusBadgeClass.includes("bg-slate")) return "sm-status-badge-table--out";
                                          if (statusBadgeClass.includes("bg-red")) return "sm-status-badge-table--expired";
                                          return "sm-status-badge-table--normal";
                                        })()}`}>
                                          {statusLabel}
                                        </span>
                                      </td>
                                      <td className="td--center">
                                        <div className="sm-action-group">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              openEditMaterial(p);
                                            }}
                                            className="sm-action-btn sm-action-btn--edit"
                                            title={`Edit ${p.product_name}`}
                                            aria-label={`Edit ${p.product_name}`}
                                          >
                                            <EditIcon />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              void handleDashboardDeleteProduct(p);
                                            }}
                                            className="sm-action-btn sm-action-btn--delete"
                                            title={`Delete ${p.product_name}`}
                                            aria-label={`Delete ${p.product_name}`}
                                          >
                                            <TrashIcon />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                                {(dashboard.dashboardFilteredProducts?.length ??
                                  0) === 0 && (
                                  <tr>
                                    <td colSpan={7} className="sm-empty">
                                      <svg className="sm-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                                        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                      </svg>
                                      <p className="sm-empty-title">No items found</p>
                                      <p className="sm-empty-message">No items match your search.</p>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </SectionCard>
                      </motion.div>
                    </div>
                  }
                  lastUpdatesContent={
                    <motion.div variants={itemVariants} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))", gap: "24px" }}>
                      <div
                        id="dashboard-last-updates"
                        style={{ scrollMarginTop: "180px" }}
                      >
                        <SectionCard
                          title="Last Inventory Updates"
                          subtitle="Most recently updated items"
                        >
                          <div style={{ borderTop: "none" }}>
                            {[...products]
                              .sort(
                                (a, b) =>
                                  new Date(b.last_update).getTime() -
                                  new Date(a.last_update).getTime(),
                              )
                              .slice(0, 6)
                              .map((p, i) => (
                                <motion.div
                                  key={p.inventory_id}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: i * 0.07 }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "16px 20px",
                                    borderBottom: "1px solid var(--sm-border)",
                                  }}
                                >
                                  <div>
                                    <p style={{ fontSize: "var(--sm-text-sm)", fontWeight: 500, color: "var(--sm-text)" }}>
                                      {p.product_name}
                                    </p>
                                    <p style={{ fontSize: "var(--sm-text-xs)", color: "var(--sm-text-subtle)", marginTop: "4px" }}>
                                      {p.supplier_name}
                                    </p>
                                  </div>
                                  <span style={{ fontSize: "var(--sm-text-xs)", color: "var(--sm-text-muted)", background: "var(--sm-surface-alt)", border: "1px solid var(--sm-border)", padding: "6px 12px", borderRadius: "var(--sm-radius-sm)" }}>
                                    {formatInSettingsTimezone(
                                      p.last_update,
                                      restaurantSettings,
                                      { month: "short", day: "numeric" },
                                    )}
                                  </span>
                                </motion.div>
                              ))}
                          </div>
                        </SectionCard>
                      </div>
                    </motion.div>
                  }
                />
              )}

              {activeTab === "alerts" && alertsError && (
                <div style={{ padding: "24px" }}>
                  <ErrorBanner
                    message={`Inventory alerts request failed: ${alertsError}`}
                    onRetry={() => { void fetchAlerts(); }}
                  />
                </div>
              )}
              {activeTab === "alerts" && alertsLoading && !backendAlerts && (
                <div style={{ padding: "48px 24px" }}>
                  <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading inventory alerts">
                    <SkeletonSectionCard theme="admin" />
                    <SkeletonKPICard theme="admin" />
                    <SkeletonKPICard theme="admin" />
                    <SkeletonKPICard theme="admin" />
                    <SkeletonKPICard theme="admin" />
                    <SkeletonListItem theme="admin" hasIcon hasAction />
                    <SkeletonListItem theme="admin" hasIcon hasAction />
                    <SkeletonListItem theme="admin" hasIcon hasAction />
                  </div>
                </div>
              )}
              {activeTab === "alerts" && !alertsError && !alertsLoading && (
                <AlertsTab
                  pageVariants={pageVariants}
                  staggerVariants={staggerVariants}
                  itemVariants={itemVariants}
                  stockAlertSettings={stockAlertSettings}
                  backendAlerts={backendAlerts}
                  products={products}
                  lowStock={lowStock}
                  alertCriticalStock={dashboard.alertCriticalStock}
                  outOfStockItems={dashboard.outOfStockItems}
                  setTab={setTab}
                  handleOrderNow={po.handleOrderNow}
                  isMenuFoodProduct={isMenuFoodProduct}
                  getAlertSeverity={getAlertSeverity}
                  getStockStatus={getStockStatus}
                  getAppliedThresholds={getAppliedThresholds}
                  getCategoryStyle={getCategoryStyle}
                  statusBadge={STATUS_BADGE}
                  toNumber={toNumber}
                  onSummarySelect={dashboard.selectDashboardSummary}
                />
              )}

              {activeTab === "suppliers" && supplier.supplierError && (
                <div style={{ padding: "24px" }}>
                  <ErrorBanner
                    message={`Suppliers request failed: ${supplier.supplierError}`}
                    onRetry={() => { void supplier.fetchSuppliers(); }}
                  />
                </div>
              )}
              {activeTab === "suppliers" &&
                supplier.supplierLoading &&
                !supplier.suppliersLoaded && (
                  <div style={{ padding: "48px 24px" }}>
                    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading suppliers">
                      <SkeletonSectionCard theme="admin" />
                      <SkeletonTable rowCount={5} columnCount={4} theme="admin" />
                    </div>
                  </div>
                )}
              {activeTab === "suppliers" &&
                !supplier.supplierError &&
                !supplier.supplierLoading && (
                  <SuppliersTab
                    pageVariants={pageVariants}
                    staggerVariants={staggerVariants}
                    itemVariants={itemVariants}
                    showSupplierForm={supplier.showSupplierForm}
                    supplierForm={supplier.supplierForm}
                    supplierProductInput={supplier.supplierProductInput}
                    supplierProductSuggestions={supplier.supplierProductSuggestions}
                    filteredSuppliers={supplier.filteredSuppliers}
                    supplierSearch={supplier.supplierSearch}
                    historySearch={supplier.historySearch}
                    historyDateFrom={supplier.historyDateFrom}
                    historyDateTo={supplier.historyDateTo}
                    historyLoading={supplier.historyLoading}
                    filteredHistory={supplier.filteredHistory}
                    supplierFields={supplier.supplierFields}
                    submitting={submitting}
                    setShowSupplierForm={supplier.setShowSupplierForm}
                    setSupplierProductInput={supplier.setSupplierProductInput}
                    setSupplierForm={supplier.setSupplierForm}
                    setSupplierSearch={supplier.setSupplierSearch}
                    setHistorySearch={supplier.setHistorySearch}
                    setHistoryDateFrom={supplier.setHistoryDateFrom}
                    setHistoryDateTo={supplier.setHistoryDateTo}
                    setEditingSupplier={supplier.setEditingSupplier}
                    addProductToSupplierForm={supplier.addProductToSupplierForm}
                    addSupplier={supplier.addSupplier}
                    removeSupplier={supplier.removeSupplier}
                    handleRemoveSupplierProduct={supplier.handleRemoveSupplierProduct}
                    fetchSupplierHistory={supplier.fetchSupplierHistory}
                  />
                )}

              {activeTab === "purchases" && po.poError && (
                <div style={{ padding: "24px" }}>
                  <ErrorBanner
                    message={`Purchase orders request failed: ${po.poError}`}
                    onRetry={() => { void po.fetchPurchaseOrders(); }}
                  />
                </div>
              )}
              {activeTab === "purchases" && !po.poError && (
                <PurchaseOrdersTab
                  pageVariants={pageVariants}
                  staggerVariants={staggerVariants}
                  itemVariants={itemVariants}
                  lowStock={lowStock}
                  criticalStock={criticalStock}
                  filteredPOs={po.filteredPOs}
                  poLoading={po.poLoading}
                  restockBanner={
                    <StockAlertRestockBanner
                      criticalItems={criticalStock}
                      lowItems={lowStock}
                      onOrderNow={po.handleOrderNow}
                      getCategoryStyle={getCategoryStyle}
                    />
                  }
                  onNewPO={() => po.setPrefillPOProduct(null)}
                  onSelectOrder={po.setSelectedOrder}
                  onPrintOrder={po.setPrintOrder}
                  onDeleteOrder={po.handlePODelete}
                  onSummarySelect={dashboard.selectDashboardSummary}
                />
              )}

              {activeTab === "purchase-history" && po.poError && (
                <div style={{ padding: "24px" }}>
                  <ErrorBanner
                    message={`Purchase order history request failed: ${po.poError}`}
                    onRetry={() => { void po.fetchPurchaseOrders(); }}
                  />
                </div>
              )}
              {activeTab === "purchase-history" && !po.poError && (
                <PurchaseHistoryTab
                  pageVariants={pageVariants}
                  staggerVariants={staggerVariants}
                  itemVariants={itemVariants}
                  filteredCompletedPOs={po.filteredCompletedPOs}
                  paginatedCompletedPOs={po.paginatedCompletedPOs}
                  poLoading={po.poLoading}
                  poHistoryDateFrom={po.poHistoryDateFrom}
                  poHistoryDateTo={po.poHistoryDateTo}
                  poHistoryStatus={po.poHistoryStatus}
                  poHistoryFromInputRef={po.poHistoryFromInputRef}
                  poHistoryToInputRef={po.poHistoryToInputRef}
                  poHistoryPage={po.poHistoryPage}
                  poHistoryTotalPages={po.poHistoryTotalPages}
                  poHistoryPageSize={po.poHistoryPageSize}
                  setPoHistoryDateFrom={po.setPoHistoryDateFrom}
                  setPoHistoryDateTo={po.setPoHistoryDateTo}
                  setPoHistoryStatus={po.setPoHistoryStatus}
                  setPoHistoryPage={po.setPoHistoryPage}
                  setSelectedOrder={po.setSelectedOrder}
                  setPrintOrder={po.setPrintOrder}
                  onSummarySelect={dashboard.selectDashboardSummary}
                />
              )}
            </AnimatePresence>
          )}

          {activeTab === "dashboard" && !isLoading && !error && (
            (dashboard.wholeChickenProducts.length > 0 || dashboard.choppedChickenProducts.length > 0) && (
              <div className="sm-chicken-banner" role="region" aria-label="Chicken inventory">
                <svg className="sm-chicken-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
                <span className="sm-chicken-label">Chicken Inventory</span>
                <div className="sm-chicken-items">
                  {dashboard.wholeChickenProducts.map((p) => (
                    <div key={p.product_id} className="sm-chicken-item">
                      <span className="sm-chicken-dot sm-chicken-dot--whole" />
                      <div className="sm-chicken-info">
                        <span className="sm-chicken-type">Whole Chicken</span>
                        <span className="sm-chicken-qty">{p.mainStock}<span className="sm-chicken-unit"> {p.unit}</span></span>
                      </div>
                    </div>
                  ))}
                  {dashboard.wholeChickenProducts.length > 0 && dashboard.choppedChickenProducts.length > 0 && (
                    <span className="sm-chicken-separator" aria-hidden="true">→</span>
                  )}
                  {dashboard.choppedChickenProducts.map((p) => (
                    <div key={p.product_id} className="sm-chicken-item">
                      <span className="sm-chicken-dot sm-chicken-dot--chopped" />
                      <div className="sm-chicken-info">
                        <span className="sm-chicken-type">Chopped Chicken</span>
                        <span className="sm-chicken-qty">{p.mainStock}<span className="sm-chicken-unit"> {p.unit}</span></span>
                      </div>
                    </div>
                  ))}
                  <p className="sm-chicken-note">Delivered whole → chopped separately in inventory</p>
                </div>
              </div>
            )
          )}
        </main>

        <AnimatePresence>
          {activeTab === "dashboard" &&
            showDashboardBackToTop &&
            !isLoading && (
              <motion.button
                initial={{ opacity: 0, y: 16, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.92 }}
                transition={{ duration: 0.2 }}
                onClick={() => scrollDashboardTo("dashboard-top")}
                className="sm-back-to-top"
                aria-label="Back to top"
              >
                <span style={{ fontSize: "24px", lineHeight: 1 }}>↑</span>
              </motion.button>
            )}
        </AnimatePresence>

        <AnimatePresence>
          {po.selectedOrder && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => po.setSelectedOrder(null)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.1)", zIndex: 40 }}
              />
              <PODetailDrawer
                order={po.selectedOrder}
                inventoryCategoryNameLookup={inventoryCategoryNameLookup}
                inventoryCategoryDateTrackingLookup={inventoryCategoryDateTrackingLookup}
                onClose={() => po.setSelectedOrder(null)}
                onStatusChange={po.handlePOStatusChange}
                onEdit={(order) => { po.setEditingOrder(order); po.setSelectedOrder(null); }}
                onDelete={po.handlePODelete}
                onPrint={po.setPrintOrder}
              />
            </>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {po.printOrder && (
            <POPrintModal
              order={po.printOrder}
              onClose={() => po.setPrintOrder(null)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {po.receivingOrder && (
            <ReceivePOModal
              order={po.receivingOrder}
              loading={po.poLoading}
              currentStaffName={currentStaffDisplayName}
              inventoryCategoryNameLookup={inventoryCategoryNameLookup}
              inventoryCategoryDateTrackingLookup={inventoryCategoryDateTrackingLookup}
              onClose={() => po.setReceivingOrder(null)}
              onConfirm={po.handleConfirmReceivePO}
              onShowToast={showToast}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {(po.prefillPOProduct !== undefined || po.editingOrder) && (
            <CreatePOModal
              onClose={() => { po.setEditingOrder(null); po.handleClosePOModal(); }}
              onCreate={po.editingOrder ? po.handlePOUpdate : po.handlePOCreate}
              quickOrderProducts={po.poQuickOrderProducts}
              allProducts={products}
              allSuppliers={supplier.suppliers}
              prefillProduct={po.prefillPOProduct}
              initialOrder={po.editingOrder}
              stockAlertSettings={stockAlertSettings}
              onRefreshInventory={fetchAll}
              onShowToast={showToast}
              isMenuFoodProduct={isMenuFoodProduct}
              onAddSupplier={() => { po.setEditingOrder(null); po.handleClosePOModal(); setTab("suppliers"); supplier.setShowSupplierForm(true); }}
              onAddMaterial={() => { po.setEditingOrder(null); po.handleClosePOModal(); setShowRawMaterialForm(true); }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {supplier.editingSupplier && (
            <SupplierProductsModal
              supplier={supplier.editingSupplier}
              allProducts={products}
              loading={submitting}
              onClose={() => supplier.setEditingSupplier(null)}
              onSaveDetails={supplier.saveSupplierDetails}
              onRemoveProduct={supplier.handleRemoveSupplierProduct}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRawMaterialForm && (
            <AddMaterialModal
              rawMaterialForm={rawMaterialForm}
              setRawMaterialForm={setRawMaterialForm}
              activeInventoryCategoryOptions={activeInventoryCategoryOptions}
              activeInventoryUnitOptions={activeInventoryUnitOptions}
              materialNameMaxLength={MATERIAL_NAME_MAX_LENGTH}
              materialDescriptionMaxLength={MATERIAL_DESCRIPTION_MAX_LENGTH}
              defaultLowStockThreshold={stockAlertSettings.defaultLowStockThreshold}
              defaultCriticalStockThreshold={stockAlertSettings.defaultCriticalStockThreshold}
              submitting={submitting}
              mode={editingMaterial ? "edit" : "add"}
              onClose={() => { setShowRawMaterialForm(false); setEditingMaterial(null); setRawMaterialForm(BLANK_RAW_MATERIAL); }}
              onSave={editingMaterial ? saveEditedMaterial : addRawMaterial}
            />
          )}
        </AnimatePresence>

        {dashboard.dashboardSummary && dashboard.selectedSummaryConfig && (
          <DashboardSummaryModal
            open={dashboard.dashboardSummary !== null}
            title={dashboard.selectedSummaryConfig.title}
            subtitle={dashboard.selectedSummaryConfig.subtitle}
            totalLabel={dashboard.selectedSummaryConfig.totalLabel}
            totalValue={dashboard.selectedSummaryConfig.totalValue}
            rows={dashboard.selectedSummaryConfig.rows}
            emptyMessage={dashboard.selectedSummaryConfig.emptyMessage}
            onClose={dashboard.closeDashboardSummary}
          />
        )}
      </div>
    </>
  );
}