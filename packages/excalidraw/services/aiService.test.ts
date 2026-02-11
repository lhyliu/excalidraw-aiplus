import { describe, expect, it } from "vitest";

import {
  getArchitectureAnalysisPrompt,
  getOptimizationPlanPrompt,
  parseOptimizationPlanResponse,
  sanitizeMermaidDefinition,
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

    expect(prompt).toContain(
      "若输入中提供了“已选建议”列表，变更总结条数必须与已选建议数量一致",
    );
    expect(prompt).not.toContain("“变更总结”固定 5 条");
    expect(prompt).toContain(
      "分类只能使用：性能 / 安全 / 成本 / 扩展性 / 可靠性",
    );
    expect(prompt).toContain("严禁输出 JSON 代码块以外的任何文本");
    expect(prompt).toContain("保持与当前架构的视觉与结构风格一致");
    expect(prompt).toContain("仅围绕已确认变更做最小必要调整");
    expect(prompt).not.toContain("```mermaid");
    expect(prompt).toContain("```json");
  });

  it("parses structured JSON optimization response", () => {
    const raw = `\`\`\`json
{
  "changes": [
    { "category": "性能", "title": "优化MySQL", "action": "实现读写分离" }
  ],
  "mermaid": "graph TD\\nA[App] --> B[(MySQL 主库)]"
}
\`\`\``;

    const parsed = parseOptimizationPlanResponse(raw);
    expect(parsed.summary).toContain("[性能] 优化MySQL：实现读写分离");
    expect(parsed.mermaid).toContain("graph TD");
    expect(parsed.mermaid).toContain("MySQL 主库");
    expect(parsed.fullSummary).toContain("[性能] 优化MySQL：实现读写分离");
  });

  it("parses raw JSON without fenced block", () => {
    const raw = `{
  "changes": [
    { "category": "性能", "title": "扩展Redis集群", "action": "提升并发承载能力" }
  ],
  "mermaid": "graph TD\\nA[服务] --> B[(Redis集群)]"
}`;
    const parsed = parseOptimizationPlanResponse(raw);
    expect(parsed.summary).toContain("[性能] 扩展Redis集群：提升并发承载能力");
    expect(parsed.mermaid).toContain("Redis集群");
    expect(parsed.fullSummary).toContain("[性能] 扩展Redis集群：提升并发承载能力");
  });

  it("normalizes fenced mermaid inside JSON field", () => {
    const mermaidInJson =
      "```mermaid\\ngraph TD\\nA[服务] --> B[(MySQL主库)]\\n```";
    const raw = `\`\`\`json
{
  "changes": [
    { "category": "性能", "title": "优化MySQL", "action": "实现读写分离" }
  ],
  "mermaid": ${JSON.stringify(mermaidInJson)}
}
\`\`\``;
    const parsed = parseOptimizationPlanResponse(raw);
    expect(parsed.mermaid.startsWith("graph TD")).toBe(true);
    expect(parsed.mermaid).not.toContain("```");
  });

  it("normalizes <br> tags in mermaid labels", () => {
    const raw = `{
  "changes": [
    { "category": "性能", "title": "服务治理", "action": "引入注册中心" }
  ],
  "mermaid": "graph TD\\nA[服务<br/>网关] --> B[注册中心&lt;br&gt;配置中心]"
}`;
    const parsed = parseOptimizationPlanResponse(raw);
    expect(parsed.mermaid).not.toContain("<br");
    expect(parsed.mermaid).not.toContain("&lt;br");
    expect(parsed.mermaid).toContain("服务\n网关");
    expect(parsed.mermaid).toContain("注册中心\n配置中心");
  });

  it("sanitizes mixed prose around mermaid definition", () => {
    const raw = `
以下是架构图：
\`\`\`mermaid
graph TD
A[网关] --> B[服务]
\`\`\`
说明：这是建议方案
`;
    const sanitized = sanitizeMermaidDefinition(raw);
    expect(sanitized.startsWith("graph TD")).toBe(true);
    expect(sanitized).toContain("A[网关] --> B[服务]");
    expect(sanitized).not.toContain("说明：");
  });

  it("sanitizes unfenced mermaid with trailing explanation", () => {
    const raw = `graph TD
A[服务A] --> B[服务B]
总结：请按需扩容`;
    const sanitized = sanitizeMermaidDefinition(raw);
    expect(sanitized).toContain("A[服务A] --> B[服务B]");
    expect(sanitized).not.toContain("总结：");
  });

  it("returns empty payload when response is non-JSON", () => {
    const parsed = parseOptimizationPlanResponse(
      "## 变更总结\n- [性能] 优化MySQL：实现读写分离\n```mermaid\ngraph TD\nA-->B\n```",
    );
    expect(parsed.summary).toBe("");
    expect(parsed.mermaid).toBe("");
    expect(parsed.fullSummary).toBe("");
  });
});
