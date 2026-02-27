import React from "react";

import { DraftStep } from "../../AIArchitectureGenerationDialog/DraftStep";
import type { DiagramStatus, DraftViewMode } from "../../AIArchitectureGeneration";

interface DraftConfirmPageProps {
  onContinueCalibrate: () => void;
  onInsertToCanvas: () => void;
  readOnly: boolean;
  readOnlyReason?: string;
  filter: string;
  onFilterChange: (value: string) => void;
  suggestions: Record<string, string[]>;
  onSuggestionsChange: (value: Record<string, string[]>) => void;
  activeScopeId: string | null;
  onActiveScopeIdChange: (scopeId: string | null) => void;
  selectedScopeIds: string[];
  onSelectedScopeIdsChange: (scopeIds: string[]) => void;
  viewMode: DraftViewMode;
  onViewModeChange: (mode: DraftViewMode) => void;
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
  panoramaDiagram: string;
  onPanoramaDiagramChange: (value: string) => void;
  panoramaDiagramStatus: DiagramStatus;
  onPanoramaDiagramStatusChange: (value: DiagramStatus) => void;
}

export const DraftConfirmPage: React.FC<DraftConfirmPageProps> = (props) => {
  return <DraftStep {...props} />;
};
