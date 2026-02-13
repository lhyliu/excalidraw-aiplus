/**
 * 会话状态管理
 * 存储用户的会话级别状态
 */

import { atomWithStorage, createJSONStorage } from "jotai/utils";
import { atom } from "jotai";
import type {
  GenerationStep,
  GenerationMode,
  AIArchitectureGenerationSessionState,
} from "../../types";
import { DEFAULT_SESSION_STATE } from "../../types";

const STORAGE_KEY = "excalidraw_ai_arch_generation_session_v2";
const fallbackMemoryStorage = new Map<string, string>();

const jsonStorage = createJSONStorage(() => {
  const candidate =
    typeof window !== "undefined"
      ? (window.localStorage as Storage | undefined)
      : undefined;
  if (
    candidate &&
    typeof candidate.getItem === "function" &&
    typeof candidate.setItem === "function" &&
    typeof candidate.removeItem === "function"
  ) {
    return candidate;
  }
  return {
    getItem: (key: string) => fallbackMemoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      fallbackMemoryStorage.set(key, value);
    },
    removeItem: (key: string) => {
      fallbackMemoryStorage.delete(key);
    },
  };
});

/** 会话状态Atom */
export const sessionStateAtom =
  atomWithStorage<AIArchitectureGenerationSessionState>(
    STORAGE_KEY,
    DEFAULT_SESSION_STATE,
    jsonStorage,
  );

/** 当前步骤 */
export const currentStepAtom = atom(
  (get) => get(sessionStateAtom).step,
  (get, set, step: GenerationStep) => {
    const current = get(sessionStateAtom);
    set(sessionStateAtom, { ...current, step });
  },
);

/** 生成模式 */
export const generationModeAtom = atom(
  (get) => get(sessionStateAtom).mode,
  (get, set, mode: GenerationMode) => {
    const current = get(sessionStateAtom);
    set(sessionStateAtom, { ...current, mode });
  },
);

/** 草稿过滤器 */
export const draftFilterAtom = atom(
  (get) => get(sessionStateAtom).draftFilter,
  (get, set, filter: string) => {
    const current = get(sessionStateAtom);
    set(sessionStateAtom, { ...current, draftFilter: filter });
  },
);

/** 命名建议 */
export const namingSuggestionsAtom = atom(
  (get) => get(sessionStateAtom).namingSuggestions,
  (get, set, suggestions: Record<string, string[]>) => {
    const current = get(sessionStateAtom);
    set(sessionStateAtom, { ...current, namingSuggestions: suggestions });
  },
);

/** 重置会话状态 */
export const resetSessionStateAtom = atom(null, (_get, set) => {
  set(sessionStateAtom, DEFAULT_SESSION_STATE);
});

/** 更新命名建议 */
export const updateNamingSuggestionAtom = atom(
  null,
  (get, set, groupId: string, suggestions: string[]) => {
    const current = get(sessionStateAtom);
    set(sessionStateAtom, {
      ...current,
      namingSuggestions: {
        ...current.namingSuggestions,
        [groupId]: suggestions,
      },
    });
  },
);
