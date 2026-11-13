"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  ChevronRight,
} from "lucide-react";

// ── Design Tokens ──────────────────────────────────────────────────────
const COLORS = {
  // OLED Black
  BACKGROUND: "#000000",

  // Navigation
  CREAM: "#F5F2EA",
  MUTED: "#A69C8E",
  MUTED_DIM: "#7A756B",

  // Brand Gold
  GOLD: "#C9A84C",
  GOLD_DIM: "#B8953A",
  GOLD_LIGHT: "#E8D4A0",

  // 3D Wordmark Material (Black Chrome)
  METAL_BASE: "#080808",
  METAL_SURFACE: "#1A1A1A",
  METAL_HIGHLIGHT: "#232323",
  METAL_SPECULAR: "#555555",
  METAL_SPECULAR_STRONG: "#8B8B8B",
  GOLD_ACCENT: "#C9A84C",

  // Dividers
  DIVIDER: "rgba(255,255,255,0.08)",
  DIVIDER_STRONG: "rgba(255,255,255,0.12)",
} as const;

const SPACING = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  "2xl": "3rem",
  "3xl": "4rem",
  "4xl": "6rem",
} as const;

// ── CSS-based 3D Wordmark Component ────────────────────────────────────
// Uses background-clip:text with metallic gradient + layered text-shadows for extrusion
interface Wordmark3DProps {
  reducedMotion: boolean;
}

