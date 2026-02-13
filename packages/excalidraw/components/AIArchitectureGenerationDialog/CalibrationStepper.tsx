import React from "react";

import type { GenerationStep } from "./types";

interface CalibrationStepperProps {
  step: GenerationStep;
  archDocStatus: "draft" | "calibrating" | "confirmed";
  calibrationProgress: { done: number; total: number };
  mappingWarningCount: number;
  pendingIssueCount: number;
  canPreviewDraft: boolean;
  stepBlockReasons: Partial<Record<GenerationStep, string>>;
  onStepChange: (step: GenerationStep) => void;
  compact?: boolean;
}

const steps: Array<{ label: string; step: GenerationStep }> = [
  { label: "数据工作台", step: "workspace" },
  { label: "架构图视图", step: "draft" },
  { label: "可信现状", step: "calibrate" },
];

const indexFromStep = (step: GenerationStep): number => {
  if (
    step === "workspace" ||
    step === "import" ||
    step === "mapping" ||
    step === "issues"
  ) {
    return 0;
  }
  if (step === "draft") {
    return 1;
  }
  return 2;
};

export const CalibrationStepper: React.FC<CalibrationStepperProps> = ({
  step,
  archDocStatus,
  calibrationProgress,
  mappingWarningCount,
  pendingIssueCount,
  canPreviewDraft,
  stepBlockReasons,
  onStepChange,
  compact = false,
}) => {
  const activeIndex = indexFromStep(step);
  const statusLabel =
    archDocStatus === "confirmed"
      ? "已确认"
      : archDocStatus === "draft"
        ? "初稿"
        : "校准中";
  const stepState = (itemStep: GenerationStep): "done" | "warning" | "error" | "active" => {
    if (
      (itemStep === "workspace" &&
        (step === "workspace" ||
          step === "import" ||
          step === "mapping" ||
          step === "issues")) ||
      itemStep === step
    ) {
      return "active";
    }
    if (itemStep === "workspace" && mappingWarningCount > 0) {
      return "warning";
    }
    if (itemStep === "workspace" && pendingIssueCount > 0) {
      return "error";
    }
    if (itemStep === "calibrate" && archDocStatus !== "confirmed") {
      return "warning";
    }
    return "done";
  };

  if (compact) {
    return (
      <section className="ai-architecture-generation-dialog__top-stepper">
        <div className="ai-architecture-generation-dialog__inline-form">
          <strong>AI理解进度</strong>
          <span className="ai-architecture-generation-dialog__summary">
            状态: {statusLabel}
          </span>
          <span className="ai-architecture-generation-dialog__summary">
            校准: {calibrationProgress.done}/{calibrationProgress.total}
          </span>
          <button
            type="button"
            className={`ai-architecture-generation-dialog__draft-cta${
              canPreviewDraft ? " is-ready" : ""
            }`}
            disabled={!canPreviewDraft}
            title={!canPreviewDraft ? "请先导入数据" : undefined}
            onClick={() => onStepChange("draft")}
          >
            进入架构图视图
          </button>
        </div>
        <ol className="ai-architecture-generation-dialog__stepper ai-architecture-generation-dialog__stepper--compact">
          {steps.map((item, index) => (
            <li
              key={item.label}
              className={
                index === activeIndex
                  ? "ai-architecture-generation-dialog__stepper-item is-active"
                  : "ai-architecture-generation-dialog__stepper-item"
              }
            >
              <button
                type="button"
                className="ai-architecture-generation-dialog__stepper-btn"
                disabled={Boolean(stepBlockReasons[item.step])}
                title={stepBlockReasons[item.step]}
                onClick={() => onStepChange(item.step)}
              >
                <span
                  className={`ai-architecture-generation-dialog__step-signal ai-architecture-generation-dialog__step-signal--${stepState(
                    item.step,
                  )}`}
                />
                {item.label}
                {item.step === "workspace" && mappingWarningCount > 0 && (
                  <span className="ai-architecture-generation-dialog__step-badge">
                    {mappingWarningCount}
                  </span>
                )}
                {item.step === "workspace" && pendingIssueCount > 0 && (
                  <span className="ai-architecture-generation-dialog__step-badge is-danger">
                    {pendingIssueCount}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <aside className="ai-architecture-generation-dialog__side-panel">
      <h4>AI 理解进度</h4>
      <div className="ai-architecture-generation-dialog__summary">
        状态: {statusLabel}
      </div>
      <div className="ai-architecture-generation-dialog__summary">
        校准进度: {calibrationProgress.done}/{calibrationProgress.total}
      </div>
      <ol className="ai-architecture-generation-dialog__stepper">
        {steps.map((item, index) => (
          <li
            key={item.label}
            className={
              index === activeIndex
                ? "ai-architecture-generation-dialog__stepper-item is-active"
                : "ai-architecture-generation-dialog__stepper-item"
            }
          >
            <button
              type="button"
              className="ai-architecture-generation-dialog__stepper-btn"
              disabled={Boolean(stepBlockReasons[item.step])}
              title={stepBlockReasons[item.step]}
              onClick={() => onStepChange(item.step)}
            >
              <span
                className={`ai-architecture-generation-dialog__step-signal ai-architecture-generation-dialog__step-signal--${stepState(
                  item.step,
                )}`}
              />
              {item.label}
              {item.step === "workspace" && mappingWarningCount > 0 && (
                <span className="ai-architecture-generation-dialog__step-badge">
                  {mappingWarningCount}
                </span>
              )}
              {item.step === "workspace" && pendingIssueCount > 0 && (
                <span className="ai-architecture-generation-dialog__step-badge is-danger">
                  {pendingIssueCount}
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className={`ai-architecture-generation-dialog__draft-cta${
          canPreviewDraft ? " is-ready" : ""
        }`}
        disabled={!canPreviewDraft}
        title={!canPreviewDraft ? "请先导入数据" : undefined}
        onClick={() => onStepChange("draft")}
      >
        进入架构图视图（AI 自动补全剩余信息）
      </button>
    </aside>
  );
};
