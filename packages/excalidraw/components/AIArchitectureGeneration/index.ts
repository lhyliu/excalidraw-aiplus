/**
 * AI架构生成模块 - 统一入口
 * 
 * 模块结构:
 * - types: 统一类型定义
 * - core: 核心数据处理逻辑
 * - state: 分层状态管理
 * - ui: 共享UI组件
 * - utils: 工具函数
 * - compat: 向后兼容层
 *
 * 注意: ai/generators/ 和 ai/prompts/ 已删除（死代码，未被任何组件引用）。
 * 实际 AI 调用在 AIArchitectureGenerationDialog/hooks/ 中通过 runAIStream 实现。
 */

import { getBestFieldMapping, inferFieldMapping } from "./core/inference";
import type { AliasStore, FieldInferenceResult, FieldMapping } from "./types";

// 类型导出
export * from "./types";

// 核心逻辑导出
export * from "./core";

// 状态管理导出
export * from "./state";

// UI组件导出
export * from "./ui";

// 工具函数导出
export * from "./utils";

// 初始化函数
export { initCompatibilityLayer } from "./compat";

// 兼容命名导出: 字段推断/映射
export const inferFieldCandidates = (
  headers: string[],
  _aliasStore: AliasStore = {},
): FieldInferenceResult => inferFieldMapping({ headers, rows: [] });

export const buildInitialFieldMapping = (
  inferred: FieldInferenceResult,
): FieldMapping => getBestFieldMapping(inferred);
