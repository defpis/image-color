import { rgbToOklch } from "./oklch";

export type HistogramWeightMode = "count" | "chroma";

/**
 * Attempt to provide an attempt for values that are outside of the range [0, 1].
 */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export interface HueHistogram {
  /** 360 buckets, one for each degree of hue */
  buckets: number[];
  /** Sum of chroma values per bucket */
  chromaSum: number[];
  /** Sum of lightness values per bucket */
  lightnessSum: number[];
  /** Pixel count per bucket (for computing averages) */
  counts: number[];
  /** Maximum value in buckets (for normalization) */
  max: number;
  /** Total weight */
  total: number;
}

export interface ExtractHueHistogramOptions {
  /** Minimum chroma threshold to include pixel (0-0.4, default 0.02) */
  satThreshold?: number;
  /** Weight mode: "count" (1 per pixel) or "chroma" (smoothstep chroma weight, default) */
  weightMode?: HistogramWeightMode;
  /**
   * Lightness margin to filter extreme values (default 0, no filtering)
   * e.g. 0.1 filters out pixels with L < 0.1 or L > 0.9
   */
  lightnessMargin?: number;
}

/**
 * Extract hue histogram from ImageData using OKLCH color space
 * Also tracks average chroma and lightness per hue bucket
 * @param imageData - Canvas ImageData
 * @param options - Extraction options
 * @returns HueHistogram with 360 buckets
 */
export function extractHueHistogram(
  imageData: ImageData,
  options: ExtractHueHistogramOptions = {}
): HueHistogram {
  const {
    satThreshold = 0.02,
    weightMode = "chroma",
    lightnessMargin = 0,
  } = options;
  const { data, width, height } = imageData;
  const buckets = new Array<number>(360).fill(0);
  const chromaSum = new Array<number>(360).fill(0);
  const lightnessSum = new Array<number>(360).fill(0);
  const counts = new Array<number>(360).fill(0);

  // Calculate lightness bounds
  const minLightness = lightnessMargin;
  const maxLightness = 1 - lightnessMargin;

  let total = 0;

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3];

    // Skip transparent pixels
    if (a < 200) continue;

    const [l, c, h] = rgbToOklch(r, g, b);

    // Skip extreme lightness (too dark or too bright)
    if (l < minLightness || l > maxLightness) continue;

    const bucket = Math.floor(h) % 360;
    // Use weight based on mode
    const weight = weightMode === "count" ? 1 : smoothstep(0, satThreshold, c);
    buckets[bucket] += weight;
    // Track chroma and lightness sums for averaging
    chromaSum[bucket] += c;
    lightnessSum[bucket] += l;
    counts[bucket]++;
    total += weight;
  }

  const max = Math.max(...buckets);

  return { buckets, chromaSum, lightnessSum, counts, max, total };
}
