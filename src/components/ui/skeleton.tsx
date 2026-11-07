"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*                              DESIGN TOKENS                                 */
/* -------------------------------------------------------------------------- */

// Animation duration tokens (1.6s - 2.2s range per spec)
const SHIMMER_DURATION = "1.8s";
const BREATHING_DURATION = "2s";

// Easing curves
const EASING_SMOOTH = "cubic-bezier(0.4, 0, 0.2, 1)";
const EASING_GENTLE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

/* -------------------------------------------------------------------------- */
/*                              BASE SKELETON                                 */
/* -------------------------------------------------------------------------- */

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width of the skeleton (CSS value or number for pixels) */
  width?: string | number;
  /** Height of the skeleton (CSS value or number for pixels) */
  height?: string | number;
  /** Border radius (CSS value or number for pixels) */
  radius?: string | number;
  /** Animation variant */
  variant?: "shimmer" | "breathing" | "static";
  /** Theme context for color adaptation */
  theme?: "admin" | "customer";
  /** Whether this skeleton represents interactive content */
  interactive?: boolean;
}

export function Skeleton({
  className,
  width,
  height,
  radius,
  variant = "shimmer",
  theme = "admin",
  interactive = false,
  style,
  ...props
}: SkeletonProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const resolvedWidth = typeof width === "number" ? `${width}px` : width;
  const resolvedHeight = typeof height === "number" ? `${height}px` : height;
  const resolvedRadius = typeof radius === "number" ? `${radius}px` : radius;

  const baseStyles: React.CSSProperties = {
    ...style,
    width: resolvedWidth,
    height: resolvedHeight,
    borderRadius: resolvedRadius,
    // Admin theme: neutral grays; Customer theme: dark surface with gold shimmer
    backgroundColor: theme === "customer" ? "#2A2A2A" : "var(--sm-border, #E6E9E6)",
    ...(prefersReducedMotion || variant === "static"
      ? {}
      : variant === "shimmer"
      ? {
          backgroundImage: `linear-gradient(
            90deg,
            ${theme === "customer" ? "#2A2A2A" : "var(--sm-border, #E6E9E6)"} 25%,
            ${theme === "customer" ? "#3A3A3A" : "var(--sm-border-strong, #D0D5D1)"} 50%,
            ${theme === "customer" ? "#2A2A2A" : "var(--sm-border, #E6E9E6)"} 75%
          )`,
          backgroundSize: "200% 100%",
          animation: `skeleton-shimmer ${SHIMMER_DURATION} ${EASING_SMOOTH} infinite`,
        }
      : {
          animation: `skeleton-breathing ${BREATHING_DURATION} ${EASING_GENTLE} infinite`,
          opacity: 0.6,
        }),
  };

  return (
    <div
      data-slot="skeleton"
      data-theme={theme}
      data-variant={variant}
      className={cn(
        "skeleton-base",
        interactive && "skeleton-interactive",
        className
      )}
      style={baseStyles}
      aria-busy="true"
      aria-hidden="true"
      tabIndex={-1}
      role="status"
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                        LAYOUT-SPECIFIC COMPOSITIONS                        */
/* -------------------------------------------------------------------------- */

/** KPI Card skeleton (matches sm-kpi-card structure) */
export function SkeletonKPICard({
  theme = "admin",
  className,
  ...props
}: { theme?: "admin" | "customer"; className?: string }) {
  return (
    <div
      className={cn("sm-kpi-card", className)}
      style={{
        minHeight: "120px",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
      }}
      aria-busy="true"
      role="status"
    >
      <Skeleton theme={theme} height={16} width="60%" radius={4} variant="shimmer" />
      <Skeleton theme={theme} height={36} width="50%" radius={4} variant="shimmer" style={{ marginTop: "8px" }} />
      <Skeleton theme={theme} height={14} width="80%" radius={4} variant="breathing" style={{ marginTop: "6px" }} />
      <Skeleton theme={theme} height={12} width="40%" radius={4} variant="static" style={{ marginTop: "10px", opacity: 0.4 }} />
    </div>
  );
}

/** Table row skeleton (matches sm-table row structure) */
export function SkeletonTableRow({
  columnCount = 7,
  theme = "admin",
  className,
  ...props
}: { columnCount?: number; theme?: "admin" | "customer"; className?: string }) {
  return (
    <tr className={cn(className)} aria-busy="true" role="status" {...props}>
      {Array.from({ length: columnCount }, (_, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <Skeleton
            theme={theme}
            height={16}
            width={i === 0 ? "120px" : i === columnCount - 1 ? "80px" : "100%"}
            radius={4}
            variant={i === 0 ? "shimmer" : "breathing"}
          />
        </td>
      ))}
    </tr>
  );
}

/** Table skeleton with multiple rows */
export function SkeletonTable({
  rowCount = 5,
  columnCount = 7,
  theme = "admin",
  showHeader = true,
  className,
  ...props
}: { rowCount?: number; columnCount?: number; theme?: "admin" | "customer"; showHeader?: boolean; className?: string }) {
  return (
    <div className={cn("sm-table-wrapper", className)} aria-busy="true" role="status" {...props}>
      <table className="sm-table">
        {showHeader && (
          <thead>
            <tr>
              {Array.from({ length: columnCount }, (_, i) => (
                <th key={i} style={{ padding: "14px 16px" }}>
                  <Skeleton theme={theme} height={12} width="80%" radius={4} variant="static" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rowCount }, (_, rowIndex) => (
            <SkeletonTableRow key={rowIndex} columnCount={columnCount} theme={theme} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Product card skeleton (for inventory/menu product grids) */
export function SkeletonProductCard({
  theme = "admin",
  className,
  ...props
}: { theme?: "admin" | "customer"; className?: string }) {
  return (
    <div
      className={cn("sm-product-card-skeleton", className)}
      style={{
        background: theme === "customer" ? "#1A1A1A" : "var(--sm-surface, #FFFFFF)",
        border: `1px solid ${theme === "customer" ? "#333" : "var(--sm-border, #E6E9E6)"}`,
        borderRadius: "var(--sm-radius-lg, 16px)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minHeight: "200px",
      }}
      aria-busy="true"
      role="status"
      {...props}
    >
      {/* Image placeholder */}
      <Skeleton theme={theme} height={140} width="100%" radius={12} variant="shimmer" />
      {/* Category badge */}
      <Skeleton theme={theme} height={20} width="80px" radius={999} variant="breathing" />
      {/* Product name */}
      <Skeleton theme={theme} height={20} width="90%" radius={4} variant="shimmer" />
      {/* Stock info row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
        <Skeleton theme={theme} height={24} width="60px" radius={4} variant="shimmer" />
        <Skeleton theme={theme} height={14} width="50px" radius={4} variant="breathing" />
      </div>
    </div>
  );
}

/** Form field skeleton (input, select, textarea) */
export function SkeletonFormField({
  label = true,
  theme = "admin",
  className,
  ...props
}: { label?: boolean; theme?: "admin" | "customer"; className?: string }) {
  return (
    <div className={cn("sm-form-field-skeleton", className)} style={{ display: "flex", flexDirection: "column", gap: "6px" }} aria-busy="true" role="status" {...props}>
      {label && <Skeleton theme={theme} height={14} width="100px" radius={4} variant="static" />}
      <Skeleton theme={theme} height={44} width="100%" radius={8} variant="shimmer" />
    </div>
  );
}

/** Chart/Graph skeleton (for recharts areas) */
export function SkeletonChart({
  height = 300,
  theme = "admin",
  className,
  ...props
}: { height?: number; theme?: "admin" | "customer"; className?: string }) {
  return (
    <div
      className={cn("sm-chart-skeleton", className)}
      style={{
        height: `${height}px`,
        background: theme === "customer" ? "#1A1A1A" : "var(--sm-surface, #FFFFFF)",
        border: `1px solid ${theme === "customer" ? "#333" : "var(--sm-border, #E6E9E6)"}`,
        borderRadius: "var(--sm-radius-xl, 20px)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
      }}
      aria-busy="true"
      role="status"
      aria-label="Chart loading"
      {...props}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        <Skeleton theme={theme} height={22} width="180px" radius={4} variant="shimmer" />
        <Skeleton theme={theme} height={22} width="120px" radius={4} variant="breathing" />
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        <Skeleton theme={theme} height="100%" width="100%" radius={8} variant="shimmer" />
        {/* Axis labels placeholder */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "40px", display: "flex", justifyContent: "space-between", paddingTop: "8px" }}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} theme={theme} height={12} width={30} radius={4} variant="static" style={{ opacity: 0.4 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Modal/Drawer skeleton */
export function SkeletonModal({
  theme = "admin",
  className,
  ...props
}: { theme?: "admin" | "customer"; className?: string }) {
  return (
    <div
      className={cn("sm-modal-skeleton", className)}
      style={{
        background: theme === "customer" ? "#1A1A1A" : "var(--sm-surface, #FFFFFF)",
        border: `1px solid ${theme === "customer" ? "#333" : "var(--sm-border, #E6E9E6)"}`,
        borderRadius: "var(--sm-radius-xl, 20px)",
        padding: "24px",
        maxWidth: "500px",
        width: "100%",
      }}
      aria-busy="true"
      role="status"
      {...props}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
        <Skeleton theme={theme} height={24} width="200px" radius={4} variant="shimmer" />
        <Skeleton theme={theme} height={32} width={32} radius={999} variant="breathing" />
      </div>
      {/* Content fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonFormField key={i} theme={theme} label />
        ))}
      </div>
      {/* Footer actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: `1px solid ${theme === "customer" ? "#333" : "var(--sm-border, #E6E9E6)"}` }}>
        <Skeleton theme={theme} height={40} width={100} radius={8} variant="static" />
        <Skeleton theme={theme} height={40} width={120} radius={8} variant="shimmer" />
      </div>
    </div>
  );
}

/** List item skeleton (for alerts, notifications, etc.) */
export function SkeletonListItem({
  hasIcon = true,
  hasAction = false,
  theme = "admin",
  className,
  ...props
}: { hasIcon?: boolean; hasAction?: boolean; theme?: "admin" | "customer"; className?: string }) {
  return (
    <div
      className={cn("sm-list-item-skeleton", className)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "16px",
        background: theme === "customer" ? "#2A2A2A" : "var(--sm-surface, #FFFFFF)",
        border: `1px solid ${theme === "customer" ? "#333" : "var(--sm-border, #E6E9E6)"}`,
        borderRadius: "var(--sm-radius-lg, 16px)",
      }}
      aria-busy="true"
      role="status"
      {...props}
    >
      {hasIcon && <Skeleton theme={theme} height={40} width={40} radius={12} variant="breathing" />}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
        <Skeleton theme={theme} height={16} width="70%" radius={4} variant="shimmer" />
        <Skeleton theme={theme} height={12} width="50%" radius={4} variant="breathing" />
        <Skeleton theme={theme} height={12} width="40%" radius={4} variant="static" style={{ opacity: 0.4 }} />
      </div>
      {hasAction && <Skeleton theme={theme} height={36} width={100} radius={8} variant="shimmer" />}
    </div>
  );
}

/** Empty state skeleton */
export function SkeletonEmptyState({
  theme = "admin",
  className,
  ...props
}: { theme?: "admin" | "customer"; className?: string }) {
  return (
    <div
      className={cn("sm-empty-skeleton", className)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        background: theme === "customer" ? "#1A1A1A" : "var(--sm-surface, #FFFFFF)",
        border: `1px solid ${theme === "customer" ? "#333" : "var(--sm-border, #E6E9E6)"}`,
        borderRadius: "var(--sm-radius-xl, 20px)",
      }}
      aria-busy="true"
      role="status"
      {...props}
    >
      <Skeleton theme={theme} height={48} width={48} radius={999} variant="breathing" style={{ marginBottom: "12px" }} />
      <Skeleton theme={theme} height={20} width="160px" radius={4} variant="shimmer" style={{ marginBottom: "4px" }} />
      <Skeleton theme={theme} height={14} width="220px" radius={4} variant="breathing" />
    </div>
  );
}

/** Section card skeleton (matches SectionCard component) */
export function SkeletonSectionCard({
  theme = "admin",
  className,
  ...props
}: { theme?: "admin" | "customer"; className?: string }) {
  return (
    <div
      className={cn("sm-section-card", className)}
      style={{
        background: theme === "customer" ? "#1A1A1A" : "var(--sm-surface, #FFFFFF)",
        border: `1px solid ${theme === "customer" ? "#333" : "var(--sm-border, #E6E9E6)"}`,
        borderRadius: "var(--sm-radius-xl, 20px)",
        overflow: "hidden",
      }}
      aria-busy="true"
      role="status"
      {...props}
    >
      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${theme === "customer" ? "#333" : "var(--sm-border, #E6E9E6)"}`, display: "flex", justifyContent: "space-between" }}>
        <div>
          <Skeleton theme={theme} height={22} width="200px" radius={4} variant="shimmer" />
          <Skeleton theme={theme} height={14} width="140px" radius={4} variant="breathing" style={{ marginTop: "4px" }} />
        </div>
        <Skeleton theme={theme} height={36} width={100} radius={8} variant="static" />
      </div>
      {/* Content */}
      <div style={{ padding: "24px" }}>
        <SkeletonTable rowCount={4} columnCount={6} theme={theme} showHeader={false} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          GLOBAL KEYFRAMES (injected)                       */
/* -------------------------------------------------------------------------- */

// These keyframes are defined in globals.css or injected via style tag
// Included here for reference - actual definitions in globals.css
/*
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes skeleton-breathing {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
*/

/* -------------------------------------------------------------------------- */
/*                            EXPORTS                                         */
/* -------------------------------------------------------------------------- */

export type {
  SkeletonProps,
};