import { useCallback } from "react";

import {
  FONT_FAMILY,
  getFontString,
  getLineHeight,
  sceneCoordsToViewportCoords,
} from "@excalidraw/common";
import { getCommonBounds, newTextElement, wrapText } from "@excalidraw/element";

import { runAIStream } from "../../../services/aiService";
import { parseSuggestions } from "../model";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  AppClassProperties,
  BinaryFiles,
} from "../../../types";
import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  StrokeStyle,
} from "@excalidraw/element/types";
import type { RunAIStream } from "./usePlanGeneration";
import type { PoolSuggestion, Scheme, SuggestionCombination } from "../model";

interface SchemeDataRef {
  current: {
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  };
}

interface UseSchemeActionsOptions {
  app: AppClassProperties;
  elements: readonly ExcalidrawElement[];
  activeScheme: Scheme | null;
  schemes: Scheme[];
  suggestionCombinations: SuggestionCombination[];
  isStreaming: boolean;
  runStream: RunAIStream;
  onClose: () => void;
  applyCombination: (combinationId: string) => void;
  getSchemeDataRef: (schemeId: string) => MutableRefObject<SchemeDataRef["current"]>;
  setSchemes: Dispatch<SetStateAction<Scheme[]>>;
  setActiveSchemeId: Dispatch<SetStateAction<string | null>>;
  setSuggestionPool: Dispatch<SetStateAction<PoolSuggestion[]>>;
  setActiveCombinationId: Dispatch<SetStateAction<string | null>>;
  setSuggestionToast: Dispatch<SetStateAction<string | null>>;
}

