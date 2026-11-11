import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type ReactNode,
} from "react";
import {
  Lock,
  ChevronDown,
  ChevronUp,
  Star,
  MessageSquare,
  Upload,
} from "lucide-react";
import {
  SkeletonSectionCard,
  SkeletonListItem,
} from "@/components/ui/skeleton";
import { useAuth } from "../context/authcontext";
import { api } from "../lib/api";
import {
  normalizePermissionsMap,
  normalizeRole,
  type PermissionsMap,
} from "../lib/permissions";
import {
  saveGeneralSettings,
  syncGeneralSettings,
} from "../lib/restaurantSettings";
import {
  EMPTY_PAYMENT_QR,
  fetchPaymentQrConfiguration,
  fetchPaymentQrObjectUrl,
  type PaymentQrConfiguration,
} from "../lib/paymentQr";
import { Sidebar } from "../components/Sidebar";

/*
 * Settings page (administrators only).
 *
 * Access is checked against the API (GET /users/me) before anything is shown.
 * Only after that check passes does the page load its own data, so other roles
 * never trigger the settings or feedback requests. The API must still enforce
 * the same rule on its side, this check only controls what the UI shows.
 *
 * Responsive behaviour:
 *   mobile  (< 640px)   settings menu becomes compact grouped lists on top,
 *                       form rows stack (label above control), full-width controls
 *   tablet  (< 1024px)  narrower side menu, tighter padding
 *   desktop (>= 1024px) original layout
 */

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const FONT = "'Poppins', sans-serif";
export const ACCENT = "#e05a1e";
const INK = "#1c1a18";
const MUTED = "#9e9891";
const ERROR = "#b91c1c";
const SUCCESS = "#15803d";

// Dropdown options. The types below are derived from these lists,
// so the allowed values are only written once.
const STORE_MODE_OPTIONS = [
  { value: "auto", label: "Auto (follow schedule)" },
  { value: "manual_open", label: "Force Open" },
  { value: "manual_closed", label: "Force Closed" },
] as const;

const TOAST_POSITION_OPTIONS = [
  { value: "top-right", label: "Top Right" },
  { value: "top-left", label: "Top Left" },
  { value: "bottom-right", label: "Bottom Right" },
  { value: "bottom-left", label: "Bottom Left" },
] as const;

const TOAST_DURATION_OPTIONS = [2, 3, 4, 5].map((seconds) => ({
  value: String(seconds * 1000),
  label: `${seconds} seconds`,
}));

/* -------------------------------------------------------------------------- */
/* Viewport (responsive) helpers                                              */
/* -------------------------------------------------------------------------- */

type Viewport = "mobile" | "tablet" | "desktop";

const MOBILE_MAX = 640;
const TABLET_MAX = 1024;

const readViewport = (): Viewport => {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  if (width < MOBILE_MAX) return "mobile";
  if (width < TABLET_MAX) return "tablet";
  return "desktop";
};

// One resize listener for the whole page. Components read the result through context,
// so exported primitives (FR, SI, SS...) still work anywhere and default to "desktop".
const ViewportContext = createContext<Viewport>("desktop");
const useViewport = () => useContext(ViewportContext);

