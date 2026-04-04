import { useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface Order {
  id: number;
  orderNumber: string;
  items: { name: string; price: number; quantity: number }[];
  total: number;
  date: string;
  time: string;
  orderType: string;
  status: string;
  paymentCategory: string;
  riderPickupTime?: string | null;
}

interface OrdersTableProps {
  orders?: Order[];
}

type Period = "all" | "daily" | "weekly" | "monthly" | "yearly";

const PAGE_SIZE = 10;

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "all",     label: "All Time"  },
  { value: "daily",   label: "Today"     },
  { value: "weekly",  label: "This Week" },
  { value: "monthly", label: "This Month"},
  { value: "yearly",  label: "This Year" },
];

function filterByPeriod(orders: Order[], period: Period): Order[] {
  if (period === "all") return orders;

  const now = new Date();
  const startOf = (unit: "day" | "week" | "month" | "year"): Date => {
    const d = new Date(now);
    if (unit === "day") {
      d.setHours(0, 0, 0, 0);
    } else if (unit === "week") {
      const day = d.getDay(); // 0 = Sunday
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
    } else if (unit === "month") {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
    } else {
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
    }
    return d;
  };

  const from =
    period === "daily"   ? startOf("day")   :
    period === "weekly"  ? startOf("week")  :
    period === "monthly" ? startOf("month") :
                           startOf("year");

  return orders.filter((o) => new Date(o.date) >= from);
}

export function OrdersTable({ orders = [] }: OrdersTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [period, setPeriod] = useState<Period>("all");

  const filtered = filterByPeriod(orders, period);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Reset to page 1 whenever period changes
  const handlePeriodChange = (value: string) => {
    setPeriod(value as Period);
    setCurrentPage(1);
  };

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const paginated = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Summary stats for the selected period
  const totalRevenue = filtered.reduce((sum, o) => sum + o.total, 0);
  const completedCount = filtered.filter((o) => o.status === "Completed").length;

  const statusBadgeClass = (status: string) =>
    status === "Completed"
      ? "bg-green-50 text-green-700 hover:bg-green-50 rounded-lg font-medium border-0"
      : "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 rounded-lg font-medium border-0";

  const orderTypeBadgeClass = (orderType: string) =>
    orderType === "take-out"
      ? "bg-amber-50 text-amber-700 hover:bg-amber-50 rounded-lg font-medium border-0"
      : orderType === "delivery"
        ? "bg-blue-50 text-blue-700 hover:bg-blue-50 rounded-lg font-medium border-0"
        : "bg-rose-50 text-rose-700 hover:bg-rose-50 rounded-lg font-medium border-0";

  const formatDate = (value: string) => {
    if (!value) return "-";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-US");
  };

  const formatTime = (value: string) => {
    if (!value) return "-";
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? value
      : d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
  };

  const selectedLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? "All Time";

  return (
    <Card className="bg-white rounded-2xl p-6 shadow-md border-0">
      {/* Header row: title + dropdown */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Orders</h3>
          {/* Quick summary pill */}
          {period !== "all" && (
            <p className="text-xs text-gray-400 mt-0.5">
              {filtered.length} order{filtered.length !== 1 ? "s" : ""} ·{" "}
              <span className="text-green-600 font-medium">{completedCount} completed</span>{" "}
              ·{" "}
              <span className="text-gray-600 font-medium">
                ₱{totalRevenue.toLocaleString()} revenue
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-gray-400" />
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-36 h-9 rounded-xl border-gray-200 text-sm font-medium text-gray-700 focus:ring-1 focus:ring-[#4A1C1C]">
              <SelectValue placeholder="Filter period" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-gray-200 shadow-lg">
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-sm rounded-lg focus:bg-gray-50"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-gray-200 hover:bg-transparent">
            <TableHead className="text-gray-700 font-semibold">Order ID</TableHead>
            <TableHead className="text-gray-700 font-semibold">Date</TableHead>
            <TableHead className="text-gray-700 font-semibold">Time</TableHead>
            <TableHead className="text-gray-700 font-semibold">Order Type</TableHead>
            <TableHead className="text-gray-700 font-semibold">Status</TableHead>
            <TableHead className="text-gray-700 font-semibold">Payment</TableHead>
            <TableHead className="text-gray-700 font-semibold text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-gray-400 py-10">
                {orders.length === 0
                  ? "No orders yet. Orders will appear here once the cashier processes them."
                  : `No orders found for ${selectedLabel.toLowerCase()}.`}
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((order) => (
              <TableRow
                key={order.id}
                className="border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <TableCell className="font-medium text-gray-900">
                  {order.orderNumber}
                </TableCell>
                <TableCell className="text-gray-600 whitespace-nowrap">
                  {formatDate(order.date)}
                </TableCell>
                <TableCell className="text-gray-800 text-base font-semibold whitespace-nowrap">
                  {formatTime(order.date)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={orderTypeBadgeClass(order.orderType)}>
                    {order.orderType || "-"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusBadgeClass(order.status)}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-blue-600 font-medium">
                  {order.paymentCategory}
                </TableCell>
                <TableCell className="font-semibold text-gray-900 text-right">
                  ₱{order.total}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length} orders
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1,
              )
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "..." ? (
                  <span key={`ellipsis-${idx}`} className="text-gray-400 text-sm px-1">
                    ...
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={currentPage === p ? "default" : "outline"}
                    size="icon"
                    className={`h-8 w-8 rounded-lg text-sm ${
                      currentPage === p
                        ? "bg-[#4A1C1C] hover:bg-[#3a1515] text-white border-0"
                        : ""
                    }`}
                    onClick={() => setCurrentPage(p as number)}
                  >
                    {p}
                  </Button>
                ),
              )}

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}