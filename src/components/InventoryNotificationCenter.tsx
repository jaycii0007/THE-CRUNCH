import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, PackageX, X } from "lucide-react";
import { apiCall } from "@/lib/api";
import { useEventInvalidation } from "@/hooks/use-event-invalidation";
import { normalizeRole } from "@/lib/permissions";

type AlertSeverity = "out" | "critical" | "low" | "normal";

interface InventoryAlert {
  inventory_id: number;
  product_id: number;
  product_name: string;
  category: string;
  unit: string;
  mainStock: number;
  severity: AlertSeverity;
  thresholds: { low: number; critical: number };
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

export function InventoryNotificationCenter({ role }: { role: unknown }) {
  const normalizedRole = normalizeRole(role);
  const enabled =
    normalizedRole === "administrator" || normalizedRole === "inventory_manager";
  const [open, setOpen] = useState(false);
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
          : "Unable to load inventory alerts.",
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

  const visibleAlerts = useMemo(() => {
    const roleFiltered =
      normalizedRole === "inventory_manager"
        ? alerts.filter((alert) =>
            alert.severity === "critical" || alert.severity === "out",
          )
        : alerts.filter((alert) => alert.severity !== "normal");
    return [...roleFiltered].sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.product_name.localeCompare(b.product_name),
    );
  }, [alerts, normalizedRole]);

  if (!enabled) return null;

  const roleLabel =
    normalizedRole === "administrator"
      ? "Inventory notifications"
      : "Critical stock notifications";

  return (
    <div className="fixed right-4 top-4 z-40 font-['Poppins',sans-serif] sm:right-6 sm:top-6">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-lg transition hover:text-slate-900"
        aria-label={`${roleLabel}: ${visibleAlerts.length} active`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {visibleAlerts.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white">
            {visibleAlerts.length > 99 ? "99+" : visibleAlerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">{roleLabel}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Current live alerts · updates when stock changes
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[min(65vh,30rem)] overflow-y-auto p-2">
            {loading && alerts.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-400">
                Loading alerts…
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
            ) : visibleAlerts.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-400">
                No active stock alerts.
              </p>
            ) : (
              visibleAlerts.map((alert) => {
                const isOut = alert.severity === "out";
                return (
                  <div
                    key={`${alert.inventory_id}-${alert.severity}`}
                    className="mb-1 flex gap-3 rounded-xl px-3 py-3 hover:bg-slate-50"
                  >
                    <span
                      className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${isOut ? "bg-red-100 text-red-600" : alert.severity === "critical" ? "bg-orange-100 text-orange-600" : "bg-amber-100 text-amber-600"}`}
                    >
                      {isOut ? <PackageX className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {alert.product_name}
                        </p>
                        <span className="shrink-0 text-[10px] font-bold uppercase text-slate-500">
                          {isOut ? "Out" : alert.severity}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {alert.mainStock} {alert.unit} remaining
                        {isOut
                          ? ""
                          : ` · critical at ${alert.thresholds.critical}`}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
