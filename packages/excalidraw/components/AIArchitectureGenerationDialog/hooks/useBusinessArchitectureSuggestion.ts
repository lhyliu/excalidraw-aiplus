import { useCallback } from "react";

import { runAIStream } from "../../../services/aiService";
import { useAIStream } from "../../hooks/useAIStream";
import type {
  NormalizedVmRow,
  ServiceGroup,
} from "../../AIArchitectureGeneration";

import {
  buildBusinessArchitectureMessages,
  type BusinessArchitectureSuggestion,
} from "../prompt/businessArchitecturePrompt";

export const parseBusinessArchitectureSuggestion = (
  raw: string,
): BusinessArchitectureSuggestion | null => {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced || raw).trim();
  try {
    const parsed = JSON.parse(candidate) as Partial<BusinessArchitectureSuggestion>;
    if (typeof parsed.mermaid !== "string" || parsed.mermaid.trim().length === 0) {
      return null;
    }
    const layers = Array.isArray(parsed.layers)
      ? parsed.layers
          .map((item) => {
            const name = String((item as { name?: unknown }).name ?? "").trim();
            const description = String(
              (item as { description?: unknown }).description ?? "",
            ).trim();
            const reason = String((item as { reason?: unknown }).reason ?? "").trim();
            const rowIdsRaw = Array.isArray((item as { rowIds?: unknown }).rowIds)
              ? ((item as { rowIds: unknown[] }).rowIds as unknown[])
              : [];
            const rowIds = rowIdsRaw
              .map((value) => Number(value))
              .filter((value) => Number.isFinite(value));
            if (!name) {
              return null;
            }
            return {
              name,
              description,
              reason,
              rowIds,
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : [];

    return {
      summary: String(parsed.summary ?? "").trim(),
      mermaid: parsed.mermaid.trim(),
      layers,
    };
  } catch {
    return null;
  }
};

export const useBusinessArchitectureSuggestion = () => {
  const { run, isStreaming } = useAIStream();

  const requestBusinessArchitecture = useCallback(
    async (
      scopeName: string,
      groups: ServiceGroup[],
      rows: NormalizedVmRow[],
    ): Promise<BusinessArchitectureSuggestion | null> => {
      const messages = buildBusinessArchitectureMessages(scopeName, groups, rows);
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
      return parseBusinessArchitectureSuggestion(full);
    },
    [run],
  );

  return {
    requestBusinessArchitecture,
    isStreaming,
  };
};

