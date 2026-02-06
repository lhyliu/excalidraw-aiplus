import React, { useState, useCallback, useRef, useEffect, useReducer } from "react";

import {
  FONT_FAMILY,
  getFontString,
  getLineHeight,
  sceneCoordsToViewportCoords,
} from "@excalidraw/common";
import type {
  NonDeletedExcalidrawElement,
  ExcalidrawElement,
  StrokeStyle,
  Theme,
} from "@excalidraw/element/types";
import {
  getCommonBounds,
  newTextElement,
  wrapText,
} from "@excalidraw/element";

import { useApp } from "../components/App";
import { useUIAppState } from "../context/ui-appState";
import { convertMermaidToExcalidraw } from "./TTDDialog/common";
import type { MermaidToExcalidrawLibProps } from "./TTDDialog/types";
import type { BinaryFiles } from "../types";

import {
  extractDiagramInfo,
  getArchitectureAnalysisPrompt,
  generateOptimizationPlan,
  isAIConfigured,
  runAIStream,
} from "../services/aiService";

import { Dialog } from "./Dialog";
import { useAIStream } from "./hooks/useAIStream";

import {
  messagesReducer,
  type Message,
} from "./ArchitectureOptimizationDialog/messageState";

import "./ArchitectureOptimizationDialog.scss";

interface ArchitectureOptimizationDialogProps {
  elements: readonly ExcalidrawElement[];
  onClose: () => void;
  onOpenAISettings: () => void;
}

// Storage key for persisting chat history
const CHAT_STORAGE_KEY = "excalidraw_architecture_chat";
const SCHEMES_STORAGE_KEY = "excalidraw_architecture_schemes";

// Load chat history from localStorage
const loadChatHistory = (): Message[] => {
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load chat history:", e);
  }
  return [];
};

// Save chat history to localStorage
const saveChatHistory = (messages: Message[]): void => {
  try {
    // Only save non-generating messages without errors
    const messagesToSave = messages
      .filter((m) => !m.isGenerating && !m.error)
      .map(({ id, role, content }) => ({ id, role, content }));
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messagesToSave));
  } catch (e) {
    console.error("Failed to save chat history:", e);
  }
};

interface Scheme {
  id: string;
  version: number;
  summary: string;
  mermaid: string;
  shortSummary: string;
  title?: string;
}

const loadSchemes = (): Scheme[] => {
  try {
    const saved = localStorage.getItem(SCHEMES_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as Scheme[];
    }
  } catch (e) {
    console.error("Failed to load schemes:", e);
  }
  return [];
};

const saveSchemes = (schemes: Scheme[]): void => {
  try {
    localStorage.setItem(SCHEMES_STORAGE_KEY, JSON.stringify(schemes));
  } catch (e) {
    console.error("Failed to save schemes:", e);
  }
};

export const ArchitectureOptimizationDialog: React.FC<
  ArchitectureOptimizationDialogProps
