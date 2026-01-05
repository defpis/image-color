import type { HueHistogram } from "./hue-histogram";
import type { Peak } from "./peaks";

// ============ Color Space Conversion Utilities ============

/**
 * Convert linear RGB to sRGB
 */
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * Convert OKLCH to sRGB (0-1)
 */
function oklchToSrgb(
  L: number,
  C: number,
  H: number
): [number, number, number] {
  // OKLCH to OKLab
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // OKLab to LMS'
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  // LMS' to LMS (cube)
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS to linear RGB
  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  // Linear RGB to sRGB
  return [
    Math.max(0, Math.min(1, linearToSrgb(lr))),
    Math.max(0, Math.min(1, linearToSrgb(lg))),
    Math.max(0, Math.min(1, linearToSrgb(lb))),
  ];
}

/**
 * Convert sRGB (0-1) to XYZ (D65 illuminant)
 */
function srgbToXyz(r: number, g: number, b: number): [number, number, number] {
  // sRGB to linear
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  // Linear RGB to XYZ (sRGB D65)
  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = 0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb;

  return [x, y, z];
}

/**
 * Convert XYZ to CIE L*a*b* (D65 illuminant)
 */
function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  // D65 reference white
  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return [L, a, b];
}

/**
 * Convert OKLCH to CIE L*a*b*
 */
function oklchToLab(L: number, C: number, H: number): [number, number, number] {
  const [r, g, b] = oklchToSrgb(L, C, H);
  const [x, y, z] = srgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

/**
 * Calculate CIEDE2000 (Delta E 2000) color difference
 * Reference: https://en.wikipedia.org/wiki/Color_difference#CIEDE2000
 */
function deltaE2000(
  L1: number,
  a1: number,
  b1: number,
  L2: number,
  a2: number,
  b2: number
): number {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  // Calculate C' and h'
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cavg = (C1 + C2) / 2;

  const G =
    0.5 *
    (1 - Math.sqrt(Math.pow(Cavg, 7) / (Math.pow(Cavg, 7) + Math.pow(25, 7))));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = Math.atan2(b1, a1p) * deg;
  if (h1p < 0) h1p += 360;

  let h2p = Math.atan2(b2, a2p) * deg;
  if (h2p < 0) h2p += 360;

  // Calculate differences
  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else {
    let diff = h2p - h1p;
    if (diff > 180) diff -= 360;
    else if (diff < -180) diff += 360;
    dhp = diff;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);

  // Calculate CIEDE2000
  const Lp = (L1 + L2) / 2;
  const Cp = (C1p + C2p) / 2;

  let hp: number;
  if (C1p * C2p === 0) {
    hp = h1p + h2p;
  } else {
    if (Math.abs(h1p - h2p) <= 180) {
      hp = (h1p + h2p) / 2;
    } else {
      if (h1p + h2p < 360) {
        hp = (h1p + h2p + 360) / 2;
      } else {
        hp = (h1p + h2p - 360) / 2;
      }
    }
  }

  const T =
    1 -
    0.17 * Math.cos((hp - 30) * rad) +
    0.24 * Math.cos(2 * hp * rad) +
    0.32 * Math.cos((3 * hp + 6) * rad) -
    0.2 * Math.cos((4 * hp - 63) * rad);

  const dTheta = 30 * Math.exp(-Math.pow((hp - 275) / 25, 2));

  const RC =
    2 * Math.sqrt(Math.pow(Cp, 7) / (Math.pow(Cp, 7) + Math.pow(25, 7)));

  const SL =
    1 + (0.015 * Math.pow(Lp - 50, 2)) / Math.sqrt(20 + Math.pow(Lp - 50, 2));
  const SC = 1 + 0.045 * Cp;
  const SH = 1 + 0.015 * Cp * T;

  const RT = -Math.sin(2 * dTheta * rad) * RC;

  const kL = 1;
  const kC = 1;
  const kH = 1;

  const dE = Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
      Math.pow(dCp / (kC * SC), 2) +
      Math.pow(dHp / (kH * SH), 2) +
      RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );

  return dE;
}

// ============ Main Types and Functions ============

export type ColorMode = "peak" | "average";

export interface PeakColor {
  /** Hue in degrees (0-360) */
  hue: number;
  /** Chroma (saturation) in OKLCH */
  chroma: number;
  /** Lightness in OKLCH */
  lightness: number;
  /** Weight (sum of bucket values in peak range) */
  weight: number;
  /** CSS color string in oklch() format */
  cssColor: string;
  /** The peak this color was extracted from */
  peak: Peak;
}

export interface ExtractPeakColorsOptions {
  /** Color extraction mode */
  mode: ColorMode;
  /**
   * Threshold for average mode (0-1, default 0)
   * Only include buckets with values >= threshold * peakValue
   */
  threshold?: number;
  /** Maximum number of colors to return (default 5) */
  maxColors?: number;
  /**
   * Minimum CIEDE2000 (Delta E 2000) distance between colors (default 0, no filtering)
   * Colors closer than this will be merged, keeping the one with higher chroma
   * Typical values: 2.3 (just noticeable), 5 (clear difference), 10+ (obvious)
   */
  minDistance?: number;
}

/**
 * Get indices within a peak range (handles wrap-around)
 */
