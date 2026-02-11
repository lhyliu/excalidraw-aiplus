import { parseOptimizationPlanResponse } from "../../services/aiService";

import { buildGenerationSnapshot } from "./planGenerationContext";
import { validateGenerationResult } from "./validation";

import type { Scheme } from "./model";
import type { PoolSuggestion } from "./model";

const S1: PoolSuggestion = {
  id: "s1",
  category: "performance",
  title: "优化MySQL",
  content: "实现读写分离",
  fullContent: "优化MySQL实现读写分离以提升吞吐",
  selected: true,
};

const S2: PoolSuggestion = {
  id: "s2",
  category: "performance",
  title: "扩展Redis集群",
  content: "提升并发承载能力",
  fullContent: "扩展Redis集群提升并发承载能力",
  selected: true,
};

const S3: PoolSuggestion = {
  id: "s3",
  category: "cost",
  title: "压缩日志保留",
  content: "降低存储成本",
  fullContent: "压缩日志保留降低存储成本",
  selected: true,
};

const toJsonBlock = (payload: Record<string, unknown>) =>
  `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;

describe("ArchitectureOptimizationDialog integration contracts", () => {
  it("Case A: one selected suggestion generates one valid summary item", () => {
    const snapshot = buildGenerationSnapshot([S1], "standard", null, null);
    const parsed = parseOptimizationPlanResponse(
      toJsonBlock({
        changes: [
          {
            sourceSuggestionId: "s1",
            category: "性能",
            title: "优化MySQL",
            action: "实现读写分离",
          },
        ],
        mermaid: "graph TD\nA[业务服务] --> B[(MySQL主库)]",
      }),
    );

    const validation = validateGenerationResult({
      summary: parsed.summary,
      mermaid: parsed.mermaid,
      snapshot,
    });

    expect(validation).toEqual({ ok: true });
    expect(parsed.summary).toContain("[性能] 优化MySQL：实现读写分离");
    expect(parsed.summary).not.toContain("扩展Redis集群");
    expect(parsed.summary).not.toContain("压缩日志保留");
  });

  it("Case B: two selected suggestions generate two valid summary items", () => {
    const snapshot = buildGenerationSnapshot([S1, S2], "detailed", "scheme-1", null);
    const parsed = parseOptimizationPlanResponse(
      toJsonBlock({
        changes: [
          { category: "性能", title: "优化MySQL", action: "实现读写分离" },
          { category: "性能", title: "扩展Redis集群", action: "提升并发承载能力" },
        ],
        mermaid:
          "graph TD\nA[业务服务] --> B[(MySQL主库)]\nA --> C[(Redis集群)]",
      }),
    );

    const validation = validateGenerationResult({
      summary: parsed.summary,
      mermaid: parsed.mermaid,
      snapshot,
    });

    expect(validation).toEqual({ ok: true });
    expect(parsed.summary.split("\n")).toHaveLength(2);
  });

  it("Case C: in-flight selection mutation does not alter frozen snapshot", () => {
    const selected = [{ ...S1 }, { ...S2 }];
    const snapshot = buildGenerationSnapshot(selected, "standard", null, "comb-1");

    selected.splice(0, selected.length, { ...S3 });

    expect(snapshot.selectedIds).toEqual(["s1", "s2"]);
    expect(snapshot.selectedItems.map((item) => item.id)).toEqual(["s1", "s2"]);
  });

  it("Case D: generationSnapshot survives serialize/deserialize", () => {
    const snapshot = buildGenerationSnapshot([S1, S2], "minimal", "scheme-3", "comb-9");
    const scheme: Scheme = {
      id: "scheme-10",
      version: 10,
      summary: "- [性能] 优化MySQL：实现读写分离\n- [性能] 扩展Redis集群：提升并发承载能力",
      mermaid: "graph TD\nA-->B",
      shortSummary: "优化MySQL",
      generationSnapshot: snapshot,
      sourceSuggestionIds: snapshot.selectedIds,
      sourceSuggestionSnapshot: snapshot.selectedItems,
      sourceCombinationId: snapshot.sourceCombinationId,
    };

    const restored = JSON.parse(JSON.stringify(scheme)) as Scheme;

    expect(restored.generationSnapshot?.selectedIds).toEqual(["s1", "s2"]);
    expect(restored.generationSnapshot?.sourceSchemeId).toBe("scheme-3");
    expect(restored.generationSnapshot?.sourceCombinationId).toBe("comb-9");
    expect(typeof restored.generationSnapshot?.createdAt).toBe("number");
  });

  it("Retry path: retries once when first output violates selected-count contract", () => {
    const snapshot = buildGenerationSnapshot([S1], "standard", null, null);
    const attempts = [
      toJsonBlock({
        changes: [
          { category: "性能", title: "优化MySQL", action: "实现读写分离" },
          { category: "性能", title: "扩展Redis集群", action: "提升并发承载能力" },
        ],
        mermaid: "graph TD\nA-->B",
      }),
      toJsonBlock({
        changes: [{ category: "性能", title: "优化MySQL", action: "实现读写分离" }],
        mermaid: "graph TD\nA-->B",
      }),
    ];

    let callCount = 0;
    const runOnce = (raw: string) => {
      callCount += 1;
      const parsed = parseOptimizationPlanResponse(raw);
      return validateGenerationResult({
        summary: parsed.summary,
        mermaid: parsed.mermaid,
        snapshot,
      });
    };

    const first = runOnce(attempts[0]);
    expect(first.ok).toBe(false);
    const second = runOnce(attempts[1]);
    expect(second).toEqual({ ok: true });
    expect(callCount).toBe(2);
  });
});
