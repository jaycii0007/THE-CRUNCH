import type { ApplicationEvent } from "@/hooks/use-event-invalidation";

interface DeliveryRequest {
  createdAt: string;
  trackingStatus: string;
  paymentStatus?: string | null;
  delivery?: { fee: number | null } | null;
}

export function isAwaitingDeliveryFee(order: DeliveryRequest) {
  return Boolean(order.delivery && order.delivery.fee == null && order.paymentStatus !== "Paid" && order.trackingStatus === "Awaiting Cashier Review");
}

export function deliveryWaitingState(order: DeliveryRequest, now: number) {
  if (!isAwaitingDeliveryFee(order)) return null;
  const created = new Date(order.createdAt).getTime();
  if (!Number.isFinite(created)) return null;
  const seconds = Math.max(0, Math.floor((now - created) / 1000));
  return {
    label: seconds >= 300 ? "Needs Attention" : seconds >= 180 ? "Waiting" : "Awaiting Delivery Fee",
    tone: seconds >= 300 ? "red" : seconds >= 180 ? "amber" : "normal",
    elapsed: `Waiting ${Math.floor(seconds / 60)}m ${seconds % 60}s`,
  };
}

export function prioritizeDeliveryRequests<T extends DeliveryRequest>(orders: readonly T[]): T[] {
  const waiting = orders.filter(isAwaitingDeliveryFee);
  const timestamp = (order: T) => {
    const value = new Date(order.createdAt).getTime();
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  };
  waiting.sort((a, b) => timestamp(a) - timestamp(b));
  return [...waiting, ...orders.filter(order => !isAwaitingDeliveryFee(order))];
}

export function createOnlineArrivalTracker(storage?: Pick<Storage, "getItem" | "setItem">, storageKey = "cashier-order-arrivals") {
  const seen = new Set<number>();
  let ready = false;
  try {
    const saved: unknown = JSON.parse(storage?.getItem(storageKey) || "[]");
    if (Array.isArray(saved)) for (const id of saved) if (Number.isSafeInteger(id) && id > 0) seen.add(id);
  } catch { /* In-memory deduplication works when storage is unavailable. */ }
  const remember = () => { try { storage?.setItem(storageKey, JSON.stringify([...seen])); } catch { /* Storage may be full or blocked. */ } };
  return {
    seed(orders: readonly { id: number }[]) {
      for (const order of orders) seen.add(Number(order.id));
      ready = true;
      remember();
    },
    accept(event: ApplicationEvent) {
      const arrival = event.arrival;
      if (event.topic !== "orders.changed" || !arrival || !Number.isSafeInteger(arrival.orderId) || arrival.orderId <= 0 || typeof arrival.orderNumber !== "string") return null;
      if (!((arrival.kind === "pickup" && event.reason === "order.created") || (arrival.kind === "delivery" && event.reason === "delivery.requested"))) return null;
      if (seen.has(arrival.orderId)) return null;
      seen.add(arrival.orderId);
      remember();
      return ready ? arrival : null;
    },
  };
}

// Shared playback prevents concurrent alerts from overlapping across existing callers.
let notificationAudio: HTMLAudioElement | null = null;
let lastNotificationAt = 0;

export async function playOrderArrivalTone(context?: AudioContext) {
  if (context && context.state !== "running") return false;
  const now = Date.now();
  if (notificationAudio && (!notificationAudio.paused || now - lastNotificationAt < 1000)) return true;
  notificationAudio ??= new Audio("/sounds/notif_53.mp3");
  lastNotificationAt = now;
  notificationAudio.currentTime = 0;
  try {
    await notificationAudio.play();
    return true;
  } catch {
    return false;
  }
}
