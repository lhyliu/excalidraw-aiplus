import React from "react";

import { PRESET_QUESTIONS } from "./model";
import { ImageIcon, SendIcon, TrashIcon } from "./icons";

import type { Message } from "./messageState";

interface ChatPanelProps {
  messages: readonly Message[];
  inputValue: string;
  isStreaming: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  inputTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSetInputValue: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onStartAnalysis: () => void;
  onSendPresetQuestion: (question: string) => void;
  onClearHistory: () => void;
  onUploadImage: () => void;
  onAbort: () => void;
  onSendMessage: () => void;
}

export const ChatPanel = ({
  messages,
  inputValue,
  isStreaming,
  messagesEndRef,
  inputTextareaRef,
  onSetInputValue,
  onKeyDown,
  onStartAnalysis,
  onSendPresetQuestion,
  onClearHistory,
  onUploadImage,
  onAbort,
  onSendMessage,
}: ChatPanelProps) => (
  <div className="architecture-optimization-dialog__chat-body">
    <div className="architecture-optimization-dialog__messages">
      {messages.length === 0 ? (
        <div className="architecture-optimization-dialog__welcome">
          <h3>快速生成架构优化建议</h3>
          <p>自动识别问题并生成可执行优化方案。</p>
          <div className="architecture-optimization-dialog__welcome-actions">
            <button
              className="architecture-optimization-dialog__button architecture-optimization-dialog__button--primary architecture-optimization-dialog__button--hero"
              onClick={onStartAnalysis}
              disabled={isStreaming}
            >
              开始分析画布
            </button>
            <p className="architecture-optimization-dialog__welcome-subhint">
              预计 20-40 秒生成首批建议
            </p>
          </div>
          <p className="architecture-optimization-dialog__welcome-hint">
            或直接在下方输入您的问题
          </p>
          <div className="architecture-optimization-dialog__preset-list">
            {PRESET_QUESTIONS.map((question) => (
              <button
                key={question}
                className="architecture-optimization-dialog__preset-chip"
                onClick={() => onSendPresetQuestion(question)}
              >
                {question}
              </button>
            ))}
          </div>
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
      <div className="architecture-optimization-dialog__input-wrapper">
        <textarea
          ref={inputTextareaRef}
          className="architecture-optimization-dialog__input"
          value={inputValue}
          onChange={(e) => onSetInputValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={"描述优化目标\n例如：降低延迟、提升可用性、降低成本"}
          disabled={isStreaming}
          rows={1}
          wrap="soft"
        />
        <div className="architecture-optimization-dialog__input-side-actions">
          <button
            className="architecture-optimization-dialog__clear-button"
            onClick={onClearHistory}
            disabled={isStreaming || messages.length === 0}
            title="清除对话历史"
            aria-label="清除对话历史"
          >
            <TrashIcon />
          </button>
          <button
            className="architecture-optimization-dialog__input-icon-btn"
            onClick={onUploadImage}
            title="上传图片（开发中）"
            aria-label="上传图片（开发中）"
            disabled={isStreaming}
          >
            <ImageIcon />
          </button>
          {isStreaming ? (
            <button
              className="architecture-optimization-dialog__button architecture-optimization-dialog__button--abort"
              onClick={onAbort}
            >
              停止
            </button>
          ) : (
            <button
              className="architecture-optimization-dialog__send-btn"
              onClick={onSendMessage}
              disabled={!inputValue.trim()}
              title="发送"
              aria-label="发送消息"
            >
              <SendIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);