function getPeakIndices(peak: Peak): number[] {
  const indices: number[] = [];
  if (peak.right >= peak.left) {
    for (let i = peak.left; i <= peak.right; i++) {
      indices.push(i);
    }
  } else {
    // Wrap around case (e.g., left=350, right=10)
    for (let i = peak.left; i < 360; i++) {
      indices.push(i);
    }
    for (let i = 0; i <= peak.right; i++) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Calculate total weight of a peak range
 */
function calculatePeakWeight(buckets: number[], peak: Peak): number {
  const indices = getPeakIndices(peak);
  let totalWeight = 0;
  for (const idx of indices) {
    totalWeight += buckets[idx];
  }
  return totalWeight;
}

/**
 * Calculate CIEDE2000 distance between two OKLCH colors
 */
function colorDistance(c1: PeakColor, c2: PeakColor): number {
  const [L1, a1, b1] = oklchToLab(c1.lightness, c1.chroma, c1.hue);
  const [L2, a2, b2] = oklchToLab(c2.lightness, c2.chroma, c2.hue);
  return deltaE2000(L1, a1, b1, L2, a2, b2);
}

/**
 * Filter colors by minimum distance, keeping higher chroma when similar
 */
function filterByDistance(
  colors: PeakColor[],
  minDistance: number
): PeakColor[] {
  if (minDistance <= 0 || colors.length <= 1) return colors;

  const result: PeakColor[] = [];

  for (const color of colors) {
    let shouldAdd = true;
    let replaceIndex = -1;

    for (let i = 0; i < result.length; i++) {
      const dist = colorDistance(color, result[i]);
      if (dist < minDistance) {
        // Colors are too similar
        if (color.chroma > result[i].chroma) {
          // Current color has higher chroma, replace existing
          replaceIndex = i;
        } else {
          // Existing color has higher or equal chroma, skip current
          shouldAdd = false;
        }
        break;
      }
    }

    if (replaceIndex >= 0) {
      result[replaceIndex] = color;
    } else if (shouldAdd) {
      result.push(color);
    }
  }

  return result;
}

/**
 * Extract colors from peaks using either peak or average mode
 * @param histogram - Original HueHistogram with chromaSum/lightnessSum/counts data
 * @param peaks - Detected peaks (from smoothed histogram)
 * @param smoothedBuckets - Smoothed buckets for threshold/weight calculation
 * @param options - Extraction options
 * @returns Array of PeakColor objects sorted by weight, limited to maxColors
 */
export function extractPeakColors(
  histogram: HueHistogram,
  peaks: Peak[],
  smoothedBuckets: number[],
  options: ExtractPeakColorsOptions
): PeakColor[] {
  const { mode, threshold = 0, maxColors = 5, minDistance = 0 } = options;
  const results: PeakColor[] = [];

  for (const peak of peaks) {
    let hue: number;
    let chroma: number;
    let lightness: number;

    // Calculate weight using smoothed buckets
    const weight = calculatePeakWeight(smoothedBuckets, peak);

    if (mode === "peak") {
      // Use peak.index directly
      const count = histogram.counts[peak.index];
      if (count === 0) continue; // Skip if no pixel data at peak position

      hue = peak.index;
      chroma = histogram.chromaSum[peak.index] / count;
      lightness = histogram.lightnessSum[peak.index] / count;
    } else {
      // Average mode: compute weighted average across peak range
      const indices = getPeakIndices(peak);
      let totalWeight = 0;
      let hueX = 0; // For circular mean
      let hueY = 0;
      let chromaWeighted = 0;
      let lightnessWeighted = 0;

      // Calculate threshold value based on smoothed peak's bucket value
      const peakBucketValue = smoothedBuckets[peak.index];
      const minValue = peakBucketValue * threshold;

      for (const idx of indices) {
        const count = histogram.counts[idx];
        if (count === 0) continue;

        const bucketValue = smoothedBuckets[idx];
        // Skip buckets below threshold
        if (bucketValue < minValue) continue;

        // Use smoothed bucket value as weight
        const w = bucketValue;
        // Get actual color data from original histogram
        const avgChroma = histogram.chromaSum[idx] / count;
        const avgLightness = histogram.lightnessSum[idx] / count;

        // Circular mean for hue
        const rad = (idx * Math.PI) / 180;
        hueX += Math.cos(rad) * w;
        hueY += Math.sin(rad) * w;

        chromaWeighted += avgChroma * w;
        lightnessWeighted += avgLightness * w;
        totalWeight += w;
      }

      if (totalWeight <= 0) continue; // Skip peaks with no valid data

      // Compute circular mean hue
      hue = (Math.atan2(hueY, hueX) * 180) / Math.PI;
      if (hue < 0) hue += 360;
      chroma = chromaWeighted / totalWeight;
      lightness = lightnessWeighted / totalWeight;
    }

    // Clamp values
    lightness = Math.max(0, Math.min(1, lightness));
    chroma = Math.max(0, Math.min(0.4, chroma));

    const cssColor = `oklch(${lightness.toFixed(3)} ${chroma.toFixed(
      3
    )} ${hue.toFixed(1)})`;

    results.push({ hue, chroma, lightness, weight, cssColor, peak });
  }

  // Sort by weight descending
  const sorted = results.sort((a, b) => b.weight - a.weight);

  // Filter by distance (keeping higher chroma when similar)
  const filtered = filterByDistance(sorted, minDistance);

  // Limit to maxColors
  return filtered.slice(0, maxColors);
}
