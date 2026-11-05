"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type SpinnerSize = "sm" | "md" | "lg" | "xl";

type SpinnerColor = "gold" | "white";

interface SpinnerProps {
  size?: SpinnerSize;
  message?: string;
  className?: string;
  variant?: "fullscreen" | "section" | "inline" | "button";
  ariaLabel?: string;
  color?: SpinnerColor;
}

const SIZE_CONFIG: Record<SpinnerSize, { diameter: number; stroke: number; messageGap: number; fontSize: number }> = {
  sm: { diameter: 20, stroke: 2.5, messageGap: 8, fontSize: 11 },
  md: { diameter: 36, stroke: 3, messageGap: 12, fontSize: 13 },
  lg: { diameter: 48, stroke: 3.5, messageGap: 14, fontSize: 14 },
  xl: { diameter: 64, stroke: 4, messageGap: 16, fontSize: 15 },
};

const VARIANT_DEFAULTS: Record<string, SpinnerSize> = {
  fullscreen: "xl",
  section: "lg",
  inline: "md",
  button: "sm",
};

export function Spinner({
  size = "md",
  message,
  className,
  variant = "inline",
  ariaLabel = "Loading",
  color = "gold",
}: SpinnerProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const effectiveSize = VARIANT_DEFAULTS[variant] ?? size;
  const config = SIZE_CONFIG[effectiveSize];

  const isWhite = color === "white";
  const trackColor = isWhite ? "#FFFFFF4D" : "#1A1A1A33";
  const arcColor = isWhite ? "#FFFFFF" : "#C9A84C";
  const bgColor = variant === "fullscreen" ? "#1A1A1A" : "transparent";
  const textColor = variant === "fullscreen" ? (isWhite ? "#FFFFFF" : "#C9A84C") : (isWhite ? "#FFFFFF" : "#666");

  const centerX = config.diameter / 2;
  const centerY = config.diameter / 2;
  const radius = (config.diameter - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${circumference * 0.75} ${circumference * 0.25}`;

  if (variant === "fullscreen") {
    return (
      <div
        className={cn(
          "fixed inset-0 z-50 flex flex-col items-center justify-center",
          className
        )}
        style={{ background: bgColor }}
        role="status"
        aria-live="polite"
        aria-label={ariaLabel}
      >
        <svg
          width={config.diameter}
          height={config.diameter}
          viewBox={`0 0 ${config.diameter} ${config.diameter}`}
          className={prefersReducedMotion ? "animate-pulse" : "animate-spin"}
          style={{
            transformOrigin: "center",
            transform: prefersReducedMotion ? "none" : "rotate(-90deg)",
          }}
          aria-hidden="true"
        >
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={config.stroke}
            strokeLinecap="round"
          />
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke={arcColor}
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            style={{
              transformOrigin: `${centerX}px ${centerY}px`,
              transform: prefersReducedMotion ? "rotate(0deg)" : "rotate(0deg)",
            }}
          />
          {prefersReducedMotion && (
            <circle
              cx={centerX}
              cy={centerY}
              r={radius * 0.3}
              fill={arcColor}
              opacity={0.5}
            />
          )}
        </svg>
        {message && (
          <p
            className={cn("text-center font-medium", className)}
            style={{
              marginTop: config.messageGap,
              fontSize: config.fontSize,
              color: textColor,
            }}
          >
            {message}
          </p>
        )}
      </div>
    );
  }

  if (variant === "section") {
    return (
      <div
        className={cn("flex flex-col items-center justify-center", className)}
        style={{ minHeight: 120 }}
        role="status"
        aria-live="polite"
        aria-label={ariaLabel}
      >
        <svg
          width={config.diameter}
          height={config.diameter}
          viewBox={`0 0 ${config.diameter} ${config.diameter}`}
          className={prefersReducedMotion ? "animate-pulse" : "animate-spin"}
          style={{
            transformOrigin: "center",
            transform: prefersReducedMotion ? "none" : "rotate(-90deg)",
          }}
          aria-hidden="true"
        >
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={config.stroke}
            strokeLinecap="round"
          />
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke={arcColor}
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
          />
          {prefersReducedMotion && (
            <circle
              cx={centerX}
              cy={centerY}
              r={radius * 0.3}
              fill={arcColor}
              opacity={0.5}
            />
          )}
        </svg>
        {message && (
          <p
            className="text-center font-medium"
            style={{
              marginTop: config.messageGap,
              fontSize: config.fontSize,
              color: textColor,
            }}
          >
            {message}
          </p>
        )}
      </div>
    );
  }

  if (variant === "button") {
    return (
      <span
        className={cn("inline-flex items-center gap-2", className)}
        role="status"
        aria-live="polite"
        aria-label={ariaLabel}
      >
        <svg
          width={config.diameter}
          height={config.diameter}
          viewBox={`0 0 ${config.diameter} ${config.diameter}`}
          className={prefersReducedMotion ? "animate-pulse" : "animate-spin"}
          style={{
            transformOrigin: "center",
            transform: prefersReducedMotion ? "none" : "rotate(-90deg)",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={config.stroke}
            strokeLinecap="round"
          />
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke={arcColor}
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
          />
          {prefersReducedMotion && (
            <circle
              cx={centerX}
              cy={centerY}
              r={radius * 0.3}
              fill={arcColor}
              opacity={0.5}
            />
          )}
        </svg>
        {message && (
          <span
            className="font-medium"
            style={{
              fontSize: config.fontSize,
              color: textColor,
            }}
          >
            {message}
          </span>
        )}
      </span>
    );
  }

  return (
    <div
      className={cn("flex flex-col items-center", className)}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <svg
        width={config.diameter}
        height={config.diameter}
        viewBox={`0 0 ${config.diameter} ${config.diameter}`}
        className={prefersReducedMotion ? "animate-pulse" : "animate-spin"}
        style={{
          transformOrigin: "center",
          transform: prefersReducedMotion ? "none" : "rotate(-90deg)",
        }}
        aria-hidden="true"
      >
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={config.stroke}
          strokeLinecap="round"
        />
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="none"
          stroke={arcColor}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
        />
        {prefersReducedMotion && (
          <circle
            cx={centerX}
            cy={centerY}
            r={radius * 0.3}
            fill={arcColor}
            opacity={0.5}
          />
        )}
      </svg>
      {message && (
        <p
          className="text-center font-medium"
          style={{
            marginTop: config.messageGap,
            fontSize: config.fontSize,
            color: textColor,
            whiteSpace: "nowrap",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export function FullscreenSpinner({ message = "Loading The Crunch...", className, color }: { message?: string; className?: string; color?: "gold" | "white" }) {
  return <Spinner variant="fullscreen" size="xl" message={message} className={className} color={color} />;
}

export function SectionSpinner({ message = "Loading...", className, color }: { message?: string; className?: string; color?: "gold" | "white" }) {
  return <Spinner variant="section" size="lg" message={message} className={className} color={color} />;
}

export function InlineSpinner({ message = "Loading...", className, color }: { message?: string; className?: string; color?: "gold" | "white" }) {
  return <Spinner variant="inline" size="md" message={message} className={className} color={color} />;
}

export function ButtonSpinner({ message, className, color }: { message?: string; className?: string; color?: "gold" | "white" }) {
  return <Spinner variant="button" size="sm" message={message} className={className} color={color} />;
}