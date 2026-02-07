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
  SuggestionCombination,
} from "./model";

interface WorkflowPageProps {
  suggestionToast: string | null;
  onCloseSuggestionToast: () => void;
  stagingAreaRef: React.RefObject<HTMLDivElement | null>;
  selectedSuggestions: readonly PoolSuggestion[];
  suggestionCombinations: readonly SuggestionCombination[];
  activeCombinationId: string | null;
  suggestionPool: readonly PoolSuggestion[];
  visibleSuggestions: readonly PoolSuggestion[];
  suggestionSearchKeyword: string;
  showArchivedSuggestions: boolean;
  editingSuggestionId: string | null;
  expandedSuggestionIds: ReadonlySet<string>;
  architectureStyle: ArchitectureStyle;
  activeSchemeId: string | null;
  isStreaming: boolean;
  onSaveCombination: () => void;
  onClearSelectedSuggestions: () => void;
  onApplyCombination: (combinationId: string) => void;
  onRemoveCombination: (combinationId: string) => void;
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
  onSetArchitectureStyle: (style: ArchitectureStyle) => void;
  onGenerateNewFromSelected: () => void;
  onUpdateCurrentFromSelected: () => void;
}

export const WorkflowPage = ({
  suggestionToast,
  onCloseSuggestionToast,
  stagingAreaRef,
  selectedSuggestions,
  suggestionCombinations,
  activeCombinationId,
  suggestionPool,
  visibleSuggestions,
  suggestionSearchKeyword,
  showArchivedSuggestions,
  editingSuggestionId,
  expandedSuggestionIds,
  architectureStyle,
  activeSchemeId,
  isStreaming,
  onSaveCombination,
  onClearSelectedSuggestions,
  onApplyCombination,
  onRemoveCombination,
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
  onSetArchitectureStyle,
  onGenerateNewFromSelected,
  onUpdateCurrentFromSelected,
}: WorkflowPageProps) => (
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
          <button
            className="ao-staging-area__clear-btn"
            onClick={onSaveCombination}
          >
            保存组合
          </button>
          {selectedSuggestions.length > 0 && (
            <button
              className="ao-staging-area__clear-btn"
              onClick={onClearSelectedSuggestions}
            >
              清空
            </button>
          )}
        </div>
      </div>
      {suggestionCombinations.length > 0 && (
        <div className="ao-staging-area__combinations">
          {suggestionCombinations.map((combination) => (
            <div
              key={combination.id}
              className={`ao-combination-chip ${
                combination.id === activeCombinationId
                  ? "ao-combination-chip--active"
                  : ""
              }`}
            >
              <button onClick={() => onApplyCombination(combination.id)}>
                {combination.name}
              </button>
              <button
                className="ao-combination-chip__remove"
                onClick={() => onRemoveCombination(combination.id)}
                title="删除组合"
              >
                <XIcon />
              </button>
            </div>
          ))}
        </div>
      )}
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
        <div className="ao-suggestion-pool__controls">
          <button
            className="ao-suggestion-pool__clear-all"
            onClick={onClearSuggestionPool}
            disabled={
              suggestionPool.length === 0 && suggestionCombinations.length === 0
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
          {visibleSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={`ao-pool-card ${
                suggestion.selected ? "ao-pool-card--selected" : ""
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
                  className={`ao-pool-card__checkbox ${
                    suggestion.selected ? "ao-pool-card__checkbox--checked" : ""
                  }`}
                >
                  {suggestion.selected && <CheckIcon />}
                </div>
                <span
                  className={`ao-pool-card__tag ao-pool-card__tag--${suggestion.category}`}
                >
                  {categoryLabels[suggestion.category]}
                </span>
                <span className="ao-pool-card__title" title={suggestion.title}>
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
                className={`ao-pool-card__content ${
                  expandedSuggestionIds.has(suggestion.id)
                    ? "ao-pool-card__content--expanded"
                    : ""
                }`}
                title={suggestion.fullContent}
              >
                {expandedSuggestionIds.has(suggestion.id)
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
                  {expandedSuggestionIds.has(suggestion.id) ? "收起" : "展开"}
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
              </div>
            </>
          )}
        </div>
      )}
    </div>

    <div className="ao-generation-console">
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