function Wordmark3D({ reducedMotion }: Wordmark3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isInView, setIsInView] = useState(false);

  // Intersection Observer for reveal animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Subtle mouse parallax (desktop only)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (reducedMotion) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      setMousePos({ x: x * 1.5, y: y * 1.5 });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [reducedMotion]);

  const transformStyle = {
    transform: `perspective(800px) rotateX(${-mousePos.y}deg) rotateY(${mousePos.x}deg)`,
    transformStyle: "preserve-3d" as const,
    transition: reducedMotion ? "none" : "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
  };

  // Metallic gradient for the front face (black chrome)
  const metalGradient = `linear-gradient(180deg,
    #8B8B8B 0%,
    #555555 15%,
    #232323 35%,
    #1A1A1A 55%,
    #080808 75%,
    #000000 100%
  )`;

  // Light sweep gradient for entrance animation
  const lightSweepGradient = `linear-gradient(90deg,
    #1A1A1A 0%,
    #232323 20%,
    #8B8B8B 40%,
    #C9A84C 50%,
    #8B8B8B 60%,
    #232323 80%,
    #1A1A1A 100%
  )`;

  // Extrusion shadow layers - multiple text-shadows for depth
  // Each layer: offsetX, offsetY, blur, color
  const extrusionShadows = `
    1px 1px 0 #0A0A0A,
    2px 2px 0 #0C0C0C,
    3px 3px 0 #0E0E0E,
    4px 4px 0 #101010,
    5px 5px 0 #121212,
    6px 6px 0 #141414,
    7px 7px 0 #161616,
    8px 8px 0 #181818,
    9px 9px 0 #1A1A1A,
    10px 10px 0 #1C1C1C,
    12px 12px 4px rgba(0,0,0,0.6),
    20px 20px 12px rgba(0,0,0,0.5),
    30px 30px 24px rgba(0,0,0,0.4)
  `.replace(/\s+/g, " ").trim();

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0.3, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion ? 0 : 1.0,
        ease: [0.22, 1, 0.36, 1],
        delay: 0.1,
      }}
      style={{
        position: "relative",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        minHeight: "280px",
        maxHeight: "360px",
        overflow: "hidden",
      }}
      role="img"
      aria-label="CRUNCH brand wordmark"
    >
      <div
        style={{
          ...transformStyle,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 0,
          paddingBottom: "clamp(12px, 2vw, 24px)",
          filter: "drop-shadow(0 40px 80px rgba(0,0,0,0.6)) drop-shadow(0 8px 24px rgba(0,0,0,0.4))",
        }}
        aria-hidden="true"
      >
        {/* CRUNCH Wordmark - CSS 3D Text */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: reducedMotion ? 0 : 1.2,
            ease: [0.22, 1, 0.36, 1],
            delay: 0.2,
          }}
          style={{
            margin: 0,
            fontFamily: "'Poppins', 'Inter', system-ui, sans-serif",
            fontWeight: 900,
            fontSize: "clamp(6rem, 14vw, 14rem)",
            lineHeight: 1,
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
            textAlign: "center" as const,
            // Metallic gradient fill
            background: isInView && !reducedMotion ? lightSweepGradient : metalGradient,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
            // Extrusion via layered text-shadows
            textShadow: extrusionShadows,
            // Top bevel highlight
            filter: "drop-shadow(-1px -1px 0 #3A3A3A) drop-shadow(-2px -2px 0 #4A4A4A)",
            // Prevent subpixel rendering issues
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
          }}
          aria-hidden="true"
        >
          CRUNCH
        </motion.h1>

        {/* Subtle gold accent line beneath wordmark */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{
            duration: reducedMotion ? 0 : 1.4,
            ease: [0.22, 1, 0.36, 1],
            delay: 0.6,
          }}
          style={{
            marginTop: "clamp(8px, 1.5vw, 16px)",
            width: "clamp(120px, 18%, 240px)",
            height: "2px",
            background: `linear-gradient(90deg, transparent, ${COLORS.GOLD_ACCENT} 20%, ${COLORS.GOLD_LIGHT} 50%, ${COLORS.GOLD_ACCENT} 80%, transparent)`,
            borderRadius: "1px",
            filter: "drop-shadow(0 0 8px rgba(201,168,76,0.3))",
          }}
          aria-hidden="true"
        />
      </div>

      {/* Decorative clipping mask gradient at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "clamp(60px, 12vw, 100px)",
          background: `linear-gradient(to top, ${COLORS.BACKGROUND} 0%, rgba(0,0,0,0) 100%)`,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      />
    </motion.div>
  );
}

// ── Footer Navigation ──────────────────────────────────────────────────
interface FooterNavProps {
  reducedMotion: boolean;
}

function FooterNav({ reducedMotion }: FooterNavProps) {
  const navSections = [
    {
      title: "Explore",
      links: [
        { label: "Home", path: "/products" },
        { label: "About", path: "/aboutthecrunch" },
        { label: "Menu", path: "/usersmenu" },
      ],
    },
    {
      title: "Products",
      links: [
        { label: "Featured Selection", path: "/products-v2" },
        { label: "All Products", path: "/products" },
      ],
    },
    {
      title: "Support",
      links: [
        { label: "Contact", path: "/contact" },
        { label: "FAQ", path: "/faq" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", path: "/privacy" },
        { label: "Terms of Service", path: "/terms" },
      ],
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion ? 0 : 0.8,
        ease: [0.22, 1, 0.36, 1],
        delay: 0.4,
      }}
      style={{
        width: "100%",
        maxWidth: "1440px",
        margin: "0 auto",
        padding: `0 clamp(20px, 5vw, 64px) ${SPACING["3xl"]}`,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: SPACING.xl,
        alignItems: "start",
      }}
      role="navigation"
      aria-label="Footer navigation"
    >
      {/* Brand Column */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.7, delay: 0.5 }}
        style={{ maxWidth: "320px" }}
      >
        <div
          style={{
            fontSize: "clamp(16px, 2.5vw, 20px)",
            fontWeight: 800,
            fontFamily: "'Poppins', 'Inter', system-ui, sans-serif",
            letterSpacing: "-0.02em",
            color: COLORS.CREAM,
            marginBottom: SPACING.sm,
          }}
        >
          CRUNCH
        </div>
        <p
          style={{
            fontSize: "14px",
            lineHeight: 1.7,
            color: COLORS.MUTED,
            fontFamily: "'Inter', system-ui, sans-serif",
            marginBottom: SPACING.lg,
            maxWidth: "280px",
          }}
        >
          Premium fried chicken crafted with signature flavors.
          A modern take on comfort food classics.
        </p>
        <div style={{ display: "flex", gap: SPACING.md }}>
          {[
            { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
            { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
            { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
            { icon: Youtube, href: "https://youtube.com", label: "YouTube" },
          ].map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: `1px solid ${COLORS.DIVIDER}`,
                color: COLORS.MUTED_DIM,
                transition: reducedMotion
                  ? "none"
                  : "color 0.2s ease, border-color 0.2s ease, background 0.2s ease, transform 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!reducedMotion) {
                  e.currentTarget.style.color = COLORS.GOLD;
                  e.currentTarget.style.borderColor = COLORS.GOLD;
                  e.currentTarget.style.background = "rgba(201,168,76,0.1)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!reducedMotion) {
                  e.currentTarget.style.color = COLORS.MUTED_DIM;
                  e.currentTarget.style.borderColor = COLORS.DIVIDER;
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              <social.icon style={{ width: "18px", height: "18px" }} aria-hidden="true" />
            </a>
          ))}
        </div>
      </motion.div>

      {/* Navigation Columns */}
      {navSections.map((section, sectionIndex) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.6,
            delay: 0.5 + sectionIndex * 0.08,
          }}
        >
          <h3
            style={{
              fontSize: "11px",
              fontWeight: 600,
              fontFamily: "'Inter', system-ui, sans-serif",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: COLORS.MUTED_DIM,
              marginBottom: SPACING.md,
            }}
          >
            {section.title}
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: SPACING.xs }}>
            {section.links.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 400,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    color: COLORS.MUTED,
                    textDecoration: "none",
                    transition: reducedMotion
                      ? "none"
                      : "color 0.2s ease, gap 0.2s ease",
                    padding: "4px 0",
                  }}
                  onMouseEnter={(e) => {
                    if (!reducedMotion) {
                      e.currentTarget.style.color = COLORS.CREAM;
                      e.currentTarget.style.gap = "12px";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!reducedMotion) {
                      e.currentTarget.style.color = COLORS.MUTED;
                      e.currentTarget.style.gap = "8px";
                    }
                  }}
                >
                  {link.label}
                  <ChevronRight style={{ width: "14px", height: "14px", flexShrink: 0, color: COLORS.GOLD, opacity: 0.6 }} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ── Bottom Bar ─────────────────────────────────────────────────────────
