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

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatNumber = (value: number) => {
  const [integer, decimal] = Number(value).toFixed(2).split(".");
  return (decimal === "00" ? integer : `${integer}.${decimal}`).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );
};

const formatMoney = (value: number | null, currency: string | null) => {
  if (value === null || !Number.isFinite(Number(value))) return "Unavailable";
  const prefix = currency ? `${escapeHtml(currency)} ` : "";
  return `${prefix}${formatNumber(Number(value))}`;
};

const formatRate = (rate: number | null) =>
  rate === null || !Number.isFinite(Number(rate))
    ? ""
    : ` (${formatNumber(Number(rate))}%)`;

const formatPaymentMethod = (value: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Unavailable";
  if (normalized === "cash") return "Cash";
  if (normalized === "gcash") return "GCash";
  if (normalized === "cash_on_pickup") return "Cash on Pickup";
  if (normalized === "gcash_onsite") return "Onsite GCash / E-Payment";
  return String(value);
};

function formatOrderDate(receipt: ReceiptDto) {
  const parsed = new Date(receipt.orderDate);
  if (Number.isNaN(parsed.getTime())) {
    return { date: String(receipt.orderDate || "Unavailable"), time: "Unavailable" };
  }
  const timeZone = receipt.merchant.timezone || "Asia/Manila";
  try {
    return {
      date: new Intl.DateTimeFormat("en-PH", {
        timeZone,
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(parsed),
      time: new Intl.DateTimeFormat("en-PH", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(parsed),
    };
  } catch {
    return { date: parsed.toLocaleDateString(), time: parsed.toLocaleTimeString() };
  }
}

export function buildReceiptHtml(receipt: ReceiptDto): string {
  const { date, time } = formatOrderDate(receipt);
  const merchantName = receipt.merchant.name || "The Crunch";
  const headerMeta = [
    receipt.merchant.tagline,
    receipt.merchant.address,
    receipt.merchant.phone,
    receipt.merchant.email,
  ]
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
  const itemRows = receipt.items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.productName)}${item.note ? `<br/><small>${escapeHtml(item.note)}</small>` : ""}</td>
        <td class="qty">${escapeHtml(item.quantity)}</td>
        <td class="amount">${formatMoney(item.unitPrice, receipt.currency)}</td>
        <td class="amount">${formatMoney(item.subtotal, receipt.currency)}</td>
      </tr>`,
    )
    .join("");
  const currentStatus = receipt.currentStatus
    ? `<div class="line"><span>Current Status</span><strong>${escapeHtml(receipt.currentStatus)}</strong></div>`
    : "";
  const legacyNotice = receipt.isLegacyReceipt
    ? `<div class="legacy">Legacy transaction — some original receipt details are unavailable.${receipt.usesCurrentProductNameFallback ? " Product names shown are current catalog fallbacks." : ""}</div>`
    : "";
  const orderNote = receipt.orderNote
    ? `<div class="note"><b>Order Note</b><p>${escapeHtml(receipt.orderNote)}</p></div>`
    : "";
  const tableRow = receipt.tableNumber
    ? `<div class="line"><span>Table</span><strong>${escapeHtml(receipt.tableNumber)}</strong></div>`
    : "";
  const cashRows = receipt.paymentMethod === "cash"
    ? `<div class="line"><span>Cash Tendered</span><strong>${formatMoney(receipt.cashTendered, receipt.currency)}</strong></div>
       <div class="line"><span>Change</span><strong>${formatMoney(receipt.change, receipt.currency)}</strong></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Receipt ${escapeHtml(receipt.orderNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Poppins', Arial, sans-serif; background: #f5f5f5; color: #111; margin: 0; padding: 24px; }
    .receipt { max-width: 420px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 24px; }
    .header { text-align: center; padding-bottom: 16px; border-bottom: 1px dashed #d1d5db; margin-bottom: 16px; }
    .header h1 { font-size: 22px; margin: 0 0 4px; }
    .header p, .footer p { margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6; }
    .txn-badge { display: inline-block; margin-top: 10px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 4px 12px; }
    .txn-label { display: block; font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .07em; }
    .txn-value { font-size: 13px; font-weight: 700; letter-spacing: .04em; }
    .meta, .summary { display: grid; gap: 8px; margin-bottom: 16px; }
    .line { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { padding: 8px 0; border-bottom: 1px dashed #e5e7eb; font-size: 12px; text-align: left; vertical-align: top; }
    small { color: #9ca3af; }
    .qty { text-align: center; width: 44px; }
    .amount { text-align: right; white-space: nowrap; }
    .total { padding-top: 12px; border-top: 1px solid #111; margin-top: 12px; font-size: 15px; }
    .legacy { margin: 0 0 14px; padding: 9px 11px; border: 1px solid #fde68a; border-radius: 9px; background: #fffbeb; color: #92400e; font-size: 11px; line-height: 1.5; }
    .note { margin: 12px 0; padding: 8px 12px; background: #f9fafb; border-radius: 8px; border: 1px dashed #e5e7eb; font-size: 11px; color: #6b7280; }
    .note b { text-transform: uppercase; letter-spacing: .06em; }
    .note p { margin: 4px 0 0; font-size: 12px; color: #374151; }
    .footer { margin-top: 20px; text-align: center; border-top: 1px dashed #d1d5db; padding-top: 16px; }
    @media print { body { background: #fff; padding: 0; } .receipt { border: 0; border-radius: 0; max-width: none; padding: 0; } }
  </style>
</head>
<body>
  <main class="receipt">
    <section class="header">
      <h1>${escapeHtml(merchantName)}</h1>
      <p>Official Sales Receipt</p>
      ${headerMeta}
      <div class="txn-badge"><span class="txn-label">Transaction ID</span><span class="txn-value">${escapeHtml(receipt.transactionId || "N/A")}</span></div>
    </section>
    ${legacyNotice}
    <section class="meta">
      <div class="line"><span>Order Number</span><strong>${escapeHtml(receipt.orderNumber)}</strong></div>
      <div class="line"><span>Date</span><strong>${escapeHtml(date)}</strong></div>
      <div class="line"><span>Time</span><strong>${escapeHtml(time)}</strong></div>
      <div class="line"><span>Order Type</span><strong>${escapeHtml(receipt.orderType || "Unavailable")}</strong></div>
      <div class="line"><span>Payment</span><strong>${escapeHtml(formatPaymentMethod(receipt.paymentMethod))}</strong></div>
      <div class="line"><span>Customer Type</span><strong>${escapeHtml(receipt.customerType || receipt.discount.name || "Unavailable")}</strong></div>
      ${tableRow}
      ${currentStatus}
    </section>
    ${orderNote}
    <table>
      <thead><tr><th>Item</th><th class="qty">Qty</th><th class="amount">Price</th><th class="amount">Subtotal</th></tr></thead>
      <tbody>${itemRows || `<tr><td colspan="4">No historical item rows available.</td></tr>`}</tbody>
    </table>
    <section class="summary">
      <div class="line"><span>Subtotal</span><strong>${formatMoney(receipt.subtotal, receipt.currency)}</strong></div>
      <div class="line"><span>Discount${receipt.discount.name ? ` (${escapeHtml(receipt.discount.name)})` : ""}${formatRate(receipt.discount.rate)}</span><strong>${receipt.discount.amount === null ? "Unavailable" : `-${formatMoney(receipt.discount.amount, receipt.currency)}`}</strong></div>
      <div class="line"><span>Tax${formatRate(receipt.tax.rate)}</span><strong>${formatMoney(receipt.tax.amount, receipt.currency)}</strong></div>
      <div class="line"><span>Service Charge${formatRate(receipt.serviceCharge.rate)}</span><strong>${formatMoney(receipt.serviceCharge.amount, receipt.currency)}</strong></div>
      ${cashRows}
      <div class="line total"><span>Total</span><strong>${formatMoney(receipt.total, receipt.currency)}</strong></div>
      <div class="line"><span>Amount Paid</span><strong>${formatMoney(receipt.amountPaid, receipt.currency)}</strong></div>
    </section>
    <section class="footer"><p>Thank you for your order.</p><p>Please keep this receipt for your records.</p></section>
  </main>
</body>
</html>`;
}
