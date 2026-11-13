import {
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from "react";
import { resolveAssetUrl } from "@/lib/api";

export const PRODUCT_IMAGE_PLACEHOLDER = "/img/placeholder.jpg";

type ProductImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  fallbackSrc?: string;
};

type FallbackImageProps = Omit<ProductImageProps, "src" | "fallbackSrc"> & {
  source: string;
  fallback: string;
};

function FallbackImage({
  source,
  fallback,
  onError,
  ...imageProps
}: FallbackImageProps) {
  const [failed, setFailed] = useState(false);

  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    onError?.(event);
    if (!failed && source !== fallback) {
      setFailed(true);
    }
  };

  return (
    <img
      {...imageProps}
      src={failed ? fallback : source}
      onError={handleError}
    />
  );
}

export function ProductImage({
  src,
  fallbackSrc = PRODUCT_IMAGE_PLACEHOLDER,
  ...imageProps
}: ProductImageProps) {
  const resolvedSource = resolveAssetUrl(src);
  const resolvedFallback = resolveAssetUrl(fallbackSrc);
  return (
    <FallbackImage
      key={resolvedSource}
      {...imageProps}
      source={resolvedSource}
      fallback={resolvedFallback}
    />
  );
}
