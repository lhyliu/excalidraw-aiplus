import { describe, expect, it } from "vitest";

import { parseBusinessArchitectureSuggestion } from "./useBusinessArchitectureSuggestion";

describe("parseBusinessArchitectureSuggestion", () => {
  it("parses valid json payload", () => {
    const parsed = parseBusinessArchitectureSuggestion(
      JSON.stringify({
        summary: "订单业务核心链路",
        mermaid: "graph TD\nA[WAF]-->B[APP]",
        layers: [
          {
            name: "边界接入层",
            description: "统一入口",
            reason: "hostname包含waf",
            rowIds: [1, 2],
          },
        ],
      }),
    );

    expect(parsed?.mermaid).toContain("graph TD");
    expect(parsed?.layers[0]?.name).toBe("边界接入层");
  });

  it("parses wrapped json payload", () => {
    const parsed = parseBusinessArchitectureSuggestion(
      '分析结果如下：{"summary":"订单架构","mermaid":"graph TD\\nA-->B","layers":[]} 请查收',
    );
    expect(parsed?.mermaid).toContain("graph TD");
  });

  it("returns null when mermaid is missing", () => {
    const parsed = parseBusinessArchitectureSuggestion(
      JSON.stringify({
        summary: "invalid",
        layers: [],
      }),
    );
    expect(parsed).toBeNull();
  });
});
