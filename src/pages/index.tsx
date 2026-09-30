import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  Bar,
  BarChart,
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
import { Card } from "@/components/ui/card";
import { Sidebar } from "@/components/Sidebar";
import { UserIdentityBanner } from "@/components/UserIdentityBanner";
import { api } from "@/lib/api";
import { useEventInvalidation } from "@/hooks/use-event-invalidation";
import {
  fetchGeneralSettings,
  formatCurrencyAmount,
  formatInSettingsTimezone,
  GENERAL_SETTINGS_DEFAULTS,
  getCurrencySymbol,
} from "@/lib/restaurantSettings";

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
}

interface RawOrderRow {
  id: number;
  orderNumber?: string;
  total: number | string;
  date?: string;
  status?: string;
  paymentMethod?: string;
  payment_method?: string;
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

interface HeatmapCell {
  day: string;
  hour: string;
  count: number; // -1 means the restaurant is closed for that slot
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
const WEEKEND = ["Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));

// Opening-hour slots: [label, startHour, endHour]
const WEEKDAY_SLOTS: [string, number, number][] = [
  ["10am", 10, 12], ["12pm", 12, 14], ["2pm", 14, 16], ["4pm", 16, 18],
  ["6pm", 18, 20], ["8pm", 20, 22], ["10pm", 22, 24],
];
const WEEKEND_SLOTS: [string, number, number][] = [
  ["11:30am", 11.5, 13.5], ["1:30pm", 13.5, 15.5], ["3:30pm", 15.5, 17.5],
  ["5:30pm", 17.5, 19.5], ["7:30pm", 19.5, 20.5],
];
const ALL_SLOT_LABELS = [
  "10am", "11:30am", "12pm", "1:30pm", "2pm", "3:30pm",
  "4pm", "5:30pm", "6pm", "7:30pm", "8pm", "10pm",
];

const BRAND = "#7C2D2D";
const PAYMENT_COLORS: Record<string, string> = {
  GCash: "#2D5F9E",
  Cash: BRAND,
  Maya: "#1B7A5A",
  "Credit Card": "#B85E1A",
  Others: "#888680",
};
const FALLBACK_COLORS = [BRAND, "#A84040", "#C46060", "#DDA0A0", "#EEC8C8"];

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "none",
  boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
  fontSize: 13,
};

const TRIGGER_CLASS =
  "flex w-full min-w-0 items-center gap-3 rounded-xl border-[1.5px] border-[#E8E0DC] bg-white px-4 py-2.5 text-left shadow-sm outline-none transition focus-visible:ring-4 focus-visible:ring-[#7C2D2D]/15 sm:min-w-[250px]";
const PANEL_CLASS =
  "absolute left-0 top-[calc(100%+8px)] z-50 sm:left-auto sm:right-0 overflow-hidden rounded-2xl border border-[#F0EBE6] bg-white shadow-xl";

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
    : `${formatDisplayDate(start, timezone)} - ${formatDisplayDate(end, timezone)}`;

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

function computeHeatmap(orders: Order[]): HeatmapCell[] {
  const counts: Record<string, number> = {};

  orders.forEach((o) => {
    if (!o.date) return;
    const d = new Date(o.date);
    const day = DAYS[d.getDay()];
    const hour = d.getHours() + d.getMinutes() / 60;
    const slots = WEEKEND.includes(day) ? WEEKEND_SLOTS : WEEKDAY_SLOTS;
    const slot = slots.find(([, start, end]) => hour >= start && hour < end);
    if (slot) counts[`${day}|${slot[0]}`] = (counts[`${day}|${slot[0]}`] ?? 0) + 1;
  });

  return DAYS.flatMap((day) => {
    const openLabels = (WEEKEND.includes(day) ? WEEKEND_SLOTS : WEEKDAY_SLOTS).map(([label]) => label);
    return ALL_SLOT_LABELS.map((hour) => ({
      day,
      hour,
      count: openLabels.includes(hour) ? counts[`${day}|${hour}`] ?? 0 : -1,
    }));
  });
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
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

/* -------------------------------------------------------------------------- */
/*                              Date range picker                             */
/* -------------------------------------------------------------------------- */

const WEEKDAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<Date | null>(null);
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, useCallback(() => setOpen(false), []));

  const hasValue = !!(value.start || value.end);
  const label = value.start
    ? `${formatCompactDate(value.start)} ~ ${value.end ? formatCompactDate(value.end) : "..."}`
    : "Select date range";

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

