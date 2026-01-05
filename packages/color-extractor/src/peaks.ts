export interface Peak {
  /** Peak position (hue degree) */
  index: number;
  /** Peak value */
  value: number;
  /** Left boundary (hue degree) */
  left: number;
  /** Right boundary (hue degree) */
  right: number;
}

export interface DetectPeaksOptions {
  /** Minimum peak height as ratio of max (0-1, default 0.1) */
  minHeight?: number;
}

/**
 * Detect peaks in a circular histogram
 * @param buckets - Histogram buckets (360 values)
 * @param options - Detection options
 * @returns Array of detected peaks with boundaries
 */
export function detectPeaks(
  buckets: number[],
  options: DetectPeaksOptions = {}
): Peak[] {
  const { minHeight = 0.1 } = options;
  const len = buckets.length;
  const max = Math.max(...buckets);
  const threshold = max * minHeight;

  const peaks: Peak[] = [];

  // Find all local maxima
  for (let i = 0; i < len; i++) {
    const prev = buckets[(i - 1 + len) % len];
    const curr = buckets[i];
    const next = buckets[(i + 1) % len];

    // Is local maximum and above threshold
    if (curr > prev && curr > next && curr >= threshold) {
      peaks.push({
        index: i,
        value: curr,
        left: i,
        right: i,
      });
    }
  }

  // Find boundaries for each peak (descend until valley)
  for (const peak of peaks) {
    // Find left boundary
    let left = peak.index;
    for (let i = 1; i < len / 2; i++) {
      const idx = (peak.index - i + len) % len;
      const curr = buckets[idx];
      const next = buckets[(idx + 1) % len];
      if (curr >= next) {
        // Found valley or plateau
        left = (idx + 1) % len;
        break;
      }
      left = idx;
    }

    // Find right boundary
    let right = peak.index;
    for (let i = 1; i < len / 2; i++) {
      const idx = (peak.index + i) % len;
      const curr = buckets[idx];
      const prev = buckets[(idx - 1 + len) % len];
      if (curr >= prev) {
        // Found valley or plateau
        right = (idx - 1 + len) % len;
        break;
      }
      right = idx;
    }

    peak.left = left;
    peak.right = right;
  }

  // Sort by value descending
  peaks.sort((a, b) => b.value - a.value);

  return peaks;
}
