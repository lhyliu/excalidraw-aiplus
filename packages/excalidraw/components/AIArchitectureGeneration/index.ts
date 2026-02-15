/**
 * AI 架构生成模块统一入口
 */

import { getBestFieldMapping, inferFieldMapping } from "./core/inference";
import type { AliasStore, FieldInferenceResult, FieldMapping } from "./types";

export * from "./types";
export * from "./core";
export * from "./state";
export * from "./ui";
export * from "./utils";

export const inferFieldCandidates = (
  headers: string[],
  _aliasStore: AliasStore = {},
): FieldInferenceResult => inferFieldMapping({ headers, rows: [] });

export const buildInitialFieldMapping = (
  inferred: FieldInferenceResult,
): FieldMapping => getBestFieldMapping(inferred);

