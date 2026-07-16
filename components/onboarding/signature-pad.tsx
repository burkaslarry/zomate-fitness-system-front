"use client";

/**
 * [F001][S004]
 * Feature: Student Onboarding
 * Step: Resize-safe electronic signature canvas
 * Logic: Preserve stroke data via toData/fromData on container resize; clear only on explicit user action.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties
} from "react";
import SignatureCanvas from "react-signature-canvas";

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  getDataUrl: () => string;
};

type Props = {
  onChange?: (dataUrl: string) => void;
  height?: number;
  className?: string;
};

type StrokePoint = { x: number; y: number; time: number };
type StrokeData = StrokePoint[][];

const CANVAS_HEIGHT = 160;

export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { onChange, height = CANVAS_HEIGHT, className },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sigRef = useRef<SignatureCanvas | null>(null);
  const strokeDataRef = useRef<StrokeData>([]);
  const [hasStroke, setHasStroke] = useState(false);

  const syncFromCanvas = useCallback(() => {
    const sig = sigRef.current;
    if (!sig) return;
    if (sig.isEmpty()) {
      strokeDataRef.current = [];
      setHasStroke(false);
      onChange?.("");
      return;
    }
    strokeDataRef.current = sig.toData() as StrokeData;
    setHasStroke(strokeDataRef.current.length > 0);
    const dataUrl = sig.getTrimmedCanvas().toDataURL("image/png");
    onChange?.(dataUrl);
  }, [onChange]);

  const applyCanvasDimensions = useCallback(() => {
    const sig = sigRef.current;
    const container = containerRef.current;
    if (!sig || !container) return;
    const width = Math.max(container.clientWidth, 1);
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const pad = sig.getCanvas();
    pad.width = Math.floor(width * ratio);
    pad.height = Math.floor(height * ratio);
    pad.style.width = `${width}px`;
    pad.style.height = `${height}px`;
    const ctx = pad.getContext("2d");
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);
    }
  }, [height]);

  const restoreStrokes = useCallback(
    (data: StrokeData) => {
      const sig = sigRef.current;
      if (!sig) return;
      sig.clear();
      if (data.length > 0) {
        sig.fromData(data as Parameters<SignatureCanvas["fromData"]>[0]);
      }
      syncFromCanvas();
    },
    [syncFromCanvas]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onResize = () => {
      const saved = (sigRef.current?.toData() as StrokeData | undefined) ?? strokeDataRef.current;
      applyCanvasDimensions();
      if (saved.length > 0) {
        strokeDataRef.current = saved;
        restoreStrokes(saved);
      }
    };

    applyCanvasDimensions();
    const ro = new ResizeObserver(() => onResize());
    ro.observe(container);
    window.addEventListener("orientationchange", onResize);
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __zomateSeedSignature?: () => void }).__zomateSeedSignature = () => {
        const sig = sigRef.current;
        if (!sig) throw new Error("Signature canvas not ready");
        const sampleStrokes: StrokeData = [
          [
            { x: 20, y: 20, time: Date.now() },
            { x: 120, y: 80, time: Date.now() + 16 }
          ]
        ];
        sig.fromData(sampleStrokes as Parameters<SignatureCanvas["fromData"]>[0]);
        strokeDataRef.current = sampleStrokes;
        setHasStroke(true);
        if (!sig.isEmpty()) {
          onChange?.(sig.getTrimmedCanvas().toDataURL("image/png"));
        }
      };
    }
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", onResize);
      if (process.env.NODE_ENV !== "production") {
        delete (window as unknown as { __zomateSeedSignature?: () => void }).__zomateSeedSignature;
      }
    };
  }, [applyCanvasDimensions, restoreStrokes, syncFromCanvas]);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        strokeDataRef.current = [];
        setHasStroke(false);
        sigRef.current?.clear();
        onChange?.("");
      },
      isEmpty: () => {
        if (strokeDataRef.current.length > 0) return false;
        return sigRef.current?.isEmpty() ?? true;
      },
      getDataUrl: () => {
        if (sigRef.current?.isEmpty()) return "";
        return sigRef.current?.getTrimmedCanvas().toDataURL("image/png") ?? "";
      }
    }),
    [onChange]
  );

  const containerStyle: CSSProperties = { height: `${height}px` };

  return (
    <div
      ref={containerRef}
      className={className ?? "w-full"}
      style={containerStyle}
      data-signature-has-stroke={hasStroke ? "true" : "false"}
    >
      <SignatureCanvas
        ref={sigRef}
        penColor="#2d2422"
        onEnd={syncFromCanvas}
        canvasProps={{
          className: "touch-none",
          style: { width: "100%", height: "100%", display: "block" },
          "aria-label": "電子簽署手寫區"
        }}
      />
    </div>
  );
});
