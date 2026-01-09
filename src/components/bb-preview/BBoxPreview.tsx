import { normalizeDetections } from "@/lib/boundingbox/normalize-detections";
import React, { useEffect } from "react";

export function BBoxPreview(props: { imageUrl: string; detections: any[] }) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = img.clientWidth;
      const h = img.clientHeight;
      canvas.width = w;
      canvas.height = h;

      ctx.clearRect(0, 0, w, h);

      // scale theo kích thước hiển thị
      const natW = img.naturalWidth || w;
      const natH = img.naturalHeight || h;
      const sx = w / natW;
      const sy = h / natH;

      const dets = normalizeDetections(props.detections);

      ctx.font = "20px sans-serif";
      ctx.strokeStyle = "#ff0000";
      ctx.fillStyle = "#ff0000";
      ctx.lineWidth = 3;

      dets.forEach((b) => {
        const x = b.x1 * sx;
        const y = b.y1 * sy;
        const bw = (b.x2 - b.x1) * sx;
        const bh = (b.y2 - b.y1) * sy;
        ctx.strokeRect(x, y, bw, bh);

        const text = `${b.label ?? "obj"}${
          b.confidence != null ? ` ${(b.confidence * 100).toFixed(0)}%` : ""
        }`;
        const tw = ctx.measureText(text).width;
        ctx.clearRect(x, Math.max(0, y - 16), tw + 8, 16);
        ctx.fillText(text, x + 6, y - 6);
      });
    };

    if (img.complete) draw();
    img.onload = draw;

    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [props.imageUrl, props.detections]);

  return (
    <div className="relative w-full">
      <img
        ref={imgRef}
        src={props.imageUrl}
        alt="preview"
        className="w-full rounded-[2px] border border-secondary-200"
      />
      <canvas
        ref={canvasRef}
        className="absolute left-0 top-0 pointer-events-none"
      />
    </div>
  );
}