import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useAtom, useAtomValue } from "../editor-jotai";
import { t } from "../i18n";
import { initCompatibilityLayer } from "./AIArchitectureGeneration";
import {
  buildInitialFieldMapping,
  confidenceStateAtom,
  editsAtom,
  fieldMappingAtom,
  importedCsvAtom,
  inferFieldCandidates,
  issuesAtom,
} from "./AIArchitectureGeneration";
import { Dialog } from "./Dialog";

import { DraftStep } from "./AIArchitectureGenerationDialog/DraftStep";
import { ExpertEditOverlay } from "./AIArchitectureGenerationDialog/ExpertEditOverlay";
import { FieldMappingStep } from "./AIArchitectureGenerationDialog/FieldMappingStep";
import { GuidedWorkspaceStep } from "./AIArchitectureGenerationDialog/GuidedWorkspaceStep";
import { ImportStep } from "./AIArchitectureGenerationDialog/ImportStep";
import { WorkflowShell } from "./AIArchitectureGenerationDialog/layout/WorkflowShell";
import type { GenerationStep } from "./AIArchitectureGenerationDialog/types";
import { aiArchitectureGenerationSessionAtom } from "./AIArchitectureGenerationDialog/sessionState";

import "./AIArchitectureGenerationDialog.scss";

interface AIArchitectureGenerationDialogProps {
  onClose: () => void;
}

export const AIArchitectureGenerationDialog: React.FC<
  AIArchitectureGenerationDialogProps
