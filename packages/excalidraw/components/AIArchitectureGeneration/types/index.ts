/**
 * AI架构生成模块 - 统一类型定义
 * 整合原 importWorkflow/types.ts 和组件内部类型
 */

// ============================================
// 基础类型定义
// ============================================

/** 标准字段定义 */
export const STANDARD_FIELDS = [
  "hostname",
  "privateIp",
  "serviceName",
  "environment",
  "cpuCores",
  "memoryGb",
  "cluster",
  "region",
] as const;

export type StandardField = (typeof STANDARD_FIELDS)[number];

/** 生成步骤 */
export type GenerationStep =
  | "import"
  | "mapping"
  | "issues"
  | "draft"
  | "calibrate";

/** 生成模式 */
export type GenerationMode = "safe" | "advanced";

// ============================================
// 数据类型定义
// ============================================

/** 原始CSV行 */
export type RawCsvRow = {
  rowId: number;
  values: Record<string, string>;
  raw: Record<string, string>;
};

/** 解析后的CSV数据 */
export type ParsedCsv = {
  headers: string[];
  rows: RawCsvRow[];
};

/** 字段候选 */
export type FieldCandidate = {
  field: StandardField;
  header: string;
  score: number;
  reason: string;
};

/** 字段推断结果 */
export type FieldInferenceResult = Partial<Record<StandardField, FieldCandidate[]>>;

/** 字段映射 */
export type FieldMapping = Partial<Record<StandardField, string>>;

/** 别名存储 */
export type AliasStore = Partial<Record<StandardField, string[]>>;

/** 字段映射验证结果 */
export type FieldMappingValidation =
  | { ok: true }
  | { ok: false; missingRequiredFields: StandardField[] };

/** 单元格编辑 */
export type CellEdits = Record<number, Record<string, string>>;

/** 忽略的行 */
export type IgnoredRows = number[];

/** 规范化后的虚拟机数据 */
export type CanonicalVmRow = {
  hostname: string;
  privateIp: string;
  serviceName: string;
  environment: string;
  cpuCores: number | null;
  memoryGb: number | null;
  cluster: string;
  region: string;
};

/** 规范化后的行数据 */
export type NormalizedVmRow = {
  rowId: number;
  raw: Record<string, string>;
  vm: CanonicalVmRow;
};

// ============================================
// 问题类型定义
// ============================================

/** 问题代码 */
export type IssueCode =
  | "missing_required"
  | "invalid_ip"
  | "invalid_number"
  | "duplicate_hostname"
  | "duplicate_ip"
  | "unknown_environment";

/** 问题严重程度 */
export type IssueSeverity = "warning" | "error";

/** 数据问题 */
export type Issue = {
  id: string;
  rowId: number;
  code: IssueCode;
  severity: IssueSeverity;
  message: string;
  field?: StandardField;
  suggestedValue?: string;
};

// ============================================
// 服务分组类型定义
// ============================================

/** 服务分组 */
export type ServiceGroup = {
  id: string;
  name: string;
  rowIds: number[];
  confidence: number;
  reason: string;
};

// ============================================
// 校准类型定义
// ============================================

/** 校准任务类型 */
export type CalibrationTaskType = "resolve_issue" | "confirm_group";

/** 校准任务 */
export type CalibrationTask = {
  id: string;
  type: CalibrationTaskType;
  title: string;
  blocking: boolean;
  done: boolean;
  issueId?: string;
  groupId?: string;
};

/** 校准状态 */
export type CalibrationState = {
  tasks: CalibrationTask[];
  status: "idle" | "in_progress" | "confirmed";
};

/** 置信度状态 */
export type ConfidenceState = "draft" | "calibrating" | "confirmed";

// ============================================
// 流程引擎类型定义
// ============================================

/** 验证结果 */
export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

/** 步骤配置 */
export interface StepConfig {
  id: GenerationStep;
  title: string;
  description: string;
  validateEnter?: (state: WorkflowState) => boolean;
  validateExit?: (state: WorkflowState) => ValidationResult;
  onEnter?: (state: WorkflowState) => WorkflowState;
  onExit?: (state: WorkflowState) => WorkflowState;
  nextSteps?: GenerationStep[];
  skippable?: boolean;
}

/** 工作流程状态 */
export interface WorkflowState {
  currentStep: GenerationStep;
  completedSteps: GenerationStep[];
  skippedSteps: GenerationStep[];
  parsedCsv: ParsedCsv | null;
  fieldMapping: FieldMapping;
  fieldInference: FieldInferenceResult;
  normalizedRows: NormalizedVmRow[];
  cellEdits: CellEdits;
  ignoredRows: IgnoredRows;
  issues: Issue[];
  serviceGroups: ServiceGroup[];
  calibration: CalibrationState;
  aliasStore: AliasStore;
}

// ============================================
// AI生成器类型定义
// ============================================

/** AI生成结果 */
export type AIResult<T> =
  | { success: true; data: T; confidence: number }
  | { success: false; error: string; retryable: boolean };

/** AI生成器接口 */
export interface AIGenerator<TInput, TOutput> {
  readonly id: string;
  readonly name: string;
  generate(input: TInput): Promise<AIResult<TOutput>>;
  validateOutput(output: unknown): output is TOutput;
}

/** 命名建议上下文 */
export interface NamingContext {
  serviceGroup: ServiceGroup;
  environment: string;
  cluster: string;
  relatedServices: string[];
  existingNames: string[];
}

/** 架构图风格 */
export type DiagramStyle = "microservices" | "monolith" | "layered" | "network";

/** 架构图生成输入 */
export interface DiagramGenerationInput {
  serviceGroups: ServiceGroup[];
  normalizedRows: NormalizedVmRow[];
  style: DiagramStyle;
  includeDetails: boolean;
}

/** 数据修复建议 */
export interface DataFixSuggestion {
  issueId: string;
  suggestedValue: string;
  reason: string;
  confidence: number;
  autoApplicable: boolean;
}

// ============================================
// 会话状态类型
// ============================================

/** AI架构生成会话状态 */
export interface AIArchitectureGenerationSessionState {
  step: GenerationStep;
  mode: GenerationMode;
  draftFilter: string;
  namingSuggestions: Record<string, string[]>;
  version: number; // 用于数据迁移
}

/** 默认会话状态 */
export const DEFAULT_SESSION_STATE: AIArchitectureGenerationSessionState = {
  step: "import",
  mode: "safe",
  draftFilter: "",
  namingSuggestions: {},
  version: 2, // 新版本号
};

// ============================================
// UI状态类型
// ============================================

/** UI状态 */
export interface UIState {
  isLoading: boolean;
  error: string | null;
  sidebarOpen: boolean;
  activeDetailRow: number | null;
  showHelp: boolean;
}

/** 步骤导航状态 */
export interface StepperState {
  currentStep: GenerationStep;
  visitedSteps: GenerationStep[];
  canGoBack: boolean;
  canGoNext: boolean;
  canFinish: boolean;
}
