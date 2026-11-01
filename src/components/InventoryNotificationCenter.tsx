import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, FileText, PackageCheck, PackageX, ShoppingCart, X } from "lucide-react";
import { apiCall } from "@/lib/api";
import { useEventInvalidation } from "@/hooks/use-event-invalidation";
import { normalizeRole } from "@/lib/permissions";
import { requestStockManagerTab, STOCK_MANAGER_PATH } from "@/pages/stockmanager/navigation";
import { useConfirm, useNotifications } from "@/lib/NotificationContext";

type AlertSeverity = "out" | "critical" | "low";
type NotificationTab = "unread" | "read";

interface InventoryAlert {
  alert_id: number;
  product_name: string;
  unit: string;
  mainStock: number;
  severity: AlertSeverity;
  thresholds: { low: number; critical: number };
  created_at: string;
  resolved_at: string | null;
  is_read: boolean;
}

interface InventoryAlertsResponse {
  notifications: InventoryAlert[];
  unreadCount: number;
}

interface StaffNotification {
  notification_id: number;
  category: "refund_request" | "purchase_order" | "inventory_change";
  event_type: string;
  entity_id: string;
  title: string;
  message: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  is_read: boolean;
}

interface StaffNotificationsResponse {
  notifications: StaffNotification[];
  unreadCount: number;
}

type UnifiedNotification =
  | { source: "inventory"; id: number; item: InventoryAlert }
  | { source: "staff"; id: number; item: StaffNotification };

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  out: "bg-red-100 text-red-600",
  critical: "bg-orange-100 text-orange-600",
  low: "bg-amber-100 text-amber-600",
};

function formatNotificationTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function metadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return value === null || value === undefined ? "" : String(value);
}

function isRead(notification: UnifiedNotification) {
  return notification.item.is_read;
}

function createdAt(notification: UnifiedNotification) {
  return notification.item.created_at;
}

