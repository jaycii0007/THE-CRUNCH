export interface ReceiptItemDto {
  productName: string;
  quantity: number;
  unitPrice: number | null;
  subtotal: number | null;
  note: string | null;
}

export interface ReceiptAdjustmentDto {
  name?: string | null;
  rate: number | null;
  amount: number | null;
}

export interface ReceiptDto {
  id: number;
  transactionId: string | null;
  orderNumber: string;
  orderDate: string;
  orderType: string | null;
  currentStatus: string | null;
  currentPaymentStatus: string | null;
  items: ReceiptItemDto[];
  subtotal: number | null;
  discount: ReceiptAdjustmentDto;
  tax: ReceiptAdjustmentDto;
  serviceCharge: ReceiptAdjustmentDto;
  total: number | null;
  paymentMethod: string | null;
  amountPaid: number | null;
  cashTendered: number | null;
  change: number | null;
  customerType: string | null;
  tableNumber: string | null;
  orderNote: string | null;
  currency: string | null;
  /** Name of the cashier who processed the order. Have the API send this; the UI can also supply it. */
  cashierName?: string | null;
  merchant: {
    name: string | null;
    tagline: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    timezone: string | null;
  };
  isLegacyReceipt: boolean;
  usesCurrentProductNameFallback: boolean;
  missingHistoricalFields: string[];
}

export interface ReceiptOptions {
  /** Used when the DTO has no cashierName (e.g. the logged-in user). */
  cashier?: string | null;
}

// ---------- Store details (edit these) ----------
const STORE_NAME = "The Crunch";
const STORE_ADDRESS = ["6 Falcon St., cor Dahlia Fairview,", "Quezon City, Philippines"];
const SOCIAL_HANDLE = "@TheCrunchFairviewDahlia";
const WEBSITE = "www.thecrunch.site";

