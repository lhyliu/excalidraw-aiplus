import {
  buildPlanExecutionOptions,
  buildGenerationSnapshot,
  buildPlanHistoryMessages,
} from "./planGenerationContext";

import type { Message } from "./messageState";
import type { PoolSuggestion } from "./model";

const baseMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "旧建议A\n旧建议B",
    isGenerating: false,
  },
  {
    id: "2",
    role: "user",
    content: "请继续",
    isGenerating: false,
  },
];

describe("buildPlanHistoryMessages", () => {
  it("includes history by default", () => {
    const result = buildPlanHistoryMessages(baseMessages, "已选建议: X", true);
    expect(result).toHaveLength(3);
    expect(result[0].content).toContain("旧建议A");
    expect(result[2].content).toContain("已选建议: X");
  });

  it("excludes history when includeHistory is false", () => {
    const result = buildPlanHistoryMessages(baseMessages, "已选建议: X", false);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toBe("已选建议: X");
  });

  it("does not leak unselected suggestions from history in selected-only generation", () => {
    const historyWithUnselected: Message[] = [
      {
        id: "h1",
        role: "assistant",
        content: "未选建议A\n未选建议B",
        isGenerating: false,
      },
      {
        id: "h2",
        role: "user",
        content: "请基于所有建议继续优化",
        isGenerating: false,
      },
    ];
    const selectedOnlyPrompt = "已选建议:\n- 建议X\n- 建议Y";

    const result = buildPlanHistoryMessages(
      historyWithUnselected,
      selectedOnlyPrompt,
      false,
    );

    expect(result).toHaveLength(1);
    expect(result[0].content).toContain("建议X");
    expect(result[0].content).toContain("建议Y");
    expect(result[0].content).not.toContain("未选建议A");
    expect(result[0].content).not.toContain("未选建议B");
  });
});

describe("buildGenerationSnapshot", () => {
  it("keeps snapshot immutable after source selection mutates", () => {
    const selected: PoolSuggestion[] = [
      {
        id: "s1",
        category: "performance" as const,
        title: "A",
        content: "A-content",
        fullContent: "A-full",
        selected: true,
        note: "n1",
      },
      {
        id: "s2",
        category: "security" as const,
        title: "B",
        content: "B-content",
        fullContent: "B-full",
        selected: true,
      },
    ];

    const snapshot = buildGenerationSnapshot(selected, "standard", "scheme-1", null);

    selected[0].content = "mutated-content";
    selected[1].title = "mutated-title";
    selected.push({
      id: "s3",
      category: "cost",
      title: "C",
      content: "C-content",
      fullContent: "C-full",
      selected: true,
    });

    expect(snapshot.selectedIds).toEqual(["s1", "s2"]);
    expect(snapshot.selectedItems).toHaveLength(2);
    expect(snapshot.selectedItems[0].content).toBe("A-content");
    expect(snapshot.selectedItems[1].title).toBe("B");
  });
});

describe("buildPlanExecutionOptions", () => {
  it("uses the same strategy for create and update except forceCreate", () => {
    const snapshot = buildGenerationSnapshot(
      [
        {
          id: "s1",
          category: "performance",
          title: "优化MySQL",
          content: "实现读写分离",
          fullContent: "实现读写分离",
          selected: true,
        },
      ],
      "standard",
      "scheme-1",
      "comb-1",
    );

    const create = buildPlanExecutionOptions(snapshot, "scheme-1", "create");
    const update = buildPlanExecutionOptions(snapshot, "scheme-1", "update");

    expect(create.includeHistory).toBe(false);
    expect(update.includeHistory).toBe(false);
    expect(create.targetSchemeId).toBe("scheme-1");
    expect(update.targetSchemeId).toBe("scheme-1");
    expect(create.sourceSuggestionIds).toEqual(update.sourceSuggestionIds);
    expect(create.sourceSuggestionSnapshot).toEqual(
      update.sourceSuggestionSnapshot,
    );
    expect(create.generationSnapshot).toEqual(update.generationSnapshot);
    expect(create.forceCreate).toBe(true);
    expect(update.forceCreate).toBe(false);
  });
});
