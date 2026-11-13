/**
 * Products V2 — Premium Featured Selection Showcase
 * Full-viewport immersive WheelCarousel with real product data
 * Includes premium 3D typography footer
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { api, resolveAssetUrl } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { WheelCarousel, type WheelCarouselItem } from "@/components/ui/wheel-carousel";
import { Crunch3DFooter } from "@/components/products-v2/Crunch3DFooter";
import type { Product } from "./productv2.types";

// ── Types & helpers ────────────────────────────────────────────────────────
const normCat = (v: unknown): string => String(v ?? "").trim();

const mapProducts = (data: unknown[]): Product[] =>
  (data as Record<string, unknown>[])
    .map((r) => {
      const rawImage = String(r?.image ?? r?.img ?? "").trim();
      const resolvedImg = rawImage ? resolveAssetUrl(rawImage) : "";
      return {
        id: Number(r?.id ?? r?.product_id ?? 0),
        name: String(r?.name ?? r?.product_name ?? "").trim(),
        category: normCat(r?.category),
        rating: Number(r?.rating ?? 0),
        badge: String(r?.badge ?? "").trim(),
        description: String(r?.description ?? "").trim(),
        price: Number(r?.price ?? 0),
        spicy: Boolean(r?.spicy),
        img: resolvedImg,
        archived: String(r?.availability_status ?? r?.availabilityStatus ?? "")
          .trim()
          .toLowerCase() === "hidden",
      };
    })
    .filter((p) => p.id > 0 && p.name);

// ── Main Products Page ─────────────────────────────────────────────────────
export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "empty" | "ready">("loading");

  const fetchProducts = useCallback(async () => {
    try {
      setStatus("loading");
      const productsData = await api.get<unknown[]>("/products");
      const mapped = mapProducts(productsData);
      setProducts(mapped);
      setStatus(mapped.length === 0 ? "empty" : "ready");
    } catch (err) {
      console.error("Failed to load products:", err);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Map products to WheelCarousel items
  const wheelItems = useMemo((): WheelCarouselItem[] => {
    return products
      .filter((p) => !p.archived && p.img)
      .slice(0, 20)
      .map((p) => ({
        label: p.name,
        image: p.img,
        imageAlt: `${p.name} - ${p.category || "Featured product"}`,
      }));
  }, [products]);

  // Loading state
  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#000000" }}>
        <Navbar />
        <div style={{
          height: "calc(100vh - 72px)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <WheelCarousel items={[]} mode="dark" background="#000000" />
          </div>
          <Crunch3DFooter />
        </div>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div style={{ minHeight: "100vh", background: "#000000" }}>
        <Navbar />
        <div style={{
          height: "calc(100vh - 72px)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1.5rem",
              padding: "2rem",
              textAlign: "center",
              color: "#F5F2EA",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "clamp(1.25rem, 3vw, 1.75rem)", fontWeight: 600 }}>
              Unable to load featured products
            </h2>
            <p style={{ margin: 0, color: "#A69C8E", maxWidth: "400px" }}>
              Please check your connection and try again
            </p>
            <button
              onClick={fetchProducts}
              style={{
                marginTop: "1rem",
                padding: "0.75rem 2rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#000000",
                background: "linear-gradient(135deg, #C9A84C 0%, #E8D4A0 100%)",
                border: "none",
                borderRadius: "999px",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
          <Crunch3DFooter />
        </div>
      </div>
    );
  }

  // Empty state
  if (status === "empty" || wheelItems.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#000000" }}>
        <Navbar />
        <div style={{
          height: "calc(100vh - 72px)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1.5rem",
              padding: "2rem",
              textAlign: "center",
              color: "#F5F2EA",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "clamp(1.25rem, 3vw, 1.75rem)", fontWeight: 600 }}>
              No featured products available
            </h2>
            <p style={{ margin: 0, color: "#A69C8E", maxWidth: "400px" }}>
              Products with images will appear here automatically
            </p>
            <button
              onClick={fetchProducts}
              style={{
                marginTop: "1rem",
                padding: "0.75rem 2rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#000000",
                background: "linear-gradient(135deg, #C9A84C 0%, #E8D4A0 100%)",
                border: "none",
                borderRadius: "999px",
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>
          <Crunch3DFooter />
        </div>
      </div>
    );
  }

  // Ready state - Render WheelCarousel with premium footer
  return (
    <div style={{ minHeight: "100vh", background: "#000000" }}>
      <Navbar />
      <div style={{
        height: "calc(100vh - 72px)",
        display: "flex",
        flexDirection: "column"
      }}>
        <div style={{ flex: "1 1 auto", minHeight: 0 }}>
          <WheelCarousel
            items={wheelItems}
            mode="dark"
            photoSide="left"
            photoWidth={35}
            photoAspect="3/4"
            contentWidth={1200}
            gap={0}
            photoRadius={16}
            crossfadeDuration={0.6}
            radius={380}
            spacing={12}
            visibleItems={7}
            apexInset={30}
            textColor="rgba(245, 242, 234, 0.45)"
            selectedColor="#F5F2EA"
            showMarker={true}
            markerColor="#C9A84C"
            markerSize={14}
            markerGap={18}
            background="#000000"
            panelColor="#191715"
            scrollSpeed={0.006}
            dragSpeed={0.018}
            snap={true}
            momentum={true}
            appear={true}
            edgeFade={false}
            initialIndex={0}
          />
        </div>
        <Crunch3DFooter />
      </div>
    </div>
  );
}