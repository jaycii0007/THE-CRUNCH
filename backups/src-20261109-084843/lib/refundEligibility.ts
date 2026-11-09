import { isPaidPaymentStatus } from "@/lib/financialStatus";

export interface RefundOrderLike {
  status?: string | null;
  paymentStatus?: string | null;
  preparationStarted?: boolean | null;
  prepStartedAt?: string | number | Date | null;
  startedAt?: string | number | Date | null;
  readyAt?: string | number | Date | null;
}

export type SettlementAction = "refund" | "cancel" | null;

const REFUNDABLE_STATUSES = new Set([
  "queued",
  "pending",
  "awaiting cashier review",
]);
const PREPARATION_STATUSES = new Set([
  "preparing",
  "ready",
  "ready for pickup",
  "completed",
  "picked up",
]);

function normalize(value?: string | null): string {
  return String(value ?? "").trim().toLowerCase();
}

export function hasPreparationStarted(order: RefundOrderLike): boolean {
  return (
    Boolean(
      order.preparationStarted ||
        order.prepStartedAt ||
        order.startedAt ||
        order.readyAt,
    ) || PREPARATION_STATUSES.has(normalize(order.status))
  );
}

export function getRefundEligibility(order: RefundOrderLike) {
  const status = normalize(order.status);
  if (status === "refunded") {
    return { eligible: false, reason: "This order has already been refunded." };
  }
  if (status === "cancelled" || status === "canceled") {
    return { eligible: false, reason: "Cancelled orders cannot be refunded." };
  }
  if (!isPaidPaymentStatus(order.paymentStatus)) {
    return {
      eligible: false,
      reason: "Only paid orders can be refunded. Pending-payment orders may only be cancelled.",
    };
  }
  if (hasPreparationStarted(order)) {
    return {
      eligible: false,
      reason: "This order cannot be refunded because food preparation has already started.",
    };
  }
  if (!REFUNDABLE_STATUSES.has(status)) {
    return { eligible: false, reason: "This order is no longer eligible for a refund." };
  }
  return { eligible: true, reason: "Refund permitted." };
}

export function isRefundEligible(order: RefundOrderLike): boolean {
  return getRefundEligibility(order).eligible;
}

export function getSettlementAction(order: RefundOrderLike): SettlementAction {
  if (isRefundEligible(order)) return "refund";

  const status = normalize(order.status);
  const canCancelUnpaidPending =
    !isPaidPaymentStatus(order.paymentStatus) &&
    !hasPreparationStarted(order) &&
    ["pending payment", "pending", "queued", "awaiting cashier review"].includes(status);
  return canCancelUnpaidPending ? "cancel" : null;
}
