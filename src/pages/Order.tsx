"use client";

import { useState, useEffect, useRef } from "react";
import { Clock, Bell, ClipboardList, XCircle, CheckCircle2, ChefHat, Utensils, Play, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import { Sidebar } from "@/components/Sidebar";

interface OrderItem {
  quantity: number;
  name: string;
}

interface OrderCard {
  id: string;
  orderNumber: string;
  tableNumber: number;
  status: "dine-in" | "take-out" | "delivery";
  orderType: "dine-in" | "take-out" | "delivery";
  items: OrderItem[];
  isPreparing: boolean;
  isReady: boolean;
  isFinished: boolean;
  startedAt?: number;
}

const COOK_TIME_SECONDS = 10 * 60;

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.4, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.2);
    });
  } catch {}
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function OrderTimer({ startedAt, orderNumber }: { startedAt: number; orderNumber: string }) {
  const [elapsed, setElapsed] = useState(0);
  const notifiedRef = useRef(false);
  const soundRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(secs);
      if (secs >= COOK_TIME_SECONDS) {
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          if (Notification.permission === "granted") {
            new Notification("Order Ready!", { body: `Order ${orderNumber} is done and ready to serve!`, icon: "/favicon.ico" });
          }
        }
        if (!soundRef.current) { soundRef.current = true; playAlertSound(); }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt, orderNumber]);

  const remaining = COOK_TIME_SECONDS - elapsed;
  const isOverdue = remaining <= 0;
  const display = isOverdue ? Math.abs(remaining) : remaining;
  const mins = Math.floor(display / 60);
  const secs = display % 60;
  const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const progress = Math.min(elapsed / COOK_TIME_SECONDS, 1);

  const color = isOverdue ? "#ef4444" : elapsed > COOK_TIME_SECONDS * 0.75 ? "#f59e0b" : "#10b981";
  const bg    = isOverdue ? "#fef2f2"  : elapsed > COOK_TIME_SECONDS * 0.75 ? "#fffbeb"  : "#f0fdf4";

  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
        padding: "6px 12px", borderRadius: "8px", marginBottom: "6px",
        background: bg, color,
        fontSize: "11px", fontWeight: 700, letterSpacing: "0.02em",
      }}>
        {isOverdue ? <AlertCircle size={12} /> : <Clock size={12} />}
        {isOverdue ? `OVERDUE +${timeStr}` : timeStr}
      </div>
      <div style={{ height: "3px", background: "#f1f5f9", borderRadius: "99px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress * 100}%`, background: color, borderRadius: "99px", transition: "width 1s linear" }} />
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    "dine-in":  { label: "Dine In",  color: "#be123c", bg: "#fff1f2" },
    "take-out": { label: "Take Out", color: "#b45309", bg: "#fffbeb" },
    "delivery": { label: "Delivery", color: "#0369a1", bg: "#f0f9ff" },
  };
  const s = map[status] ?? { label: status, color: "#6b7280", bg: "#f9fafb" };
  return (
    <span style={{
      fontSize: "10px", fontWeight: 600, padding: "3px 10px", borderRadius: "99px",
      color: s.color, background: s.bg, letterSpacing: "0.02em",
    }}>
      {s.label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{
      background: "#fff", borderRadius: "16px", padding: "20px 24px",
      border: "1px solid #f1f5f9", minWidth: "90px", textAlign: "center",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: "28px", fontWeight: 700, color: accent ?? "#1e293b", lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Order() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifPermission, setNotifPermission] = useState(Notification.permission);
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [servedCount, setServedCount] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      const [queueRows, allRows] = await Promise.all([
        api.get<OrderCard[]>("/orders/queue"),
        api.get<{ id?: number | string; orderId?: number | string; status: string }[]>("/orders"),
      ]);
      setOrders((queueRows ?? []).filter((o) => !o.isFinished));
      const completedIds = new Set(
        (allRows ?? []).filter((o) => o.status === "Completed").map((o) => String(o.id ?? o.orderId))
      );
      setServedCount(completedIds.size);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
  };

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 3000); return () => clearInterval(i); }, []);
  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const handleStart  = async (id: string) => { try { await api.patch(`/orders/${id}`, { status: "preparing", startedAt: new Date().toISOString() }); fetchAll(); } catch {} };
  const handleReady  = async (id: string) => { try { await api.patch(`/orders/${id}`, { status: "ready" }); fetchAll(); } catch {} };
  const handleFinish = async (id: string) => { try { await api.patch(`/orders/${id}`, { status: "Completed" }); fetchAll(); } catch {} };
  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try { await api.patch(`/orders/${id}`, { status: "Cancelled" }); fetchAll(); } catch {} finally { setCancellingId(null); }
  };

  const formatTime = (date: Date) => {
    let h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  const formatDate = (date: Date) => {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const newCount     = orders.filter((o) => !o.isPreparing && !o.isReady).length;
  const processCount = orders.filter((o) => o.isPreparing && !o.isReady).length;
  const readyCount   = orders.filter((o) => o.isReady).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "Poppins, sans-serif" }}>
      <Sidebar />

      <div style={{ paddingLeft: "96px" }}>
        {/* ── Top bar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "24px 32px 0", gap: "16px", flexWrap: "wrap",
        }}>
          {/* Brand + clock */}
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "16px 24px",
            border: "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            display: "flex", alignItems: "center", gap: "24px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ChefHat size={16} color="#7c3aed" />
              <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: "#7c3aed", textTransform: "uppercase" }}>
                Cook View
              </span>
            </div>
            <div style={{ width: "1px", height: "28px", background: "#f1f5f9" }} />
            <div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>
                {formatTime(currentTime)}
              </div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                {formatDate(currentTime)}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <StatCard label="New"     value={newCount}     accent="#0f172a" />
            <StatCard label="Process" value={processCount} accent="#d97706" />
            <StatCard label="Ready"   value={readyCount}   accent="#059669" />
            <StatCard label="Served"  value={servedCount}  accent="#94a3b8" />
          </div>
        </div>

        {/* ── Notification banner ── */}
        {notifPermission !== "granted" && (
          <div style={{ padding: "12px 32px 0" }}>
            <button
              onClick={() => Notification.requestPermission().then(setNotifPermission)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                fontSize: "12px", background: "#fffbeb", border: "1px solid #fde68a",
                color: "#92400e", padding: "8px 14px", borderRadius: "10px", cursor: "pointer",
              }}
            >
              <Bell size={12} />
              Enable notifications for order alerts
            </button>
          </div>
        )}

        {/* ── Queue section ── */}
        <div style={{ padding: "24px 32px 32px" }}>
          {/* Queue header */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <ClipboardList size={15} color="#94a3b8" />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>Order Queue</span>
            {orders.length > 0 && (
              <span style={{
                background: "#f1f5f9", color: "#64748b", fontSize: "11px",
                fontWeight: 700, padding: "2px 8px", borderRadius: "99px",
              }}>
                {orders.length}
              </span>
            )}
          </div>

          {/* Queue container */}
          <div style={{
            background: "#fff", borderRadius: "24px", padding: "20px",
            border: "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            minHeight: "200px",
          }}>
            {orders.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: "12px" }}>
                <Utensils size={32} color="#e2e8f0" />
                <p style={{ fontSize: "13px", color: "#cbd5e1" }}>No pending orders. Orders from the cashier will appear here.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
                <AnimatePresence mode="popLayout">
                  {orders.map((order) => {
                    const isNew      = !order.isPreparing && !order.isReady;
                    const isPreparing = order.isPreparing && !order.isReady;
                    const isReady    = order.isReady;

                    // Card accent color based on state
                    const borderColor = isReady ? "#86efac" : isPreparing ? "#fcd34d" : "#e2e8f0";
                    const topAccent   = isReady ? "#059669" : isPreparing ? "#d97706" : "#c7d2fe";

                    return (
                      <motion.div
                        key={order.id}
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 28 } }}
                        exit={{ opacity: 0, scale: 0.85, y: -16, transition: { duration: 0.28, ease: "easeInOut" } }}
                        whileHover={{ y: -2, transition: { duration: 0.15 } }}
                        style={{
                          background: "#fff", borderRadius: "18px",
                          border: `1.5px solid ${borderColor}`,
                          overflow: "hidden", display: "flex", flexDirection: "column",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                        }}
                      >
                        {/* Top accent strip */}
                        <div style={{ height: "3px", background: topAccent }} />

                        <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column" }}>
                          {/* Header */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 500 }}>
                              {order.orderNumber}
                            </span>
                            <StatusBadge status={order.status} />
                          </div>

                          {/* Timer / Ready badge */}
                          {isPreparing && order.startedAt && (
                            <OrderTimer startedAt={order.startedAt} orderNumber={order.orderNumber} />
                          )}
                          {isReady && (
                            <div style={{
                              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                              padding: "6px 12px", borderRadius: "8px", marginBottom: "12px",
                              background: "#f0fdf4", color: "#059669", fontSize: "11px", fontWeight: 600,
                            }}>
                              <CheckCircle2 size={12} />
                              Ready to serve
                            </div>
                          )}

                          {/* Items */}
                          <div style={{ flex: 1, marginBottom: "14px", paddingBottom: "14px", borderBottom: "1px solid #f8fafc" }}>
                            {order.items.map((item, idx) => (
                              <div key={idx} style={{
                                display: "flex", justifyContent: "space-between",
                                alignItems: "baseline", marginBottom: "5px",
                              }}>
                                <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155", minWidth: "24px" }}>
                                  {item.quantity}×
                                </span>
                                <span style={{ fontSize: "12px", color: "#64748b", textAlign: "right", flex: 1, paddingLeft: "8px" }}>
                                  {item.name}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Actions */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ display: "flex", gap: "8px" }}>
                              {/* START */}
                              <button
                                onClick={() => { if (isNew) handleStart(order.id); }}
                                disabled={!isNew}
                                style={{
                                  flex: 1, padding: "8px", borderRadius: "10px",
                                  fontSize: "11px", fontWeight: 600, cursor: isNew ? "pointer" : "not-allowed",
                                  border: "1.5px solid",
                                  borderColor: isNew ? "#e2e8f0" : "#f1f5f9",
                                  background: isNew ? "#fff" : "#fafafa",
                                  color: isNew ? "#334155" : "#cbd5e1",
                                  display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                                  transition: "all 0.15s",
                                }}
                              >
                                <Play size={10} />
                                Start
                              </button>

                              {/* READY / SERVED */}
                              {!isReady ? (
                                <button
                                  onClick={() => { if (isPreparing) handleReady(order.id); }}
                                  disabled={!isPreparing}
                                  style={{
                                    flex: 1, padding: "8px", borderRadius: "10px",
                                    fontSize: "11px", fontWeight: 600, cursor: isPreparing ? "pointer" : "not-allowed",
                                    border: "1.5px solid",
                                    borderColor: isPreparing ? "#fcd34d" : "#f1f5f9",
                                    background: isPreparing ? "#fffbeb" : "#fafafa",
                                    color: isPreparing ? "#92400e" : "#cbd5e1",
                                    transition: "all 0.15s",
                                  }}
                                >
                                  Ready
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleFinish(order.id)}
                                  style={{
                                    flex: 1, padding: "8px", borderRadius: "10px",
                                    fontSize: "11px", fontWeight: 600, cursor: "pointer",
                                    border: "1.5px solid #86efac",
                                    background: "#f0fdf4", color: "#065f46",
                                    transition: "all 0.15s",
                                  }}
                                >
                                  Served
                                </button>
                              )}
                            </div>

                            {/* CANCEL */}
                            <button
                              onClick={() => { if (cancellingId !== order.id && !isReady) handleCancel(order.id); }}
                              disabled={cancellingId === order.id || isReady}
                              style={{
                                width: "100%", padding: "7px", borderRadius: "10px",
                                fontSize: "11px", fontWeight: 600,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                                cursor: (cancellingId === order.id || isReady) ? "not-allowed" : "pointer",
                                border: "1.5px solid",
                                borderColor: (cancellingId === order.id || isReady) ? "#f1f5f9" : "#fecaca",
                                background: (cancellingId === order.id || isReady) ? "#fafafa" : "#fff5f5",
                                color: (cancellingId === order.id || isReady) ? "#cbd5e1" : "#dc2626",
                                transition: "all 0.15s",
                              }}
                            >
                              <XCircle size={11} />
                              {cancellingId === order.id ? "Cancelling…" : "Cancel"}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}