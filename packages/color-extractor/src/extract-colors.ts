import { extractHueHistogram, type HistogramWeightMode } from "./hue-histogram";
import { gaussianSmoothHistogram } from "./gaussian";
import { detectPeaks } from "./peaks";
import {
  extractPeakColors,
  type ColorMode,
  type PeakColor,
} from "./extract-peak-colors";

export interface ExtractColorsOptions {
  /** Downsample size (default 256) */
  size?: number;
  /** Saturation threshold for histogram weight (default 0.1) */
  satThreshold?: number;
  /** Histogram weight mode (default "chroma") */
  weightMode?: HistogramWeightMode;
  /** Lightness margin to filter extreme values (default 0.1) */
  lightnessMargin?: number;
  /** Gaussian smooth sigma (default 2) */
  sigma?: number;
  /** Minimum peak height ratio (default 0.005) */
  minHeight?: number;
  /** Color extraction mode (default "average") */
  colorMode?: ColorMode;
  /** Peak detection threshold (default 0.2) */
  threshold?: number;
  /** Maximum number of colors to extract (default 5) */
  maxColors?: number;
  /** Minimum hue distance between colors (default 10) */
  minDistance?: number;
}

/**
 * Load image from URL and return ImageData
 */
async function loadImageData(url: string, size: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      // Calculate scaled dimensions
      const scale = Math.min(size / img.width, size / img.height, 1);
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      // Create canvas and draw scaled image
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Enable image smoothing for better downsampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      resolve(imageData);
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`));
    };

    img.src = url;
  });
}

/**
 * Extract dominant colors from an image URL
 * @param url - Image URL
 * @param options - Extraction options
 * @returns Array of extracted peak colors
 */
export async function extractColors(
  url: string,
  options: ExtractColorsOptions = {}
): Promise<PeakColor[]> {
  const {
    size = 256,
    satThreshold = 0.1,
    weightMode = "chroma",
    lightnessMargin = 0.1,
    sigma = 2,
    minHeight = 0.005,
    colorMode = "average",
    threshold = 0.2,
    maxColors = 5,
    minDistance = 10,
  } = options;

  // Load and downsample image
  const imageData = await loadImageData(url, size);

  // Extract hue histogram
  const histogram = extractHueHistogram(imageData, {
    satThreshold,
    weightMode,
    lightnessMargin,
  });

  // Smooth histogram
  const smoothedBuckets = gaussianSmoothHistogram(histogram.buckets, sigma);

  // Detect peaks
  const peaks = detectPeaks(smoothedBuckets, {
    minHeight,
  });

  // Extract peak colors
  const peakColors = extractPeakColors(histogram, peaks, smoothedBuckets, {
    mode: colorMode,
    threshold,
    maxColors,
    minDistance,
  });

  return peakColors;
}
