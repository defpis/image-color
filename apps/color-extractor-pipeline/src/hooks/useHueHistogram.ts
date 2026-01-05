import { useMemo } from "react";
import {
  extractHueHistogram,
  type HueHistogram,
  type HistogramWeightMode,
} from "@image-color/color-extractor";

interface UseHueHistogramOptions {
  imageData: ImageData | null;
  minChroma?: number;
  weightMode?: HistogramWeightMode;
  lightnessMargin?: number;
}

export function useHueHistogram({
  imageData,
  minChroma,
  weightMode,
  lightnessMargin,
}: UseHueHistogramOptions): HueHistogram | null {
  return useMemo(() => {
    if (!imageData) return null;
    return extractHueHistogram(imageData, {
      minChroma,
      weightMode,
      lightnessMargin,
    });
  }, [imageData, minChroma, weightMode, lightnessMargin]);
}
