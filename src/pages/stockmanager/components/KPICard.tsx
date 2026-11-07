import { motion, type Variants } from "framer-motion";

export function KPICard({
  label,
  value,
  sub,
  accent,
  onClick,
  itemVariants,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "slate" | "amber" | "critical" | "info" | "yellow" | "green" | "orange" | "red" | "rose" | "indigo" | "emerald" | "blue" | "sky";
  onClick?: () => void;
  itemVariants: Variants;
}) {
  const interactive = typeof onClick === "function";
  const accentClass = `sm-kpi-card--${accent}`;

  return (
    <motion.div
      variants={itemVariants}
      className={`sm-kpi-card ${accentClass} ${interactive ? "sm-kpi-card--interactive" : ""}`}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
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
      <p className="sm-kpi-label">{label}</p>
      <p className="sm-kpi-value">{value}</p>
      <p className="sm-kpi-sub">{sub}</p>
      {interactive && (
        <p className="sm-kpi-hint">Click to view summary</p>
      )}
    </motion.div>
  );
}