  const navButton = "flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5F0ED] hover:bg-[#EDE5E0]";

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button onClick={() => setOpen((o) => !o)} className={TRIGGER_CLASS}>
        <Calendar size={18} className="text-[#9B8E8E]" />
        <span className={`flex-1 text-sm ${hasValue ? "font-medium text-[#4A1C1C]" : "text-[#B0A8A4]"}`}>
          {label}
        </span>
        {hasValue && (
          <span
            onClick={clear}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F0EBE6] hover:bg-[#E8E0DC]"
          >
            <X size={12} className="text-[#9B8E8E]" />
          </span>
        )}
      </button>

      {open && (
        <div className={`${PANEL_CLASS} w-full p-4 sm:w-[340px] sm:p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => shiftMonth(-1)} className={navButton}>
              <ChevronLeft size={16} className="text-[#7C2D2D]" />
            </button>
            <span className="text-sm font-semibold text-[#4A1C1C]">
              {MONTHS[view.month]} {view.year}
            </span>
            <button onClick={() => shiftMonth(1)} className={navButton}>
              <ChevronRight size={16} className="text-[#7C2D2D]" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAY_HEADERS.map((d) => (
              <div key={d} className="py-1 text-center text-xs font-semibold text-[#B0A8A4]">
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

              return (
                <button
                  key={i}
                  onClick={() => pickDay(day)}
                  onMouseEnter={() => setHovered(day)}
                  onMouseLeave={() => setHovered(null)}
                  className={`h-10 text-sm transition-colors ${
                    isEndpoint
                      ? "rounded-lg bg-[#7C2D2D] font-semibold text-white"
                      : isInRange(day)
                      ? "bg-[#F5E8E8] text-[#7C2D2D]"
                      : "rounded-md text-[#4A1C1C] hover:bg-[#FDF5F5]"
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          <p className="mt-4 border-t border-[#F0EBE6] pt-3 text-center text-xs text-[#B0A8A4]">
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

  useClickOutside(ref, useCallback(() => setOpen(false), []));

  const options = getPeriodOptions(period);
  const active = options.find((o) => o.key === subKey) ?? options[0];
  const periodLabel = PERIODS.find((p) => p.value === period)?.label;

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`${TRIGGER_CLASS} ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight text-[#4A1C1C]">
            {periodLabel} · {active.label}
          </span>
          <span className="mt-0.5 block text-xs text-[#B0A8A4]">{formatSpan(active.range, timezone)}</span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#9B8E8E] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className={`${PANEL_CLASS} w-full sm:w-[300px]`}>
          {PERIODS.map(({ label, value: groupPeriod }, index) => (
            <div key={groupPeriod} className={index > 0 ? "border-t border-[#F5F0ED]" : ""}>
              <div
                className={`px-4 pb-1.5 pt-3 text-xs font-bold uppercase tracking-wider ${
                  groupPeriod === period ? "bg-[#FDF8F8] text-[#7C2D2D]" : "text-[#C4B8B8]"
                }`}
              >
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
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors ${
                      isActive ? "bg-[#F5E8E8]" : "hover:bg-[#FDF5F5]"
                    }`}
                  >
                    <span className={`text-sm ${isActive ? "font-semibold text-[#7C2D2D]" : "text-[#4A1C1C]"}`}>
                      {opt.label}
                    </span>
                    <span className="ml-3 text-right text-xs text-[#B0A8A4] sm:whitespace-nowrap">
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
/*                               Dashboard parts                              */
/* -------------------------------------------------------------------------- */

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="min-w-0 rounded-2xl border-0 bg-white p-5 shadow-md transition-shadow sm:p-6 hover:shadow-lg">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 sm:text-sm">{label}</div>
      <div className="mb-1 text-3xl font-bold sm:text-4xl text-gray-800">{value}</div>
      <div className="text-sm text-gray-400">{hint}</div>
    </Card>
  );
}

function Panel({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <Card className={`rounded-2xl border-0 bg-white p-5 shadow-md sm:p-7 ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-gray-800 sm:mb-5 sm:text-xl">{title}</h3>
      {children}
    </Card>
  );
}

const EmptyState = ({ message }: { message: string }) => (
  <p className="py-8 text-center text-sm text-gray-400">{message}</p>
);

/** Interpolates from a pale green to a deep green based on intensity (0-1). */
const heatColor = (t: number) =>
  t === 0
    ? "#F0FAF4"
    : `rgb(${Math.round(220 - t * 161)},${Math.round(242 - t * 105)},${Math.round(228 - t * 174)})`;

function PeakHoursHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const maxCount = Math.max(...cells.map((c) => c.count), 1);

  return (
    <div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "minmax(40px, 56px) repeat(7, minmax(0, 1fr))" }}>
        <div />
        {DAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-xs text-gray-400">
            {d}
          </div>
        ))}

        {ALL_SLOT_LABELS.map((hour) => (
          <React.Fragment key={hour}>
            <div className="flex items-center justify-end pr-1 text-[10px] text-gray-400 sm:text-xs">{hour}</div>
            {DAYS.map((day) => {
              const count = cells.find((c) => c.day === day && c.hour === hour)?.count ?? -1;
              const closed = count < 0;
              return (
                <div
                  key={day}
                  title={closed ? `${day} ${hour}: Closed` : `${day} ${hour}: ${count} orders`}
                  className={`h-5 rounded ${closed ? "opacity-15" : "cursor-pointer"}`}
                  style={{ backgroundColor: closed ? "transparent" : heatColor(count / maxCount) }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-400">
        <span>Low</span>
        <div className="flex gap-0.5">
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
            <div key={t} className="h-3.5 w-5 rounded-sm" style={{ backgroundColor: heatColor(t) }} />
          ))}
        </div>
        <span>High</span>
        <span className="ml-3 flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-5 rounded-sm bg-gray-200 opacity-40" /> Closed
        </span>
      </div>
    </div>
  );
}

function TopItemsChart({ items }: { items: { name: string; count: number }[] }) {
  if (items.length === 0) return <EmptyState message="No items data yet." />;
  const max = items[0].count;

  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item, i) => (
        <div key={item.name} className="flex items-center gap-3">
          <span className="w-4 text-right text-xs text-gray-400">{i + 1}</span>
          <span className="w-20 truncate text-sm text-gray-600 sm:w-28">{item.name}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[#7C2D2D] transition-all duration-500"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="w-10 text-right text-sm text-gray-500">{item.count}</span>
        </div>
      ))}
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
      grouped.set(row.id, {
        id: row.id,
        orderNumber: row.orderNumber || `#${row.id}`,
        items: [],
        total: Number(row.total) || 0,
        date: row.date ? new Date(row.date).toISOString() : "",
        orderType: row.orderType ?? row.order_type ?? "",
        status: row.status ?? "",
        paymentCategory: row.paymentMethod ?? row.payment_method ?? "",
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
/*                                  Dashboard                                 */
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

  const totalOrders = filteredOrders.length;
  const totalSales = sum(filteredOrders.map((o) => o.total));
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
  const activeOrders = filteredOrders.filter((o) => !["Completed", "Cancelled"].includes(o.status)).length;

  const topItems = useMemo(() => computeTopItems(filteredOrders), [filteredOrders]);
  const orderTypes = useMemo(() => computeShares(filteredOrders, (o) => o.orderType || "Unknown"), [filteredOrders]);
  const payments = useMemo(() => computeShares(filteredOrders, (o) => o.paymentCategory || "Others"), [filteredOrders]);
  const heatmap = useMemo(() => computeHeatmap(filteredOrders), [filteredOrders]);
  const chartData = useMemo(
    () => computeChartData(filteredOrders, previousOrders, period, salesView),
    [filteredOrders, previousOrders, period, salesView],
  );

  /* ---- Formatting ---- */

  const { timezone } = settings;
  const periodLabel = PERIODS.find((p) => p.value === period)?.label.toLowerCase() ?? "";
  const currencySymbol = getCurrencySymbol(settings);
  const wholeNumber = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
  const money = (v: number, opts?: typeof wholeNumber) => formatCurrencyAmount(v, settings, opts);
  const show = (value: string) => (isLoading ? "..." : value);

  const axisFormatter = (v: number) =>
    salesView === "sales" ? `${currencySymbol}${v >= 1000 ? `${Math.round(v / 1000)}k` : v}` : String(v);

  const noOrdersInRange = !error && !isLoading && orders.length > 0 && filteredOrders.length === 0;

  return (
    <div className="flex min-h-screen bg-gray-50 font-['Poppins',sans-serif]">
      <Sidebar />

      <main className="tablet-shell min-w-0 flex-1">
        <div className="tablet-surface min-h-[calc(100vh-5rem)] bg-[#FDFAF6]">
          {/* Header */}
          <header className="mb-6 flex flex-wrap items-start justify-between gap-5 sm:mb-8">
            <div className="shrink-0">
              <h1 className="text-2xl font-semibold sm:text-3xl text-[#4A1C1C]">{settings.restaurantName}</h1>
              <p className="mt-1 text-sm font-medium uppercase tracking-wide text-gray-400">
                Dashboard
              </p>
            </div>

            <UserIdentityBanner className="order-3 w-full sm:order-2 sm:w-auto" />

            <div className="order-2 flex w-full shrink-0 flex-col items-stretch gap-3 sm:order-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <span className="text-sm font-medium uppercase tracking-wide text-gray-400">Sales Report</span>
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
          </header>

          {/* Status banners */}
          {error && (
            <Card className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
              <p className="text-base font-semibold text-red-700">Dashboard data failed to load</p>
              <p className="mt-1 text-sm text-red-500">{error}</p>
            </Card>
          )}
          {noOrdersInRange && (
            <Card className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-base font-semibold text-amber-800">
                No orders match the selected {hasCustomRange ? "date range" : "period"}
              </p>
              <p className="mt-1 text-sm text-amber-700">
                {hasCustomRange
                  ? "Try adjusting the date range."
                  : "Try selecting a different period to view sales data."}
              </p>
            </Card>
          )}

          {/* KPIs */}
          <section className="mb-6 grid grid-cols-1 gap-4 sm:mb-8 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
            <KpiCard label="Total Orders" value={show(totalOrders.toLocaleString())} hint="Live" />
            <KpiCard label="Total Sales" value={show(money(totalSales, wholeNumber))} hint="Live" />
            <KpiCard label="Avg Order Value" value={show(money(avgOrderValue))} hint="Per transaction" />
            <KpiCard label="Active Orders" value={show(activeOrders.toLocaleString())} hint="In progress" />
          </section>

          {/* Sales chart + payment methods */}
          <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="min-w-0 rounded-2xl border-0 bg-white p-5 shadow-md sm:p-7 lg:col-span-8">
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 sm:text-xl">Order & Sales Review</h2>
                  <p className="mt-0.5 text-sm text-gray-400">{formatSpan(activeRange, timezone)}</p>
                  {!isLoading && (
                    <p className="mt-2 text-base font-semibold text-[#7C2D2D]">
                      {money(totalSales, wholeNumber)}{" "}
                      <span className="text-sm font-normal text-gray-400">
                        as of {formatDisplayDate(activeRange.end, timezone)}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex w-fit max-w-full overflow-x-auto rounded-xl bg-[#F0EBE6] p-1">
                  {(["sales", "orders"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setSalesView(v)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                        salesView === v ? "bg-[#7C2D2D] text-white shadow-sm" : "text-[#9B8E8E]"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500">
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-4 rounded-sm bg-[#7C2D2D]" />
                  {hasCustomRange ? "Selected range" : activeOption.label}
                </span>
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-4 rounded-sm bg-gray-300" />
                  Previous {periodLabel}
                </span>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE6" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#9B8E8E" }} axisLine={false} tickLine={false} minTickGap={12} />
                  <YAxis
                    tick={{ fontSize: 13, fill: "#9B8E8E" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={axisFormatter}
                  />
                  <Tooltip formatter={(v: number) => [axisFormatter(v)]} contentStyle={TOOLTIP_STYLE} />
                  <Line
                    type="monotone"
                    dataKey="current"
                    name={`This ${periodLabel}`}
                    stroke={BRAND}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: BRAND }}
                  />
                  <Line
                    type="monotone"
                    dataKey="previous"
                    name={`Previous ${periodLabel}`}
                    stroke="#C8B8B8"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={{ r: 3, fill: "#C8B8B8" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Panel title="Payment Methods" className="h-full lg:col-span-4">
              {payments.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={payments} dataKey="count" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={3}>
                        {payments.map((entry, i) => (
                          <Cell key={entry.label} fill={PAYMENT_COLORS[entry.label] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="mt-3 space-y-2">
                    {payments.map((entry, i) => (
                      <div key={entry.label} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="inline-block h-3 w-3 rounded-sm"
                            style={{ backgroundColor: PAYMENT_COLORS[entry.label] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length] }}
                          />
                          <span className="text-gray-600">{entry.label}</span>
                        </div>
                        <span className="font-medium text-gray-800">{entry.pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState message="No payment data yet." />
              )}
            </Panel>
          </section>

          {/* Peak hours, top items, order types */}
          <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel title="Peak Hours">
              <PeakHoursHeatmap cells={heatmap} />
            </Panel>

            <Panel title="Top-Selling Items">
              <TopItemsChart items={topItems} />
            </Panel>

            <Panel title="Order Types">
              {orderTypes.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={orderTypes} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE6" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: "#9B8E8E" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={84}
                      tick={{ fontSize: 12, fill: "#9B8E8E" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip formatter={(v: number) => [`${v}%`, "Share"]} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                      {orderTypes.map((entry, i) => (
                        <Cell key={entry.label} fill={FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No order type data yet." />
              )}
            </Panel>
          </section>
        </div>
      </main>
    </div>
  );
}
