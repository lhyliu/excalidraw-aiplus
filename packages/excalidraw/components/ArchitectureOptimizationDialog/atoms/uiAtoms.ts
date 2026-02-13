/**
 * UI state atoms for ArchitectureOptimizationDialog
 */
import { atom } from "../../../editor-jotai";

/** Whether the preview page (vs suggestion page) is active */
export const aoIsPreviewPageAtom = atom(false);

/** Whether the side drawer is open in preview mode */
export const aoIsDrawerOpenAtom = atom(false);

/** ID of suggestion highlighted in the preview canvas */
export const aoHighlightedSuggestionIdAtom = atom<string | null>(null);

/** Preview canvas viewport */
export const aoViewportAtom = atom({ x: 0, y: 0, zoom: 1 });

/** Pan mode toggle for preview canvas */
export const aoIsPanModeAtom = atom(false);

/** Show AI config example in the "not configured" screen */
export const aoShowConfigExampleAtom = atom(false);

/** Clear-schemes confirmation dialog open state */
export const aoIsClearSchemesDialogOpenAtom = atom(false);

export interface ClearSchemesOptions {
    alsoClearSelected: boolean;
    alsoClearPool: boolean;
}

/** Clear-schemes dialog options (combined into one atom) */
export const aoClearSchemesOptionsAtom = atom<ClearSchemesOptions>({
    alsoClearSelected: false,
    alsoClearPool: false,
});
