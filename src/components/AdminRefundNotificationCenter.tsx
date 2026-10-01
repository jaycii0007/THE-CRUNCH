import { useCallback, useEffect, useState } from "react";
import { BellRing, RotateCcw, X } from "lucide-react";
import { api } from "@/lib/api";
import { useEventInvalidation } from "@/hooks/use-event-invalidation";
import { useConfirm, useNotifications } from "@/lib/NotificationContext";
import { normalizeRole } from "@/lib/permissions";

interface RefundRequestItem {
  name: string;
  quantity: number;
  price: number;
}

interface RefundRequest {
  id: number;
  type: "refund_request";
  orderId: number;
  orderNumber: string;
  requester: { id: number; name: string; role: string };
  requestedAt: string;
  status: "Pending" | "Ignored" | "Actioned";
  order: {
    orderType: string | null;
    paymentMethod: string | null;
    total: number;
    status: string;
    paymentStatus: string;
    items: RefundRequestItem[];
  };
}

// Temporarily disabled for beta testing. Keep the implementation intact so the
// refund-request UI can be re-enabled after the workflow is fixed.
const REFUND_REQUEST_UI_ENABLED = false;

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

function canStillRefund(request: RefundRequest) {
  const status = request.order.status.trim().toLowerCase();
  return request.order.paymentStatus.trim().toLowerCase() === "paid" &&
    status !== "refunded" && status !== "cancelled";
}

export function AdminRefundNotificationCenter({ role }: { role: unknown }) {
  const enabled = REFUND_REQUEST_UI_ENABLED && normalizeRole(role) === "administrator";
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [selected, setSelected] = useState<RefundRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<"ignore" | "refund" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const { addNotification } = useNotifications();

  const notify = useCallback(
    (label: string, type: "success" | "error" | "warning" | "info") =>
      addNotification({ id: crypto.randomUUID(), label, type }),
    [addNotification],
  );

  const loadRequests = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const result = await api.get<RefundRequest[]>("/refund-requests?status=Pending");
      const pending = Array.isArray(result) ? result : [];
      setRequests(pending);
      setSelected((current) =>
        current
          ? pending.find((request) => request.id === current.id) ?? null
          : null,
      );
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load refund requests.",
      );
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEventInvalidation({
    topics: ["refundRequests.changed"],
    onInvalidate: loadRequests,
    enabled,
    debounceMs: 150,
  });

  // The invalidation hook refreshes after reconnect/focus; load immediately too.
  useEffect(() => {
    if (enabled) void loadRequests();
  }, [enabled, loadRequests]);

  if (!enabled) return null;

  const ignoreRequest = async () => {
    if (!selected || acting) return;
    const approved = await confirm({
      title: "Ignore refund request?",
      message: `This resolves the request for ${selected.orderNumber} without changing the order, payment, or inventory.`,
      confirmLabel: "Ignore Request",
      cancelLabel: "Cancel",
    });
    if (!approved) return;
    setActing("ignore");
    try {
      await api.patch(`/refund-requests/${selected.id}/ignore`, {});
      notify("Refund request ignored. The order was not changed.", "success");
      setSelected(null);
      await loadRequests();
    } catch (actionError) {
      notify(
        actionError instanceof Error ? actionError.message : "Unable to ignore the request.",
        "error",
      );
      await loadRequests();
    } finally {
      setActing(null);
    }
  };

  const takeAction = async () => {
    if (!selected || acting || !canStillRefund(selected)) return;
    const approved = await confirm({
      title: `Refund ${selected.orderNumber}?`,
      message:
        "Confirm the actual refund. The existing secure refund workflow will update payment and apply its preparation-based inventory restoration rules.",
      confirmLabel: "Confirm Refund",
      cancelLabel: "Cancel",
      danger: true,
    });
    // Cancelling this confirmation intentionally leaves the request Pending.
    if (!approved) return;
    setActing("refund");
    try {
      await api.patch(`/orders/${selected.orderId}`, { status: "Refunded" });
      notify(`${selected.orderNumber} was refunded successfully.`, "success");
      setSelected(null);
      await loadRequests();
    } catch (actionError) {
      notify(
        actionError instanceof Error
          ? actionError.message
          : "The order could not be refunded.",
        "error",
      );
      await loadRequests();
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="fixed right-4 top-4 z-[45] font-['Poppins',sans-serif] sm:right-6 sm:top-6">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-lg transition hover:text-slate-900"
        aria-label={`Refund requests: ${requests.length} pending`}
        aria-expanded={open}
      >
        <BellRing className="h-5 w-5" />
        {requests.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-amber-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white">
            {requests.length > 99 ? "99+" : requests.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Refund requests</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Administrator review required</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close refund notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[min(65vh,30rem)] overflow-y-auto p-2">
            {loading && requests.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-400">Loading requests…</p>
            ) : error ? (
              <div className="p-3 text-center">
                <p className="text-sm text-red-600">{error}</p>
                <button type="button" onClick={() => void loadRequests()} className="mt-2 text-xs font-semibold underline">
                  Try again
                </button>
              </div>
            ) : requests.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-400">No pending refund requests.</p>
            ) : (
              requests.map((request) => (
                <button
                  type="button"
                  key={request.id}
                  onClick={() => {
                    setSelected(request);
                    setOpen(false);
                  }}
                  className="mb-1 flex w-full gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-amber-50"
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
                    <RotateCcw className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800">Refund Request · {request.orderNumber}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Cashier {request.requester.name} requested Administrator review.
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !acting) setSelected(null);
        }}>
          <section className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="refund-request-title">
            <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Refund Request</p>
                <h2 id="refund-request-title" className="mt-1 text-2xl font-bold text-slate-900">{selected.orderNumber}</h2>
              </div>
              <button type="button" disabled={!!acting} onClick={() => setSelected(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Close refund request">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Requested by", selected.requester.name],
                  ["Requested", new Date(selected.requestedAt).toLocaleString()],
                  ["Order type", selected.order.orderType || "Not recorded"],
                  ["Payment", selected.order.paymentMethod || "Not recorded"],
                  ["Current status", selected.order.status],
                  ["Payment status", selected.order.paymentStatus],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                    <dd className="mt-1 font-semibold capitalize text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 rounded-2xl border border-slate-100 p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Items</p>
                <div className="space-y-2 text-sm">
                  {selected.order.items.length === 0 ? (
                    <p className="text-slate-400">No item details are available.</p>
                  ) : selected.order.items.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex justify-between gap-4">
                      <span className="text-slate-700">{item.quantity}× {item.name}</span>
                      <span className="font-medium text-slate-900">{money.format(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-100 pt-3 font-bold">
                    <span>Total</span>
                    <span>{money.format(selected.order.total)}</span>
                  </div>
                </div>
              </div>

              {!canStillRefund(selected) && (
                <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  This order is no longer eligible for refund. Its current state is shown above.
                </p>
              )}
            </div>

            <footer className="grid grid-cols-2 gap-3 border-t border-slate-100 px-6 py-5">
              <button type="button" disabled={!!acting} onClick={() => void ignoreRequest()} className="h-11 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {acting === "ignore" ? "Ignoring…" : "Ignore"}
              </button>
              <button type="button" disabled={!!acting || !canStillRefund(selected)} onClick={() => void takeAction()} className="h-11 rounded-xl bg-slate-900 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                {acting === "refund" ? "Refunding…" : "Take Action"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
