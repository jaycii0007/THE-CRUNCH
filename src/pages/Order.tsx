"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Clock,
  Bell,
  ClipboardList,
  XCircle,
  CheckCircle2,
  Utensils,
  Play,
  AlertCircle,
  CreditCard,
  Flame,
  PackageCheck,
  Ban,
  Minus,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import { Sidebar } from "@/components/Sidebar";
import { UserIdentityBanner } from "@/components/UserIdentityBanner";
import { useNotifications } from "@/lib/NotificationContext";
import { useViewport } from "@/hooks/use-tablet";
import { useEventInvalidation } from "@/hooks/use-event-invalidation";
import {
  fetchGeneralSettings,
  GENERAL_SETTINGS_DEFAULTS,
  formatInSettingsTimezone,
} from "@/lib/restaurantSettings";

// ─── FONT ─────────────────────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("dm-sans-font")) {
  const l = document.createElement("link");
  l.id = "dm-sans-font"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap";
  document.head.appendChild(l);
}
const F = "'DM Sans', sans-serif";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  canvas: "#F7F8FA",
  surface: "#FFFFFF",
  border: "#E7EAF0",
  borderSoft: "#EFF1F5",
  ink: "#0F172A",
  inkSoft: "#475569",
  body: "#374151",
  muted: "#94A3B8",
  mutedLight: "#CBD5E1",
  amber: "#D97706",
  amberBg: "#FFFBEB",
  amberBorder: "#FDE68A",
  red: "#DC2626",
  redBg: "#FEF2F2",
  redBorder: "#FECACA",
  green: "#059669",
  greenBg: "#ECFDF5",
  greenBorder: "#A7F3D0",
  slate: "#64748B",
  slateBg: "#F1F5F9",
} as const;

const shadowSm = "0 1px 2px rgba(15, 23, 42, 0.04)";
const shadowMd = "0 8px 24px rgba(15, 23, 42, 0.06)";

const isPaidOrderStatus = (value?: string | null) =>
  String(value || "").trim().toLowerCase() === "paid";
const normalizeWorkflowStatus = (value?: string | null) =>
  String(value || "").trim().toLowerCase();
const getSettlementAction = (
  currentStatus?: string | null,
  paymentStatus?: string | null,
) => {
  const normalizedStatus = normalizeWorkflowStatus(currentStatus);
  if (["refunded", "cancelled"].includes(normalizedStatus)) {
    return null;
  }
  if (normalizedStatus === "completed") {
    return isPaidOrderStatus(paymentStatus) ? "refund" : null;
  }
  if (
    normalizedStatus === "queued" ||
    normalizedStatus === "preparing" ||
    normalizedStatus === "ready" ||
    normalizedStatus === "ready for pickup"
  ) {
    return "refund";
  }
  if (normalizedStatus === "pending payment") {
    return "cancel";
  }
  return isPaidOrderStatus(paymentStatus) ? "refund" : "cancel";
};

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface OrderItem { quantity: number; name: string; }
interface OrderCard {
  id: string; orderNumber: string; tableNumber: number;
  status: "dine-in" | "take-out" | "delivery";
  orderType: "dine-in" | "take-out" | "delivery";
  isOnlinePickup?: boolean;
  items: OrderItem[]; isPreparing: boolean; isReady: boolean;
  isFinished: boolean; startedAt?: number;
  createdAt?: number;
  queuedAt?: number;
  prepStartedAt?: number;
  readyAt?: number;
  currentStatus?: string;
  paymentStatus?: string;
  estimatedPrepMinutes?: number;
  dueAt?: number;
  overdue?: boolean;
  timerUpdatedBy?: number | null;
  timerUpdatedAt?: number;
}

function isLocallyOverdue(order: OrderCard, nowMs: number): boolean {
  return (
    order.isPreparing === true &&
    order.isReady !== true &&
    typeof order.dueAt === "number" &&
    Number.isFinite(order.dueAt) &&
    nowMs >= order.dueAt
  );
}

function getCookDisplayOrders(orders: OrderCard[], nowMs: number): OrderCard[] {
  const overdueOrders: OrderCard[] = [];
  const remainingOrders: OrderCard[] = [];

  orders.forEach((order) => {
    if (isLocallyOverdue(order, nowMs)) {
      overdueOrders.push(order);
    } else {
      remainingOrders.push(order);
    }
  });

  overdueOrders.sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  return [...overdueOrders, ...remainingOrders];
}