> = ({ onClose }) => {
  const [session, setSession] = useAtom(aiArchitectureGenerationSessionAtom);
  const importedCsv = useAtomValue(importedCsvAtom);
  const fieldMapping = useAtomValue(fieldMappingAtom);
  const issues = useAtomValue(issuesAtom);
  const edits = useAtomValue(editsAtom);
  const confidenceState = useAtomValue(confidenceStateAtom);
  const step = session.step;
  const mode = session.mode;
  const [isExpertOpen, setIsExpertOpen] = useState(false);
  const [expertNotice, setExpertNotice] = useState<string | null>(null);
  const [stepNotice, setStepNotice] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);

  const stepMeta: Record<GenerationStep, { label: string; hint: string }> = {
    ingest: {
      label: t("labels.aiGenerationStepIngest"),
      hint: t("labels.aiGenerationStepIngestHint"),
    },
    fieldConfirm: {
      label: t("labels.aiGenerationStepFieldConfirm"),
      hint: t("labels.aiGenerationStepFieldConfirmHint"),
    },
    issueResolve: {
      label: t("labels.aiGenerationStepIssueResolve"),
      hint: t("labels.aiGenerationStepIssueResolveHint"),
    },
    draftConfirm: {
      label: t("labels.aiGenerationStepDraftConfirm"),
      hint: t("labels.aiGenerationStepDraftConfirmHint"),
    },
  };

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        initCompatibilityLayer();
      } finally {
        if (mounted) {
          setIsBootstrapping(false);
        }
      }
    };
    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const hasSourceData = importedCsv.rows.length > 0;
  const hasRequiredMapping = useMemo(() => {
    const inferred = inferFieldCandidates(importedCsv.headers);
    const suggested = buildInitialFieldMapping(inferred);
    const effectiveMapping = {
      ...suggested,
      ...fieldMapping,
    };
    return (
      Boolean(effectiveMapping.hostname) &&
      Boolean(effectiveMapping.privateIp) &&
      Boolean(effectiveMapping.serviceName)
    );
  }, [fieldMapping, importedCsv.headers]);
  const unresolvedErrorCount = useMemo(
    () =>
      issues.filter((issue) => {
        if (issue.severity !== "error") {
          return false;
        }
        if (!issue.field) {
          return true;
        }
        return (edits[issue.rowId]?.[issue.field] ?? "").toString().trim().length === 0;
      }).length,
    [edits, issues],
  );
  const canPreviewDraft = hasSourceData && hasRequiredMapping;

  useEffect(() => {
    if (!hasSourceData && step !== "ingest") {
      setSession((prev) => ({ ...prev, step: "ingest" }));
      return;
    }
    if (hasSourceData && !hasRequiredMapping && step === "issueResolve") {
      setSession((prev) => ({ ...prev, step: "fieldConfirm" }));
    }
  }, [hasRequiredMapping, hasSourceData, setSession, step]);

  const setDraftFilter = useCallback(
    (draftFilter: string) => {
      setSession((prev) => ({
        ...prev,
        draftFilter,
      }));
    },
    [setSession],
  );

  const setNamingSuggestions = useCallback(
    (namingSuggestions: Record<string, string[]>) => {
      setSession((prev) => ({
        ...prev,
        namingSuggestions,
      }));
    },
    [setSession],
  );

  const goToStep = useCallback(
    (nextStep: GenerationStep) => {
      setIsExpertOpen(false);
      setExpertNotice(null);
      setStepNotice(null);
      setSession((prev) => ({
        ...prev,
        step: nextStep,
      }));
    },
    [setSession],
  );

  const archDocStatus: "draft" | "calibrating" | "confirmed" = useMemo(() => {
    if (confidenceState === "confirmed") {
      return "confirmed";
    }
    if (step === "draftConfirm") {
      return "draft";
    }
    return "calibrating";
  }, [confidenceState, step]);

  const stepBlockReasons = useMemo(() => {
    const reasons: Partial<Record<GenerationStep, string>> = {};
    if (!hasSourceData) {
      reasons.fieldConfirm = t("labels.aiGenerationRequireCsv");
      reasons.issueResolve = t("labels.aiGenerationRequireCsv");
      reasons.draftConfirm = t("labels.aiGenerationRequireCsv");
      return reasons;
    }
    if (!hasRequiredMapping) {
      reasons.issueResolve = t("labels.aiGenerationRequireMapping");
      reasons.draftConfirm = t("labels.aiGenerationRequireMapping");
      return reasons;
    }
    if (unresolvedErrorCount > 0) {
      reasons.draftConfirm = t("labels.aiGenerationRequireIssueResolve");
    }
    return reasons;
  }, [hasRequiredMapping, hasSourceData, unresolvedErrorCount]);

  const requestStepChange = useCallback(
    (nextStep: GenerationStep) => {
      const blockedReason = stepBlockReasons[nextStep];
      if (blockedReason) {
        setStepNotice(blockedReason);
        return;
      }
      setIsStepTransitioning(true);
      goToStep(nextStep);
      requestAnimationFrame(() => setIsStepTransitioning(false));
    },
    [goToStep, stepBlockReasons],
  );

  return (
    <Dialog
      className="ai-architecture-generation-dialog"
      onCloseRequest={onClose}
      title={t("labels.aiArchitectureGeneration")}
      size={1280}
    >
      <div className="ai-architecture-generation-dialog__container">
        <header className="ai-architecture-generation-dialog__header">
          <div className="ai-architecture-generation-dialog__status">
            {t("labels.aiArchitectureGenerationStatus", {
              mode:
                mode === "advanced"
                  ? t("labels.aiArchitectureGenerationModeAdvanced")
                  : t("labels.aiArchitectureGenerationModeGuided"),
              confidence: confidenceState,
              hint: stepMeta[step]?.hint ?? "",
            })}
          </div>
        </header>
        {stepNotice && (
          <div className="ai-architecture-generation-dialog__error">{stepNotice}</div>
        )}
        {(isBootstrapping || isStepTransitioning) && (
          <div className="ai-architecture-generation-dialog__loading">
            {isBootstrapping
              ? t("labels.aiArchitectureGenerationBootstrapping")
              : t("labels.aiArchitectureGenerationStepTransitioning")}
          </div>
        )}

        <WorkflowShell
          step={step}
          archDocStatus={archDocStatus}
          calibrationProgress={{
            done: Math.max(0, issues.length - unresolvedErrorCount),
            total: issues.length,
          }}
          mappingWarningCount={Math.max(0, 3 - Object.keys(fieldMapping).length)}
          pendingIssueCount={issues.length}
          canPreviewDraft={canPreviewDraft}
          stepBlockReasons={stepBlockReasons}
          onStepChange={requestStepChange}
          showAiSummary={step !== "draftConfirm"}
        >
          {step === "ingest" && (
            <ImportStep
              onContinue={() => requestStepChange("fieldConfirm")}
              onGenerateDraft={() => requestStepChange("draftConfirm")}
            />
          )}
          {step === "fieldConfirm" && (
            <FieldMappingStep
              onContinue={() => requestStepChange("issueResolve")}
              onGenerateDraft={() => requestStepChange("draftConfirm")}
            />
          )}
          {step === "issueResolve" && (
            <GuidedWorkspaceStep
              onContinueDraft={() => requestStepChange("draftConfirm")}
              onOpenExpert={() => {
                setExpertNotice(null);
                setIsExpertOpen(true);
              }}
            />
          )}
          {step === "draftConfirm" && (
            <DraftStep
              onContinueCalibrate={() => requestStepChange("issueResolve")}
              onInsertToCanvas={onClose}
              filter={session.draftFilter}
              onFilterChange={setDraftFilter}
              suggestions={session.namingSuggestions}
              onSuggestionsChange={setNamingSuggestions}
            />
          )}
          {step === "issueResolve" && isExpertOpen && (
            <ExpertEditOverlay
              onSave={() => {
                setIsExpertOpen(false);
                setExpertNotice(t("labels.aiArchitectureGenerationExpertSaved"));
              }}
              onCancel={() => setIsExpertOpen(false)}
            />
          )}
          {step === "issueResolve" && expertNotice && (
            <div className="ai-architecture-generation-dialog__success">
              {expertNotice}
            </div>
          )}
        </WorkflowShell>
      </div>
    </Dialog>
  );
};

