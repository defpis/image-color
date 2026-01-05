/**
 * Generate Gaussian kernel
 * @param sigma - Standard deviation
 * @returns Kernel array (odd length, centered)
 */
function generateGaussianKernel(sigma: number): number[] {
  const radius = Math.ceil(sigma * 3);
  const size = radius * 2 + 1;
  const kernel: number[] = [];
  let sum = 0;

  for (let i = 0; i < size; i++) {
    const x = i - radius;
    const value = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel.push(value);
    sum += value;
  }

  // Normalize
  return kernel.map((v) => v / sum);
}

/**
 * Apply Gaussian smoothing to a circular histogram (wraps around)
 * @param buckets - Input histogram buckets
 * @param sigma - Gaussian sigma (standard deviation)
 * @returns Smoothed buckets
 */
export function gaussianSmoothHistogram(
  buckets: number[],
  sigma: number
): number[] {
  if (sigma <= 0) return [...buckets];

  const kernel = generateGaussianKernel(sigma);
  const radius = Math.floor(kernel.length / 2);
  const len = buckets.length;
  const result: number[] = new Array(len).fill(0);

  for (let i = 0; i < len; i++) {
    let sum = 0;
    for (let k = 0; k < kernel.length; k++) {
      // Circular wrap for hue (0-359 wraps to 360 = 0)
      const idx = (i + k - radius + len) % len;
      sum += buckets[idx] * kernel[k];
    }
    result[i] = sum;
  }

  return result;
}

