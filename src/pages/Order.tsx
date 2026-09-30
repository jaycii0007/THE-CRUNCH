"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Ban,
  Bell,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Clock,
  CreditCard,
  Flame,
  Minus,
  PackageCheck,
  Play,
  Plus,
  Utensils,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";
import { Sidebar } from "@/components/Sidebar";
import { UserIdentityBanner } from "@/components/UserIdentityBanner";
import { useNotifications } from "@/lib/NotificationContext";
import { useViewport } from "@/hooks/use-tablet";
import { useEventInvalidation } from "@/hooks/use-event-invalidation";
import {
  fetchGeneralSettings,
  formatInSettingsTimezone,
  GENERAL_SETTINGS_DEFAULTS,
} from "@/lib/restaurantSettings";

/* -------------------------------------------------------------------------- */
/*                                    Font                                    */
/* -------------------------------------------------------------------------- */

if (typeof document !== "undefined" && !document.getElementById("dm-sans-font")) {
  const link = document.createElement("link");
  link.id = "dm-sans-font";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

type OrderType = "dine-in" | "take-out" | "delivery";
type Stage = "new" | "preparing" | "ready";
type SettlementAction = "refund" | "cancel" | null;

interface OrderItem {
  quantity: number;
  name: string;
}

interface OrderCard {
  id: string;
  orderNumber: string;
  status: OrderType;
  orderType: OrderType;
  isOnlinePickup?: boolean;
  items: OrderItem[];
  isPreparing: boolean;
  isReady: boolean;
  isFinished: boolean;
  currentStatus?: string;
  paymentStatus?: string;
  estimatedPrepMinutes?: number;
  prepStartedAt?: number;
  readyAt?: number;
  dueAt?: number;
}

interface OrderUpdateResponse {
  id: string | number;
  status: string;
  paymentStatus?: string;
  estimatedPrepMinutes?: number;
  prepStartedAt?: number;
  readyAt?: number;
  dueAt?: number;
}

interface OrderStatusCounts {
  pendingPayment: number;
  queued: number;
  preparing: number;
  ready: number;
  completed: number;
  refunded: number;
}

type PendingAction = { orderId: string; action: "start" | "complete" } | null;

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

const EMPTY_COUNTS: OrderStatusCounts = {
  pendingPayment: 0,
  queued: 0,
  preparing: 0,
  ready: 0,
  completed: 0,
  refunded: 0,
};

const STATUS_TO_COUNT: Record<string, keyof OrderStatusCounts> = {
  "pending payment": "pendingPayment",
  queued: "queued",
  preparing: "preparing",
  ready: "ready",
  "ready for pickup": "ready",
  completed: "completed",
  "picked up": "completed",
  refunded: "refunded",
};

const STATS: { key: keyof OrderStatusCounts; label: string; icon: LucideIcon; tone: string }[] = [
  { key: "pendingPayment", label: "Pending payment", icon: CreditCard, tone: "bg-slate-100 text-slate-600" },
  { key: "queued", label: "Queued", icon: ClipboardList, tone: "bg-slate-100 text-slate-600" },
  { key: "preparing", label: "Preparing", icon: Flame, tone: "bg-amber-50 text-amber-600" },
  { key: "ready", label: "Ready", icon: PackageCheck, tone: "bg-emerald-50 text-emerald-600" },
  { key: "completed", label: "Completed", icon: CheckCircle2, tone: "bg-slate-100 text-slate-400" },
  { key: "refunded", label: "Refunded", icon: Ban, tone: "bg-slate-100 text-slate-400" },
];

const COLUMNS: { stage: Stage; title: string; icon: LucideIcon; accent: string; badge: string; empty: string }[] = [
  { stage: "new", title: "New orders", icon: ClipboardList, accent: "bg-slate-400", badge: "bg-slate-100 text-slate-600", empty: "No new orders" },
  { stage: "preparing", title: "In preparation", icon: Flame, accent: "bg-amber-500", badge: "bg-amber-100 text-amber-700", empty: "Nothing on the line" },
  { stage: "ready", title: "Ready", icon: PackageCheck, accent: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700", empty: "Nothing waiting" },
];

const ORDER_TYPE_LABEL: Record<string, string> = {
  "dine-in": "Dine in",
  "take-out": "Take out",
  delivery: "Delivery",
};

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

const normalize = (value?: string | null) => String(value ?? "").trim().toLowerCase();
const isPaid = (value?: string | null) => normalize(value) === "paid";
const isTerminalStatus = (value?: string | null) => ["refunded", "cancelled"].includes(normalize(value));

function getSettlementAction(currentStatus?: string | null, paymentStatus?: string | null): SettlementAction {
  const status = normalize(currentStatus);
  if (["refunded", "cancelled"].includes(status)) return null;
  if (status === "completed") return isPaid(paymentStatus) ? "refund" : null;
  if (["queued", "preparing", "ready", "ready for pickup"].includes(status)) return "refund";
  if (status === "pending payment") return "cancel";
  return isPaid(paymentStatus) ? "refund" : "cancel";
}

const getStage = (order: OrderCard): Stage => (order.isReady ? "ready" : order.isPreparing ? "preparing" : "new");

const isOverdue = (order: OrderCard, nowMs: number) =>
  order.isPreparing &&
  !order.isReady &&
  typeof order.dueAt === "number" &&
  Number.isFinite(order.dueAt) &&
  nowMs >= order.dueAt;

/** Overdue orders always come first, oldest deadline first. */
function sortForCook(orders: OrderCard[], nowMs: number): OrderCard[] {
  const overdue = orders.filter((o) => isOverdue(o, nowMs)).sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  const rest = orders.filter((o) => !isOverdue(o, nowMs));
  return [...overdue, ...rest];
}

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.4, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.2);
    });
  } catch {
    /* Audio can be blocked until the user interacts with the page. */
  }
}

