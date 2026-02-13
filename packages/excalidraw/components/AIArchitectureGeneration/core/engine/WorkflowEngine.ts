/**
 * 流程引擎 - 声明式步骤流程管理
 * 支持步骤验证、生命周期钩子和分支流程
 */

import type {
  GenerationStep,
  StepConfig,
  WorkflowState,
  ValidationResult,
} from "../../types";

/** 步骤变更监听器 */
type StepChangeListener = (
  from: GenerationStep | null,
  to: GenerationStep,
  state: WorkflowState,
) => void;

/** 流程引擎配置 */
interface WorkflowEngineConfig {
  steps: StepConfig[];
  initialStep: GenerationStep;
  onStepChange?: StepChangeListener;
}

/** 流程引擎 */
export class WorkflowEngine {
  private steps: Map<GenerationStep, StepConfig>;
  private currentStep: GenerationStep;
  private state: WorkflowState;
  private listeners: StepChangeListener[] = [];

  constructor(config: WorkflowEngineConfig) {
    this.steps = new Map(config.steps.map((s) => [s.id, s]));
    this.currentStep = config.initialStep;
    this.state = this.createInitialState();
    
    if (config.onStepChange) {
      this.listeners.push(config.onStepChange);
    }
  }

  private createInitialState(): WorkflowState {
    return {
      currentStep: this.currentStep,
      completedSteps: [],
      skippedSteps: [],
      parsedCsv: null,
      fieldMapping: {},
      fieldInference: {},
      normalizedRows: [],
      cellEdits: {},
      ignoredRows: [],
      issues: [],
      serviceGroups: [],
      calibration: { tasks: [], status: "idle" },
      aliasStore: {},
    };
  }

  /** 获取当前步骤 */
  getCurrentStep(): GenerationStep {
    return this.currentStep;
  }

  /** 获取步骤配置 */
  getStepConfig(stepId: GenerationStep): StepConfig | undefined {
    return this.steps.get(stepId);
  }

  /** 获取所有步骤配置 */
  getAllSteps(): StepConfig[] {
    return Array.from(this.steps.values());
  }

  /** 获取工作流状态 */
  getState(): WorkflowState {
    return this.state;
  }

  /** 更新工作流状态 */
  setState(updater: (state: WorkflowState) => WorkflowState): void {
    this.state = updater(this.state);
  }

  /** 验证是否可以进入步骤 */
  canEnterStep(stepId: GenerationStep): boolean {
    const config = this.steps.get(stepId);
    if (!config) return false;

    if (config.validateEnter) {
      return config.validateEnter(this.state);
    }

    return true;
  }

  /** 验证是否可以离开当前步骤 */
  canExitCurrentStep(): ValidationResult {
    const config = this.steps.get(this.currentStep);
    if (!config || !config.validateExit) {
      return { ok: true };
    }

    return config.validateExit(this.state);
  }

  /** 导航到指定步骤 */
  navigateTo(stepId: GenerationStep): ValidationResult {
    // 检查目标步骤是否存在
    const targetConfig = this.steps.get(stepId);
    if (!targetConfig) {
      return { ok: false, errors: [`步骤 ${stepId} 不存在`] };
    }

    // 验证是否可以离开当前步骤
    const exitResult = this.canExitCurrentStep();
    if (!exitResult.ok) {
      return exitResult;
    }

    // 验证是否可以进入目标步骤
    if (!this.canEnterStep(stepId)) {
      return {
        ok: false,
        errors: [`当前状态下无法进入步骤 ${stepId}`],
      };
    }

    const previousStep = this.currentStep;

    // 执行当前步骤的 onExit
    const currentConfig = this.steps.get(this.currentStep);
    if (currentConfig?.onExit) {
      this.state = currentConfig.onExit(this.state);
    }

    // 标记当前步骤为已完成
    if (!this.state.completedSteps.includes(this.currentStep)) {
      this.state.completedSteps.push(this.currentStep);
    }

    // 切换步骤
    this.currentStep = stepId;
    this.state.currentStep = stepId;

    // 执行新步骤的 onEnter
    if (targetConfig.onEnter) {
      this.state = targetConfig.onEnter(this.state);
    }

    // 触发监听器
    this.listeners.forEach((listener) =>
      listener(previousStep, stepId, this.state),
    );

    return { ok: true };
  }

