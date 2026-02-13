/**
 * 工作流引擎单元测试
 */

import { describe, it, expect } from "vitest";
import { WorkflowEngine, createDefaultWorkflowEngine } from "../core/engine/WorkflowEngine";

describe("WorkflowEngine", () => {
  it("应创建默认工作流引擎", () => {
    const engine = createDefaultWorkflowEngine();
    expect(engine.getCurrentStep()).toBe("import");
  });

  it("应能获取当前步骤", () => {
    const engine = createDefaultWorkflowEngine();
    expect(typeof engine.getCurrentStep()).toBe("string");
  });
});
