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

import {
  buildBusinessArchitectureMessages,
  type BusinessArchitectureSuggestion,
} from "../prompt/businessArchitecturePrompt";

const extractJsonObject = (text: string): string => {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text;
};

export const parseBusinessArchitectureSuggestion = (
  raw: string,
): BusinessArchitectureSuggestion | null => {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidates = [fenced || "", extractJsonObject(raw), raw]
    .map((candidate) => candidate.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const root =
        (parsed.suggestion as Record<string, unknown> | undefined) ??
        (parsed.data as Record<string, unknown> | undefined) ??
        parsed;

      const mermaidRaw = root.mermaid;
      const mermaid = typeof mermaidRaw === "string" ? mermaidRaw.trim() : "";
      if (!mermaid) {
        continue;
      }

      const layersRaw = Array.isArray(root.layers) ? root.layers : [];
      const layers = layersRaw
        .map((item) => {
          const record = item as Record<string, unknown>;
          const name = String(record.name ?? "").trim();
          const description = String(record.description ?? "").trim();
          const reason = String(record.reason ?? "").trim();
          const rowIds = (Array.isArray(record.rowIds) ? record.rowIds : [])
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
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      return {
        summary: String(root.summary ?? "").trim(),
        topologySummary: String(root.topologySummary ?? "").trim(),
        mermaid,
        layers,
      };
    } catch {
      continue;
    }
  }

  return null;
};

export const useBusinessArchitectureSuggestion = () => {
  const { run, abort, isStreaming } = useAIStream();

  const requestBusinessArchitecture = useCallback(
    async (
      scopeName: string,
      groups: ServiceGroup[],
      rows: NormalizedVmRow[],
      options?: {
        targetMode?: "panorama" | "focus";
        selectedScopeNames?: string[];
        detailLevel?: "service-level";
      },
    ): Promise<BusinessArchitectureSuggestion | null> => {
      const messages = buildBusinessArchitectureMessages(
        scopeName,
        groups,
        rows,
        options,
      );
      let full = "";
      const result = await run(async (signal) => {
        const { taskId } = await createAiTask("business_layering", { messages });
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
        return null;
      }
      if (!result.data) {
        return null;
      }
      return parseBusinessArchitectureSuggestion(full);
    },
    [run],
  );

  return {
    requestBusinessArchitecture,
    abortBusinessArchitectureSuggestion: abort,
    isStreaming,
  };
};