  /** 获取下一步 */
  getNextStep(): GenerationStep | null {
    const config = this.steps.get(this.currentStep);
    if (!config?.nextSteps || config.nextSteps.length === 0) {
      return null;
    }

    // 返回第一个可用的下一步
    for (const nextStep of config.nextSteps) {
      if (this.canEnterStep(nextStep)) {
        return nextStep;
      }
    }

    return null;
  }

  /** 导航到下一步 */
  goToNext(): ValidationResult {
    const nextStep = this.getNextStep();
    if (!nextStep) {
      return { ok: false, errors: ["没有可用的下一步"] };
    }

    return this.navigateTo(nextStep);
  }

  /** 检查是否可以返回上一步 */
  canGoBack(): boolean {
    return this.state.completedSteps.length > 0;
  }

  /** 返回上一步 */
  goBack(): ValidationResult {
    if (!this.canGoBack()) {
      return { ok: false, errors: ["没有上一步"] };
    }

    // 获取上一个完成的步骤
    const previousStep = this.state.completedSteps[
      this.state.completedSteps.length - 1
    ];

    // 从已完成列表中移除
    this.state.completedSteps.pop();

    const currentConfig = this.steps.get(this.currentStep);
    if (currentConfig?.onExit) {
      this.state = currentConfig.onExit(this.state);
    }

    const oldStep = this.currentStep;
    this.currentStep = previousStep;
    this.state.currentStep = previousStep;

    this.listeners.forEach((listener) =>
      listener(oldStep, previousStep, this.state),
    );

    return { ok: true };
  }

  /** 跳过当前步骤 */
  skipCurrentStep(): ValidationResult {
    const config = this.steps.get(this.currentStep);
    if (!config?.skippable) {
      return { ok: false, errors: ["当前步骤不能跳过"] };
    }

    if (!this.state.skippedSteps.includes(this.currentStep)) {
      this.state.skippedSteps.push(this.currentStep);
    }

    return this.goToNext();
  }

  /** 添加步骤变更监听器 */
  addListener(listener: StepChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /** 检查步骤是否已完成 */
  isStepCompleted(stepId: GenerationStep): boolean {
    return this.state.completedSteps.includes(stepId);
  }

  /** 检查步骤是否被跳过 */
  isStepSkipped(stepId: GenerationStep): boolean {
    return this.state.skippedSteps.includes(stepId);
  }

  /** 重置流程 */
  reset(): void {
    const oldStep = this.currentStep;
    this.currentStep = "import";
    this.state = this.createInitialState();

    this.listeners.forEach((listener) =>
      listener(oldStep, "import", this.state),
    );
  }
}

/** 创建默认步骤配置 */
export function createDefaultSteps(): StepConfig[] {
  return [
    {
      id: "import",
      title: "导入数据",
      description: "上传CSV文件并解析",
      validateEnter: () => true,
      validateExit: (state) =>
        state.parsedCsv ? { ok: true } : { ok: false, errors: ["请先导入数据"] },
      nextSteps: ["mapping"],
    },
    {
      id: "mapping",
      title: "字段映射",
      description: "将CSV列映射到标准字段",
      validateEnter: (state) => !!state.parsedCsv,
      validateExit: (state) => {
        const requiredFields = ["hostname", "privateIp", "serviceName"] as const;
        const missing = requiredFields.filter(
          (f) => !state.fieldMapping[f],
        );
        return missing.length === 0
          ? { ok: true }
          : {
              ok: false,
              errors: [`缺少必填字段映射: ${missing.join(", ")}`],
            };
      },
      nextSteps: ["issues"],
    },
    {
      id: "issues",
      title: "数据检查",
      description: "检查并修复数据问题",
      validateEnter: (state) =>
        Object.keys(state.fieldMapping).length > 0,
      skippable: true,
      nextSteps: ["draft"],
    },
    {
      id: "draft",
      title: "服务分组",
      description: "查看AI生成的服务分组",
      validateEnter: (state) => state.normalizedRows.length > 0,
      nextSteps: ["calibrate"],
    },
    {
      id: "calibrate",
      title: "校准确认",
      description: "确认并校准最终结果",
      validateEnter: (state) => state.serviceGroups.length > 0,
    },
  ];
}

/** 创建默认流程引擎 */
export function createDefaultWorkflowEngine(
  onStepChange?: StepChangeListener,
): WorkflowEngine {
  return new WorkflowEngine({
    steps: createDefaultSteps(),
    initialStep: "import",
    onStepChange,
  });
}
