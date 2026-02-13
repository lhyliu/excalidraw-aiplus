import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useAtom, useAtomValue } from "../editor-jotai";
import { t } from "../i18n";
import { initCompatibilityLayer } from "./AIArchitectureGeneration";
import {
  buildInitialFieldMapping,
  calibrationStateAtom,
  confidenceStateAtom,
  fieldMappingAtom,
  importedCsvAtom,
  inferFieldCandidates,
  issuesAtom,
  normalizedVmRowsAtom,
  validateFieldMapping,
} from "./AIArchitectureGeneration";
import { Dialog } from "./Dialog";

import { CalibrateStep } from "./AIArchitectureGenerationDialog/CalibrateStep";
import { DraftStep } from "./AIArchitectureGenerationDialog/DraftStep";
import { ExpertEditOverlay } from "./AIArchitectureGenerationDialog/ExpertEditOverlay";
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
  const calibrationState = useAtomValue(calibrationStateAtom);
  const importedCsv = useAtomValue(importedCsvAtom);
  const fieldMapping = useAtomValue(fieldMappingAtom);
  const issues = useAtomValue(issuesAtom);
  const normalizedRows = useAtomValue(normalizedVmRowsAtom);
  const step = session.step;
  const mode = session.mode;
  const confidenceState = useAtomValue(confidenceStateAtom);
  const [isExpertOpen, setIsExpertOpen] = useState(false);
  const [expertNotice, setExpertNotice] = useState<string | null>(null);
  const [stepNotice, setStepNotice] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);
  const stepMeta: Record<GenerationStep, { label: string; hint: string }> = {
    workspace: {
      label: t("labels.aiGenerationStepWorkspace"),
      hint: t("labels.aiGenerationStepWorkspaceHint"),
    },
    import: {
      label: t("labels.aiGenerationStepWorkspace"),
      hint: t("labels.aiGenerationStepWorkspaceHint"),
    },
    mapping: {
      label: t("labels.aiGenerationStepWorkspace"),
      hint: t("labels.aiGenerationStepWorkspaceHint"),
    },
    issues: {
      label: t("labels.aiGenerationStepWorkspace"),
      hint: t("labels.aiGenerationStepWorkspaceHint"),
    },
    draft: {
      label: t("labels.aiGenerationStepDraft"),
      hint: t("labels.aiGenerationStepDraftHint"),
    },
    calibrate: {
      label: t("labels.aiGenerationStepCalibrate"),
      hint: t("labels.aiGenerationStepCalibrateHint"),
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

  useEffect(() => {
    if (step === "import" || step === "mapping" || step === "issues") {
      setSession((prev) => ({
        ...prev,
        step: "workspace",
      }));
    }
  }, [setSession, step]);

  const goDraft = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      step: "draft",
    }));
  }, [setSession]);

  const goCalibrate = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      step: "calibrate",
    }));
  }, [setSession]);

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
    if (step === "draft" || step === "calibrate") {
      return "draft";
    }
    return "calibrating";
  }, [confidenceState, step]);

  const mappingWarningCount = useMemo(() => {
    if (importedCsv.headers.length === 0) {
      return 0;
    }
    const inferred = inferFieldCandidates(importedCsv.headers);
    const suggested = buildInitialFieldMapping(inferred);
    const effectiveMapping = {
      ...suggested,
      ...fieldMapping,
    };
    const mappedHeaders = new Set(
      Object.values(effectiveMapping).filter(Boolean) as string[],
    );
    return importedCsv.headers.filter((header) => !mappedHeaders.has(header)).length;
  }, [fieldMapping, importedCsv.headers]);

  const pendingIssueCount = issues.length;
  const canPreviewDraft = importedCsv.rows.length > 0;
  const hasSourceData = importedCsv.rows.length > 0;
  const hasCalibratableAssets = normalizedRows.length > 0;
  const hasRequiredMapping = useMemo(() => {
    const inferred = inferFieldCandidates(importedCsv.headers);
    const suggested = buildInitialFieldMapping(inferred);
    const effectiveMapping = {
      ...suggested,
      ...fieldMapping,
    };
    return validateFieldMapping(effectiveMapping).ok;
  }, [fieldMapping, importedCsv.headers]);

  const stepBlockReasons = useMemo(() => {
    const reasons: Partial<Record<GenerationStep, string>> = {};
    if (!hasSourceData) {
      reasons.draft = t("labels.aiGenerationRequireCsv");
      reasons.calibrate = t("labels.aiGenerationRequireCsv");
      return reasons;
    }
    if (!hasRequiredMapping) {
      reasons.draft = t("labels.aiGenerationRequireMapping");
      reasons.calibrate = t("labels.aiGenerationRequireMapping");
      return reasons;
    }
    if (!hasCalibratableAssets) {
      reasons.calibrate = t("labels.aiGenerationNoCalibratableAssets");
    }
    return reasons;
  }, [hasCalibratableAssets, hasRequiredMapping, hasSourceData]);

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
              hint: stepMeta[step].hint,
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

        {(step === "import" ||
          step === "workspace" ||
          step === "mapping" ||
          step === "issues" ||
          step === "draft" ||
          step === "calibrate") && (
            <WorkflowShell
              step={step}
              archDocStatus={archDocStatus}
              calibrationProgress={{
                done: calibrationState.tasks.filter((task) => task.done).length,
                total: calibrationState.tasks.length,
              }}
              mappingWarningCount={mappingWarningCount}
              pendingIssueCount={pendingIssueCount}
              canPreviewDraft={canPreviewDraft}
              stepBlockReasons={stepBlockReasons}
              onStepChange={requestStepChange}
              showAiSummary={step === "calibrate"}
            >
              {(step === "workspace" || step === "import" || step === "mapping" || step === "issues") &&
                !hasSourceData && (
                  <ImportStep onContinue={() => requestStepChange("workspace")} onGenerateDraft={goDraft} />
                )}
              {(step === "workspace" || step === "import" || step === "mapping" || step === "issues") &&
                hasSourceData && (
                  <GuidedWorkspaceStep
                    onContinueDraft={goDraft}
                    onOpenExpert={() => {
                      setExpertNotice(null);
                      setIsExpertOpen(true);
                    }}
                  />
                )}
              {step === "draft" && (
                <DraftStep
                  onContinueCalibrate={goCalibrate}
                  onInsertToCanvas={onClose}
                  filter={session.draftFilter}
                  onFilterChange={setDraftFilter}
                  suggestions={session.namingSuggestions}
                  onSuggestionsChange={setNamingSuggestions}
                />
              )}
              {step === "calibrate" && <CalibrateStep onInsertToCanvas={onClose} />}
              {(step === "workspace" || step === "import" || step === "mapping" || step === "issues") &&
                isExpertOpen && (
                    <ExpertEditOverlay
                      onSave={() => {
                        setIsExpertOpen(false);
                        setExpertNotice(
                          t("labels.aiArchitectureGenerationExpertSaved"),
                        );
                      }}
                      onCancel={() => setIsExpertOpen(false)}
                    />
                )}
              {(step === "workspace" || step === "import" || step === "mapping" || step === "issues") &&
                expertNotice && (
                  <div className="ai-architecture-generation-dialog__success">
                    {expertNotice}
                  </div>
                )}
            </WorkflowShell>
          )}
      </div>
    </Dialog>
  );
};
