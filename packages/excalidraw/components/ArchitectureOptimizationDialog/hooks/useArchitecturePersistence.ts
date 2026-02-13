import { useEffect } from "react";

import type { Dispatch, SetStateAction } from "react";

import type { Message } from "../messageState";
import type {
  ArchitectureStyle,
  PersistedAssistantState,
  PoolSuggestion,
  Scheme,
  SuggestionCombination,
} from "../model";

const CHAT_STORAGE_KEY = "excalidraw_architecture_chat";
const SCHEMES_STORAGE_KEY = "excalidraw_architecture_schemes";
const ASSISTANT_STATE_STORAGE_KEY = "excalidraw_architecture_assistant_state";

const getScopedStorageKey = (baseKey: string, scope?: string) =>
  scope ? `${baseKey}::${scope}` : baseKey;

const loadChatHistory = (scope?: string): Message[] => {
  try {
    const saved =
      localStorage.getItem(getScopedStorageKey(CHAT_STORAGE_KEY, scope)) ||
      localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load chat history:", e);
  }
  return [];
};

const saveChatHistory = (messages: Message[], scope?: string): void => {
  try {
    const messagesToSave = messages
      .filter((m) => !m.isGenerating && !m.error)
      .map(({ id, role, content }) => ({ id, role, content }));
    localStorage.setItem(
      getScopedStorageKey(CHAT_STORAGE_KEY, scope),
      JSON.stringify(messagesToSave),
    );
  } catch (e) {
    console.error("Failed to save chat history:", e);
  }
};

const loadSchemes = (scope?: string): Scheme[] => {
  try {
    const saved =
      localStorage.getItem(getScopedStorageKey(SCHEMES_STORAGE_KEY, scope)) ||
      localStorage.getItem(SCHEMES_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as Scheme[];
    }
  } catch (e) {
    console.error("Failed to load schemes:", e);
  }
  return [];
};

const saveSchemes = (schemes: Scheme[], scope?: string): void => {
  try {
    localStorage.setItem(
      getScopedStorageKey(SCHEMES_STORAGE_KEY, scope),
      JSON.stringify(schemes),
    );
  } catch (e) {
    console.error("Failed to save schemes:", e);
  }
};

const loadAssistantState = (scope?: string): PersistedAssistantState | null => {
  try {
    const saved =
      localStorage.getItem(
        getScopedStorageKey(ASSISTANT_STATE_STORAGE_KEY, scope),
      ) || localStorage.getItem(ASSISTANT_STATE_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as PersistedAssistantState;
    }
  } catch (e) {
    console.error("Failed to load assistant state:", e);
  }
  return null;
};

const saveAssistantState = (
  state: PersistedAssistantState,
  scope?: string,
): void => {
  try {
    localStorage.setItem(
      getScopedStorageKey(ASSISTANT_STATE_STORAGE_KEY, scope),
      JSON.stringify(state),
    );
  } catch (e) {
    console.error("Failed to save assistant state:", e);
  }
};

interface UseArchitecturePersistenceOptions {
  storageScope: string;
  isStreaming: boolean;
  messages: Message[];
  schemes: Scheme[];
  suggestionPool: PoolSuggestion[];
  suggestionCombinations: SuggestionCombination[];
  activeCombinationId: string | null;
  architectureStyle: ArchitectureStyle;
  skipUpdateConfirm: boolean;
  suggestionSearchKeyword: string;
  showArchivedSuggestions: boolean;
  inputValue: string;
  activeSchemeId: string | null;
  isPreviewPage: boolean;
  isCompareMode: boolean;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setSchemes: Dispatch<SetStateAction<Scheme[]>>;
  setActiveSchemeId: Dispatch<SetStateAction<string | null>>;
  setInputValue: Dispatch<SetStateAction<string>>;
  setIsCompareMode: Dispatch<SetStateAction<boolean>>;
  setSuggestionPool: Dispatch<SetStateAction<PoolSuggestion[]>>;
  setSuggestionCombinations: Dispatch<SetStateAction<SuggestionCombination[]>>;
  setActiveCombinationId: Dispatch<SetStateAction<string | null>>;
  setArchitectureStyle: Dispatch<SetStateAction<ArchitectureStyle>>;
  setSkipUpdateConfirm: Dispatch<SetStateAction<boolean>>;
  setSuggestionSearchKeyword: Dispatch<SetStateAction<string>>;
  setShowArchivedSuggestions: Dispatch<SetStateAction<boolean>>;
  setIsPreviewPage: Dispatch<SetStateAction<boolean>>;
}

export const useArchitecturePersistence = ({
  storageScope,
  isStreaming,
  messages,
  schemes,
  suggestionPool,
  suggestionCombinations,
  activeCombinationId,
  architectureStyle,
  skipUpdateConfirm,
  suggestionSearchKeyword,
  showArchivedSuggestions,
  inputValue,
  activeSchemeId,
  isPreviewPage,
  isCompareMode,
  setMessages,
  setSchemes,
  setActiveSchemeId,
  setInputValue,
  setIsCompareMode,
  setSuggestionPool,
  setSuggestionCombinations,
  setActiveCombinationId,
  setArchitectureStyle,
  setSkipUpdateConfirm,
  setSuggestionSearchKeyword,
  setShowArchivedSuggestions,
  setIsPreviewPage,
}: UseArchitecturePersistenceOptions) => {
  useEffect(() => {
    const savedMessages = loadChatHistory(storageScope);
    if (savedMessages.length > 0) {
      setMessages(savedMessages);
    }

    const savedSchemes = loadSchemes(storageScope);
    if (savedSchemes.length > 0) {
      setSchemes(savedSchemes);
      setActiveSchemeId(
        loadAssistantState(storageScope)?.activeSchemeId ??
          savedSchemes[savedSchemes.length - 1].id,
      );
    }

    const savedState = loadAssistantState(storageScope);
    if (savedState) {
      setInputValue(savedState.draftInput ?? "");
      setIsCompareMode(savedState.isCompareMode ?? false);
      setSuggestionPool(savedState.suggestionPool ?? []);
      setSuggestionCombinations(savedState.suggestionCombinations ?? []);
      setActiveCombinationId(savedState.activeCombinationId ?? null);
      setArchitectureStyle(savedState.architectureStyle ?? "standard");
      setSkipUpdateConfirm(savedState.skipUpdateConfirm ?? false);
      setSuggestionSearchKeyword(savedState.suggestionSearchKeyword ?? "");
      setShowArchivedSuggestions(savedState.showArchivedSuggestions ?? false);
      setIsPreviewPage(savedState.isPreviewPage ?? false);
    }
    // Intentional one-time hydration on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveSchemes(schemes, storageScope);
  }, [schemes, storageScope]);

  useEffect(() => {
    saveAssistantState(
      {
        suggestionPool,
        suggestionCombinations,
        activeCombinationId,
        architectureStyle,
        skipUpdateConfirm,
        suggestionSearchKeyword,
        showArchivedSuggestions,
        draftInput: inputValue,
        activeSchemeId,
        isPreviewPage,
        isCompareMode,
      },
      storageScope,
    );
  }, [
    suggestionPool,
    suggestionCombinations,
    activeCombinationId,
    architectureStyle,
    skipUpdateConfirm,
    suggestionSearchKeyword,
    showArchivedSuggestions,
    inputValue,
    activeSchemeId,
    isPreviewPage,
    isCompareMode,
    storageScope,
  ]);

  useEffect(() => {
    if (!isStreaming) {
      saveChatHistory(messages, storageScope);
    }
  }, [messages, isStreaming, storageScope]);
};
