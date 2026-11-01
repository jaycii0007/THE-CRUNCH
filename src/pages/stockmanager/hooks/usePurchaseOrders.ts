import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { api } from "../services/api";
import type { POStatus, Product, PurchaseOrder, Supplier } from "../types/inventory";
import { isDateInRange } from "../utils/dateUtils";
import { mergeSupplierProducts } from "../utils/supplierUtils";

const PO_HISTORY_PAGE_SIZE = 10;

type ToastFn = (message: string, type: "success" | "error") => void;
type NotifyFn = (notification: {
  id: string;
  label: string;
  type: "success" | "error";
}) => void;
export type POPrefillProduct =
  | { productId: number; name: string; category: string; unit: string; supplier: string }
  | null
  | undefined;

type UsePurchaseOrdersParams = {
  enabled: boolean;
  criticalStock: Product[];
  lowStock: Product[];
  suppliers: Supplier[];
  setSuppliers: Dispatch<SetStateAction<Supplier[]>>;
  refreshInventory: () => Promise<void>;
  showToast: ToastFn;
  addNotification: NotifyFn;
};

export function usePurchaseOrders({
  enabled,
  criticalStock,
  lowStock,
  suppliers,
  setSuppliers,
  refreshInventory,
  showToast,
  addNotification,
}: UsePurchaseOrdersParams) {
  const [poOrders, setPoOrders] = useState<PurchaseOrder[]>([]);
  const [poLoaded, setPoLoaded] = useState(false);
  const poLoadStarted = useRef(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(
    null,
  );
  const [printOrder, setPrintOrder] = useState<PurchaseOrder | null>(null);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(
    null,
  );
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [poLoading, setPoLoading] = useState(false);
  const [poError, setPoError] = useState<string | null>(null);
  const [poHistoryDateFrom, setPoHistoryDateFrom] = useState("");
  const [poHistoryDateTo, setPoHistoryDateTo] = useState("");
  const [poHistoryStatus, setPoHistoryStatus] = useState<"All" | "Received" | "Cancelled">("All");
  const [poHistoryPage, setPoHistoryPage] = useState(1);
  const poHistoryFromInputRef = useRef<HTMLInputElement | null>(null);
  const poHistoryToInputRef = useRef<HTMLInputElement | null>(null);
  const [prefillPOProduct, setPrefillPOProduct] =
    useState<POPrefillProduct>(undefined);

  const fetchPurchaseOrders = useCallback(async () => {
    setPoLoading(true);
    setPoError(null);
    try {
      const orders = await api.po.getAll();
      setPoOrders(orders);
      setPoLoaded(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load purchase orders.";
      setPoError(message);
      showToast(
        message,
        "error",
      );
    } finally {
      setPoLoading(false);
    }
  }, [showToast]);

  const handleOrderNow = useCallback((product: Product) => {
    setPrefillPOProduct({
      productId: product.product_id,
      name: product.product_name,
      category: product.category,
      unit: product.unit,
      supplier: product.supplier_name ?? "",
    });
  }, []);

  const handleClosePOModal = useCallback(() => {
    setPrefillPOProduct(undefined);
  }, []);

  const poQuickOrderProducts = useMemo(() => {
    const m = new Map<number, Product>();
    [...criticalStock, ...lowStock].forEach((p) => {
      if (!m.has(p.product_id)) m.set(p.product_id, p);
    });
    return Array.from(m.values());
  }, [criticalStock, lowStock]);

  const filteredPOs = useMemo(
    () => poOrders.filter((o) => o.status !== "Received" && o.status !== "Cancelled"),
    [poOrders],
  );
  const completedPOs = useMemo(
    () => poOrders.filter((o) => o.status === "Received" || o.status === "Cancelled"),
    [poOrders],
  );
  const filteredCompletedPOs = useMemo(
    () =>
      completedPOs.filter((o) =>
        (poHistoryStatus === "All" || o.status === poHistoryStatus) &&
        isDateInRange(
          o.receivedDate ?? o.date,
          poHistoryDateFrom,
          poHistoryDateTo,
        ),
      ),
    [completedPOs, poHistoryDateFrom, poHistoryDateTo, poHistoryStatus],
  );
  const poHistoryTotalPages = Math.max(
    1,
    Math.ceil(filteredCompletedPOs.length / PO_HISTORY_PAGE_SIZE),
  );
  const paginatedCompletedPOs = useMemo(() => {
    const start = (poHistoryPage - 1) * PO_HISTORY_PAGE_SIZE;
    return filteredCompletedPOs.slice(start, start + PO_HISTORY_PAGE_SIZE);
  }, [filteredCompletedPOs, poHistoryPage]);

  useEffect(() => {
    if (!enabled || poLoaded || poLoadStarted.current) return;
    poLoadStarted.current = true;
    void fetchPurchaseOrders();
  }, [enabled, poLoaded, fetchPurchaseOrders]);

  useEffect(() => {
    setPoHistoryPage(1);
  }, [poHistoryDateFrom, poHistoryDateTo, poHistoryStatus]);

  useEffect(() => {
    setPoHistoryPage((current) => Math.min(current, poHistoryTotalPages));
  }, [poHistoryTotalPages]);

  const handlePOStatusChange = useCallback(
    async (id: string, status: POStatus) => {
      if (status === "Received") {
        const order = poOrders.find((o) => o.id === id);
        if (!order) {
          showToast("Purchase order not found.", "error");
          return;
        }
        setReceivingOrder(order);
        setSelectedOrder(null);
        return;
      }
      setPoLoading(true);
      try {
        const updated = await api.po.updateStatus(id, status);
        setPoOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
        setSelectedOrder((prev) => (prev?.id === id ? updated : prev));
        showToast(`Purchase order moved to ${status}.`, "success");
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : "Failed to update purchase order status.",
          "error",
        );
      } finally {
        setPoLoading(false);
      }
    },
    [poOrders, showToast],
  );

  const handlePODelete = useCallback(
    async (id: string) => {
      setPoLoading(true);
      try {
        await api.po.delete(id);
        setPoOrders((prev) =>
          prev.map((o) =>
            o.id === id ? { ...o, status: "Cancelled" as POStatus } : o,
          ),
        );
        setSelectedOrder((prev) =>
          prev?.id === id ? { ...prev, status: "Cancelled" as POStatus } : prev,
        );
        showToast("Purchase order cancelled.", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to cancel order.",
          "error",
        );
      } finally {
        setPoLoading(false);
      }
    },
    [showToast],
  );

  const handleConfirmReceivePO = useCallback(
    async ({
      receiptNo,
      receivedBy,
      receivedDate,
      itemExpiryDates,
      itemShelfLife,
    }: {
      receiptNo: string;
      receivedBy: string;
      receivedDate: string;
      itemExpiryDates: Record<number, string>;
      itemShelfLife: Record<
        number,
        { shelfLifeDays?: number | null; shelfLifeHours?: number | null }
      >;
    }) => {
      if (!receivingOrder) return;
      setPoLoading(true);
      try {
        const updated = await api.po.markReceived(
          receivingOrder.id,
          receiptNo,
          receivedBy,
          receivedDate,
          itemExpiryDates,
          itemShelfLife,
        );
        setPoOrders((prev) =>
          prev.map((o) => (o.id === receivingOrder.id ? updated : o)),
        );
        setSelectedOrder((prev) =>
          prev?.id === receivingOrder.id ? updated : prev,
        );
        setReceivingOrder(null);
        await refreshInventory();
        showToast(
          "Purchase order received and stock batches added.",
          "success",
        );
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : "Failed to receive purchase order.",
          "error",
        );
      } finally {
        setPoLoading(false);
      }
    },
    [receivingOrder, refreshInventory, showToast],
  );

  const handlePOCreate = useCallback(
    async (
      po: Omit<PurchaseOrder, "id">,
      meta: { supplierId: number; itemNames: string[] },
    ) => {
      setPoLoading(true);
      try {
        const created = await api.po.create(po);
        setPoOrders((prev) => [created, ...prev]);
        const matchedSupplier = suppliers.find(
          (s) => s.supplier_id === meta.supplierId,
        );

        if (matchedSupplier) {
          const incomingNames = meta.itemNames;

          if (incomingNames.length > 0) {
            setSuppliers((prev) =>
              prev.map((s) =>
                s.supplier_id === matchedSupplier.supplier_id
                  ? {
                      ...s,
                      products_supplied: mergeSupplierProducts(
                        s.products_supplied ?? "",
                        incomingNames,
                      ),
                    }
                  : s,
              ),
            );
          }

          try {
            if (incomingNames.length > 0) {
              await api.mergeSupplierProducts(
                matchedSupplier.supplier_id,
                incomingNames,
              );
            }

            const refreshedSuppliers = await api.getSuppliers();
            setSuppliers(refreshedSuppliers);
          } catch (mergeErr) {
            console.error("Failed to merge supplier products:", mergeErr);
            showToast(
              "Purchase order saved, but supplier products did not sync.",
              "error",
            );
          }
        }

        showToast(
          "Purchase order created. Open it from Active Purchase Orders when it is ready to receive; stock changes only after receipt.",
          "success",
        );

        // Notify admin of new purchase order
        addNotification({
          id: crypto.randomUUID(),
          label: `New purchase order submitted: ${created.id}`,
          type: "success",
        });
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : "Failed to create purchase order.",
          "error",
        );
        throw err;
      } finally {
        setPoLoading(false);
      }
    },
    [addNotification, showToast, suppliers, setSuppliers],
  );

  const handlePOUpdate = useCallback(
    async (
      draft: Omit<PurchaseOrder, "id">,
      meta: { supplierId: number; itemNames: string[] },
    ) => {
      if (!editingOrder || editingOrder.status !== "Draft") {
        throw new Error("Only draft purchase orders can be edited.");
      }
      setPoLoading(true);
      try {
        void meta;
        const editableDraft = {
          supplier: draft.supplier,
          contact: draft.contact,
          date: draft.date,
          deliveryDate: draft.deliveryDate,
          notes: draft.notes,
          items: draft.items,
        };
        const updated = await api.po.updateDraft(editingOrder.id, editableDraft);
        setPoOrders((current) =>
          current.map((order) => (order.id === updated.id ? updated : order)),
        );
        setSelectedOrder(updated);
        setEditingOrder(null);
        showToast("Purchase order draft updated.", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to update purchase order.",
          "error",
        );
        throw err;
      } finally {
        setPoLoading(false);
      }
    },
    [editingOrder, showToast],
  );

  return {
    poOrders,
    poLoaded,
    selectedOrder,
    printOrder,
    receivingOrder,
    editingOrder,
    poLoading,
    poError,
    poHistoryDateFrom,
    poHistoryDateTo,
    poHistoryStatus,
    poHistoryPage,
    poHistoryFromInputRef,
    poHistoryToInputRef,
    prefillPOProduct,
    poQuickOrderProducts,
    filteredPOs,
    completedPOs,
    filteredCompletedPOs,
    paginatedCompletedPOs,
    poHistoryTotalPages,
    poHistoryPageSize: PO_HISTORY_PAGE_SIZE,
    fetchPurchaseOrders,
    handleOrderNow,
    handleClosePOModal,
    handlePOStatusChange,
    handlePODelete,
    handleConfirmReceivePO,
    handlePOCreate,
    handlePOUpdate,
    setSelectedOrder,
    setPrintOrder,
    setReceivingOrder,
    setEditingOrder,
    setPoHistoryDateFrom,
    setPoHistoryDateTo,
    setPoHistoryStatus,
    setPoHistoryPage,
    setPrefillPOProduct,
  };
}
