/**
 * 推断功能导出
 */

export {
  inferFieldMapping,
  getBestFieldMapping,
  hasRequiredFields,
  calculateInferenceConfidence,
} from "./fieldInference";

export {
  inferServiceGroups,
  mergeSimilarGroups,
  type GroupingOptions,
} from "./inferServiceGroups";
