import { useMemo } from "react";
import {
  extractHueHistogram,
  type HueHistogram,
  type HistogramWeightMode,
} from "@image-color/color-extractor";

interface UseHueHistogramOptions {
  imageData: ImageData | null;
  satThreshold?: number;
  weightMode?: HistogramWeightMode;
  lightnessMargin?: number;
}

export function useHueHistogram({
  imageData,
  satThreshold,
  weightMode,
  lightnessMargin,
}: UseHueHistogramOptions): HueHistogram | null {
  return useMemo(() => {
    if (!imageData) return null;
    return extractHueHistogram(imageData, {
      satThreshold,
      weightMode,
      lightnessMargin,
    });
  }, [imageData, satThreshold, weightMode, lightnessMargin]);
}