export function InventoryNotificationCenter({ role, embedded = false }: { role: unknown; embedded?: boolean }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { addNotification } = useNotifications();
  const normalizedRole = normalizeRole(role);
  const enabled = normalizedRole === "administrator" || normalizedRole === "inventory_manager";
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTab>("unread");
  const [inventoryAlerts, setInventoryAlerts] = useState<InventoryAlert[]>([]);
  const [staffNotifications, setStaffNotifications] = useState<StaffNotification[]>([]);
  const [inventoryUnread, setInventoryUnread] = useState(0);
  const [staffUnread, setStaffUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingKey, setMarkingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<StaffNotification | null>(null);
  const [refundAction, setRefundAction] = useState<"ignore" | "refund" | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const [inventoryResponse, staffResponse] = await Promise.all([
        apiCall<InventoryAlertsResponse>("/inventory/alerts"),
        apiCall<StaffNotificationsResponse>("/staff-notifications"),
      ]);
      if (!mounted.current) return;
      setInventoryAlerts(inventoryResponse.notifications ?? []);
      setStaffNotifications(staffResponse.notifications ?? []);
      setInventoryUnread(Number(inventoryResponse.unreadCount) || 0);
      setStaffUnread(Number(staffResponse.unreadCount) || 0);
      setError(null);
    } catch (loadError) {
      if (!mounted.current) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load notifications.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!selectedRefund) return;
    const current = staffNotifications.find(
      (notification) => notification.notification_id === selectedRefund.notification_id,
    );
    if (current && current !== selectedRefund) setSelectedRefund(current);
  }, [selectedRefund, staffNotifications]);

  useEventInvalidation({
    topics: ["inventory.changed", "products.changed", "refundRequests.changed", "purchaseOrders.changed"],
    onInvalidate: loadNotifications,
    enabled,
    debounceMs: 350,
  });

  const allNotifications = useMemo<UnifiedNotification[]>(() => {
    const visibleInventory = normalizedRole === "inventory_manager" || normalizedRole === "administrator"
      ? inventoryAlerts
      : [];
    const visibleStaff = staffNotifications.filter((notification) => {
      if (
        notification.category === "refund_request" ||
        notification.category === "inventory_change"
      ) {
        return normalizedRole === "administrator";
      }
      return normalizedRole === "administrator" || normalizedRole === "inventory_manager";
    });
    return [
      ...visibleInventory.map((item): UnifiedNotification => ({ source: "inventory", id: item.alert_id, item })),
      ...visibleStaff.map((item): UnifiedNotification => ({ source: "staff", id: item.notification_id, item })),
    ].sort((left, right) => new Date(createdAt(right)).getTime() - new Date(createdAt(left)).getTime());
  }, [inventoryAlerts, normalizedRole, staffNotifications]);

  const unreadNotifications = useMemo(
    () => allNotifications.filter((notification) => !isRead(notification)),
    [allNotifications],
  );
  const readNotifications = useMemo(() => allNotifications.filter(isRead), [allNotifications]);
  const shownNotifications = tab === "unread" ? unreadNotifications : readNotifications;
  const unreadCount = inventoryUnread + staffUnread;

  const markAsRead = useCallback(async (notification: UnifiedNotification) => {
    if (isRead(notification)) return;
    const key = `${notification.source}:${notification.id}`;
    if (markingKey === key) return;
    setMarkingKey(key);
    if (notification.source === "inventory") {
      setInventoryAlerts((current) => current.map((item) =>
        item.alert_id === notification.id ? { ...item, is_read: true } : item,
      ));
      setInventoryUnread((current) => Math.max(0, current - 1));
    } else {
      setStaffNotifications((current) => current.map((item) =>
        item.notification_id === notification.id ? { ...item, is_read: true } : item,
      ));
      setStaffUnread((current) => Math.max(0, current - 1));
    }
    try {
      const endpoint = notification.source === "inventory"
        ? `/inventory/alerts/${notification.id}/read`
        : `/staff-notifications/${notification.id}/read`;
      await apiCall(endpoint, { method: "POST" });
      setError(null);
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Unable to mark this notification as read.");
      void loadNotifications();
    } finally {
      if (mounted.current) setMarkingKey(null);
    }
  }, [loadNotifications, markingKey]);

  const markAllAsRead = useCallback(async () => {
    if (markingAll) return;
    setMarkingAll(true);
    setInventoryAlerts((current) => current.map((item) => ({ ...item, is_read: true })));
    setStaffNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    setInventoryUnread(0);
    setStaffUnread(0);
    try {
      await Promise.all([
        apiCall("/inventory/alerts/read-all", { method: "POST" }),
        apiCall("/staff-notifications/read-all", { method: "POST" }),
      ]);
      setError(null);
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Unable to mark all notifications as read.");
      void loadNotifications();
    } finally {
      if (mounted.current) setMarkingAll(false);
    }
  }, [loadNotifications, markingAll]);

  const openNotification = useCallback((notification: UnifiedNotification) => {
    if (!isRead(notification)) void markAsRead(notification);
    setOpen(false);
    if (notification.source === "staff" && notification.item.category === "refund_request") {
      setSelectedRefund(notification.item);
      return;
    }
    if (notification.source === "staff" && notification.item.category === "inventory_change") {
      requestStockManagerTab("alerts");
      navigate(STOCK_MANAGER_PATH);
      return;
    }
    requestStockManagerTab(notification.source === "inventory" ? "alerts" : "purchases");
    navigate(STOCK_MANAGER_PATH);
  }, [markAsRead, navigate]);

  const notify = useCallback((label: string, type: "success" | "error") => {
    addNotification({ id: crypto.randomUUID(), label, type });
  }, [addNotification]);

  const reviewRefund = useCallback(async (action: "ignore" | "refund") => {
    if (!selectedRefund || refundAction) return;
    const requestId = Number(selectedRefund.metadata.requestId);
    const orderId = Number(selectedRefund.metadata.orderId ?? selectedRefund.entity_id);
    if (!Number.isSafeInteger(requestId) || requestId <= 0 || !Number.isSafeInteger(orderId) || orderId <= 0) {
      notify("This refund notification is missing its order details. Refresh and try again.", "error");
      return;
    }
    const accepted = await confirm({
      title: action === "refund" ? "Take action on refund request?" : "Ignore refund request?",
      message: action === "refund"
        ? "The server will recheck payment and preparation status before refunding and restoring inventory."
        : "The request will be marked ignored and the original order will return to Cook View immediately.",
      confirmLabel: action === "refund" ? "Confirm refund" : "Ignore request",
      cancelLabel: "Cancel",
      danger: action === "refund",
    });
    if (!accepted) return;
    setRefundAction(action);
    try {
      if (action === "refund") {
        await apiCall(`/orders/${orderId}`, {
          method: "PATCH",
          body: { status: "Refunded" },
        });
        notify("Refund completed and the request was actioned.", "success");
      } else {
        await apiCall(`/refund-requests/${requestId}/ignore`, {
          method: "PATCH",
          body: {},
        });
        notify("Refund request ignored. The order returned to Cook View.", "success");
      }
      setSelectedRefund(null);
      await loadNotifications();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to review the refund request.", "error");
    } finally {
      if (mounted.current) setRefundAction(null);
    }
  }, [confirm, loadNotifications, notify, refundAction, selectedRefund]);

  if (!enabled) return null;

  return (
    <>
      <div className={`${embedded ? "relative" : "fixed right-4 top-4 z-40 sm:right-6 sm:top-6"} font-['Poppins',sans-serif]`}>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="relative grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-lg transition hover:text-slate-900"
          aria-label={`Staff notifications: ${unreadCount} unread`}
          aria-expanded={open}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-[min(27rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Notifications</p>
                <p className="text-[11px] text-slate-500">Inventory, refunds, and purchase orders</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close notifications">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <div className="flex gap-1">
                {(["unread", "read"] as const).map((key) => {
                  const count = key === "unread" ? unreadNotifications.length : readNotifications.length;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${tab === key ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                    >
                      {key} ({count})
                    </button>
                  );
                })}
              </div>
              {tab === "unread" && unreadCount > 0 && (
                <button type="button" disabled={markingAll} onClick={() => void markAllAsRead()} className="text-xs font-semibold text-slate-600 underline hover:text-slate-900 disabled:opacity-50">
                  {markingAll ? "Marking…" : "Mark all as read"}
                </button>
              )}
            </div>

            <div className="max-h-[min(65vh,32rem)] overflow-y-auto p-2">
              {loading && allNotifications.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-400">Loading notifications…</p>
              ) : error ? (
                <div className="p-3 text-center">
                  <p className="text-sm text-red-600">{error}</p>
                  <button type="button" onClick={() => void loadNotifications()} className="mt-2 text-xs font-semibold text-slate-700 underline">Try again</button>
                </div>
              ) : shownNotifications.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-400">
                  {tab === "unread" ? "No unread notifications." : "No read notifications yet."}
                </p>
              ) : (
                shownNotifications.map((notification) => {
                  const key = `${notification.source}:${notification.id}`;
                  const unread = !isRead(notification);
                  const inventory = notification.source === "inventory" ? notification.item : null;
                  const staff = notification.source === "staff" ? notification.item : null;
                  const isRefund = staff?.category === "refund_request";
                  const isInventoryChange = staff?.category === "inventory_change";
                  const iconClass = inventory ? SEVERITY_STYLES[inventory.severity]
                    : isRefund ? "bg-violet-100 text-violet-700"
                      : isInventoryChange ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700";
                  return (
                    <div key={key} className={`mb-1 flex gap-2 rounded-xl px-3 py-3 transition hover:bg-slate-100 ${unread ? "bg-slate-50" : "bg-white"}`}>
                      <button type="button" onClick={() => openNotification(notification)} className="flex min-w-0 flex-1 gap-3 text-left">
                        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${iconClass}`}>
                          {inventory?.severity === "out" ? <PackageX className="h-4 w-4" />
                            : inventory ? <AlertTriangle className="h-4 w-4" />
                              : isRefund ? <FileText className="h-4 w-4" />
                                  : isInventoryChange ? <AlertTriangle className="h-4 w-4" />
                                : staff?.event_type === "purchase_order.received" ? <PackageCheck className="h-4 w-4" />
                                  : <ShoppingCart className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className={`text-sm text-slate-800 ${unread ? "font-bold" : "font-medium"}`}>
                              {inventory ? inventory.product_name : staff?.title}
                            </span>
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                              {inventory ? "Inventory" : isRefund ? "Refund request" : isInventoryChange ? "Inventory write-off" : "Purchase order"}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {inventory ? `${inventory.mainStock} ${inventory.unit} remaining` : staff?.message}
                          </span>
                          <span className="mt-1 block text-[11px] text-slate-400">
                            {formatNotificationTime(createdAt(notification))}
                            {inventory ? inventory.resolved_at ? " · Resolved" : " · Active" : staff?.status ? ` · ${staff.status}` : ""}
                          </span>
                        </span>
                      </button>
                      {unread && (
                        <button type="button" disabled={markingKey === key} onClick={() => void markAsRead(notification)} className="h-fit shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50" aria-label="Mark notification as read">
                          {markingKey === key ? "…" : "Mark read"}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {selectedRefund && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="Refund request details">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Refund request review</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {metadataText(selectedRefund.metadata, "orderNumber") || `Order ${selectedRefund.entity_id}`}
                </h2>
              </div>
              <button type="button" onClick={() => setSelectedRefund(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close refund request details">
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Requested</dt>
                <dd className="mt-1 text-slate-800">{formatNotificationTime(selectedRefund.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Reason</dt>
                <dd className="mt-1 whitespace-pre-wrap text-slate-800">{metadataText(selectedRefund.metadata, "reason") || selectedRefund.message}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Current status</dt>
                <dd className="mt-1 font-semibold text-slate-800">{selectedRefund.status || "Pending"}</dd>
              </div>
            </dl>
            {selectedRefund.status === "Pending" ? (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" disabled={refundAction !== null} onClick={() => void reviewRefund("ignore")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  {refundAction === "ignore" ? "Ignoring…" : "Ignore"}
                </button>
                <button type="button" disabled={refundAction !== null} onClick={() => void reviewRefund("refund")} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                  {refundAction === "refund" ? "Refunding…" : "Take Action"}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setSelectedRefund(null)} className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Close</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
