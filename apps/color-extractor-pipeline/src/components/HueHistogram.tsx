import type { Peak } from "@image-color/color-extractor";

interface HistogramData {
  buckets: number[];
  max: number;
}

interface HueHistogramProps {
  histogram: HistogramData | null;
  peaks?: Peak[];
}

export function HueHistogram({ histogram, peaks }: HueHistogramProps) {
  if (!histogram) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
        等待处理...
      </div>
    );
  }

  const { buckets, max } = histogram;
  const width = 360;
  const height = 100;

  // Calculate peak range width (handle wrap-around)
  const getPeakWidth = (peak: Peak) => {
    if (peak.right >= peak.left) {
      return peak.right - peak.left + 1;
    }
    // Wrap around case (e.g., left=350, right=10)
    return 360 - peak.left + peak.right + 1;
  };

  return (
    <div className="space-y-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-32"
        preserveAspectRatio="none"
      >
        {/* Peak range backgrounds */}
        {peaks?.map((peak, i) => {
          const peakWidth = getPeakWidth(peak);
          if (peak.right >= peak.left) {
            // Normal case
            return (
              <rect
                key={i}
                x={peak.left}
                y={0}
                width={peakWidth}
                height={height}
                fill={`oklch(0.9 0.05 ${peak.index})`}
              />
            );
          } else {
            // Wrap around case - draw two rects
            return (
              <g key={i}>
                <rect
                  x={peak.left}
                  y={0}
                  width={360 - peak.left}
                  height={height}
                  fill={`oklch(0.9 0.05 ${peak.index})`}
                />
                <rect
                  x={0}
                  y={0}
                  width={peak.right + 1}
                  height={height}
                  fill={`oklch(0.9 0.05 ${peak.index})`}
                />
              </g>
            );
          }
        })}

        {/* Histogram bars */}
        {buckets.map((count, hue) => {
          const barHeight = max > 0 ? (count / max) * height : 0;
          return (
            <rect
              key={hue}
              x={hue}
              y={height - barHeight}
              width={1}
              height={barHeight}
              fill={`oklch(0.7 0.15 ${hue})`}
            />
          );
        })}

        {/* Peak markers */}
        {peaks?.map((peak, i) => (
          <line
            key={i}
            x1={peak.index}
            y1={0}
            x2={peak.index}
            y2={height}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        ))}
      </svg>

      {/* Hue gradient bar */}
      <svg
        viewBox="0 0 360 12"
        className="w-full h-3"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="hueGradient">
            {[0, 60, 120, 180, 240, 300, 360].map((hue) => (
              <stop
                key={hue}
                offset={`${(hue / 360) * 100}%`}
                stopColor={`oklch(0.7 0.15 ${hue})`}
              />
            ))}
          </linearGradient>
        </defs>
        <rect
          x="0"
          y="0"
          width="360"
          height="12"
          fill="url(#hueGradient)"
          rx="2"
        />
      </svg>

      {/* Degree labels */}
      <div className="flex justify-between text-xs text-gray-400">
        <span>0°</span>
        <span>90°</span>
        <span>180°</span>
        <span>270°</span>
        <span>360°</span>
      </div>
    </div>
  );
}