/* -------------------------------------------------------------------------- */
/*                                 Prep timer                                 */
/* -------------------------------------------------------------------------- */

interface OrderTimerProps {
  baseAt: number;
  dueAt: number;
  estimatedPrepMinutes: number;
  orderNumber: string;
}

function OrderTimer({ baseAt, dueAt, estimatedPrepMinutes, orderNumber }: OrderTimerProps) {
  const [now, setNow] = useState(Date.now());
  const alerted = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Alert once when the order becomes overdue (re-arms if the timer is extended).
  useEffect(() => {
    if (now < dueAt) {
      alerted.current = false;
      return;
    }
    if (alerted.current) return;
    alerted.current = true;
    playAlertSound();
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Order overdue", {
        body: `${orderNumber} needs attention in the cook queue.`,
        icon: "/favicon.ico",
      });
    }
  }, [now, dueAt, orderNumber]);

  const remaining = Math.floor((dueAt - now) / 1000);
  const overdue = remaining <= 0;
  const abs = Math.abs(remaining);
  const clock = `${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  const totalMs = Math.max(estimatedPrepMinutes * 60, 60) * 1000;
  const progress = Math.min(Math.max((now - baseAt) / totalMs, 0), 1);
  const warning = !overdue && progress > 0.75;

  const tone = overdue
    ? { text: "text-red-600", bg: "bg-red-50", bar: "bg-red-500" }
    : warning
    ? { text: "text-amber-600", bg: "bg-amber-50", bar: "bg-amber-500" }
    : { text: "text-slate-700", bg: "bg-slate-100", bar: "bg-slate-400" };

  return (
    <div>
      <div
        className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-2xl font-bold tabular-nums ${tone.bg} ${tone.text}`}
      >
        {overdue ? <AlertCircle size={20} /> : <Clock size={20} />}
        {overdue ? `+${clock}` : clock}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${tone.bar}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Order ticket                                */
/* -------------------------------------------------------------------------- */