interface OrderUpdateResponse {
  id: string | number;
  status: string;
  paymentStatus?: string;
  estimatedPrepMinutes?: number;
  prepStartedAt?: number;
  readyAt?: number;
  dueAt?: number;
  preparationStarted?: boolean;
  inventoryRestored?: boolean | null;
}
interface KitchenUsageItem {
  usage_item_id?: number;
  product_id: number | null;
  product_name: string;
  category: string;
  unit: string;
  withdrawn_qty: number;
  used_qty: number;
  spoilage_qty: number;
  returned_qty: number;
  note: string;
}
interface KitchenUsageReport {
  report_id: number;
  report_date: string;
  status: "pending" | "finalized";
  prepared_by: number | null;
  finalized_by: number | null;
  finalized_at: string | null;
  updated_at: string | null;
}
interface KitchenUsagePayload {
  report: KitchenUsageReport;
  items: KitchenUsageItem[];
}
const SHOW_LEGACY_USAGE_PANEL = false;
interface OrderStatusCounts {
  pendingPayment: number;
  queued: number;
  preparing: number;
  ready: number;
  completed: number;
  refunded: number;
}

interface UsageProductOption {
  product_id: number;
  product_name: string;
  category: string;
  unit: string;
  dailyWithdrawn: number;
  expiryDate?: string | null;
  usableUntil?: string | null;
  shelfLifeDays?: number | null;
  shelfLifeHours?: number | null;
}

const isTerminalOrderStatus = (value?: string | null) =>
  ["refunded", "cancelled"].includes(
    String(value || "").trim().toLowerCase(),
  );

function buildUsageItem(
  product: UsageProductOption,
  existing?: KitchenUsageItem,
): KitchenUsageItem {
  return {
    usage_item_id: existing?.usage_item_id,
    product_id: product.product_id,
    product_name: product.product_name,
    category: product.category,
    unit: product.unit,
    withdrawn_qty: product.dailyWithdrawn,
    used_qty: existing?.used_qty ?? 0,
    spoilage_qty: existing?.spoilage_qty ?? 0,
    returned_qty: existing?.returned_qty ?? 0,
    note: existing?.note ?? "",
  };
}

function syncUsageItems(
  products: UsageProductOption[],
  existingItems: KitchenUsageItem[],
): KitchenUsageItem[] {
  const existingByProductId = new Map(
    existingItems
      .filter((item) => Number.isFinite(Number(item.product_id)))
      .map((item) => [Number(item.product_id), item]),
  );

  return products
    .filter((product) => product.dailyWithdrawn > 0)
    .map((product) =>
      buildUsageItem(product, existingByProductId.get(product.product_id)),
    );
}

function getUsageTotals(item: KitchenUsageItem) {
  const reported = item.used_qty + item.spoilage_qty + item.returned_qty;
  const remaining = item.withdrawn_qty - reported;
  return {
    reported,
    remaining,
    invalid: reported > item.withdrawn_qty,
  };
}

function getUsageTimingState(product: UsageProductOption): {
  tone: "expired" | "warning";
  label: string;
} | null {
  const targetDate = product.usableUntil || product.expiryDate;
  if (!targetDate) return null;

  const targetMs = new Date(targetDate).getTime();
  if (!Number.isFinite(targetMs)) return null;

  const remainingMs = targetMs - Date.now();
  if (remainingMs <= 0) {
    return {
      tone: "expired",
      label: product.usableUntil ? "Past Shelf Life" : "Expired",
    };
  }

  if (remainingMs <= 24 * 60 * 60 * 1000) {
    return {
      tone: "warning",
      label: product.usableUntil ? "Near End of Shelf Life" : "Near Expiry",
    };
  }

  return null;
}

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = "sine";
      gain.gain.setValueAtTime(0.4, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.2);
    });
  } catch {}
}

