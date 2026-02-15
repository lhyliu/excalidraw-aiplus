/**
 * Workflow engine for AI architecture generation.
 */

import type {
  GenerationStep,
  StepConfig,
  ValidationResult,
  WorkflowState,
} from "../../types";

type StepChangeListener = (
  from: GenerationStep | null,
  to: GenerationStep,
  state: WorkflowState,
) => void;

interface WorkflowEngineConfig {
  steps: StepConfig[];
  initialStep: GenerationStep;
  onStepChange?: StepChangeListener;
}

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

  getCurrentStep(): GenerationStep {
    return this.currentStep;
  }

  getStepConfig(stepId: GenerationStep): StepConfig | undefined {
    return this.steps.get(stepId);
  }

  getAllSteps(): StepConfig[] {
    return Array.from(this.steps.values());
  }

  getState(): WorkflowState {
    return this.state;
  }

  setState(updater: (state: WorkflowState) => WorkflowState): void {
    this.state = updater(this.state);
  }

  canEnterStep(stepId: GenerationStep): boolean {
    const config = this.steps.get(stepId);
    if (!config) {
      return false;
    }

    if (config.validateEnter) {
      return config.validateEnter(this.state);
    }

    return true;
  }

  canExitCurrentStep(): ValidationResult {
    const config = this.steps.get(this.currentStep);
    if (!config?.validateExit) {
      return { ok: true };
    }

    return config.validateExit(this.state);
  }

  navigateTo(stepId: GenerationStep): ValidationResult {
    const targetConfig = this.steps.get(stepId);
    if (!targetConfig) {
      return { ok: false, errors: [`Step ${stepId} does not exist`] };
    }

    const exitResult = this.canExitCurrentStep();
    if (!exitResult.ok) {
      return exitResult;
    }

    if (!this.canEnterStep(stepId)) {
      return {
        ok: false,
        errors: [`Cannot enter step ${stepId} with current state`],
      };
    }

    const previousStep = this.currentStep;

    const currentConfig = this.steps.get(this.currentStep);
    if (currentConfig?.onExit) {
      this.state = currentConfig.onExit(this.state);
    }

    if (!this.state.completedSteps.includes(this.currentStep)) {
      this.state.completedSteps.push(this.currentStep);
    }

    this.currentStep = stepId;
    this.state.currentStep = stepId;

    if (targetConfig.onEnter) {
      this.state = targetConfig.onEnter(this.state);
    }

    this.listeners.forEach((listener) => listener(previousStep, stepId, this.state));

    return { ok: true };
  }

  getNextStep(): GenerationStep | null {
    const config = this.steps.get(this.currentStep);
    if (!config?.nextSteps?.length) {
      return null;
    }

    for (const nextStep of config.nextSteps) {
      if (this.canEnterStep(nextStep)) {
        return nextStep;
      }
    }

    return null;
  }

  goToNext(): ValidationResult {
    const nextStep = this.getNextStep();
    if (!nextStep) {
      return { ok: false, errors: ["No available next step"] };
    }

    return this.navigateTo(nextStep);
  }

  canGoBack(): boolean {
    return this.state.completedSteps.length > 0;
  }

  goBack(): ValidationResult {
    if (!this.canGoBack()) {
      return { ok: false, errors: ["No previous step"] };
    }

    const previousStep = this.state.completedSteps[this.state.completedSteps.length - 1];
    this.state.completedSteps.pop();

    const currentConfig = this.steps.get(this.currentStep);
    if (currentConfig?.onExit) {
      this.state = currentConfig.onExit(this.state);
    }

    const oldStep = this.currentStep;
    this.currentStep = previousStep;
    this.state.currentStep = previousStep;

    this.listeners.forEach((listener) => listener(oldStep, previousStep, this.state));

    return { ok: true };
  }

  skipCurrentStep(): ValidationResult {
    const config = this.steps.get(this.currentStep);
    if (!config?.skippable) {
      return { ok: false, errors: ["Current step cannot be skipped"] };
    }

    if (!this.state.skippedSteps.includes(this.currentStep)) {
      this.state.skippedSteps.push(this.currentStep);
    }

    return this.goToNext();
  }

  addListener(listener: StepChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  isStepCompleted(stepId: GenerationStep): boolean {
    return this.state.completedSteps.includes(stepId);
  }

  isStepSkipped(stepId: GenerationStep): boolean {
    return this.state.skippedSteps.includes(stepId);
  }

  reset(): void {
    const oldStep = this.currentStep;
    this.currentStep = "ingest";
    this.state = this.createInitialState();
    this.listeners.forEach((listener) => listener(oldStep, "ingest", this.state));
  }
}

export function createDefaultSteps(): StepConfig[] {
  return [
    {
      id: "ingest",
      title: "导入数据",
      description: "上传并解析 CSV 数据",
      validateEnter: () => true,
      validateExit: (state) =>
        state.parsedCsv ? { ok: true } : { ok: false, errors: ["请先导入数据"] },
      nextSteps: ["fieldConfirm"],
    },
    {
      id: "fieldConfirm",
      title: "字段映射",
      description: "将 CSV 列映射到标准字段",
      validateEnter: (state) => Boolean(state.parsedCsv),
      validateExit: (state) => {
        const requiredFields = ["hostname", "privateIp", "serviceName"] as const;
        const missing = requiredFields.filter((f) => !state.fieldMapping[f]);
        return missing.length === 0
          ? { ok: true }
          : { ok: false, errors: [`缺少必填字段映射: ${missing.join(", ")}`] };
      },
      nextSteps: ["issueResolve"],
    },
    {
      id: "issueResolve",
      title: "问题修复",
      description: "检查并修复数据问题",
      validateEnter: (state) => Object.keys(state.fieldMapping).length > 0,
      skippable: true,
      nextSteps: ["draftConfirm"],
    },
    {
      id: "draftConfirm",
      title: "草图确认",
      description: "查看并确认生成草图",
      validateEnter: (state) => state.normalizedRows.length > 0,
    },
  ];
}

export function createDefaultWorkflowEngine(
  onStepChange?: StepChangeListener,
): WorkflowEngine {
  return new WorkflowEngine({
    steps: createDefaultSteps(),
    initialStep: "ingest",
    onStepChange,
  });
}
