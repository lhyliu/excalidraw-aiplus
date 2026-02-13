import React from "react";

import { categoryLabels, PRESET_QUESTIONS, styleLabels } from "./model";
import {
  CheckIcon,
  EditIcon,
  LightbulbIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from "./icons";

import type {
  ArchitectureStyle,
  PoolSuggestion,
  SuggestionCategory,
} from "./model";

interface WorkflowPageProps {
  suggestionToast: string | null;
  onCloseSuggestionToast: () => void;
  stagingAreaRef: React.RefObject<HTMLDivElement | null>;
  selectedSuggestions: readonly PoolSuggestion[];
  suggestionPool: readonly PoolSuggestion[];
  visibleSuggestions: readonly PoolSuggestion[];
  suggestionSearchKeyword: string;
  showArchivedSuggestions: boolean;
  editingSuggestionId: string | null;
  expandedSuggestionIds: string[];
  architectureStyle: ArchitectureStyle;
  activeSchemeId: string | null;
  isStreaming: boolean;
  onClearSelectedSuggestions: () => void;
  onToggleSuggestionSelection: (id: string) => void;
  onClearSuggestionPool: () => void;
  onSetSuggestionSearchKeyword: (value: string) => void;
  onSetShowArchivedSuggestions: (checked: boolean) => void;
  onSetEditingSuggestionId: (id: string | null) => void;
  onArchiveSuggestion: (id: string) => void;
  onToggleExpandedSuggestion: (id: string) => void;
  onUpdateSuggestionNote: (id: string, note: string) => void;
  onStartAnalysis: () => void;
  onSendPresetQuestion: (question: string) => void;
  canReactivateLastSuggestions: boolean;
  onReactivateLastSuggestions: () => void;
  onSetArchitectureStyle: (style: ArchitectureStyle) => void;
  onGenerateNewFromSelected: () => void;
  onUpdateCurrentFromSelected: () => void;
}

const SUGGESTION_CATEGORY_ORDER: SuggestionCategory[] = [
  "performance",
  "reliability",
  "security",
  "scalability",
  "cost",
];

export const WorkflowPage = ({
  suggestionToast,
  onCloseSuggestionToast,
  stagingAreaRef,
  selectedSuggestions,
  suggestionPool,
  visibleSuggestions,
  suggestionSearchKeyword,
  showArchivedSuggestions,
  editingSuggestionId,
  expandedSuggestionIds,
  architectureStyle,
  activeSchemeId,
  isStreaming,
  onClearSelectedSuggestions,
  onToggleSuggestionSelection,
  onClearSuggestionPool,
  onSetSuggestionSearchKeyword,
  onSetShowArchivedSuggestions,
  onSetEditingSuggestionId,
  onArchiveSuggestion,
  onToggleExpandedSuggestion,
  onUpdateSuggestionNote,
  onStartAnalysis,
  onSendPresetQuestion,
  canReactivateLastSuggestions,
  onReactivateLastSuggestions,
  onSetArchitectureStyle,
  onGenerateNewFromSelected,
  onUpdateCurrentFromSelected,
}: WorkflowPageProps) => {
  const groupedSuggestions = SUGGESTION_CATEGORY_ORDER
    .map((category) => ({
      category,
      items: visibleSuggestions.filter((suggestion) => suggestion.category === category),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="ao-workflow-panel ao-workflow-panel--expanded">
      {suggestionToast && (
        <div className="scheme-undo-toast">
          <span>{suggestionToast}</span>
          <button onClick={onCloseSuggestionToast}>✕</button>
        </div>
      )}

      <div className="ao-staging-area" ref={stagingAreaRef}>
        <div className="ao-staging-area__header">
          <h4>1. 选择建议</h4>
          <div className="ao-staging-area__header-actions">
            {selectedSuggestions.length > 0 && (
              <button
                className="ao-staging-area__clear-btn"
                onClick={onClearSelectedSuggestions}
              >
                清空选择
              </button>
            )}
          </div>
        </div>
        <div className="ao-staging-area__tags">
          {selectedSuggestions.length > 0 ? (
            selectedSuggestions.map((suggestion) => (
              <span
                key={suggestion.id}
                className={`ao-staging-tag ao-staging-tag--${suggestion.category}`}
              >
                {suggestion.title}
                <button
                  className="ao-staging-tag__remove"
                  onClick={() => onToggleSuggestionSelection(suggestion.id)}
                >
                  <XIcon />
                </button>
              </span>
            ))
          ) : (
            <span className="ao-staging-area__empty">从下方建议中勾选以添加</span>
          )}
        </div>
      </div>

      <div className="ao-suggestion-pool">
        <div className="ao-suggestion-pool__header">
          <h4>
            <LightbulbIcon />
            2. 从建议流中勾选
          </h4>
          <div className="ao-suggestion-pool__stats">
            共 {visibleSuggestions.length} 条 | 已选 {selectedSuggestions.length} 条
          </div>
          <div className="ao-suggestion-pool__controls">
            <button
              className="ao-suggestion-pool__clear-all"
              onClick={onClearSuggestionPool}
              disabled={
                suggestionPool.length === 0
              }
            >
              清空列表
            </button>
            <input
              className="ao-suggestion-pool__search"
              placeholder="搜索建议..."
              aria-label="搜索建议"
              value={suggestionSearchKeyword}
              onChange={(e) => onSetSuggestionSearchKeyword(e.target.value)}
            />
            <label className="ao-suggestion-pool__archived-toggle">
              <input
                type="checkbox"
                checked={showArchivedSuggestions}
                onChange={(e) => onSetShowArchivedSuggestions(e.target.checked)}
              />
              显示归档
            </label>
          </div>
        </div>

        {visibleSuggestions.length > 0 ? (
          <div className="ao-suggestion-pool__list">
            {groupedSuggestions.map((group) => (
              <section
                key={group.category}
                className={`ao-suggestion-group ao-suggestion-group--${group.category}`}
              >
                <div className="ao-suggestion-group__header">
                  <span className={`ao-suggestion-group__tag ao-pool-card__tag--${group.category}`}>
                    {categoryLabels[group.category]}
                  </span>
                  <span className="ao-suggestion-group__count">{group.items.length} 条</span>
                </div>
                <div className="ao-suggestion-group__cards">
                  {group.items.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className={`ao-pool-card ${suggestion.selected ? "ao-pool-card--selected" : ""
                        }`}
                      role="checkbox"
                      tabIndex={0}
                      aria-checked={suggestion.selected}
                      aria-label={suggestion.title}
                      onClick={() => onToggleSuggestionSelection(suggestion.id)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          onToggleSuggestionSelection(suggestion.id);
                        }
                      }}
                    >
                      <div className="ao-pool-card__header">
                        <div
                          className={`ao-pool-card__checkbox ${suggestion.selected
                              ? "ao-pool-card__checkbox--checked"
                              : ""
                            }`}
                        >
                          {suggestion.selected && <CheckIcon />}
                        </div>
                        <span
                          className={`ao-pool-card__tag ao-pool-card__tag--${suggestion.category}`}
                        >
                          {categoryLabels[suggestion.category]}
                        </span>
                        <span
                          className="ao-pool-card__title"
                          title={suggestion.title}
                        >
                          {suggestion.title}
                        </span>
                        <div className="ao-pool-card__actions">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSetEditingSuggestionId(
                                editingSuggestionId === suggestion.id
                                  ? null
                                  : suggestion.id,
                              );
                            }}
                            title="编辑备注"
                          >
                            <EditIcon />
                          </button>
                          <button
                            disabled={suggestion.selected}
                            onClick={(e) => {
                              e.stopPropagation();
                              onArchiveSuggestion(suggestion.id);
                            }}
                            title={suggestion.selected ? "已选建议不可归档" : "归档"}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                      <div
                        className={`ao-pool-card__content ${expandedSuggestionIds.includes(suggestion.id)
                            ? "ao-pool-card__content--expanded"
                            : ""
                          }`}
                        title={suggestion.fullContent}
                      >
                        {expandedSuggestionIds.includes(suggestion.id)
                          ? suggestion.fullContent
                          : suggestion.content}
                      </div>
                      {suggestion.fullContent.length > suggestion.content.length && (
                        <button
                          className="ao-pool-card__expand-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpandedSuggestion(suggestion.id);
                          }}
                        >
                          {expandedSuggestionIds.includes(suggestion.id) ? "收起" : "展开"}
                        </button>
                      )}
                      {editingSuggestionId === suggestion.id && (
                        <div className="ao-pool-card__note">
                          <input
                            type="text"
                            placeholder="添加备注..."
                            value={suggestion.note || ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              onUpdateSuggestionNote(suggestion.id, e.target.value)
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="ao-suggestion-pool__empty">
            <LightbulbIcon />
            {suggestionPool.length > 0 ? (
              <>
                <p>无匹配结果</p>
                <p className="architecture-optimization-dialog__hint-text">
                  请修改搜索词或勾选“显示归档”
                </p>
              </>
            ) : (
              <>
                <p>暂无建议</p>
                <p className="architecture-optimization-dialog__hint-text">
                  与 AI 对话后，建议将自动出现在此处
                </p>
                <div className="ao-suggestion-pool__quick-actions">
                  <button onClick={onStartAnalysis}>分析当前图</button>
                  <button
                    onClick={() => onSendPresetQuestion(PRESET_QUESTIONS[0])}
                  >
                    填入示例问题
                  </button>
                  {canReactivateLastSuggestions && (
                    <button onClick={onReactivateLastSuggestions}>
                      恢复上次建议
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="ao-generation-console">
        <div className="ao-generation-console__preview">
          <div className="ao-generation-console__preview-row">
            <strong>生成前确认</strong>
            <span>
              已选 {selectedSuggestions.length} 项
              {selectedSuggestions.length === 0 ? "（请先勾选）" : ""}
            </span>
          </div>
          {selectedSuggestions.length > 0 && (
            <div className="ao-generation-console__preview-tags">
              {selectedSuggestions.map((suggestion) => (
                <span key={suggestion.id} className="ao-generation-console__preview-tag">
                  [{categoryLabels[suggestion.category]}] {suggestion.title}
                </span>
              ))}
            </div>
          )}
          <div className="ao-generation-console__preview-row">
            <span>风格：{styleLabels[architectureStyle]}</span>
            <span>
              目标：{activeSchemeId ? "可新建或更新当前方案" : "仅新建方案"}
            </span>
          </div>
          <div className="ao-generation-console__preview-note">
            仅使用已勾选建议生成，不会自动包含未勾选建议。
          </div>
        </div>
        <div className="ao-generation-console__style-selector">
          <label
            htmlFor="architecture-style-selector"
            className="architecture-optimization-dialog__style-select-label"
          >
            3. 选择架构风格
          </label>
          <select
            id="architecture-style-selector"
            value={architectureStyle}
            onChange={(e) =>
              onSetArchitectureStyle(e.target.value as ArchitectureStyle)
            }
          >
            {(Object.keys(styleLabels) as ArchitectureStyle[]).map((style) => (
              <option key={style} value={style}>
                {styleLabels[style]}
              </option>
            ))}
          </select>
        </div>
        <div className="ao-generation-console__actions">
          <button
            className="ao-generation-console__generate-btn"
            onClick={onGenerateNewFromSelected}
            disabled={selectedSuggestions.length === 0 || isStreaming}
          >
            <SparklesIcon />
            {isStreaming ? "正在生成方案..." : "生成新方案"}
          </button>
          <button
            className="ao-generation-console__update-btn"
            onClick={onUpdateCurrentFromSelected}
            disabled={
              selectedSuggestions.length === 0 || isStreaming || !activeSchemeId
            }
          >
            更新当前方案
          </button>
        </div>
        <div className="ao-generation-console__count">
          {selectedSuggestions.length === 0
            ? "请先选择至少 1 条建议"
            : `已选 ${selectedSuggestions.length} 项建议（默认新建）`}
        </div>
      </div>
    </div>
  );
};
