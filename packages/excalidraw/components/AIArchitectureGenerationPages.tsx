import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useAtom, useAtomValue } from "../editor-jotai";
import {
  buildInitialFieldMapping,
  confidenceStateAtom,
  type DraftViewMode,
  editsAtom,
  fieldMappingAtom,
  importedCsvAtom,
  inferFieldCandidates,
  issuesAtom,
} from "./AIArchitectureGeneration";
import { aiArchitectureGenerationSessionAtom } from "./AIArchitectureGenerationDialog/sessionState";
import type { GenerationStep } from "./AIArchitectureGenerationDialog/types";
import {
  cancelAiTask,
  listTaskStatuses,
  subscribeAllTaskStatuses,
  type AITaskStatusSnapshot,
} from "../services/aiTaskService";
import { t } from "../i18n";
import { Dialog } from "./Dialog";
import { CsvFixPage } from "./pages/ai/CsvFixPage";
import { DraftConfirmPage } from "./pages/ai/DraftConfirmPage";
import { GenerationWorkflowHeader } from "./pages/ai/GenerationWorkflowHeader";

import "./AIArchitectureGenerationDialog.scss";

type AiGenerationRoute = "/ai/csv-fix" | "/ai/draft-confirm";
type StepAccessMode = "editable" | "viewOnly";

interface AIArchitectureGenerationPagesProps {
  onClose: () => void;
  assistantTabs?: React.ReactNode;
}

const getTaskStatusLabel = (status: AITaskStatusSnapshot["status"]) => {
  switch (status) {
    case "queued":
      return t("labels.aiTaskStatusQueued");
    case "running":
      return t("labels.aiTaskStatusRunning");
    case "success":
      return t("labels.aiTaskStatusSuccess");
    case "error":
      return t("labels.aiTaskStatusError");
    case "canceled":
      return t("labels.aiTaskStatusCanceled");
    case "stalled":
      return t("labels.aiTaskStatusStalled");
    default:
      return t("labels.aiTaskStatusError");
  }
};

const getTaskTypeLabel = (type?: string) => {
  switch (type) {
    case "service_name_fill":
      return t("labels.aiTaskTypeServiceNameFill");
    case "business_scope":
      return t("labels.aiTaskTypeBusinessScope");
    case "business_layering":
      return t("labels.aiTaskTypeBusinessLayering");
    case "diagram_generate":
      return t("labels.aiTaskTypeDiagramGenerate");
    default:
      return t("labels.aiTaskTypeUnknown");
  }
};

const canStepRunInCsvFix = (step: GenerationStep) =>
  step === "ingest" || step === "fieldConfirm" || step === "issueResolve";

const isGenerationStep = (step: unknown): step is GenerationStep =>
  step === "ingest" ||
  step === "fieldConfirm" ||
  step === "issueResolve" ||
  step === "draftConfirm";

export const AIArchitectureGenerationPages: React.FC<
  AIArchitectureGenerationPagesProps
