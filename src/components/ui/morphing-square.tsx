"use client";

import { motion, AnimatePresence, useInView, useScroll, useTransform, type MotionStyle } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface MorphingSquareProps {
  size?: number;
  message?: string;
  className?: string;
  variant?: "default" | "inline" | "fullscreen";
}

export function MorphingSquare({
  size = 64,
  message = "Loading...",
  className,
  variant = "default",
}: MorphingSquareProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const squareRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const { scrollY } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const rotate = useTransform(scrollY, [0, window.innerHeight], [0, 360]);
  const scale = useTransform(scrollY, [0, window.innerHeight], [1, 0.5]);
  const borderRadius = useTransform(scrollY, [0, window.innerHeight], ["0%", "50%"]);
  const backgroundColor = useTransform(
    scrollY,
    [0, window.innerHeight * 0.5, window.innerHeight],
    ["#1A1A1A", "#C9A84C", "#1A1A1A"]
  );

  const containerStyles = {
    width: size,
    height: size,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const squareStyles = {
    width: "100%",
    height: "100%",
    borderRadius: prefersReducedMotion ? "0%" : borderRadius,
    backgroundColor: prefersReducedMotion ? "#1A1A1A" : backgroundColor,
    transform: prefersReducedMotion
      ? undefined
      : `rotate(${rotate}deg) scale(${scale})`,
    transition: prefersReducedMotion ? "none" : "transform 0.3s ease-out",
  };

  const messageStyles: MotionStyle = {
    position: "absolute",
    bottom: variant === "inline" ? -28 : -40,
    left: "50%",
    transform: "translateX(-50%)",
    whiteSpace: "nowrap",
    fontSize: 12,
    color: "#666",
    fontWeight: 500,
  };

  if (variant === "fullscreen") {
    return (
      <motion.div
        ref={containerRef}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/80", className)}
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.2 } },
        }}
      >
        <div style={containerStyles}>
          <motion.div
            ref={squareRef}
            style={squareStyles}
            animate={prefersReducedMotion ? {} : { rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </div>
        <motion.p
          style={messageStyles}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.p>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className={cn("flex flex-col items-center", className)}
        style={{ width: size, height: variant === "inline" ? size + 40 : size + 60 }}
      >
        <div style={containerStyles}>
          <motion.div
            ref={squareRef}
            style={squareStyles}
            animate={prefersReducedMotion ? {} : { rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </div>
        <motion.p
          style={messageStyles}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
}

export function MorphingSquareInline({ message = "Loading...", size = 32 }: { message?: string; size?: number }) {
  return <MorphingSquare variant="inline" size={size} message={message} />;
}

export function MorphingSquareFullscreen({ message = "Loading..." }: { message?: string }) {
  return <MorphingSquare variant="fullscreen" size={80} message={message} />;
}