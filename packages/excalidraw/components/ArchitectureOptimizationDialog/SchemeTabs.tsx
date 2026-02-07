import React from "react";

import {
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PlusIcon,
  XIcon,
} from "./icons";

import type { Scheme, SuggestionCombination } from "./model";

interface SchemeTabsProps {
  schemes: readonly Scheme[];
  activeSchemeId: string | null;
  activeScheme: Scheme | null;
  isPreviewPage: boolean;
  isDrawerOpen: boolean;
  suggestionCombinations: readonly SuggestionCombination[];
  onSetPreviewPage: (isPreviewPage: boolean) => void;
  onGeneratePlan: () => void;
  onSelectScheme: (schemeId: string) => void;
  onDeleteScheme: (schemeId: string) => void;
  onToggleDrawer: () => void;
}

export const SchemeTabs = ({
  schemes,
  activeSchemeId,
  activeScheme,
  isPreviewPage,
  isDrawerOpen,
  suggestionCombinations,
  onSetPreviewPage,
  onGeneratePlan,
  onSelectScheme,
  onDeleteScheme,
  onToggleDrawer,
}: SchemeTabsProps) => (
  <div className="ao-ide-tabs">
    <div className="ao-mode-switch">
      <button
        className={
          !isPreviewPage
            ? "ao-mode-switch__btn ao-mode-switch__btn--active"
            : "ao-mode-switch__btn"
        }
        onClick={() => onSetPreviewPage(false)}
      >
        建议页
      </button>
      <button
        className={
          isPreviewPage
            ? "ao-mode-switch__btn ao-mode-switch__btn--active"
            : "ao-mode-switch__btn"
        }
        onClick={() => activeScheme && onSetPreviewPage(true)}
        disabled={!activeScheme}
      >
        预览页
      </button>
    </div>

    <button
      className="ao-ide-tab-add"
      onClick={onGeneratePlan}
      title="生成新方案"
      aria-label="生成新方案"
    >
      <PlusIcon />
    </button>

    {schemes.map((scheme) => {
      const isActive = scheme.id === activeSchemeId;
      const tabTitle = scheme.title?.trim() || `方案 ${scheme.version}`;
      const sourceCombinationName = scheme.sourceCombinationId
        ? suggestionCombinations.find(
            (combination) => combination.id === scheme.sourceCombinationId,
          )?.name || "已删除组合"
        : null;
      const tabSourceLabel = sourceCombinationName
        ? ` · ${sourceCombinationName}`
        : "";

      return (
        <button
          key={scheme.id}
          className={`ao-ide-tab ${isActive ? "ao-ide-tab--active" : ""}`}
          onClick={() => onSelectScheme(scheme.id)}
          title={
            sourceCombinationName
              ? `${tabTitle}（来源：${sourceCombinationName}）`
              : tabTitle
          }
        >
          <span className="ao-ide-tab__label">{`${tabTitle}${tabSourceLabel}`}</span>
          <button
            type="button"
            className="ao-ide-tab__close"
            aria-label={`删除${tabTitle}`}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteScheme(scheme.id);
            }}
          >
            <XIcon />
          </button>
        </button>
      );
    })}

    {isPreviewPage && (
      <div className="ao-ide-tabs__right">
        <button
          className="ao-ide-tabs__icon-btn"
          onClick={onToggleDrawer}
          title={isDrawerOpen ? "关闭建议面板" : "打开建议面板"}
          aria-label={isDrawerOpen ? "关闭建议面板" : "打开建议面板"}
        >
          {isDrawerOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
        </button>
      </div>
    )}
  </div>
);
