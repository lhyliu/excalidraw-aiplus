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

  it("returns empty list for invalid payload", () => {
    expect(parseServiceSemanticSuggestions("not-json")).toEqual([]);
  });
});

