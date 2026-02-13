import { describe, expect, it } from "vitest";

import { parseFieldMappingSuggestion } from "./useFieldMappingSuggestion";

describe("parseFieldMappingSuggestion", () => {
  it("parses JSON response payload", () => {
    const parsed = parseFieldMappingSuggestion(
      '{"header":"IP Address","reason":"列名语义与IP一致"}',
    );
    expect(parsed.header).toBe("IP Address");
    expect(parsed.reason).toBe("列名语义与IP一致");
  });

  it("falls back to plain text header", () => {
    const parsed = parseFieldMappingSuggestion("Host Name");
    expect(parsed.header).toBe("Host Name");
    expect(parsed.reason).toBe("");
  });
});