export const useSchemeActions = ({
  app,
  elements,
  activeScheme,
  schemes,
  suggestionCombinations,
  isStreaming,
  runStream,
  onClose,
  applyCombination,
  getSchemeDataRef,
  setSchemes,
  setActiveSchemeId,
  setSuggestionPool,
  setActiveCombinationId,
  setSuggestionToast,
}: UseSchemeActionsOptions) => {
  const handleRegenerateSummary = useCallback(async () => {
    if (!activeScheme || isStreaming) {
      return;
    }

    const schemeId = activeScheme.id;
    const originalSummary = activeScheme.summary;
    const originalFullSummary = activeScheme.fullSummary ?? activeScheme.summary;
    const suggestionContext = parseSuggestions(activeScheme.summary)
      .slice(0, 6)
      .map((item, index) => `${index + 1}. ${item.content}`)
      .join("\n");

    const summaryPrompt = `请基于以下“目标架构图（Mermaid）”和“当前建议”，输出一份更清晰的方案总结。

要求：
- 仅输出 5 条要点，按优先级排序
- 每条一行，格式：- [分类] 一句话行动建议
- 每条不超过 55 个中文字符
- 分类仅使用：性能 / 安全 / 成本 / 扩展性 / 可靠性
- 不要输出 Mermaid，不要长段落解释

<目标架构图 Mermaid>
${activeScheme.mermaid}
</目标架构图 Mermaid>

<当前建议>
${suggestionContext || originalSummary}
</当前建议>`;

    let summaryBuffer = "";
    const streamResult = await runStream((signal) =>
      runAIStream(
        [
          {
            role: "system",
            content: "你是资深系统架构师，擅长把复杂方案总结为可执行清单。",
          },
          { role: "user", content: summaryPrompt },
        ],
        {
          onChunk: (chunk) => {
            summaryBuffer += chunk;
            const interimSummary = summaryBuffer.trimStart();
            setSchemes((prev) =>
              prev.map((scheme) =>
                scheme.id === schemeId
                  ? {
                      ...scheme,
                      summary: interimSummary || "正在生成总结...",
                      fullSummary: interimSummary || "正在生成总结...",
                    }
                  : scheme,
              ),
            );
          },
        },
        signal,
      ),
    );

    if (!streamResult.success) {
      setSchemes((prev) =>
        prev.map((scheme) =>
          scheme.id === schemeId
            ? {
                ...scheme,
                summary: originalSummary,
                fullSummary: originalFullSummary,
              }
            : scheme,
        ),
      );
      setSuggestionToast("重新生成总结失败");
      return;
    }

    const finalSummary = summaryBuffer.trim();
    if (!finalSummary) {
      setSchemes((prev) =>
        prev.map((scheme) =>
          scheme.id === schemeId
            ? {
                ...scheme,
                summary: originalSummary,
                fullSummary: originalFullSummary,
              }
            : scheme,
        ),
      );
      setSuggestionToast("AI未返回有效总结");
      return;
    }

    const shortSummary =
      finalSummary
        .split("\n")
        .find((line) => line.trim())
        ?.trim() || "优化方案";
    setSchemes((prev) =>
      prev.map((scheme) =>
        scheme.id === schemeId
          ? {
              ...scheme,
              summary: finalSummary,
              fullSummary: finalSummary,
              shortSummary,
            }
          : scheme,
      ),
    );
    setSuggestionToast("AI总结已更新");
  }, [activeScheme, isStreaming, runStream, setSchemes, setSuggestionToast]);

  const handleSelectScheme = useCallback(
    (schemeId: string) => {
      setActiveSchemeId(schemeId);
      const scheme = schemes.find((item) => item.id === schemeId);
      if (!scheme) {
        return;
      }

      if (scheme.sourceCombinationId) {
        const exists = suggestionCombinations.some(
          (combination) => combination.id === scheme.sourceCombinationId,
        );
        if (exists) {
          applyCombination(scheme.sourceCombinationId);
          return;
        }
      }

      if (scheme.sourceSuggestionIds && scheme.sourceSuggestionIds.length > 0) {
        const sourceIdSet = new Set(scheme.sourceSuggestionIds);
        setSuggestionPool((prev) => {
          const next = prev.map((s) => ({
            ...s,
            selected: sourceIdSet.has(s.id),
          }));
          if (!scheme.sourceSuggestionSnapshot?.length) {
            return next;
          }
          const existingIdSet = new Set(next.map((s) => s.id));
          const recovered = scheme.sourceSuggestionSnapshot
            .filter((item) => !existingIdSet.has(item.id))
            .map((item) => ({
              ...item,
              selected: true,
              archived: false,
            }));
          return [...next, ...recovered];
        });
        setActiveCombinationId(null);
      }
    },
    [
      applyCombination,
      schemes,
      setActiveCombinationId,
      setActiveSchemeId,
      setSuggestionPool,
      suggestionCombinations,
    ],
  );

  const insertSchemeToCanvas = useCallback(
    (scheme: Scheme) => {
      const dataRef = getSchemeDataRef(scheme.id);
      if (!dataRef.current.elements || dataRef.current.elements.length === 0) {
        return;
      }

      const newElements = dataRef.current.elements;
      const files = dataRef.current.files;

      const referenceElements =
        app.scene.getNonDeletedElements().length > 0
          ? app.scene.getNonDeletedElements()
          : elements;

      const hasReference = referenceElements.length > 0;
      const [, refMinY, refMaxX] = hasReference
        ? getCommonBounds(referenceElements)
        : [0, 0, 0, 0];
      const [newMinX, , newMaxX, newMaxY] = getCommonBounds(newElements);
      const newWidth = newMaxX - newMinX;

      const title = scheme.title?.trim() || `方案 ${scheme.version}`;
      const summaryText = `${title}\n\n${scheme.summary.trim()}`;
      const fontFamily = FONT_FAMILY.Assistant;
      const fontSize = 16;
      const lineHeight = getLineHeight(fontFamily);
      const maxTextWidth = Math.max(260, Math.min(520, newWidth));
      const wrappedText = wrapText(
        summaryText,
        getFontString({ fontFamily, fontSize }),
        maxTextWidth,
      );
      const textElement = newTextElement({
        x: newMinX,
        y: newMaxY + 48,
        text: wrappedText,
        originalText: summaryText,
        fontSize,
        fontFamily,
        lineHeight,
        textAlign: "left",
        verticalAlign: "top",
        autoResize: false,
        strokeColor: "#1f2937",
        backgroundColor: "transparent",
      });

      const styledElements: NonDeletedExcalidrawElement[] =
        newElements.map<NonDeletedExcalidrawElement>((el) => {
          if (
            "strokeStyle" in el &&
            "strokeColor" in el &&
            "backgroundColor" in el
          ) {
            return {
              ...el,
              strokeStyle: "dashed" as StrokeStyle,
              strokeColor: "#6366f1",
              backgroundColor:
                el.backgroundColor === "transparent"
                  ? "transparent"
                  : "rgba(99, 102, 241, 0.08)",
            };
          }
          return el;
        });

      const combinedElements: readonly ExcalidrawElement[] = [
        ...styledElements,
        textElement,
      ];
      const [combinedMinX, combinedMinY, combinedMaxX, combinedMaxY] =
        getCommonBounds(combinedElements);
      const combinedWidth = combinedMaxX - combinedMinX;
      const combinedHeight = combinedMaxY - combinedMinY;

      const PADDING = 160;
      const targetLeft = hasReference ? refMaxX + PADDING : 0;
      const targetTop = hasReference ? refMinY : 0;
      const targetCenterX = targetLeft + combinedWidth / 2;
      const targetCenterY = targetTop + combinedHeight / 2;
      const { x: clientX, y: clientY } = sceneCoordsToViewportCoords(
        { sceneX: targetCenterX, sceneY: targetCenterY },
        app.state,
      );

      app.addElementsFromPasteOrLibrary({
        elements: combinedElements,
        files,
        position: { clientX, clientY },
        fitToContent: false,
      });

      onClose();
    },
    [app, elements, getSchemeDataRef, onClose],
  );

  return {
    handleRegenerateSummary,
    handleSelectScheme,
    insertSchemeToCanvas,
  };
};
