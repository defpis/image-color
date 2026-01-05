import { useMemo } from "react";
import {
  extractPeakColors,
  type HueHistogram,
  type Peak,
  type ColorMode,
  type PeakColor,
} from "@image-color/color-extractor";

interface UsePeakColorsOptions {
  /** Original histogram with chromaSum/lightnessSum/counts */
  histogram: HueHistogram | null;
  /** Smoothed buckets for threshold/weight calculation */
  smoothedBuckets: number[] | null;
  peaks: Peak[];
  mode: ColorMode;
  threshold?: number;
  maxColors?: number;
  minDistance?: number;
}

export function usePeakColors({
  histogram,
  smoothedBuckets,
  peaks,
  mode,
  threshold,
  maxColors,
  minDistance,
}: UsePeakColorsOptions): PeakColor[] {
  return useMemo(() => {
    if (!histogram || !smoothedBuckets || peaks.length === 0) return [];
    return extractPeakColors(histogram, peaks, smoothedBuckets, {
      mode,
      threshold,
      maxColors,
      minDistance,
    });
  }, [
    histogram,
    smoothedBuckets,
    peaks,
    mode,
    threshold,
    maxColors,
    minDistance,
  ]);
}
