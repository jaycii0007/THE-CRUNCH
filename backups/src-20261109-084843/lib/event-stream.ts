export type ApplicationEventTopic =
  | "orders.changed"
  | "payments.changed"
  | "inventory.changed"
  | "products.changed"
  | "refundRequests.changed"
  | "purchaseOrders.changed";

export interface ParsedSseEvent {
  event: string;
  data: string;
}

export function parseSseBlock(block: string): ParsedSseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return data.length ? { event, data: data.join("\n") } : null;
}

export function createDebouncedInvalidator(
  callback: () => void,
  delayMs: number,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule() {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        callback();
      }, delayMs);
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}

export function getReconnectDelay(attempt: number, maximumMs = 15_000) {
  return Math.min(maximumMs, 1_000 * 2 ** Math.min(Math.max(0, attempt), 4));
}

export function createConnectionRecoveryTracker(onRecovery: () => void) {
  let connectedBefore = false;
  return {
    markConnected() {
      const isReconnect = connectedBefore;
      connectedBefore = true;
      if (isReconnect) onRecovery();
      return isReconnect;
    },
  };
}