// ─── TIMER ────────────────────────────────────────────────────────────────────
function OrderTimer({
  dueAt,
  baseAt,
  estimatedPrepMinutes,
  orderNumber,
}: {
  dueAt: number;
  baseAt: number;
  estimatedPrepMinutes: number;
  orderNumber: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  const notifiedRef = useRef(false);
  const soundRef = useRef(false);

  useEffect(() => {
    const iv = setInterval(() => {
      const s = Math.max(Math.floor((Date.now() - baseAt) / 1000), 0);
      setElapsed(s);
      if (Date.now() >= dueAt) {
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          if (Notification.permission === "granted")
            new Notification("Order overdue", { body: `${orderNumber} needs attention in the cook queue.`, icon: "/favicon.ico" });
        }
        if (!soundRef.current) { soundRef.current = true; playAlertSound(); }
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [baseAt, dueAt, orderNumber]);

  const totalSeconds = Math.max(estimatedPrepMinutes * 60, 60);
  const remaining = Math.floor((dueAt - Date.now()) / 1000);
  const overdue = remaining <= 0;
  const display = overdue ? Math.abs(remaining) : remaining;
  const mins = Math.floor(display / 60);
  const secs = display % 60;
  const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const progress = Math.min(elapsed / totalSeconds, 1);
  const warn = !overdue && elapsed > totalSeconds * 0.75;

  const tint = overdue ? C.red : warn ? C.amber : C.inkSoft;
  const tintBg = overdue ? C.redBg : warn ? C.amberBg : C.slateBg;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "6px 10px", borderRadius: 8, marginBottom: 6,
        background: tintBg, color: tint,
        fontSize: 12, fontWeight: 600, fontFamily: F, fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.01em",
      }}>
        {overdue ? <AlertCircle size={12} /> : <Clock size={12} />}
        {overdue ? `+${timeStr}` : timeStr}
      </div>
      <div style={{ height: 3, background: C.borderSoft, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress * 100}%`, borderRadius: 99, transition: "width 1s linear",
          background: overdue ? C.red : warn ? C.amber : C.mutedLight }} />
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Order() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [restaurantSettings, setRestaurantSettings] = useState(
    GENERAL_SETTINGS_DEFAULTS,
  );
  const [notifPermission, setNotifPermission] = useState(Notification.permission);
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [statusCounts, setStatusCounts] = useState<OrderStatusCounts>({
    pendingPayment: 0,
    queued: 0,
    preparing: 0,
    ready: 0,
    completed: 0,
    refunded: 0,
  });
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<{
    orderId: string;
    action: "start" | "complete";
  } | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageSaving, setUsageSaving] = useState(false);
  const [usageReport, setUsageReport] = useState<KitchenUsageReport | null>(null);
  const [usageItems, setUsageItems] = useState<KitchenUsageItem[]>([]);
  const [usageProducts, setUsageProducts] = useState<UsageProductOption[]>([]);
  const fetchAllInFlight = useRef<Promise<void> | null>(null);
  const { addNotification } = useNotifications();
  const { isMobile, isTablet } = useViewport();

  const fetchAll = useCallback(() => {
    if (fetchAllInFlight.current) return fetchAllInFlight.current;

    const request = (async () => {
      try {
        const [queue, all] = await Promise.all([
          api.get<OrderCard[]>("/orders/queue"),
          api.get<{ id?: number | string; orderId?: number | string; status: string }[]>("/orders"),
        ]);
        setOrders((queue ?? []).filter((o) => !o.isFinished));
        const nextCounts: OrderStatusCounts = {
          pendingPayment: 0,
          queued: 0,
          preparing: 0,
          ready: 0,
          completed: 0,
          refunded: 0,
        };
        for (const entry of all ?? []) {
          const status = String(entry.status || "").trim().toLowerCase();
          if (status === "pending payment") {
            nextCounts.pendingPayment += 1;
          } else if (status === "queued") {
            nextCounts.queued += 1;
          } else if (status === "preparing") {
            nextCounts.preparing += 1;
          } else if (status === "ready" || status === "ready for pickup") {
            nextCounts.ready += 1;
          } else if (status === "completed" || status === "picked up") {
            nextCounts.completed += 1;
          } else if (status === "refunded") {
            nextCounts.refunded += 1;
          }
        }
        setStatusCounts(nextCounts);
      } catch (error) {
        console.error(error);
      }
    })();
    fetchAllInFlight.current = request;
    void request.then(() => {
      if (fetchAllInFlight.current === request) {
        fetchAllInFlight.current = null;
      }
    });
    return request;
  }, []);

  const fetchAllAfterCurrentRequest = async () => {
    if (fetchAllInFlight.current) {
      await fetchAllInFlight.current;
    }
    await fetchAll();
  };

  const fetchUsage = async () => {
    try {
      setUsageLoading(true);
      const [data, inventory] = await Promise.all([
        api.get<KitchenUsagePayload>("/inventory/daily-usage?status=pending"),
        api.get<Array<Record<string, unknown>>>("/inventory"),
      ]);
      const nextProducts = (inventory ?? []).map((item) => ({
        product_id: Number(item.product_id ?? item.id ?? 0),
        product_name: String(item.product_name ?? item.name ?? ""),
        category: String(item.category ?? ""),
        unit: String(item.unit ?? "unit"),
        dailyWithdrawn: Number(item.dailyWithdrawn ?? 0),
        expiryDate: item.expiryDate ? String(item.expiryDate) : null,
        usableUntil: item.usableUntil ? String(item.usableUntil) : null,
        shelfLifeDays:
          item.shelfLifeDays === undefined || item.shelfLifeDays === null
            ? null
            : Number(item.shelfLifeDays),
        shelfLifeHours:
          item.shelfLifeHours === undefined || item.shelfLifeHours === null
            ? null
            : Number(item.shelfLifeHours),
      }));

      setUsageReport(data.report);
      setUsageProducts(nextProducts);
      setUsageItems(syncUsageItems(nextProducts, data.items ?? []));
    } catch (e) {
      console.error(e);
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => { void fetchAll(); }, [fetchAll]);
  useEventInvalidation({
    topics: ["orders.changed", "payments.changed"],
    onInvalidate: fetchAllAfterCurrentRequest,
  });
  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (SHOW_LEGACY_USAGE_PANEL) {
      void fetchUsage();
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    void fetchGeneralSettings().then((settings) => {
      if (!cancelled) {
        setRestaurantSettings(settings);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyConfirmedOrderUpdate = (update: OrderUpdateResponse) => {
    const normalizedStatus = normalizeWorkflowStatus(update.status);
    setOrders((current) => {
      if (["completed", "refunded", "cancelled"].includes(normalizedStatus)) {
        return current.filter((order) => order.id !== String(update.id));
      }
      return current.map((order) => {
        if (order.id !== String(update.id)) return order;
        return {
          ...order,
          currentStatus: update.status,
          paymentStatus: update.paymentStatus ?? order.paymentStatus,
          isPreparing: normalizedStatus === "preparing",
          isReady:
            normalizedStatus === "ready" ||
            normalizedStatus === "ready for pickup",
          isFinished: false,
          prepStartedAt: update.prepStartedAt ?? order.prepStartedAt,
          readyAt: update.readyAt ?? order.readyAt,
          dueAt: update.dueAt ?? order.dueAt,
          estimatedPrepMinutes:
            update.estimatedPrepMinutes ?? order.estimatedPrepMinutes,
        };
      });
    });
  };

  const reconcileAfterAction = (
    label: string,
    actionStartedAt: number,
    responseReceivedAt: number,
    localUpdateScheduledAt: number,
  ) => {
    const refetchStartedAt = performance.now();
    void fetchAllAfterCurrentRequest().then(() => {
      if (import.meta.env.DEV) {
        console.info("[TIMING CASHIER ACTION]", {
          action: label,
          responseMs: Number((responseReceivedAt - actionStartedAt).toFixed(1)),
          responseToLocalStateMs: Number(
            (localUpdateScheduledAt - responseReceivedAt).toFixed(1),
          ),
          reconciliationMs: Number((performance.now() - refetchStartedAt).toFixed(1)),
          totalMs: Number((performance.now() - actionStartedAt).toFixed(1)),
        });
      }
    });
  };

  const handleStart = async (id: string) => {
    if (processingAction?.orderId === id) return;
    const actionStartedAt = performance.now();
    setProcessingAction({ orderId: id, action: "start" });
    try {
      const update = await api.patch<OrderUpdateResponse>(`/orders/${id}`, {
        status: "preparing",
      });
      const responseReceivedAt = performance.now();
      applyConfirmedOrderUpdate(update);
      reconcileAfterAction(
        "start",
        actionStartedAt,
        responseReceivedAt,
        performance.now(),
      );
    } catch (error) {
      addNotification({
        id: crypto.randomUUID(),
        label:
          error instanceof Error
            ? error.message
            : "Failed to start order.",
        type: "error",
      });
    } finally {
      setProcessingAction(null);
    }
  };
  const handleReady = async (order: OrderCard) => {
    if (processingAction?.orderId === order.id) return;
    const effectiveOrderType = order.orderType || order.status;
    const actionStartedAt = performance.now();
    let latestConfirmedUpdate: OrderUpdateResponse | null = null;
    setProcessingAction({ orderId: order.id, action: "complete" });
    try {
      if (effectiveOrderType !== "delivery" && !order.isOnlinePickup) {
        latestConfirmedUpdate = await api.patch<OrderUpdateResponse>(
          `/orders/${order.id}`,
          { status: "Completed", completeFromPreparing: true },
        );
      } else {
        latestConfirmedUpdate = await api.patch<OrderUpdateResponse>(
          `/orders/${order.id}`,
          { status: "Ready for Pickup" },
        );
      }
      const responseReceivedAt = performance.now();
      applyConfirmedOrderUpdate(latestConfirmedUpdate);
      reconcileAfterAction(
        "complete",
        actionStartedAt,
        responseReceivedAt,
        performance.now(),
      );
    } catch (error) {
      if (latestConfirmedUpdate) {
        applyConfirmedOrderUpdate(latestConfirmedUpdate);
        void fetchAll();
      }
      addNotification({
        id: crypto.randomUUID(),
        label:
          error instanceof Error
            ? error.message
            : "Failed to complete order.",
        type: "error",
      });
    } finally {
      setProcessingAction(null);
    }
  };
  const handleSettlementAction = async (order: OrderCard) => {
    const action = getSettlementAction(order.currentStatus, order.paymentStatus);
    if (!action) return;
    setSettlingId(order.id);
    try {
      const update = await api.patch<OrderUpdateResponse>(`/orders/${order.id}`, {
        status: action === "refund" ? "Refunded" : "Cancelled",
      });
      applyConfirmedOrderUpdate(update);
      void fetchAll();
    } catch (error) {
      addNotification({
        id: crypto.randomUUID(),
        label:
          error instanceof Error
            ? error.message
            : "Failed to settle order.",
        type: "error",
      });
    } finally {
      setSettlingId(null);
    }
  };
  const userId = (() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  })();
  const handleTimerAdjust = async (order: OrderCard, deltaMinutes: number) => {
    const current = Math.max(order.estimatedPrepMinutes ?? 10, 1);
    const next = Math.max(current + deltaMinutes, 1);
    try {
      await api.patch(`/orders/${order.id}`, {
        estimatedPrepMinutes: next,
        timerUpdatedBy: userId,
      });
      fetchAll();
    } catch (error) {
      console.error("Failed to update cook timer:", error);
    }
  };
  const updateUsageItem = (
    index: number,
    field: "used_qty" | "spoilage_qty" | "returned_qty" | "note",
    value: string,
  ) => {
    setUsageItems((prev) => prev.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (field === "note") {
        return { ...item, [field]: value };
      }
      return { ...item, [field]: Math.max(0, Number(value) || 0) };
    }));
  };
  const saveUsage = async () => {
    try {
      setUsageSaving(true);
      const data = await api.post<KitchenUsagePayload>("/inventory/daily-usage", {
        report_date: usageReport?.report_date,
        created_by: userId,
        items: usageItems.map((item) => ({
          product_id: item.product_id,
          used_qty: item.used_qty,
          spoilage_qty: item.spoilage_qty,
          returned_qty: item.returned_qty,
          note: item.note,
        })),
      });
      setUsageReport(data.report);
      addNotification({
        id: crypto.randomUUID(),
        label: "Report submitted for review.",
        type: "success",
      });
      await fetchUsage();
    } catch (e) {
      console.error(e);
      addNotification({
        id: crypto.randomUUID(),
        label:
          e instanceof Error
            ? `Failed to save daily usage report: ${e.message}`
            : "Failed to save daily usage report.",
        type: "error",
      });
    } finally {
      setUsageSaving(false);
    }
  };

  const fmt = (d: Date) => {
    return formatInSettingsTimezone(d, restaurantSettings, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };
  const fmtDate = (d: Date) => {
    return formatInSettingsTimezone(d, restaurantSettings, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const STATUS_LABEL: Record<string, string> = { "dine-in": "Dine In", "take-out": "Take Out", "delivery": "Delivery" };
  const usageHasErrors = usageItems.some((item) => getUsageTotals(item).invalid);
  const usageInputDisabled = usageReport?.status === "finalized";
  const usageSubmitDisabled =
    usageSaving || usageInputDisabled || usageHasErrors || usageItems.length === 0;

  const renderUsageForm = () => {
    if (usageLoading) {
      return <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Loading report...</p>;
    }

    if (usageItems.length === 0) {
      return (
        <div style={{ border: `1px dashed ${C.border}`, borderRadius: 14, padding: 20, textAlign: "center", color: C.muted, fontSize: 12 }}>
          No kitchen stock has been withdrawn yet for today.
        </div>
      );
    }

    return (
      <>
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: C.inkSoft, margin: 0 }}>
            Enter today&apos;s actual used, wasted, and returned quantities for each withdrawn stock item.
          </p>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {usageItems.map((item, index) => {
            const product = usageProducts.find((entry) => entry.product_id === item.product_id);
            const timingState = product ? getUsageTimingState(product) : null;
            const { remaining, invalid } = getUsageTotals(item);
            const cardBorderColor =
              timingState?.tone === "expired"
                ? C.redBorder
                : timingState?.tone === "warning"
                  ? C.amberBorder
                  : C.border;
            const cardBackground =
              timingState?.tone === "expired"
                ? "#fff7f7"
                : timingState?.tone === "warning"
                  ? "#fffdf5"
                  : "#fcfcfc";
            const chipBackground =
              timingState?.tone === "expired" ? C.redBg : C.amberBg;
            const chipColor =
              timingState?.tone === "expired" ? "#b91c1c" : "#b45309";

            return (
              <div
                key={item.usage_item_id ?? item.product_id ?? `usage-${index}`}
                style={{
                  border: `1px solid ${cardBorderColor}`,
                  borderRadius: 16,
                  padding: 14,
                  background: cardBackground,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
                      {item.product_name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: C.inkSoft }}>{item.category}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>•</span>
                      <span style={{ fontSize: 11, color: C.inkSoft }}>{item.unit}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <div style={{ borderRadius: 999, background: C.slateBg, color: C.body, fontSize: 11, fontWeight: 600, padding: "6px 10px" }}>
                      Withdrawn: {item.withdrawn_qty} {item.unit}
                    </div>
                    {timingState && (
                      <div style={{ borderRadius: 999, background: chipBackground, color: chipColor, fontSize: 11, fontWeight: 700, padding: "6px 10px" }}>
                        {timingState.label}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Used</div>
                    <input type="number" min="0" step="0.01" value={item.used_qty === 0 ? "" : item.used_qty} onChange={(e) => updateUsageItem(index, "used_qty", e.target.value)} placeholder="0" disabled={usageInputDisabled} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: F, outline: "none", background: usageInputDisabled ? "#f8fafc" : "#fff" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Wasted</div>
                    <input type="number" min="0" step="0.01" value={item.spoilage_qty === 0 ? "" : item.spoilage_qty} onChange={(e) => updateUsageItem(index, "spoilage_qty", e.target.value)} placeholder="0" disabled={usageInputDisabled} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: F, outline: "none", background: usageInputDisabled ? "#f8fafc" : "#fff" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Returned</div>
                    <input type="number" min="0" step="0.01" value={item.returned_qty === 0 ? "" : item.returned_qty} onChange={(e) => updateUsageItem(index, "returned_qty", e.target.value)} placeholder="0" disabled={usageInputDisabled} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: F, outline: "none", background: usageInputDisabled ? "#f8fafc" : "#fff" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Remaining</div>
                    <div style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${invalid ? C.redBorder : C.border}`, fontSize: 12, fontFamily: F, background: invalid ? C.redBg : "#f8fafc", color: invalid ? "#b91c1c" : C.ink, fontWeight: 600 }}>
                      {remaining} {item.unit}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: invalid ? 8 : 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes</div>
                  <input value={item.note} onChange={(e) => updateUsageItem(index, "note", e.target.value)} placeholder="Optional notes for this item" disabled={usageInputDisabled} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: F, outline: "none", background: usageInputDisabled ? "#f8fafc" : "#fff" }} />
                </div>

                {invalid && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>
                    Total reported quantity cannot be greater than withdrawn stock.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button onClick={() => { void saveUsage(); }} disabled={usageSubmitDisabled} style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.ink}`, background: usageSubmitDisabled ? C.muted : C.ink, color: "#fff", fontSize: 12, fontWeight: 600, cursor: usageSubmitDisabled ? "not-allowed" : "pointer", fontFamily: F }}>
            {usageSaving ? "Submitting..." : "Submit for Review"}
          </button>
        </div>
      </>
    );
  };

  const statCards: Array<{
    label: string;
    val: number;
    icon: typeof CreditCard;
    tint: string;
    tintBg: string;
    dim?: boolean;
  }> = [
    { label: "Pending Payment", val: statusCounts.pendingPayment, icon: CreditCard, tint: C.slate, tintBg: C.slateBg },
    { label: "Queued", val: statusCounts.queued, icon: ClipboardList, tint: C.slate, tintBg: C.slateBg },
    { label: "Preparing", val: statusCounts.preparing, icon: Flame, tint: C.amber, tintBg: C.amberBg },
    { label: "Ready", val: statusCounts.ready, icon: PackageCheck, tint: C.green, tintBg: C.greenBg },
    { label: "Completed", val: statusCounts.completed, icon: CheckCircle2, tint: C.muted, tintBg: C.borderSoft, dim: true },
    { label: "Refunded", val: statusCounts.refunded, icon: Ban, tint: C.muted, tintBg: C.borderSoft, dim: true },
  ];
  const nowMs = currentTime.getTime();
  const displayOrders = getCookDisplayOrders(orders, nowMs);

  return (
    <div style={{ minHeight: "100vh", background: C.canvas, fontFamily: F }}>
      <Sidebar />

      <div style={{ paddingLeft: isTablet ? 0 : 96, paddingTop: isMobile ? 72 : isTablet ? 76 : 0 }}>

        {/* ── Header ── */}
        <div style={{ padding: isMobile ? "18px 14px 0" : isTablet ? "22px 18px 0" : "30px 32px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>

          {/* Left: brand + clock */}
          <div style={{ display: "flex", alignItems: isTablet ? "flex-start" : "center", flexDirection: isTablet ? "column" : "row", gap: isTablet ? 10 : 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 9, background: C.ink,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <ClipboardList size={14} color="#fff" />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>Orders</span>
            </div>
            {!isTablet && <div style={{ width: 1, height: 26, background: C.border }} />}
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{fmt(currentTime)}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{fmtDate(currentTime)}</div>
            </div>
          </div>

          <UserIdentityBanner
            className="order-3 w-full sm:order-2 sm:w-auto"
          />

          {/* Right: stats */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: isTablet ? "100%" : "auto" }}>
            {statCards.map(({ label, val, icon: Icon, tint, tintBg, dim }) => (
              <div key={label} style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
                padding: "10px 16px", minWidth: 92, flex: isTablet ? "1 1 120px" : "0 0 auto",
                display: "flex", alignItems: "center", gap: 10, boxShadow: shadowSm,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 9, background: tintBg,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={13} color={dim ? C.muted : tint} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: dim ? C.mutedLight : C.ink, lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 10, fontWeight: 500, color: C.muted, marginTop: 3, whiteSpace: "nowrap" }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Notification banner ── */}
        {notifPermission !== "granted" && (
          <div style={{ padding: isMobile ? "14px 14px 0" : isTablet ? "14px 18px 0" : "16px 32px 0" }}>
            <button onClick={() => Notification.requestPermission().then(setNotifPermission)}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, background: C.surface,
                border: `1px solid ${C.border}`, color: C.inkSoft, padding: "9px 14px", borderRadius: 11,
                cursor: "pointer", fontFamily: F, boxShadow: shadowSm, fontWeight: 500 }}>
              <Bell size={13} color={C.amber} /> Enable notifications for order updates
            </button>
          </div>
        )}

        {/* ── Legacy usage panel (feature-flagged) ── */}
        {SHOW_LEGACY_USAGE_PANEL && (
          <div style={{ padding: isMobile ? "18px 14px 0" : isTablet ? "18px 18px 0" : "18px 32px 0" }}>
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: shadowSm }}>
              <button
                onClick={() => setUsageOpen((v) => !v)}
                style={{ width: "100%", background: "transparent", border: "none", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: F }}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Daily Usage Report</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                    {usageReport ? `Status: ${usageReport.status}` : "Preparing today's kitchen usage sheet"}
                  </div>
                </div>
                <motion.div animate={{ rotate: usageOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <AlertCircle size={14} color={C.muted} />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {usageOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: "hidden", borderTop: `1px solid ${C.borderSoft}` }}
                  >
                    <div style={{ padding: 16 }}>
                      {renderUsageForm()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}

        <div style={{ padding: isMobile ? "20px 14px 28px" : isTablet ? "22px 18px 32px" : "26px 32px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Active Orders</span>
            {orders.length > 0 && (
              <span style={{ background: C.slateBg, color: C.inkSoft, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
                {orders.length}
              </span>
            )}
          </div>

          {orders.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: "88px 0", gap: 12, background: C.surface, borderRadius: 20, border: `1px dashed ${C.border}` }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: C.slateBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Utensils size={22} color={C.mutedLight} />
              </div>
              <p style={{ fontSize: 13, color: C.muted, margin: 0, fontWeight: 500 }}>No pending orders</p>
              <p style={{ fontSize: 12, color: C.mutedLight, margin: 0 }}>New orders will appear here as they come in.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(224px, 1fr))", gap: 14 }}>
              <AnimatePresence mode="popLayout">
                {displayOrders.map((order) => {
                  const isNew = !order.isPreparing && !order.isReady;
                  const isPrep = order.isPreparing && !order.isReady;
                  const isReady = order.isReady;
                  const locallyOverdue = isLocallyOverdue(order, nowMs);
                  const settlementAction = getSettlementAction(
                    order.currentStatus,
                    order.paymentStatus,
                  );
                  const isSettling = settlingId === order.id;
                  const pendingAction =
                    processingAction?.orderId === order.id
                      ? processingAction.action
                      : null;
                  const isActionPending = pendingAction !== null;
                  const isTerminal = isTerminalOrderStatus(order.currentStatus);
                  const settlementLocked = isSettling || isActionPending || isTerminal;
                  const timerEditable = isNew || isPrep;
                  const timerBase = order.prepStartedAt;
                  const estimatedPrepMinutes = Math.max(order.estimatedPrepMinutes ?? 10, 1);

                  const accent = locallyOverdue ? C.red : isReady ? C.green : isPrep ? C.amber : C.mutedLight;

                  return (
                    <motion.div
                      key={order.id} layout
                      initial={{ opacity: 0, y: 12, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 320, damping: 28 } }}
                      exit={{ opacity: 0, scale: 0.94, y: -8, transition: { duration: 0.22 } }}
                      whileHover={{ y: -2, transition: { duration: 0.12 } }}
                      style={{
                        background: C.surface, borderRadius: 18,
                        border: `1px solid ${locallyOverdue ? C.redBorder : C.border}`,
                        overflow: "hidden", display: "flex", flexDirection: "column",
                        boxShadow: shadowMd,
                      }}
                    >
                      {/* Status accent bar */}
                      <div style={{ height: 3, background: accent }} />

                      <div style={{ padding: "16px 16px 14px", flex: 1, display: "flex", flexDirection: "column" }}>

                        {/* Order number + type */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>{order.orderNumber}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: C.inkSoft, background: C.slateBg,
                            padding: "3px 9px", borderRadius: 99 }}>
                            {STATUS_LABEL[order.status] ?? order.status}
                          </span>
                        </div>

                        {/* Timer */}
                        {isPrep && timerBase && order.dueAt && (
                          <OrderTimer
                            baseAt={timerBase}
                            dueAt={order.dueAt}
                            estimatedPrepMinutes={estimatedPrepMinutes}
                            orderNumber={order.orderNumber}
                          />
                        )}

                        {locallyOverdue && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            padding: "6px 10px", borderRadius: 8, marginBottom: 10,
                            background: C.redBg, color: C.red, fontSize: 11, fontWeight: 700 }}>
                            <AlertCircle size={12} /> Overdue
                          </div>
                        )}

                        {timerEditable && (
                          <div style={{ marginBottom: 12, background: C.canvas, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                Prep Timer
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>
                                {estimatedPrepMinutes} min
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={() => handleTimerAdjust(order, -1)}
                                style={{
                                  flex: 1, padding: "7px 0", borderRadius: 9, border: `1px solid ${C.border}`,
                                  background: C.surface, color: C.body, fontSize: 11, fontWeight: 600,
                                  cursor: "pointer", fontFamily: F,
                                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                                }}>
                                <Minus size={11} /> 1 min
                              </button>
                              <button
                                onClick={() => handleTimerAdjust(order, 1)}
                                style={{
                                  flex: 1, padding: "7px 0", borderRadius: 9, border: `1px solid ${C.border}`,
                                  background: C.surface, color: C.body, fontSize: 11, fontWeight: 600,
                                  cursor: "pointer", fontFamily: F,
                                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                                }}>
                                <Plus size={11} /> 1 min
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Ready badge */}
                        {isReady && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            padding: "6px 10px", borderRadius: 8, marginBottom: 10,
                            background: C.greenBg, color: C.green, fontSize: 11, fontWeight: 700 }}>
                            <CheckCircle2 size={12} /> {order.isOnlinePickup ? "Ready for Pickup" : "Ready to serve"}
                          </div>
                        )}

                        {/* Items */}
                        <div style={{ flex: 1, marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.borderSoft}` }}>
                          {order.items.map((item, i) => (
                            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "baseline" }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: C.ink, minWidth: 20 }}>{item.quantity}×</span>
                              <span style={{ fontSize: 12, color: C.inkSoft, flex: 1 }}>{item.name}</span>
                            </div>
                          ))}
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            {/* Start */}
                            <button onClick={() => isNew && !isActionPending && handleStart(order.id)} disabled={!isNew || isActionPending}
                              style={{
                                flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 11, fontWeight: 600,
                                cursor: isNew && !isActionPending ? "pointer" : "not-allowed", fontFamily: F,
                                border: "1px solid",
                                borderColor: isNew && !isActionPending ? C.ink : C.borderSoft,
                                background: isNew && !isActionPending ? C.ink : C.canvas,
                                color: isNew && !isActionPending ? "#fff" : C.mutedLight,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                                transition: "all 0.12s",
                              }}>
                              <Play size={10} /> {pendingAction === "start" ? "Starting..." : "Start"}
                            </button>

                            {/* Ready / Served */}
                            {!isReady ? (
                              <button onClick={() => isPrep && !isActionPending && handleReady(order)} disabled={!isPrep || isActionPending}
                                style={{
                                  flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 11, fontWeight: 600,
                                  cursor: isPrep && !isActionPending ? "pointer" : "not-allowed", fontFamily: F,
                                  border: "1px solid",
                                  borderColor: isPrep && !isActionPending ? C.green : C.borderSoft,
                                  background: isPrep && !isActionPending ? C.greenBg : C.canvas,
                                  color: isPrep && !isActionPending ? C.green : C.mutedLight,
                                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                                  transition: "all 0.12s",
                                }}>
                                {pendingAction !== "complete" && <CheckCircle2 size={10} />}
                                {pendingAction === "complete"
                                  ? "Completing..."
                                  : ((order.orderType || order.status) === "delivery") || order.isOnlinePickup
                                  ? "Ready for Pickup"
                                  : "Complete"}
                              </button>
                            ) : (order.orderType || order.status) === "delivery" ? (
                              <button
                                disabled
                                style={{
                                  flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 11, fontWeight: 600,
                                  cursor: "not-allowed", fontFamily: F,
                                  border: `1px solid ${C.borderSoft}`, background: C.canvas, color: C.mutedLight,
                                  transition: "all 0.12s",
                                }}>
                                Awaiting Cashier
                              </button>
                            ) : null}
                          </div>

                          {/* Cancel / Refund */}
                          {settlementAction && (
                          <button onClick={() => !settlementLocked && handleSettlementAction(order)}
                            disabled={settlementLocked}
                            style={{
                              width: "100%", padding: "7px 0", borderRadius: 10, fontSize: 11, fontWeight: 600,
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                              cursor: settlementLocked ? "not-allowed" : "pointer", fontFamily: F,
                              border: "1px solid",
                              borderColor: settlementLocked ? C.borderSoft : "transparent",
                              background: "transparent",
                              color: settlementLocked ? C.mutedLight : C.red,
                              transition: "all 0.12s",
                            }}>
                            <XCircle size={11} />
                            {isSettling
                              ? settlementAction === "refund"
                                ? "Refunding..."
                                : "Cancelling..."
                              : settlementAction === "refund"
                                ? "Refund Order"
                                : "Cancel Order"}
                          </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
