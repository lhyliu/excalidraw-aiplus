import { useCallback } from "react";

import { runAIStream } from "../../../services/aiService";
import { useAIStream } from "../../hooks/useAIStream";
import type {
  NormalizedVmRow,
  ServiceGroup,
} from "../../AIArchitectureGeneration";

import {
  buildBusinessScopeMessages,
  type BusinessScopeSuggestion,
} from "../prompt/businessScopePrompt";

export const parseBusinessScopeSuggestion = (
  raw: string,
): BusinessScopeSuggestion | null => {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced || raw).trim();
  try {
    const parsed = JSON.parse(candidate) as Partial<BusinessScopeSuggestion>;
    if (!Array.isArray(parsed.scopes)) {
      return null;
    }
    const scopes = parsed.scopes
      .map((item) => {
        const name = String((item as { name?: unknown }).name ?? "").trim();
        const reason = String((item as { reason?: unknown }).reason ?? "").trim();
        const groupIdsRaw = Array.isArray((item as { groupIds?: unknown }).groupIds)
          ? ((item as { groupIds: unknown[] }).groupIds as unknown[])
          : [];
        const groupIds = groupIdsRaw
          .map((value) => String(value).trim())
          .filter(Boolean);
        if (!name || groupIds.length === 0) {
          return null;
        }
        return { name, groupIds, reason };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (scopes.length === 0) {
      return null;
    }
    return { scopes };
  } catch {
    return null;
  }
};

export const useBusinessScopeSuggestion = () => {
  const { run, isStreaming } = useAIStream();

  const requestBusinessScopes = useCallback(
    async (
      groups: ServiceGroup[],
      rows: NormalizedVmRow[],
    ): Promise<BusinessScopeSuggestion | null> => {
      const messages = buildBusinessScopeMessages(groups, rows);
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
      return parseBusinessScopeSuggestion(full);
    },
    [run],
  );

  return {
    requestBusinessScopes,
    isStreaming,
  };
};

