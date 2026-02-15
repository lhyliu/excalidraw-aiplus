import React from "react";

import { DraftStep } from "../../AIArchitectureGenerationDialog/DraftStep";
import type { DiagramStatus } from "../../AIArchitectureGeneration";

interface DraftConfirmPageProps {
  onContinueCalibrate: () => void;
  onInsertToCanvas: () => void;
  filter: string;
  onFilterChange: (value: string) => void;
  suggestions: Record<string, string[]>;
  onSuggestionsChange: (value: Record<string, string[]>) => void;
  activeScopeId: string | null;
  onActiveScopeIdChange: (scopeId: string | null) => void;
  layerEditsByScope: Record<
    string,
    { name: string; description: string; rowIds: number[]; reason: string }[]
  >;
  onLayerEditsByScopeChange: (
    value: Record<
      string,
      { name: string; description: string; rowIds: number[]; reason: string }[]
    >,
  ) => void;
  diagramByScope: Record<string, string>;
  onDiagramByScopeChange: (value: Record<string, string>) => void;
  diagramStatusByScope: Record<string, DiagramStatus>;
  onDiagramStatusByScopeChange: (
    value: Record<string, "idle" | "generating" | "ready" | "error">,
  ) => void;
}

export const DraftConfirmPage: React.FC<DraftConfirmPageProps> = (props) => {
  return <DraftStep {...props} />;
};
