import { describe, expect, it } from "vitest";

import { validateFieldMapping } from "./helpers";

describe("validateFieldMapping", () => {
  it("requires serviceName for diagram minimum mapping", () => {
    const result = validateFieldMapping({
      hostname: "Host",
      privateIp: "IP",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.missingRequiredFields).toContain("serviceName");
  });

  it("rejects duplicate required header reuse", () => {
    const result = validateFieldMapping({
      hostname: "Host",
      privateIp: "IP",
      serviceName: "Host",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.missingRequiredFields).toContain("serviceName");
  });
});
