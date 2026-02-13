import { useCallback, useRef } from "react";

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Scheme } from "../model";

interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

interface UsePreviewControlsOptions {
  activeScheme: Scheme | null;
  isPanMode: boolean;
  viewport: ViewportState;
  previewCanvasRef: RefObject<HTMLDivElement | null>;
  scheduleFitPreview: (
    canvasRef: RefObject<HTMLDivElement | null>,
    schemeId?: string | null,
  ) => void;
  setViewport: Dispatch<SetStateAction<ViewportState>>;
  setIsPanMode: Dispatch<SetStateAction<boolean>>;
}

export const usePreviewControls = ({
  activeScheme,
  isPanMode,
  viewport,
  previewCanvasRef,
  scheduleFitPreview,
  setViewport,
  setIsPanMode,
}: UsePreviewControlsOptions) => {
  const panStartRef = useRef<{
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);

  const handleZoomIn = useCallback(() => {
    setViewport((prev) => ({ ...prev, zoom: Math.min(2.5, prev.zoom + 0.1) }));
  }, [setViewport]);

  const handleZoomOut = useCallback(() => {
    setViewport((prev) => ({ ...prev, zoom: Math.max(0.1, prev.zoom - 0.1) }));
  }, [setViewport]);

  const handleResetZoom = useCallback(() => {
    setViewport((prev) => ({ ...prev, x: 0, y: 0, zoom: 1 }));
    panStartRef.current = null;
  }, [setViewport]);

  const handleTogglePanMode = useCallback(() => {
    setIsPanMode((prev) => !prev);
    panStartRef.current = null;
  }, [setIsPanMode]);

  const handleFitCanvas = useCallback(() => {
    panStartRef.current = null;
    if (activeScheme) {
      scheduleFitPreview(previewCanvasRef, activeScheme.id);
      return;
    }
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, [activeScheme, previewCanvasRef, scheduleFitPreview, setViewport]);

  const handlePreviewPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanMode) {
        return;
      }
      e.preventDefault();
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        originX: viewport.x,
        originY: viewport.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [isPanMode, viewport.x, viewport.y],
  );

  const handlePreviewPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanMode || !panStartRef.current) {
        return;
      }
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setViewport((prev) => ({
        ...prev,
        x: panStartRef.current ? panStartRef.current.originX + dx : prev.x,
        y: panStartRef.current ? panStartRef.current.originY + dy : prev.y,
      }));
    },
    [isPanMode, setViewport],
  );

  const handlePreviewPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      panStartRef.current = null;
    },
    [],
  );

  const handlePreviewWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!e.ctrlKey && !e.metaKey) {
        return;
      }
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.06 : 0.06;
      setViewport((prev) => ({
        ...prev,
        zoom: Math.max(0.1, Math.min(2.5, prev.zoom + delta)),
      }));
    },
    [setViewport],
  );

  return {
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleTogglePanMode,
    handleFitCanvas,
    handlePreviewPointerDown,
    handlePreviewPointerMove,
    handlePreviewPointerUp,
    handlePreviewWheel,
  };
};
