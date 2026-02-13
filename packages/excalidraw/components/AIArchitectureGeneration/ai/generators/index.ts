/**
 * AI生成器导出
 */

export {
  BaseAIGenerator,
  GeneratorRegistry,
  globalGeneratorRegistry,
} from "./base";

export {
  ServiceNamingGenerator,
  generateBatchNamingSuggestions,
} from "./ServiceNamingGenerator";

export {
  ArchitectureDiagramGenerator,
  quickGenerateDiagram,
} from "./ArchitectureDiagramGenerator";

export {
  DataFixSuggestionGenerator,
  applyAutoFixes,
} from "./DataFixSuggestionGenerator";
