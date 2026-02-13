/**
 * Workflow / suggestion-pool atoms for ArchitectureOptimizationDialog
 */
import { atom } from "../../../editor-jotai";

import type {
    ArchitectureStyle,
    PoolSuggestion,
    SuggestionCombination,
} from "../model";

/** Suggestion pool — all harvested suggestions */
export const aoSuggestionPoolAtom = atom<PoolSuggestion[]>([]);

/** Named suggestion combinations */
export const aoSuggestionCombinationsAtom = atom<SuggestionCombination[]>([]);

/** Currently active combination ID */
export const aoActiveCombinationIdAtom = atom<string | null>(null);

/** Architecture diagram style */
export const aoArchitectureStyleAtom = atom<ArchitectureStyle>("standard");

/** Skip update-current confirmation */
export const aoSkipUpdateConfirmAtom = atom(false);

/** ID of suggestion currently being edited inline */
export const aoEditingSuggestionIdAtom = atom<string | null>(null);

/** Search keyword for filtering suggestions */
export const aoSuggestionSearchKeywordAtom = atom("");

/** Show archived suggestions toggle */
export const aoShowArchivedSuggestionsAtom = atom(false);

/** Set of expanded suggestion card IDs */
/** Expanded suggestion IDs (stored as array for Jotai compatibility) */
export const aoExpandedSuggestionIdsAtom = atom<string[]>([]);

/** Toast message for suggestion operations */
export const aoSuggestionToastAtom = atom<string | null>(null);
