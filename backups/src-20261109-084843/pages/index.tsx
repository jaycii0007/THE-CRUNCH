import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  ShoppingBag,
  DollarSign,
  Calculator,
  Layers,
  PieChart as PieIcon,
  AlertCircle,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/Sidebar";
import { api } from "@/lib/api";
import { useEventInvalidation } from "@/hooks/use-event-invalidation";
import {
  fetchGeneralSettings,
  formatCurrencyAmount,
  formatInSettingsTimezone,
  GENERAL_SETTINGS_DEFAULTS,
  getCurrencySymbol,
} from "@/lib/restaurantSettings";
import { summarizeFinancialOrders } from "@/lib/financialStatus";
import { SkeletonKPICard, SkeletonChart } from "@/components/ui/skeleton";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: number;
  orderNumber: string;
  items: OrderItem[];
  total: number;
  date: string;
  orderType: string;
  status: string;
  paymentCategory: string;
  paymentStatus: string;
}

interface RawOrderRow {
  id: number;
  orderNumber?: string;
  total: number | string;
  date?: string;
  paymentDate?: string | null;
  payment_date?: string | null;
  readyAt?: string | null;
  ready_at?: string | null;
  handoverTimestamp?: string | null;
  handover_timestamp?: string | null;
  status?: string;
  paymentMethod?: string;
  payment_method?: string;
  paymentStatus?: string;
  payment_status?: string;
  orderType?: string;
  order_type?: string;
  productId?: number;
  productName?: string;
  price?: number;
  quantity?: number;
}

type Period = "daily" | "weekly" | "monthly" | "yearly";
type SalesView = "sales" | "orders";

interface Span {
  start: Date;
  end: Date;
}

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface PeriodOption {
  key: string;
  label: string;
  range: Span;
}

interface Share {
  label: string;
  count: number;
  pct: number;
}

interface ChartPoint {
  label: string;
  current: number;
  previous: number;
}

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

const PERIODS: { label: string; value: Period }[] = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Studio palette
const PAYMENT_COLORS: Record<string, string> = {
  GCash: "#2D5F9E",
  Cash: "#486C5D",
  Maya: "#1B7A5A",
  "Credit Card": "#B85E1A",
  Others: "#818781",
};
const FALLBACK_COLORS = ["#789486", "#486C5D", "#98B2A4", "#C4D4CC", "#5B7568"];

const TRIGGER_CLASS =
  "flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-[#E5E9E4] bg-white px-3.5 py-2 text-left shadow-sm outline-none transition duration-150 hover:border-[#789486] hover:bg-[#F8F9F6] focus-visible:ring-2 focus-visible:ring-[#789486]/25 sm:min-w-[220px]";

const PANEL_CLASS =
  "absolute left-0 top-[calc(100%+8px)] z-50 sm:left-auto sm:right-0 overflow-hidden rounded-2xl border border-[#E5E9E4] bg-white shadow-xl";

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const daySpan = (start: Date, end: Date = start): Span => ({ start: startOfDay(start), end: endOfDay(end) });

const formatDisplayDate = (d: Date, timezone?: string) =>
  formatInSettingsTimezone(d, timezone, { month: "short", day: "numeric", year: "numeric" });

const formatSpan = ({ start, end }: Span, timezone?: string) =>
  sameDay(start, end)
    ? formatDisplayDate(start, timezone)
    : `${formatDisplayDate(start, timezone)} – ${formatDisplayDate(end, timezone)}`;

