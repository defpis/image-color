import type { PeakColor } from "@image-color/color-extractor";

interface PeakColorListProps {
  colors: PeakColor[];
}

export function PeakColorList({ colors }: PeakColorListProps) {
  if (colors.length === 0) {
    return (
      <div className="text-gray-400 text-sm text-center py-4">暂无颜色数据</div>
    );
  }

  // Calculate total weight for percentage
  const totalWeight = colors.reduce((sum, c) => sum + c.weight, 0);

  return (
    <div className="space-y-3">
      {colors.map((color, index) => {
        const percentage =
          totalWeight > 0 ? (color.weight / totalWeight) * 100 : 0;
        return (
          <div
            key={index}
            className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-200"
          >
            <div
              className="w-12 h-12 rounded-lg shadow-inner flex-shrink-0"
              style={{ backgroundColor: color.cssColor }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  色相 {color.hue.toFixed(0)}°
                </span>
                <span className="text-xs text-gray-400">
                  ({color.peak.left}° ~ {color.peak.right}°)
                </span>
                <span className="text-xs text-violet-500 font-medium">
                  {percentage.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-gray-500 font-mono mt-1">
                L: {color.lightness.toFixed(2)} C: {color.chroma.toFixed(3)}
              </div>
            </div>
            <code className="text-xs text-gray-400 font-mono hidden sm:block">
              {color.cssColor}
            </code>
          </div>
        );
      })}
    </div>
  );
}
