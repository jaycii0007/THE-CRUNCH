"use client";

/**
 * ImageStreamHero — Moving Two-Rail Perspective Image Corridor
 *
 * A cinematic, infinite horizontal image corridor with two mirrored rails
 * converging at a central vanishing point. Images flow continuously from
 * the distant center toward the viewer on both left and right sides.
 *
 * Uses CSS Container Queries (cqw units) for responsive sizing and
 * CSS keyframe animations generated at runtime for smooth, performant motion.
 *
 * Props:
 * - images: Array of image src strings (local paths under /img/)
 * - speed: Animation duration in seconds for one full loop (default: 30)
 * - axis: Vanishing point horizontal position 0-1 (default: 0.5 = center)
 * - cards: Number of visible cards per rail (default: 12)
 * - path: Curvature of the rails (default: 0.15)
 * - className: Additional CSS classes
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ImageStreamHeroProps {
  images: string[];
  speed?: number;
  axis?: number;
  cards?: number;
  path?: number;
  className?: string;
}

interface KeyframeEntry {
  offset: number;
  left: string;
  right: string;
  scale: string;
  opacity: string;
  zIndex: number;
  transform: string;
}

export function ImageStreamHero({
  images,
  speed = 30,
  axis = 0.5,
  cards = 12,
  path = 0.15,
  className,
}: ImageStreamHeroProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const [keyframes, setKeyframes] = React.useState<string>("");

  // Detect prefers-reduced-motion
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduceMotion(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  // Track container width for cqw units
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const read = () => setContainerWidth(el.clientWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Generate CSS keyframes for the infinite corridor animation
  React.useEffect(() => {
    if (!containerWidth || reduceMotion) {
      setKeyframes("");
      return;
    }

    const keyframeEntries: KeyframeEntry[] = [];

    // Generate keyframes for a full 360-degree loop
    // Each card travels from vanishing point (center) to edge
    const steps = 20; // Keyframe granularity

    for (let step = 0; step <= steps; step++) {
      const progress = step / steps; // 0 to 1
      const angle = progress * Math.PI * 2; // Full circle in radians

      // Perspective calculations
      // Vanishing point at axis (0.5 = center)
      const vanishingX = axis;

      // Card position along the rail (0 = at vanishing point, 1 = at viewer)
      const railProgress = Math.sin(angle * 0.5 + Math.PI * 0.5) * 0.5 + 0.5;

      // Left rail: moves from center to left edge
      const leftX = vanishingX - railProgress * vanishingX * (1 + path);
      // Right rail: moves from center to right edge
      const rightX = vanishingX + railProgress * (1 - vanishingX) * (1 + path);

      // Scale grows as card approaches viewer
      const scale = 0.15 + railProgress * 0.85;

      // Opacity: fade in near vanishing point, full in middle, fade out at edge
      let opacity = 1;
      if (railProgress < 0.15) opacity = railProgress / 0.15;
      else if (railProgress > 0.85) opacity = (1 - railProgress) / 0.15;

      // Z-index based on depth (closer = higher)
      const zIndex = Math.round(100 * railProgress);

      keyframeEntries.push({
        offset: progress,
        left: `${leftX * 100}%`,
        right: `${(1 - rightX) * 100}%`,
        scale: scale.toFixed(3),
        opacity: opacity.toFixed(3),
        zIndex,
        transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})`,
      });
    }
    const keyframeRules = keyframeEntries
      .map((kf) => {
        const pct = (kf.offset * 100).toFixed(2);
        return `${pct}% {
  left: ${kf.left};
  right: ${kf.right};
  transform: ${kf.transform};
  opacity: ${kf.opacity};
  z-index: ${kf.zIndex};
}`;
      })
      .join("\n");

    const animationName = `imageStreamHero-${Date.now()}`;
    setKeyframes(`
@keyframes ${animationName} {
${keyframeRules}
}
    `);

    // Store animation name for use in styles
    (window as any)[`__ish_animation_${animationName}`] = animationName;
  }, [containerWidth, cards, axis, path, reduceMotion]);

  if (!images.length) {
    return (
      <div
        ref={containerRef}
        className={cn("relative w-full h-[80vh] min-h-[400px]", className)}
        style={{ overflow: "hidden" }}
        role="img"
        aria-label="Image stream hero - no images available"
      >
        <div className="absolute inset-0 flex items-center justify-center text-[#C9A84C]/40">
          <p>No images configured</p>
        </div>
      </div>
    );
  }

  // Duplicate images to ensure seamless looping
  const duplicatedImages = [...images, ...images];
  const totalImages = duplicatedImages.length;

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full h-[80vh] min-h-[400px] overflow-hidden", className)}
      style={{
        containerType: "inline-size",
        containerName: "ish-container",
      }}
      role="region"
      aria-label="Animated image corridor"
    >
      {/* Injected keyframes */}
      {keyframes && (
        <style dangerouslySetInnerHTML={{ __html: keyframes }} />
      )}

      {/* CSS for card animation - using container query units */}
      <style dangerouslySetInnerHTML={{ __html: `
        .ish-rail {
          position: absolute;
          top: 50%;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .ish-card {
          position: absolute;
          top: 50%;
          width: 35cqw;
          max-width: 420px;
          aspect-ratio: 4/3;
          border-radius: 12px;
          overflow: hidden;
          box-shadow:
            0 20px 60px -20px rgba(0,0,0,0.8),
            0 0 0 1px rgba(201,168,76,0.15),
            inset 0 1px 0 rgba(255,255,255,0.03);
          will-change: transform, opacity, left, right;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .ish-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .ish-left { left: 50%; }
        .ish-right { right: 50%; }
        @media (prefers-reduced-motion: reduce) {
          .ish-card { animation: none !important; opacity: 0.4; }
        }
        @container ish-container (max-width: 640px) {
          .ish-card { width: 50cqw; max-width: 280px; border-radius: 8px; }
        }
        @container ish-container (max-width: 1024px) {
          .ish-card { width: 40cqw; max-width: 360px; }
        }
      `}} />

      {/* Left Rail - images flow from center to left */}
      <div className="ish-rail ish-left" aria-hidden="true">
        {duplicatedImages.map((src, i) => {
          const delay = (i / totalImages) * speed;
          const animationName = `ish-left-${i}`;
          return (
            <div
              key={`left-${i}`}
              className="ish-card"
              style={{
                animation: `${animationName} ${speed}s linear infinite`,
                animationDelay: `-${delay}s`,
                transformOrigin: "center center",
              }}
            >
              <img
                src={src}
                alt=""
                loading="lazy"
                decoding="async"
              />
            </div>
          );
        })}
      </div>

      {/* Right Rail - images flow from center to right */}
      <div className="ish-rail ish-right" aria-hidden="true">
        {duplicatedImages.map((src, i) => {
          const delay = (i / totalImages) * speed;
          const animationName = `ish-right-${i}`;
          return (
            <div
              key={`right-${i}`}
              className="ish-card"
              style={{
                animation: `${animationName} ${speed}s linear infinite`,
                animationDelay: `-${delay}s`,
                transformOrigin: "center center",
              }}
            >
              <img
                src={src}
                alt=""
                loading="lazy"
                decoding="async"
              />
            </div>
          );
        })}
      </div>

      {/* Central vanishing point glow */}
      <div
        className="pointer-events-none"
        style={{
          position: "absolute",
          top: "50%",
          left: `${axis * 100}%`,
          transform: "translate(-50%, -50%)",
          width: "8cqw",
          height: "8cqw",
          maxWidth: "120px",
          maxHeight: "120px",
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(201,168,76,0.25) 0%, transparent 70%)",
          filter: "blur(40px)",
          zIndex: 50,
        }}
        aria-hidden="true"
      />

      {/* Top gradient fade */}
      <div
        className="pointer-events-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "30%",
          background: "linear-gradient(180deg, rgba(26,26,26,0.9) 0%, transparent 100%)",
          zIndex: 10,
        }}
        aria-hidden="true"
      />

      {/* Bottom gradient fade */}
      <div
        className="pointer-events-none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "30%",
          background: "linear-gradient(0deg, rgba(26,26,26,0.9) 0%, transparent 100%)",
          zIndex: 10,
        }}
        aria-hidden="true"
      />
    </div>
  );
}

export default ImageStreamHero;