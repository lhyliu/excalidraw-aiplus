import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";

import type {
  ExcalidrawElement,
  Theme,
} from "@excalidraw/element/types";

import { useApp } from "../components/App";
import { useUIAppState } from "../context/ui-appState";

import {
  extractDiagramInfo,
  getArchitectureAnalysisPrompt,
  isAIConfigured,
  runAIStream,
} from "../services/aiService";

import { Dialog } from "./Dialog";
import { ChatPanel } from "./ArchitectureOptimizationDialog/ChatPanel";
import { ClearSchemesConfirmDialog } from "./ArchitectureOptimizationDialog/ClearSchemesConfirmDialog";
import { ConfigurationWaitScreen } from "./ArchitectureOptimizationDialog/ConfigurationWaitScreen";
import {
  buildSuggestionDedupKey,
  categoryLabels,
  compactSuggestionContent,
  extractTitle,
  normalizeSuggestionContent,
  parseSuggestions,
} from "./ArchitectureOptimizationDialog/model";
import { PreviewPage } from "./ArchitectureOptimizationDialog/PreviewPage";
import { SchemeTabs } from "./ArchitectureOptimizationDialog/SchemeTabs";
import { SchemeUndoToast } from "./ArchitectureOptimizationDialog/SchemeUndoToast";
import { WorkflowPage } from "./ArchitectureOptimizationDialog/WorkflowPage";
import { useArchitecturePersistence } from "./ArchitectureOptimizationDialog/hooks/useArchitecturePersistence";
import { usePlanGeneration } from "./ArchitectureOptimizationDialog/hooks/usePlanGeneration";
import { usePreviewControls } from "./ArchitectureOptimizationDialog/hooks/usePreviewControls";
import { usePreviewRenderer } from "./ArchitectureOptimizationDialog/hooks/usePreviewRenderer";
import { useSchemeActions } from "./ArchitectureOptimizationDialog/hooks/useSchemeActions";
import { adjustInputComposerTextareaHeight } from "./ArchitectureOptimizationDialog/inputComposer";
import { useAIStream } from "./hooks/useAIStream";

import { useAtom, useAtomValue, useSetAtom } from "../editor-jotai";
import {
  aoMessagesAtom,
  aoDispatchMessagesAtom,
  aoInputValueAtom,
  aoSchemesAtom,
  aoActiveSchemeIdAtom,
  aoActiveSchemeAtom,
  aoIsCompareModeAtom,
  aoDeletedSchemesBufferAtom,
  aoShowUndoToastAtom,
  aoRenderingSchemeIdsAtom,
  aoSuggestionPoolAtom,
  aoSuggestionCombinationsAtom,
  aoActiveCombinationIdAtom,
  aoArchitectureStyleAtom,
  aoSkipUpdateConfirmAtom,
  aoEditingSuggestionIdAtom,
  aoSuggestionSearchKeywordAtom,
  aoShowArchivedSuggestionsAtom,
  aoExpandedSuggestionIdsAtom,
  aoSuggestionToastAtom,
  aoIsPreviewPageAtom,
  aoIsDrawerOpenAtom,
  aoHighlightedSuggestionIdAtom,
  aoViewportAtom,
  aoIsPanModeAtom,
  aoShowConfigExampleAtom,
  aoIsClearSchemesDialogOpenAtom,
  aoClearSchemesOptionsAtom,
} from "./ArchitectureOptimizationDialog/atoms";

import {
  type Message,
} from "./ArchitectureOptimizationDialog/messageState";
import "./ArchitectureOptimizationDialog.scss";

import type {
  ArchitectureStyle,
  PoolSuggestion,
  Scheme,
  Suggestion,
} from "./ArchitectureOptimizationDialog/model";
import type { MermaidToExcalidrawLibProps } from "./TTDDialog/types";

interface ArchitectureOptimizationDialogProps {
  elements: readonly ExcalidrawElement[];
  onClose: () => void;
  onOpenAISettings: () => void;
  assistantTabs?: React.ReactNode;
}

const ARCHITECTURE_DIALOG_WIDTH = 1500;
const SCHEME_UNDO_TIMEOUT_MS = 12000;
const CHAT_STORAGE_KEY = "excalidraw_architecture_chat";

const getScopedStorageKey = (baseKey: string, scope?: string) =>
  scope ? `${baseKey}::${scope}` : baseKey;

export const ArchitectureOptimizationDialog: React.FC<
  ArchitectureOptimizationDialogProps
