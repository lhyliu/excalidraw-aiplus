import React from "react";
import { render, screen } from "@testing-library/react";

import { WorkflowPage } from "./WorkflowPage";

describe("WorkflowPage", () => {
  it("shows generation confirmation summary from selected suggestions", () => {
    render(
      <WorkflowPage
        suggestionToast={null}
        onCloseSuggestionToast={() => {}}
        stagingAreaRef={{ current: null }}
        selectedSuggestions={[
          {
            id: "s1",
            category: "performance",
            title: "优化MySQL",
            content: "实现读写分离",
            fullContent: "实现读写分离",
            selected: true,
          },
          {
            id: "s2",
            category: "reliability",
            title: "增强容错",
            content: "增加重试",
            fullContent: "增加重试",
            selected: true,
          },
        ]}
        suggestionPool={[]}
        visibleSuggestions={[]}
        suggestionSearchKeyword=""
        showArchivedSuggestions={false}
        editingSuggestionId={null}
        expandedSuggestionIds={new Set()}
        architectureStyle="standard"
        activeSchemeId="scheme-1"
        isStreaming={false}
        onClearSelectedSuggestions={() => {}}
        onToggleSuggestionSelection={() => {}}
        onClearSuggestionPool={() => {}}
        onSetSuggestionSearchKeyword={() => {}}
        onSetShowArchivedSuggestions={() => {}}
        onSetEditingSuggestionId={() => {}}
        onArchiveSuggestion={() => {}}
        onToggleExpandedSuggestion={() => {}}
        onUpdateSuggestionNote={() => {}}
        onStartAnalysis={() => {}}
        onSendPresetQuestion={() => {}}
        onSetArchitectureStyle={() => {}}
        onGenerateNewFromSelected={() => {}}
        onUpdateCurrentFromSelected={() => {}}
      />,
    );

    expect(screen.getByText("生成前确认")).toBeInTheDocument();
    expect(screen.getByText("已选 2 项")).toBeInTheDocument();
    expect(screen.getByText("[性能] 优化MySQL")).toBeInTheDocument();
    expect(screen.getByText("[可靠性] 增强容错")).toBeInTheDocument();
    expect(screen.getByText("风格：标准模式")).toBeInTheDocument();
    expect(screen.getByText("目标：可新建或更新当前方案")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "清空列表" })).toBeInTheDocument();
    expect(
      screen.getByText("仅使用已勾选建议生成，不会自动包含未勾选建议。"),
    ).toBeInTheDocument();
  });
});
