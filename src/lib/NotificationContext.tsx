import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
} from "lucide-react";

/* ================= TYPES ================= */

type NotificationType = "error" | "warning" | "info" | "success";

interface Notification {
  id: string;
  label: string;
  type: NotificationType;
  duration?: number;
}

interface NotificationContextValue {
  notifications: Notification[];
  addNotification: (n: Notification) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/* ================= CONTEXT ================= */

const NotificationContext =
  createContext<NotificationContextValue | null>(null);

const ConfirmContext = createContext<{
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
} | null>(null);

/* ================= CONFIG ================= */

const TYPE_CONFIG = {
  success: {
    icon: <CheckCircle2 size={16} />,
    color: "#16a34a",
  },
  error: {
    icon: <XCircle size={16} />,
    color: "#dc2626",
  },
  warning: {
    icon: <AlertTriangle size={16} />,
    color: "#d97706",
  },
  info: {
    icon: <Info size={16} />,
    color: "#2563eb",
  },
};

/* ================= TOAST ================= */

function ToastItem({
  notification,
  onRemove,
}: {
  notification: Notification;
  onRemove: (id: string) => void;
}) {
  const { id, label, type, duration = 4000 } = notification;
  const cfg = TYPE_CONFIG[type];

  useEffect(() => {
    const timer = setTimeout(() => onRemove(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onRemove]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "12px 14px",
        display: "flex",
        gap: 10,
        alignItems: "center",
        minWidth: 260,
        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        borderLeft: `4px solid ${cfg.color}`,
      }}
    >
      <span style={{ color: cfg.color }}>{cfg.icon}</span>

      <span style={{ flex: 1, fontSize: 13, color: "#334155" }}>
        {label}
      </span>

      <button
        onClick={() => onRemove(id)}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          opacity: 0.5,
        }}
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

function ToastContainer() {
  const { notifications, removeNotification } = useNotifications();

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 24,
        right: 24,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 9999,
      }}
    >
      <AnimatePresence>
        {notifications.map((n) => (
          <ToastItem
            key={n.id}
            notification={n}
            onRemove={removeNotification}
          />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}

/* ================= CONFIRM MODAL ================= */

function ConfirmDialog({
  state,
  onResponse,
}: {
  state: ConfirmState;
  onResponse: (v: boolean) => void;
}) {
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.30)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          padding: 20,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onResponse(false);
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{
            duration: 0.22,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            width: "100%",
            maxWidth: 480,
            background: "#f8fafc",
            borderRadius: 20,
            padding: 24,
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: 16,
            }}
          >
            {state.title ?? "Confirm Action"}
          </h2>

          <div
            style={{
              fontSize: 14,
              color: "#475569",
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            {state.message}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
            }}
          >
            <button
              onClick={() => onResponse(false)}
              style={{
                padding: "10px 18px",
                borderRadius: 12,
                border: "1px solid #cbd5f5",
                background: "#f1f5f9",
                color: "#64748b",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {state.cancelLabel ?? "Cancel"}
            </button>

            <button
              onClick={() => onResponse(true)}
              style={{
                padding: "10px 18px",
                borderRadius: 12,
                border: "none",
                background: state.danger ? "#dc2626" : "#0f172a",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {state.confirmLabel ?? "Confirm"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

/* ================= PROVIDER ================= */

export function NotificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmState, setConfirmState] =
    useState<ConfirmState | null>(null);

  const addNotification = useCallback((n: Notification) => {
    setNotifications((prev) => [...prev, n]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...opts, resolve });
    });
  }, []);

  const handleConfirmResponse = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, removeNotification, clearAll }}
    >
      <ConfirmContext.Provider value={{ confirm }}>
        {children}
        <ToastContainer />
        {confirmState && (
          <ConfirmDialog
            state={confirmState}
            onResponse={handleConfirmResponse}
          />
        )}
      </ConfirmContext.Provider>
    </NotificationContext.Provider>
  );
}

/* ================= HOOKS ================= */

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      "useNotifications must be used inside NotificationProvider"
    );
  return ctx;
}

export function useConfirm(): (
  opts: ConfirmOptions
) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx)
    throw new Error(
      "useConfirm must be used inside NotificationProvider"
    );
  return ctx.confirm;
}