> = ({ onClose, assistantTabs }) => {
  const [session, setSession] = useAtom(aiArchitectureGenerationSessionAtom);
  const importedCsv = useAtomValue(importedCsvAtom);
  const fieldMapping = useAtomValue(fieldMappingAtom);
  const issues = useAtomValue(issuesAtom);
  const edits = useAtomValue(editsAtom);
  useAtomValue(confidenceStateAtom);
  const [recentTasks, setRecentTasks] = useState<AITaskStatusSnapshot[]>([]);

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

  const unresolvedIssueCount = useMemo(
    () =>
      issues.filter((issue) => {
        if (!issue.field) {
          return true;
        }
        return (edits[issue.rowId]?.[issue.field] ?? "").toString().trim().length === 0;
      }).length,
    [edits, issues],
  );
  const resolvedIssueCount = Math.max(0, issues.length - unresolvedIssueCount);

  const activeViewStep: GenerationStep = useMemo(() => {
    if (isGenerationStep(session.viewStep)) {
      return session.viewStep;
    }
    return session.step;
  }, [session.step, session.viewStep]);

  const route: AiGenerationRoute =
    activeViewStep === "draftConfirm" ? "/ai/draft-confirm" : "/ai/csv-fix";

  const getStepAccess = useCallback(
    (step: GenerationStep): { mode: StepAccessMode; reason?: string } => {
      if (step === "ingest") {
        return { mode: "editable" };
      }
      if (step === "fieldConfirm") {
        if (!hasSourceData) {
          return {
            mode: "viewOnly",
            reason: t("labels.aiGenerationReadOnlyReasonRequireCsv"),
          };
        }
        return { mode: "editable" };
      }
      if (step === "issueResolve") {
        if (!hasSourceData) {
          return {
            mode: "viewOnly",
            reason: t("labels.aiGenerationReadOnlyReasonRequireCsv"),
          };
        }
        if (!hasRequiredMapping) {
          return {
            mode: "viewOnly",
            reason: t("labels.aiGenerationReadOnlyReasonRequireMapping"),
          };
        }
        return { mode: "editable" };
      }
      if (!hasSourceData) {
        return {
          mode: "viewOnly",
          reason: t("labels.aiGenerationReadOnlyReasonRequireCsv"),
        };
      }
      if (!hasRequiredMapping) {
        return {
          mode: "viewOnly",
          reason: t("labels.aiGenerationReadOnlyReasonRequireMapping"),
        };
      }
      if (unresolvedErrorCount > 0) {
        return {
          mode: "viewOnly",
          reason: t("labels.aiGenerationReadOnlyReasonRequireIssueResolve"),
        };
      }
      return { mode: "editable" };
    },
    [hasRequiredMapping, hasSourceData, unresolvedErrorCount],
  );

  const stepAccess = useMemo(
    () => ({
      ingest: getStepAccess("ingest"),
      fieldConfirm: getStepAccess("fieldConfirm"),
      issueResolve: getStepAccess("issueResolve"),
      draftConfirm: getStepAccess("draftConfirm"),
    }),
    [getStepAccess],
  );

  const activeStepAccess = stepAccess[activeViewStep];

  const requestRoute = useCallback(
    (nextRoute: AiGenerationRoute) => {
      if (nextRoute === "/ai/draft-confirm") {
        const draftAccess = getStepAccess("draftConfirm");
        setSession((prev) => ({
          ...prev,
          viewStep: "draftConfirm",
          step:
            draftAccess.mode === "editable"
              ? "draftConfirm"
              : prev.step,
        }));
        return;
      }
      setSession((prev) => ({
        ...prev,
        viewStep: canStepRunInCsvFix(prev.step) ? prev.step : "issueResolve",
      }));
    },
    [getStepAccess, setSession],
  );

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

  const setDraftActiveScopeId = useCallback(
    (draftActiveScopeId: string | null) => {
      setSession((prev) => ({
        ...prev,
        draftActiveScopeId: draftActiveScopeId ?? undefined,
      }));
    },
    [setSession],
  );

  const setDraftSelectedScopeIds = useCallback(
    (draftSelectedScopeIds: string[]) => {
      setSession((prev) => ({
        ...prev,
        draftSelectedScopeIds,
      }));
    },
    [setSession],
  );

  const setDraftViewMode = useCallback(
    (draftViewMode: DraftViewMode) => {
      setSession((prev) => ({
        ...prev,
        draftViewMode,
      }));
    },
    [setSession],
  );

  const setDraftLayerEditsByScope = useCallback(
    (
      draftLayerEditsByScope: Record<
        string,
        { name: string; description: string; rowIds: number[]; reason: string }[]
      >,
    ) => {
      setSession((prev) => ({
        ...prev,
        draftLayerEditsByScope,
      }));
    },
    [setSession],
  );

  const setDraftDiagramByScope = useCallback(
    (draftDiagramByScope: Record<string, string>) => {
      setSession((prev) => ({
        ...prev,
        draftDiagramByScope,
      }));
    },
    [setSession],
  );

  const setDraftDiagramStatusByScope = useCallback(
    (draftDiagramStatusByScope: Record<string, "idle" | "generating" | "ready" | "error">) => {
      setSession((prev) => ({
        ...prev,
        draftDiagramStatusByScope,
      }));
    },
    [setSession],
  );

  const setDraftPanoramaDiagram = useCallback(
    (draftPanoramaDiagram: string) => {
      setSession((prev) => ({
        ...prev,
        draftPanoramaDiagram,
      }));
    },
    [setSession],
  );

  const setDraftPanoramaDiagramStatus = useCallback(
    (draftPanoramaDiagramStatus: "idle" | "generating" | "ready" | "error") => {
      setSession((prev) => ({
        ...prev,
        draftPanoramaDiagramStatus,
      }));
    },
    [setSession],
  );

  const setIssueFilter = useCallback(
    (issueFilter: string | null) => {
      setSession((prev) => ({
        ...prev,
        issueFilter,
      }));
    },
    [setSession],
  );

  useEffect(() => {
    setSession((prev) => {
      const nextSnapshot = {
        stepCompletion:
          prev.step === "draftConfirm"
            ? 100
            : prev.step === "issueResolve"
              ? 75
              : prev.step === "fieldConfirm"
                ? 50
                : 25,
        blockingErrorCount: unresolvedErrorCount,
        unresolvedIssueCount,
        totalIssueCount: issues.length,
        resolvedIssueCount,
        updatedAt: Date.now(),
      };

      const current = prev.progressSnapshot;
      if (
        current &&
        current.stepCompletion === nextSnapshot.stepCompletion &&
        current.blockingErrorCount === nextSnapshot.blockingErrorCount &&
        current.unresolvedIssueCount === nextSnapshot.unresolvedIssueCount &&
        current.totalIssueCount === nextSnapshot.totalIssueCount &&
        current.resolvedIssueCount === nextSnapshot.resolvedIssueCount
      ) {
        return prev;
      }

      return {
        ...prev,
        progressSnapshot: nextSnapshot,
      };
    });
  }, [
    issues.length,
    resolvedIssueCount,
    setSession,
    unresolvedErrorCount,
    unresolvedIssueCount,
  ]);

  useEffect(() => {
    const update = () => {
      setRecentTasks(listTaskStatuses().slice(0, 5));
    };
    update();
    const unsubscribe = subscribeAllTaskStatuses(() => {
      update();
    });
    return unsubscribe;
  }, []);

  const activeTasks = useMemo(
    () =>
      recentTasks.filter(
        (task) =>
          task.status === "running" ||
          task.status === "queued" ||
          task.status === "stalled",
      ),
    [recentTasks],
  );

  return (
    <Dialog
      className="ai-architecture-generation-dialog"
      onCloseRequest={onClose}
      title={
        <div className="architecture-assistant__dialog-title">
          <span>CSV 到架构草图</span>
          {assistantTabs}
        </div>
      }
      size={1500}
    >
      <div className="ai-architecture-generation-dialog__container">
        {activeTasks.length > 0 && (
          <section className="ai-architecture-generation-dialog__task-banner">
            <div className="ai-architecture-generation-dialog__task-banner-head">
              <strong>{t("labels.aiTaskCenterTitle")}</strong>
            </div>
            <div className="ai-architecture-generation-dialog__task-banner-list">
              {activeTasks.map((task) => (
                <div
                  key={task.taskId}
                  className={`ai-architecture-generation-dialog__task-chip is-${task.status}`}
                >
                  <span className="ai-architecture-generation-dialog__task-type">
                    {getTaskTypeLabel(task.type)}
                  </span>
                  <span className="ai-architecture-generation-dialog__task-status">
                    {getTaskStatusLabel(task.status)}
                  </span>
                  {typeof task.current === "number" && typeof task.total === "number" && task.total > 0 && (
                    <span className="ai-architecture-generation-dialog__task-status">
                      {Math.min(100, Math.max(0, Math.round((task.current / task.total) * 100)))}%
                    </span>
                  )}
                  {task.message ? (
                    <span className="ai-architecture-generation-dialog__task-message">
                      {task.message}
                    </span>
                  ) : null}
                  {task.status === "running" && (
                    <button
                      type="button"
                      className="ai-architecture-generation-dialog__btn-ghost"
                      onClick={() => {
                        void cancelAiTask(task.taskId);
                      }}
                    >
                      {t("labels.aiTaskActionCancel")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <GenerationWorkflowHeader
          activeStep={activeViewStep}
          progressStep={session.step}
          blockingErrorCount={unresolvedErrorCount}
          totalIssueCount={issues.length}
          resolvedIssueCount={resolvedIssueCount}
          stepAccess={stepAccess}
          onStepSelect={(targetStep) =>
            setSession((prev) => ({
              ...prev,
              viewStep: targetStep,
            }))
          }
        />

        {activeStepAccess.mode === "viewOnly" && activeStepAccess.reason && (
          <div className="ai-architecture-generation-dialog__readonly-banner">
            {t("labels.aiGenerationReadOnlyMode")}：{activeStepAccess.reason}
          </div>
        )}

        {route === "/ai/csv-fix" && (
          <CsvFixPage
            step={
              activeViewStep === "draftConfirm"
                ? "issueResolve"
                : activeViewStep
            }
            issueFilter={session.issueFilter ?? null}
            readOnly={activeStepAccess.mode === "viewOnly"}
            readOnlyReason={activeStepAccess.reason}
            onContinueFieldConfirm={() =>
              setSession((prev) => ({
                ...prev,
                step: "fieldConfirm",
                viewStep: "fieldConfirm",
              }))
            }
            onContinueIssueResolve={() =>
              setSession((prev) => ({
                ...prev,
                step: "issueResolve",
                viewStep: "issueResolve",
              }))
            }
            onEnterDraftConfirm={() => requestRoute("/ai/draft-confirm")}
            onIssueFilterChange={setIssueFilter}
          />
        )}

        {route === "/ai/draft-confirm" && (
          <DraftConfirmPage
            onContinueCalibrate={() => requestRoute("/ai/csv-fix")}
            onInsertToCanvas={onClose}
            readOnly={activeStepAccess.mode === "viewOnly"}
            readOnlyReason={activeStepAccess.reason}
            filter={session.draftFilter}
            onFilterChange={setDraftFilter}
            suggestions={session.namingSuggestions}
            onSuggestionsChange={setNamingSuggestions}
            activeScopeId={session.draftActiveScopeId ?? null}
            onActiveScopeIdChange={setDraftActiveScopeId}
            selectedScopeIds={session.draftSelectedScopeIds ?? []}
            onSelectedScopeIdsChange={setDraftSelectedScopeIds}
            viewMode={session.draftViewMode ?? "panorama"}
            onViewModeChange={setDraftViewMode}
            layerEditsByScope={session.draftLayerEditsByScope ?? {}}
            onLayerEditsByScopeChange={setDraftLayerEditsByScope}
            diagramByScope={session.draftDiagramByScope ?? {}}
            onDiagramByScopeChange={setDraftDiagramByScope}
            diagramStatusByScope={session.draftDiagramStatusByScope ?? {}}
            onDiagramStatusByScopeChange={setDraftDiagramStatusByScope}
            panoramaDiagram={session.draftPanoramaDiagram ?? ""}
            onPanoramaDiagramChange={setDraftPanoramaDiagram}
            panoramaDiagramStatus={session.draftPanoramaDiagramStatus ?? "idle"}
            onPanoramaDiagramStatusChange={setDraftPanoramaDiagramStatus}
          />
        )}
      </div>
    </Dialog>
  );
};
