import React from "react";

import { FieldMappingStep } from "../../AIArchitectureGenerationDialog/FieldMappingStep";
import { GuidedWorkspaceStep } from "../../AIArchitectureGenerationDialog/GuidedWorkspaceStep";
import { ImportStep } from "../../AIArchitectureGenerationDialog/ImportStep";
import type { GenerationStep } from "../../AIArchitectureGenerationDialog/types";

interface CsvFixPageProps {
  step: GenerationStep;
  hasSourceData: boolean;
  hasRequiredMapping: boolean;
  blockingErrorCount: number;
  totalIssueCount: number;
  resolvedIssueCount: number;
  issueFilter: string | null;
  onContinueFieldConfirm: () => void;
  onContinueIssueResolve: () => void;
  onEnterDraftConfirm: () => void;
  onJumpToStep: (step: "ingest" | "fieldConfirm" | "issueResolve") => void;
  onIssueFilterChange: (issueFilter: string | null) => void;
}

export const CsvFixPage: React.FC<CsvFixPageProps> = ({
  step,
  hasSourceData,
  hasRequiredMapping,
  blockingErrorCount,
  totalIssueCount,
  resolvedIssueCount,
  issueFilter,
  onContinueFieldConfirm,
  onContinueIssueResolve,
  onEnterDraftConfirm,
  onJumpToStep,
  onIssueFilterChange,
}) => {
  const stepItems: Array<{
    key: "ingest" | "fieldConfirm" | "issueResolve" | "draftConfirm";
    label: string;
    done: boolean;
    active: boolean;
    clickable: boolean;
  }> = [
    {
      key: "ingest",
      label: "导入",
      done: step !== "ingest",
      active: step === "ingest",
      clickable: true,
    },
    {
      key: "fieldConfirm",
      label: "字段确认",
      done: step === "issueResolve" || step === "draftConfirm",
      active: step === "fieldConfirm",
      clickable: hasSourceData,
    },
    {
      key: "issueResolve",
      label: "问题修复",
      done: step === "draftConfirm" || (step === "issueResolve" && blockingErrorCount === 0),
      active: step === "issueResolve",
      clickable: hasSourceData && hasRequiredMapping,
    },
    {
      key: "draftConfirm",
      label: "草图确认",
      done: step === "draftConfirm",
      active: false,
      clickable: false,
    },
  ];
  const issueCompletion =
    totalIssueCount > 0
      ? Math.round((resolvedIssueCount / totalIssueCount) * 100)
      : 100;

  const cockpit = (
    <section className="ai-architecture-generation-dialog__progress-inline-compact">
      <div className="ai-architecture-generation-dialog__progress-inline-item">
        <strong>步骤：</strong>
        <div className="ai-architecture-generation-dialog__progress-steps">
          {stepItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`ai-architecture-generation-dialog__progress-step${item.active ? " is-active" : ""}${item.done ? " is-done" : ""}`}
              disabled={!item.clickable}
              onClick={() => {
                if (
                  item.key === "ingest" ||
                  item.key === "fieldConfirm" ||
                  item.key === "issueResolve"
                ) {
                  onJumpToStep(item.key);
                }
              }}
            >
              <span className="ai-architecture-generation-dialog__progress-step-label">
                {item.label}
              </span>
            </button>
          ))}
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

  if (step === "ingest") {
    return (
      <>
        {cockpit}
        <ImportStep
          onContinue={onContinueFieldConfirm}
          onGenerateDraft={onEnterDraftConfirm}
        />
      </>
    );
  }

  if (step === "fieldConfirm") {
    return (
      <>
        {cockpit}
        <FieldMappingStep
          onContinue={onContinueIssueResolve}
          onGenerateDraft={onEnterDraftConfirm}
        />
      </>
    );
  }

  return (
    <>
      {cockpit}
      <GuidedWorkspaceStep
        onContinueDraft={onEnterDraftConfirm}
        activeIssueFilterKey={issueFilter}
        onActiveIssueFilterKeyChange={onIssueFilterChange}
      />
    </>
  );
};
