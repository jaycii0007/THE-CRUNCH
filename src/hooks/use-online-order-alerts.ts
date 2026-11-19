import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createOnlineArrivalTracker, playOrderArrivalTone } from "@/lib/cashier-order-alerts";
import type { ApplicationEvent } from "./use-event-invalidation";

export function useOnlineOrderAlerts(userId: number | null, toast: (type: "info", message: string) => void) {
  const tracker = useMemo(() => {
    let storage: Storage | undefined;
    try { storage = window.sessionStorage; } catch { /* Storage is optional. */ }
    return createOnlineArrivalTracker(storage, `cashier-order-arrivals:${userId}`);
  }, [userId]);
  const audio = useRef<AudioContext | null>(null);
  const enabled = useRef(false);
  const [soundState, setSoundState] = useState<"muted" | "enabled" | "blocked">("muted");
  const [changingSound, setChangingSound] = useState(false);
  useEffect(() => () => { enabled.current = false; void audio.current?.close().catch(() => {}); }, []);

  const toggleSound = async () => {
    if (changingSound) return;
    if (enabled.current) {
      enabled.current = false;
      setSoundState("muted");
      return;
    }
    setChangingSound(true);
    try {
      // Created/resumed only by the cashier's button click, respecting autoplay policy.
      if (!audio.current || audio.current.state === "closed") {
        audio.current = new AudioContext();
        audio.current.onstatechange = () => {
          if (audio.current?.state !== "running" && enabled.current) {
            enabled.current = false;
            setSoundState("blocked");
          }
        };
      }
      await audio.current.resume();
      if (!playOrderArrivalTone(audio.current)) throw new Error("Audio is suspended");
      enabled.current = true;
      setSoundState("enabled");
    } catch {
      enabled.current = false;
      setSoundState("blocked");
      toast("info", "Order sounds unavailable. New orders will still show visual alerts.");
    } finally { setChangingSound(false); }
  };

  const onEvent = useCallback((event: ApplicationEvent) => {
    const arrival = tracker.accept(event);
    if (!arrival) return null;
    toast("info", `New ${arrival.kind === "pickup" ? "Pickup Order" : "Delivery Request"} ${arrival.orderNumber}`);
    if (enabled.current) {
      try {
        if (!audio.current || !playOrderArrivalTone(audio.current)) throw new Error("Audio unavailable");
      } catch {
        enabled.current = false;
        setSoundState("blocked");
      }
    }
    return arrival;
  }, [tracker, toast]);
  return { seed: tracker.seed, onEvent, soundState, changingSound, toggleSound };
}
