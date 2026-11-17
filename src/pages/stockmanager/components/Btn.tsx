import type { CSSProperties, ReactNode } from "react";

export function Btn({
  onClick,
  variant,
  loading = false,
  disabled = false,
  children,
}: {
  onClick: () => void | Promise<void>;
  variant: "primary" | "danger";
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  // Warm "Menu Management" button styles (see src/pages/inventory.tsx).
  // Hover lift and press animations come from the shared .sm-shell button rules.
  const palette: CSSProperties =
    variant === "primary"
      ? {
          color: "#fff",
          background: "linear-gradient(180deg, #393835, #242320)",
          border: "1px solid #302E2A",
          boxShadow: "0 1px 2px rgba(185,62,12,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
        }
      : {
          color: "#C23B2E",
          background: "transparent",
          border: "1px solid #F0C7C2",
        };

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        fontFamily: "inherit",
        cursor: loading || disabled ? "not-allowed" : "pointer",
        opacity: loading || disabled ? 0.6 : 1,
        width: "100%",
        padding: "10px 16px",
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 600,
        ...palette,
      }}
    >
      {children}
    </button>
  );
}
