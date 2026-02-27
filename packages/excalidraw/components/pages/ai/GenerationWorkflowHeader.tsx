import React from "react";

import { t } from "../../../i18n";
import type { GenerationStep } from "../../AIArchitectureGenerationDialog/types";

type StepAccessMode = "editable" | "viewOnly";

interface GenerationWorkflowHeaderProps {
  activeStep: GenerationStep;
  progressStep: GenerationStep;
  blockingErrorCount: number;
  totalIssueCount: number;
  resolvedIssueCount: number;
  stepAccess: Record<
    GenerationStep,
    {
      mode: StepAccessMode;
      reason?: string;
    }
  >;
  onStepSelect: (step: GenerationStep) => void;
}

const steps: GenerationStep[] = [
  "ingest",
  "fieldConfirm",
  "issueResolve",
  "draftConfirm",
];

const getStepLabel = (step: GenerationStep) => {
  switch (step) {
    case "ingest":
      return t("labels.aiGenerationStepIngest");
    case "fieldConfirm":
      return t("labels.aiGenerationStepFieldConfirm");
    case "issueResolve":
      return t("labels.aiGenerationStepIssueResolve");
    case "draftConfirm":
      return t("labels.aiGenerationStepDraftConfirm");
    default:
      return step;
  }
};

export const GenerationWorkflowHeader: React.FC<GenerationWorkflowHeaderProps> = ({
  activeStep,
  progressStep,
  blockingErrorCount,
  totalIssueCount,
  resolvedIssueCount,
  stepAccess,
  onStepSelect,
}) => {
  const issueCompletion =
    totalIssueCount > 0
      ? Math.round((resolvedIssueCount / totalIssueCount) * 100)
      : 100;
  const progressIndex = steps.findIndex((item) => item === progressStep);

  return (
    <section className="ai-architecture-generation-dialog__progress-inline-compact ai-architecture-generation-dialog__workflow-header">
      <div className="ai-architecture-generation-dialog__progress-inline-item">
        <strong>{t("labels.aiArchitectureGeneration")}</strong>
        <div className="ai-architecture-generation-dialog__progress-steps">
          {steps.map((step) => {
            const access = stepAccess[step];
            const isDone = steps.findIndex((item) => item === step) < progressIndex;
            const isActive = step === activeStep;
            return (
              <button
                key={step}
                type="button"
                className={`ai-architecture-generation-dialog__progress-step${isDone ? " is-done" : ""}${isActive ? " is-active" : ""}${access.mode === "viewOnly" ? " is-view-only" : ""}`}
                title={access.reason}
                onClick={() => onStepSelect(step)}
              >
                <span className="ai-architecture-generation-dialog__progress-step-label">
                  {getStepLabel(step)}
                </span>
                {access.mode === "viewOnly" && (
                  <span className="ai-architecture-generation-dialog__summary">
                    ({t("labels.aiGenerationReadOnlyMode")})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <span className="ai-architecture-generation-dialog__progress-inline-separator" />
      <div className="ai-architecture-generation-dialog__progress-inline-item">
        <strong>修复：</strong>
        <span>
          {resolvedIssueCount}/{totalIssueCount}（{issueCompletion}%）
        </span>
      </div>
      <span className="ai-architecture-generation-dialog__progress-inline-separator" />
      <div className="ai-architecture-generation-dialog__progress-inline-item">
        <strong>阻断：</strong>
        <span>{blockingErrorCount}</span>
      </div>
    </section>
  );
};
