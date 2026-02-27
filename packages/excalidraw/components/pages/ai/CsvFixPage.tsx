import React from "react";

import { FieldMappingStep } from "../../AIArchitectureGenerationDialog/FieldMappingStep";
import { GuidedWorkspaceStep } from "../../AIArchitectureGenerationDialog/GuidedWorkspaceStep";
import { ImportStep } from "../../AIArchitectureGenerationDialog/ImportStep";
import type { GenerationStep } from "../../AIArchitectureGenerationDialog/types";

interface CsvFixPageProps {
  step: GenerationStep;
  issueFilter: string | null;
  readOnly: boolean;
  readOnlyReason?: string;
  onContinueFieldConfirm: () => void;
  onContinueIssueResolve: () => void;
  onEnterDraftConfirm: () => void;
  onIssueFilterChange: (issueFilter: string | null) => void;
}

export const CsvFixPage: React.FC<CsvFixPageProps> = ({
  step,
  issueFilter,
  readOnly,
  readOnlyReason,
  onContinueFieldConfirm,
  onContinueIssueResolve,
  onEnterDraftConfirm,
  onIssueFilterChange,
}) => {
  if (step === "ingest") {
    return (
      <>
        {readOnly && readOnlyReason && (
          <div className="ai-architecture-generation-dialog__readonly-banner">
            当前为只读预览：{readOnlyReason}
          </div>
        )}
        <ImportStep
          onContinue={readOnly ? () => {} : onContinueFieldConfirm}
          onGenerateDraft={readOnly ? () => {} : onEnterDraftConfirm}
          readOnly={readOnly}
        />
      </>
    );
  }

  if (step === "fieldConfirm") {
    return (
      <>
        {readOnly && readOnlyReason && (
          <div className="ai-architecture-generation-dialog__readonly-banner">
            当前为只读预览：{readOnlyReason}
          </div>
        )}
        <FieldMappingStep
          onContinue={readOnly ? () => {} : onContinueIssueResolve}
          onGenerateDraft={readOnly ? () => {} : onEnterDraftConfirm}
          readOnly={readOnly}
        />
      </>
    );
  }

  return (
    <>
      {readOnly && readOnlyReason && (
        <div className="ai-architecture-generation-dialog__readonly-banner">
          当前为只读预览：{readOnlyReason}
        </div>
      )}
      <GuidedWorkspaceStep
        onContinueDraft={readOnly ? () => {} : onEnterDraftConfirm}
        activeIssueFilterKey={issueFilter}
        onActiveIssueFilterKeyChange={onIssueFilterChange}
        readOnly={readOnly}
      />
    </>
  );
};
