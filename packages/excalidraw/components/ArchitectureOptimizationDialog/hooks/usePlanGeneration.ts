import { useCallback } from "react";

import { extractDiagramInfo, generateOptimizationPlan } from "../../../services/aiService";
import {
  buildPlanExecutionOptions,
  buildGenerationSnapshot,
  buildPlanHistoryMessages,
} from "../planGenerationContext";
import { validateGenerationResult } from "../validation";
import { categoryLabels } from "../model";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { Message, MessagesAction } from "../messageState";
import type { ArchitectureStyle, PoolSuggestion, Scheme } from "../model";

export type RunAIStream = <T>(
  task: (signal: AbortSignal) => Promise<T>,
) => Promise<
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    }
>;

interface UsePlanGenerationOptions {
  isStreaming: boolean;
  elements: readonly ExcalidrawElement[];
  messages: Message[];
  activeSchemeId: string | null;
  schemes: Scheme[];
  selectedSuggestions: PoolSuggestion[];
  architectureStyle: ArchitectureStyle;
  activeCombinationId: string | null;
  skipUpdateConfirm: boolean;
  runStream: RunAIStream;
  dispatchMessages: (action: MessagesAction) => void;
  setSchemes: Dispatch<SetStateAction<Scheme[]>>;
  setActiveSchemeId: Dispatch<SetStateAction<string | null>>;
  setIsPreviewPage: Dispatch<SetStateAction<boolean>>;
  setSuggestionToast: Dispatch<SetStateAction<string | null>>;
  setSkipUpdateConfirm: Dispatch<SetStateAction<boolean>>;
  suggestionToastTimerRef: MutableRefObject<number | null>;
}

