export type GenerationStep =
  | "workspace"
  | "import"
  | "mapping"
  | "issues"
  | "draft"
  | "calibrate";

export type GenerationMode = "safe" | "advanced";
