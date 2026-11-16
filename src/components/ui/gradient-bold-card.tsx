"use client";

import type { HTMLAttributes } from "react";
import "./gradient-bold-card.css";

type GradientBlobCardProps = HTMLAttributes<HTMLDivElement> & {
  palette?: "forest" | "brass" | "amber";
};

export default function GradientBlobCard({
  palette = "brass",
  className = "",
  children,
  ...props
}: GradientBlobCardProps) {
  return (
    <div {...props} className={`gradient-bold-card ${className}`} data-palette={palette}>
      {children}
    </div>
  );
}
