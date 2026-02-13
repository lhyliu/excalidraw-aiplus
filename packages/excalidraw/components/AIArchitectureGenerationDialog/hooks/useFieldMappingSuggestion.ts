import { useCallback } from "react";

import { runAIStream } from "../../../services/aiService";
import { useAIStream } from "../../hooks/useAIStream";
import type { StandardField } from "../../AIArchitectureGeneration";

import { buildFieldMappingSuggestionMessages } from "../prompt/fieldMappingSuggestionPrompt";

export interface ParsedFieldMappingSuggestion {
  header: string;
  reason: string;
}

export const parseFieldMappingSuggestion = (
  raw: string,
): ParsedFieldMappingSuggestion => {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || raw;
  try {
    const parsed = JSON.parse(candidate);
    return {
      header: String(parsed?.header ?? "").trim(),
      reason: String(parsed?.reason ?? "").trim(),
    };
  } catch {
    const firstLine = candidate
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return {
      header: firstLine ?? "",
      reason: "",
    };
  }
};

export const useFieldMappingSuggestion = () => {
  const { run, isStreaming } = useAIStream();

  const requestSuggestion = useCallback(
    async (
      field: StandardField,
      headers: string[],
      sampleRows: Record<string, string>[],
    ): Promise<ParsedFieldMappingSuggestion | null> => {
      const messages = buildFieldMappingSuggestionMessages(
        field,
        headers,
        sampleRows,
      );
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
        return null;
      }

      const parsed = parseFieldMappingSuggestion(full);
      if (!parsed.header) {
        return null;
      }
      return parsed;
    },
    [run],
  );

  return {
    requestSuggestion,
    isStreaming,
  };
};

