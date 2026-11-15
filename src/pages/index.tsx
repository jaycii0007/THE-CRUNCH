import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, DollarSign, Layers, CheckCircle } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { api } from "@/lib/api";
import { useEventInvalidation } from "@/hooks/use-event-invalidation";
import { fetchGeneralSettings, formatCurrencyAmount, formatInSettingsTimezone, GENERAL_SETTINGS_DEFAULTS } from "@/lib/restaurantSettings";
import { isActiveOrder, normalizeFinancialOrderStatus, summarizeFinancialOrders } from "@/lib/financialStatus";
import { SkeletonKPICard } from "@/components/ui/skeleton";
import type { InventoryAlertsPayload, PurchaseOrder } from "./stockmanager/types/inventory";
import { requestStockManagerTab } from "./stockmanager/navigation";

interface OrderItem {
  productId?: number;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: number;
  orderNumber: string;
  items: OrderItem[];
  total: number;
  date: string;
  createdAt: string;
  orderType: string;
  status: string;
  paymentCategory: string;
  paymentStatus: string;
}

interface RawOrderRow {
  id: number;
  orderNumber?: string;
  total: number | string;
  date?: string;
  paymentDate?: string | null;
  payment_date?: string | null;
  readyAt?: string | null;
  ready_at?: string | null;
  handoverTimestamp?: string | null;
  handover_timestamp?: string | null;
  status?: string;
  paymentMethod?: string;
  payment_method?: string;
  paymentStatus?: string;
  payment_status?: string;
  orderType?: string;
  order_type?: string;
  productId?: number;
  productName?: string;
  price?: number;
  quantity?: number;
}

function groupOrderRows(rows: RawOrderRow[]): Order[] {
  const grouped = new Map<number, Order>();

  rows.forEach((row) => {
    if (!grouped.has(row.id)) {
      const financialTimestamp =
        row.handoverTimestamp ??
        row.handover_timestamp ??
        row.readyAt ??
        row.ready_at ??
        row.paymentDate ??
        row.payment_date ??
        row.date;
      grouped.set(row.id, {
        id: row.id,
        orderNumber: row.orderNumber || `#${row.id}`,
        items: [],
        total: Number(row.total) || 0,
        date: financialTimestamp ? new Date(financialTimestamp).toISOString() : "",
        createdAt: row.date ?? "",
        orderType: row.orderType ?? row.order_type ?? "",
        status: row.status ?? "",
        paymentCategory: row.paymentMethod ?? row.payment_method ?? "",
        paymentStatus: row.paymentStatus ?? row.payment_status ?? "",
      });
    }
    if (row.productId) {
      grouped.get(row.id)!.items.push({
        productId: row.productId,
        name: row.productName ?? "",
        price: row.price ?? 0,
        quantity: row.quantity ?? 1,
      });
    }
  });

  return [...grouped.values()];
}
interface KpiCardProps {
  to: string;
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
}