interface TicketProps {
  order: OrderCard;
  nowMs: number;
  pendingAction: PendingAction;
  isSettling: boolean;
  onStart: (id: string) => void;
  onComplete: (order: OrderCard) => void;
  onAdjustTimer: (order: OrderCard, deltaMinutes: number) => void;
  onSettle: (order: OrderCard) => void;
}

function OrderTicket({ order, nowMs, pendingAction, isSettling, onStart, onComplete, onAdjustTimer, onSettle }: TicketProps) {
  const stage = getStage(order);
  const overdue = isOverdue(order, nowMs);
  const orderType = order.orderType || order.status;
  const needsPickup = orderType === "delivery" || !!order.isOnlinePickup;
  const settlement = getSettlementAction(order.currentStatus, order.paymentStatus);
  const prepMinutes = Math.max(order.estimatedPrepMinutes ?? 10, 1);

  const thisAction = pendingAction?.orderId === order.id ? pendingAction.action : null;
  const busy = thisAction !== null || isSettling;
  const settleLocked = busy || isTerminalStatus(order.currentStatus);
  const timerEditable = stage !== "ready";

  const stripe = overdue ? "bg-red-500" : COLUMNS.find((c) => c.stage === stage)!.accent;
  const primaryButton = "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition disabled:cursor-not-allowed";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${
        overdue ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"
      }`}
    >
      <div className={`h-1.5 ${stripe}`} />

      <div className="flex flex-1 flex-col gap-4 p-5">
        <header className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold tracking-tight text-slate-900">{order.orderNumber}</h3>
          <div className="flex items-center gap-2">
            {overdue && (
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">Overdue</span>
            )}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {ORDER_TYPE_LABEL[orderType] ?? orderType}
            </span>
          </div>
        </header>

        {stage === "preparing" && order.prepStartedAt && order.dueAt && (
          <OrderTimer
            baseAt={order.prepStartedAt}
            dueAt={order.dueAt}
            estimatedPrepMinutes={prepMinutes}
            orderNumber={order.orderNumber}
          />
        )}

        {stage === "ready" && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">
            <CheckCircle2 size={18} />
            {order.isOnlinePickup ? "Ready for pickup" : "Ready to serve"}
          </div>
        )}

        <ul className="flex-1 space-y-2 border-y border-slate-100 py-4">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-baseline gap-3">
              <span className="w-9 text-base font-bold text-slate-900">{item.quantity}×</span>
              <span className="flex-1 text-base text-slate-700">{item.name}</span>
            </li>
          ))}
        </ul>

        {timerEditable && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
            <div>
              <div className="text-xs font-semibold text-slate-400">Prep time</div>
              <div className="text-base font-bold text-slate-900">{prepMinutes} min</div>
            </div>
            <div className="flex gap-2">
              {[-1, 1].map((delta) => (
                <button
                  key={delta}
                  onClick={() => onAdjustTimer(order, delta)}
                  aria-label={`${delta > 0 ? "Add" : "Remove"} one minute`}
                  className="flex h-10 w-16 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {delta > 0 ? <Plus size={14} /> : <Minus size={14} />} 1m
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {stage === "new" && (
            <button
              onClick={() => onStart(order.id)}
              disabled={busy}
              className={`${primaryButton} bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400`}
            >
              <Play size={16} /> {thisAction === "start" ? "Starting..." : "Start preparing"}
            </button>
          )}

          {stage === "preparing" && (
            <button
              onClick={() => onComplete(order)}
              disabled={busy}
              className={`${primaryButton} bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400`}
            >
              <CheckCircle2 size={16} />
              {thisAction === "complete" ? "Completing..." : needsPickup ? "Ready for pickup" : "Complete order"}
            </button>
          )}

          {stage === "ready" && orderType === "delivery" && (
            <button disabled className={`${primaryButton} bg-slate-100 text-slate-400`}>
              Awaiting cashier
            </button>
          )}

          {settlement && (
            <button
              onClick={() => onSettle(order)}
              disabled={settleLocked}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              <XCircle size={15} />
              {isSettling
                ? settlement === "refund" ? "Refunding..." : "Cancelling..."
                : settlement === "refund" ? "Refund order" : "Cancel order"}
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Kitchen view                               */
/* -------------------------------------------------------------------------- */

export default function Order() {
  const [now, setNow] = useState(new Date());
  const [settings, setSettings] = useState(GENERAL_SETTINGS_DEFAULTS);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [counts, setCounts] = useState<OrderStatusCounts>(EMPTY_COUNTS);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const inFlight = useRef<Promise<void> | null>(null);
  const { addNotification } = useNotifications();
  const { isMobile, isTablet } = useViewport();

  /* ---- Data ---- */

  const fetchAll = useCallback(() => {
    if (inFlight.current) return inFlight.current;

    const request = (async () => {
      try {
        const [queue, all] = await Promise.all([
          api.get<OrderCard[]>("/orders/queue"),
          api.get<{ status: string }[]>("/orders"),
        ]);
        setOrders((queue ?? []).filter((o) => !o.isFinished));

        const next = { ...EMPTY_COUNTS };
        (all ?? []).forEach((entry) => {
          const key = STATUS_TO_COUNT[normalize(entry.status)];
          if (key) next[key] += 1;
        });
        setCounts(next);
      } catch (error) {
        console.error("Failed to load kitchen orders:", error);
      }
    })();

    inFlight.current = request;
    void request.then(() => {
      if (inFlight.current === request) inFlight.current = null;
    });
    return request;
  }, []);

  /** Waits for any running fetch, then fetches again so the latest change is included. */
  const refresh = useCallback(async () => {
    if (inFlight.current) await inFlight.current;
    await fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEventInvalidation({ topics: ["orders.changed", "payments.changed"], onInvalidate: refresh });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchGeneralSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Actions ---- */

  const notifyError = (error: unknown, fallback: string) =>
    addNotification({
      id: crypto.randomUUID(),
      label: error instanceof Error ? error.message : fallback,
      type: "error",
    });

  /** Applies the server-confirmed order state immediately, before the refetch lands. */
  const applyUpdate = (update: OrderUpdateResponse) => {
    const status = normalize(update.status);
    setOrders((current) => {
      if (["completed", "refunded", "cancelled"].includes(status)) {
        return current.filter((o) => o.id !== String(update.id));
      }
      return current.map((o) =>
        o.id !== String(update.id)
          ? o
          : {
              ...o,
              currentStatus: update.status,
              paymentStatus: update.paymentStatus ?? o.paymentStatus,
              isPreparing: status === "preparing",
              isReady: status === "ready" || status === "ready for pickup",
              isFinished: false,
              prepStartedAt: update.prepStartedAt ?? o.prepStartedAt,
              readyAt: update.readyAt ?? o.readyAt,
              dueAt: update.dueAt ?? o.dueAt,
              estimatedPrepMinutes: update.estimatedPrepMinutes ?? o.estimatedPrepMinutes,
            },
      );
    });
  };

  const handleStart = async (id: string) => {
    if (pendingAction?.orderId === id) return;
    setPendingAction({ orderId: id, action: "start" });
    try {
      applyUpdate(await api.patch<OrderUpdateResponse>(`/orders/${id}`, { status: "preparing" }));
      void refresh();
    } catch (error) {
      notifyError(error, "Failed to start order.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleComplete = async (order: OrderCard) => {
    if (pendingAction?.orderId === order.id) return;
    const needsPickup = (order.orderType || order.status) === "delivery" || order.isOnlinePickup;
    setPendingAction({ orderId: order.id, action: "complete" });
    try {
      const body = needsPickup
        ? { status: "Ready for Pickup" }
        : { status: "Completed", completeFromPreparing: true };
      applyUpdate(await api.patch<OrderUpdateResponse>(`/orders/${order.id}`, body));
      void refresh();
    } catch (error) {
      notifyError(error, "Failed to complete order.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleSettle = async (order: OrderCard) => {
    const action = getSettlementAction(order.currentStatus, order.paymentStatus);
    if (!action) return;
    setSettlingId(order.id);
    try {
      const update = await api.patch<OrderUpdateResponse>(`/orders/${order.id}`, {
        status: action === "refund" ? "Refunded" : "Cancelled",
      });
      applyUpdate(update);
      void fetchAll();
    } catch (error) {
      notifyError(error, "Failed to settle order.");
    } finally {
      setSettlingId(null);
    }
  };

  const handleAdjustTimer = async (order: OrderCard, deltaMinutes: number) => {
    const current = Math.max(order.estimatedPrepMinutes ?? 10, 1);
    const raw = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    const userId = Number.isFinite(Number(raw)) ? Number(raw) : null;
    try {
      await api.patch(`/orders/${order.id}`, {
        estimatedPrepMinutes: Math.max(current + deltaMinutes, 1),
        timerUpdatedBy: userId,
      });
      void fetchAll();
    } catch (error) {
      console.error("Failed to update cook timer:", error);
    }
  };

  /* ---- Render ---- */

  const formatTime = (d: Date) =>
    formatInSettingsTimezone(d, settings, { hour: "numeric", minute: "2-digit", hour12: true });
  const formatDate = (d: Date) =>
    formatInSettingsTimezone(d, settings, { weekday: "long", month: "long", day: "numeric" });

  const sortedOrders = sortForCook(orders, now.getTime());
  const shellPadding = isMobile ? "pt-[72px]" : isTablet ? "pt-[76px]" : "pl-24";

  return (
    <div className="min-h-screen bg-slate-50 font-['DM_Sans',sans-serif]">
      <Sidebar />

      <div className={shellPadding}>
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {/* Header */}
          <header className="mb-6 flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
                <ChefHat size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cook</h1>
                <p className="text-sm text-slate-500">
                  {formatDate(now)} · <span className="font-semibold tabular-nums text-slate-700">{formatTime(now)}</span>
                </p>
              </div>
            </div>

            <UserIdentityBanner className="order-3 w-full sm:order-2 sm:w-auto" />

            <div className="order-2 grid w-full grid-cols-2 gap-3 sm:order-3 sm:grid-cols-3 lg:flex lg:w-auto">
              {STATS.map(({ key, label, icon: Icon, tone }) => (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <div className="text-2xl font-bold leading-none text-slate-900">{counts[key]}</div>
                    <div className="mt-1 whitespace-nowrap text-xs font-medium text-slate-500">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </header>

          {notifPermission === "default" && (
            <button
              onClick={() => Notification.requestPermission().then(setNotifPermission)}
              className="mb-6 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <Bell size={16} className="text-amber-500" />
              Enable notifications for overdue orders
            </button>
          )}

          {/* Board */}
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white py-28 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <Utensils size={28} className="text-slate-300" />
              </span>
              <p className="text-lg font-semibold text-slate-600">No pending orders</p>
              <p className="text-sm text-slate-400">New orders will appear here as they come in.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
              {COLUMNS.map(({ stage, title, icon: Icon, badge, empty }) => {
                const column = sortedOrders.filter((o) => getStage(o) === stage);
                return (
                  <section key={stage} className="min-w-0">
                    <div className="mb-4 flex items-center gap-2.5">
                      <Icon size={18} className="text-slate-500" />
                      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                      <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${badge}`}>{column.length}</span>
                    </div>

                    {column.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center text-sm text-slate-400">
                        {empty}
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                        <AnimatePresence mode="popLayout">
                          {column.map((order) => (
                            <OrderTicket
                              key={order.id}
                              order={order}
                              nowMs={now.getTime()}
                              pendingAction={pendingAction}
                              isSettling={settlingId === order.id}
                              onStart={handleStart}
                              onComplete={handleComplete}
                              onAdjustTimer={handleAdjustTimer}
                              onSettle={handleSettle}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}