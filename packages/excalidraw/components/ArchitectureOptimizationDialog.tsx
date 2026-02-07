import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useReducer,
  useMemo,
} from "react";

import {
  FONT_FAMILY,
  getFontString,
  getLineHeight,
  sceneCoordsToViewportCoords,
} from "@excalidraw/common";

import {
  getCommonBounds,
  isNonDeletedElement,
  newTextElement,
  wrapText,
} from "@excalidraw/element";

import type {
  NonDeletedExcalidrawElement,
  ExcalidrawElement,
  StrokeStyle,
  Theme,
} from "@excalidraw/element/types";

import { useApp } from "../components/App";
import { useUIAppState } from "../context/ui-appState";
import { exportToSvg } from "../scene/export";

import {
  extractDiagramInfo,
  getArchitectureAnalysisPrompt,
  generateOptimizationPlan,
  isAIConfigured,
  runAIStream,
} from "../services/aiService";

import { convertMermaidToExcalidraw } from "./TTDDialog/common";

import { Dialog } from "./Dialog";
import { ChatPanel } from "./ArchitectureOptimizationDialog/ChatPanel";
import {
  categoryLabels,
  compactSuggestionContent,
  extractTitle,
  normalizeSuggestionContent,
  parseSuggestions,
} from "./ArchitectureOptimizationDialog/model";
import { PreviewPage } from "./ArchitectureOptimizationDialog/PreviewPage";
import { SchemeTabs } from "./ArchitectureOptimizationDialog/SchemeTabs";
import { WorkflowPage } from "./ArchitectureOptimizationDialog/WorkflowPage";
import { useAIStream } from "./hooks/useAIStream";

import {
  messagesReducer,
  type Message,
} from "./ArchitectureOptimizationDialog/messageState";
import "./ArchitectureOptimizationDialog.scss";

import type {
  ArchitectureStyle,
  PersistedAssistantState,
  PoolSuggestion,
  Scheme,
  Suggestion,
  SuggestionCategory,
  SuggestionCombination,
} from "./ArchitectureOptimizationDialog/model";
import type { BinaryFiles } from "../types";
import type { MermaidToExcalidrawLibProps } from "./TTDDialog/types";

interface ArchitectureOptimizationDialogProps {
  elements: readonly ExcalidrawElement[];
  onClose: () => void;
  onOpenAISettings: () => void;
}

// Storage key for persisting chat history
const CHAT_STORAGE_KEY = "excalidraw_architecture_chat";
const SCHEMES_STORAGE_KEY = "excalidraw_architecture_schemes";
const ASSISTANT_STATE_STORAGE_KEY = "excalidraw_architecture_assistant_state";
const ARCHITECTURE_DIALOG_WIDTH = 1500;

const getScopedStorageKey = (baseKey: string, scope?: string) =>
  scope ? `${baseKey}::${scope}` : baseKey;

// Load chat history from localStorage
const loadChatHistory = (scope?: string): Message[] => {
  try {
    const saved =
      localStorage.getItem(getScopedStorageKey(CHAT_STORAGE_KEY, scope)) ||
      localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load chat history:", e);
  }
  return [];
};

// Save chat history to localStorage
const saveChatHistory = (messages: Message[], scope?: string): void => {
  try {
    // Only save non-generating messages without errors
    const messagesToSave = messages
      .filter((m) => !m.isGenerating && !m.error)
      .map(({ id, role, content }) => ({ id, role, content }));
    localStorage.setItem(
      getScopedStorageKey(CHAT_STORAGE_KEY, scope),
      JSON.stringify(messagesToSave),
    );
  } catch (e) {
    console.error("Failed to save chat history:", e);
  }
};

const loadSchemes = (scope?: string): Scheme[] => {
  try {
    const saved =
      localStorage.getItem(getScopedStorageKey(SCHEMES_STORAGE_KEY, scope)) ||
      localStorage.getItem(SCHEMES_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as Scheme[];
    }
  } catch (e) {
    console.error("Failed to load schemes:", e);
  }
  return [];
};

