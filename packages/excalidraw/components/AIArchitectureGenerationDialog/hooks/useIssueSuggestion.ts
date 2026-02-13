import { useCallback } from "react";

import { runAIStream } from "../../../services/aiService";
import { useAIStream } from "../../hooks/useAIStream";
import type { Issue } from "../../AIArchitectureGeneration";

import {
  buildIssueSuggestionMessages,
  type IssueSuggestionContextRow,
} from "../prompt/issueSuggestionPrompt";

export interface ParsedIssueSuggestion {
  suggestedValue: string;
  reason: string;
}

export const parseIssueSuggestion = (raw: string): ParsedIssueSuggestion => {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || raw;
  try {
    const parsed = JSON.parse(candidate);
    return {
      suggestedValue: String(parsed?.suggestedValue ?? "").trim(),
      reason: String(parsed?.reason ?? "").trim(),
    };
  } catch {
    const firstLine = candidate
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return {
      suggestedValue: firstLine ?? "",
      reason: "",
    };
  }
};

export const useIssueSuggestion = () => {
  const { run, isStreaming } = useAIStream();

  const requestSuggestion = useCallback(
    async (
      issueTitle: string,
      issueCode: Issue["code"],
      issueField: Issue["field"] | undefined,
      rows: IssueSuggestionContextRow[],
    ): Promise<ParsedIssueSuggestion | null> => {
      const messages = buildIssueSuggestionMessages(
        issueTitle,
        issueCode,
        issueField,
        rows,
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

      const parsed = parseIssueSuggestion(full);
      return parsed.suggestedValue ? parsed : null;
    },
    [run],
  );

  return {
    requestSuggestion,
    isStreaming,
  };
};
