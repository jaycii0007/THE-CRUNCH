import { motion, type Variants } from "framer-motion";
import GradientBlobCard from "@/components/ui/gradient-bold-card";

type KpiAccent =
  | "slate"
  | "amber"
  | "critical"
  | "info"
  | "yellow"
  | "green"
  | "orange"
  | "red"
  | "rose"
  | "indigo"
  | "emerald"
  | "blue"
  | "sky";

/**
 * Warm "Menu Management" palette (matches src/pages/inventory.tsx).
 * Each accent maps to a GradientBlobCard palette plus the tone used for the
 * big value, mirroring the StatCard composition on the menu page.
 */
const KPI_TONES: Record<
  KpiAccent,
  { palette: "forest" | "brass" | "amber"; value: string }
> = {
  slate: { palette: "brass", value: "#1C1B17" },
  amber: { palette: "amber", value: "#B8791B" },
  yellow: { palette: "amber", value: "#B8791B" },
  orange: { palette: "amber", value: "#B8791B" },
  critical: { palette: "amber", value: "#C23B2E" },
  red: { palette: "amber", value: "#C23B2E" },
  rose: { palette: "amber", value: "#C23B2E" },
  info: { palette: "brass", value: "#1A3A2A" },
  indigo: { palette: "brass", value: "#1A3A2A" },
  blue: { palette: "brass", value: "#1A3A2A" },
  sky: { palette: "brass", value: "#1A3A2A" },
  green: { palette: "forest", value: "#FFFFFF" },
  emerald: { palette: "forest", value: "#FFFFFF" },
};

export function KPICard({
  label,
  value,
  sub,
  accent,
  onClick,
  itemVariants,
  featured = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent: KpiAccent;
  onClick?: () => void;
  itemVariants: Variants;
  featured?: boolean;
}) {
  const interactive = typeof onClick === "function";
  const tone = featured
    ? ({ palette: "forest", value: "#FFFFFF" } as const)
    : KPI_TONES[accent];
  // Forest renders a deep-green glass surface; text flips to the light style.
  const onDark = tone.palette === "forest";
  const labelColor = onDark ? "rgba(255,255,255,0.72)" : "#655E52";
  const subColor = onDark ? "rgba(255,255,255,0.65)" : "#655E52";

  return (
    <motion.div variants={itemVariants} className="sm-kpi-wrap">
      <GradientBlobCard
        palette={tone.palette}
        className={`sm-kpi-card rounded-2xl p-5 ${interactive ? "sm-kpi-card--interactive" : ""}`}
        onClick={onClick}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? `${label}: ${value}` : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
      >
        <p className="sm-kpi-label" style={{ color: labelColor }}>
          {label}
        </p>
        <p className="sm-kpi-value" style={{ color: tone.value }}>
          {value}
        </p>
        <p className="sm-kpi-sub" style={{ color: subColor }}>
          {sub}
        </p>
        {interactive && (
          <p className="sm-kpi-hint" style={{ color: subColor }}>
            Click to view summary
          </p>
        )}
      </GradientBlobCard>
    </motion.div>
  );
}
