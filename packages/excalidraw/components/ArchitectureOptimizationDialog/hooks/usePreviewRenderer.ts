import { useCallback, useEffect, useRef, useState } from "react";

import { getCommonBounds, isNonDeletedElement } from "@excalidraw/element";

import { exportToSvg } from "../../../scene/export";
import { sanitizeMermaidDefinition } from "../../../services/aiService";
import { convertMermaidToExcalidraw } from "../../TTDDialog/common";

import type { Dispatch, SetStateAction } from "react";
import type { ExcalidrawElement, NonDeletedExcalidrawElement, Theme } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "../../../types";
import type { MermaidToExcalidrawLibProps } from "../../TTDDialog/types";
import type { Scheme } from "../model";

interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

interface UsePreviewRendererOptions {
  activeScheme: Scheme | null;
  elements: readonly ExcalidrawElement[];
  isPreviewPage: boolean;
  isCompareMode: boolean;
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
  theme: Theme;
  viewBackgroundColor: string;
  frameRendering: AppState["frameRendering"];
  setViewport: Dispatch<SetStateAction<ViewportState>>;
  setRenderingSchemeIds: Dispatch<SetStateAction<string[]>>;
}

export const usePreviewRenderer = ({
  activeScheme,
  elements,
  isPreviewPage,
  isCompareMode,
  mermaidToExcalidrawLib,
  theme,
  viewBackgroundColor,
  frameRendering,
  setViewport,
  setRenderingSchemeIds,
}: UsePreviewRendererOptions) => {
  const previewCanvasRef = useRef<HTMLDivElement>(null);
  const originalPreviewCanvasRef = useRef<HTMLDivElement>(null);
  const previewRetryRef = useRef(0);
  const schemeDataRefs = useRef<
    Record<
      string,
      React.MutableRefObject<{
        elements: readonly NonDeletedExcalidrawElement[];
        files: BinaryFiles | null;
      }>
    >
  >({});
  const [previewError, setPreviewError] = useState<Error | null>(null);
  const [originalPreviewError, setOriginalPreviewError] = useState<Error | null>(
    null,
  );

  const getSchemeDataRef = useCallback((schemeId: string) => {
    if (!schemeDataRefs.current[schemeId]) {
      schemeDataRefs.current[schemeId] = {
        current: { elements: [], files: null },
      };
    }
    return schemeDataRefs.current[schemeId];
  }, []);

  const fitPreviewToViewport = useCallback(
    (
      canvasRef: React.RefObject<HTMLDivElement | null>,
      schemeId?: string | null,
    ) => {
      const host = canvasRef.current;
      const container = host?.parentElement;
      if (!host || !container) {
        return;
      }

      let contentWidth = 0;
      let contentHeight = 0;

      if (schemeId) {
        const dataRef = getSchemeDataRef(schemeId);
        const sceneElements = dataRef.current.elements;
        if (sceneElements.length > 0) {
          const [minX, minY, maxX, maxY] = getCommonBounds(sceneElements);
          contentWidth = Math.max(1, maxX - minX);
          contentHeight = Math.max(1, maxY - minY);
        }
      }

      const renderedNode = host.querySelector("canvas, svg");
      if (renderedNode) {
        let renderedWidth = 0;
        let renderedHeight = 0;
        if (renderedNode instanceof HTMLCanvasElement) {
          const ratio = window.devicePixelRatio || 1;
          renderedWidth = renderedNode.width / ratio;
          renderedHeight = renderedNode.height / ratio;
        } else if (renderedNode instanceof SVGSVGElement) {
          try {
            const bbox = renderedNode.getBBox();
            if (bbox.width > 0 && bbox.height > 0) {
              renderedWidth = bbox.width;
              renderedHeight = bbox.height;
            }
          } catch {
            const viewBox = renderedNode.viewBox?.baseVal;
            if (viewBox?.width && viewBox?.height) {
              renderedWidth = viewBox.width;
              renderedHeight = viewBox.height;
            }
          }

          if (renderedWidth <= 0 || renderedHeight <= 0) {
            const box = renderedNode.getBoundingClientRect();
            renderedWidth = box.width;
            renderedHeight = box.height;
          }
        }

        if (renderedWidth > 0 && renderedHeight > 0) {
          contentWidth = Math.max(contentWidth, renderedWidth);
          contentHeight = Math.max(contentHeight, renderedHeight);
        }
      }

      if (contentWidth <= 0 || contentHeight <= 0) {
        setViewport({ x: 0, y: 0, zoom: 1 });
        return;
      }

      const padding = 48;
      const availableWidth = Math.max(1, container.clientWidth - padding * 2);
      const availableHeight = Math.max(1, container.clientHeight - padding * 2);
      const zoom = Math.max(
        0.05,
        Math.min(
          1,
          availableWidth / contentWidth,
          availableHeight / contentHeight,
        ),
      );
      setViewport({ x: 0, y: 0, zoom });
    },
    [getSchemeDataRef, setViewport],
  );

  const scheduleFitPreview = useCallback(
    (
      canvasRef: React.RefObject<HTMLDivElement | null>,
      schemeId?: string | null,
    ) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fitPreviewToViewport(canvasRef, schemeId);
        });
      });
    },
    [fitPreviewToViewport],
  );

  useEffect(() => {
    if (!isPreviewPage) {
      return;
    }

    const renderPreview = async (
      scheme: Scheme | null,
      canvasRef: React.RefObject<HTMLDivElement | null>,
      setError: (err: Error | null) => void,
      autoFit = false,
    ) => {
      if (!canvasRef.current) {
        return;
      }
      if (!scheme?.mermaid?.trim()) {
        setError(new Error("当前方案缺少 Mermaid 代码"));
        return;
      }
      if (!mermaidToExcalidrawLib.loaded) {
        setError(new Error("Mermaid 渲染引擎尚未就绪，请稍后重试"));
        return;
      }

      const parent = canvasRef.current.parentElement;
      if (!parent || parent.offsetWidth === 0 || parent.offsetHeight === 0) {
        if (previewRetryRef.current < 5) {
          previewRetryRef.current += 1;
          requestAnimationFrame(() =>
            renderPreview(scheme, canvasRef, setError),
          );
        } else {
          setError(new Error("Preview container has no size"));
        }
        return;
      }

      const dataRef = getSchemeDataRef(scheme.id);
      setRenderingSchemeIds((prev) => [...prev, scheme.id]);

      try {
        const firstTry = await convertMermaidToExcalidraw({
          canvasRef,
          mermaidToExcalidrawLib,
          mermaidDefinition: scheme.mermaid,
          setError: (err) => {
            setError(err);
            if (err) {
              console.error("Mermaid preview error", err);
            }
          },
          data: dataRef,
          theme,
        });
        if (!firstTry.success) {
          const sanitized = sanitizeMermaidDefinition(scheme.mermaid);
          if (sanitized && sanitized !== scheme.mermaid) {
            await convertMermaidToExcalidraw({
              canvasRef,
              mermaidToExcalidrawLib,
              mermaidDefinition: sanitized,
              setError: (err) => {
                setError(err);
                if (err) {
                  console.error("Mermaid preview fallback error", err);
                }
              },
              data: dataRef,
              theme,
            });
          }
        }
        if (autoFit) {
          scheduleFitPreview(canvasRef, scheme.id);
        }
      } finally {
        setRenderingSchemeIds((prev) => prev.filter((id) => id !== scheme.id));
      }
    };

    previewRetryRef.current = 0;
    setPreviewError(null);
    void renderPreview(activeScheme, previewCanvasRef, setPreviewError, true);
  }, [
    activeScheme,
    getSchemeDataRef,
    isPreviewPage,
    mermaidToExcalidrawLib,
    mermaidToExcalidrawLib.loaded,
    scheduleFitPreview,
    setRenderingSchemeIds,
    theme,
  ]);

  useEffect(() => {
    if (!isPreviewPage || !activeScheme) {
      return;
    }
    scheduleFitPreview(previewCanvasRef, activeScheme.id);
  }, [activeScheme, isCompareMode, isPreviewPage, scheduleFitPreview]);

  useEffect(() => {
    if (!isPreviewPage || !activeScheme) {
      return;
    }

    const host = previewCanvasRef.current;
    const container = host?.parentElement;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      scheduleFitPreview(previewCanvasRef, activeScheme.id);
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [activeScheme, isPreviewPage, scheduleFitPreview]);

  useEffect(() => {
    if (!isPreviewPage || !isCompareMode) {
      return;
    }

    const container = originalPreviewCanvasRef.current;
    if (!container) {
      return;
    }

    let isCancelled = false;
    const renderOriginalPreview = async () => {
      setOriginalPreviewError(null);

      const nonDeletedElements = elements.filter(isNonDeletedElement);
      if (nonDeletedElements.length === 0) {
        container.replaceChildren();
        return;
      }

      try {
        const svg = await exportToSvg(
          nonDeletedElements,
          {
            exportBackground: true,
            exportPadding: 16,
            viewBackgroundColor,
            exportWithDarkMode: theme === "dark",
            frameRendering,
          },
          null,
        );

        if (isCancelled) {
          return;
        }

        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.maxWidth = "100%";
        svg.style.maxHeight = "100%";
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        container.replaceChildren(svg);
      } catch (error) {
        if (!isCancelled) {
          setOriginalPreviewError(
            error instanceof Error ? error : new Error("原架构图渲染失败"),
          );
        }
      }
    };

    void renderOriginalPreview();

    return () => {
      isCancelled = true;
    };
  }, [
    elements,
    frameRendering,
    isCompareMode,
    isPreviewPage,
    theme,
    viewBackgroundColor,
  ]);

  const clearPreviewErrors = useCallback(() => {
    setPreviewError(null);
    setOriginalPreviewError(null);
  }, []);

  return {
    previewCanvasRef,
    originalPreviewCanvasRef,
    previewError,
    originalPreviewError,
    getSchemeDataRef,
    scheduleFitPreview,
    clearPreviewErrors,
  };
};