function KpiCard({ label, value, hint, icon: Icon, to }: KpiCardProps) {
  return (
    <Link to={to} className="block rounded-2xl transition hover:ring-1 hover:ring-[#486C5D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486C5D]">
    <article className="ov-kpi-card" aria-label={`${label}: ${value}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-[#818781]">
            {label}
          </p>
          <p className="mt-1.5 truncate text-2xl font-bold tracking-tight text-[#242824] sm:text-3xl" title={value}>
            {value}
          </p>
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${label === "Today's sales" || label === "Completed orders" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}
          aria-hidden="true"
        >
          <Icon size={20} strokeWidth={1.8} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-[#818781] truncate">
        {hint.split(" Â· ").map((part, i, arr) => {
          const isNegative = part.toLowerCase().includes("cancelled") || part.toLowerCase().includes("refunded");
          return (
            <React.Fragment key={i}>
              <span className={`truncate font-medium ${isNegative ? "text-[#C05656]" : "text-[#818781]"}`}>
                {part}
              </span>
              {i < arr.length - 1 && <span className="text-[#E5E9E4]">Â·</span>}
            </React.Fragment>
          );
        })}
      </div>
    </article>
    </Link>
  );
}



interface Resource<T> { data: T | null; error: string | null }

function resourceResult<T>(result: PromiseSettledResult<T>): Resource<T> {
  return result.status === "fulfilled" ? { data: result.value, error: null }
    : { data: null, error: "Unable to load this section. Try refreshing." };
}

function dayKey(value: string | Date, timezone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map((key) => parts.find((part) => part.type === key)?.value).join("-");
}

const OPERATION_LABELS = ["Pending Payment", "Awaiting cashier review", "Queued", "Preparing", "Ready", "Ready for pickup / handover"];

function summarizeOperations(orders: Order[], timezone: string, now = new Date()) {
  const today = dayKey(now, timezone);
  const filteredOrders = orders.filter((order) => dayKey(order.date, timezone) === today);
  const financial = summarizeFinancialOrders(filteredOrders);
  const active = orders.filter(isActiveOrder);
  const statuses = new Map<string, number>();
  active.forEach((order) => {
    const raw = order.status.trim().toLowerCase();
    const awaitingPayment = raw === "pending payment" ||
      (["pending", "pending payment", "unpaid"].includes(order.paymentStatus.trim().toLowerCase()) &&
        ["pending", "awaiting cashier review"].includes(raw));
    const status = awaitingPayment
      ? "Pending Payment"
      : raw === "awaiting cashier review" ? "Awaiting cashier review"
      : ["queued", "pending"].includes(raw) ? "Queued"
      : ["preparing", "in progress"].includes(raw) ? "Preparing"
      : raw === "ready for pickup" ? "Ready for pickup / handover"
      : raw === "ready" ? "Ready" : order.status || "Unspecified";
    statuses.set(status, (statuses.get(status) ?? 0) + 1);
  });
  return {
    sales: financial.totalSales,
    totalOrders: orders.filter((order) => dayKey(order.createdAt, timezone) === today).length,
    activeOrders: active.length,
    completedOrders: filteredOrders.filter((order) => normalizeFinancialOrderStatus(order.status) === "completed").length,
    statuses,
  };
}

function Metric({ label, value, tone = "text-[#242824]" }: { label: string; value: number; tone?: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-[#E5E9E4] py-2.5 last:border-0">
    <span className="text-sm text-slate-600">{label}</span><strong className={`text-lg tabular-nums ${tone}`}>{value.toLocaleString()}</strong>
  </div>;
}

function SectionState({ loading, error, children }: { loading: boolean; error: string | null; children: React.ReactNode }) {
  if (loading) return <p role="status" className="py-6 text-sm text-slate-500">Loading…</p>;
  if (error) return <p role="alert" className="py-4 text-sm text-red-700">{error}</p>;
  return <>{children}</>;
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Resource<Order[]>>({ data: null, error: null });
  const [inventory, setInventory] = useState<Resource<InventoryAlertsPayload>>({ data: null, error: null });
  const [purchaseOrders, setPurchaseOrders] = useState<Resource<PurchaseOrder[]>>({ data: null, error: null });
  const [settings, setSettings] = useState(GENERAL_SETTINGS_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const fetching = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void fetchGeneralSettings().then((value) => { if (!cancelled) setSettings(value); });
    return () => { cancelled = true; };
  }, []);

  const loadDashboard = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    try {
      const [orderResult, inventoryResult, purchaseResult] = await Promise.allSettled([
        api.get<RawOrderRow[]>("/orders").then(groupOrderRows),
        api.get<InventoryAlertsPayload>("/inventory/alerts"),
        api.get<PurchaseOrder[]>("/purchase-orders"),
      ]);
      setOrders(resourceResult(orderResult));
      setInventory(resourceResult(inventoryResult));
      setPurchaseOrders(resourceResult(purchaseResult));
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, []);
  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  useEventInvalidation({
    topics: ["orders.changed", "payments.changed", "inventory.changed", "products.changed", "refundRequests.changed", "purchaseOrders.changed"],
    onInvalidate: loadDashboard,
  });

  const operations = useMemo(() => summarizeOperations(orders.data ?? [], settings.timezone), [orders.data, settings.timezone]);
  const stock = inventory.data?.summary;
  const uniquePOs = [...new Map((purchaseOrders.data ?? []).map((order) => [order.id, order])).values()];
  const draftPOs = uniquePOs.filter((order) => order.status === "Draft").length;
  const orderedPOs = uniquePOs.filter((order) => order.status === "Ordered").length;
  const bestSellers = useMemo(() => {
    const products = new Map<string, { name: string; quantity: number }>();
    summarizeFinancialOrders(orders.data ?? []).finalizedSales.forEach((order) => order.items.forEach((item) => {
      const key = String(item.productId ?? item.name);
      const current = products.get(key) ?? { name: item.name, quantity: 0 };
      current.quantity += Number(item.quantity) || 0;
      products.set(key, current);
    }));
    return [...products.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)).slice(0, 5);
  }, [orders.data]);
  const money = (value: number) => formatCurrencyAmount(value, settings);
  const cardLinkClass = "ov-card block min-w-0 transition hover:ring-1 hover:ring-[#486C5D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486C5D]";
  const linkClass = "text-xs font-semibold text-[#486C5D] underline underline-offset-4";

  return <div className="ov-canvas">
    <Sidebar />
    <main className="ov-container space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#486C5D]">Business overview</p>
          <h1 className="mt-1 text-2xl font-bold text-[#242824]">{settings.restaurantName || "THE CRUNCH"}</h1>
          <p className="mt-1 text-sm text-slate-500">{formatInSettingsTimezone(new Date(), settings, { dateStyle: "full" })} · {settings.timezone}</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void loadDashboard()} className="rounded-xl border border-[#E5E9E4] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
      </header>

      <section aria-label="Business summary">
        {loading && !orders.data ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((key) => <SkeletonKPICard key={key} theme="admin" />)}</div> : orders.error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Order summary unavailable. Try refreshing.</p> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard to="/sales-reports" label="Today's sales" value={money(operations.sales)} hint="Completed paid orders today" icon={DollarSign} />
          <KpiCard to="/orders" label="Today's total orders" value={operations.totalOrders.toLocaleString()} hint="Orders placed today, all statuses" icon={ShoppingBag} />
          <KpiCard to="/orders" label="Active orders" value={operations.activeOrders.toLocaleString()} hint="All outstanding orders, including prior days" icon={Layers} />
          <KpiCard to="/sales-reports" label="Completed orders" value={operations.completedOrders.toLocaleString()} hint="Completed or picked up today" icon={CheckCircle} />
        </div>}
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
        <Link to="/orders" className={cardLinkClass} aria-labelledby="operations-heading">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="operations-heading" className="font-semibold">Order operations</h2><span className={linkClass}>Open orders</span></div>
          <p className="mt-1 text-xs text-slate-500">Current active workload across all dates</p>
          <SectionState loading={loading && !orders.data} error={orders.error}>
            {OPERATION_LABELS.map((label) => <Metric key={label} label={label} value={operations.statuses.get(label) ?? 0} tone={label.startsWith("Ready") ? "text-emerald-700" : label === "Preparing" ? "text-blue-700" : "text-amber-800"} />)}
            {[...operations.statuses].filter(([label]) => !OPERATION_LABELS.includes(label)).map(([label, count]) => <Metric key={label} label={label} value={count} />)}
            <Metric label="Completed today" value={operations.completedOrders} tone="text-emerald-700" />
            {operations.activeOrders === 0 && <p className="mt-3 text-xs text-slate-500">No active orders.</p>}
          </SectionState>
        </Link>

        <Link to="/stockmanager" onClick={() => requestStockManagerTab("alerts")} className={cardLinkClass} aria-labelledby="inventory-heading">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="inventory-heading" className="font-semibold">Inventory health</h2><span className={linkClass}>View inventory alerts</span></div>
          <SectionState loading={loading && !inventory.data} error={inventory.error}>
            {stock && <><Metric label="Total materials" value={stock.totalItems} /><Metric label="Healthy" value={stock.normal} tone="text-emerald-700" /><Metric label="Reorder Stock" value={stock.low} tone="text-amber-800" /><Metric label="Low Stock" value={stock.critical} tone="text-red-700" /><Metric label="Out of stock" value={stock.outOfStock} tone="text-red-700" />{stock.totalItems === 0 && <p className="mt-3 text-xs text-slate-500">No inventory materials found.</p>}</>}
          </SectionState>
          <p className="mt-3 text-xs text-slate-500">Uses configured inventory thresholds. Expiry counts are not available from this summary.</p>
        </Link>

        <Link to="/stockmanager" onClick={() => requestStockManagerTab("purchases")} className={cardLinkClass} aria-labelledby="purchase-heading">
          <h2 id="purchase-heading" className="font-semibold">Purchase Orders</h2>
          <SectionState loading={loading && !purchaseOrders.data} error={purchaseOrders.error}>
            <Metric label="Draft · to prepare" value={draftPOs} tone="text-amber-800" /><Metric label="Ordered · awaiting receipt" value={orderedPOs} tone="text-blue-700" />
            {draftPOs + orderedPOs === 0 && <p className="mt-3 text-xs text-slate-500">No purchase orders awaiting action.</p>}
          </SectionState>
        </Link>
        <Link to="/stockmanager" onClick={() => requestStockManagerTab("alerts")} className={cardLinkClass} aria-labelledby="attention-heading">
          <h2 id="attention-heading" className="font-semibold">Needs Your Attention</h2>
          <SectionState loading={loading && !inventory.data} error={inventory.error}>
            {stock && <><Metric label="Reorder Stock" value={stock.low} tone="text-amber-800" /><Metric label="Low Stock" value={stock.critical} tone="text-red-700" /><Metric label="Out of Stock" value={stock.outOfStock} tone="text-red-700" /></>}
          </SectionState>
          <p className="mt-3 text-xs text-slate-500">Open Monitor Stock to review affected materials.</p>
        </Link>
      </div>
      <Link to="/sales-reports" className={cardLinkClass} aria-labelledby="best-sellers-heading">
        <h2 id="best-sellers-heading" className="font-semibold">Best Sellers</h2>
        <p className="mt-1 text-xs text-slate-500">Top menu products by quantity · all completed, paid orders</p>
        <SectionState loading={loading && !orders.data} error={orders.error}>
          {bestSellers.length ? <ol className="mt-3">{bestSellers.map((item, index) => <li key={index} className="flex justify-between gap-4 border-b border-[#E5E9E4] py-2.5 last:border-0"><span className="text-sm">{index + 1}. {item.name}</span><strong className="shrink-0 tabular-nums">{item.quantity}</strong></li>)}</ol> : <p className="py-6 text-sm text-slate-500">No completed paid menu sales yet.</p>}
        </SectionState>
      </Link>
    </main>
  </div>;
}
