interface AdjustedImagePreviewProps {
  canvasRef: (canvas: HTMLCanvasElement | null) => void;
  hasImage: boolean;
  dimensions: { width: number; height: number } | null;
}

export function AdjustedImagePreview({
  canvasRef,
  hasImage,
  dimensions,
}: AdjustedImagePreviewProps) {
  return (
    <div className="relative aspect-[4/3] rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
      {hasImage ? (
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain"
          style={{
            width: dimensions ? dimensions.width : "auto",
            height: dimensions ? dimensions.height : "auto",
          }}
        />
      ) : (
        <p className="text-gray-400 text-sm">等待图片处理...</p>
      )}
      {dimensions && (
        <p className="absolute bottom-2 text-xs text-gray-400 text-center">
          {dimensions.width} × {dimensions.height} px
        </p>
      )}
    </div>
  );
}
