import React, { useState, useCallback, useRef, useEffect, useReducer } from "react";

import type {
  NonDeletedExcalidrawElement,
  ExcalidrawElement,
  Theme,
} from "@excalidraw/element/types";

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

import { messagesReducer, type Message } from "./ArchitectureOptimizationDialog/messageState";

import "./ArchitectureOptimizationDialog.scss";

interface ArchitectureOptimizationDialogProps {
  elements: readonly ExcalidrawElement[];
  onClose: () => void;
  onOpenAISettings: () => void;
}

// Storage key for persisting chat history
const CHAT_STORAGE_KEY = "excalidraw_architecture_chat";

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

interface OptimizationResult {
  summary: string;
  mermaid: string;
}

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
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [previewError, setPreviewError] = useState<Error | null>(null);

  const [mermaidToExcalidrawLib, setMermaidToExcalidrawLib] =
    useState<MermaidToExcalidrawLibProps>({
      loaded: false,
      api: import("@excalidraw/mermaid-to-excalidraw"),
    });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLDivElement>(null);
  const previewRetryRef = useRef(0);
  const parsedData = useRef<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>({ elements: [], files: null });

  const app = useApp();
  const uiAppState = useUIAppState();
  const { run: runStream, abort: abortStream, isStreaming } = useAIStream();

  useEffect(() => {
    const fn = async () => {
      await mermaidToExcalidrawLib.api;
      setMermaidToExcalidrawLib((prev) => ({ ...prev, loaded: true }));
    };
    fn();
  }, [mermaidToExcalidrawLib.api]);

  // Render preview when result changes
  useEffect(() => {
    const renderPreview = async () => {
      if (!optimizationResult?.mermaid || !mermaidToExcalidrawLib.loaded || !previewCanvasRef.current) return;

      const parent = previewCanvasRef.current.parentElement;
      if (!parent || parent.offsetWidth === 0 || parent.offsetHeight === 0) {
        if (previewRetryRef.current < 5) {
          previewRetryRef.current += 1;
          requestAnimationFrame(renderPreview);
        } else {
          setPreviewError(new Error("Preview container has no size"));
        }
        return;
      }

      await convertMermaidToExcalidraw({
        canvasRef: previewCanvasRef,
        mermaidToExcalidrawLib,
        mermaidDefinition: optimizationResult.mermaid,
        setError: (err) => {
          setPreviewError(err);
          if (err) {
            console.error("Mermaid preview error", err);
          }
        },
        data: parsedData,
        theme: uiAppState.theme as Theme,
      });
    };
    previewRetryRef.current = 0;
    setPreviewError(null);
    renderPreview();
  }, [optimizationResult, mermaidToExcalidrawLib.loaded, uiAppState.theme]);

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
      predicate: (m) => m.role === "assistant" && m.isGenerating,
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

      setOptimizationResult(result);

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

  const handleInsertDiagram = () => {
    if (!parsedData.current.elements || parsedData.current.elements.length === 0) return;

    const newElements = parsedData.current.elements;
    const files = parsedData.current.files;

    // Calculate bounding box of reference elements (props.elements or all non-deleted)
    const referenceElements = elements.length > 0 ? elements : app.scene.getNonDeletedElements();

    let maxX = -Infinity;
    let minY = Infinity;

    if (referenceElements.length > 0) {
      for (const element of referenceElements) {
        maxX = Math.max(maxX, element.x + element.width);
        minY = Math.min(minY, element.y);
      }
    } else {
      maxX = 0;
      minY = 0;
    }

    if (maxX === -Infinity) maxX = 0;
    if (minY === Infinity) minY = 0;

    const PADDING = 100;
    const INSERT_X = maxX + PADDING;
    const INSERT_Y = minY;

    // Calculate bounding box of NEW elements to find their top-left
    let newMinX = Infinity;
    let newMinY = Infinity;
    for (const element of newElements) {
      newMinX = Math.min(newMinX, element.x);
      newMinY = Math.min(newMinY, element.y);
    }

    // Shift new elements
    const shiftedElements = newElements.map(el => ({
      ...el,
      x: el.x - newMinX + INSERT_X,
      y: el.y - newMinY + INSERT_Y,
    }));

    app.addElementsFromPasteOrLibrary({
      elements: shiftedElements,
      files,
      position: "center",
      fitToContent: false
    });

    onClose();
  };

  const handleCloseResult = () => {
    setOptimizationResult(null);
  };


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

      {optimizationResult && (
        <div className="architecture-optimization-dialog__result-overlay">
          <div className="architecture-optimization-dialog__result-content">
            <h3>优化方案建议</h3>
            <div className="architecture-optimization-dialog__result-summary">
              <pre>{optimizationResult.summary}</pre>
            </div>
            <div className="architecture-optimization-dialog__result-preview">
              <h4>新架构预览 (Mermaid)</h4>
              <div className="architecture-optimization-dialog__preview-canvas">
                <div
                  ref={previewCanvasRef}
                  className="architecture-optimization-dialog__preview-canvas-inner"
                />
                {previewError && (
                  <div className="architecture-optimization-dialog__preview-error">
                    <div>无法渲染预览：{previewError.message}</div>
                    {optimizationResult?.mermaid && (
                      <pre className="architecture-optimization-dialog__preview-error-mermaid">
                        {optimizationResult.mermaid}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="architecture-optimization-dialog__result-actions">
              <button onClick={handleInsertDiagram} className="architecture-optimization-dialog__button--primary">
                插入并对比
              </button>
              <button onClick={handleCloseResult} className="architecture-optimization-dialog__button--secondary">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
};
