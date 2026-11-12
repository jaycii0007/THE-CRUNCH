import { motion, type Variants } from "framer-motion";
import type { ReactNode, RefObject } from "react";
import { KPICard } from "../KPICard";
import type { DashboardSummaryKey, Product } from "../../types/inventory";

export function DashboardTab({
  pageVariants,
  staggerVariants,
  itemVariants,
  dashboardTopRef,
  totalProductsValue,
  lowStockValue,
  criticalStockValue,
  pendingPOValue,
  wholeChickenProducts,
  choppedChickenProducts,
  dashboardSubTab,
  onSummarySelect,
  onPurchaseOrdersSelect,
  mainStockContent,
  lastUpdatesContent,
}: {
  pageVariants: Variants;
  staggerVariants: Variants;
  itemVariants: Variants;
  dashboardTopRef: RefObject<HTMLDivElement | null>;
  totalProductsValue: string;
  lowStockValue: string;
  criticalStockValue: string;
  pendingPOValue: string;
  wholeChickenProducts: Product[];
  choppedChickenProducts: Product[];
  dashboardSubTab: "main-stock" | "last-updates";
  onSummarySelect: (key: DashboardSummaryKey) => void;
  onPurchaseOrdersSelect: () => void;
  mainStockContent: ReactNode;
  lastUpdatesContent: ReactNode;
}) {
  return (
    <motion.div
      key="dashboard"
      id="dashboard-top"
      variants={pageVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      ref={dashboardTopRef}
    >
      <motion.div
        variants={staggerVariants}
        initial="hidden"
        animate="show"
        style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "24px 0" }}
      >
        <motion.div variants={staggerVariants} className="sm-kpi-grid">
          <KPICard
            itemVariants={itemVariants}
            label="Total Products"
            value={totalProductsValue}
            sub="in inventory"
            accent="slate"
            onClick={() => onSummarySelect("products")}
          />
          <KPICard
            itemVariants={itemVariants}
            label="Low Stock"
            value={lowStockValue}
            sub="warning threshold"
            accent="amber"
            onClick={() => onSummarySelect("low")}
          />
          <KPICard
            itemVariants={itemVariants}
            label="Critical Stock"
            value={criticalStockValue}
            sub="urgent restock"
            accent="critical"
            onClick={() => onSummarySelect("critical")}
          />
          <KPICard
            itemVariants={itemVariants}
            label="Active Purchase Orders"
            value={pendingPOValue}
            sub="awaiting receipt"
            accent="indigo"
            onClick={onPurchaseOrdersSelect}
          />
        </motion.div>

        {(wholeChickenProducts.length > 0 || choppedChickenProducts.length > 0) && (
          <motion.div
            variants={itemVariants}
            className="sm-chicken-banner"
            role="region"
            aria-label="Chicken inventory"
          >
            <svg className="sm-chicken-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
            <span className="sm-chicken-label">Chicken Inventory</span>
            <div className="sm-chicken-items">
              {wholeChickenProducts.map((p) => (
                <div key={p.product_id} className="sm-chicken-item">
                  <span className="sm-chicken-dot sm-chicken-dot--whole" />
                  <div className="sm-chicken-info">
                    <span className="sm-chicken-type">Whole Chicken</span>
                    <span className="sm-chicken-qty">{p.mainStock}<span className="sm-chicken-unit"> {p.unit}</span></span>
                  </div>
                </div>
              ))}
              {wholeChickenProducts.length > 0 && choppedChickenProducts.length > 0 && (
                <span className="sm-chicken-separator" aria-hidden="true">→</span>
              )}
              {choppedChickenProducts.map((p) => (
                <div key={p.product_id} className="sm-chicken-item">
                  <span className="sm-chicken-dot sm-chicken-dot--chopped" />
                  <div className="sm-chicken-info">
                    <span className="sm-chicken-type">Chopped Chicken</span>
                    <span className="sm-chicken-qty">{p.mainStock}<span className="sm-chicken-unit"> {p.unit}</span></span>
                  </div>
                </div>
              ))}
              <p className="sm-chicken-note">Delivered whole → chopped separately in inventory</p>
            </div>
          </motion.div>
        )}

        {dashboardSubTab === "main-stock" && mainStockContent}
        {dashboardSubTab === "last-updates" && lastUpdatesContent}
      </motion.div>
    </motion.div>
  );
}