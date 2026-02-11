import React from "react";
import { render, screen } from "@testing-library/react";

import { PreviewPage } from "./PreviewPage";

describe("PreviewPage", () => {
  it("shows matched and missing status for selected snapshot suggestions", () => {
    render(
      <PreviewPage
        activeScheme={{
          id: "scheme-1",
          version: 1,
          summary: "- [性能] 优化MySQL：实现读写分离",
          fullSummary:
            "- [性能] 优化MySQL：实现读写分离\n\n详细说明：将读流量迁移到只读副本，主库专注写入，降低锁竞争。",
          mermaid: "graph TD\nA[App] --> B[(MySQL)]",
          shortSummary: "优化MySQL",
          generationSnapshot: {
            selectedIds: ["s1", "s2"],
            selectedItems: [
              {
                id: "s1",
                category: "performance",
                title: "优化MySQL",
                content: "实现读写分离",
                fullContent: "实现读写分离",
              },
              {
                id: "s2",
                category: "performance",
                title: "扩展Redis集群",
                content: "提升并发承载能力",
                fullContent: "提升并发承载能力",
              },
            ],
            style: "standard",
            sourceSchemeId: null,
            sourceCombinationId: null,
            createdAt: Date.now(),
          },
        }}
        activeSchemeSuggestions={[]}
        isCompareMode={false}
        elementsLength={1}
        isPanMode={false}
        isDrawerOpen={false}
        highlightedSuggestionId={null}
        viewport={{ x: 0, y: 0, zoom: 1 }}
        previewCanvasRef={{ current: null }}
        originalPreviewCanvasRef={{ current: null }}
        previewError={null}
        originalPreviewError={null}
        suggestionPoolSelectedContents={[]}
        onToggleCompare={() => {}}
        onRenameScheme={() => {}}
        onInsertToCanvas={() => {}}
        isInsertDisabled={false}
        isPreparingInsert={false}
        onTogglePanMode={() => {}}
        onPreviewPointerDown={() => {}}
        onPreviewPointerMove={() => {}}
        onPreviewPointerUp={() => {}}
        onPreviewWheel={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onResetZoom={() => {}}
        onFitCanvas={() => {}}
        onToggleDrawer={() => {}}
        onApplySuggestion={() => {}}
        onHighlightSuggestion={() => {}}
        onBackToSuggestionPage={() => {}}
        onGeneratePlan={() => {}}
        isStreaming={false}
        hasMessages={true}
        onRegenerateSummary={() => {}}
        isSummaryRefreshing={false}
      />,
    );

    expect(screen.getByText("已选建议覆盖率")).toBeInTheDocument();
    expect(screen.getByText("已体现 1/2")).toBeInTheDocument();
    expect(screen.getByText("优化MySQL")).toBeInTheDocument();
    expect(screen.getByText("扩展Redis集群")).toBeInTheDocument();
    expect(screen.getByText("未体现")).toBeInTheDocument();
    expect(screen.getByText("已体现")).toBeInTheDocument();
    expect(screen.getByText("查看完整 AI 总结")).toBeInTheDocument();
  });

  it("treats wording variations as matched in coverage", () => {
    render(
      <PreviewPage
        activeScheme={{
          id: "scheme-2",
          version: 2,
          summary:
            "- [扩展性] 引入服务治理组件：部署注册中心与配置中心，支撑服务化后运维管控",
          mermaid: "graph TD\nA[服务] --> B[注册中心]",
          shortSummary: "服务治理",
          generationSnapshot: {
            selectedIds: ["sX"],
            selectedItems: [
              {
                id: "sX",
                category: "scalability",
                title: "服务治理组件：部署注册中心、配置中心",
                content: "引入服务治理组件，提升服务化治理能力",
                fullContent: "引入服务治理组件，提升服务化治理能力",
              },
            ],
            style: "standard",
            sourceSchemeId: null,
            sourceCombinationId: null,
            createdAt: Date.now(),
          },
        }}
        activeSchemeSuggestions={[]}
        isCompareMode={false}
        elementsLength={1}
        isPanMode={false}
        isDrawerOpen={false}
        highlightedSuggestionId={null}
        viewport={{ x: 0, y: 0, zoom: 1 }}
        previewCanvasRef={{ current: null }}
        originalPreviewCanvasRef={{ current: null }}
        previewError={null}
        originalPreviewError={null}
        suggestionPoolSelectedContents={[]}
        onToggleCompare={() => {}}
        onRenameScheme={() => {}}
        onInsertToCanvas={() => {}}
        isInsertDisabled={false}
        isPreparingInsert={false}
        onTogglePanMode={() => {}}
        onPreviewPointerDown={() => {}}
        onPreviewPointerMove={() => {}}
        onPreviewPointerUp={() => {}}
        onPreviewWheel={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onResetZoom={() => {}}
        onFitCanvas={() => {}}
        onToggleDrawer={() => {}}
        onApplySuggestion={() => {}}
        onHighlightSuggestion={() => {}}
        onBackToSuggestionPage={() => {}}
        onGeneratePlan={() => {}}
        isStreaming={false}
        hasMessages={true}
        onRegenerateSummary={() => {}}
        isSummaryRefreshing={false}
      />,
    );

    expect(screen.getByText("已体现 1/1")).toBeInTheDocument();
  });
});
