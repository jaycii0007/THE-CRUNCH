import { useEffect, useMemo, useRef } from "react";
import { getStoredAuthToken, resolveBackendUrl } from "@/lib/api";
import {
  createConnectionRecoveryTracker,
  createDebouncedInvalidator,
  getReconnectDelay,
  parseSseBlock,
  type ApplicationEventTopic,
} from "@/lib/event-stream";

interface ApplicationEvent {
  topic: ApplicationEventTopic;
  timestamp: string;
  reason: string;
}

interface UseEventInvalidationOptions {
  topics: readonly ApplicationEventTopic[];
  onInvalidate: () => void | Promise<void>;
  enabled?: boolean;
  debounceMs?: number;
  refreshOnFocus?: boolean;
}

export function useEventInvalidation({
  topics,
  onInvalidate,
  enabled = true,
  debounceMs = 250,
  refreshOnFocus = true,
}: UseEventInvalidationOptions) {
  const callbackRef = useRef(onInvalidate);
  callbackRef.current = onInvalidate;
  const topicsKey = useMemo(
    () => [...new Set(topics)].sort().join("|"),
    [topics],
  );

  useEffect(() => {
    if (!enabled || !topicsKey) return undefined;

    const acceptedTopics = new Set(topicsKey.split("|"));
    let stopped = false;
    let connecting = false;
    let authBlocked = false;
    let reconnectAttempt = 0;
    let controller: AbortController | null = null;
    let reconnectTimer: number | null = null;
    const invalidator = createDebouncedInvalidator(() => {
      if (!stopped) void callbackRef.current();
    }, debounceMs);
    const scheduleRefresh = () => invalidator.schedule();
    const connectionRecovery = createConnectionRecoveryTracker(scheduleRefresh);

    const scheduleReconnect = () => {
      if (stopped || authBlocked || reconnectTimer !== null) return;
      const delay = getReconnectDelay(reconnectAttempt);
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    };

    const consumeStream = async (response: Response) => {
      if (!response.body) throw new Error("SSE response did not include a stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer = (buffer + decoder.decode(value, { stream: true })).replace(
            /\r\n/g,
            "\n",
          );
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const parsed = parseSseBlock(buffer.slice(0, boundary));
            buffer = buffer.slice(boundary + 2);
            if (parsed?.event === "invalidation") {
              try {
                const event = JSON.parse(parsed.data) as ApplicationEvent;
                if (acceptedTopics.has(event.topic)) scheduleRefresh();
              } catch {
                // Ignore malformed event frames and keep the stream alive.
              }
            }
            boundary = buffer.indexOf("\n\n");
          }
        }
      } finally {
        reader.releaseLock();
      }
      if (!stopped) throw new Error("SSE stream closed");
    };

    const connect = async () => {
      if (stopped || connecting || authBlocked) return;
      const token = getStoredAuthToken();
      if (!token) {
        authBlocked = true;
        return;
      }

      connecting = true;
      controller = new AbortController();
      try {
        const response = await fetch(resolveBackendUrl("/api/events/stream"), {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401 || response.status === 403) {
          authBlocked = true;
          return;
        }
        if (!response.ok) {
          throw new Error(`Event stream failed with HTTP ${response.status}`);
        }

        connectionRecovery.markConnected();
        reconnectAttempt = 0;
        await consumeStream(response);
      } catch (error) {
        if (!stopped && !(error instanceof DOMException && error.name === "AbortError")) {
          scheduleReconnect();
        }
      } finally {
        connecting = false;
        controller = null;
        if (!stopped && !authBlocked) scheduleReconnect();
      }
    };

    const restartForAuthChange = () => {
      authBlocked = false;
      reconnectAttempt = 0;
      controller?.abort();
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
      window.setTimeout(() => void connect(), 0);
    };
    const recoverVisibleData = () => {
      if (!refreshOnFocus || document.visibilityState === "hidden") return;
      scheduleRefresh();
    };
    const handleOnline = () => {
      scheduleRefresh();
      restartForAuthChange();
    };

    void connect();
    window.addEventListener("authChange", restartForAuthChange);
    window.addEventListener("online", handleOnline);
    if (refreshOnFocus) {
      window.addEventListener("focus", recoverVisibleData);
      document.addEventListener("visibilitychange", recoverVisibleData);
    }

    return () => {
      stopped = true;
      controller?.abort();
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      invalidator.cancel();
      window.removeEventListener("authChange", restartForAuthChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", recoverVisibleData);
      document.removeEventListener("visibilitychange", recoverVisibleData);
    };
  }, [debounceMs, enabled, refreshOnFocus, topicsKey]);
}
