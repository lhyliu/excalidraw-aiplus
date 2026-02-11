import type { Message } from "./messageState";
import type { ArchitectureStyle, PoolSuggestion } from "./model";

export type PlanHistoryMessage = {
  role: Message["role"];
  content: string;
};

export const buildPlanHistoryMessages = (
  messages: readonly Message[],
  extraContext?: string,
  includeHistory = true,
): PlanHistoryMessage[] => {
  const historyMessages = includeHistory
    ? messages
        .filter((m) => !m.error && !m.isGenerating)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }))
    : [];

  if (extraContext?.trim()) {
    historyMessages.push({
      role: "user",
      content: extraContext.trim(),
    });
  }

  return historyMessages;
};

export type GenerationSnapshot = {
  selectedIds: string[];
  selectedItems: Array<{
    id: string;
    category: PoolSuggestion["category"];
    title: string;
    content: string;
    fullContent: string;
    note?: string;
  }>;
  style: ArchitectureStyle;
  sourceSchemeId: string | null;
  sourceCombinationId: string | null;
  createdAt: number;
};

export type PlanGenerationMode = "create" | "update";

export const buildPlanExecutionOptions = (
  snapshot: GenerationSnapshot,
  targetSchemeId: string | null,
  mode: PlanGenerationMode,
) => ({
  targetSchemeId,
  forceCreate: mode === "create",
  includeHistory: false,
  sourceCombinationId: snapshot.sourceCombinationId,
  sourceSuggestionIds: snapshot.selectedIds,
  sourceSuggestionSnapshot: snapshot.selectedItems,
  generationSnapshot: snapshot,
});

export const buildGenerationSnapshot = (
  selectedSuggestions: readonly PoolSuggestion[],
  style: ArchitectureStyle,
  sourceSchemeId: string | null,
  sourceCombinationId: string | null,
): GenerationSnapshot => ({
  selectedIds: selectedSuggestions.map((s) => s.id),
  selectedItems: selectedSuggestions.map((s) => ({
    id: s.id,
    category: s.category,
    title: s.title,
    content: s.content,
    fullContent: s.fullContent,
    note: s.note,
  })),
  style,
  sourceSchemeId,
  sourceCombinationId,
  createdAt: Date.now(),
});
