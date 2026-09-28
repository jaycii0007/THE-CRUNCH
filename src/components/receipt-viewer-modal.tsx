import { useMemo, useRef } from "react";
import { Loader2, Printer, X } from "lucide-react";
import { buildReceiptHtml, type ReceiptDto } from "@/lib/receipt";

export function ReceiptViewerModal({
  open,
  receipt,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  receipt: ReceiptDto | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const receiptHtml = useMemo(
    () => (receipt ? buildReceiptHtml(receipt) : ""),
    [receipt],
  );
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <p className="text-sm font-bold text-slate-900">Historical Receipt</p>
            <p className="text-xs text-slate-500">{receipt?.orderNumber || "Loading transaction…"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!receipt || loading}
              onClick={() => frameRef.current?.contentWindow?.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              <Printer size={14} /> Print Receipt
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close receipt">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-slate-100 p-3">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={18} /> Loading receipt…</div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-sm font-medium text-red-600">{error}</div>
          ) : receipt ? (
            <iframe ref={frameRef} title={`Receipt ${receipt.orderNumber}`} srcDoc={receiptHtml} className="h-full w-full rounded-xl border border-slate-200 bg-white" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
