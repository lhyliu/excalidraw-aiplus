import { useCallback } from "react";

import {
  cancelAiTask,
  createAiTask,
  subscribeAiTask,
} from "../../../services/aiTaskService";
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

interface InferSemanticOptions {
  stallTimeoutMs?: number;
  onStreamChunk?: () => void;
  onStall?: () => void;
}

export const parseServiceSemanticSuggestions = (
  raw: string,
): ServiceSemanticSuggestion[] => {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || raw;
  const extractJsonObject = (text: string): string => {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return text.slice(firstBrace, lastBrace + 1);
    }
    return text;
  };
  try {
    const parsed = JSON.parse(extractJsonObject(candidate));
    const suggestionsRaw = Array.isArray(parsed?.suggestions)
      ? parsed.suggestions
      : Array.isArray(parsed)
        ? parsed
        : [];
    if (!Array.isArray(suggestionsRaw)) {
      return [];
    }
    return suggestionsRaw
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
  const { run, abort, isStreaming } = useAIStream();

  const inferMissingServiceNames = useCallback(
    async (
      rows: ServiceSemanticContextRow[],
      options?: InferSemanticOptions,
    ): Promise<ServiceSemanticSuggestion[]> => {
      if (rows.length === 0) {
        return [];
      }
      const messages = buildServiceSemanticMessages(rows);
      let full = "";
      let lastActivityTs = Date.now();
      const stallTimeoutMs = options?.stallTimeoutMs ?? 0;
      const result = await run(async (signal) => {
        const { taskId } = await createAiTask("service_name_fill", { messages });
        const done = await new Promise<boolean>((resolve) => {
          const unsubscribe = subscribeAiTask(taskId, {
            onPartial: ({ data }) => {
              full += data;
              lastActivityTs = Date.now();
              options?.onStreamChunk?.();
            },
            onProgress: () => {
              lastActivityTs = Date.now();
            },
            onHeartbeat: () => {
              if (
                stallTimeoutMs > 0 &&
                Date.now() - lastActivityTs > stallTimeoutMs
              ) {
                options?.onStall?.();
                void cancelAiTask(taskId);
                unsubscribe();
                resolve(false);
              }
            },
            onDone: () => {
              unsubscribe();
              resolve(true);
            },
            onError: () => {
              unsubscribe();
              resolve(false);
            },
          });
          signal.addEventListener("abort", () => {
            void cancelAiTask(taskId);
            unsubscribe();
            resolve(false);
          });
        });
        return done;
      });
      if (!result.success) {
        return [];
      }
      if (!result.data) {
        return [];
      }
      return parseServiceSemanticSuggestions(full);
    },
    [abort, run],
  );

  return {
    inferMissingServiceNames,
    abortSemanticInference: abort,
    isStreaming,
  };
};