function BottomBar({ reducedMotion }: { reducedMotion: boolean }) {
  const currentYear = new Date().getFullYear();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.6, delay: 0.9 }}
      style={{
        width: "100%",
        maxWidth: "1440px",
        margin: "0 auto",
        padding: `${SPACING.lg} clamp(20px, 5vw, 64px)`,
        borderTop: `1px solid ${COLORS.DIVIDER}`,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACING.md,
        fontSize: "13px",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: COLORS.MUTED_DIM,
      }}
      role="contentinfo"
    >
      <div style={{ display: "flex", alignItems: "center", gap: SPACING.md, flexWrap: "wrap" }}>
        <span>© {currentYear} CRUNCH. All rights reserved.</span>
        <span style={{ color: COLORS.DIVIDER_STRONG }}>|</span>
        <Link to="/privacy" style={{ color: COLORS.MUTED_DIM, textDecoration: "none", transition: "color 0.2s" }}>Privacy</Link>
        <span style={{ color: COLORS.DIVIDER_STRONG }}>|</span>
        <Link to="/terms" style={{ color: COLORS.MUTED_DIM, textDecoration: "none", transition: "color 0.2s" }}>Terms</Link>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: SPACING.md }}>
        <span style={{ color: COLORS.GOLD, fontWeight: 500 }}>Made with care</span>
      </div>
    </motion.div>
  );
}

// ── Main Footer Component ──────────────────────────────────────────────
export function Crunch3DFooter() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setReducedMotion(query.matches);
    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return (
    <footer
      style={{
        backgroundColor: COLORS.BACKGROUND,
        position: "relative",
        width: "100%",
      }}
      role="contentinfo"
      aria-label="Footer"
    >
      {/* Subtle top divider */}
      <div
        style={{
          width: "100%",
          maxWidth: "1440px",
          margin: "0 auto",
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${COLORS.DIVIDER} 20%, ${COLORS.DIVIDER} 80%, transparent)`,
        }}
        aria-hidden="true"
      />

      {/* 3D Wordmark Region */}
      <div
        style={{
          width: "100%",
          maxWidth: "1440px",
          margin: "0 auto",
          padding: `${SPACING["3xl"]} clamp(20px, 5vw, 64px) ${SPACING.xl}`,
        }}
      >
        <Wordmark3D reducedMotion={reducedMotion} />
      </div>

      {/* Navigation Region */}
      <FooterNav reducedMotion={reducedMotion} />

      {/* Bottom Bar */}
      <BottomBar reducedMotion={reducedMotion} />
    </footer>
  );
}

export default Crunch3DFooter;