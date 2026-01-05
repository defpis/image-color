import { useMemo } from "react";
import { detectPeaks, type Peak } from "@image-color/color-extractor";
import type { SmoothedHistogramData } from "./useSmoothedHistogram";

interface UsePeaksOptions {
  smoothedHistogram: SmoothedHistogramData | null;
  minHeight?: number;
}

export function usePeaks({
  smoothedHistogram,
  minHeight,
}: UsePeaksOptions): Peak[] {
  return useMemo(() => {
    if (!smoothedHistogram) return [];
    return detectPeaks(smoothedHistogram.buckets, { minHeight });
  }, [smoothedHistogram, minHeight]);
}
