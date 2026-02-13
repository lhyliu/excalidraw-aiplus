/**
 * Scheme-related atoms for ArchitectureOptimizationDialog
 */
import { atom } from "../../../editor-jotai";

import type { Scheme } from "../model";

/** All generated schemes */
export const aoSchemesAtom = atom<Scheme[]>([]);

/** Currently active scheme ID */
export const aoActiveSchemeIdAtom = atom<string | null>(null);

/** Derived: the active Scheme object (read-only) */
export const aoActiveSchemeAtom = atom((get) => {
    const schemes = get(aoSchemesAtom);
    const activeId = get(aoActiveSchemeIdAtom);
    return (
        schemes.find((s) => s.id === activeId) ||
        schemes[schemes.length - 1] ||
        null
    );
});

/** Compare mode toggle */
export const aoIsCompareModeAtom = atom(false);

/** Undo buffer for deleted schemes */
export const aoDeletedSchemesBufferAtom = atom<{
    schemes: Scheme[];
    activeId: string | null;
    timeoutId: number;
} | null>(null);

/** Show undo toast */
export const aoShowUndoToastAtom = atom(false);

/** Set of scheme IDs currently being rendered */
/** Scheme IDs currently being rendered (stored as array for Jotai compatibility) */
export const aoRenderingSchemeIdsAtom = atom<string[]>([]);
