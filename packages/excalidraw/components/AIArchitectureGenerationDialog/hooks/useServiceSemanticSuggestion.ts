import { useCallback } from "react";

import { runAIStream } from "../../../services/aiService";
import { useAIStream } from "../../hooks/useAIStream";

import {
  buildServiceSemanticMessages,
  type ServiceSemanticContextRow,
} from "../prompt/serviceSemanticPrompt";

export interface ServiceSemanticSuggestion {
  rowId: number;
  serviceName: string;
  reason: string;
}

export const parseServiceSemanticSuggestions = (
  raw: string,
): ServiceSemanticSuggestion[] => {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || raw;
  try {
    const parsed = JSON.parse(candidate);
    if (!Array.isArray(parsed?.suggestions)) {
      return [];
    }
    return parsed.suggestions
      .map((item: unknown) => {
        const rowId = Number((item as { rowId?: unknown })?.rowId);
        const serviceName = String(
          (item as { serviceName?: unknown })?.serviceName ?? "",
        ).trim();
        const reason = String((item as { reason?: unknown })?.reason ?? "").trim();
        if (!Number.isFinite(rowId) || !serviceName) {
          return null;
        }
        return {
          rowId,
          serviceName,
          reason,
        };
      })
      .filter((item: ServiceSemanticSuggestion | null): item is ServiceSemanticSuggestion =>
        Boolean(item),
      );
  } catch {
    return [];
  }
};

export const useServiceSemanticSuggestion = () => {
  const { run, isStreaming } = useAIStream();

  const inferMissingServiceNames = useCallback(
    async (rows: ServiceSemanticContextRow[]): Promise<ServiceSemanticSuggestion[]> => {
      if (rows.length === 0) {
        return [];
      }
      const messages = buildServiceSemanticMessages(rows);
      let full = "";
      const result = await run((signal) =>
        runAIStream(
          messages,
          {
            onChunk: (chunk) => {
              full += chunk;
            },
          },
          signal,
        ),
      );
      if (!result.success) {
        return [];
      }
      return parseServiceSemanticSuggestions(full);
    },
    [run],
  );

  return {
    inferMissingServiceNames,
    isStreaming,
  };
};

