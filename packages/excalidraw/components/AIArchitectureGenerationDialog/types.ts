export type GenerationStep =
  | "ingest"
  | "fieldConfirm"
  | "issueResolve"
  | "draftConfirm";

export type GenerationMode = "safe" | "advanced";
