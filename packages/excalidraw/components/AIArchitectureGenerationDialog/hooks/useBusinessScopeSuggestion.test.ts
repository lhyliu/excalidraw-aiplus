import { describe, expect, it } from "vitest";

import { parseBusinessScopeSuggestion } from "./useBusinessScopeSuggestion";

describe("parseBusinessScopeSuggestion", () => {
  it("parses valid json payload", () => {
    const result = parseBusinessScopeSuggestion(
      '{"scopes":[{"name":"订单业务","groupIds":["group-0","group-2"],"reason":"命中订单关键词"}]}',
    );
    expect(result).toEqual({
      scopes: [
        {
          name: "订单业务",
          groupIds: ["group-0", "group-2"],
          reason: "命中订单关键词",
        },
      ],
    });
  });

  it("parses fenced json payload", () => {
    const result = parseBusinessScopeSuggestion(
      '```json\n{"scopes":[{"name":"支付业务","groupIds":["group-1"],"reason":"serviceName聚类"}]}\n```',
    );
    expect(result?.scopes[0]?.name).toBe("支付业务");
    expect(result?.scopes[0]?.groupIds).toEqual(["group-1"]);
  });

  it("returns null for invalid payload", () => {
    expect(parseBusinessScopeSuggestion("invalid")).toBeNull();
    expect(parseBusinessScopeSuggestion('{"scopes":[]}')).toBeNull();
  });
});

