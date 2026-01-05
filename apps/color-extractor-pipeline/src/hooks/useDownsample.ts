import { useState, useEffect } from "react";

export type DownsampleSize = "full" | 128 | 256 | 512;

interface UseDownsampleOptions {
  image: HTMLImageElement | null;
  size: DownsampleSize;
  smooth: boolean;
}

export function useDownsample({ image, size, smooth }: UseDownsampleOptions) {
  const [result, setResult] = useState<string | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!image) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(null);
      setImageData(null);
      setDimensions(null);
      return;
    }

    let targetWidth: number;
    let targetHeight: number;

    if (size === "full") {
      targetWidth = image.width;
      targetHeight = image.height;
    } else {
      const scale = Math.min(1, size / image.width, size / image.height);
      targetWidth = Math.round(image.width * scale);
      targetHeight = Math.round(image.height * scale);
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.imageSmoothingEnabled = smooth;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    setResult(canvas.toDataURL());
    setImageData(ctx.getImageData(0, 0, targetWidth, targetHeight));
    setDimensions({ width: targetWidth, height: targetHeight });
  }, [image, size, smooth]);

  return { result, imageData, dimensions };
}
