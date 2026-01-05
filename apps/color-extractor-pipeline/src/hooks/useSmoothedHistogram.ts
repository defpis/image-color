import { useMemo } from "react";
import {
  gaussianSmoothHistogram,
  type HueHistogram,
} from "@image-color/color-extractor";

export interface SmoothedHistogramData {
  /** Smoothed buckets for peak detection */
  buckets: number[];
  /** Maximum value in smoothed buckets */
  max: number;
}

interface UseSmoothedHistogramOptions {
  histogram: HueHistogram | null;
  sigma: number;
}

export function useSmoothedHistogram({
  histogram,
  sigma,
}: UseSmoothedHistogramOptions): SmoothedHistogramData | null {
  return useMemo(() => {
    if (!histogram) return null;

    const buckets = gaussianSmoothHistogram(histogram.buckets, sigma);
    const max = Math.max(...buckets);

    return { buckets, max };
  }, [histogram, sigma]);
}
