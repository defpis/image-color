import { useState } from "react";
import {
  StepCard,
  ParamCard,
  Arrow,
  Toggle,
  NumberInput,
  ImageUpload,
  HueHistogram,
  PeakColorList,
  ColorAdjustPanel,
  AdjustedImagePreview,
  type ColorAdjustments,
  type ColorAdjustment,
} from "./components";
import { useDownsample, type DownsampleSize } from "./hooks/useDownsample";
import { useHueHistogram } from "./hooks/useHueHistogram";
import { useSmoothedHistogram } from "./hooks/useSmoothedHistogram";
import { usePeaks } from "./hooks/usePeaks";
import { usePeakColors } from "./hooks/usePeakColors";
import { useColorAdjustWebGL } from "./hooks/useColorAdjustWebGL";
import type {
  ColorMode,
  HistogramWeightMode,
} from "@image-color/color-extractor";

const SIZE_OPTIONS: DownsampleSize[] = ["full", 128, 256, 512];
const COLOR_MODE_OPTIONS: { value: ColorMode; label: string }[] = [
  { value: "peak", label: "峰值颜色" },
  { value: "average", label: "平均颜色" },
];
const WEIGHT_MODE_OPTIONS: { value: HistogramWeightMode; label: string }[] = [
  { value: "count", label: "计数" },
  { value: "chroma", label: "色度" },
  { value: "chromaLightness", label: "色度亮度" },
];

interface DownsampleParams {
  size: DownsampleSize;
  smooth: boolean;
}

interface HistogramParams {
  minChroma: number;
  weightMode: HistogramWeightMode;
  lightnessMargin: number;
}

interface SmoothParams {
  sigma: number;
}

interface PeakParams {
  minHeight: number;
}

interface ColorExtractionParams {
  colorMode: ColorMode;
  threshold: number;
  maxColors: number;
  minDistance: number;
}

