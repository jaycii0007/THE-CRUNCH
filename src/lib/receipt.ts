export interface ReceiptItemDto {
  includedSelections?: { kind: string; name: string; qty: number }[];
  productName: string;
  quantity: number;
  unitPrice: number | null;
  subtotal: number | null;
  note: string | null;
  selectedFlavorProductId?: number | null;
  selectedFlavorName?: string | null;
}

export interface ReceiptAdjustmentDto {
  name?: string | null;
  rate: number | null;
  amount: number | null;
}

export interface ReceiptDto {
  id: number;
  transactionId: string | null;
  invoiceNumber?: string | null;
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
  customer: {
    soldTo: string | null;
  };
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

const SOCIAL_HANDLE = "@TheCrunchFairviewDahlia";
const WEBSITE = "www.thecrunch.site";
const INPUT_TAX_DISCLAIMER = "THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX";

// ---------- Helpers ----------
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const num = (v: number | null | undefined): v is number => v != null && Number.isFinite(Number(v));
const fmtNum = (v: number) => Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const money = (v: number | null | undefined, cur: string | null) => {
  if (!num(v)) return "—";
  const currency = String(cur || "").trim().toUpperCase();
  const prefix = currency === "PHP" ? "₱" : currency ? `${currency} ` : "";
  return `${prefix}${fmtNum(v)}`;
};
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
body{margin:0;padding:16px;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif;color:#111827}
.paper{width:320px;margin:0 auto;background:#fff;padding:22px 18px 28px;font-size:11px;line-height:1.45;box-shadow:0 8px 30px rgba(15,23,42,.18)}
h1{font-size:19px;text-align:center;margin:0 0 2px;text-transform:uppercase;letter-spacing:.05em}
p{margin:0}.c{text-align:center}.s{font-size:9.5px;color:#64748b}.b{font-weight:700}.label{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#64748b}
hr{border:0;border-top:1px dashed #94a3b8;margin:10px 0}hr.d{border-top:2px solid #111827}
table{width:100%;border-collapse:collapse}td,th{padding:2px 0;vertical-align:top;text-align:left}
th{font-size:9px;letter-spacing:.06em;border-bottom:1px solid #111827;padding-bottom:4px;text-transform:uppercase}
.r{text-align:right;white-space:nowrap;padding-left:8px}.q{width:34px}
.tot td{font-size:16px;font-weight:700;padding:4px 0}
.legacy{margin-bottom:8px;padding:6px 8px;border:1px dashed #000;font-size:10px}
.receipt-title{text-align:center;font-size:10px;font-weight:700;letter-spacing:.16em;margin-top:8px}.customer{padding:8px;background:#f8fafc;border-radius:6px}.item td{padding-top:5px;padding-bottom:5px;border-bottom:1px solid #e2e8f0}
.tax-disclaimer{margin-top:12px;padding-top:8px;border-top:1px dashed #111827;font-size:10px;font-weight:700;line-height:1.35;text-align:center}
${css}
@media print{@page{size:80mm auto;margin:0}body{background:#fff;padding:0}.paper{width:auto;box-shadow:none}}
</style></head><body><div class="paper">${body}</div></body></html>`;

const row = (l: string, v: string, cls = "") => `<tr class="${cls}"><td>${esc(l)}</td><td class="r">${esc(v)}</td></tr>`;

// ---------- Receipt ----------
export function buildReceiptHtml(r: ReceiptDto, opts: ReceiptOptions = {}): string {
  const cur = r.currency;
  const cashier = r.cashierName || opts.cashier || "";

  const info: [string, string][] = [
    ["Order #", r.orderNumber],
    ["Transaction ID", r.transactionId || ""],
    ["Invoice No.", r.invoiceNumber || "\u2014"],
    ["Date", formatReceiptDate(r)],
    ["Cashier", cashier],
    ["Order Type", orderTypeLabel(r.orderType) + (r.tableNumber ? ` / Table ${r.tableNumber}` : "")],
  ];

  const items = r.items.length
    ? r.items.map((i) => `<tr><td class="q">${esc(i.quantity)}x</td><td>${esc(i.productName)}${(i.includedSelections ?? []).map((choice) => `<div class="s">Included ${choice.kind === "drinks" ? "Drink" : "Sauce"}: ${esc(choice.name)} x${esc(choice.qty)}</div>`).join("")}${i.selectedFlavorName ? `<div class="s"><b>Sauce:</b> ${esc(i.selectedFlavorName)}</div>` : ""}<div class="s">@ ${esc(money(i.unitPrice, cur))}</div>${
        i.note ? `<div class="s">* ${esc(i.note)}</div>` : ""}</td><td class="r">${esc(money(i.subtotal, cur))}</td></tr>`).join("")
    : `<tr><td colspan="3">No item rows available.</td></tr>`;

  const hasDiscount = num(r.discount.amount) && r.discount.amount > 0;
  const extras = [
    row("Total Sales", money(r.subtotal, cur)),
    hasDiscount
      ? row(`Discount${r.discount.name ? ` (${r.discount.name})` : ""}${rate(r.discount.rate)}`, `-${money(r.discount.amount, cur)}`) : "",
    num(r.tax.amount) && r.tax.amount > 0 ? row(`${num(r.subtotal) && num(r.total) && Math.abs(r.total - (r.subtotal - Number(r.discount.amount ?? 0) + Number(r.serviceCharge.amount ?? 0))) < 0.01 ? "Included tax" : "Tax"}${rate(r.tax.rate)}`, money(r.tax.amount, cur)) : "",
    num(r.serviceCharge.amount) && r.serviceCharge.amount > 0 ? row(`Service Charge${rate(r.serviceCharge.rate)}`, money(r.serviceCharge.amount, cur)) : "",
  ].join("");

  const cashMethod = String(r.paymentMethod || "").trim().toLowerCase();
  const cashPayment = cashMethod === "cash" || (cashMethod === "cash_on_pickup" &&
    ["paid", "refunded"].includes(String(r.currentPaymentStatus || "").trim().toLowerCase()));
  const payment =
    (r.paymentMethod ? row("Payment", paymentLabel(r.paymentMethod)) : "") +
    (cashPayment && num(r.cashTendered)
      ? row("Cash Tendered", money(r.cashTendered, cur))
      : num(r.amountPaid) && r.amountPaid > 0
        ? row("Amount Received", money(r.amountPaid, cur))
        : "") +
    (cashPayment && num(r.cashTendered) && num(r.change) ? row("Change", money(r.change, cur), "b") : "");

  const merchantName = r.merchant.name || "The Crunch";
  const merchantLines = [r.merchant.address, r.merchant.phone, r.merchant.email].filter(Boolean);
  const customer = r.customer || { soldTo: null };
  const customerValue = (value: string | null) => value ? esc(value) : "________________________";
  const blankCustomerLine = "________________________";

  return PAGE(`Receipt ${r.orderNumber}`, "", `
<h1>${esc(merchantName)}</h1>
${r.merchant.tagline ? `<p class="c s">${esc(r.merchant.tagline)}</p>` : ""}
${merchantLines.map((line) => `<p class="c s">${esc(line)}</p>`).join("")}
<p class="receipt-title">ORDER / TRANSACTION RECEIPT</p>
<hr/>
<table>${info.filter(([, v]) => v).map(([l, v]) => row(l, v)).join("")}</table>
<hr/><div class="customer"><p class="label">Customer information</p><p><b>Sold To / Registered Name:</b> ${customerValue(customer.soldTo)}</p><p><b>TIN:</b> ${blankCustomerLine}</p><p><b>Business Address:</b> ${blankCustomerLine}</p></div>
<hr/>
<table><tr><th class="q">Qty</th><th>Description</th><th class="r">Amount</th></tr><tbody class="item">${items}</tbody></table>
<hr/>
${extras ? `<table>${extras}</table><hr/>` : ""}
<table>${row("Total Due", money(r.total, cur), "tot")}</table>
<hr/>
<table>${payment}</table>
${r.orderNote ? `<hr/><p><b>Note:</b> ${esc(r.orderNote)}</p>` : ""}
<hr class="d"/>
<p class="c b" style="font-size:14px">THANK YOU!</p>
<p class="c">Please come again</p>
<p class="c b" style="margin-top:10px">Follow us</p>
<p class="c">${esc(SOCIAL_HANDLE)}</p>
<p class="c b" style="margin-top:10px">Visit us at</p>
<p class="c">${esc(WEBSITE)}</p>
<p class="tax-disclaimer">${esc(INPUT_TAX_DISCLAIMER)}</p>`);
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
<table class="k">${r.items.map((i) => `<tr><td class="q">${esc(i.quantity)}x</td><td>${esc(i.productName)}${(i.includedSelections ?? []).map((choice) => `<div class="s">Included ${choice.kind === "drinks" ? "Drink" : "Sauce"}: ${esc(choice.name)} x${esc(choice.qty)}</div>`).join("")}${i.selectedFlavorName ? `<div class="s">Sauce: ${esc(i.selectedFlavorName)}</div>` : ""}${i.note ? `<div class="s">Note: ${esc(i.note)}</div>` : ""}</td></tr>`).join("")}</table>
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
