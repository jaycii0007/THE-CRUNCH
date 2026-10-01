import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, PackageX, X } from "lucide-react";
import { apiCall } from "@/lib/api";
import { useEventInvalidation } from "@/hooks/use-event-invalidation";
import { normalizeRole } from "@/lib/permissions";

// 👉 Change this to match your actual route
const PURCHASE_ORDERS_PATH = "/purchase-orders";

type AlertSeverity = "out" | "critical" | "low" | "normal";
type Tab = "unread" | "read";

interface InventoryAlert {
  inventory_id: number;
  product_id: number;
  product_name: string;
  category: string;
  unit: string;
  mainStock: number;
  severity: AlertSeverity;
  thresholds: { low: number; critical: number };
  is_read: boolean;
}

interface InventoryAlertsResponse {
  generatedAt: string;
  items: InventoryAlert[];
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  out: 0,
  critical: 1,
  low: 2,
  normal: 3,
};

const SEVERITY_STYLES: Record<Exclude<AlertSeverity, "normal">, string> = {
  out: "bg-red-100 text-red-600",
  critical: "bg-orange-100 text-orange-600",
  low: "bg-amber-100 text-amber-600",
};

export function InventoryNotificationCenter({ role }: { role: unknown }) {
  const navigate = useNavigate();
  const normalizedRole = normalizeRole(role);
  const enabled =
    normalizedRole === "administrator" || normalizedRole === "inventory_manager";
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("unread");
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadAlerts = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const response = await apiCall<InventoryAlertsResponse>("/inventory/alerts");
      if (!mounted.current) return;
      setAlerts(response.items ?? []);
      setError(null);
    } catch (loadError) {
      if (!mounted.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load notifications.",
      );
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  useEventInvalidation({
    topics: ["inventory.changed", "products.changed"],
    onInvalidate: loadAlerts,
    enabled,
    debounceMs: 350,
  });

  // Overall list: every non-normal alert, same for all roles
  const allAlerts = useMemo(
    () =>
      alerts
        .filter((alert) => alert.severity !== "normal")
        .sort(
          (a, b) =>
            SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
            a.product_name.localeCompare(b.product_name),
        ),
    [alerts],
  );

  const unreadAlerts = useMemo(() => allAlerts.filter((a) => !a.is_read), [allAlerts]);
  const readAlerts = useMemo(() => allAlerts.filter((a) => a.is_read), [allAlerts]);
  const shownAlerts = tab === "unread" ? unreadAlerts : readAlerts;

  const markAsRead = useCallback(
    async (inventoryId: number) => {
      // Optimistic update, rolled back by re-fetching if the request fails
      setAlerts((current) =>
        current.map((a) =>
          a.inventory_id === inventoryId ? { ...a, is_read: true } : a,
        ),
      );
      try {
        await apiCall(`/inventory/alerts/${inventoryId}/read`, { method: "POST" });
      } catch {
        void loadAlerts();
      }
    },
    [loadAlerts],
  );

  const markAllAsRead = useCallback(async () => {
    setAlerts((current) => current.map((a) => ({ ...a, is_read: true })));
    try {
      await apiCall("/inventory/alerts/read-all", { method: "POST" });
    } catch {
      void loadAlerts();
    }
  }, [loadAlerts]);

  const handleAlertClick = useCallback(
    (alert: InventoryAlert) => {
      if (!alert.is_read) void markAsRead(alert.inventory_id);
      setOpen(false);
      navigate(`${PURCHASE_ORDERS_PATH}?product_id=${alert.product_id}`);
    },
    [markAsRead, navigate],
  );

  if (!enabled) return null;

  return (
    <div className="fixed right-4 top-4 z-40 font-['Poppins',sans-serif] sm:right-6 sm:top-6">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-lg transition hover:text-slate-900"
        aria-label={`Notifications: ${unreadAlerts.length} unread`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadAlerts.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white">
            {unreadAlerts.length > 99 ? "99+" : unreadAlerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header: title only */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Read / Unread tabs */}
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <div className="flex gap-1">
              {(["unread", "read"] as const).map((key) => {
                const count = key === "unread" ? unreadAlerts.length : readAlerts.length;
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {key} ({count})
                  </button>
                );
              })}
            </div>
            {tab === "unread" && unreadAlerts.length > 0 && (
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                className="text-xs font-semibold text-slate-600 underline hover:text-slate-900"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[min(65vh,30rem)] overflow-y-auto p-2">
            {loading && alerts.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-400">
                Loading notifications…
              </p>
            ) : error ? (
              <div className="p-3 text-center">
                <p className="text-sm text-red-600">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadAlerts()}
                  className="mt-2 text-xs font-semibold text-slate-700 underline"
                >
                  Try again
                </button>
              </div>
            ) : shownAlerts.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-400">
                {tab === "unread" ? "No unread notifications." : "No read notifications."}
              </p>
            ) : (
              shownAlerts.map((alert) => {
                const isOut = alert.severity === "out";
                return (
                  <button
                    type="button"
                    key={`${alert.inventory_id}-${alert.severity}`}
                    onClick={() => handleAlertClick(alert)}
                    title="Go to Purchase Orders"
                    className={`mb-1 flex w-full cursor-pointer gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-100 ${
                      alert.is_read ? "bg-white" : "bg-slate-50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                        SEVERITY_STYLES[alert.severity as Exclude<AlertSeverity, "normal">]
                      }`}
                    >
                      {isOut ? (
                        <PackageX className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`truncate text-sm text-slate-800 ${
                            alert.is_read ? "font-medium" : "font-bold"
                          }`}
                        >
                          {alert.product_name}
                        </p>
                        <span className="shrink-0 text-[10px] font-bold uppercase text-slate-500">
                          {isOut ? "Out" : alert.severity}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {alert.mainStock} {alert.unit} remaining
                        {isOut ? "" : ` · critical at ${alert.thresholds.critical}`}
                      </p>
                    </div>
                    {!alert.is_read && (
                      <span
                        className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600"
                        aria-label="Unread"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}