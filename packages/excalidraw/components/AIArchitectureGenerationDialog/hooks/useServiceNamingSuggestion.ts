import { useCallback } from "react";

import {
  cancelAiTask,
  createAiTask,
  subscribeAiTask,
} from "../../../services/aiTaskService";
import { useAIStream } from "../../hooks/useAIStream";
import type {
  NormalizedVmRow,
  ServiceGroup,
} from "../../AIArchitectureGeneration";

import { buildServiceNamingMessages } from "../prompt/serviceNamingPrompt";

export const parseServiceNameSuggestions = (raw: string): string[] => {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || raw;
  try {
    const parsed = JSON.parse(candidate);
    if (Array.isArray(parsed?.suggestions)) {
      return parsed.suggestions
        .map((item: unknown) => String(item).trim())
        .filter(Boolean)
        .slice(0, 4);
    }
  } catch {
    // fallback to line-based parsing
  }

  return candidate
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.()\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 4);
};

export const useServiceNamingSuggestion = () => {
  const { run, abort, isStreaming } = useAIStream();

  const requestSuggestions = useCallback(
    async (group: ServiceGroup, rows: NormalizedVmRow[]): Promise<string[]> => {
      const messages = buildServiceNamingMessages(group, rows);
      let full = "";
      const result = await run(async (signal) => {
        const { taskId } = await createAiTask("service_name_fill", { messages });
        const done = await new Promise<boolean>((resolve) => {
          const unsubscribe = subscribeAiTask(taskId, {
            onPartial: ({ data }) => {
              full += data;
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

      return parseServiceNameSuggestions(full);
    },
    [run],
  );

  return {
    requestSuggestions,
    abortServiceNamingSuggestion: abort,
    isStreaming,
  };
};

