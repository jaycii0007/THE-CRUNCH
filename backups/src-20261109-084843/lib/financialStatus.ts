export interface FinancialOrderLike {
  id: number | string;
  status?: string | null;
  paymentStatus?: string | null;
  total?: number | string | null;
}

function normalized(value?: string | null): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function normalizeFinancialOrderStatus(value?: string | null): string {
  const status = normalized(value);
  if (status === "picked up") return "completed";
  if (status === "canceled") return "cancelled";
  if (status === "ready for pickup") return "ready";
  if (status === "awaiting cashier review" || status === "pending payment") {
    return "pending";
  }
  return status;
}

export function isPaidPaymentStatus(value?: string | null): boolean {
  const status = normalized(value);
  return status === "paid" || status === "completed";
}

export function isFinalizedSale(
  order: Pick<FinancialOrderLike, "status" | "paymentStatus">,
): boolean {
  return (
    normalizeFinancialOrderStatus(order.status) === "completed" &&
    isPaidPaymentStatus(order.paymentStatus)
  );
}

export function isCancelledOrder(
  order: Pick<FinancialOrderLike, "status">,
): boolean {
  return normalizeFinancialOrderStatus(order.status) === "cancelled";
}

export function isRefundedOrder(
  order: Pick<FinancialOrderLike, "status">,
): boolean {
  return normalizeFinancialOrderStatus(order.status) === "refunded";
}

export function isActiveOrder(
  order: Pick<FinancialOrderLike, "status">,
): boolean {
  return !["completed", "cancelled", "refunded"].includes(
    normalizeFinancialOrderStatus(order.status),
  );
}

export function isPendingOrder(
  order: Pick<FinancialOrderLike, "status" | "paymentStatus">,
): boolean {
  return (
    isActiveOrder(order) &&
    (!isPaidPaymentStatus(order.paymentStatus) ||
      normalizeFinancialOrderStatus(order.status) === "pending")
  );
}

/**
 * The orders endpoint returns one row per line item. Callers normally group those
 * rows first, but this final ID-based guard prevents duplicate financial totals if
 * an upstream response repeats an order or a state-change event is replayed.
 * The last occurrence is the current state.
 */
export function deduplicateOrders<T extends FinancialOrderLike>(
  orders: readonly T[],
): T[] {
  const unique = new Map<string, T>();
  orders.forEach((order) => unique.set(String(order.id), order));
  return [...unique.values()];
}

export function summarizeFinancialOrders<T extends FinancialOrderLike>(
  input: readonly T[],
) {
  const orders = deduplicateOrders(input);
  const finalizedSales = orders.filter(isFinalizedSale);
  const totalSales = finalizedSales.reduce(
    (total, order) => total + (Number(order.total) || 0),
    0,
  );

  return {
    orders,
    finalizedSales,
    totalOrders: orders.length,
    finalizedSalesCount: finalizedSales.length,
    totalSales,
    averageOrderValue:
      finalizedSales.length > 0 ? totalSales / finalizedSales.length : 0,
    activeOrders: orders.filter(isActiveOrder).length,
    pendingOrders: orders.filter(isPendingOrder).length,
    cancelledOrders: orders.filter(isCancelledOrder).length,
    refundedOrders: orders.filter(isRefundedOrder).length,
  };
}