> = ({ elements, onClose, onOpenAISettings }) => {
  // Load persisted messages on init
  const [messages, dispatchMessages] = useReducer(
    messagesReducer,
    undefined,
    () => loadChatHistory(),
  );
  const [inputValue, setInputValue] = useState("");
  const [schemes, setSchemes] = useState<Scheme[]>(() => loadSchemes());
  const [activeSchemeId, setActiveSchemeId] = useState<string | null>(() => {
    const savedSchemes = loadSchemes();
    return savedSchemes.length > 0 ? savedSchemes[savedSchemes.length - 1].id : null;
  });
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareSchemeId, setCompareSchemeId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<Error | null>(null);
  const [comparePreviewError, setComparePreviewError] = useState<Error | null>(
    null,
  );

  const [mermaidToExcalidrawLib, setMermaidToExcalidrawLib] =
    useState<MermaidToExcalidrawLibProps>({
      loaded: false,
      api: import("@excalidraw/mermaid-to-excalidraw"),
    });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLDivElement>(null);
  const comparePreviewCanvasRef = useRef<HTMLDivElement>(null);
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

  const app = useApp();
  const uiAppState = useUIAppState();
  const { run: runStream, abort: abortStream, isStreaming } = useAIStream();

  const getSchemeDataRef = useCallback((schemeId: string) => {
    if (!schemeDataRefs.current[schemeId]) {
      schemeDataRefs.current[schemeId] = {
        current: { elements: [], files: null },
      };
    }
    return schemeDataRefs.current[schemeId];
  }, []);

  const activeScheme =
    schemes.find((scheme) => scheme.id === activeSchemeId) ||
    schemes[schemes.length - 1] ||
    null;
  const compareScheme =
    schemes.find((scheme) => scheme.id === compareSchemeId) || null;

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
      setCompareSchemeId(null);
      return;
    }
    if (!activeSchemeId) {
      setActiveSchemeId(schemes[schemes.length - 1].id);
    }
  }, [schemes, activeSchemeId]);

  useEffect(() => {
    if (!isCompareMode) {
      return;
    }
    if (!activeScheme || schemes.length < 2) {
      setCompareSchemeId(null);
      return;
    }
    if (!compareSchemeId || compareSchemeId === activeScheme.id) {
      const fallback =
        schemes.find((scheme) => scheme.id !== activeScheme.id) ||
        schemes[0] ||
        null;
      setCompareSchemeId(fallback ? fallback.id : null);
    }
  }, [activeScheme, compareSchemeId, isCompareMode, schemes]);

  useEffect(() => {
    saveSchemes(schemes);
  }, [schemes]);

  // Render preview when result changes
  useEffect(() => {
    const renderPreview = async (
      scheme: Scheme | null,
      canvasRef: React.RefObject<HTMLDivElement | null>,
      setError: (err: Error | null) => void,
    ) => {
      if (
        !scheme?.mermaid ||
        !mermaidToExcalidrawLib.loaded ||
        !canvasRef.current
      )
        return;

      const parent = canvasRef.current.parentElement;
      if (!parent || parent.offsetWidth === 0 || parent.offsetHeight === 0) {
        if (previewRetryRef.current < 5) {
          previewRetryRef.current += 1;
          requestAnimationFrame(() => renderPreview(scheme, canvasRef, setError));
        } else {
          setError(new Error("Preview container has no size"));
        }
        return;
      }

      const dataRef = getSchemeDataRef(scheme.id);

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
    };

    previewRetryRef.current = 0;
    setPreviewError(null);
    setComparePreviewError(null);
    renderPreview(activeScheme, previewCanvasRef, setPreviewError);
    if (isCompareMode) {
      renderPreview(
        compareScheme,
        comparePreviewCanvasRef,
        setComparePreviewError,
      );
    }
  }, [
    activeScheme,
    compareScheme,
    isCompareMode,
    getSchemeDataRef,
    mermaidToExcalidrawLib.loaded,
    uiAppState.theme,
  ]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save messages to localStorage when they change (debounced)
  useEffect(() => {
    if (!isStreaming) {
      saveChatHistory(messages);
    }
  }, [messages, isStreaming]);

  const handleStartAnalysis = useCallback(async () => {
    if (isStreaming) {
      return;
    }

    const diagramInfo = extractDiagramInfo(elements);
    const systemPrompt = getArchitectureAnalysisPrompt(diagramInfo);

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

    dispatchMessages({ type: "add", messages: [userMessage, assistantMessage] });

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
            const display = `${reasoningBuffer ? `思考中：\n${reasoningBuffer}\n\n` : ""}${contentBuffer}`;
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { content: display },
            });
          },
          onReasoning: (chunk) => {
            reasoningBuffer += chunk;
            const display = `${reasoningBuffer ? `思考中：\n${reasoningBuffer}\n\n` : ""}${contentBuffer}`;
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { content: display },
            });
          },
          onComplete: () => {
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { isGenerating: false },
            });
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
  }, [elements, messages, runStream, isStreaming]);

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

    dispatchMessages({ type: "add", messages: [userMessage, assistantMessage] });
    setInputValue("");

    // Build message history for API
    const diagramInfo = extractDiagramInfo(elements);
    const systemPrompt = getArchitectureAnalysisPrompt(diagramInfo);
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
            const display = `${reasoningBuffer ? `思考中：\n${reasoningBuffer}\n\n` : ""}${contentBuffer}`;
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { content: display },
            });
          },
          onReasoning: (chunk) => {
            reasoningBuffer += chunk;
            const display = `${reasoningBuffer ? `思考中：\n${reasoningBuffer}\n\n` : ""}${contentBuffer}`;
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { content: display },
            });
          },
          onComplete: () => {
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { isGenerating: false },
            });
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
  }, [inputValue, messages, elements, runStream, isStreaming]);

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
    localStorage.removeItem(CHAT_STORAGE_KEY);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  const handleRenameScheme = useCallback((schemeId: string, title: string) => {
    setSchemes((prev) =>
      prev.map((scheme) =>
        scheme.id === schemeId ? { ...scheme, title } : scheme,
      ),
    );
  }, []);

  const handleToggleCompare = useCallback(
    (checked: boolean) => {
      setIsCompareMode(checked);
      if (checked && !compareSchemeId && schemes.length > 1) {
        const fallback =
          schemes.find((scheme) => scheme.id !== activeScheme?.id) ||
          schemes[0] ||
          null;
        setCompareSchemeId(fallback ? fallback.id : null);
      }
    },
    [activeScheme?.id, compareSchemeId, schemes],
  );

  const handleGeneratePlan = useCallback(async () => {
    if (isStreaming || messages.length === 0) return;
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
      const historyMessages = messages.filter(m => !m.error && !m.isGenerating).map(m => ({
        role: m.role,
        content: m.content
      }));

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
            const display = `${reasoningBuffer ? `思考中：\n${reasoningBuffer}\n\n` : ""}${
              summaryBuffer || "正在生成..."
            }`;
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { content: display },
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
            content:
              "AI未能生成有效的Mermaid图表代码。请尝试更具体地描述您需要的架构优化。\n\n以下是AI的回复：\n" +
              result.summary,
            isGenerating: false,
            error: "未找到Mermaid代码块",
          },
        });
        return;
      }

      const shortSummary =
        result.summary.trim().split("\n").find(Boolean)?.trim() ||
        "优化方案";
      setSchemes((prev) => {
        const nextVersion =
          prev.length > 0 ? prev[prev.length - 1].version + 1 : 1;
        const scheme: Scheme = {
          id: `scheme-${Date.now()}`,
          version: nextVersion,
          summary: result.summary,
          mermaid: result.mermaid,
          shortSummary,
          title: "",
        };
        setActiveSchemeId(scheme.id);
        return [...prev, scheme];
      });

      // Remove the temporary generating message
      dispatchMessages({ type: "remove", id: assistantMsgId });

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
    }
  }, [elements, messages, runStream, isStreaming]);

  const insertSchemeToCanvas = useCallback(
    (scheme: Scheme) => {
      const dataRef = getSchemeDataRef(scheme.id);
      if (!dataRef.current.elements || dataRef.current.elements.length === 0)
        return;

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
      const [newMinX, newMinY, newMaxX, newMaxY] =
        getCommonBounds(newElements);
      const newWidth = newMaxX - newMinX;
      const newHeight = newMaxY - newMinY;

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
        size="wide"
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
      size="wide"
    >
      <div className="architecture-optimization-dialog__content">
        <div className="architecture-optimization-dialog__split">
          <div className="architecture-optimization-dialog__panel architecture-optimization-dialog__panel--chat">
            <div className="architecture-optimization-dialog__messages">
              {messages.length === 0 ? (
                <div className="architecture-optimization-dialog__welcome">
                  <h3>🏗️ AI架构助手</h3>
                  <p>分析您的架构图并提供专业的优化建议。</p>
                  <div className="architecture-optimization-dialog__welcome-actions">
                    <button
                      className="architecture-optimization-dialog__button architecture-optimization-dialog__button--primary"
                      onClick={handleStartAnalysis}
                      disabled={isStreaming}
                    >
                      开始分析当前架构
                    </button>
                  </div>
                  <p className="architecture-optimization-dialog__welcome-hint">
                    或直接在下方输入您的问题
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`architecture-optimization-dialog__message architecture-optimization-dialog__message--${message.role}`}
                  >
                    <div className="architecture-optimization-dialog__message-content">
                      {message.content}
                      {message.isGenerating && (
                        <span className="architecture-optimization-dialog__cursor">
                          ▌
                        </span>
                      )}
                    </div>
                    {message.error && (
                      <div className="architecture-optimization-dialog__message-error">
                        错误: {message.error}
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="architecture-optimization-dialog__input-area">
              {messages.length > 0 && (
                <div className="architecture-optimization-dialog__input-toolbar">
                  <button
                    className="architecture-optimization-dialog__clear-button"
                    onClick={handleClearHistory}
                    disabled={isStreaming}
                    title="清除对话历史"
                  >
                    🗑️ 清除
                  </button>
                  <button
                    className="architecture-optimization-dialog__action-button"
                    onClick={handleGeneratePlan}
                    disabled={isStreaming}
                    title="生成优化方案及新图表"
                  >
                    ✨ 生成优化方案
                  </button>
                </div>
              )}
              <textarea
                className="architecture-optimization-dialog__input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入您的问题，例如：如何提高这个架构的可扩展性？"
                disabled={isStreaming}
                rows={2}
              />
              <div className="architecture-optimization-dialog__input-actions">
                {isStreaming ? (
                  <button
                    className="architecture-optimization-dialog__button architecture-optimization-dialog__button--abort"
                    onClick={handleAbort}
                  >
                    停止
                  </button>
                ) : (
                  <button
                    className="architecture-optimization-dialog__button architecture-optimization-dialog__button--send"
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim()}
                  >
                    发送
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="architecture-optimization-dialog__panel architecture-optimization-dialog__panel--preview">
            <div className="architecture-optimization-dialog__scheme-tabs">
              {schemes.map((scheme) => {
                const isActive = scheme.id === activeScheme?.id;
                const tabTitle = scheme.title?.trim() || scheme.shortSummary;
                return (
                  <button
                    key={scheme.id}
                    className={`architecture-optimization-dialog__scheme-tab ${
                      isActive
                        ? "architecture-optimization-dialog__scheme-tab--active"
                        : ""
                    }`}
                    onClick={() => setActiveSchemeId(scheme.id)}
                    type="button"
                  >
                    <span className="architecture-optimization-dialog__scheme-tab-version">
                      方案 {scheme.version}
                    </span>
                    <span className="architecture-optimization-dialog__scheme-tab-summary">
                      {tabTitle}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeScheme ? (
              <>
                <div className="architecture-optimization-dialog__preview-toolbar">
                  <div className="architecture-optimization-dialog__scheme-title">
                    <label htmlFor="scheme-title">方案名称</label>
                    <input
                      id="scheme-title"
                      type="text"
                      value={activeScheme.title || ""}
                      onChange={(e) =>
                        handleRenameScheme(activeScheme.id, e.target.value)
                      }
                      placeholder="为方案起个名字"
                    />
                  </div>
                  <label className="architecture-optimization-dialog__compare-toggle">
                    <input
                      type="checkbox"
                      checked={isCompareMode}
                      onChange={(e) => handleToggleCompare(e.target.checked)}
                      disabled={schemes.length < 2}
                    />
                    对比模式
                  </label>
                  {isCompareMode && (
                    <select
                      className="architecture-optimization-dialog__compare-select"
                      value={compareScheme?.id || ""}
                      onChange={(e) => setCompareSchemeId(e.target.value)}
                      disabled={schemes.length < 2}
                    >
                      {!compareScheme && (
                        <option value="">请选择对比方案</option>
                      )}
                      {schemes
                        .filter((scheme) => scheme.id !== activeScheme.id)
                        .map((scheme) => (
                          <option key={scheme.id} value={scheme.id}>
                            方案 {scheme.version} ·{" "}
                            {scheme.title?.trim() || scheme.shortSummary}
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                <div className="architecture-optimization-dialog__result-preview">
                  <h4>新架构预览 (Mermaid)</h4>
                  <div
                    className={`architecture-optimization-dialog__preview-grid ${
                      isCompareMode
                        ? "architecture-optimization-dialog__preview-grid--compare"
                        : ""
                    }`}
                  >
                    <div className="architecture-optimization-dialog__preview-card">
                      <div className="architecture-optimization-dialog__preview-label">
                        当前方案
                      </div>
                      <div className="architecture-optimization-dialog__preview-canvas">
                        <div
                          ref={previewCanvasRef}
                          className="architecture-optimization-dialog__preview-canvas-inner"
                        />
                        {previewError && (
                          <div className="architecture-optimization-dialog__preview-error">
                            <div>无法渲染预览：{previewError.message}</div>
                            {activeScheme?.mermaid && (
                              <pre className="architecture-optimization-dialog__preview-error-mermaid">
                                {activeScheme.mermaid}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {isCompareMode && compareScheme && (
                      <div className="architecture-optimization-dialog__preview-card">
                        <div className="architecture-optimization-dialog__preview-label">
                          对比方案
                        </div>
                        <div className="architecture-optimization-dialog__preview-canvas">
                          <div
                            ref={comparePreviewCanvasRef}
                            className="architecture-optimization-dialog__preview-canvas-inner"
                          />
                          {comparePreviewError && (
                            <div className="architecture-optimization-dialog__preview-error">
                              <div>
                                无法渲染预览：{comparePreviewError.message}
                              </div>
                              {compareScheme?.mermaid && (
                                <pre className="architecture-optimization-dialog__preview-error-mermaid">
                                  {compareScheme.mermaid}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <details className="architecture-optimization-dialog__accordion">
                  <summary>优化方案建议</summary>
                  <div className="architecture-optimization-dialog__result-summary">
                    <pre>{activeScheme.summary}</pre>
                  </div>
                </details>
              </>
            ) : (
              <div className="architecture-optimization-dialog__empty">
                暂无优化方案，点击“生成优化方案”开始。
              </div>
            )}

            <div className="architecture-optimization-dialog__preview-actions">
              <button
                onClick={() =>
                  activeScheme ? insertSchemeToCanvas(activeScheme) : null
                }
                className="architecture-optimization-dialog__button--primary"
                disabled={!activeScheme}
              >
                插入到主图旁
              </button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