// ---------- Helpers ----------
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const num = (v: number | null | undefined): v is number => v != null && Number.isFinite(Number(v));
const fmtNum = (v: number) => Number(v).toFixed(2).replace(/\.00$/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const money = (v: number | null | undefined, cur: string | null) => (num(v) ? `${cur ? `${cur} ` : ""}${fmtNum(v)}` : "—");
const rate = (r: number | null) => (num(r) ? ` ${fmtNum(r)}%` : "");
const cap = (s: string) => s.replace(/(^|[-\s_])\w/g, (m) => m.toUpperCase());

const PAYMENT: Record<string, string> = {
  cash: "Cash", gcash: "GCash", cash_on_pickup: "Cash on Pickup", gcash_onsite: "Onsite GCash / E-Payment",
};
const paymentLabel = (v: string | null) => (v ? PAYMENT[v.trim().toLowerCase()] ?? v : "");

const orderTypeLabel = (v: string | null) => {
  const t = (v ?? "").toLowerCase().replace(/[\s_-]/g, "");
  if (t.includes("dine")) return "Dine-In";
  if (t.includes("take") || t.includes("pickup") || t.includes("togo")) return "Take Out";
  return v ? cap(v) : "";
};

export function formatReceiptDate(r: ReceiptDto): string {
  const d = new Date(r.orderDate);
  if (Number.isNaN(d.getTime())) return String(r.orderDate || "");
  try {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: r.merchant.timezone || "Asia/Manila",
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

const PAGE = (title: string, css: string, body: string) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>${esc(title)}</title><style>
*{box-sizing:border-box}
body{margin:0;padding:16px;background:#e5e5e5;font-family:'Courier New',ui-monospace,monospace;color:#000}
.paper{width:302px;margin:0 auto;background:#fff;padding:20px 16px 26px;font-size:12px;line-height:1.45;box-shadow:0 2px 14px rgba(0,0,0,.18)}
h1{font-size:18px;text-align:center;margin:0 0 2px;text-transform:uppercase;letter-spacing:.06em}
p{margin:0}.c{text-align:center}.s{font-size:10px;color:#555}.b{font-weight:700}
hr{border:0;border-top:1px dashed #000;margin:10px 0}hr.d{border-top:2px solid #000}
table{width:100%;border-collapse:collapse}td,th{padding:2px 0;vertical-align:top;text-align:left}
th{font-size:10px;letter-spacing:.05em;border-bottom:1px solid #000;padding-bottom:3px}
.r{text-align:right;white-space:nowrap;padding-left:8px}.q{width:34px}
.tot td{font-size:16px;font-weight:700;padding:4px 0}
.legacy{margin-bottom:8px;padding:6px 8px;border:1px dashed #000;font-size:10px}
${css}
@media print{@page{size:80mm auto;margin:0}body{background:#fff;padding:0}.paper{width:auto;box-shadow:none}}
</style></head><body><div class="paper">${body}</div></body></html>`;

const row = (l: string, v: string, cls = "") => `<tr class="${cls}"><td>${esc(l)}</td><td class="r">${esc(v)}</td></tr>`;

// ---------- Receipt ----------
export function buildReceiptHtml(r: ReceiptDto, opts: ReceiptOptions = {}): string {
  const cur = r.currency;
  const cashier = r.cashierName || opts.cashier || "";
  const isCash = String(r.paymentMethod).toLowerCase() === "cash";

  const info: [string, string][] = [
    ["Order #", r.orderNumber],
    ["Transaction ID", r.transactionId || ""],
    ["Date", formatReceiptDate(r)],
    ["Cashier", cashier],
    ["Order Type", orderTypeLabel(r.orderType) + (r.tableNumber ? ` / Table ${r.tableNumber}` : "")],
  ];

  const items = r.items.length
    ? r.items.map((i) => `<tr><td class="q">${esc(i.quantity)}x</td><td>${esc(i.productName)}<div class="s">@ ${esc(money(i.unitPrice, cur))}</div>${
        i.note ? `<div class="s">* ${esc(i.note)}</div>` : ""}</td><td class="r">${esc(money(i.subtotal, cur))}</td></tr>`).join("")
    : `<tr><td colspan="3">No item rows available.</td></tr>`;

  const hasDiscount = num(r.discount.amount) && r.discount.amount > 0;
  const extras = [
    hasDiscount ? row("Subtotal", money(r.subtotal, cur)) : "",
    hasDiscount
      ? row(`Discount${r.discount.name ? ` (${r.discount.name})` : ""}${rate(r.discount.rate)}`, `-${money(r.discount.amount, cur)}`) : "",
    num(r.tax.amount) && r.tax.amount > 0 ? row(`Tax${rate(r.tax.rate)}`, money(r.tax.amount, cur)) : "",
    num(r.serviceCharge.amount) && r.serviceCharge.amount > 0 ? row(`Service Charge${rate(r.serviceCharge.rate)}`, money(r.serviceCharge.amount, cur)) : "",
  ].join("");

  const payment =
    (r.paymentMethod ? row("Payment", paymentLabel(r.paymentMethod)) : "") +
    (isCash && num(r.cashTendered) ? row("Cash Tendered", money(r.cashTendered, cur)) : "") +
    (num(r.change) ? row("Change", money(r.change, cur), "b") : "");

  return PAGE(`Receipt ${r.orderNumber}`, "", `
<h1>${esc(STORE_NAME)}</h1>
${STORE_ADDRESS.map((l) => `<p class="c s">${esc(l)}</p>`).join("")}
<hr/>
<table>${info.filter(([, v]) => v).map(([l, v]) => row(l, v)).join("")}</table>
<hr/>
<table><tr><th class="q">QTY</th><th>MENU</th><th class="r">PRICE</th></tr>${items}</table>
<hr/>
${extras ? `<table>${extras}</table><hr/>` : ""}
<table>${row("TOTAL", money(r.total, cur), "tot")}</table>
<hr/>
<table>${payment}</table>
${r.orderNote ? `<hr/><p><b>Note:</b> ${esc(r.orderNote)}</p>` : ""}
<hr class="d"/>
<p class="c b" style="font-size:14px">THANK YOU!</p>
<p class="c">Please come again</p>
<p class="c b" style="margin-top:10px">Follow us</p>
<p class="c">${esc(SOCIAL_HANDLE)}</p>
<p class="c b" style="margin-top:10px">Visit us at</p>
<p class="c">${esc(WEBSITE)}</p>`);
}

// ---------- Kitchen order ticket ----------
/** Kitchen order ticket: items, notes and table only. */
export function buildKotHtml(r: ReceiptDto, opts: ReceiptOptions = {}): string {
  const cashier = r.cashierName || opts.cashier || "";
  return PAGE(`KOT ${r.orderNumber}`,
    ".k td{font-size:16px;font-weight:700;border-bottom:1px dashed #999;padding:6px 0}.k .q{font-size:20px;font-weight:900}", `
<h1 style="font-size:14px">Kitchen Order Ticket</h1>
<p class="c b" style="font-size:22px;margin:6px 0">${esc(r.orderNumber)}</p>
<p class="c s">${esc(formatReceiptDate(r))}</p>
<p class="c b" style="margin-top:4px">${esc(orderTypeLabel(r.orderType).toUpperCase())}${r.tableNumber ? ` / TABLE ${esc(r.tableNumber)}` : ""}</p>
<hr class="d"/>
<table class="k">${r.items.map((i) => `<tr><td class="q">${esc(i.quantity)}x</td><td>${esc(i.productName)}${i.note ? `<div class="s">Note: ${esc(i.note)}</div>` : ""}</td></tr>`).join("")}</table>
${r.orderNote ? `<p style="margin-top:12px;padding:8px;border:2px dashed #000"><b>Note:</b> ${esc(r.orderNote)}</p>` : ""}
${cashier ? `<p class="c s" style="margin-top:10px">Cashier: ${esc(cashier)}</p>` : ""}`);
}

// ---------- Print / download ----------
/** Opens HTML in a popup and opens the print dialog. */
export function printHtml(html: string, w = 420, h = 760) {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const win = window.open(url, "_blank", `width=${w},height=${h}`);
  win?.addEventListener("load", () => win.print());
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadHtml(html: string, name: string) {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}