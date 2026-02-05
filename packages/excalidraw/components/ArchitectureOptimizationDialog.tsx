import React, { useState, useCallback, useRef, useEffect } from "react";

import { Dialog } from "./Dialog";
import { t } from "../i18n";
import {
    callAIStream,
    extractDiagramInfo,
    getArchitectureAnalysisPrompt,
    isAIConfigured,
} from "../services/aiService";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import "./ArchitectureOptimizationDialog.scss";

interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    isGenerating?: boolean;
    error?: string;
}

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

export const ArchitectureOptimizationDialog: React.FC<
    ArchitectureOptimizationDialogProps
> = ({ elements, onClose, onOpenAISettings }) => {
    // Load persisted messages on init
    const [messages, setMessages] = useState<Message[]>(() => loadChatHistory());
    const [inputValue, setInputValue] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Save messages to localStorage when they change (debounced)
    useEffect(() => {
        if (!isGenerating) {
            saveChatHistory(messages);
        }
    }, [messages, isGenerating]);

    const handleStartAnalysis = useCallback(async () => {
        if (isGenerating) return;

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

        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setIsGenerating(true);

        abortControllerRef.current = new AbortController();

        const result = await callAIStream(
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
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === assistantMsgId
                                ? { ...msg, content: msg.content + chunk }
                                : msg,
                        ),
                    );
                },
                onComplete: () => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === assistantMsgId ? { ...msg, isGenerating: false } : msg,
                        ),
                    );
                    setIsGenerating(false);
                },
                onError: (error) => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === assistantMsgId
                                ? { ...msg, isGenerating: false, error: error.message }
                                : msg,
                        ),
                    );
                    setIsGenerating(false);
                },
            },
            abortControllerRef.current.signal,
        );

        if (!result.success && result.error) {
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === assistantMsgId
                        ? {
                            ...msg,
                            isGenerating: false,
                            error: msg.error || result.error,
                        }
                        : msg,
                ),
            );
            setIsGenerating(false);
        }
    }, [elements, messages, isGenerating]);

    const handleSendMessage = useCallback(async () => {
        if (!inputValue.trim() || isGenerating) return;

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

        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setInputValue("");
        setIsGenerating(true);

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

        abortControllerRef.current = new AbortController();

        await callAIStream(
            apiMessages,
            {
                onChunk: (chunk) => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === assistantMsgId
                                ? { ...msg, content: msg.content + chunk }
                                : msg,
                        ),
                    );
                },
                onComplete: () => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === assistantMsgId ? { ...msg, isGenerating: false } : msg,
                        ),
                    );
                    setIsGenerating(false);
                },
                onError: (error) => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === assistantMsgId
                                ? { ...msg, isGenerating: false, error: error.message }
                                : msg,
                        ),
                    );
                    setIsGenerating(false);
                },
            },
            abortControllerRef.current.signal,
        );
    }, [inputValue, isGenerating, messages, elements]);

    const handleAbort = useCallback(() => {
        abortControllerRef.current?.abort();
        setIsGenerating(false);
    }, []);

    const handleClearHistory = useCallback(() => {
        setMessages([]);
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

    // Show configuration prompt if AI is not configured
    if (!isAIConfigured()) {
        return (
            <Dialog
                className="architecture-optimization-dialog"
                onCloseRequest={onClose}
                title="架构优化"
                size="wide"
            >
                <div className="architecture-optimization-dialog__not-configured">
                    <p>请先配置AI API设置以使用架构优化功能。</p>
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
            title="架构优化"
            size="wide"
        >
            <div className="architecture-optimization-dialog__content">
                <div className="architecture-optimization-dialog__messages">
                    {messages.length === 0 ? (
                        <div className="architecture-optimization-dialog__welcome">
                            <h3>🏗️ 架构优化助手</h3>
                            <p>分析您的架构图并提供专业的优化建议。</p>
                            <div className="architecture-optimization-dialog__welcome-actions">
                                <button
                                    className="architecture-optimization-dialog__button architecture-optimization-dialog__button--primary"
                                    onClick={handleStartAnalysis}
                                    disabled={isGenerating}
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
                        <button
                            className="architecture-optimization-dialog__clear-button"
                            onClick={handleClearHistory}
                            disabled={isGenerating}
                            title="清除对话历史"
                        >
                            🗑️
                        </button>
                    )}
                    <textarea
                        className="architecture-optimization-dialog__input"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="输入您的问题，例如：如何提高这个架构的可扩展性？"
                        disabled={isGenerating}
                        rows={2}
                    />
                    <div className="architecture-optimization-dialog__input-actions">
                        {isGenerating ? (
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
        </Dialog>
    );
};

