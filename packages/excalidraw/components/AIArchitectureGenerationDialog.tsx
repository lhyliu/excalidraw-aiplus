import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useAtom, useAtomValue } from "../editor-jotai";
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

const stepOrder: GenerationStep[] = [
  "import",
  "mapping",
  "issues",
  "draft",
  "calibrate",
];

const stepMeta: Record<GenerationStep, { label: string; hint: string }> = {
  import: { label: "导入表格", hint: "导入 CSV 并快速预览" },
  mapping: { label: "读懂表格", hint: "左侧实时表格 + 右侧引导修正" },
  issues: { label: "待确认项", hint: "继续按任务卡批量修正" },
  draft: { label: "初步架构图", hint: "先看到可用草稿，再决定是否精修" },
  calibrate: { label: "可信现状", hint: "完成质量门后标记为 confirmed" },
};

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

  useEffect(() => {
    initCompatibilityLayer();
  }, []);

  useEffect(() => {
    if (step === "advanced") {
      setSession((prev) => ({
        ...prev,
        step: "issues",
      }));
    }
  }, [setSession, step]);

  const currentIndex = useMemo(() => stepOrder.indexOf(step), [step]);

  const goNext = useCallback(() => {
    const nextStep = stepOrder[Math.min(currentIndex + 1, stepOrder.length - 1)];
    setSession((prev) => ({
      ...prev,
      step: nextStep,
    }));
  }, [currentIndex, setSession]);

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
        step: nextStep === "advanced" ? "issues" : nextStep,
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
      reasons.mapping = "请先导入并解析 CSV";
      reasons.issues = "请先导入并解析 CSV";
      reasons.draft = "请先导入并解析 CSV";
      reasons.calibrate = "请先导入并解析 CSV";
      return reasons;
    }
    if (!hasRequiredMapping) {
      reasons.issues = "请先确认关键列：hostname、privateIp、serviceName";
      reasons.calibrate = "请先确认关键列：hostname、privateIp、serviceName";
      return reasons;
    }
    if (!hasCalibratableAssets) {
      reasons.calibrate = "当前没有可校准资产，请先修正字段映射";
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
      goToStep(nextStep);
    },
    [goToStep, stepBlockReasons],
  );

  return (
    <Dialog
      className="ai-architecture-generation-dialog"
      onCloseRequest={onClose}
      title="AI架构生成"
      size={1280}
    >
      <div className="ai-architecture-generation-dialog__container">
        <header className="ai-architecture-generation-dialog__header">
          <div className="ai-architecture-generation-dialog__status">
            模式: {mode === "advanced" ? "专家" : "向导"} | 把握度状态:{" "}
            {confidenceState} | 目标: 3 分钟生成初步架构图 | {stepMeta[step].hint}
          </div>
        </header>
        {stepNotice && (
          <div className="ai-architecture-generation-dialog__error">{stepNotice}</div>
        )}

        {(step === "import" ||
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
            showAiSummary={step !== "mapping" && step !== "issues"}
          >
            {step === "import" && (
              <ImportStep onContinue={goNext} onGenerateDraft={goDraft} />
            )}
            {step === "mapping" && (
              <GuidedWorkspaceStep
                onContinueDraft={goDraft}
                onOpenExpert={() => {
                  setExpertNotice(null);
                  setIsExpertOpen(true);
                }}
              />
            )}
            {step === "issues" && (
              <GuidedWorkspaceStep
                onOpenExpert={() => {
                  setExpertNotice(null);
                  setIsExpertOpen(true);
                }}
                onContinueDraft={goDraft}
              />
            )}
            {step === "draft" && (
              <DraftStep
                onContinueCalibrate={goCalibrate}
                filter={session.draftFilter}
                onFilterChange={setDraftFilter}
                suggestions={session.namingSuggestions}
                onSuggestionsChange={setNamingSuggestions}
              />
            )}
            {step === "calibrate" && <CalibrateStep />}
            {step === "issues" && isExpertOpen && (
              <ExpertEditOverlay
                onSave={() => {
                  setIsExpertOpen(false);
                  setExpertNotice("专家模式编辑已保存，AI 校准视图已更新。");
                }}
                onCancel={() => setIsExpertOpen(false)}
              />
            )}
            {step === "issues" && expertNotice && (
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

