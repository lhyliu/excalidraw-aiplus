import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

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
        expandedSuggestionIds={[]}
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
        canReactivateLastSuggestions={false}
        onReactivateLastSuggestions={() => {}}
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

  it("triggers selection toggle by click and keyboard", () => {
    const onToggleSuggestionSelection = vi.fn();

    render(
      <WorkflowPage
        suggestionToast={null}
        onCloseSuggestionToast={() => {}}
        stagingAreaRef={{ current: null }}
        selectedSuggestions={[]}
        suggestionPool={[
          {
            id: "s1",
            category: "performance",
            title: "优化MySQL",
            content: "实现读写分离",
            fullContent: "优化MySQL实现读写分离",
            selected: false,
          },
        ]}
        visibleSuggestions={[
          {
            id: "s1",
            category: "performance",
            title: "优化MySQL",
            content: "实现读写分离",
            fullContent: "优化MySQL实现读写分离",
            selected: false,
          },
        ]}
        suggestionSearchKeyword=""
        showArchivedSuggestions={false}
        editingSuggestionId={null}
        expandedSuggestionIds={[]}
        architectureStyle="standard"
        activeSchemeId={null}
        isStreaming={false}
        onClearSelectedSuggestions={() => {}}
        onToggleSuggestionSelection={onToggleSuggestionSelection}
        onClearSuggestionPool={() => {}}
        onSetSuggestionSearchKeyword={() => {}}
        onSetShowArchivedSuggestions={() => {}}
        onSetEditingSuggestionId={() => {}}
        onArchiveSuggestion={() => {}}
        onToggleExpandedSuggestion={() => {}}
        onUpdateSuggestionNote={() => {}}
        onStartAnalysis={() => {}}
        onSendPresetQuestion={() => {}}
        canReactivateLastSuggestions={false}
        onReactivateLastSuggestions={() => {}}
        onSetArchitectureStyle={() => {}}
        onGenerateNewFromSelected={() => {}}
        onUpdateCurrentFromSelected={() => {}}
      />,
    );

    const checkboxCard = screen.getByRole("checkbox", { name: "优化MySQL" });
    fireEvent.click(checkboxCard);
    fireEvent.keyDown(checkboxCard, { key: "Enter" });
    fireEvent.keyDown(checkboxCard, { key: " " });

    expect(onToggleSuggestionSelection).toHaveBeenCalledTimes(3);
    expect(onToggleSuggestionSelection).toHaveBeenNthCalledWith(1, "s1");
    expect(onToggleSuggestionSelection).toHaveBeenNthCalledWith(2, "s1");
    expect(onToggleSuggestionSelection).toHaveBeenNthCalledWith(3, "s1");
  });
});
