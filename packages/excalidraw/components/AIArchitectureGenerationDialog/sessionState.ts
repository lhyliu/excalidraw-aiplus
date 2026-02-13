import type { AIArchitectureGenerationSessionState } from "../AIArchitectureGeneration/types";
import {
  sessionStateAtom,
} from "../AIArchitectureGeneration/state/atoms/session";
import { DEFAULT_SESSION_STATE } from "../AIArchitectureGeneration/types";

export type { AIArchitectureGenerationSessionState };

export const DEFAULT_AI_ARCH_GENERATION_SESSION = DEFAULT_SESSION_STATE;
export const aiArchitectureGenerationSessionAtom = sessionStateAtom;

