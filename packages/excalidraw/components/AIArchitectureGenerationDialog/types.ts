export type GenerationStep =
  | "ingest"
  | "fieldConfirm"
  | "issueResolve"
  | "draftConfirm";

export type GenerationMode = "safe" | "advanced";

export type DraftStage = "scopeReady" | "layerReady" | "diagramReady";

export type DiagramStatus = "idle" | "generating" | "ready" | "error";

export interface LayerDraft {
  name: string;
  description: string;
  rowIds: number[];
  reason: string;
}
