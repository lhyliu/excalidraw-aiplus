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
            name: "边界接入区",
            description: "统一入口",
            reason: "hostname包含waf",
            rowIds: [1, 2],
          },
        ],
      }),
    );

    expect(parsed?.mermaid).toContain("graph TD");
    expect(parsed?.layers[0]?.name).toBe("边界接入区");
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

