import React from "react";

import { AiUnderstandingPanel } from "../AiUnderstandingPanel";
import { CalibrationStepper } from "../CalibrationStepper";
import type { GenerationStep } from "../types";

import { CenterStage } from "./CenterStage";

interface WorkflowShellProps {
  step: GenerationStep;
  archDocStatus: "draft" | "calibrating" | "confirmed";
  calibrationProgress: {
    done: number;
    total: number;
  };
  mappingWarningCount: number;
  pendingIssueCount: number;
  canPreviewDraft: boolean;
  stepBlockReasons: Partial<Record<GenerationStep, string>>;
  onStepChange: (step: GenerationStep) => void;
  showAiSummary?: boolean;
  children: React.ReactNode;
}

export const WorkflowShell: React.FC<WorkflowShellProps> = ({
  step,
  archDocStatus,
  calibrationProgress,
  mappingWarningCount,
  pendingIssueCount,
  canPreviewDraft,
  stepBlockReasons,
  onStepChange,
  showAiSummary = true,
  children,
}) => {
  if (!showAiSummary) {
    return (
      <div className="ai-architecture-generation-dialog__focus-layout">
        <CalibrationStepper
          compact
          step={step}
          archDocStatus={archDocStatus}
          calibrationProgress={calibrationProgress}
          mappingWarningCount={mappingWarningCount}
          pendingIssueCount={pendingIssueCount}
          canPreviewDraft={canPreviewDraft}
          stepBlockReasons={stepBlockReasons}
          onStepChange={onStepChange}
        />
        <CenterStage>{children}</CenterStage>
      </div>
    );
  }

  return (
    <div
      className={`ai-architecture-generation-dialog__calibration-layout${
        showAiSummary ? "" : " is-focus-table"
      }`}
    >
      <CalibrationStepper
        step={step}
        archDocStatus={archDocStatus}
        calibrationProgress={calibrationProgress}
        mappingWarningCount={mappingWarningCount}
        pendingIssueCount={pendingIssueCount}
        canPreviewDraft={canPreviewDraft}
        stepBlockReasons={stepBlockReasons}
        onStepChange={onStepChange}
      />
      <CenterStage>{children}</CenterStage>
      {showAiSummary && <AiUnderstandingPanel />}
    </div>
  );
};
