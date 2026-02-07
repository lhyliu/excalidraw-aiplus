import React from "react";

import { Switch } from "../Switch";

import { categoryLabels, compactSuggestionContent } from "./model";
import {
  MaximizeIcon,
  MoveIcon,
  SparklesIcon,
  SplitIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./icons";

import type { Scheme, Suggestion } from "./model";

interface PreviewPageProps {
  activeScheme: Scheme | null;
  activeSchemeSuggestions: readonly Suggestion[];
  isCompareMode: boolean;
  elementsLength: number;
  isPanMode: boolean;
  isDrawerOpen: boolean;
  highlightedSuggestionId: string | null;
  viewport: { x: number; y: number; zoom: number };
  previewCanvasRef: React.RefObject<HTMLDivElement | null>;
  originalPreviewCanvasRef: React.RefObject<HTMLDivElement | null>;
  previewError: Error | null;
  originalPreviewError: Error | null;
  suggestionPoolSelectedContents: readonly string[];
  onToggleCompare: (checked: boolean) => void;
  onRenameScheme: (schemeId: string, title: string) => void;
  onInsertToCanvas: () => void;
  isInsertDisabled: boolean;
  isPreparingInsert: boolean;
  onTogglePanMode: () => void;
  onPreviewPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPreviewPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPreviewPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPreviewWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitCanvas: () => void;
  onToggleDrawer: () => void;
  onApplySuggestion: (suggestion: Suggestion) => void;
  onHighlightSuggestion: (suggestionId: string | null) => void;
  onBackToSuggestionPage: () => void;
  onGeneratePlan: () => void;
  isStreaming: boolean;
  hasMessages: boolean;
  onRegenerateSummary: () => void;
  isSummaryRefreshing: boolean;
}

export const PreviewPage = ({
  activeScheme,
  activeSchemeSuggestions,
  isCompareMode,
  elementsLength,
  isPanMode,
  isDrawerOpen,
  highlightedSuggestionId,
  viewport,
  previewCanvasRef,
  originalPreviewCanvasRef,
  previewError,
  originalPreviewError,
  suggestionPoolSelectedContents,
  onToggleCompare,
  onRenameScheme,
  onInsertToCanvas,
  isInsertDisabled,
  isPreparingInsert,
  onTogglePanMode,
  onPreviewPointerDown,
  onPreviewPointerMove,
  onPreviewPointerUp,
  onPreviewWheel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitCanvas,
  onToggleDrawer,
  onApplySuggestion,
  onHighlightSuggestion,
  onBackToSuggestionPage,
  onGeneratePlan,
  isStreaming,
  hasMessages,
  onRegenerateSummary,
  isSummaryRefreshing,
}: PreviewPageProps) => {
  const summaryParagraphs = activeScheme?.summary
    ? activeScheme.summary
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

  const summaryHighlights =
    activeSchemeSuggestions.length > 0
      ? activeSchemeSuggestions.slice(0, 4).map((item) => item.content)
      : summaryParagraphs.slice(0, 4);

  if (!activeScheme) {
    return (
      <div className="architecture-optimization-dialog__empty">
        <div className="architecture-optimization-dialog__empty-content">
          <p>暂无方案，请从建议页重新生成。</p>
          <div className="architecture-optimization-dialog__empty-actions">
            <button
              className="architecture-optimization-dialog__button--secondary"
              onClick={onBackToSuggestionPage}
            >
              返回建议页
            </button>
            <button
              className="architecture-optimization-dialog__button--primary"
              onClick={onGeneratePlan}
              disabled={isStreaming || !hasMessages}
            >
              {isStreaming ? "生成中..." : "直接生成新方案"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="architecture-optimization-dialog__preview-toolbar">
        <div className="architecture-optimization-dialog__scheme-title">
          <label htmlFor="scheme-title">方案名称</label>
          <input
            id="scheme-title"
            type="text"
            value={activeScheme.title || ""}
            onChange={(e) => onRenameScheme(activeScheme.id, e.target.value)}
            placeholder="为方案起个名字"
          />
        </div>
        <div className="architecture-optimization-dialog__preview-toolbar-right">
          <div className="architecture-optimization-dialog__compare-switch">
            <SplitIcon />
            <span>对比模式</span>
            <Switch
              name="compare-mode"
              checked={isCompareMode}
              onChange={onToggleCompare}
              disabled={elementsLength === 0}
            />
          </div>
          <button
            className="architecture-optimization-dialog__insert-btn"
            onClick={onInsertToCanvas}
            disabled={isInsertDisabled}
          >
            {isPreparingInsert ? "准备中..." : "插入主图"}
          </button>
        </div>
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
            <div
              className="architecture-optimization-dialog__preview-canvas ao-canvas-blueprint"
              style={{
                cursor: isPanMode ? "grab" : "default",
                touchAction: isPanMode ? "none" : "auto",
              }}
              onWheel={onPreviewWheel}
              onPointerDown={onPreviewPointerDown}
              onPointerMove={onPreviewPointerMove}
              onPointerUp={onPreviewPointerUp}
              onPointerCancel={onPreviewPointerUp}
            >
              <div
                ref={previewCanvasRef}
                className="architecture-optimization-dialog__preview-canvas-inner"
                style={{
                  transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                  transformOrigin: "center center",
                  transition: "transform 150ms ease-out",
                }}
              />
              <div
                className="architecture-optimization-dialog__canvas-toolbar"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button title="放大" onClick={onZoomIn}>
                  <ZoomInIcon />
                </button>
                <button title="缩小" onClick={onZoomOut}>
                  <ZoomOutIcon />
                </button>
                <span className="architecture-optimization-dialog__zoom-label">
                  {Math.round(viewport.zoom * 100)}%
                </span>
                <button
                  className="architecture-optimization-dialog__canvas-toolbar__text-btn"
                  title="恢复 100%"
                  onClick={onResetZoom}
                >
                  100%
                </button>
                <button
                  className="architecture-optimization-dialog__canvas-toolbar__text-btn"
                  title="适应画布"
                  onClick={onFitCanvas}
                >
                  适配
                </button>
                <div className="architecture-optimization-dialog__canvas-toolbar__divider" />
                <button
                  title="平移"
                  onClick={onTogglePanMode}
                  aria-pressed={isPanMode}
                >
                  <MoveIcon />
                </button>
                <button title="适应画布（快捷）" onClick={onFitCanvas}>
                  <MaximizeIcon />
                </button>
              </div>
              {previewError && (
                <div className="architecture-optimization-dialog__preview-error">
                  <div>无法渲染预览：{previewError.message}</div>
                  {activeScheme.mermaid && (
                    <pre className="architecture-optimization-dialog__preview-error-mermaid">
                      {activeScheme.mermaid}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
          {isCompareMode && (
            <div className="architecture-optimization-dialog__preview-card">
              <div className="architecture-optimization-dialog__preview-label">
                原架构图
              </div>
              <div className="architecture-optimization-dialog__preview-canvas">
                <div
                  ref={originalPreviewCanvasRef}
                  className="architecture-optimization-dialog__preview-canvas-inner"
                />
                {originalPreviewError && (
                  <div className="architecture-optimization-dialog__preview-error">
                    <div>无法渲染原架构图：{originalPreviewError.message}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <section className="architecture-optimization-dialog__ai-summary">
          <div className="architecture-optimization-dialog__ai-summary-header">
            <h5>AI方案总结</h5>
            <div className="architecture-optimization-dialog__ai-summary-meta">
              <span>{summaryHighlights.length} 条核心要点</span>
              <button
                className="architecture-optimization-dialog__ai-summary-refresh"
                onClick={onRegenerateSummary}
                disabled={isSummaryRefreshing || isStreaming}
              >
                {isSummaryRefreshing ? "总结中..." : "重新生成总结"}
              </button>
            </div>
          </div>
          <div className="architecture-optimization-dialog__ai-summary-content">
            {summaryHighlights.length > 0 ? (
              <ul className="architecture-optimization-dialog__ai-summary-list">
                {summaryHighlights.map((item, index) => (
                  <li key={`${activeScheme.id}-summary-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="architecture-optimization-dialog__ai-summary-empty">
                暂无总结内容，请重新生成方案。
              </p>
            )}
            {activeScheme.summary && (
              <details className="architecture-optimization-dialog__ai-summary-raw">
                <summary>查看完整 AI 总结</summary>
                <pre>{activeScheme.summary}</pre>
              </details>
            )}
          </div>
        </section>
      </div>

      <div className={`ao-drawer ${isDrawerOpen ? "ao-drawer--open" : ""}`}>
        <div className="ao-drawer__header">
          <h3>
            <SparklesIcon />
            优化建议
          </h3>
          <button
            className="ao-drawer__close"
            onClick={onToggleDrawer}
            aria-label="关闭建议面板"
          >
            <XIcon />
          </button>
        </div>
        <div className="ao-drawer__content">
          {activeSchemeSuggestions.length > 0 ? (
            activeSchemeSuggestions.map((suggestion) => {
              const isApplied = suggestionPoolSelectedContents.some(
                (content) =>
                  content.slice(0, 50) ===
                  compactSuggestionContent(suggestion.content).slice(0, 50),
              );
              return (
                <div
                  key={suggestion.id}
                  className={`ao-suggestion-card ${
                    highlightedSuggestionId === suggestion.id
                      ? "ao-suggestion-card--highlighted"
                      : ""
                  }`}
                >
                  <div className="ao-suggestion-card__header">
                    <span
                      className={`ao-suggestion-card__tag ao-suggestion-card__tag--${suggestion.category}`}
                    >
                      {categoryLabels[suggestion.category]}
                    </span>
                  </div>
                  <div className="ao-suggestion-card__content">
                    {suggestion.content}
                  </div>
                  <button
                    className="ao-suggestion-card__apply"
                    disabled={isApplied}
                    title={isApplied ? "该建议已应用" : "应用到已选建议"}
                    onClick={() => {
                      if (isApplied) {
                        return;
                      }
                      onApplySuggestion(suggestion);
                      onHighlightSuggestion(suggestion.id);
                      setTimeout(() => onHighlightSuggestion(null), 2000);
                    }}
                  >
                    <SparklesIcon />
                    {isApplied ? "已应用" : "应用"}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="ao-suggestion-card">
              <div className="ao-suggestion-card__content">
                {activeScheme.summary || "暂无建议"}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
