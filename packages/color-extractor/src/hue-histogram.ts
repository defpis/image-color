import { rgbToOklch } from "./oklch";

export type HistogramWeightMode = "count" | "chroma" | "chromaLightness";

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
  minChroma?: number;
  /** Weight mode: "count" (1 per pixel), "chroma" (chroma only), or "chromaLightness" (chroma * lightnessWeight, default) */
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
    minChroma = 0.02,
    weightMode = "chromaLightness",
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

    // Skip low chroma (grayscale) pixels
    if (c < minChroma) continue;

    // Skip extreme lightness (too dark or too bright)
    if (l < minLightness || l > maxLightness) continue;

    const bucket = Math.floor(h) % 360;
    // Use weight based on mode
    let weight: number;
    if (weightMode === "count") {
      weight = 1;
    } else if (weightMode === "chroma") {
      weight = c;
    } else {
      // chromaLightness: chroma * lightnessWeight (peaks at L=0.5)
      const lightnessWeight = 1 - 2 * Math.abs(l - 0.5);
      weight = c * Math.max(lightnessWeight, 0);
    }
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