function useViewportWatcher(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(readViewport);

  useEffect(() => {
    const onResize = () => setViewport(readViewport());
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  return viewport;
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type TabKey =
  | "profile"
  | "master_data"
  | "business"
  | "payment_methods"
  | "ordering"
  | "inventory"
  | "billing"
  | "notifications"
  | "roles"
  | "security"
  | "feedback";

export interface RestaurantSettings {
  // Fixed system identity (not editable)
  restaurantName: string;
  tagline: string;
  currency: string;
  timezone: string;
  // Contact details
  email: string;
  phone: string;
  address: string;
  businessTin: string;
  businessRegistrationDetails: string;
  // Operating hours
  weekdayOpenTime: string;
  weekdayCloseTime: string;
  weekendOpenTime: string;
  weekendCloseTime: string;
  storeStatusMode: (typeof STORE_MODE_OPTIONS)[number]["value"];
  // Inventory
  defaultLowStockThreshold: string;
  defaultCriticalStockThreshold: string;
  // Billing
  taxRate: string;
  serviceCharge: string;
  // Notifications
  enableToastNotifications: boolean;
  toastPosition: (typeof TOAST_POSITION_OPTIONS)[number]["value"];
  toastDuration: string;
  enableConfirmDialogs: boolean;
  newOrderAlertsEnabled: boolean;
  lowStockAlertsEnabled: boolean;
  // Ordering
  acceptOnlineOrders: boolean;
  minimumOrderAmount: string;
  // Security
  sessionTimeout: string;
}

export interface FeedbackEntry {
  id: string;
  reviewerName: string;
  productName: string;
  rating: number;
  message: string;
  createdAt: string;
}

// The signed-in user's account, as returned by GET /users/me.
interface OwnAccount {
  id: number;
  username: string;
  email: string;
  role: string;
}

// Setter shared by every settings tab.
type SetField = <K extends keyof RestaurantSettings>(
  key: K,
  value: RestaurantSettings[K],
) => void;
interface TabProps {
  s: RestaurantSettings;
  set: SetField;
}

// Keys whose value is a plain string / a boolean. Used by the bind helpers below.
type TextKey = {
  [K in keyof RestaurantSettings]: string extends RestaurantSettings[K]
    ? K
    : never;
}[keyof RestaurantSettings];
type FlagKey = {
  [K in keyof RestaurantSettings]: RestaurantSettings[K] extends boolean
    ? K
    : never;
}[keyof RestaurantSettings];

/* -------------------------------------------------------------------------- */
/* Settings defaults & normalizing                                            */
/* -------------------------------------------------------------------------- */

// Fixed identity values, and the initial form values shown until the API responds.
export const DEFAULT: RestaurantSettings = {
  restaurantName: "The Crunch",
  tagline: "",
  currency: "PHP",
  timezone: "Asia/Manila",
  email: "",
  phone: "",
  address: "",
  businessTin: "",
  businessRegistrationDetails: "",
  weekdayOpenTime: "10:00",
  weekdayCloseTime: "22:00",
  weekendOpenTime: "11:00",
  weekendCloseTime: "20:30",
  storeStatusMode: "auto",
  defaultLowStockThreshold: "",
  defaultCriticalStockThreshold: "",
  taxRate: "",
  serviceCharge: "",
  enableToastNotifications: true,
  toastPosition: "top-right",
  toastDuration: "4000",
  enableConfirmDialogs: true,
  newOrderAlertsEnabled: true,
  lowStockAlertsEnabled: true,
  acceptOnlineOrders: true,
  minimumOrderAmount: "",
  sessionTimeout: "30",
};

function readString(value: unknown, fallback = ""): string {
  return String(value ?? "").trim() || fallback;
}

function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

// Turns whatever the API returns into a complete, safe settings object.
function normalizeSettings(
  src: Record<string, unknown> | null | undefined,
): RestaurantSettings {
  const text = (key: string, fallback = "") => readString(src?.[key], fallback);
  const flag = (key: string) => readBoolean(src?.[key], true);
  const oneOf = <T extends string>(
    key: string,
    options: readonly { value: T }[],
    fallback: T,
  ): T =>
    options.find((option) => option.value === src?.[key])?.value ?? fallback;

  return {
    // Fixed identity is never overwritten by the API
    restaurantName: DEFAULT.restaurantName,
    tagline: DEFAULT.tagline,
    currency: DEFAULT.currency,
    timezone: DEFAULT.timezone,

    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    businessTin: text("businessTin"),
    businessRegistrationDetails: text("businessRegistrationDetails"),

    weekdayOpenTime: text("weekdayOpenTime", DEFAULT.weekdayOpenTime),
    weekdayCloseTime: text("weekdayCloseTime", DEFAULT.weekdayCloseTime),
    weekendOpenTime: text("weekendOpenTime", DEFAULT.weekendOpenTime),
    weekendCloseTime: text("weekendCloseTime", DEFAULT.weekendCloseTime),
    storeStatusMode: oneOf("storeStatusMode", STORE_MODE_OPTIONS, "auto"),

    defaultLowStockThreshold: text("defaultLowStockThreshold"),
    defaultCriticalStockThreshold: text("defaultCriticalStockThreshold"),

    taxRate: text("taxRate"),
    serviceCharge: text("serviceCharge"),

    enableToastNotifications: flag("enableToastNotifications"),
    toastPosition: oneOf("toastPosition", TOAST_POSITION_OPTIONS, "top-right"),
    toastDuration: text("toastDuration", DEFAULT.toastDuration),
    enableConfirmDialogs: flag("enableConfirmDialogs"),
    newOrderAlertsEnabled: flag("newOrderAlertsEnabled"),
    lowStockAlertsEnabled: flag("lowStockAlertsEnabled"),

    acceptOnlineOrders: flag("acceptOnlineOrders"),
    minimumOrderAmount: text("minimumOrderAmount"),

    sessionTimeout: text("sessionTimeout", DEFAULT.sessionTimeout),
  };
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

// Text style shortcut: typo("0.85rem", color, weight)
const typo = (size: string, color = INK, weight = 500): CSSProperties => ({
  fontFamily: FONT,
  fontSize: size,
  color,
  fontWeight: weight,
  margin: 0,
});

const S = {
  input: {
    fontFamily: FONT,
    fontSize: "0.85rem",
    color: INK,
    background: "#f7f6f5",
    border: "1px solid #e4e1dc",
    borderRadius: 10,
    padding: "10px 12px",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color .15s, box-shadow .15s",
  } as CSSProperties,
  pillSelect: {
    fontFamily: FONT,
    fontSize: "0.85rem",
    fontWeight: 500,
    color: INK,
    background: "#f0eeec",
    border: "none",
    borderRadius: 99,
    padding: "9px 34px 9px 16px",
    cursor: "pointer",
    outline: "none",
    appearance: "none",
  } as CSSProperties,
  panel: {
    background: "#fff",
    border: "1px solid #eae7e2",
    borderRadius: 12,
  } as CSSProperties,
  // The large white card that holds the settings menu and content.
  card: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    maxWidth: 1100,
    margin: "0 auto",
    background: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #eae7e2",
    boxShadow: "0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.04)",
  } as CSSProperties,
};

// Dark action button. Greyed out while disabled.
const accentButton = (disabled = false): CSSProperties => ({
  fontFamily: FONT,
  fontSize: "0.82rem",
  fontWeight: 600,
  borderRadius: 10,
  letterSpacing: ".01em",
  padding: "10px 18px",
  border: "none",
  background: INK,
  color: "#fff",
  textAlign: "center",
  transition: "all .15s",
  opacity: disabled ? 0.55 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
});

const secondaryButton = (): CSSProperties => ({
  fontFamily: FONT,
  fontSize: "0.75rem",
  fontWeight: 600,
  borderRadius: 9,
  padding: "7px 10px",
  border: "1px solid #ddd8d2",
  background: "#fff",
  color: "#5a5652",
  cursor: "pointer",
});

/* -------------------------------------------------------------------------- */
/* Form primitives                                                            */
/* -------------------------------------------------------------------------- */

// Props for an input / dropdown bound to a string setting.
const bindText = ({ s, set }: TabProps, key: TextKey) => ({
  value: s[key],
  onChange: (v: string) => set(key, v),
});

// Props for a toggle bound to a boolean setting.
const bindFlag = ({ s, set }: TabProps, key: FlagKey) => ({
  value: s[key],
  onChange: (v: boolean) => set(key, v),
});

// Text input with an accent border while focused.
export function SI({
  value,
  onChange,
  type = "text",
  placeholder = "",
  ariaLabel,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const isMobile = useViewport() === "mobile";
  return (
    <input
      style={{
        ...S.input,
        // 16px on phones stops iOS Safari from zooming the page when an input is focused
        fontSize: isMobile ? "1rem" : S.input.fontSize,
        padding: isMobile ? "11px 12px" : S.input.padding,
        borderColor: focused ? ACCENT : "#ececec",
        boxShadow: focused ? "0 0 0 3px rgba(224,90,30,.1)" : "none",
      }}
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

// Pill-shaped dropdown. Full width on phones so it lines up with the inputs.
export function SS<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  const isMobile = useViewport() === "mobile";
  return (
    <div
      style={{
        position: "relative",
        display: isMobile ? "block" : "inline-block",
        maxWidth: "100%",
      }}
    >
      <select
        style={{
          ...S.pillSelect,
          fontSize: isMobile ? "1rem" : S.pillSelect.fontSize,
          width: isMobile ? "100%" : undefined,
          maxWidth: "100%",
          padding: isMobile ? "11px 38px 11px 16px" : S.pillSelect.padding,
        }}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        color={MUTED}
        style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 99,
        border: "none",
        cursor: "pointer",
        background: value ? INK : "#e4e1dc",
        padding: 0,
        flexShrink: 0,
        transition: "background .2s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: value ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.18)",
          transition: "left .18s",
        }}
      />
    </button>
  );
}

// Form row: label on the left, control on the right. On phones the label sits above the control.
export function FR({
  label,
  last = false,
  children,
}: {
  label: string;
  last?: boolean;
  children: ReactNode;
}) {
  const viewport = useViewport();
  const stacked = viewport === "mobile";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: stacked
          ? "minmax(0,1fr)"
          : `${viewport === "tablet" ? 150 : 175}px minmax(0,1fr)`,
        alignItems: stacked ? "stretch" : "center",
        gap: stacked ? 8 : 16,
        padding: stacked ? "14px 0" : "20px 0",
        borderBottom: last ? "none" : "1px solid #ececec",
      }}
    >
      <p
        style={typo(stacked ? "0.8rem" : "0.85rem", stacked ? "#5a5652" : INK)}
      >
        {label}
      </p>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

// Toggle row: label and optional description on the left, switch on the right.
export function TR({
  label,
  desc,
  value,
  onChange,
  last = false,
}: {
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  const isMobile = useViewport() === "mobile";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "14px 0" : "20px 0",
        borderBottom: last ? "none" : "1px solid #ececec",
        gap: 16,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={typo("0.85rem")}>{label}</p>
        {desc && (
          <p
            style={{
              ...typo("0.74rem", MUTED, 400),
              margin: "3px 0 0",
              lineHeight: 1.6,
            }}
          >
            {desc}
          </p>
        )}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

// Groups related rows and adds spacing below them.
export function Section({ children }: { children: ReactNode }) {
  return <div style={{ marginBottom: 8 }}>{children}</div>;
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        ...typo("0.74rem", "#b0aaa3", 400),
        padding: "10px 0 18px",
        lineHeight: 1.6,
      }}
    >
      {children}
    </p>
  );
}

// Read-only value shown inside a form row.
function Value({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      style={{
        ...typo("0.8rem", muted ? "#5a5652" : INK, muted ? 400 : 600),
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </span>
  );
}

// Error message with a retry button.
function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div style={{ ...S.panel, padding: "28px 20px", textAlign: "center" }}>
      <p style={{ ...typo("0.8rem", ERROR, 400), marginBottom: 10 }}>
        {message}
      </p>
      <button onClick={onRetry} style={accentButton()}>
        Try again
      </button>
    </div>
  );
}

// Shown to users who are not administrators.
export function LockedSection({ label }: { label: string }) {
  const isMobile = useViewport() === "mobile";
  return (
    <div
      style={{
        background: "#f7f6f5",
        borderRadius: 16,
        padding: isMobile ? "36px 20px" : "48px 32px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}
      >
        <Lock size={22} color={ACCENT} />
      </div>
      <p style={{ ...typo("0.9rem", INK, 600), margin: "0 0 8px" }}>
        Access Restricted
      </p>
      <p
        style={{
          ...typo("0.78rem", MUTED, 400),
          lineHeight: 1.7,
          maxWidth: 300,
          marginInline: "auto",
        }}
      >
        Only administrators can access{" "}
        <strong style={{ color: "#5a5652" }}>{label}</strong>. Contact your
        administrator if you need access.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Settings tabs                                                              */
/* -------------------------------------------------------------------------- */

const HOUR_FIELDS: [TextKey, string][] = [
  ["weekdayOpenTime", "Weekday open"],
  ["weekdayCloseTime", "Weekday close"],
  ["weekendOpenTime", "Weekend open"],
  ["weekendCloseTime", "Weekend close"],
];

export function BusinessTab(p: TabProps) {
  const { s } = p;
  return (
    <>
      <Section>
        <FR label="System name">
          <Value>{s.restaurantName}</Value>
        </FR>
        <FR label="Currency">
          <Value>{s.currency}</Value>
        </FR>
        <FR label="Time zone" last>
          <Value>{s.timezone}</Value>
        </FR>
        <Hint>Name, currency, and time zone are fixed system settings.</Hint>
      </Section>
      <Section>
        {HOUR_FIELDS.map(([key, label], i) => (
          <FR key={key} label={label} last={i === HOUR_FIELDS.length - 1}>
            <SI {...bindText(p, key)} type="time" />
          </FR>
        ))}
      </Section>
    </>
  );
}

interface DeliveryPlatformLinks {
  grabfoodUrl: string | null;
  foodpandaUrl: string | null;
}

function DeliveryPlatformLinksSection() {
  const [grabfoodUrl, setGrabfoodUrl] = useState("");
  const [foodpandaUrl, setFoodpandaUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get<DeliveryPlatformLinks>("/settings/delivery-links")
      .then((links) => {
        if (cancelled) return;
        setGrabfoodUrl(links.grabfoodUrl || "");
        setFoodpandaUrl(links.foodpandaUrl || "");
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load delivery links.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (saving || loading) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const links = await api.put<DeliveryPlatformLinks>(
        "/settings/delivery-links",
        {
          grabfoodUrl,
          foodpandaUrl,
        },
      );
      setGrabfoodUrl(links.grabfoodUrl || "");
      setFoodpandaUrl(links.foodpandaUrl || "");
      setNotice("Delivery platform links saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save delivery links.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section>
      <div style={{ padding: 20 }}>
        <p style={{ ...typo("0.86rem", INK, 700), margin: "0 0 6px" }}>
          Delivery Platform Links
        </p>
        <Hint>
          Customers see these links after choosing Delivery Order. Clear a field
          to disable that platform.
        </Hint>
        <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={typo("0.76rem", "#5a5652", 600)}>
              GrabFood Ordering URL
            </span>
            <input
              data-testid="grabfood-ordering-url"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={grabfoodUrl}
              disabled={loading || saving}
              onChange={(event) => setGrabfoodUrl(event.target.value)}
              placeholder="https://r.grab.com/g/..."
              style={S.input}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={typo("0.76rem", "#5a5652", 600)}>
              Foodpanda Ordering URL
            </span>
            <input
              data-testid="foodpanda-ordering-url"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={foodpandaUrl}
              disabled={loading || saving}
              onChange={(event) => setFoodpandaUrl(event.target.value)}
              placeholder="https://foodpanda.go.link/..."
              style={S.input}
            />
          </label>
          <div>
            <button
              type="button"
              onClick={() => void save()}
              disabled={loading || saving}
              style={accentButton(loading || saving)}
            >
              {saving ? "Saving..." : "Save Delivery Links"}
            </button>
          </div>
          {loading && (
            <p style={typo("0.75rem", MUTED, 400)}>
              Loading saved delivery links...
            </p>
          )}
          {error && (
            <p role="alert" style={typo("0.75rem", ERROR, 500)}>
              {error}
            </p>
          )}
          {notice && (
            <p role="status" style={typo("0.75rem", SUCCESS, 500)}>
              {notice}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}

function PaymentMethodsTab() {
  const previewRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [configuration, setConfiguration] =
    useState<PaymentQrConfiguration>(EMPTY_PAYMENT_QR);
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const replacePreview = useCallback((nextUrl: string) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await fetchPaymentQrConfiguration();
      const nextPreview =
        next.configured && next.imageUrl
          ? await fetchPaymentQrObjectUrl(next.imageUrl)
          : "";
      setConfiguration(next);
      replacePreview(nextPreview);
    } catch (loadError) {
      setConfiguration(EMPTY_PAYMENT_QR);
      replacePreview("");
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the GCash QR image.",
      );
    } finally {
      setLoading(false);
    }
  }, [replacePreview]);

  useEffect(() => {
    void load();
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, [load]);

  useEffect(() => {
    const preventFileNavigation = (event: Event) => {
      const dragEvent = event as DragEvent;
      if (Array.from(dragEvent.dataTransfer?.types ?? []).includes("Files")) {
        dragEvent.preventDefault();
      }
    };
    window.addEventListener("dragover", preventFileNavigation);
    window.addEventListener("drop", preventFileNavigation);
    return () => {
      window.removeEventListener("dragover", preventFileNavigation);
      window.removeEventListener("drop", preventFileNavigation);
    };
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setSelectedPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const chooseFile = (file?: File) => {
    setError("");
    setNotice("");
    if (!file) {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setError("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setError("GCash QR image must be 5 MB or smaller.");
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (busy) return;
    chooseFile(event.dataTransfer.files?.[0]);
  };

  const upload = async () => {
    if (!selectedFile || busy) return;
    const wasConfigured = configuration.configured;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.append("image", selectedFile, selectedFile.name || "gcash-qr.png");
      await api.post<PaymentQrConfiguration>("/payment-qr", form);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
      setNotice(
        wasConfigured
          ? "GCash QR image replaced successfully."
          : "GCash QR image uploaded successfully.",
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload the GCash QR image.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || !configuration.configured) return;
    if (
      !window.confirm(
        "Remove the active GCash QR image? Cashiers will be unable to use QR checkout until a new image is uploaded.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.delete<PaymentQrConfiguration>("/payment-qr");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
      setNotice("GCash QR image removed.");
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Unable to remove the GCash QR image.",
      );
    } finally {
      setBusy(false);
    }
  };

  const shownPreview = selectedPreview || previewUrl;
  return (
    <>
      <Section>
        <div style={{ padding: 20 }}>
          <p style={{ ...typo("0.86rem", INK, 700), margin: "0 0 6px" }}>
            In-store GCash QR
          </p>
          <Hint>
            Cashiers can display this image during manual GCash checkout.
            Payment is marked Paid only after the cashier confirms receipt.
          </Hint>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              gap: 20,
              marginTop: 18,
              alignItems: "start",
            }}
          >
            <div
              style={{
                minHeight: 220,
                display: "grid",
                placeItems: "center",
                border: "1px solid #e2ded9",
                borderRadius: 14,
                background: "#faf9f7",
                padding: 12,
                position: "relative",
              }}
            >
              {shownPreview ? (
                <>
                  <img
                    src={shownPreview}
                    alt={
                      selectedFile
                        ? "Selected GCash QR preview"
                        : "Active GCash QR"
                    }
                    style={{
                      width: "100%",
                      maxHeight: 260,
                      objectFit: "contain",
                      borderRadius: 10,
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 10,
                      borderRadius: 999,
                      padding: "5px 9px",
                      background: selectedFile ? "#fff7ed" : "#ecfdf5",
                      color: selectedFile ? ACCENT : SUCCESS,
                      fontFamily: FONT,
                      fontSize: "0.66rem",
                      fontWeight: 700,
                    }}
                  >
                    {selectedFile ? "PREVIEW — NOT UPLOADED" : "ACTIVE QR"}
                  </span>
                </>
              ) : (
                <p
                  style={{
                    ...typo("0.75rem", MUTED, 500),
                    textAlign: "center",
                  }}
                >
                  {loading ? "Loading QR image..." : "No GCash QR configured"}
                </p>
              )}
            </div>
            <div>
              <div
                data-testid="gcash-qr-drop-zone"
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${isDragging ? ACCENT : "#d8d2cb"}`,
                  borderRadius: 14,
                  background: isDragging ? "#fff7ed" : "#faf9f7",
                  padding: "22px 16px",
                  marginBottom: 12,
                  textAlign: "center",
                  transition: "border-color .15s, background .15s",
                }}
              >
                <Upload
                  size={28}
                  color={isDragging ? ACCENT : MUTED}
                  aria-hidden="true"
                />
                <p
                  style={{ ...typo("0.82rem", INK, 650), margin: "8px 0 3px" }}
                >
                  Drop a QR image here
                </p>
                <p
                  style={{ ...typo("0.7rem", MUTED, 400), margin: "0 0 12px" }}
                >
                  or select one from your device
                </p>
                <input
                  ref={fileInputRef}
                  key={configuration.updatedAt || "no-payment-qr"}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  disabled={busy}
                  onChange={(event) =>
                    chooseFile(event.currentTarget.files?.[0])
                  }
                  style={{ display: "none" }}
                  aria-label="Choose GCash QR image"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    ...accentButton(busy),
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <Upload size={15} aria-hidden="true" />
                  {configuration.configured
                    ? "Choose Replacement Image"
                    : "Choose Image"}
                </button>
                {selectedFile && (
                  <p
                    style={{
                      ...typo("0.7rem", SUCCESS, 600),
                      margin: "11px 0 0",
                      overflowWrap: "anywhere",
                    }}
                  >
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>
              <p
                style={{
                  ...typo("0.72rem", MUTED, 400),
                  lineHeight: 1.6,
                  margin: "0 0 14px",
                }}
              >
                PNG, JPG, or WebP. Maximum 5 MB. The server verifies the actual
                file content.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void upload()}
                  disabled={!selectedFile || busy}
                  style={accentButton(!selectedFile || busy)}
                >
                  {busy
                    ? "Uploading..."
                    : configuration.configured
                      ? "Save Replacement"
                      : "Upload QR"}
                </button>
                {selectedFile && !busy && (
                  <button
                    type="button"
                    onClick={() => chooseFile()}
                    style={secondaryButton()}
                  >
                    Clear Selection
                  </button>
                )}
                {configuration.configured && (
                  <button
                    type="button"
                    onClick={() => void remove()}
                    disabled={busy}
                    style={{
                      ...accentButton(),
                      background: "#fff",
                      color: ERROR,
                      border: `1px solid ${ERROR}`,
                    }}
                  >
                    Remove QR image
                  </button>
                )}
              </div>
              {error && (
                <p style={{ ...typo("0.75rem", ERROR, 500), marginTop: 12 }}>
                  {error}
                </p>
              )}
              {notice && (
                <p style={{ ...typo("0.75rem", SUCCESS, 500), marginTop: 12 }}>
                  {notice}
                </p>
              )}
            </div>
          </div>
        </div>
      </Section>
      <DeliveryPlatformLinksSection />
    </>
  );
}

export function InventoryTab(p: TabProps) {
  return (
    <Section>
      <FR label="Low stock threshold">
        <SI
          {...bindText(p, "defaultLowStockThreshold")}
          type="number"
          placeholder="e.g. 10"
        />
      </FR>
      <FR label="Critical threshold" last>
        <SI
          {...bindText(p, "defaultCriticalStockThreshold")}
          type="number"
          placeholder="e.g. 5"
        />
      </FR>
    </Section>
  );
}

function ProfileTab() {
  return (
    <Section>
      <FR label="Signed-in account" last>
        <a
          href="/my-account"
          style={{
            ...accentButton(),
            display: "inline-block",
            textDecoration: "none",
          }}
        >
          Open My Profile
        </a>
      </FR>
      <Hint>
        Update your own display name and password on the secure profile page.
      </Hint>
    </Section>
  );
}

interface InventoryCategorySetting {
  category_id: number;
  name: string;
  date_tracking_type: "none" | "expiry" | "shelf_life" | null;
  is_active: boolean | number;
}

type InventoryTrackingType = NonNullable<InventoryCategorySetting["date_tracking_type"]>;
const INVENTORY_TRACKING_OPTIONS: {
  value: InventoryTrackingType;
  label: string;
}[] = [
  { value: "expiry", label: "Expiry Date" },
  { value: "shelf_life", label: "Shelf Life" },
  { value: "none", label: "No Tracking" },
];

function inventoryTrackingLabel(value: InventoryCategorySetting["date_tracking_type"]): string {
  return (
    INVENTORY_TRACKING_OPTIONS.find((option) => option.value === value)
      ?.label ?? value ?? "Choose date tracking"
  );
}

interface MenuCategorySetting {
  category_id: number;
  name: string;
  display_order: number;
  is_active: boolean | number;
  system_key?: string | null;
}

interface InventoryUnitSetting {
  unit_id: number;
  name: string;
  abbreviation: string | null;
  is_active: boolean | number;
  base_unit_id?: number | null;
  conversion_to_base?: number | string | null;
  is_system?: boolean | number;
}

function CategoriesUnitsTab() {
  const [sauceTriggerIds, setSauceTriggerIds] = useState<number[]>([]);
  const [sauceTriggersLoaded, setSauceTriggersLoaded] = useState(false);
  const [savingSauceTriggers, setSavingSauceTriggers] = useState(false);
  const [sauceTriggerError, setSauceTriggerError] = useState("");
  const [sauceIngredientOptions, setSauceIngredientOptions] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    let active = true;
    void Promise.all([
      api.get<{ ingredientIds: number[] }>("/settings/sauce-triggers"),
      api.get<{ product_id: number; product_name: string; item_type?: string }[]>("/inventory"),
    ]).then(([settings, materials]) => {
      if (active) {
        setSauceTriggerIds(settings.ingredientIds);
        setSauceIngredientOptions(materials.filter((material) => material.item_type === "stock_item").map((material) => ({ id: Number(material.product_id), name: material.product_name })).sort((a, b) => a.name.localeCompare(b.name)));
        setSauceTriggersLoaded(true);
      }
    }).catch(() => { if (active) setSauceTriggerError("Failed to load sauce triggers. Refresh before editing."); });
    return () => { active = false; };
  }, []);
  const [menuCategories, setMenuCategories] = useState<MenuCategorySetting[]>(
    [],
  );
  const [categories, setCategories] = useState<InventoryCategorySetting[]>([]);
  const [units, setUnits] = useState<InventoryUnitSetting[]>([]);
  const [menuCategoryName, setMenuCategoryName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryTracking, setCategoryTracking] = useState<
    InventoryTrackingType | ""
  >("");
  const [categoryTrackingDrafts, setCategoryTrackingDrafts] = useState<
    Record<number, InventoryTrackingType | "">
  >({});
  const [unitName, setUnitName] = useState("");
  const [unitAbbreviation, setUnitAbbreviation] = useState("");
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [unitConversionDrafts, setUnitConversionDrafts] = useState<Record<number, { base: string; left: string; right: string }>>({});
  const [menuCategoryDrafts, setMenuCategoryDrafts] = useState<
    Record<number, string>
  >({});
  const [categoryDrafts, setCategoryDrafts] = useState<Record<number, string>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextMenuCategories, nextCategories, nextUnits] = await Promise.all(
        [
          api.get<MenuCategorySetting[]>(
            "/settings/menu-categories?activeOnly=0",
          ),
          api.get<InventoryCategorySetting[]>("/settings/inventory-categories"),
          api.get<InventoryUnitSetting[]>("/settings/inventory-units"),
        ],
      );
      setMenuCategories(nextMenuCategories);
      setCategories(nextCategories);
      setUnits(nextUnits);
      setUnitConversionDrafts(Object.fromEntries(nextUnits.map((unit) => [unit.unit_id, {
        base: unit.base_unit_id == null ? "" : String(unit.base_unit_id),
        left: "1",
        right: unit.conversion_to_base == null ? "" : String(unit.conversion_to_base),
      }])));
      setMenuCategoryDrafts(
        Object.fromEntries(
          nextMenuCategories.map((category) => [
            category.category_id,
            category.name,
          ]),
        ),
      );
      setCategoryDrafts(
        Object.fromEntries(
          nextCategories.map((category) => [
            category.category_id,
            category.name,
          ]),
        ),
      );
      setCategoryTrackingDrafts(
        Object.fromEntries(
          nextCategories.map((category) => [
            category.category_id,
            category.date_tracking_type ?? "",
          ]),
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load categories and units.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createMenuCategory = async () => {
    const name = menuCategoryName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<MenuCategorySetting>(
        "/settings/menu-categories",
        {
          name,
          display_order: menuCategories.length,
        },
      );
      setMenuCategories((current) =>
        [...current, created].sort(
          (a, b) =>
            a.display_order - b.display_order || a.name.localeCompare(b.name),
        ),
      );
      setMenuCategoryDrafts((current) => ({
        ...current,
        [created.category_id]: created.name,
      }));
      setMenuCategoryName("");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to add menu category.",
      );
    } finally {
      setBusy(false);
    }
  };

  const createCategory = async () => {
    const name = categoryName.trim();
    if (!name || !categoryTracking || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<InventoryCategorySetting>(
        "/settings/inventory-categories",
        {
          name,
          date_tracking_type: categoryTracking,
        },
      );
      setCategories((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setCategoryDrafts((current) => ({
        ...current,
        [created.category_id]: created.name,
      }));
      setCategoryTrackingDrafts((current) => ({
        ...current,
        [created.category_id]: created.date_tracking_type ?? "",
      }));
      setCategoryName("");
      setCategoryTracking("");
      if (created.date_tracking_type !== categoryTracking) {
        setError(
          "Category was created, but the server did not save the selected date tracking method. Verify the backend category API before using it.",
        );
      }
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to add category.",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveCategoryTracking = async (category: InventoryCategorySetting) => {
    const selected =
      categoryTrackingDrafts[category.category_id] ??
      category.date_tracking_type;
    if (busy || !selected || selected === category.date_tracking_type) return;
    if (
      !window.confirm(
        `Change date tracking for "${category.name}" from ${inventoryTrackingLabel(category.date_tracking_type)} to ${inventoryTrackingLabel(selected)}? ` +
          "This affects all materials in this category. Existing batch dates are not automatically created or converted.",
      )
    )
      return;

    setBusy(true);
    setError(null);
    try {
      await api.patch<InventoryCategorySetting>(
        `/settings/inventory-categories/${category.category_id}`,
        { date_tracking_type: selected },
      );
      // Re-read the persisted value. Some older APIs ignore unknown PATCH fields.
      const latest = await api.get<InventoryCategorySetting[]>(
        "/settings/inventory-categories",
      );
      setCategories(latest);
      const saved = latest.find(
        (item) => item.category_id === category.category_id,
      );
      if (!saved || saved.date_tracking_type !== selected) {
        setCategoryTrackingDrafts((current) => ({
          ...current,
          [category.category_id]:
            saved?.date_tracking_type ?? category.date_tracking_type ?? "",
        }));
        throw new Error(
          "The server did not save the tracking change. The backend PATCH route may need support for date_tracking_type.",
        );
      }
      setCategoryTrackingDrafts((current) => ({
        ...current,
        [category.category_id]: saved.date_tracking_type ?? "",
      }));
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update category date tracking.",
      );
    } finally {
      setBusy(false);
    }
  };

  const renameMenuCategory = async (category: MenuCategorySetting) => {
    const name = String(menuCategoryDrafts[category.category_id] ?? "").trim();
    if (!name || name === category.name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<MenuCategorySetting>(
        `/settings/menu-categories/${category.category_id}`,
        { name },
      );
      setMenuCategories((current) =>
        current.map((item) =>
          item.category_id === updated.category_id ? updated : item,
        ),
      );
      setMenuCategoryDrafts((current) => ({
        ...current,
        [updated.category_id]: updated.name,
      }));
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to rename menu category.",
      );
    } finally {
      setBusy(false);
    }
  };

  const renameCategory = async (category: InventoryCategorySetting) => {
    const name = String(categoryDrafts[category.category_id] ?? "").trim();
    if (!name || name === category.name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<InventoryCategorySetting>(
        `/settings/inventory-categories/${category.category_id}`,
        { name },
      );
      setCategories((current) =>
        current.map((item) =>
          item.category_id === updated.category_id ? updated : item,
        ),
      );
      setCategoryDrafts((current) => ({
        ...current,
        [updated.category_id]: updated.name,
      }));
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to rename inventory category.",
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleMenuCategory = async (category: MenuCategorySetting) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<MenuCategorySetting>(
        `/settings/menu-categories/${category.category_id}`,
        { is_active: !category.is_active },
      );
      setMenuCategories((current) =>
        current.map((item) =>
          item.category_id === updated.category_id ? updated : item,
        ),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update menu category.",
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteMenuCategory = async (category: MenuCategorySetting) => {
    if (
      busy ||
      !window.confirm(
        `Permanently delete "${category.name}"? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/settings/menu-categories/${category.category_id}`);
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete menu category.",
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteInventoryCategory = async (
    category: InventoryCategorySetting,
  ) => {
    if (
      busy ||
      !window.confirm(
        `Permanently delete "${category.name}"? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(
        `/settings/inventory-categories/${category.category_id}`,
      );
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete inventory category.",
      );
    } finally {
      setBusy(false);
    }
  };

  const createUnit = async () => {
    const name = unitName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<InventoryUnitSetting>(
        "/settings/inventory-units",
        {
          name,
          abbreviation: unitAbbreviation.trim() || null,
        },
      );
      setUnits((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setUnitName("");
      setUnitAbbreviation("");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to add unit.",
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleCategory = async (category: InventoryCategorySetting) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<InventoryCategorySetting>(
        `/settings/inventory-categories/${category.category_id}`,
        { is_active: !category.is_active },
      );
      setCategories((current) =>
        current.map((item) =>
          item.category_id === updated.category_id ? updated : item,
        ),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update category.",
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleUnit = async (unit: InventoryUnitSetting) => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await api.patch<InventoryUnitSetting>(
        `/settings/inventory-units/${unit.unit_id}`,
        { is_active: !unit.is_active },
      );
      setUnits((current) =>
        current.map((item) =>
          item.unit_id === updated.unit_id ? updated : item,
        ),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update unit.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <SkeletonSectionCard theme="admin" />;

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "10px 0",
    borderBottom: "1px solid #f0ede8",
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error && <ErrorPanel message={error} onRetry={load} />}
      <Section>
        <h3 style={{ ...typo("0.9rem", INK, 700), marginBottom: 4 }}>
          Menu Categories
        </h3>
        <Hint>
          Used by Menu Management, Cashier POS, and the customer menu.
        </Hint>
        <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
          <SI
            value={menuCategoryName}
            onChange={setMenuCategoryName}
            placeholder="Menu category name"
          />
          <button
            type="button"
            onClick={() => void createMenuCategory()}
            disabled={busy || !menuCategoryName.trim()}
            style={accentButton(busy || !menuCategoryName.trim())}
          >
            Add
          </button>
        </div>
        {menuCategories.map((category) => (
          <div key={category.category_id} style={rowStyle}>
            <SI
              value={
                category.system_key === "chicken_flavors"
                  ? "Sauces"
                  : (menuCategoryDrafts[category.category_id] ?? category.name)
              }
              onChange={(value) =>
                setMenuCategoryDrafts((current) => ({
                  ...current,
                  [category.category_id]: value,
                }))
              }
              ariaLabel={`Rename ${category.system_key === "chicken_flavors" ? "Sauces" : category.name}`}
              disabled={category.system_key === "chicken_flavors"}
            />
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {category.system_key === "chicken_flavors" ? (
                <span
                  style={{
                    color: ACCENT,
                    background: "#fff3ed",
                    borderRadius: 999,
                    padding: "7px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Built-in · Active
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !(
                        menuCategoryDrafts[category.category_id] ?? ""
                      ).trim() ||
                      (
                        menuCategoryDrafts[category.category_id] ??
                        category.name
                      ).trim() === category.name
                    }
                    onClick={() => void renameMenuCategory(category)}
                    style={secondaryButton()}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleMenuCategory(category)}
                    style={secondaryButton()}
                  >
                    {category.is_active ? "Active" : "Inactive"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void deleteMenuCategory(category)}
                    style={{
                      ...secondaryButton(),
                      color: ERROR,
                      borderColor: "#f5c2c0",
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
            {category.system_key === "chicken_flavors" && (
              <div className="w-full rounded-xl border border-stone-200 bg-white p-4">
                <h3 className="font-semibold">Sauces — ingredient triggers</h3>
                <p className="my-2 text-sm text-stone-500">Select inventory ingredients that require one included sauce. Any matching recipe ingredient triggers the selector once. With none selected, no item requires a sauce.</p>
                <fieldset disabled={!sauceTriggersLoaded || savingSauceTriggers} className="my-4 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                  <legend className="sr-only">Sauce trigger ingredients</legend>
                  {sauceIngredientOptions.map((ingredient) => (
                    <label key={ingredient.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={sauceTriggerIds.includes(ingredient.id)}
                        onChange={(event) => setSauceTriggerIds((current) => event.target.checked ? [...current, ingredient.id] : current.filter((id) => id !== ingredient.id))} />
                      {ingredient.name}
                    </label>
                  ))}
                </fieldset>
                {sauceTriggerError && <p role="alert" className="mb-2 text-sm text-red-600">{sauceTriggerError}</p>}
                <button type="button" disabled={!sauceTriggersLoaded || savingSauceTriggers} onClick={() => setSauceTriggerIds([])} className="mr-3 text-sm underline disabled:opacity-50">Clear selection</button>
                <button type="button" disabled={!sauceTriggersLoaded || savingSauceTriggers} className="rounded-xl bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                  onClick={async () => {
                    setSavingSauceTriggers(true); setSauceTriggerError("");
                    try {
                      const saved = await api.put<{ ingredientIds: number[] }>("/settings/sauce-triggers", { ingredientIds: sauceTriggerIds });
                      setSauceTriggerIds(saved.ingredientIds);
                    } catch (error) { setSauceTriggerError(error instanceof Error ? error.message : "Failed to save sauce triggers."); }
                    finally { setSavingSauceTriggers(false); }
                  }}>{savingSauceTriggers ? "Saving…" : "Save sauce triggers"}</button>
              </div>
            )}
          </div>
        ))}
      </Section>
      <Section>
        <h3 style={{ ...typo("0.9rem", INK, 700), marginBottom: 4 }}>
          Inventory Categories
        </h3>
        <Hint>
          Choose whether each category tracks an Expiry Date, Shelf Life, or no
          date. This applies to all materials in that category.
        </Hint>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 180px", minWidth: 150 }}>
            <SI
              value={categoryName}
              onChange={setCategoryName}
              placeholder="Category name"
            />
          </div>
          <SS
            value={categoryTracking}
            onChange={setCategoryTracking}
            options={[
              { value: "", label: "Choose date tracking" },
              ...INVENTORY_TRACKING_OPTIONS,
            ]}
          />
          <button
            type="button"
            onClick={() => void createCategory()}
            disabled={busy || !categoryName.trim() || !categoryTracking}
            style={accentButton(
              busy || !categoryName.trim() || !categoryTracking,
            )}
          >
            Add
          </button>
        </div>
        {categories.map((category) => (
          <div key={category.category_id} style={rowStyle}>
            <div style={{ flex: "1 1 170px", minWidth: 140 }}>
              <SI
                value={categoryDrafts[category.category_id] ?? category.name}
                onChange={(value) =>
                  setCategoryDrafts((current) => ({
                    ...current,
                    [category.category_id]: value,
                  }))
                }
                ariaLabel={`Rename ${category.name}`}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <SS
                value={
                  categoryTrackingDrafts[category.category_id] ??
                  category.date_tracking_type ?? ""
                }
                onChange={(value) =>
                  setCategoryTrackingDrafts((current) => ({
                    ...current,
                    [category.category_id]: value,
                  }))
                }
                options={category.date_tracking_type == null
                  ? [{ value: "", label: "Choose date tracking" }, ...INVENTORY_TRACKING_OPTIONS]
                  : INVENTORY_TRACKING_OPTIONS}
              />
              <button
                type="button"
                disabled={
                  busy ||
                  !(categoryTrackingDrafts[category.category_id] ?? category.date_tracking_type) ||
                  (categoryTrackingDrafts[category.category_id] ??
                    category.date_tracking_type) === category.date_tracking_type
                }
                onClick={() => void saveCategoryTracking(category)}
                style={secondaryButton()}
              >
                Save Tracking
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  !(categoryDrafts[category.category_id] ?? "").trim() ||
                  (
                    categoryDrafts[category.category_id] ?? category.name
                  ).trim() === category.name
                }
                onClick={() => void renameCategory(category)}
                style={secondaryButton()}
              >
                Save Name
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleCategory(category)}
                style={secondaryButton()}
              >
                {category.is_active ? "Active" : "Inactive"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void deleteInventoryCategory(category)}
                style={{
                  ...secondaryButton(),
                  color: ERROR,
                  borderColor: "#f5c2c0",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </Section>
      <Section>
        <h3 style={{ ...typo("0.9rem", INK, 700), marginBottom: 12 }}>
          Inventory Units
        </h3>
        <Hint>Set how many base units equal 1 unit, e.g. 1 kg = 1000 g (base: g, factor: 1000). Only direct conversions and their inverse are used.</Hint>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(90px, .4fr) auto",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <SI value={unitName} onChange={setUnitName} placeholder="Unit name" />
          <SI
            value={unitAbbreviation}
            onChange={setUnitAbbreviation}
            placeholder="Abbrev."
          />
          <button
            type="button"
            onClick={() => void createUnit()}
            disabled={busy || !unitName.trim()}
            style={accentButton(busy || !unitName.trim())}
          >
            Add
          </button>
        </div>
        {units.map((unit) => {
          const conversion = unitConversionDrafts[unit.unit_id] ?? {
            base: unit.base_unit_id == null ? "" : String(unit.base_unit_id),
            left: "1",
        right: unit.conversion_to_base == null ? "" : String(unit.conversion_to_base),
          };
          return (
          <div key={unit.unit_id} style={rowStyle}>
            <div>
              <span style={typo("0.8rem", INK, 500)}>{unit.name}{unit.abbreviation ? ` (${unit.abbreviation})` : ""}</span>
              {unit.base_unit_id && unit.conversion_to_base && (
                <p className="mt-1 text-xs text-stone-500">1 {unit.abbreviation || unit.name} = {Number(unit.conversion_to_base)} {units.find((base) => base.unit_id === unit.base_unit_id)?.abbreviation || units.find((base) => base.unit_id === unit.base_unit_id)?.name}</p>
              )}
            </div>
            <button type="button" disabled={busy} style={secondaryButton()} onClick={() => {
              setUnitConversionDrafts((current) => ({ ...current, [unit.unit_id]: {
                base: unit.base_unit_id == null ? "" : String(unit.base_unit_id),
                left: "1",
        right: unit.conversion_to_base == null ? "" : String(unit.conversion_to_base),
              } }));
              setEditingUnitId(unit.unit_id); setError(null);
            }}>Edit</button>
            <button
              type="button"
              disabled={busy || Boolean(unit.is_system)}
              onClick={() => void toggleUnit(unit)}
              style={secondaryButton()}
            >
              {unit.is_active ? "Active" : "Inactive"}
            </button>
            {editingUnitId === unit.unit_id && (
            <div className="w-full rounded-xl border border-stone-200 bg-stone-50 p-4">
            <label className="mb-1 block text-sm">Convert to</label>
            <select aria-label={`Convert ${unit.name} to`} value={conversion.base} disabled={busy}
              onChange={(event) => setUnitConversionDrafts((current) => ({ ...current, [unit.unit_id]: { ...conversion, base: event.target.value, ...(event.target.value ? {} : { right: "" }) } }))}>
              <option value="">No conversion</option>
              {units.filter((base) => base.unit_id !== unit.unit_id).map((base) => <option key={base.unit_id} value={base.unit_id}>{base.abbreviation || base.name}</option>)}
            </select>
            <div className="my-3 flex flex-wrap items-center gap-2">
              <div className="w-24">
                <SI value={conversion.left} type="number" ariaLabel={`Quantity in ${unit.name}`} disabled={busy}
                  onChange={(left) => setUnitConversionDrafts((current) => ({ ...current, [unit.unit_id]: { ...conversion, left } }))} />
              </div>
              <span>{unit.abbreviation || unit.name} =</span>
              <div className="w-24">
                <SI value={conversion.right} type="number" ariaLabel="Equivalent quantity" disabled={busy}
                  onChange={(right) => setUnitConversionDrafts((current) => ({ ...current, [unit.unit_id]: { ...conversion, right } }))} />
              </div>
              <span>{units.find((base) => String(base.unit_id) === conversion.base)?.abbreviation || units.find((base) => String(base.unit_id) === conversion.base)?.name || ""}</span>
            </div>
            <button type="button" disabled={busy} style={secondaryButton()} onClick={async () => {
              if (Boolean(conversion.base) !== Boolean(conversion.right) ||
                  (conversion.base && (!Number.isFinite(Number(conversion.left)) || Number(conversion.left) <= 0 ||
                    !Number.isFinite(Number(conversion.right)) || Number(conversion.right) <= 0))) {
                setError("Choose a unit and enter positive quantities on both sides."); return;
              }
              setBusy(true); setError(null);
              try {
                const updated = await api.patch<InventoryUnitSetting>(`/settings/inventory-units/${unit.unit_id}`, {
                  base_unit_id: conversion.base ? Number(conversion.base) : null,
                  conversion_to_base: conversion.base ? Number(conversion.right) / Number(conversion.left) : null,
                });
                setUnits((current) => current.map((entry) => entry.unit_id === updated.unit_id ? updated : entry));
                setEditingUnitId(null);
              } catch (error) { setError(error instanceof Error ? error.message : "Failed to save conversion."); }
              finally { setBusy(false); }
            }}>Save</button>
            <button type="button" disabled={busy} style={{ ...secondaryButton(), marginLeft: 8 }} onClick={() => setEditingUnitId(null)}>Cancel</button>
            </div>
            )}
          </div>
        ); })}
      </Section>
    </div>
  );
}

export function OrderingTab(p: TabProps) {
  return (
    <>
      <Section>
        <TR
          label="Accept online orders"
          desc="Allow customers to place orders from your online menu."
          {...bindFlag(p, "acceptOnlineOrders")}
        />
        <FR label="Minimum order (₱)" last>
          <SI
            {...bindText(p, "minimumOrderAmount")}
            type="number"
            placeholder="e.g. 150"
          />
        </FR>
      </Section>
      <Section>
        <FR label="Store status" last>
          <SS
            value={p.s.storeStatusMode}
            onChange={(v) => p.set("storeStatusMode", v)}
            options={STORE_MODE_OPTIONS}
          />
        </FR>
      </Section>
    </>
  );
}

export function BillingTab(p: TabProps) {
  return (
    <Section>
      <FR label="VAT rate (%)">
        <SI {...bindText(p, "taxRate")} type="number" placeholder="e.g. 12" />
      </FR>
      <FR label="Service charge (%)" last>
        <SI
          {...bindText(p, "serviceCharge")}
          type="number"
          placeholder="e.g. 10"
        />
      </FR>
    </Section>
  );
}

export function NotifTab(p: TabProps) {
  return (
    <>
      <Section>
        <TR
          label="Toast notifications"
          {...bindFlag(p, "enableToastNotifications")}
        />
        <TR
          label="New order alerts"
          desc="Sound and visual alerts for incoming orders."
          {...bindFlag(p, "newOrderAlertsEnabled")}
        />
        <TR
          label="Low stock alerts"
          desc="Notify when inventory falls below threshold."
          {...bindFlag(p, "lowStockAlertsEnabled")}
          last
        />
      </Section>
      <Section>
        <FR label="Position">
          <SS
            value={p.s.toastPosition}
            onChange={(v) => p.set("toastPosition", v)}
            options={TOAST_POSITION_OPTIONS}
          />
        </FR>
        <FR label="Duration" last>
          <SS
            {...bindText(p, "toastDuration")}
            options={TOAST_DURATION_OPTIONS}
          />
        </FR>
      </Section>
    </>
  );
}

export function SecurityTab(p: TabProps) {
  return (
    <Section>
      <FR label="Session timeout (min)" last>
        <SI
          {...bindText(p, "sessionTimeout")}
          type="number"
          placeholder="e.g. 30"
        />
      </FR>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Roles & permissions tab (read-only)                                        */
/* -------------------------------------------------------------------------- */

// Roles shown as columns. The pages (rows) and every value come from the API.
const ROLE_COLUMNS = ["administrator", "cashier", "inventory_manager"];

type PermissionMatrix = Record<string, Record<string, boolean> | undefined>;

// "menuManagement" -> "Menu Management"
const formatPermissionLabel = (key: string) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());

// Loads the role permissions from the same endpoint the main sidebar uses.
function usePermissionMatrix() {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setMatrix(null);
    setError(null);
    setNotice(null);
    api
      .get<Record<string, unknown>>("/settings/permissions")
      .then((data) => {
        if (!data || typeof data !== "object")
          throw new Error("Invalid permissions response");
        // The API may return { permissions: {...} } or the map itself.
        const raw = "permissions" in data ? data.permissions : data;
        const map = normalizePermissionsMap(
          (raw as Partial<PermissionsMap> | null | undefined) ?? null,
        );
        setMatrix(map as unknown as PermissionMatrix);
      })
      .catch(() => setError("Failed to load permissions. Please try again."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (role: string, page: string) => {
    if (role === "administrator") return;
    setMatrix((current) =>
      current
        ? {
            ...current,
            [role]: {
              ...current[role],
              [page]: current[role]?.[page] !== true,
            },
          }
        : current,
    );
    setNotice(null);
  };

  const save = async () => {
    if (!matrix || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await api.put<Record<string, unknown>>(
        "/settings/permissions",
        {
          permissions: matrix,
        },
      );
      const raw = "permissions" in response ? response.permissions : response;
      setMatrix(
        normalizePermissionsMap(
          (raw as Partial<PermissionsMap> | null | undefined) ?? null,
        ) as unknown as PermissionMatrix,
      );
      setNotice("Role permissions saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save permissions.",
      );
    } finally {
      setSaving(false);
    }
  };

  return { matrix, error, saving, notice, reload: load, toggle, save };
}

export function RolesTab() {
  const { matrix, error, saving, notice, reload, toggle, save } =
    usePermissionMatrix();
  const isMobile = useViewport() === "mobile";

  if (error) return <ErrorPanel message={error} onRetry={reload} />;
  if (!matrix) return <div style={{ ...S.panel, height: 200, opacity: 0.6 }} />;

  // Every page any role has a setting for, in the order the API returns them.
  const pages = Array.from(
    new Set(ROLE_COLUMNS.flatMap((role) => Object.keys(matrix[role] ?? {}))),
  );

  if (!pages.length) {
    return (
      <p style={{ ...typo("0.78rem", MUTED, 400), padding: "24px 0" }}>
        No permissions have been configured yet.
      </p>
    );
  }

  const cellX = isMobile ? 8 : 14;

  return (
    <>
      <Section>
        {/* The table scrolls sideways inside its own box so the page never does. */}
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table
            style={{
              width: "100%",
              minWidth: 420,
              borderCollapse: "collapse",
              fontFamily: FONT,
              fontSize: "0.78rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #f0ede8" }}>
                <th
                  style={{
                    padding: `11px ${isMobile ? 12 : 20}px 11px 0`,
                    textAlign: "left",
                    color: MUTED,
                    fontWeight: 500,
                  }}
                >
                  Page
                </th>
                {ROLE_COLUMNS.map((role) => (
                  <th
                    key={role}
                    style={{
                      padding: `11px ${cellX}px`,
                      textAlign: "center",
                      color: "#5a5652",
                      fontWeight: 600,
                    }}
                  >
                    {formatRoleLabel(role)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pages.map((page, i) => (
                <tr
                  key={page}
                  style={{
                    borderBottom:
                      i < pages.length - 1 ? "1px solid #f0ede8" : "none",
                  }}
                >
                  <td
                    style={{
                      padding: `10px ${isMobile ? 12 : 20}px 10px 0`,
                      color: "#484340",
                      fontWeight: 500,
                    }}
                  >
                    {formatPermissionLabel(page)}
                  </td>
                  {ROLE_COLUMNS.map((role) => {
                    const allowed = matrix[role]?.[page] === true;
                    return (
                      <td
                        key={role}
                        style={{
                          padding: `10px ${cellX}px`,
                          textAlign: "center",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggle(role, page)}
                          disabled={role === "administrator" || saving}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 20,
                            height: 20,
                            borderRadius: 5,
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            background: allowed
                              ? "rgba(224,90,30,.1)"
                              : "#f5f4f2",
                            color: allowed ? ACCENT : "#c8c4be",
                            border: "none",
                            cursor:
                              role === "administrator"
                                ? "not-allowed"
                                : "pointer",
                          }}
                          aria-label={allowed ? "Allowed" : "Not allowed"}
                        >
                          {allowed ? "✓" : "—"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Hint>
          Administrator access is fixed. Select a Cashier or Inventory Manager
          cell, then save.
        </Hint>
        {notice && (
          <p style={{ ...typo("0.76rem", SUCCESS, 500), marginTop: 12 }}>
            {notice}
          </p>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          style={{ ...accentButton(saving), marginTop: 14 }}
        >
          {saving ? "Saving..." : "Save Role Permissions"}
        </button>
      </Section>
      <DiscountPasswordSection />
      <RefundPasswordSection />
    </>
  );
}

function DiscountPasswordSection() {
  const [currentAdminPassword, setCurrentAdminPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  const save = async () => {
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({
        text: "New password confirmation does not match.",
        error: true,
      });
      return;
    }
    setSaving(true);
    try {
      const response = await api.put<{ message: string }>(
        "/settings/discount-password",
        {
          currentAdminPassword,
          newPassword,
          confirmPassword,
        },
      );
      setCurrentAdminPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ text: response.message, error: false });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "Failed to update discount password.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section>
      <h3 style={{ ...typo("0.92rem", INK, 650), marginBottom: 4 }}>
        Discount Authorization Password
      </h3>
      <Hint>
        Cashiers enter this password when applying a protected discount. It is
        stored only as a secure hash.
      </Hint>
      <FR label="Current admin password">
        <SI
          value={currentAdminPassword}
          onChange={setCurrentAdminPassword}
          type="password"
        />
      </FR>
      <FR label="New discount password">
        <SI
          value={newPassword}
          onChange={setNewPassword}
          type="password"
          placeholder="8 to 72 characters"
        />
      </FR>
      <FR label="Confirm new password" last>
        <SI
          value={confirmPassword}
          onChange={setConfirmPassword}
          type="password"
        />
      </FR>
      {message && (
        <p
          style={{
            ...typo("0.76rem", message.error ? ERROR : SUCCESS, 500),
            marginTop: 8,
          }}
        >
          {message.text}
        </p>
      )}
      <button
        type="button"
        onClick={() => void save()}
        disabled={
          saving || !currentAdminPassword || !newPassword || !confirmPassword
        }
        style={{
          ...accentButton(
            saving || !currentAdminPassword || !newPassword || !confirmPassword,
          ),
          marginTop: 14,
        }}
      >
        {saving ? "Updating..." : "Update Discount Password"}
      </button>
    </Section>
  );
}

/**
 * Administrator-only refund authorization password management.
 * Uses the same protected Settings pattern as discount authorization while
 * keeping refund and discount credentials completely separate.
 */
function RefundPasswordSection() {
  const [currentAdminPassword, setCurrentAdminPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  const passwordBytes = new TextEncoder().encode(newPassword).length;
  const passwordLengthValid = passwordBytes >= 8 && passwordBytes <= 72;
  const canSave =
    !saving &&
    !!currentAdminPassword &&
    passwordLengthValid &&
    !!confirmPassword;

  const save = async () => {
    if (saving) return;
    setMessage(null);
    if (!currentAdminPassword) {
      setMessage({
        text: "Enter your current administrator password.",
        error: true,
      });
      return;
    }
    if (!passwordLengthValid) {
      setMessage({
        text: "Refund password must be 8 to 72 bytes long.",
        error: true,
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({
        text: "New refund password confirmation does not match.",
        error: true,
      });
      return;
    }

    setSaving(true);
    try {
      const response = await api.put<{ message: string }>(
        "/settings/refund-password",
        {
          currentAdminPassword,
          newPassword,
          confirmPassword,
        },
      );
      setCurrentAdminPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({
        text: response.message || "Refund authorization password updated.",
        error: false,
      });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "Failed to update refund authorization password.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section>
      <div style={{ borderTop: "1px solid #ececec", margin: "24px 0 20px" }} />
      <h3 style={{ ...typo("0.92rem", INK, 650), marginBottom: 4 }}>
        Refund Authorization Password
      </h3>
      <Hint>
        Cashiers and Administrators must enter this shared password before
        refunding an eligible paid order. It is separate from the discount
        password and is stored securely as a hash.
      </Hint>
      <FR label="Current admin password">
        <SI
          value={currentAdminPassword}
          onChange={setCurrentAdminPassword}
          type="password"
          placeholder="Your login password"
        />
      </FR>
      <FR label="New refund password">
        <SI
          value={newPassword}
          onChange={setNewPassword}
          type="password"
          placeholder="8 to 72 bytes"
        />
      </FR>
      <FR label="Confirm new password" last>
        <SI
          value={confirmPassword}
          onChange={setConfirmPassword}
          type="password"
        />
      </FR>
      {newPassword && !passwordLengthValid && (
        <p
          role="status"
          style={{ ...typo("0.74rem", ERROR, 500), marginTop: 8 }}
        >
          Refund password must be 8 to 72 bytes long.
        </p>
      )}
      {message && (
        <p
          role={message.error ? "alert" : "status"}
          style={{
            ...typo("0.76rem", message.error ? ERROR : SUCCESS, 500),
            marginTop: 8,
          }}
        >
          {message.text}
        </p>
      )}
      <button
        type="button"
        onClick={() => void save()}
        disabled={!canSave}
        style={{ ...accentButton(!canSave), marginTop: 14 }}
      >
        {saving ? "Updating..." : "Update Refund Password"}
      </button>
    </Section>
  );
}

// "inventory_manager" -> "Inventory Manager"
function formatRoleLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/* Feedback tab                                                               */
/* -------------------------------------------------------------------------- */

type SortKey = "newest" | "oldest" | "highest" | "lowest";

const timeOf = (entry: FeedbackEntry) => new Date(entry.createdAt).getTime();

const SORT_OPTIONS: Record<
  SortKey,
  { label: string; compare: (a: FeedbackEntry, b: FeedbackEntry) => number }
> = {
  newest: { label: "Newest", compare: (a, b) => timeOf(b) - timeOf(a) },
  oldest: { label: "Oldest", compare: (a, b) => timeOf(a) - timeOf(b) },
  highest: { label: "Highest", compare: (a, b) => b.rating - a.rating },
  lowest: { label: "Lowest", compare: (a, b) => a.rating - b.rating },
};

// 0 means "all ratings".
const RATING_FILTERS = [0, 5, 4, 3, 2, 1];

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={11}
          fill={n <= rating ? ACCENT : "none"}
          color={n <= rating ? ACCENT : "#d1cdc7"}
        />
      ))}
    </div>
  );
}

export function FeedbackTab({
  feedback,
  loading,
  error,
  onRetry,
}: {
  feedback: FeedbackEntry[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [sort, setSort] = useState<SortKey>("newest");
  const [rating, setRating] = useState(0);
  const isMobile = useViewport() === "mobile";

  // Loading placeholders
  if (loading) {
    return (
      <>
        <SkeletonSectionCard theme="admin" />
        <SkeletonListItem theme="admin" />
        <SkeletonListItem theme="admin" />
        <SkeletonListItem theme="admin" />
      </>
    );
  }

  if (error) return <ErrorPanel message={error} onRetry={onRetry} />;

  if (!feedback.length) {
    return (
      <div style={{ ...S.panel, padding: "44px 20px", textAlign: "center" }}>
        <MessageSquare size={26} color="#d1cdc7" style={{ marginBottom: 8 }} />
        <p style={typo("0.82rem", "#b0aaa3")}>No feedback yet</p>
      </div>
    );
  }

  const visible = feedback
    .filter((entry) => rating === 0 || entry.rating === rating)
    .sort(SORT_OPTIONS[sort].compare);

  return (
    <>
      {/* Rating filter and sorting. On phones the filter chips scroll sideways and the sort sits below. */}
      <div
        style={{
          display: "flex",
          alignItems: isMobile ? "stretch" : "center",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 10 : 6,
          marginBottom: 10,
          flexWrap: isMobile ? "nowrap" : "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: isMobile ? "nowrap" : "wrap",
            overflowX: isMobile ? "auto" : "visible",
            paddingBottom: isMobile ? 2 : 0,
          }}
        >
          {RATING_FILTERS.map((r) => (
            <button
              key={r}
              onClick={() => setRating(r)}
              style={{
                fontFamily: FONT,
                fontSize: "0.69rem",
                fontWeight: rating === r ? 600 : 400,
                padding: isMobile ? "7px 14px" : "4px 10px",
                borderRadius: 99,
                border: "1px solid #e4e1dc",
                background: rating === r ? ACCENT : "#fafaf9",
                color: rating === r ? "#fff" : "#7a7470",
                cursor: "pointer",
                transition: "all .15s",
                flexShrink: 0,
                boxShadow:
                  rating === r
                    ? "0 1px 4px rgba(224,90,30,.2)"
                    : "0 1px 3px rgba(0,0,0,.06)",
              }}
            >
              {r === 0 ? "All" : `${r}★`}
            </button>
          ))}
        </div>
        {!isMobile && <div style={{ flex: 1 }} />}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          style={{
            ...S.input,
            width: isMobile ? "100%" : "auto",
            padding: isMobile ? "10px 12px" : "5px 10px",
            fontSize: isMobile ? "1rem" : S.input.fontSize,
          }}
        >
          {(Object.keys(SORT_OPTIONS) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              {SORT_OPTIONS[key].label}
            </option>
          ))}
        </select>
      </div>

      {/* Reviews */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {visible.map((entry) => (
          <div
            key={entry.id}
            style={{
              ...S.panel,
              padding: "12px 16px",
              boxShadow: "0 1px 4px rgba(0,0,0,.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 5,
              }}
            >
              <span style={typo("0.8rem", INK, 600)}>{entry.reviewerName}</span>
              <span style={typo("0.66rem", "#b0aaa3", 400)}>
                {new Date(entry.createdAt).toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span
                style={{
                  ...typo("0.64rem", "#7a7470"),
                  background: "#f5f2ee",
                  border: "1px solid #ece6de",
                  borderRadius: 99,
                  padding: "2px 8px",
                }}
              >
                {entry.productName}
              </span>
            </div>
            <StarDisplay rating={entry.rating} />
            {entry.message && (
              <p
                style={{
                  ...typo("0.76rem", "#5a5652", 400),
                  lineHeight: 1.7,
                  margin: "6px 0 0",
                  overflowWrap: "anywhere",
                }}
              >
                {entry.message}
              </p>
            )}
          </div>
        ))}
        {!visible.length && (
          <p
            style={{
              ...typo("0.78rem", "#b0aaa3", 400),
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            No reviews match this filter.
          </p>
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 */
/* -------------------------------------------------------------------------- */

export interface NavGroup {
  label: string;
  items: { key: TabKey; label: string }[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Account",
    items: [{ key: "profile", label: "My Profile" }],
  },
  {
    label: "Store",
    items: [
      { key: "business", label: "Store Information" },
      { key: "payment_methods", label: "Payment Methods" },
    ],
  },
  {
    label: "Admin",
    items: [
      { key: "roles", label: "Role Permissions" },
      { key: "feedback", label: "Customer Feedback" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { key: "master_data", label: "Categories & Units" },
      { key: "inventory", label: "Inventory Thresholds" },
    ],
  },
];

// Page title and description shown above each tab.
export const TAB_META: Record<TabKey, { title: string; desc: string }> = {
  profile: {
    title: "My Profile",
    desc: "Update your own account details and password.",
  },
  master_data: {
    title: "Categories & Units",
    desc: "Maintain the category and unit choices used by inventory forms.",
  },
  business: {
    title: "Business Information",
    desc: "Restaurant identity and operating hours.",
  },
  payment_methods: {
    title: "Payment Methods",
    desc: "Configure the in-store GCash QR and customer delivery-platform links.",
  },
  ordering: {
    title: "Online Ordering",
    desc: "Accept online orders, set a minimum order, and control the store status.",
  },
  inventory: {
    title: "Inventory Configuration",
    desc: "Low and critical stock thresholds.",
  },
  billing: {
    title: "Tax & Charges",
    desc: "VAT configuration and service charge rules.",
  },
  notifications: {
    title: "Notifications",
    desc: "Alert channels and toast settings.",
  },
  roles: {
    title: "Roles & Permissions",
    desc: "Which pages each role can open, as saved in the system.",
  },
  security: { title: "Security Settings", desc: "Session timeout." },
  feedback: {
    title: "Customer Feedback",
    desc: "Customer reviews and ratings from the menu page.",
  },
};

// Small count bubble shown next to "Customer Feedback".
function CountBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        fontSize: "0.62rem",
        fontWeight: 700,
        background: ACCENT,
        color: "#fff",
        borderRadius: 99,
        padding: "2px 6px",
        minWidth: 17,
        textAlign: "center",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// One collapsible group of tabs in the settings menu (tablet and desktop).
export function SidebarGroup({
  group,
  active,
  feedbackCount,
  onSelect,
}: {
  group: NavGroup;
  active: TabKey;
  feedbackCount: number;
  onSelect: (key: TabKey) => void;
}) {
  const [open, setOpen] = useState(true);
  const isTablet = useViewport() === "tablet";

  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: FONT,
          fontSize: "0.62rem",
          fontWeight: 600,
          letterSpacing: ".09em",
          textTransform: "uppercase",
          color: "#b0aaa3",
        }}
      >
        {group.label}
        {open ? (
          <ChevronUp size={11} color="#c8c4be" />
        ) : (
          <ChevronDown size={11} color="#c8c4be" />
        )}
      </button>

      {open &&
        group.items.map(({ key, label }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: isTablet ? "10px 12px" : "11px 14px",
                background: isActive ? "#f0eeec" : "none",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                fontFamily: FONT,
                fontSize: isTablet ? "0.8rem" : "0.85rem",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? INK : "#5a5652",
                textAlign: "left",
                transition: "background .12s, color .12s",
                marginBottom: 2,
              }}
            >
              <span style={{ flex: 1 }}>{label}</span>
              {key === "feedback" && feedbackCount > 0 && (
                <CountBadge count={feedbackCount} />
              )}
            </button>
          );
        })}
    </div>
  );
}

// Phone version of the settings menu: compact grouped lists, one card per group.
function MobileTabs({
  active,
  feedbackCount,
  onSelect,
}: {
  active: TabKey;
  feedbackCount: number;
  onSelect: (key: TabKey) => void;
}) {
  return (
    <div
      style={{ borderBottom: "1px solid #f0eeec", padding: "18px 14px 10px" }}
    >
      <h2
        style={{
          ...typo("1.15rem", INK, 700),
          letterSpacing: "-0.01em",
          padding: "0 4px 10px",
        }}
      >
        Settings
      </h2>
      <div role="tablist" aria-orientation="vertical">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} style={{ marginBottom: 10 }}>
            <p
              style={{
                ...typo("0.62rem", "#b0aaa3", 600),
                letterSpacing: ".09em",
                textTransform: "uppercase",
                padding: "0 4px 5px",
              }}
            >
              {group.label}
            </p>
            <div
              style={{
                border: "1px solid #eae7e2",
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              {group.items.map(({ key, label }, i) => {
                const isActive = active === key;
                return (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSelect(key)}
                    style={{
                      width: "100%",
                      minHeight: 38,
                      boxSizing: "border-box",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      textAlign: "left",
                      padding: "9px 14px",
                      cursor: "pointer",
                      border: "none",
                      borderTop: i === 0 ? "none" : "1px solid #f0eeec",
                      background: isActive ? "#f0eeec" : "#fff",
                      color: isActive ? INK : "#5a5652",
                      fontFamily: FONT,
                      fontSize: "0.83rem",
                      fontWeight: isActive ? 600 : 500,
                      transition: "background .12s, color .12s",
                    }}
                  >
                    <span style={{ flex: 1 }}>{label}</span>
                    {key === "feedback" && feedbackCount > 0 && (
                      <CountBadge count={feedbackCount} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Data hooks                                                                 */
/* -------------------------------------------------------------------------- */

type AccessStatus = "checking" | "allowed" | "denied" | "error";

const isAdministrator = (role: unknown) =>
  normalizeRole(
    String(role ?? "")
      .trim()
      .toLowerCase(),
  ) === "administrator";

// Checks the signed-in user's role with the API. If the check fails, access is denied.
function useAdminAccess() {
  const { updateUser } = useAuth();
  const [account, setAccount] = useState<OwnAccount | null>(null);
  const [status, setStatus] = useState<AccessStatus>("checking");

  // Keeps this page and the auth context in sync with the account from the API.
  const applyAccount = useCallback(
    (data: OwnAccount) => {
      setAccount(data);
      updateUser({
        username: data.username,
        email: data.email,
        role: data.role,
      });
    },
    [updateUser],
  );

  const verify = useCallback(() => {
    setStatus("checking");
    api
      .get<OwnAccount>("/users/me")
      .then((data) => {
        applyAccount(data);
        setStatus(isAdministrator(data.role) ? "allowed" : "denied");
      })
      .catch(() => setStatus("error"));
  }, [applyAccount]);

  useEffect(() => {
    verify();
  }, [verify]);

  return { status, account, applyAccount, verify };
}

// Loads and saves the restaurant settings through the API.
function useSettings() {
  const [values, setValues] = useState<RestaurantSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Load the saved settings once when the page opens.
  useEffect(() => {
    let cancelled = false;
    api
      .get<Record<string, unknown>>("/settings")
      .then((data) => {
        if (cancelled) return;
        setValues(normalizeSettings(data));
        syncGeneralSettings(data);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Failed to load saved settings. Showing the current form values.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setField: SetField = (key, value) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveGeneralSettings(
        values as unknown as Record<string, unknown>,
      );
      setValues(normalizeSettings(saved as unknown as Record<string, unknown>));
      setNotice("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return { values, loading, saving, error, notice, setField, save };
}

// Feedback is read-only. Load it only after administrator access has been verified:
// SettingsPanel mounts exclusively for authorized administrators.
function normalizeFeedbackResponse(payload: unknown): FeedbackEntry[] {
  const object =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  const rows = Array.isArray(payload)
    ? payload
    : (object?.feedback ?? object?.reviews ?? object?.data);

  if (!Array.isArray(rows)) {
    throw new Error("Unexpected customer feedback response from the server.");
  }

  return rows.map((value, index) => {
    const item =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const id = item.id ?? item.feedback_id ?? index;
    const customerId = item.customer_user_id ?? item.customerUserId;
    const productId = item.product_id ?? item.productId;
    const reviewerName = String(
      item.reviewerName ??
        item.reviewer_name ??
        item.customer_name ??
        item.customerName ??
        item.username ??
        item.customer_username ??
        item.user_name ??
        (customerId != null ? `Customer #${customerId}` : "Customer"),
    );
    const productName = String(
      item.productName ??
        item.product_name ??
        item.menu_name ??
        item.Menu_Name ??
        (productId != null ? `Product #${productId}` : "Unknown product"),
    );
    const valueRating = Number(item.rating ?? 0);

    return {
      id: String(id),
      reviewerName,
      productName,
      rating: Number.isFinite(valueRating)
        ? Math.max(0, Math.min(5, valueRating))
        : 0,
      message: String(item.message ?? item.comment ?? ""),
      createdAt: String(item.createdAt ?? item.created_at ?? ""),
    };
  });
}

function useFeedback() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.get<unknown>("/feedback");
      setEntries(normalizeFeedbackResponse(payload));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load customer feedback.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { entries, loading, error, reload };
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

// Outer page shell: main sidebar plus the grey background.
function PageFrame({ children }: { children: ReactNode }) {
  const viewport = useViewport();
  const padding = viewport === "mobile" ? 12 : viewport === "tablet" ? 16 : 24;

  return (
    <div className="flex min-h-screen bg-gray-50" style={{ fontFamily: FONT }}>
      <Sidebar />
      {/* minWidth: 0 lets this flex child shrink instead of overflowing the screen */}
      <main className="tablet-shell flex-1" style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            height: "100%",
            background: "#f0eeec",
            padding,
            boxSizing: "border-box",
            minHeight: "100vh",
            alignItems: "flex-start",
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

// What non-administrators (and the checking / error states) see instead of the settings.
function AccessMessage({
  status,
  onRetry,
}: {
  status: AccessStatus;
  onRetry: () => void;
}) {
  if (status === "denied") return <LockedSection label="Settings" />;

  if (status === "error") {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ ...typo("0.8rem", ERROR, 400), marginBottom: 10 }}>
          We could not verify your access. Please try again.
        </p>
        <button onClick={onRetry} style={accentButton()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <p style={{ ...typo("0.8rem", MUTED, 400), textAlign: "center" }}>
      Verifying your access...
    </p>
  );
}

// The settings menu and the selected tab. Only mounted for administrators.
function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const settings = useSettings();
  const feedback = useFeedback();
  const viewport = useViewport();
  const isMobile = viewport === "mobile";
  const isTablet = viewport === "tablet";

  const meta = TAB_META[activeTab];
  const tabProps: TabProps = { s: settings.values, set: settings.setField };

  // Tabs that do not edit restaurant settings have no save button.
  const showSave = activeTab === "business" || activeTab === "inventory";

  // One status line: error first, then loading, then the save confirmation.
  const status = [
    { text: settings.error, color: ERROR },
    {
      text: settings.loading ? "Loading saved settings..." : null,
      color: MUTED,
    },
    { text: settings.notice, color: SUCCESS },
  ].find((line) => line.text);

  const renderTab = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileTab />;
      case "master_data":
        return <CategoriesUnitsTab />;
      case "business":
        return <BusinessTab {...tabProps} />;
      case "payment_methods":
        return <PaymentMethodsTab />;
      case "inventory":
        return <InventoryTab {...tabProps} />;
      case "roles":
        return <RolesTab />;
      case "feedback":
        return (
          <FeedbackTab
            feedback={feedback.entries}
            loading={feedback.loading}
            error={feedback.error}
            onRetry={() => void feedback.reload()}
          />
        );
      default:
        return <ProfileTab />;
    }
  };

  const contentPadding = isMobile
    ? "20px 16px 28px"
    : isTablet
      ? "28px 24px"
      : "32px 36px";

  return (
    <div
      style={{
        ...S.card,
        flexDirection: isMobile ? "column" : "row",
        borderRadius: isMobile ? 14 : 16,
      }}
    >
      {/* Settings menu */}
      {isMobile ? (
        <MobileTabs
          active={activeTab}
          feedbackCount={feedback.entries.length}
          onSelect={setActiveTab}
        />
      ) : (
        <div
          style={{
            width: isTablet ? 200 : 230,
            flexShrink: 0,
            background: "#fff",
            overflowY: "auto",
            padding: isTablet ? "20px 10px" : "24px 14px",
          }}
        >
          <h2
            style={{
              ...typo("1.1rem", INK, 700),
              letterSpacing: "-0.01em",
              padding: "0 10px 18px",
            }}
          >
            Settings
          </h2>
          {NAV_GROUPS.map((group) => (
            <SidebarGroup
              key={group.label}
              group={group}
              active={activeTab}
              feedbackCount={feedback.entries.length}
              onSelect={setActiveTab}
            />
          ))}
        </div>
      )}

      {/* Tab content */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: contentPadding,
          overflowY: isMobile ? "visible" : "auto",
          borderLeft: isMobile ? "none" : "1px solid #f0eeec",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: status || showSave ? 14 : 0,
          }}
        >
          {status && (
            <p
              style={{
                ...typo("0.76rem", status.color, 400),
                flex: isMobile ? "1 1 100%" : "0 1 auto",
              }}
            >
              {status.text}
            </p>
          )}
          {showSave && (
            <button
              onClick={settings.save}
              disabled={settings.saving || settings.loading}
              style={{
                ...accentButton(settings.saving || settings.loading),
                marginLeft: isMobile ? 0 : "auto",
                flex: isMobile ? "1 1 100%" : "0 0 auto",
                padding: isMobile ? "12px 16px" : "10px 16px",
              }}
            >
              {settings.saving ? "Saving..." : "Save Settings"}
            </button>
          )}
        </div>
        <h1
          style={{
            ...typo(isMobile ? "1.2rem" : "1.4rem", INK, 700),
            letterSpacing: "-0.015em",
            marginBottom: 4,
            overflowWrap: "anywhere",
          }}
        >
          {meta.title}
        </h1>
        <p
          style={{
            ...typo(isMobile ? "0.78rem" : "0.82rem", MUTED, 400),
            marginBottom: 16,
            lineHeight: 1.6,
          }}
        >
          {meta.desc}
        </p>
        {renderTab()}
      </div>
    </div>
  );
}

// Everything that depends on the screen size sits inside the provider.
function SettingsView() {
  const { status, account, verify } = useAdminAccess();
  const isMobile = useViewport() === "mobile";

  return (
    <PageFrame>
      {status === "allowed" && account ? (
        <SettingsPanel />
      ) : (
        <div
          style={{
            ...S.card,
            alignItems: "center",
            padding: isMobile ? 20 : 32,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <AccessMessage status={status} onRetry={verify} />
          </div>
        </div>
      )}
    </PageFrame>
  );
}

export default function Settings() {
  const viewport = useViewportWatcher();

  return (
    <ViewportContext.Provider value={viewport}>
      <SettingsView />
    </ViewportContext.Provider>
  );
}
