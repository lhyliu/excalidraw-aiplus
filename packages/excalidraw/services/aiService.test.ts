import { describe, expect, it } from "vitest";

import {
  getArchitectureAnalysisPrompt,
  getOptimizationPlanPrompt,
} from "./aiService";

describe("aiService prompts", () => {
  it("analysis prompt enforces stable suggestion contract", () => {
    const prompt = getArchitectureAnalysisPrompt("mock-diagram-info");

    expect(prompt).toContain("仅输出 5 条建议");
    expect(prompt).toContain("每条一行，格式：- [分类]");
    expect(prompt).toContain("每条不超过 60 个中文字符");
    expect(prompt).toContain(
      "分类只能使用：性能 / 安全 / 成本 / 扩展性 / 可靠性",
    );
  });

  it("optimization prompt enforces summary + single mermaid contract", () => {
    const prompt = getOptimizationPlanPrompt("mock-diagram-info", "mock-chat");

    expect(prompt).toContain("“变更总结”固定 5 条");
    expect(prompt).toContain(
      "分类只能使用：性能 / 安全 / 成本 / 扩展性 / 可靠性",
    );
    expect(prompt).toContain("只输出 1 个 mermaid 代码块");
    expect(prompt).toContain("```mermaid");
  });
});
