import { useCallback } from "react";

import { runAIStream } from "../../../services/aiService";
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
  const { run, isStreaming } = useAIStream();

  const requestSuggestions = useCallback(
    async (group: ServiceGroup, rows: NormalizedVmRow[]): Promise<string[]> => {
      const messages = buildServiceNamingMessages(group, rows);
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

      return parseServiceNameSuggestions(full);
    },
    [run],
  );

  return {
    requestSuggestions,
    isStreaming,
  };
};