> = ({ elements, onClose, onOpenAISettings, assistantTabs }) => {
  const app = useApp();
  const uiAppState = useUIAppState();
  const storageScope = (uiAppState.name || "default").trim();

  // ===== Atom-based state =====
  const [messages, setMessages] = useAtom(aoMessagesAtom);
  const dispatchMessages = useSetAtom(aoDispatchMessagesAtom);
  const [inputValue, setInputValue] = useAtom(aoInputValueAtom);
  const [schemes, setSchemes] = useAtom(aoSchemesAtom);
  const [activeSchemeId, setActiveSchemeId] = useAtom(aoActiveSchemeIdAtom);
  const activeScheme = useAtomValue(aoActiveSchemeAtom);
  const [isCompareMode, setIsCompareMode] = useAtom(aoIsCompareModeAtom);
  const [deletedSchemesBuffer, setDeletedSchemesBuffer] = useAtom(aoDeletedSchemesBufferAtom);
  const [showUndoToast, setShowUndoToast] = useAtom(aoShowUndoToastAtom);
  const [renderingSchemeIds, setRenderingSchemeIds] = useAtom(aoRenderingSchemeIdsAtom);
  const [suggestionPool, setSuggestionPool] = useAtom(aoSuggestionPoolAtom);
  const [suggestionCombinations, setSuggestionCombinations] = useAtom(aoSuggestionCombinationsAtom);
  const [activeCombinationId, setActiveCombinationId] = useAtom(aoActiveCombinationIdAtom);
  const [architectureStyle, setArchitectureStyle] = useAtom(aoArchitectureStyleAtom);
  const [skipUpdateConfirm, setSkipUpdateConfirm] = useAtom(aoSkipUpdateConfirmAtom);
  const [editingSuggestionId, setEditingSuggestionId] = useAtom(aoEditingSuggestionIdAtom);
  const [suggestionSearchKeyword, setSuggestionSearchKeyword] = useAtom(aoSuggestionSearchKeywordAtom);
  const [showArchivedSuggestions, setShowArchivedSuggestions] = useAtom(aoShowArchivedSuggestionsAtom);
  const [suggestionToast, setSuggestionToast] = useAtom(aoSuggestionToastAtom);
  const [expandedSuggestionIds, setExpandedSuggestionIds] = useAtom(aoExpandedSuggestionIdsAtom);
  const [isPreviewPage, setIsPreviewPage] = useAtom(aoIsPreviewPageAtom);
  const [isDrawerOpen, setIsDrawerOpen] = useAtom(aoIsDrawerOpenAtom);
  const [highlightedSuggestionId, setHighlightedSuggestionId] = useAtom(aoHighlightedSuggestionIdAtom);
  const [viewport, setViewport] = useAtom(aoViewportAtom);
  const [isPanMode, setIsPanMode] = useAtom(aoIsPanModeAtom);
  const [showConfigExample, setShowConfigExample] = useAtom(aoShowConfigExampleAtom);
  const [isClearSchemesDialogOpen, setIsClearSchemesDialogOpen] = useAtom(aoIsClearSchemesDialogOpenAtom);
  const [clearSchemesOptions, setClearSchemesOptions] = useAtom(aoClearSchemesOptionsAtom);

  const [mermaidToExcalidrawLib, setMermaidToExcalidrawLib] =
    useState<MermaidToExcalidrawLibProps>({
      loaded: false,
      api: import("@excalidraw/mermaid-to-excalidraw"),
    });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionToastTimerRef = useRef<number | null>(null);
  const stagingAreaRef = useRef<HTMLDivElement>(null);

  const { run: runStream, abort: abortStream, isStreaming } = useAIStream();

  useEffect(() => {
    const fn = async () => {
      await mermaidToExcalidrawLib.api;
      setMermaidToExcalidrawLib((prev) => ({ ...prev, loaded: true }));
    };
    fn();
  }, [mermaidToExcalidrawLib.api]);

  useEffect(() => {
    if (schemes.length === 0) {
      setActiveSchemeId(null);
      return;
    }
    if (!activeSchemeId) {
      setActiveSchemeId(schemes[schemes.length - 1].id);
    }
  }, [schemes, activeSchemeId]);

  useArchitecturePersistence({
    storageScope,
    isStreaming,
    messages,
    schemes,
    suggestionPool,
    suggestionCombinations,
    activeCombinationId,
    architectureStyle,
    skipUpdateConfirm,
    suggestionSearchKeyword,
    showArchivedSuggestions,
    inputValue,
    activeSchemeId,
    isPreviewPage,
    isCompareMode,
    setMessages,
    setSchemes,
    setActiveSchemeId,
    setInputValue,
    setIsCompareMode,
    setSuggestionPool,
    setSuggestionCombinations,
    setActiveCombinationId,
    setArchitectureStyle,
    setSkipUpdateConfirm,
    setSuggestionSearchKeyword,
    setShowArchivedSuggestions,
    setIsPreviewPage,
  });

  const {
    previewCanvasRef,
    originalPreviewCanvasRef,
    previewError,
    originalPreviewError,
    getSchemeDataRef,
    scheduleFitPreview,
    clearPreviewErrors,
  } = usePreviewRenderer({
    activeScheme,
    elements,
    isPreviewPage,
    isCompareMode,
    mermaidToExcalidrawLib,
    theme: uiAppState.theme as Theme,
    viewBackgroundColor: uiAppState.viewBackgroundColor,
    frameRendering: uiAppState.frameRendering,
    setViewport,
    setRenderingSchemeIds,
  });

  // activeScheme is now derived from aoActiveSchemeAtom above
  const activeSchemeSuggestions = useMemo(
    () => (activeScheme ? parseSuggestions(activeScheme.summary) : []),
    [activeScheme],
  );

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 清理撤销缓冲区
  useEffect(() => {
    return () => {
      if (deletedSchemesBuffer?.timeoutId) {
        clearTimeout(deletedSchemesBuffer.timeoutId);
      }
      if (suggestionToastTimerRef.current) {
        clearTimeout(suggestionToastTimerRef.current);
      }
    };
  }, [deletedSchemesBuffer]);

  const handleStartAnalysis = useCallback(async () => {
    if (isStreaming) {
      return;
    }

    const diagramInfo = extractDiagramInfo(elements);
    const selectedContext = suggestionPool
      .filter((s) => s.selected)
      .map(
        (s) =>
          `- [${categoryLabels[s.category]}] ${s.fullContent}${s.note ? ` (备注: ${s.note})` : ""
          }`,
      )
      .join("\n");
    const systemPrompt = `${getArchitectureAnalysisPrompt(diagramInfo)}${selectedContext
      ? `\n\n【已选建议工作集（请作为本轮上下文参考，不要忽略）】\n${selectedContext}`
      : ""
      }`;

    const userMsgId = `msg-${Date.now()}`;
    const assistantMsgId = `msg-${Date.now() + 1}`;

    const userMessage: Message = {
      id: userMsgId,
      role: "user",
      content: "请分析当前架构图并提供优化建议。",
    };

    const assistantMessage: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isGenerating: true,
    };

    dispatchMessages({
      type: "add",
      messages: [userMessage, assistantMessage],
    });

    let reasoningBuffer = "";
    let contentBuffer = "";
    const result = await runStream((signal) =>
      runAIStream(
        [
          { role: "system", content: systemPrompt },
          ...messages
            .filter((m) => !m.error)
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          { role: "user", content: userMessage.content },
        ],
        {
          onChunk: (chunk) => {
            contentBuffer += chunk;
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { content: contentBuffer },
            });
          },
          onReasoning: (chunk) => {
            reasoningBuffer += chunk;
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { reasoning: reasoningBuffer },
            });
          },
          onComplete: () => {
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { isGenerating: false },
            });
            if (contentBuffer) {
              const parsed = parseSuggestions(contentBuffer);
              setSuggestionPool((prev) => {
                const existing = new Set(
                  prev.map((p) => buildSuggestionDedupKey(p.category, p.fullContent)),
                );
                const unique = parsed
                  .filter((s) => {
                    const key = buildSuggestionDedupKey(s.category, s.content);
                    if (existing.has(key)) {
                      return false;
                    }
                    existing.add(key);
                    return true;
                  })
                  .map((s, idx) => ({
                    id: `pool-${Date.now()}-${idx}`,
                    category: s.category,
                    title: extractTitle(compactSuggestionContent(s.content)),
                    content: compactSuggestionContent(s.content),
                    fullContent: normalizeSuggestionContent(s.content),
                    selected: false,
                    archived: false,
                  }));
                return [...prev, ...unique];
              });
            }
          },
          onError: (error) => {
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { isGenerating: false, error: error.message },
            });
          },
          includeReasoning: true,
        },
        signal,
      ),
    );

    if (!result.success) {
      dispatchMessages({
        type: "update",
        id: assistantMsgId,
        patch: { isGenerating: false, error: result.error || "Unknown error" },
      });
    }
  }, [elements, messages, runStream, isStreaming, suggestionPool]);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) {
      return;
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
    };

    const assistantMsgId = `msg-${Date.now() + 1}`;
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isGenerating: true,
    };

    dispatchMessages({
      type: "add",
      messages: [userMessage, assistantMessage],
    });
    setInputValue("");

    // Build message history for API
    const diagramInfo = extractDiagramInfo(elements);
    const selectedContext = suggestionPool
      .filter((s) => s.selected)
      .map(
        (s) =>
          `- [${categoryLabels[s.category]}] ${s.fullContent}${s.note ? ` (备注: ${s.note})` : ""
          }`,
      )
      .join("\n");
    const systemPrompt = `${getArchitectureAnalysisPrompt(diagramInfo)}${selectedContext
      ? `\n\n【已选建议工作集（请作为本轮上下文参考，不要忽略）】\n${selectedContext}`
      : ""
      }`;
    const apiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages
        .filter((m) => !m.error)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      { role: "user" as const, content: userMessage.content },
    ];

    let reasoningBuffer = "";
    let contentBuffer = "";
    const result = await runStream((signal) =>
      runAIStream(
        apiMessages,
        {
          onChunk: (chunk) => {
            contentBuffer += chunk;
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { content: contentBuffer },
            });
          },
          onReasoning: (chunk) => {
            reasoningBuffer += chunk;
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { reasoning: reasoningBuffer },
            });
          },
          onComplete: () => {
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { isGenerating: false },
            });
            // Auto-extract suggestions to pool
            if (contentBuffer) {
              extractSuggestionsToPool(contentBuffer);
            }
          },
          onError: (error) => {
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { isGenerating: false, error: error.message },
            });
          },
          includeReasoning: true,
        },
        signal,
      ),
    );
    if (!result.success) {
      dispatchMessages({
        type: "update",
        id: assistantMsgId,
        patch: { isGenerating: false, error: result.error || "Unknown error" },
      });
    }
  }, [inputValue, messages, elements, runStream, isStreaming, suggestionPool]);

  const handleSendPresetQuestion = useCallback((question: string) => {
    setInputValue(question);
  }, []);

  const handleAbort = useCallback(() => {
    abortStream();
    dispatchMessages({
      type: "updateLast",
      predicate: (m) => m.role === "assistant" && Boolean(m.isGenerating),
      patch: { isGenerating: false, error: "Request aborted" },
    });
  }, [abortStream]);

  const handleClearHistory = useCallback(() => {
    dispatchMessages({ type: "replace", messages: [] });
    localStorage.removeItem(
      getScopedStorageKey(CHAT_STORAGE_KEY, storageScope),
    );
  }, [storageScope]);

  const handleUploadImage = useCallback(() => {
    if (isStreaming) {
      return;
    }
    dispatchMessages({
      type: "add",
      messages: [
        {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content:
            "图片上传功能正在开发中，当前请直接在画布中绘制架构，或在输入框用文字描述。",
        },
      ],
    });
  }, [isStreaming]);

  // === Semi-automatic workflow handlers ===

  // Extract suggestions from AI response and add to pool
  function extractSuggestionsToPool(content: string): number {
    const parsed = parseSuggestions(content);
    const newSuggestions: PoolSuggestion[] = parsed.map((s, idx) => ({
      id: `pool-${Date.now()}-${idx}`,
      category: s.category,
      title: extractTitle(compactSuggestionContent(s.content)),
      content: compactSuggestionContent(s.content),
      fullContent: normalizeSuggestionContent(s.content),
      selected: false,
      archived: false,
    }));

    let addedCount = 0;
    setSuggestionPool((prev) => {
      const existing = new Set(
        prev.map((p) => buildSuggestionDedupKey(p.category, p.fullContent)),
      );
      const unique = newSuggestions.filter(
        (s) => {
          const key = buildSuggestionDedupKey(s.category, s.fullContent);
          if (existing.has(key)) {
            return false;
          }
          existing.add(key);
          return true;
        },
      );
      addedCount = unique.length;
      return [...prev, ...unique];
    });
    return addedCount;
  }

  const lastAssistantConclusion = useMemo(() => {
    const latestAssistant = [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" &&
          !message.isGenerating &&
          !message.error &&
          message.content.trim().length > 0,
      );
    return latestAssistant?.content.trim() ?? "";
  }, [messages]);

  // Toggle suggestion selection
  const toggleSuggestionSelection = useCallback((id: string) => {
    setSuggestionPool((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)),
    );
  }, []);

  // Update suggestion note
  const updateSuggestionNote = useCallback((id: string, note: string) => {
    setSuggestionPool((prev) =>
      prev.map((s) => (s.id === id ? { ...s, note } : s)),
    );
  }, []);

  const applySuggestionToPool = useCallback((suggestion: Suggestion) => {
    let isExisting = false;
    const compactSuggestion = compactSuggestionContent(suggestion.content);
    const nextKey = buildSuggestionDedupKey(suggestion.category, compactSuggestion);
    setSuggestionPool((prev) => {
      const existing = prev.find(
        (item) =>
          buildSuggestionDedupKey(item.category, item.fullContent) === nextKey,
      );
      if (existing) {
        isExisting = true;
        return prev.map((item) =>
          item.id === existing.id ? { ...item, selected: true } : item,
        );
      }
      return [
        ...prev,
        {
          id: `pool-${Date.now()}`,
          category: suggestion.category,
          title: extractTitle(compactSuggestion),
          content: compactSuggestion,
          fullContent: normalizeSuggestionContent(suggestion.content),
          selected: true,
          archived: false,
        },
      ];
    });
    stagingAreaRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setSuggestionToast(isExisting ? "建议已加入已选区域" : "建议已添加并选中");
    if (suggestionToastTimerRef.current) {
      clearTimeout(suggestionToastTimerRef.current);
    }
    suggestionToastTimerRef.current = window.setTimeout(() => {
      setSuggestionToast(null);
      suggestionToastTimerRef.current = null;
    }, 1600);
  }, []);

  // Get selected suggestions
  const selectedSuggestions = suggestionPool.filter((s) => s.selected);
  const selectedSuggestionIds = selectedSuggestions.map((s) => s.id);
  const selectedSuggestionContents = selectedSuggestions.map((s) => s.content);
  const visibleSuggestions = suggestionPool.filter((s) => {
    if (!showArchivedSuggestions && s.archived) {
      return false;
    }
    if (!suggestionSearchKeyword.trim()) {
      return true;
    }
    const keyword = suggestionSearchKeyword.trim().toLowerCase();
    return (
      s.title.toLowerCase().includes(keyword) ||
      s.content.toLowerCase().includes(keyword) ||
      s.fullContent.toLowerCase().includes(keyword)
    );
  });

  const selectedSuggestionSnapshot = selectedSuggestions.map((s) => ({
    id: s.id,
    category: s.category,
    title: s.title,
    content: s.content,
    fullContent: s.fullContent,
    note: s.note,
  }));

  const handleClearSelectedSuggestions = useCallback(() => {
    setSuggestionPool((prev) => prev.map((s) => ({ ...s, selected: false })));
    setActiveCombinationId(null);
  }, []);

  const confirmClear = useCallback((target: string) => {
    return window.confirm(`将清空${target}，该操作不可恢复。是否继续？`);
  }, []);

  const handleToggleExpandedSuggestion = useCallback((id: string) => {
    setExpandedSuggestionIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }, []);

  const applyCombination = useCallback(
    (combinationId: string) => {
      const combination = suggestionCombinations.find(
        (c) => c.id === combinationId,
      );
      if (!combination) {
        return;
      }
      const idSet = new Set(combination.suggestionIds);
      setSuggestionPool((prev) =>
        prev.map((s) => ({ ...s, selected: idSet.has(s.id) })),
      );
      setActiveCombinationId(combination.id);
    },
    [suggestionCombinations],
  );

  const archiveSuggestion = useCallback((id: string) => {
    setSuggestionPool((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, archived: true, selected: false } : s,
      ),
    );
    setSuggestionToast("建议已归档");
  }, []);

  const clearSuggestionPool = useCallback(() => {
    if (suggestionPool.length === 0) {
      return;
    }
    if (!confirmClear("列表")) {
      return;
    }
    setSuggestionPool([]);
    setActiveCombinationId(null);
    setExpandedSuggestionIds([]);
    setEditingSuggestionId(null);
    setSuggestionToast("列表已清空");
  }, [suggestionPool.length, confirmClear]);

  const clearSchemes = useCallback(() => {
    if (schemes.length === 0) {
      return;
    }
    setIsClearSchemesDialogOpen(true);
  }, [schemes.length]);

  const confirmClearSchemes = useCallback(() => {
    setSchemes([]);
    setActiveSchemeId(null);
    setIsPreviewPage(false);
    setIsCompareMode(false);
    clearPreviewErrors();
    if (clearSchemesOptions.alsoClearPool) {
      setSuggestionPool([]);
      setExpandedSuggestionIds([]);
      setEditingSuggestionId(null);
      setActiveCombinationId(null);
    } else if (clearSchemesOptions.alsoClearSelected) {
      setSuggestionPool((prev) => prev.map((s) => ({ ...s, selected: false })));
      setActiveCombinationId(null);
    }
    if (deletedSchemesBuffer) {
      clearTimeout(deletedSchemesBuffer.timeoutId);
      setDeletedSchemesBuffer(null);
      setShowUndoToast(false);
    }
    setIsClearSchemesDialogOpen(false);
    const keepSuggestions =
      !clearSchemesOptions.alsoClearSelected && !clearSchemesOptions.alsoClearPool;
    const toastText = keepSuggestions
      ? "已清空方案，建议流与已选建议已保留"
      : clearSchemesOptions.alsoClearPool
        ? "已清空方案和建议项目"
        : "已清空方案和已选建议";
    setSuggestionToast(toastText);
    if (suggestionToastTimerRef.current) {
      clearTimeout(suggestionToastTimerRef.current);
    }
    suggestionToastTimerRef.current = window.setTimeout(() => {
      setSuggestionToast(null);
      suggestionToastTimerRef.current = null;
    }, 2200);
    setClearSchemesOptions({ alsoClearSelected: false, alsoClearPool: false });
  }, [
    clearPreviewErrors,
    clearSchemesOptions,
    deletedSchemesBuffer,
  ]);

  const handleReactivateLastSuggestions = useCallback(() => {
    if (isStreaming || !lastAssistantConclusion.trim()) {
      return;
    }
    const addedCount = extractSuggestionsToPool(lastAssistantConclusion);
    if (addedCount > 0) {
      setSuggestionToast(`已从最近结论恢复 ${addedCount} 条建议`);
      setIsPreviewPage(false);
      return;
    }
    setSuggestionToast("最近结论中的建议已全部存在，无需恢复");
  }, [isStreaming, lastAssistantConclusion]);

  useEffect(() => {
    if (!activeCombinationId) {
      return;
    }
    setSuggestionCombinations((prev) =>
      prev.map((combination) => {
        if (combination.id !== activeCombinationId) {
          return combination;
        }
        const unchanged =
          combination.suggestionIds.length === selectedSuggestionIds.length &&
          combination.suggestionIds.every(
            (id, index) => id === selectedSuggestionIds[index],
          );
        return unchanged
          ? combination
          : { ...combination, suggestionIds: selectedSuggestionIds };
      }),
    );
  }, [activeCombinationId, selectedSuggestionIds]);

  const {
    runSelectedPlanGeneration,
    generateNewFromSelected,
    updateCurrentFromSelected,
  } = usePlanGeneration({
    isStreaming,
    elements,
    messages,
    activeSchemeId,
    schemes,
    selectedSuggestions,
    architectureStyle,
    activeCombinationId,
    skipUpdateConfirm,
    runStream,
    dispatchMessages,
    setSchemes,
    setActiveSchemeId,
    setIsPreviewPage,
    setSuggestionToast,
    setSkipUpdateConfirm,
    suggestionToastTimerRef,
  });

  const {
    handleRegenerateSummary,
    handleSelectScheme,
    insertSchemeToCanvas,
  } = useSchemeActions({
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
  });

  const {
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleTogglePanMode,
    handleFitCanvas,
    handlePreviewPointerDown,
    handlePreviewPointerMove,
    handlePreviewPointerUp,
    handlePreviewWheel,
  } = usePreviewControls({
    activeScheme,
    isPanMode,
    viewport,
    previewCanvasRef,
    scheduleFitPreview,
    setViewport,
    setIsPanMode,
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  const adjustInputTextareaHeight = useCallback(() => {
    const textarea = inputTextareaRef.current;
    if (!textarea) {
      return;
    }
    const chatPanelHeight = chatPanelRef.current?.clientHeight ?? 0;
    adjustInputComposerTextareaHeight(textarea, chatPanelHeight);
  }, []);

  useEffect(() => {
    adjustInputTextareaHeight();
  }, [inputValue, adjustInputTextareaHeight]);

  useEffect(() => {
    const onResize = () => adjustInputTextareaHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [adjustInputTextareaHeight]);

  const handleRenameScheme = useCallback((schemeId: string, title: string) => {
    setSchemes((prev) =>
      prev.map((scheme) =>
        scheme.id === schemeId ? { ...scheme, title } : scheme,
      ),
    );
  }, []);

  // ========== 删除功能核心函数 ==========

  // 更新删除后的引用状态
  const updateSchemeRefsAfterDelete = useCallback(
    (newSchemes: Scheme[], deletedId: string) => {
      if (activeSchemeId === deletedId) {
        if (newSchemes.length > 0) {
          setActiveSchemeId(newSchemes[newSchemes.length - 1].id);
        } else {
          setActiveSchemeId(null);
        }
      }
    },
    [activeSchemeId],
  );

  // 单删（允许删完）
  const handleDeleteSingle = useCallback(
    (schemeId: string) => {
      if (!confirm("确定要删除此方案吗？")) {
        return;
      }

      const schemeToDelete = schemes.find((s) => s.id === schemeId);
      if (!schemeToDelete) {
        return;
      }

      const newSchemes = schemes.filter((s) => s.id !== schemeId);

      // 保存到撤销缓冲区
      setDeletedSchemesBuffer({
        schemes: [schemeToDelete],
        activeId: activeSchemeId,
        timeoutId: window.setTimeout(() => {
          setDeletedSchemesBuffer(null);
          setShowUndoToast(false);
        }, SCHEME_UNDO_TIMEOUT_MS),
      });

      // 执行删除
      setSchemes(newSchemes);
      updateSchemeRefsAfterDelete(newSchemes, schemeId);
      setShowUndoToast(true);
    },
    [schemes, activeSchemeId, updateSchemeRefsAfterDelete],
  );

  // 撤销删除
  const handleUndoDelete = useCallback(() => {
    if (!deletedSchemesBuffer) {
      return;
    }

    // 清除超时
    clearTimeout(deletedSchemesBuffer.timeoutId);

    // 恢复方案
    setSchemes((prev) => {
      const restored = [...prev, ...deletedSchemesBuffer.schemes];
      // 保持原有顺序（按version排序）
      return restored.sort((a, b) => a.version - b.version);
    });

    // 恢复激活状态
    if (deletedSchemesBuffer.activeId) {
      setActiveSchemeId(deletedSchemesBuffer.activeId);
    }

    setDeletedSchemesBuffer(null);
    setShowUndoToast(false);
  }, [deletedSchemesBuffer]);

  const handleToggleCompare = useCallback((checked: boolean) => {
    setIsCompareMode(checked);
  }, []);

  const handleGeneratePlan = useCallback(async () => {
    await runSelectedPlanGeneration("create");
  }, [runSelectedPlanGeneration]);

  // Show configuration prompt if AI is not configured
  if (!isAIConfigured()) {
    return (
      <Dialog
        className="architecture-optimization-dialog"
        onCloseRequest={onClose}
        title={
          <div className="architecture-assistant__dialog-title">
            <span>AI架构优化</span>
            {assistantTabs}
          </div>
        }
        size={ARCHITECTURE_DIALOG_WIDTH}
      >
        <ConfigurationWaitScreen
          showConfigExample={showConfigExample}
          onOpenAISettings={onOpenAISettings}
          onToggleConfigExample={() => setShowConfigExample((prev) => !prev)}
        />
      </Dialog>
    );
  }

  return (
    <Dialog
      className="architecture-optimization-dialog"
      onCloseRequest={onClose}
      title={
        <div className="architecture-assistant__dialog-title">
          <span>AI架构优化</span>
          {assistantTabs}
        </div>
      }
      size={ARCHITECTURE_DIALOG_WIDTH}
    >
      <div className="architecture-optimization-dialog__content">
        <div className="architecture-optimization-dialog__split">
          <div
            ref={chatPanelRef}
            className="architecture-optimization-dialog__panel architecture-optimization-dialog__panel--chat"
          >
            <ChatPanel
              messages={messages}
              inputValue={inputValue}
              isStreaming={isStreaming}
              messagesEndRef={messagesEndRef}
              inputTextareaRef={inputTextareaRef}
              onSetInputValue={setInputValue}
              onKeyDown={handleKeyDown}
              onStartAnalysis={handleStartAnalysis}
              onSendPresetQuestion={handleSendPresetQuestion}
              onClearHistory={handleClearHistory}
              onUploadImage={handleUploadImage}
              onAbort={handleAbort}
              onSendMessage={handleSendMessage}
              canReactivateLastSuggestions={
                suggestionPool.length === 0 &&
                !isStreaming &&
                lastAssistantConclusion.length > 0
              }
              lastConclusionPreview={
                lastAssistantConclusion.split("\n")[0] || ""
              }
              onReactivateLastSuggestions={handleReactivateLastSuggestions}
            />
          </div>

          <div className="architecture-optimization-dialog__panel architecture-optimization-dialog__panel--preview">
            {/* 撤销Toast提示 */}
            {showUndoToast && deletedSchemesBuffer && (
              <SchemeUndoToast
                deletedCount={deletedSchemesBuffer.schemes.length}
                timeoutMs={SCHEME_UNDO_TIMEOUT_MS}
                onUndo={handleUndoDelete}
                onDismiss={() => setShowUndoToast(false)}
              />
            )}

            <SchemeTabs
              schemes={schemes}
              activeSchemeId={activeSchemeId}
              activeScheme={activeScheme}
              isPreviewPage={isPreviewPage}
              isDrawerOpen={isDrawerOpen}
              suggestionCombinations={suggestionCombinations}
              onSetPreviewPage={setIsPreviewPage}
              onGeneratePlan={handleGeneratePlan}
              onClearSchemes={clearSchemes}
              onSelectScheme={handleSelectScheme}
              onDeleteScheme={handleDeleteSingle}
              onToggleDrawer={() => setIsDrawerOpen((prev) => !prev)}
            />

            {!isPreviewPage && (
              <WorkflowPage
                suggestionToast={suggestionToast}
                onCloseSuggestionToast={() => setSuggestionToast(null)}
                stagingAreaRef={stagingAreaRef}
                selectedSuggestions={selectedSuggestions}
                suggestionPool={suggestionPool}
                visibleSuggestions={visibleSuggestions}
                suggestionSearchKeyword={suggestionSearchKeyword}
                showArchivedSuggestions={showArchivedSuggestions}
                editingSuggestionId={editingSuggestionId}
                expandedSuggestionIds={expandedSuggestionIds}
                architectureStyle={architectureStyle}
                activeSchemeId={activeSchemeId}
                isStreaming={isStreaming}
                onClearSelectedSuggestions={handleClearSelectedSuggestions}
                onToggleSuggestionSelection={toggleSuggestionSelection}
                onClearSuggestionPool={clearSuggestionPool}
                onSetSuggestionSearchKeyword={setSuggestionSearchKeyword}
                onSetShowArchivedSuggestions={setShowArchivedSuggestions}
                onSetEditingSuggestionId={setEditingSuggestionId}
                onArchiveSuggestion={archiveSuggestion}
                onToggleExpandedSuggestion={handleToggleExpandedSuggestion}
                onUpdateSuggestionNote={updateSuggestionNote}
                onStartAnalysis={handleStartAnalysis}
                onSendPresetQuestion={handleSendPresetQuestion}
                canReactivateLastSuggestions={
                  suggestionPool.length === 0 &&
                  !isStreaming &&
                  lastAssistantConclusion.length > 0
                }
                onReactivateLastSuggestions={handleReactivateLastSuggestions}
                onSetArchitectureStyle={setArchitectureStyle}
                onGenerateNewFromSelected={generateNewFromSelected}
                onUpdateCurrentFromSelected={updateCurrentFromSelected}
              />
            )}

            {isPreviewPage && (
              <PreviewPage
                activeScheme={activeScheme}
                activeSchemeSuggestions={activeSchemeSuggestions}
                isCompareMode={isCompareMode}
                elementsLength={elements.length}
                isPanMode={isPanMode}
                isDrawerOpen={isDrawerOpen}
                highlightedSuggestionId={highlightedSuggestionId}
                viewport={viewport}
                previewCanvasRef={previewCanvasRef}
                originalPreviewCanvasRef={originalPreviewCanvasRef}
                previewError={previewError}
                originalPreviewError={originalPreviewError}
                suggestionPoolSelectedContents={selectedSuggestionContents}
                onToggleCompare={handleToggleCompare}
                onRenameScheme={handleRenameScheme}
                onInsertToCanvas={() =>
                  activeScheme ? insertSchemeToCanvas(activeScheme) : null
                }
                isInsertDisabled={
                  !activeScheme || renderingSchemeIds.includes(activeScheme.id)
                }
                isPreparingInsert={renderingSchemeIds.includes(activeScheme?.id || "")}
                isPreviewLoading={renderingSchemeIds.includes(activeScheme?.id || "")}
                onTogglePanMode={handleTogglePanMode}
                onPreviewPointerDown={handlePreviewPointerDown}
                onPreviewPointerMove={handlePreviewPointerMove}
                onPreviewPointerUp={handlePreviewPointerUp}
                onPreviewWheel={handlePreviewWheel}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onResetZoom={handleResetZoom}
                onFitCanvas={handleFitCanvas}
                onToggleDrawer={() => setIsDrawerOpen((prev) => !prev)}
                onApplySuggestion={applySuggestionToPool}
                onHighlightSuggestion={setHighlightedSuggestionId}
                onBackToSuggestionPage={() => setIsPreviewPage(false)}
                onGeneratePlan={handleGeneratePlan}
                isStreaming={isStreaming}
                hasMessages={messages.length > 0}
                onRegenerateSummary={handleRegenerateSummary}
                isSummaryRefreshing={isStreaming}
              />
            )}
          </div>
        </div>
        <ClearSchemesConfirmDialog
          isOpen={isClearSchemesDialogOpen}
          options={clearSchemesOptions}
          onChangeOptions={setClearSchemesOptions}
          onCancel={() => {
            setIsClearSchemesDialogOpen(false);
            setClearSchemesOptions({
              alsoClearSelected: false,
              alsoClearPool: false,
            });
          }}
          onConfirm={confirmClearSchemes}
        />
      </div>
    </Dialog>
  );
};