const saveSchemes = (schemes: Scheme[], scope?: string): void => {
  try {
    localStorage.setItem(
      getScopedStorageKey(SCHEMES_STORAGE_KEY, scope),
      JSON.stringify(schemes),
    );
  } catch (e) {
    console.error("Failed to save schemes:", e);
  }
};

const loadAssistantState = (scope?: string): PersistedAssistantState | null => {
  try {
    const saved =
      localStorage.getItem(
        getScopedStorageKey(ASSISTANT_STATE_STORAGE_KEY, scope),
      ) || localStorage.getItem(ASSISTANT_STATE_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as PersistedAssistantState;
    }
  } catch (e) {
    console.error("Failed to load assistant state:", e);
  }
  return null;
};

const saveAssistantState = (
  state: PersistedAssistantState,
  scope?: string,
): void => {
  try {
    localStorage.setItem(
      getScopedStorageKey(ASSISTANT_STATE_STORAGE_KEY, scope),
      JSON.stringify(state),
    );
  } catch (e) {
    console.error("Failed to save assistant state:", e);
  }
};

export const ArchitectureOptimizationDialog: React.FC<
  ArchitectureOptimizationDialogProps
> = ({ elements, onClose, onOpenAISettings }) => {
  const app = useApp();
  const uiAppState = useUIAppState();
  const storageScope = (uiAppState.name || "default").trim();

  // Load persisted messages on init
  const [messages, dispatchMessages] = useReducer(
    messagesReducer,
    undefined,
    () => loadChatHistory(storageScope),
  );
  const [inputValue, setInputValue] = useState(
    () => loadAssistantState(storageScope)?.draftInput ?? "",
  );
  const [schemes, setSchemes] = useState<Scheme[]>(() =>
    loadSchemes(storageScope),
  );
  const [activeSchemeId, setActiveSchemeId] = useState<string | null>(() => {
    const savedAssistantState = loadAssistantState(storageScope);
    if (savedAssistantState?.activeSchemeId) {
      return savedAssistantState.activeSchemeId;
    }
    const savedSchemes = loadSchemes(storageScope);
    return savedSchemes.length > 0
      ? savedSchemes[savedSchemes.length - 1].id
      : null;
  });
  const [isCompareMode, setIsCompareMode] = useState(
    () => loadAssistantState(storageScope)?.isCompareMode ?? false,
  );
  const [previewError, setPreviewError] = useState<Error | null>(null);
  const [originalPreviewError, setOriginalPreviewError] =
    useState<Error | null>(null);
  const [renderingSchemes, setRenderingSchemes] = useState<Set<string>>(
    new Set(),
  );
  const [deletedSchemesBuffer, setDeletedSchemesBuffer] = useState<{
    schemes: Scheme[];
    activeId: string | null;
    timeoutId: number;
  } | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);

  // Advanced workbench state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [highlightedSuggestionId, setHighlightedSuggestionId] = useState<
    string | null
  >(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanMode, setIsPanMode] = useState(false);

  // Semi-automatic workflow state
  const [suggestionPool, setSuggestionPool] = useState<PoolSuggestion[]>(
    () => loadAssistantState(storageScope)?.suggestionPool ?? [],
  );
  const [suggestionCombinations, setSuggestionCombinations] = useState<
    SuggestionCombination[]
  >(() => loadAssistantState(storageScope)?.suggestionCombinations ?? []);
  const [activeCombinationId, setActiveCombinationId] = useState<string | null>(
    () => loadAssistantState(storageScope)?.activeCombinationId ?? null,
  );
  const [architectureStyle, setArchitectureStyle] = useState<ArchitectureStyle>(
    () => loadAssistantState(storageScope)?.architectureStyle ?? "standard",
  );
  const [skipUpdateConfirm, setSkipUpdateConfirm] = useState(
    () => loadAssistantState(storageScope)?.skipUpdateConfirm ?? false,
  );
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(
    null,
  );
  const [suggestionSearchKeyword, setSuggestionSearchKeyword] = useState(
    () => loadAssistantState(storageScope)?.suggestionSearchKeyword ?? "",
  );
  const [showArchivedSuggestions, setShowArchivedSuggestions] = useState(
    () => loadAssistantState(storageScope)?.showArchivedSuggestions ?? false,
  );
  const [suggestionToast, setSuggestionToast] = useState<string | null>(null);
  const [expandedSuggestionIds, setExpandedSuggestionIds] = useState<
    Set<string>
  >(new Set());
  const [isPreviewPage, setIsPreviewPage] = useState(
    () => loadAssistantState(storageScope)?.isPreviewPage ?? false,
  );

  const [mermaidToExcalidrawLib, setMermaidToExcalidrawLib] =
    useState<MermaidToExcalidrawLibProps>({
      loaded: false,
      api: import("@excalidraw/mermaid-to-excalidraw"),
    });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const previewCanvasRef = useRef<HTMLDivElement>(null);
  const originalPreviewCanvasRef = useRef<HTMLDivElement>(null);
  const previewRetryRef = useRef(0);
  const suggestionToastTimerRef = useRef<number | null>(null);
  const stagingAreaRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);
  const schemeDataRefs = useRef<
    Record<
      string,
      React.MutableRefObject<{
        elements: readonly NonDeletedExcalidrawElement[];
        files: BinaryFiles | null;
      }>
    >
  >({});

  const { run: runStream, abort: abortStream, isStreaming } = useAIStream();

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

      if (contentWidth <= 0 || contentHeight <= 0) {
        setViewport({ x: 0, y: 0, zoom: 1 });
        return;
      }

      // Keep larger safety margin so tall diagrams won't appear clipped
      // at default fit and won't visually "push" the preview frame.
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
    [getSchemeDataRef],
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

  const activeScheme =
    schemes.find((scheme) => scheme.id === activeSchemeId) ||
    schemes[schemes.length - 1] ||
    null;
  const activeSchemeSuggestions = useMemo(
    () => (activeScheme ? parseSuggestions(activeScheme.summary) : []),
    [activeScheme],
  );

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

  useEffect(() => {
    saveSchemes(schemes, storageScope);
  }, [schemes, storageScope]);

  useEffect(() => {
    saveAssistantState(
      {
        suggestionPool,
        suggestionCombinations,
        activeCombinationId,
        architectureStyle,
        skipUpdateConfirm,
        suggestionSearchKeyword,
        showArchivedSuggestions,
        draftInput: inputValue,
        activeSchemeId,
        isPreviewPage,
        isCompareMode,
      },
      storageScope,
    );
  }, [
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
    storageScope,
  ]);

  // Render preview when result changes
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
      if (
        !scheme?.mermaid ||
        !mermaidToExcalidrawLib.loaded ||
        !canvasRef.current
      ) {
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

      // Mark scheme as rendering
      setRenderingSchemes((prev) => new Set(prev).add(scheme.id));

      try {
        await convertMermaidToExcalidraw({
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
          theme: uiAppState.theme as Theme,
        });
        if (autoFit) {
          scheduleFitPreview(canvasRef, scheme.id);
        }
      } finally {
        // Mark scheme as finished rendering
        setRenderingSchemes((prev) => {
          const next = new Set(prev);
          next.delete(scheme.id);
          return next;
        });
      }
    };

    previewRetryRef.current = 0;
    setPreviewError(null);
    renderPreview(activeScheme, previewCanvasRef, setPreviewError, true);
  }, [
    activeScheme,
    getSchemeDataRef,
    isPreviewPage,
    mermaidToExcalidrawLib,
    mermaidToExcalidrawLib.loaded,
    scheduleFitPreview,
    uiAppState.theme,
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
      // Auto-fit on container resize (windowed mode / compare toggle / layout changes).
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
            viewBackgroundColor: uiAppState.viewBackgroundColor,
            exportWithDarkMode: uiAppState.theme === "dark",
            frameRendering: uiAppState.frameRendering,
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
    isCompareMode,
    isPreviewPage,
    uiAppState.frameRendering,
    uiAppState.theme,
    uiAppState.viewBackgroundColor,
  ]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save messages to localStorage when they change (debounced)
  useEffect(() => {
    if (!isStreaming) {
      saveChatHistory(messages, storageScope);
    }
  }, [messages, isStreaming, storageScope]);

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
          `- [${categoryLabels[s.category]}] ${s.fullContent}${
            s.note ? ` (备注: ${s.note})` : ""
          }`,
      )
      .join("\n");
    const systemPrompt = `${getArchitectureAnalysisPrompt(diagramInfo)}${
      selectedContext
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
                  prev.map((p) => p.content.slice(0, 50)),
                );
                const unique = parsed
                  .filter(
                    (s) =>
                      !existing.has(
                        compactSuggestionContent(s.content).slice(0, 50),
                      ),
                  )
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
          `- [${categoryLabels[s.category]}] ${s.fullContent}${
            s.note ? ` (备注: ${s.note})` : ""
          }`,
      )
      .join("\n");
    const systemPrompt = `${getArchitectureAnalysisPrompt(diagramInfo)}${
      selectedContext
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
      // Avoid duplicates by checking content similarity
      const existing = new Set(prev.map((p) => p.content.slice(0, 50)));
      const unique = newSuggestions.filter(
        (s) =>
          !existing.has(compactSuggestionContent(s.fullContent).slice(0, 50)),
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
    setSuggestionPool((prev) => {
      const existing = prev.find(
        (item) => item.content.slice(0, 50) === compactSuggestion.slice(0, 50),
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

  const handleToggleExpandedSuggestion = useCallback((id: string) => {
    setExpandedSuggestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSaveCombination = useCallback(() => {
    if (selectedSuggestionIds.length === 0) {
      setSuggestionToast("请先勾选建议再保存组合");
      return;
    }
    const name = window
      .prompt("请输入组合名称", `组合 ${suggestionCombinations.length + 1}`)
      ?.trim();
    if (!name) {
      return;
    }

    const combination: SuggestionCombination = {
      id: `comb-${Date.now()}`,
      name,
      suggestionIds: selectedSuggestionIds,
      createdAt: Date.now(),
    };
    setSuggestionCombinations((prev) => [...prev, combination]);
    setActiveCombinationId(combination.id);
    setSuggestionToast(`已保存组合：${name}`);
  }, [selectedSuggestionIds, suggestionCombinations.length]);

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

  const removeCombination = useCallback((combinationId: string) => {
    setSuggestionCombinations((prev) =>
      prev.filter((combination) => combination.id !== combinationId),
    );
    setActiveCombinationId((prev) => (prev === combinationId ? null : prev));
  }, []);

  const archiveSuggestion = useCallback((id: string) => {
    setSuggestionPool((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, archived: true, selected: false } : s,
      ),
    );
    setSuggestionToast("建议已归档");
  }, []);

  const clearSuggestionPool = useCallback(() => {
    if (suggestionPool.length === 0 && suggestionCombinations.length === 0) {
      return;
    }
    const confirmed = window.confirm(
      "将清空建议列表及所有组合，该操作不可恢复。是否继续？",
    );
    if (!confirmed) {
      return;
    }
    setSuggestionPool([]);
    setSuggestionCombinations([]);
    setActiveCombinationId(null);
    setExpandedSuggestionIds(new Set());
    setEditingSuggestionId(null);
    setSuggestionToast("建议列表已清空");
  }, [suggestionPool.length, suggestionCombinations.length]);

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

  const runPlanGeneration = useCallback(
    async (
      extraContext?: string,
      options?: {
        targetSchemeId?: string | null;
        forceCreate?: boolean;
        sourceCombinationId?: string | null;
        sourceSuggestionIds?: string[];
        sourceSuggestionSnapshot?: Array<{
          id: string;
          category: SuggestionCategory;
          title: string;
          content: string;
          fullContent: string;
          note?: string;
        }>;
      },
    ): Promise<{ schemeId: string; wasUpdated: boolean } | null> => {
      if (isStreaming || (messages.length === 0 && !extraContext?.trim())) {
        return null;
      }
      const diagramInfo = extractDiagramInfo(elements);

      // Add a temporary system message to show what's happening
      const assistantMsgId = `msg-${Date.now()}`;
      dispatchMessages({
        type: "add",
        messages: [
          {
            id: assistantMsgId,
            role: "assistant",
            content: "正在生成优化方案和新架构图...",
            isGenerating: true,
          },
        ],
      });

      try {
        // Messages history
        const historyMessages = messages
          .filter((m) => !m.error && !m.isGenerating)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        if (extraContext?.trim()) {
          historyMessages.push({
            role: "user",
            content: extraContext.trim(),
          });
        }

        let reasoningBuffer = "";
        let summaryBuffer = "";
        const streamResult = await runStream((signal) =>
          generateOptimizationPlan(
            historyMessages,
            diagramInfo,
            (chunk) => {
              if (chunk.reasoning) {
                reasoningBuffer += chunk.reasoning;
              }
              if (chunk.summary) {
                summaryBuffer = chunk.summary;
              }
              dispatchMessages({
                type: "update",
                id: assistantMsgId,
                patch: {
                  content: summaryBuffer || "正在生成...",
                  reasoning: reasoningBuffer || undefined,
                },
              });
            },
            signal,
          ),
        );

        if (!streamResult.success) {
          throw new Error(streamResult.error || "Unknown error");
        }
        const result = streamResult.data;

        // Validate result
        if (!result.mermaid || result.mermaid.trim() === "") {
          // No Mermaid code found - show error
          dispatchMessages({
            type: "update",
            id: assistantMsgId,
            patch: {
              content: `AI未能生成有效的Mermaid图表代码。请尝试更具体地描述您需要的架构优化。\n\n以下是AI的回复：\n${result.summary}`,
              isGenerating: false,
              error: "未找到Mermaid代码块",
            },
          });
          return null;
        }

        const shortSummary =
          result.summary.trim().split("\n").find(Boolean)?.trim() || "优化方案";
        let generatedVersion = 1;
        let wasUpdated = false;
        const targetSchemeId = options?.targetSchemeId ?? activeSchemeId;
        const shouldForceCreate = options?.forceCreate === true;
        const canUpdateExistingBySnapshot =
          !shouldForceCreate &&
          !!targetSchemeId &&
          schemes.some((s) => s.id === targetSchemeId);
        const createdSchemeId = `scheme-${Date.now()}`;
        const resolvedSchemeId =
          canUpdateExistingBySnapshot && targetSchemeId
            ? targetSchemeId
            : createdSchemeId;

        setSchemes((prev) => {
          const canUpdateExisting =
            !shouldForceCreate &&
            !!targetSchemeId &&
            prev.some((s) => s.id === targetSchemeId);

          if (canUpdateExisting && targetSchemeId) {
            const updated = prev.map((scheme) =>
              scheme.id === targetSchemeId
                ? {
                    ...scheme,
                    summary: result.summary,
                    mermaid: result.mermaid,
                    shortSummary,
                    sourceCombinationId: options?.sourceCombinationId ?? null,
                    sourceSuggestionIds: options?.sourceSuggestionIds ?? [],
                    sourceSuggestionSnapshot:
                      options?.sourceSuggestionSnapshot ?? [],
                  }
                : scheme,
            );
            const updatedScheme = updated.find((s) => s.id === targetSchemeId);
            generatedVersion = updatedScheme?.version ?? 1;
            wasUpdated = true;
            return updated;
          }

          const nextVersion =
            prev.length > 0 ? prev[prev.length - 1].version + 1 : 1;
          generatedVersion = nextVersion;
          const scheme: Scheme = {
            id: createdSchemeId,
            version: nextVersion,
            summary: result.summary,
            mermaid: result.mermaid,
            shortSummary,
            title: "",
            sourceCombinationId: options?.sourceCombinationId ?? null,
            sourceSuggestionIds: options?.sourceSuggestionIds ?? [],
            sourceSuggestionSnapshot: options?.sourceSuggestionSnapshot ?? [],
          };
          return [...prev, scheme];
        });
        setActiveSchemeId(resolvedSchemeId);
        setIsPreviewPage(true);
        setSuggestionToast(
          wasUpdated
            ? `已更新方案 ${generatedVersion}，可插入到主图旁`
            : `已生成方案 ${generatedVersion}，可插入到主图旁`,
        );
        if (suggestionToastTimerRef.current) {
          clearTimeout(suggestionToastTimerRef.current);
        }
        suggestionToastTimerRef.current = window.setTimeout(() => {
          setSuggestionToast(null);
          suggestionToastTimerRef.current = null;
        }, 2200);

        // Remove the temporary generating message
        dispatchMessages({ type: "remove", id: assistantMsgId });
        return { schemeId: resolvedSchemeId, wasUpdated };
      } catch (error) {
        console.error("Optimization failed", error);
        dispatchMessages({
          type: "update",
          id: assistantMsgId,
          patch: {
            content: String(error).includes("Request aborted")
              ? "已停止生成。"
              : "生成优化方案失败。",
            isGenerating: false,
            error: String(error),
          },
        });
        return null;
      }
    },
    [elements, messages, runStream, isStreaming, activeSchemeId, schemes],
  );

  // Generate architecture from selected suggestions
  const buildGenerationPrompt = useCallback(() => {
    if (selectedSuggestions.length === 0) {
      return;
    }

    const context = selectedSuggestions
      .map(
        (s) =>
          `- [${categoryLabels[s.category]}] ${s.content}${
            s.note ? ` (备注: ${s.note})` : ""
          }`,
      )
      .join("\n");

    const stylePrompt =
      architectureStyle === "minimal"
        ? "生成极简风格的架构图，只包含核心组件。"
        : architectureStyle === "detailed"
        ? "生成详细的架构图，包含所有子组件和连接。"
        : "生成标准风格的架构图。";

    return `基于以下已选优化建议，${stylePrompt}\n\n已选建议：\n${context}`;
  }, [selectedSuggestions, architectureStyle]);

  const generateNewFromSelected = useCallback(async () => {
    const prompt = buildGenerationPrompt();
    if (!prompt) {
      return;
    }

    const result = await runPlanGeneration(prompt, {
      targetSchemeId: activeSchemeId,
      forceCreate: true,
      sourceCombinationId: activeCombinationId,
      sourceSuggestionIds: selectedSuggestionIds,
      sourceSuggestionSnapshot: selectedSuggestionSnapshot,
    });
    if (result?.schemeId) {
      setActiveSchemeId(result.schemeId);
      setIsPreviewPage(true);
    }
  }, [
    buildGenerationPrompt,
    runPlanGeneration,
    activeSchemeId,
    activeCombinationId,
    selectedSuggestionIds,
    selectedSuggestionSnapshot,
  ]);

  const updateCurrentFromSelected = useCallback(async () => {
    const prompt = buildGenerationPrompt();
    if (!prompt || !activeSchemeId) {
      return;
    }

    if (!skipUpdateConfirm) {
      const confirmed = window.confirm(
        "将覆盖当前方案内容，历史内容不可自动恢复。是否继续？",
      );
      if (!confirmed) {
        return;
      }
      const dontAskAgain = window.confirm("后续更新当前方案时不再提示？");
      if (dontAskAgain) {
        setSkipUpdateConfirm(true);
      }
    }

    const result = await runPlanGeneration(prompt, {
      targetSchemeId: activeSchemeId,
      forceCreate: false,
      sourceCombinationId: activeCombinationId,
      sourceSuggestionIds: selectedSuggestionIds,
      sourceSuggestionSnapshot: selectedSuggestionSnapshot,
    });
    if (result?.schemeId) {
      setActiveSchemeId(result.schemeId);
      setIsPreviewPage(true);
    }
  }, [
    buildGenerationPrompt,
    activeSchemeId,
    skipUpdateConfirm,
    runPlanGeneration,
    activeCombinationId,
    selectedSuggestionIds,
    selectedSuggestionSnapshot,
  ]);

  const handleZoomIn = useCallback(() => {
    setViewport((prev) => ({ ...prev, zoom: Math.min(2.5, prev.zoom + 0.1) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewport((prev) => ({ ...prev, zoom: Math.max(0.1, prev.zoom - 0.1) }));
  }, []);

  const handleResetZoom = useCallback(() => {
    setViewport((prev) => ({ ...prev, x: 0, y: 0, zoom: 1 }));
    panStartRef.current = null;
  }, []);

  const handleTogglePanMode = useCallback(() => {
    setIsPanMode((prev) => !prev);
    panStartRef.current = null;
  }, []);

  const handleFitCanvas = useCallback(() => {
    panStartRef.current = null;
    if (activeScheme) {
      scheduleFitPreview(previewCanvasRef, activeScheme.id);
      return;
    }
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, [activeScheme, scheduleFitPreview]);

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
    [isPanMode],
  );

  const handlePreviewPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanMode) {
        return;
      }
      panStartRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [isPanMode],
  );

  const handlePreviewWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!e.ctrlKey && !e.metaKey) {
        return;
      }
      e.preventDefault();
      const delta = -e.deltaY;
      const step = delta > 0 ? 0.08 : -0.08;
      setViewport((prev) => ({
        ...prev,
        zoom: Math.min(3, Math.max(0.08, prev.zoom + step)),
      }));
    },
    [],
  );

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
    // Keep composer compact so action buttons always stay visible.
    const maxHeight =
      chatPanelHeight > 0
        ? Math.min(180, Math.floor(chatPanelHeight * 0.32))
        : 160;
    const minHeight = 44;

    textarea.style.maxHeight = `${maxHeight}px`;
    textarea.style.height = `${minHeight}px`;
    const nextHeight = Math.max(
      minHeight,
      Math.min(textarea.scrollHeight, maxHeight),
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
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
        }, 5000),
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
    const result = await runPlanGeneration(undefined, {
      forceCreate: true,
      sourceCombinationId: activeCombinationId,
      sourceSuggestionIds: selectedSuggestionIds,
      sourceSuggestionSnapshot: selectedSuggestionSnapshot,
    });
    if (result?.schemeId) {
      setActiveSchemeId(result.schemeId);
      setIsPreviewPage(true);
    }
  }, [
    runPlanGeneration,
    activeCombinationId,
    selectedSuggestionIds,
    selectedSuggestionSnapshot,
  ]);

  const handleRegenerateSummary = useCallback(async () => {
    if (!activeScheme || isStreaming) {
      return;
    }

    const schemeId = activeScheme.id;
    const originalSummary = activeScheme.summary;
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
            ? { ...scheme, summary: originalSummary }
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
            ? { ...scheme, summary: originalSummary }
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
              shortSummary,
            }
          : scheme,
      ),
    );
    setSuggestionToast("AI总结已更新");
  }, [activeScheme, isStreaming, runStream]);

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
    [schemes, suggestionCombinations, applyCombination],
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

  // Show configuration prompt if AI is not configured
  if (!isAIConfigured()) {
    return (
      <Dialog
        className="architecture-optimization-dialog"
        onCloseRequest={onClose}
        title="AI架构助手"
        size={ARCHITECTURE_DIALOG_WIDTH}
      >
        <div className="architecture-optimization-dialog__not-configured">
          <p>请先配置AI API设置以使用AI架构助手功能。</p>
          <button
            className="architecture-optimization-dialog__config-button"
            onClick={onOpenAISettings}
          >
            打开AI设置
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      className="architecture-optimization-dialog"
      onCloseRequest={onClose}
      title="AI架构助手"
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
              <div className="scheme-undo-toast">
                <span>已删除 {deletedSchemesBuffer.schemes.length} 个方案</span>
                <button onClick={handleUndoDelete}>撤销</button>
                <button onClick={() => setShowUndoToast(false)}>✕</button>
                <div className="scheme-undo-toast__progress" />
              </div>
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
                suggestionCombinations={suggestionCombinations}
                activeCombinationId={activeCombinationId}
                suggestionPool={suggestionPool}
                visibleSuggestions={visibleSuggestions}
                suggestionSearchKeyword={suggestionSearchKeyword}
                showArchivedSuggestions={showArchivedSuggestions}
                editingSuggestionId={editingSuggestionId}
                expandedSuggestionIds={expandedSuggestionIds}
                architectureStyle={architectureStyle}
                activeSchemeId={activeSchemeId}
                isStreaming={isStreaming}
                onSaveCombination={handleSaveCombination}
                onClearSelectedSuggestions={handleClearSelectedSuggestions}
                onApplyCombination={applyCombination}
                onRemoveCombination={removeCombination}
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
                  !activeScheme || renderingSchemes.has(activeScheme.id)
                }
                isPreparingInsert={renderingSchemes.has(activeScheme?.id || "")}
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
      </div>
    </Dialog>
  );
};
