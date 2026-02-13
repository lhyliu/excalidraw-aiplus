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
  { label: "导入", step: "ingest" },
  { label: "字段确认", step: "fieldConfirm" },
  { label: "问题修复", step: "issueResolve" },
  { label: "草图确认", step: "draftConfirm" },
];

const indexFromStep = (step: GenerationStep): number =>
  steps.findIndex((item) => item.step === step);

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
  const activeIndex = Math.max(0, indexFromStep(step));
  const statusLabel =
    archDocStatus === "confirmed"
      ? "已确认"
      : archDocStatus === "draft"
        ? "草图中"
        : "校验中";

  const stepState = (itemStep: GenerationStep): "done" | "warning" | "error" | "active" => {
    if (itemStep === step) {
      return "active";
    }
    if (itemStep === "fieldConfirm" && mappingWarningCount > 0) {
      return "warning";
    }
    if (itemStep === "issueResolve" && pendingIssueCount > 0) {
      return "error";
    }
    if (itemStep === "draftConfirm" && !canPreviewDraft) {
      return "warning";
    }
    if (indexFromStep(itemStep) < activeIndex) {
      return "done";
    }
    return "warning";
  };

  if (compact) {
    return (
      <section className="ai-architecture-generation-dialog__top-stepper">
        <div className="ai-architecture-generation-dialog__inline-form">
          <strong>CSV 生成进度</strong>
          <span className="ai-architecture-generation-dialog__summary">
            状态: {statusLabel}
          </span>
          <span className="ai-architecture-generation-dialog__summary">
            修复: {calibrationProgress.done}/{calibrationProgress.total}
          </span>
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
              </button>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <aside className="ai-architecture-generation-dialog__side-panel">
      <h4>CSV 生成进度</h4>
      <div className="ai-architecture-generation-dialog__summary">
        状态: {statusLabel}
      </div>
      <div className="ai-architecture-generation-dialog__summary">
        修复进度: {calibrationProgress.done}/{calibrationProgress.total}
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
        title={!canPreviewDraft ? "请先完成字段确认" : undefined}
        onClick={() => onStepChange("draftConfirm")}
      >
        进入草图确认
      </button>
    </aside>
  );
};