const formatCompactDate = (d: Date) =>
  `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Builds the selectable ranges for a given period type. */
function getPeriodOptions(period: Period): PeriodOption[] {
  const now = new Date();
  const opt = (key: string, label: string, range: Span): PeriodOption => ({ key, label, range });

  switch (period) {
    case "daily":
      return [
        opt("today", "Today", daySpan(now)),
        opt("yesterday", "Yesterday", daySpan(addDays(now, -1))),
        ...[2, 3, 4].map((n) => opt(`${n}daysago`, `${n} days ago`, daySpan(addDays(now, -n)))),
      ];

    case "weekly": {
      const monday = addDays(now, -((now.getDay() + 6) % 7));
      const lastMonday = addDays(monday, -7);
      const twoWeeksMonday = addDays(monday, -14);
      return [
        opt("thisweek", "This week", daySpan(monday, now)),
        opt("lastweek", "Last week", daySpan(lastMonday, addDays(monday, -1))),
        opt("last7", "Last 7 days", daySpan(addDays(now, -6), now)),
        opt("2weeksago", "2 weeks ago", daySpan(twoWeeksMonday, addDays(lastMonday, -1))),
      ];
    }

    case "monthly": {
      const y = now.getFullYear();
      const m = now.getMonth();
      return [
        opt("thismonth", "This month", daySpan(new Date(y, m, 1), now)),
        opt("lastmonth", "Last month", daySpan(new Date(y, m - 1, 1), new Date(y, m, 0))),
        opt("last30", "Last 30 days", daySpan(addDays(now, -29), now)),
        opt("2monthsago", "2 months ago", daySpan(new Date(y, m - 2, 1), new Date(y, m - 1, 0))),
      ];
    }

    default: {
      const y = now.getFullYear();
      return [
        opt("thisyear", "This year", daySpan(new Date(y, 0, 1), now)),
        opt("lastyear", "Last year", daySpan(new Date(y - 1, 0, 1), new Date(y - 1, 11, 31))),
      ];
    }
  }
}

/** Orders that fall inside the given span. */
const filterByRange = (orders: Order[], range: Span | null): Order[] =>
  range
    ? orders.filter((o) => {
        if (!o.date) return false;
        const d = new Date(o.date);
        return d >= range.start && d <= range.end;
      })
    : orders;

/** Orders from the period immediately before the current one (used as chart comparison). */
function filterPreviousPeriod(orders: Order[], period: Period): Order[] {
  const now = new Date();
  return orders.filter((o) => {
    if (!o.date) return false;
    const d = new Date(o.date);
    switch (period) {
      case "daily":
        return sameDay(d, addDays(now, -1));
      case "weekly":
        return d >= addDays(now, -14) && d < addDays(now, -7);
      case "monthly": {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
      }
      default:
        return d.getFullYear() === now.getFullYear() - 1;
    }
  });
}

/** Counts orders per label and returns each label with its share of the total. */
function computeShares(orders: Order[], getLabel: (o: Order) => string): Share[] {
  const counts: Record<string, number> = {};
  orders.forEach((o) => {
    const label = getLabel(o);
    counts[label] = (counts[label] ?? 0) + 1;
  });
  const total = orders.length || 1;
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

function computeTopItems(orders: Order[], limit = 6) {
  const counts: Record<string, number> = {};
  orders.forEach((o) =>
    o.items.forEach((item) => {
      counts[item.name] = (counts[item.name] ?? 0) + item.quantity;
    }),
  );
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function computeChartData(
  current: Order[],
  previous: Order[],
  period: Period,
  view: SalesView,
): ChartPoint[] {
  const bucketOf = (d: Date): string | number => {
    if (period === "daily") return d.getHours();
    if (period === "weekly") return DAYS[d.getDay()];
    if (period === "monthly") return d.getDate();
    return d.getMonth();
  };

  const valueFor = (orders: Order[], bucket: string | number) => {
    const matches = orders.filter((o) => bucketOf(new Date(o.date)) === bucket);
    return view === "sales" ? sum(matches.map((o) => o.total)) : matches.length;
  };

  let buckets: { label: string; key: string | number }[];
  if (period === "daily") {
    buckets = Array.from({ length: 13 }, (_, i) => {
      const h = i + 9;
      return { key: h, label: `${h > 12 ? h - 12 : h}${h >= 12 ? "pm" : "am"}` };
    });
  } else if (period === "weekly") {
    buckets = DAYS.map((d) => ({ key: d, label: d }));
  } else if (period === "monthly") {
    const now = new Date();
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    buckets = Array.from({ length: days }, (_, i) => ({ key: i + 1, label: String(i + 1) }));
  } else {
    buckets = SHORT_MONTHS.map((m, i) => ({ key: i, label: m }));
  }

  return buckets.map(({ key, label }) => ({
    label,
    current: valueFor(current, key),
    previous: valueFor(previous, key),
  }));
}

/** Closes a popover when the user clicks outside of it. */
function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

/* -------------------------------------------------------------------------- */
/*                              Date range picker                             */
/* -------------------------------------------------------------------------- */

function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<Date | null>(null);
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const ref = useRef<HTMLDivElement>(null);
  const closePicker = useCallback(() => setOpen(false), [setOpen]);
  useClickOutside(ref, closePicker);

  const hasValue = !!(value.start || value.end);
  const label = value.start
    ? `${formatCompactDate(value.start)} ~ ${value.end ? formatCompactDate(value.end) : "..."}`
    : "Custom Date Range";

  const previewEnd = value.end ?? (selecting === "end" ? hovered : null);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const shiftMonth = (delta: number) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  const pickDay = (day: Date) => {
    if (selecting === "start") {
      onChange({ start: day, end: null });
      setSelecting("end");
      return;
    }
    const start = value.start ?? day;
    onChange(day < start ? { start: day, end: start } : { start, end: day });
    setSelecting("start");
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ start: null, end: null });
    setSelecting("start");
  };

  const isInRange = (day: Date) => {
    if (!value.start || !previewEnd) return false;
    const [a, b] = value.start <= previewEnd ? [value.start, previewEnd] : [previewEnd, value.start];
    return day > a && day < b;
  };

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button
        onClick={() => setOpen((o) => !o)}
        className={TRIGGER_CLASS}
        type="button"
        aria-label="Filter by date range"
        aria-expanded={open}
      >
        <Calendar size={16} className="text-[#818781] shrink-0" />
        <span className={`flex-1 truncate text-xs sm:text-sm ${hasValue ? "font-semibold text-[#242824]" : "text-[#818781]"}`}>
          {label}
        </span>
        {hasValue && (
          <span
            onClick={clear}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F3F3F0] text-[#818781] transition hover:bg-[#E5E9E4] hover:text-[#242824]"
            title="Clear date range"
            role="button"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {open && (
        <div className={`${PANEL_CLASS} w-full p-4 sm:w-[320px]`}>
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => shiftMonth(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F8F9F6] text-[#486C5D] transition hover:bg-[#E5E9E4]"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-[#242824]">
              {MONTHS[view.month]} {view.year}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F8F9F6] text-[#486C5D] transition hover:bg-[#E5E9E4]"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mb-1.5 grid grid-cols-7 gap-0.5 text-center text-[11px] font-semibold text-[#818781]">
            {WEEKDAY_HEADERS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: totalCells }, (_, i) => {
              const dayNum = i - firstWeekday + 1;
              if (dayNum < 1 || dayNum > daysInMonth) return <div key={i} />;

              const day = new Date(view.year, view.month, dayNum);
              const isEndpoint =
                (!!value.start && sameDay(day, value.start)) || (!!previewEnd && sameDay(day, previewEnd));

              let btnStyle = "text-[#242824] hover:bg-[#F8F9F6]";
              if (isEndpoint) {
                btnStyle = "bg-[#789486] font-semibold text-white shadow-sm";
              } else if (isInRange(day)) {
                btnStyle = "bg-[#789486]/15 text-[#486C5D] font-medium";
              }

              return (
                <button
                  key={i}
                  onClick={() => pickDay(day)}
                  onMouseEnter={() => setHovered(day)}
                  onMouseLeave={() => setHovered(null)}
                  className={`h-8 rounded-lg text-xs transition duration-150 ${btnStyle}`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          <p className="mt-3 border-t border-[#E5E9E4] pt-2.5 text-center text-[11px] text-[#818781]">
            {selecting === "start" ? "Click to set start date" : "Click to set end date"}
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Period dropdown                              */
/* -------------------------------------------------------------------------- */

interface PeriodDropdownProps {
  period: Period;
  subKey: string;
  timezone?: string;
  disabled?: boolean;
  onSelect: (period: Period, subKey: string) => void;
}

function PeriodDropdown({ period, subKey, timezone, disabled, onSelect }: PeriodDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closePicker = useCallback(() => setOpen(false), [setOpen]);
  useClickOutside(ref, closePicker);

  const options = getPeriodOptions(period);
  const active = options.find((o) => o.key === subKey) ?? options[0];
  const periodLabel = PERIODS.find((p) => p.value === period)?.label;

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`${TRIGGER_CLASS} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        type="button"
        aria-label="Select reporting period"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs sm:text-sm font-semibold text-[#242824]">
            {periodLabel} · {active.label}
          </div>
          <div className="truncate text-[11px] text-[#818781]">
            {formatSpan(active.range, timezone)}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#818781] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className={`${PANEL_CLASS} w-full sm:w-[280px]`}>
          {PERIODS.map(({ label, value: groupPeriod }, index) => (
            <div key={groupPeriod} className={index > 0 ? "border-t border-[#E5E9E4]" : ""}>
              <div className="bg-[#F8F9F6] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#818781]">
                {label}
              </div>
              {getPeriodOptions(groupPeriod).map((opt) => {
                const isActive = groupPeriod === period && opt.key === subKey;
                return (
                  <button
                    key={opt.key}
                    onClick={() => {
                      onSelect(groupPeriod, opt.key);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-xs transition duration-150 ${
                      isActive
                        ? "bg-[#789486]/12 font-semibold text-[#486C5D]"
                        : "text-[#242824] hover:bg-[#F8F9F6]"
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-[11px] text-[#818781]">
                      {formatSpan(opt.range, timezone)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               KPI Card Component                           */
/* -------------------------------------------------------------------------- */

interface KpiCardProps {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
}

function KpiCard({ label, value, hint, icon: Icon }: KpiCardProps) {
  return (
    <article className="ov-kpi-card" tabIndex={0} aria-label={`${label}: ${value}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-[#818781]">
            {label}
          </p>
          <p className="mt-1.5 truncate text-2xl font-bold tracking-tight text-[#242824] sm:text-3xl" title={value}>
            {value}
          </p>
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F4F1] text-[#486C5D]"
          aria-hidden="true"
        >
          <Icon size={20} strokeWidth={1.8} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-[#818781] truncate">
        {hint.split(" · ").map((part, i, arr) => {
          const isNegative = part.toLowerCase().includes("cancelled") || part.toLowerCase().includes("refunded");
          return (
            <React.Fragment key={i}>
              <span className={`truncate font-medium ${isNegative ? "text-[#C05656]" : "text-[#818781]"}`}>
                {part}
              </span>
              {i < arr.length - 1 && <span className="text-[#E5E9E4]">·</span>}
            </React.Fragment>
          );
        })}
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Empty State                                 */
/* -------------------------------------------------------------------------- */

const EmptyState = ({ message, icon, title }: { message: string; icon?: React.ReactNode; title?: string }) => (
  <div className="flex min-h-[170px] flex-col items-center justify-center px-4 py-8 text-center">
    {icon && (
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8F9F6] text-[#818781]">
        {icon}
      </div>
    )}
    {title && <p className="text-xs font-semibold uppercase tracking-wider text-[#242824]">{title}</p>}
    <p className="mt-1 max-w-[260px] text-xs text-[#818781]">{message}</p>
  </div>
);

/* -------------------------------------------------------------------------- */
/*                             Top-Selling Items                              */
/* -------------------------------------------------------------------------- */

function TopItemsChart({ items }: { items: { name: string; count: number }[] }) {
  if (items.length === 0) {
    return <EmptyState message="No sales data for this period yet." title="Top-Selling Items" icon={<ShoppingBag size={20} />} />;
  }
  const max = items[0].count || 1;

  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item, i) => (
        <div key={item.name} className="flex items-center gap-3">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
              i === 0
                ? "bg-[#486C5D] text-white"
                : i < 3
                ? "bg-[#F0F4F1] text-[#486C5D]"
                : "text-[#818781]"
            }`}
          >
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs sm:text-sm font-medium text-[#242824]" title={item.name}>
            {item.name}
          </span>
          <div className="h-2 w-24 sm:w-32 shrink-0 overflow-hidden rounded-full bg-[#F3F3F0]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                i === 0 ? "bg-[#486C5D]" : "bg-[#789486]"
              }`}
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs sm:text-sm font-bold text-[#242824]">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Order Types                                 */
/* -------------------------------------------------------------------------- */

function OrderTypeBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-24 shrink-0 truncate text-xs sm:text-sm font-medium text-[#242824]" title={label}>
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F3F3F0]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs sm:text-sm font-bold text-[#242824]">
        {pct}%
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Data loading                                */
/* -------------------------------------------------------------------------- */

/** The API returns one row per order line; group the rows into orders. */
function groupOrderRows(rows: RawOrderRow[]): Order[] {
  const grouped = new Map<number, Order>();

  rows.forEach((row) => {
    if (!grouped.has(row.id)) {
      const financialTimestamp =
        row.handoverTimestamp ??
        row.handover_timestamp ??
        row.readyAt ??
        row.ready_at ??
        row.paymentDate ??
        row.payment_date ??
        row.date;
      grouped.set(row.id, {
        id: row.id,
        orderNumber: row.orderNumber || `#${row.id}`,
        items: [],
        total: Number(row.total) || 0,
        date: financialTimestamp ? new Date(financialTimestamp).toISOString() : "",
        orderType: row.orderType ?? row.order_type ?? "",
        status: row.status ?? "",
        paymentCategory: row.paymentMethod ?? row.payment_method ?? "",
        paymentStatus: row.paymentStatus ?? row.payment_status ?? "",
      });
    }
    if (row.productId) {
      grouped.get(row.id)!.items.push({
        name: row.productName ?? "",
        price: row.price ?? 0,
        quantity: row.quantity ?? 1,
      });
    }
  });

  return [...grouped.values()];
}

/* -------------------------------------------------------------------------- */
/*                          Custom Chart Tooltip                              */
/* -------------------------------------------------------------------------- */

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
  label?: string;
  currencySymbol: string;
  salesView: SalesView;
}

function CustomStudioTooltip({
  active,
  payload,
  label,
  currencySymbol,
  salesView,
}: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-[#E5E9E4] bg-white px-3.5 py-2.5 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-[#818781]">{label}</p>
      <div className="flex flex-col gap-1">
        {payload.map((entry, idx) => {
          const val = entry.value;
          const formatted =
            salesView === "sales"
              ? `${currencySymbol}${val.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`
              : `${val} orders`;
          return (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color || "#789486" }}
              />
              <span className="font-medium text-[#818781]">{entry.name}:</span>
              <span className="font-bold text-[#242824]">{formatted}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Main Dashboard                                */
/* -------------------------------------------------------------------------- */

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState(GENERAL_SETTINGS_DEFAULTS);
  const [period, setPeriod] = useState<Period>("daily");
  const [subKey, setSubKey] = useState("today");
  const [salesView, setSalesView] = useState<SalesView>("sales");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- Data ---- */

  useEffect(() => {
    let cancelled = false;
    void fetchGeneralSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadOrders = useCallback(async (initialLoad = false) => {
    if (initialLoad) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const rows = await api.get<RawOrderRow[]>("/orders");
      setOrders(rows?.length ? groupOrderRows(rows) : []);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      if (initialLoad) setOrders([]);
    } finally {
      if (initialLoad) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders(true);
  }, [loadOrders]);

  useEventInvalidation({
    topics: ["orders.changed", "payments.changed"],
    onInvalidate: loadOrders,
  });

  /* ---- Derived data ---- */

  const hasCustomRange = !!(dateRange.start && dateRange.end);
  const activeOption = useMemo(() => {
    const options = getPeriodOptions(period);
    return options.find((o) => o.key === subKey) ?? options[0];
  }, [period, subKey]);

  const activeRange: Span = hasCustomRange
    ? daySpan(dateRange.start!, dateRange.end!)
    : activeOption.range;

  const filteredOrders = useMemo(
    () => filterByRange(orders, activeRange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, activeRange.start.getTime(), activeRange.end.getTime()],
  );
  const previousOrders = useMemo(() => filterPreviousPeriod(orders, period), [orders, period]);

  const financialSummary = useMemo(
    () => summarizeFinancialOrders(filteredOrders),
    [filteredOrders],
  );
  const previousFinalizedSales = useMemo(
    () => summarizeFinancialOrders(previousOrders).finalizedSales,
    [previousOrders],
  );
  const {
    totalOrders,
    totalSales: totalRevenue,
    finalizedSalesCount,
    averageOrderValue: avgOrderValue,
    cancelledOrders,
    refundedOrders,
    finalizedSales,
  } = financialSummary;

  const topItems = useMemo(() => computeTopItems(finalizedSales), [finalizedSales]);
  const orderTypes = useMemo(
    () => computeShares(finalizedSales, (o) => o.orderType || "Unknown"),
    [finalizedSales],
  );
  const payments = useMemo(
    () => computeShares(finalizedSales, (o) => o.paymentCategory || "Others"),
    [finalizedSales],
  );
  const chartData = useMemo(
    () => computeChartData(finalizedSales, previousFinalizedSales, period, salesView),
    [finalizedSales, previousFinalizedSales, period, salesView],
  );

  /* ---- Formatting ---- */

  const { timezone } = settings;
  const periodLabel = PERIODS.find((p) => p.value === period)?.label.toLowerCase() ?? "";
  const currencySymbol = getCurrencySymbol(settings);
  const wholeNumber = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
  const money = (v: number, opts?: typeof wholeNumber) => formatCurrencyAmount(v, settings, opts);

  const axisFormatter = (v: number) =>
    salesView === "sales" ? `${currencySymbol}${v >= 1000 ? `${Math.round(v / 1000)}k` : v}` : String(v);

  const noOrdersInRange = !error && orders.length > 0 && filteredOrders.length === 0;

  // Show fullscreen loader during initial data fetch
  if (isLoading) {
    return (
      <div className="ov-canvas flex items-center justify-center">
        <Sidebar />
        <div className="w-full max-w-7xl p-6">
          <div className="grid grid-cols-4 gap-4">
            <SkeletonKPICard theme="admin" />
            <SkeletonKPICard theme="admin" />
            <SkeletonKPICard theme="admin" />
            <SkeletonKPICard theme="admin" />
          </div>
          <SkeletonChart theme="admin" className="mt-6 h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="ov-canvas">
      <Sidebar />

      <main className="ov-container">
        {/* ============ HEADER ============ */}
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#818781]">
              Dashboard
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#242824] sm:text-3xl">
              {settings.restaurantName || "THE CRUNCH"}
            </h1>
          </div>

          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
            <PeriodDropdown
              period={period}
              subKey={subKey}
              timezone={timezone}
              disabled={hasCustomRange}
              onSelect={(p, key) => {
                setPeriod(p);
                setSubKey(key);
              }}
            />
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        </motion.header>

        {/* ============ STATUS BANNERS ============ */}
        {error && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-[#C05656]/20 bg-[#C05656]/10 px-4 py-3 text-xs font-medium text-[#C05656]">
            <AlertCircle size={16} className="shrink-0" />
            <span>Dashboard data failed to load: {error}</span>
          </div>
        )}
        {noOrdersInRange && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-[#A68A3A]/20 bg-[#A68A3A]/10 px-4 py-3 text-xs font-medium text-[#A68A3A]">
            <AlertCircle size={16} className="shrink-0" />
            <span>No orders match the selected {hasCustomRange ? "date range" : "period"}</span>
          </div>
        )}

        {/* ============ 3 KPI CARDS (ALIGNED 3-COL ON DESKTOP) ============ */}
        <motion.section
          aria-labelledby="kpi-heading"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.05, ease: "easeOut" }}
          className="ov-kpi-grid"
        >
          <h2 id="kpi-heading" className="sr-only">Key Performance Indicators</h2>
          <KpiCard
            label="Total Orders"
            value={totalOrders.toLocaleString()}
            hint={`${cancelledOrders} cancelled · ${refundedOrders} refunded`}
            icon={ShoppingBag}
          />
          <KpiCard
            label="Total Revenue"
            value={money(totalRevenue, wholeNumber)}
            hint={`${finalizedSalesCount} completed paid orders`}
            icon={DollarSign}
          />
          <KpiCard
            label="Avg Order Value"
            value={money(avgOrderValue)}
            hint="Per finalized sale"
            icon={Calculator}
          />
        </motion.section>

        {/* ============ MAIN ANALYTICS GRID (8:4 RATIO) ============ */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.1, ease: "easeOut" }}
          className="ov-main-grid"
        >
          {/* Order & Sales Review (8 columns) */}
          <section aria-labelledby="sales-heading" className="ov-card flex flex-col justify-between">
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 id="sales-heading" className="text-lg font-bold tracking-tight text-[#242824] sm:text-xl">
                    Order & Sales Review
                  </h2>
                  <p className="mt-0.5 text-xs text-[#818781]">
                    {formatSpan(activeRange, timezone)}
                  </p>
                </div>

                {/* Sales / Orders view switch */}
                <div className="ov-view-toggle self-start sm:self-auto" role="group" aria-label="Sales view selection">
                  {(["sales", "orders"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setSalesView(v)}
                      className={`ov-view-toggle-btn ${salesView === v ? "active" : ""}`}
                      aria-pressed={salesView === v}
                      type="button"
                    >
                      {v === "sales" ? "Sales" : "Orders"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metric bar & Legend */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E9E4] pb-3.5">
                <div>
                  <span className="text-xl font-bold tracking-tight text-[#486C5D] sm:text-2xl">
                    {salesView === "sales" ? money(totalRevenue, wholeNumber) : `${totalOrders.toLocaleString()} orders`}
                  </span>
                  <span className="ml-2 text-xs text-[#818781]">
                    as of {formatDisplayDate(activeRange.end, timezone)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#818781]">
                  <span className="flex items-center gap-1.5 font-medium text-[#242824]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#789486]" />
                    {hasCustomRange ? "Selected range" : activeOption.label}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium text-[#818781]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#C2C9C2]" />
                    Previous {periodLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Recharts Area + Line */}
            <div className="mt-4 h-[300px] sm:h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sageGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#789486" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#789486" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EAECE8" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#818781", fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    dy={6}
                    minTickGap={12}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#818781", fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={axisFormatter}
                    tickCount={5}
                  />
                  <Tooltip
                    content={
                      <CustomStudioTooltip
                        currencySymbol={currencySymbol}
                        salesView={salesView}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="current"
                    stroke="none"
                    fill="url(#sageGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="current"
                    name={hasCustomRange ? "Selected range" : activeOption.label}
                    stroke="#789486"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "#789486", stroke: "#FFFFFF", strokeWidth: 2 }}
                    activeDot={{ r: 5.5, fill: "#486C5D", stroke: "#FFFFFF", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="previous"
                    name={`Previous ${periodLabel}`}
                    stroke="#B8BEB8"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 4.5, fill: "#B8BEB8", stroke: "#FFFFFF", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Payment Methods (4 columns) */}
          <section aria-labelledby="payments-heading" className="ov-card flex flex-col justify-between">
            <div>
              <h2 id="payments-heading" className="text-lg font-bold tracking-tight text-[#242824] sm:text-xl">
                Payment Methods
              </h2>
              <p className="mt-0.5 text-xs text-[#818781]">
                Breakdown by payment type
              </p>
            </div>

            {payments.length > 0 ? (
              <div className="my-auto flex flex-col items-center">
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={payments}
                        dataKey="count"
                        nameKey="label"
                        innerRadius={50}
                        outerRadius={74}
                        paddingAngle={3}
                      >
                        {payments.map((entry, i) => (
                          <Cell
                            key={entry.label}
                            fill={PAYMENT_COLORS[entry.label] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number, name: string) => [`${val} orders`, name]}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #E5E9E4",
                          boxShadow: "0 8px 24px rgba(36,40,36,0.08)",
                          fontSize: 12,
                          backgroundColor: "#FFFFFF",
                          color: "#242824",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend breakdown list */}
                <div className="mt-3 flex w-full flex-col gap-2">
                  {payments.map((entry, i) => (
                    <div
                      key={entry.label}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs transition hover:bg-[#F8F9F6]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              PAYMENT_COLORS[entry.label] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
                          }}
                        />
                        <span className="truncate font-medium text-[#242824]">{entry.label}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[#818781]">{entry.count}</span>
                        <span className="rounded-md bg-[#F8F9F6] px-1.5 py-0.5 font-bold text-[#242824]">
                          {entry.pct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                message="No payment data for this period."
                title="Payment Methods"
                icon={<PieIcon size={20} />}
              />
            )}
          </section>
        </motion.div>

        {/* ============ LOWER ANALYTICS ROW (2 EQUAL COLUMNS) ============ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
          className="ov-lower-grid"
        >
          {/* Top-Selling Items */}
          <section aria-labelledby="topitems-heading" className="ov-card">
            <div className="mb-4">
              <h2 id="topitems-heading" className="text-lg font-bold tracking-tight text-[#242824] sm:text-xl">
                Top-Selling Items
              </h2>
              <p className="mt-0.5 text-xs text-[#818781]">By quantity sold</p>
            </div>
            <TopItemsChart items={topItems} />
          </section>

          {/* Order Types */}
          <section aria-labelledby="ordertypes-heading" className="ov-card">
            <div className="mb-4">
              <h2 id="ordertypes-heading" className="text-lg font-bold tracking-tight text-[#242824] sm:text-xl">
                Order Types
              </h2>
              <p className="mt-0.5 text-xs text-[#818781]">Share of total orders</p>
            </div>
            {orderTypes.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {orderTypes.map((entry, i) => (
                  <OrderTypeBar
                    key={entry.label}
                    label={entry.label}
                    pct={entry.pct}
                    color={FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                message="No order type data for this period."
                title="Order Types"
                icon={<Layers size={20} />}
              />
            )}
          </section>
        </motion.div>
      </main>
    </div>
  );
}