export const usePlanGeneration = ({
  isStreaming,
  elements,
  messages,
  activeSchemeId,
  schemes,
  selectedSuggestions,
  architectureStyle,
  activeCombinationId,
  skipUpdateConfirm,
  runStream,
  dispatchMessages,
  setSchemes,
  setActiveSchemeId,
  setIsPreviewPage,
  setSuggestionToast,
  setSkipUpdateConfirm,
  suggestionToastTimerRef,
}: UsePlanGenerationOptions) => {
  const runPlanGeneration = useCallback(
    async (
      extraContext?: string,
      options?: {
        targetSchemeId?: string | null;
        forceCreate?: boolean;
        includeHistory?: boolean;
        sourceCombinationId?: string | null;
        sourceSuggestionIds?: string[];
        sourceSuggestionSnapshot?: Array<{
          id: string;
          category: PoolSuggestion["category"];
          title: string;
          content: string;
          fullContent: string;
          note?: string;
        }>;
        generationSnapshot?: Scheme["generationSnapshot"];
      },
    ): Promise<{ schemeId: string; wasUpdated: boolean } | null> => {
      if (isStreaming || (messages.length === 0 && !extraContext?.trim())) {
        return null;
      }

      const diagramInfo = extractDiagramInfo(elements);
      const assistantMsgId = `msg-${Date.now()}`;
      dispatchMessages({
        type: "add",
        messages: [
          {
            id: assistantMsgId,
            role: "assistant",
            content: "正在生成优化方案和新架构图...",
            isGenerating: true,
          },
        ],
      });

      try {
        const historyMessages = buildPlanHistoryMessages(
          messages,
          extraContext,
          options?.includeHistory !== false,
        );

        let reasoningBuffer = "";
        let summaryBuffer = "";
        const runGenerationRequest = async (correctionInstruction?: string) => {
          const requestMessages = [...historyMessages];
          if (correctionInstruction) {
            requestMessages.push({
              role: "user",
              content: correctionInstruction,
            });
          }
          const streamResult = await runStream((signal) =>
            generateOptimizationPlan(
              requestMessages,
              diagramInfo,
              (chunk) => {
                if (chunk.reasoning) {
                  reasoningBuffer += chunk.reasoning;
                }
                if (chunk.summary) {
                  summaryBuffer = chunk.summary;
                }
                dispatchMessages({
                  type: "update",
                  id: assistantMsgId,
                  patch: {
                    content: summaryBuffer || "正在生成...",
                    reasoning: reasoningBuffer || undefined,
                  },
                });
              },
              signal,
            ),
          );
          if (!streamResult.success) {
            throw new Error(streamResult.error || "Unknown error");
          }
          return streamResult.data;
        };

        let result = await runGenerationRequest();
        let validation = validateGenerationResult({
          summary: result.summary,
          mermaid: result.mermaid,
          snapshot: options?.generationSnapshot,
        });

        if (!validation.ok) {
          result = await runGenerationRequest(
            `请严格修正上一版输出：${validation.reason}。仅返回符合约束的新结果，不要解释。`,
          );
          validation = validateGenerationResult({
            summary: result.summary,
            mermaid: result.mermaid,
            snapshot: options?.generationSnapshot,
          });
          if (!validation.ok) {
            throw new Error(validation.reason);
          }
        }

        if (!result.mermaid || result.mermaid.trim() === "") {
          dispatchMessages({
            type: "update",
            id: assistantMsgId,
            patch: {
              content: `AI未能生成有效的Mermaid图表代码。请尝试更具体地描述您需要的架构优化。\n\n以下是AI的回复：\n${result.summary}`,
              isGenerating: false,
              error: "未找到Mermaid代码块",
            },
          });
          return null;
        }

        const shortSummary =
          result.summary.trim().split("\n").find(Boolean)?.trim() || "优化方案";
        let generatedVersion = 1;
        let wasUpdated = false;
        const targetSchemeId = options?.targetSchemeId ?? activeSchemeId;
        const shouldForceCreate = options?.forceCreate === true;
        const canUpdateExistingBySnapshot =
          !shouldForceCreate &&
          !!targetSchemeId &&
          schemes.some((s) => s.id === targetSchemeId);
        const createdSchemeId = `scheme-${Date.now()}`;
        const resolvedSchemeId =
          canUpdateExistingBySnapshot && targetSchemeId
            ? targetSchemeId
            : createdSchemeId;

        setSchemes((prev) => {
          const canUpdateExisting =
            !shouldForceCreate &&
            !!targetSchemeId &&
            prev.some((s) => s.id === targetSchemeId);

          if (canUpdateExisting && targetSchemeId) {
            const updated = prev.map((scheme) =>
              scheme.id === targetSchemeId
                ? {
                    ...scheme,
                    summary: result.summary,
                    fullSummary: result.fullSummary,
                    mermaid: result.mermaid,
                    shortSummary,
                    sourceCombinationId: options?.sourceCombinationId ?? null,
                    sourceSuggestionIds: options?.sourceSuggestionIds ?? [],
                    sourceSuggestionSnapshot:
                      options?.sourceSuggestionSnapshot ?? [],
                    generationSnapshot: options?.generationSnapshot,
                  }
                : scheme,
            );
            const updatedScheme = updated.find((s) => s.id === targetSchemeId);
            generatedVersion = updatedScheme?.version ?? 1;
            wasUpdated = true;
            return updated;
          }

          const nextVersion =
            prev.length > 0 ? prev[prev.length - 1].version + 1 : 1;
          generatedVersion = nextVersion;
          const scheme: Scheme = {
            id: createdSchemeId,
            version: nextVersion,
            summary: result.summary,
            fullSummary: result.fullSummary,
            mermaid: result.mermaid,
            shortSummary,
            title: "",
            sourceCombinationId: options?.sourceCombinationId ?? null,
            sourceSuggestionIds: options?.sourceSuggestionIds ?? [],
            sourceSuggestionSnapshot: options?.sourceSuggestionSnapshot ?? [],
            generationSnapshot: options?.generationSnapshot,
          };
          return [...prev, scheme];
        });

        setActiveSchemeId(resolvedSchemeId);
        setIsPreviewPage(true);
        setSuggestionToast(
          wasUpdated
            ? `已更新方案 ${generatedVersion}，可插入到主图旁`
            : `已生成方案 ${generatedVersion}，可插入到主图旁`,
        );
        if (suggestionToastTimerRef.current) {
          clearTimeout(suggestionToastTimerRef.current);
        }
        suggestionToastTimerRef.current = window.setTimeout(() => {
          setSuggestionToast(null);
          suggestionToastTimerRef.current = null;
        }, 2200);

        dispatchMessages({ type: "remove", id: assistantMsgId });
        return { schemeId: resolvedSchemeId, wasUpdated };
      } catch (error) {
        console.error("Optimization failed", error);
        dispatchMessages({
          type: "update",
          id: assistantMsgId,
          patch: {
            content: String(error).includes("Request aborted")
              ? "已停止生成。"
              : "生成优化方案失败。",
            isGenerating: false,
            error: String(error),
          },
        });
        return null;
      }
    },
    [
      activeSchemeId,
      dispatchMessages,
      elements,
      isStreaming,
      messages,
      runStream,
      schemes,
      setActiveSchemeId,
      setIsPreviewPage,
      setSchemes,
      setSuggestionToast,
      suggestionToastTimerRef,
    ],
  );

  const buildGenerationPromptFromSnapshot = useCallback(
    (snapshot: ReturnType<typeof buildGenerationSnapshot>) => {
      if (snapshot.selectedItems.length === 0) {
        return;
      }

      const context = snapshot.selectedItems
        .map(
          (s) =>
            `- [${categoryLabels[s.category]}] ${s.content}${s.note ? ` (备注: ${s.note})` : ""}`,
        )
        .join("\n");

      const stylePrompt =
        snapshot.style === "minimal"
          ? "生成极简风格的架构图，只包含核心组件。"
          : snapshot.style === "detailed"
            ? "生成详细的架构图，包含所有子组件和连接。"
            : "生成标准风格的架构图。";

      return `基于以下已选优化建议，${stylePrompt}\n\n已选建议：\n${context}`;
    },
    [],
  );

  const runSelectedPlanGeneration = useCallback(
    async (mode: "create" | "update") => {
      const isUpdateMode = mode === "update";
      if (isUpdateMode && !activeSchemeId) {
        return;
      }

      if (isUpdateMode && !skipUpdateConfirm) {
        const confirmed = window.confirm(
          "将覆盖当前方案内容，历史内容不可自动恢复。是否继续？",
        );
        if (!confirmed) {
          return;
        }
        const dontAskAgain = window.confirm("后续更新当前方案时不再提示？");
        if (dontAskAgain) {
          setSkipUpdateConfirm(true);
        }
      }

      const snapshot = buildGenerationSnapshot(
        selectedSuggestions,
        architectureStyle,
        activeSchemeId,
        activeCombinationId,
      );
      const prompt = buildGenerationPromptFromSnapshot(snapshot);
      if (!prompt) {
        return;
      }

      const result = await runPlanGeneration(
        prompt,
        buildPlanExecutionOptions(snapshot, activeSchemeId, mode),
      );
      if (result?.schemeId) {
        setActiveSchemeId(result.schemeId);
        setIsPreviewPage(true);
      }
    },
    [
      activeCombinationId,
      activeSchemeId,
      architectureStyle,
      buildGenerationPromptFromSnapshot,
      runPlanGeneration,
      selectedSuggestions,
      setActiveSchemeId,
      setIsPreviewPage,
      setSkipUpdateConfirm,
      skipUpdateConfirm,
    ],
  );

  const generateNewFromSelected = useCallback(async () => {
    await runSelectedPlanGeneration("create");
  }, [runSelectedPlanGeneration]);

  const updateCurrentFromSelected = useCallback(async () => {
    await runSelectedPlanGeneration("update");
  }, [runSelectedPlanGeneration]);

  return {
    runSelectedPlanGeneration,
    generateNewFromSelected,
    updateCurrentFromSelected,
  };
};