function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [downsampleParams, setDownsampleParams] = useState<DownsampleParams>({
    size: 256,
    smooth: false,
  });
  const [histogramParams, setHistogramParams] = useState<HistogramParams>({
    minChroma: 0.02,
    weightMode: "chroma",
    lightnessMargin: 0.1,
  });
  const [smoothParams, setSmoothParams] = useState<SmoothParams>({
    sigma: 2,
  });
  const [peakParams, setPeakParams] = useState<PeakParams>({
    minHeight: 0.005,
  });
  const [colorExtractionParams, setColorExtractionParams] =
    useState<ColorExtractionParams>({
      colorMode: "average",
      threshold: 0.2,
      maxColors: 5,
      minDistance: 10,
    });
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [colorAdjustments, setColorAdjustments] = useState<ColorAdjustments>(
    {}
  );

  const handleAdjustmentChange = (
    index: number,
    adjustment: ColorAdjustment
  ) => {
    setColorAdjustments((prev) => ({
      ...prev,
      [index]: adjustment,
    }));
  };

  const { result, imageData, dimensions } = useDownsample({
    image,
    ...downsampleParams,
  });

  // Original histogram with chromaSum/lightnessSum/counts
  const histogram = useHueHistogram({
    imageData,
    ...histogramParams,
  });

  // Smoothed histogram data (only buckets and max)
  const smoothedHistogram = useSmoothedHistogram({
    histogram,
    ...smoothParams,
  });

  // Detect peaks from smoothed histogram
  const peaks = usePeaks({
    smoothedHistogram,
    minHeight: peakParams.minHeight,
  });

  // Extract colors: use original histogram for color data, smoothed buckets for threshold
  const peakColors = usePeakColors({
    histogram,
    smoothedBuckets: smoothedHistogram?.buckets ?? null,
    peaks,
    mode: colorExtractionParams.colorMode,
    threshold:
      colorExtractionParams.colorMode === "average"
        ? colorExtractionParams.threshold
        : 0,
    maxColors: colorExtractionParams.maxColors,
    minDistance: colorExtractionParams.minDistance,
  });

  // WebGL color adjustment
  const { canvasRef: adjustedCanvasRef, dimensions: adjustedDimensions } =
    useColorAdjustWebGL({
      image,
      peakColors,
      adjustments: colorAdjustments,
      satThreshold: histogramParams.minChroma,
    });

  return (
    <div className="min-h-screen bg-gray-50 font-[system-ui]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4">
        <h1 className="text-2xl font-bold">
          <span className="text-orange-500">Color</span>
          <span className="text-violet-600">Adjust</span>
        </h1>
      </header>

      {/* Main Pipeline */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex flex-col items-center">
          {/* Step 0: Image Upload */}
          <StepCard step={0} title="图片上传" dotColor="bg-blue-500">
            <ImageUpload image={image} onImageChange={setImage} />
          </StepCard>

          <Arrow />

          {/* Downsample Parameters */}
          <ParamCard title="降采样参数" dotColor="bg-amber-400">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">尺寸</span>
                <div className="flex gap-2">
                  {SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      onClick={() =>
                        setDownsampleParams((p) => ({ ...p, size }))
                      }
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all
                        ${
                          downsampleParams.size === size
                            ? "bg-violet-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                      {size === "full" ? "全图" : size}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">平滑</span>
                <Toggle
                  checked={downsampleParams.smooth}
                  onChange={(smooth) =>
                    setDownsampleParams((p) => ({ ...p, smooth }))
                  }
                />
              </div>
            </div>
          </ParamCard>

          <Arrow />

          {/* Step 1: Downsample Result */}
          <StepCard step={1} title="降采样结果" dotColor="bg-emerald-500">
            <div className="aspect-[4/3] rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
              {result ? (
                <img
                  src={result}
                  alt="Downsampled"
                  className="w-full h-full object-contain"
                  style={{
                    imageRendering: downsampleParams.smooth
                      ? "auto"
                      : "pixelated",
                  }}
                />
              ) : (
                <p className="text-gray-400 text-sm">等待上传图片...</p>
              )}
            </div>
            {dimensions && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                {dimensions.width} × {dimensions.height} px
              </p>
            )}
          </StepCard>

          <Arrow />

          {/* Histogram Parameters */}
          <ParamCard title="直方图参数" dotColor="bg-amber-400">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">最小色度</span>
                <NumberInput
                  value={histogramParams.minChroma}
                  onChange={(minChroma) =>
                    setHistogramParams((p) => ({ ...p, minChroma }))
                  }
                  className="w-20"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">亮度边距</span>
                <NumberInput
                  value={histogramParams.lightnessMargin}
                  onChange={(lightnessMargin) =>
                    setHistogramParams((p) => ({
                      ...p,
                      lightnessMargin: Math.max(
                        0,
                        Math.min(0.5, lightnessMargin)
                      ),
                    }))
                  }
                  className="w-20"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">权重模式</span>
                <div className="flex gap-2">
                  {WEIGHT_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() =>
                        setHistogramParams((p) => ({
                          ...p,
                          weightMode: option.value,
                        }))
                      }
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all
                        ${
                          histogramParams.weightMode === option.value
                            ? "bg-violet-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ParamCard>

          <Arrow />

          {/* Step 2: Hue Histogram */}
          <StepCard step={2} title="色相直方图" dotColor="bg-violet-500">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <HueHistogram histogram={histogram} />
            </div>
            {histogram && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                总权重: {histogram.total.toFixed(2)}
              </p>
            )}
          </StepCard>

          <Arrow />

          {/* Smooth Parameters */}
          <ParamCard title="平滑参数" dotColor="bg-amber-400">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Sigma</span>
              <NumberInput
                value={smoothParams.sigma}
                onChange={(sigma) => setSmoothParams((p) => ({ ...p, sigma }))}
                className="w-20"
              />
            </div>
          </ParamCard>

          <Arrow />

          {/* Step 3: Smoothed Histogram */}
          <StepCard step={3} title="平滑直方图" dotColor="bg-pink-500">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <HueHistogram histogram={smoothedHistogram} />
            </div>
          </StepCard>

          <Arrow />

          {/* Peak Detection Parameters */}
          <ParamCard title="波峰检测参数" dotColor="bg-amber-400">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">最小高度</span>
              <NumberInput
                value={peakParams.minHeight * 100}
                onChange={(v) =>
                  setPeakParams((p) => ({ ...p, minHeight: v / 100 }))
                }
                suffix="%"
                className="w-16"
              />
            </div>
          </ParamCard>

          <Arrow />

          {/* Step 4: Peak Detection */}
          <StepCard step={4} title="波峰检测" dotColor="bg-rose-500">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <HueHistogram histogram={smoothedHistogram} peaks={peaks} />
            </div>
            {peaks.length > 0 && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                检测到 {peaks.length} 个波峰
              </p>
            )}
          </StepCard>

          <Arrow />

          {/* Color Extraction Parameters */}
          <ParamCard title="颜色提取参数" dotColor="bg-amber-400">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">最大数量</span>
                <NumberInput
                  value={colorExtractionParams.maxColors}
                  onChange={(maxColors) =>
                    setColorExtractionParams((p) => ({
                      ...p,
                      maxColors: Math.max(1, Math.floor(maxColors)),
                    }))
                  }
                  className="w-16"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">最小距离</span>
                <NumberInput
                  value={colorExtractionParams.minDistance}
                  onChange={(minDistance) =>
                    setColorExtractionParams((p) => ({
                      ...p,
                      minDistance: Math.max(0, minDistance),
                    }))
                  }
                  className="w-20"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">颜色模式</span>
                <div className="flex gap-2">
                  {COLOR_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() =>
                        setColorExtractionParams((p) => ({
                          ...p,
                          colorMode: option.value,
                        }))
                      }
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all
                        ${
                          colorExtractionParams.colorMode === option.value
                            ? "bg-violet-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {colorExtractionParams.colorMode === "average" && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">提取阈值</span>
                  <NumberInput
                    value={colorExtractionParams.threshold * 100}
                    onChange={(v) =>
                      setColorExtractionParams((p) => ({
                        ...p,
                        threshold: v / 100,
                      }))
                    }
                    suffix="%"
                    className="w-16"
                  />
                </div>
              )}
            </div>
          </ParamCard>

          <Arrow />

          {/* Step 5: Extracted Colors */}
          <StepCard step={5} title="提取颜色" dotColor="bg-cyan-500">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <PeakColorList colors={peakColors} />
            </div>
          </StepCard>

          <Arrow />

          <ParamCard title="颜色调整" dotColor="bg-indigo-500">
            <ColorAdjustPanel
              colors={peakColors}
              selectedIndex={selectedColorIndex}
              onSelectIndex={setSelectedColorIndex}
              adjustments={colorAdjustments}
              onAdjustmentChange={handleAdjustmentChange}
            />
          </ParamCard>

          <Arrow />

          {/* Step 6: Adjusted Image Output */}
          <StepCard step={6} title="调整输出" dotColor="bg-teal-500">
            <AdjustedImagePreview
              canvasRef={adjustedCanvasRef}
              hasImage={!!image}
              dimensions={adjustedDimensions}
            />
          </StepCard>
        </div>
      </main>
    </div>
  );
}

export default App;
