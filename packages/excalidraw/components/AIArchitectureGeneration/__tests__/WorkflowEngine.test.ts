/**
 * 宸ヤ綔娴佸紩鎿庡崟鍏冩祴璇? */

import { describe, it, expect } from "vitest";
import { WorkflowEngine, createDefaultWorkflowEngine } from "../core/engine/WorkflowEngine";

describe("WorkflowEngine", () => {
  it("搴斿垱寤洪粯璁ゅ伐浣滄祦寮曟搸", () => {
    const engine = createDefaultWorkflowEngine();
    expect(engine.getCurrentStep()).toBe("ingest");
  });

  it("搴旇兘鑾峰彇褰撳墠姝ラ", () => {
    const engine = createDefaultWorkflowEngine();
    expect(typeof engine.getCurrentStep()).toBe("string");
  });
});
