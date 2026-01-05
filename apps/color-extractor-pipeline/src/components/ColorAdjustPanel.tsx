import { useMemo } from "react";
import type { PeakColor } from "@image-color/color-extractor";
import { NumberInput } from "./NumberInput";

export interface ColorAdjustment {
  /** Hue offset in degrees (-180 to 180) */
  hue: number;
  /** Saturation adjustment (-1 to 1) */
  saturation: number;
  /** Lightness adjustment (-1 to 1) */
  lightness: number;
}

export interface ColorAdjustments {
  [colorIndex: number]: ColorAdjustment;
}

interface ColorAdjustPanelProps {
  colors: PeakColor[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  adjustments: ColorAdjustments;
  onAdjustmentChange: (index: number, adjustment: ColorAdjustment) => void;
}

const DEFAULT_ADJUSTMENT: ColorAdjustment = {
  hue: 0,
  saturation: 0,
  lightness: 0,
};

export function ColorAdjustPanel({
  colors,
  selectedIndex,
  onSelectIndex,
  adjustments,
  onAdjustmentChange,
}: ColorAdjustPanelProps) {
  const selectedColor = colors[selectedIndex];
  const currentAdjustment = adjustments[selectedIndex] ?? DEFAULT_ADJUSTMENT;

  // Generate hue gradient based on selected color
  const hueGradient = useMemo(() => {
    if (!selectedColor) return "";
    const L = selectedColor.lightness;
    const C = selectedColor.chroma;
    const stops: string[] = [];
    for (let i = 0; i <= 360; i += 30) {
      stops.push(`oklch(${L} ${C} ${i})`);
    }
    return `linear-gradient(to right, ${stops.join(", ")})`;
  }, [selectedColor]);

  // Generate saturation gradient
  const saturationGradient = useMemo(() => {
    if (!selectedColor) return "";
    const L = selectedColor.lightness;
    const H = selectedColor.hue;
    return `linear-gradient(to right, oklch(${L} 0 ${H}), oklch(${L} 0.4 ${H}))`;
  }, [selectedColor]);

  // Generate lightness gradient
  const lightnessGradient = useMemo(() => {
    if (!selectedColor) return "";
    const C = selectedColor.chroma;
    const H = selectedColor.hue;
    return `linear-gradient(to right, oklch(0.2 ${C} ${H}), oklch(0.9 ${C} ${H}))`;
  }, [selectedColor]);

  const handleChange = (key: keyof ColorAdjustment, value: number) => {
    onAdjustmentChange(selectedIndex, {
      ...currentAdjustment,
      [key]: value,
    });
  };

  const handleReset = () => {
    onAdjustmentChange(selectedIndex, DEFAULT_ADJUSTMENT);
  };

  const hasAdjustment =
    currentAdjustment.hue !== 0 ||
    currentAdjustment.saturation !== 0 ||
    currentAdjustment.lightness !== 0;

  if (colors.length === 0) {
    return <div className="text-center text-gray-400 py-8">暂无提取颜色</div>;
  }

  return (
    <div className="space-y-4">
      {/* Color Selection */}
      <div className="flex items-center justify-between">
        <span className="text-gray-600 text-sm">选择颜色</span>
        <div className="flex gap-2">
          {colors.map((color, index) => (
            <button
              key={index}
              onClick={() => onSelectIndex(index)}
              className={`w-8 h-8 rounded-full transition-all ${
                selectedIndex === index
                  ? "ring-2 ring-violet-500 ring-offset-2 scale-110"
                  : "hover:scale-105"
              }`}
              style={{ backgroundColor: color.cssColor }}
              title={`H: ${color.hue.toFixed(0)}° C: ${color.chroma.toFixed(
                2
              )} L: ${color.lightness.toFixed(2)}`}
            />
          ))}
        </div>
      </div>

      {/* Adjustment Inputs with Sliders */}
      {selectedColor && (
        <>
          {/* Hue */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">色相偏移</span>
              <NumberInput
                value={currentAdjustment.hue}
                onChange={(v) => handleChange("hue", v)}
                min={-180}
                suffix="°"
                className="w-16"
              />
            </div>
            <div className="relative h-3">
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: hueGradient }}
              />
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={currentAdjustment.hue}
                onChange={(e) => handleChange("hue", Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow border border-gray-300 pointer-events-none"
                style={{
                  left: `calc(${
                    ((currentAdjustment.hue + 180) / 360) * 100
                  }% - 8px)`,
                }}
              />
            </div>
          </div>

          {/* Saturation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">饱和度</span>
              <NumberInput
                value={Math.round(currentAdjustment.saturation * 100)}
                onChange={(v) => handleChange("saturation", v / 100)}
                min={-100}
                suffix="%"
                className="w-16"
              />
            </div>
            <div className="relative h-3">
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: saturationGradient }}
              />
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={currentAdjustment.saturation * 100}
                onChange={(e) =>
                  handleChange("saturation", Number(e.target.value) / 100)
                }
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow border border-gray-300 pointer-events-none"
                style={{
                  left: `calc(${
                    ((currentAdjustment.saturation + 1) / 2) * 100
                  }% - 8px)`,
                }}
              />
            </div>
          </div>

          {/* Lightness */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">亮度</span>
              <NumberInput
                value={Math.round(currentAdjustment.lightness * 100)}
                onChange={(v) => handleChange("lightness", v / 100)}
                min={-100}
                suffix="%"
                className="w-16"
              />
            </div>
            <div className="relative h-3">
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: lightnessGradient }}
              />
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={currentAdjustment.lightness * 100}
                onChange={(e) =>
                  handleChange("lightness", Number(e.target.value) / 100)
                }
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow border border-gray-300 pointer-events-none"
                style={{
                  left: `calc(${
                    ((currentAdjustment.lightness + 1) / 2) * 100
                  }% - 8px)`,
                }}
              />
            </div>
          </div>

          {/* Preview and Reset */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <span className="text-gray-600 text-sm">预览</span>
              <div className="flex gap-2 items-center">
                <div
                  className="w-8 h-8 rounded-full border border-gray-200"
                  style={{ backgroundColor: selectedColor.cssColor }}
                  title="原色"
                />
                <span className="text-gray-400">→</span>
                <div
                  className="w-8 h-8 rounded-full border border-gray-200"
                  style={{
                    backgroundColor: `oklch(${Math.max(
                      0,
                      Math.min(
                        1,
                        selectedColor.lightness +
                          currentAdjustment.lightness * 0.5
                      )
                    )} ${Math.max(
                      0,
                      Math.min(
                        0.4,
                        selectedColor.chroma *
                          (1 + currentAdjustment.saturation)
                      )
                    )} ${
                      (selectedColor.hue + currentAdjustment.hue + 360) % 360
                    })`,
                  }}
                  title="调整后"
                />
              </div>
            </div>
            <button
              onClick={handleReset}
              disabled={!hasAdjustment}
              className={`px-3 py-1 text-sm rounded-full transition-all ${
                hasAdjustment
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : "bg-gray-50 text-gray-300 cursor-not-allowed"
              }`}
            >
              重置
            </button>
          </div>
        </>
      )}
    </div>
  );
}
