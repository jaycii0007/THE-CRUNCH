import { motion, type Variants } from "framer-motion";
import { EmptyState } from "../EmptyState";
import { POBadge } from "../POBadge";
import { KPICard } from "../KPICard";
import type { DashboardSummaryKey, Product, PurchaseOrder } from "../../types/inventory";

function TrashIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

export function PurchaseOrdersTab({
  pageVariants,
  staggerVariants,
  itemVariants,
  lowStock,
  criticalStock,
  filteredPOs,
  poLoading,
  restockBanner,
  onNewPO,
  onSelectOrder,
  onPrintOrder,
  onDeleteOrder,
  onSummarySelect,
}: {
  pageVariants: Variants;
  staggerVariants: Variants;
  itemVariants: Variants;
  lowStock: Product[];
  criticalStock: Product[];
  filteredPOs: PurchaseOrder[];
  poLoading: boolean;
  restockBanner: React.ReactNode;
  onNewPO: () => void;
  onSelectOrder: (order: PurchaseOrder) => void;
  onPrintOrder: (order: PurchaseOrder) => void;
  onDeleteOrder: (id: string) => void;
  onSummarySelect: (key: DashboardSummaryKey) => void;
}) {
  return (
    <motion.div
      key="purchases"
      variants={pageVariants}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <motion.div
        variants={staggerVariants}
        initial="hidden"
        animate="show"
        className="space-y-5"
      >
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: "Active Orders",
              value: filteredPOs.length,
              accent: "slate",
              summary: "poDraft" as const,
              sub: "purchase orders being prepared",
            },
            {
              label: "Inventory Items",
              value: filteredPOs.reduce((sum, order) => sum + order.items.length, 0),
              accent: "yellow",
              summary: "poDraft" as const,
              sub: "lines across active orders",
            },
            {
              label: "Units Requested",
              value: filteredPOs.reduce(
                (sum, order) =>
                  sum + order.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
                0,
              ),
              accent: "blue",
              summary: "poDraft" as const,
              sub: "inventory units in active orders",
            },
          ].map((k) => (
            <KPICard
              key={k.label}
              itemVariants={itemVariants}
              label={k.label}
              value={k.value.toString()}
              sub={k.sub}
              accent={k.accent}
              onClick={() => onSummarySelect(k.summary)}
            />
          ))}
        </motion.div>
        {(criticalStock.length > 0 || lowStock.length > 0) && (
          <motion.div variants={itemVariants}>{restockBanner}</motion.div>
        )}
        <motion.div variants={itemVariants} className="flex items-center justify-end gap-3">
          <button
            onClick={onNewPO}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-700 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New PO
          </button>
        </motion.div>
        <motion.div variants={itemVariants}>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-50">
              <p className="font-semibold text-slate-800 text-sm">
                Active Purchase Orders
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {filteredPOs.length} order
                {filteredPOs.length !== 1 ? "s" : ""} shown
              </p>
            </div>
            <div className="hidden lg:grid grid-cols-[1.5fr_2.5fr_2fr_2fr_2fr_1.5fr_1.5fr_auto] px-5 py-3 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <span>PO No.</span>
              <span>Supplier</span>
              <span>Receipt</span>
              <span>Order Date</span>
              <span>Expected Delivery</span>
              <span>Items</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-slate-50">
              {poLoading ? (
                <div className="py-12 text-center text-sm text-slate-400 animate-pulse">
                  Loading purchase orders{"\u2026"}
                </div>
              ) : filteredPOs.length === 0 ? (
                <EmptyState message="No active purchase orders found." />
              ) : (
                filteredPOs.map((order, i) => {
                  const itemCountText =
                    order.items.length === 0
                      ? "No items"
                      : `${order.items.length} item${order.items.length !== 1 ? "s" : ""}`;
                  const totalQuantity = order.items.reduce(
                    (sum, item) => sum + Number(item.quantity || 0),
                    0,
                  );

                  return (
                    <div key={order.id}>
                      <div
                        className="hidden lg:grid grid-cols-[1.5fr_2.5fr_2fr_2fr_2fr_1.5fr_1.5fr_auto] px-5 py-4 transition-colors items-center hover:bg-slate-50/70 cursor-pointer"
                        onClick={() => onSelectOrder(order)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectOrder(order);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="contents">
                          <span className="text-sm font-semibold text-slate-800">
                            {order.id}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {order.supplier}
                            </p>
                            <p className="text-xs text-slate-400">
                              {itemCountText}
                            </p>
                          </div>
                          <span className="text-sm text-slate-500">
                            {order.receiptNo || "-"}
                          </span>
                          <span className="text-sm text-slate-500">
                            {order.date}
                          </span>
                          <span className="text-sm text-slate-500">
                            {order.deliveryDate || "Not specified"}
                          </span>
                          <span className="text-sm font-semibold text-slate-800">
                            {totalQuantity} unit{totalQuantity !== 1 ? "s" : ""}
                          </span>
                          <span>
                            <POBadge status={order.status} />
                          </span>
                        </div>
                        <div className="flex justify-end">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onPrintOrder(order);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
                            >
                              Print PO
                            </button>
                            {order.status === "Draft" ||
                            order.status === "Ordered" ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteOrder(order.id);
                                }}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                                title="Cancel order"
                              >
                                <TrashIcon />
                              </button>
                            ) : (
                              <span className="text-xs text-slate-300">-</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <motion.div
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => onSelectOrder(order)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectOrder(order);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className="lg:hidden w-full text-left px-4 py-3 transition-colors hover:bg-slate-50/70"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {order.id}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {order.supplier}
                            </p>
                            <p className="text-xs text-slate-400">
                              {itemCountText}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onPrintOrder(order);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-semibold hover:bg-slate-50 transition-colors"
                            >
                              Print
                            </button>
                            {(order.status === "Draft" ||
                              order.status === "Ordered") && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteOrder(order.id);
                                }}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                                title="Cancel order"
                              >
                                <TrashIcon />
                              </button>
                            )}
                            <POBadge status={order.status} />
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>Receipt: {order.receiptNo || "-"}</span>
                          <span>Order: {order.date}</span>
                          <span>Expected: {order.deliveryDate || "Not specified"}</span>
                          <span className="font-semibold text-slate-700">
                            {totalQuantity} unit{totalQuantity !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </motion.div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
