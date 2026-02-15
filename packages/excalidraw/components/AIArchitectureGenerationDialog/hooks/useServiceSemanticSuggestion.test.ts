import { describe, expect, it } from "vitest";

import { parseServiceSemanticSuggestions } from "./useServiceSemanticSuggestion";

describe("parseServiceSemanticSuggestions", () => {
  it("parses JSON suggestions", () => {
    const parsed = parseServiceSemanticSuggestions(
      '{"suggestions":[{"rowId":1,"serviceName":"OMS数据库","reason":"hostname含db"}]}',
    );
    expect(parsed).toEqual([
      { rowId: 1, serviceName: "OMS数据库", reason: "hostname含db" },
    ]);
  });

  it("parses wrapped JSON suggestions", () => {
    const parsed = parseServiceSemanticSuggestions(
      '以下是结果：{"suggestions":[{"rowId":2,"serviceName":"业务应用服务器","reason":"hostname含应用服务器"}]} 完成',
    );
    expect(parsed).toEqual([
      { rowId: 2, serviceName: "业务应用服务器", reason: "hostname含应用服务器" },
    ]);
  });

  it("returns empty list for invalid payload", () => {
    expect(parseServiceSemanticSuggestions("not-json")).toEqual([]);
  });
});
