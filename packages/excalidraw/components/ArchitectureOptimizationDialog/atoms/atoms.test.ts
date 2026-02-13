import { beforeEach, describe, expect, it } from "vitest";

import { editorJotaiStore } from "../../../editor-jotai";

import {
  aoDispatchMessagesAtom,
  aoInputValueAtom,
  aoMessagesAtom,
} from "./chatAtoms";
import {
  aoActiveSchemeAtom,
  aoActiveSchemeIdAtom,
  aoDeletedSchemesBufferAtom,
  aoIsCompareModeAtom,
  aoRenderingSchemeIdsAtom,
  aoSchemesAtom,
  aoShowUndoToastAtom,
} from "./schemeAtoms";
import {
  aoClearSchemesOptionsAtom,
  aoHighlightedSuggestionIdAtom,
  aoIsClearSchemesDialogOpenAtom,
  aoIsDrawerOpenAtom,
  aoIsPanModeAtom,
  aoIsPreviewPageAtom,
  aoShowConfigExampleAtom,
  aoViewportAtom,
} from "./uiAtoms";
import {
  aoActiveCombinationIdAtom,
  aoArchitectureStyleAtom,
  aoEditingSuggestionIdAtom,
  aoExpandedSuggestionIdsAtom,
  aoShowArchivedSuggestionsAtom,
  aoSkipUpdateConfirmAtom,
  aoSuggestionCombinationsAtom,
  aoSuggestionPoolAtom,
  aoSuggestionSearchKeywordAtom,
  aoSuggestionToastAtom,
} from "./workflowAtoms";

import type { Message } from "../messageState";
import type { Scheme } from "../model";

const makeScheme = (id: string, version: number): Scheme => ({
  id,
  version,
  summary: `summary-${id}`,
  mermaid: "graph TD;A-->B;",
  shortSummary: `v${version}`,
});

const resetAllAtoms = () => {
  editorJotaiStore.set(aoMessagesAtom, []);
  editorJotaiStore.set(aoInputValueAtom, "");

  editorJotaiStore.set(aoSchemesAtom, []);
  editorJotaiStore.set(aoActiveSchemeIdAtom, null);
  editorJotaiStore.set(aoIsCompareModeAtom, false);
  editorJotaiStore.set(aoDeletedSchemesBufferAtom, null);
  editorJotaiStore.set(aoShowUndoToastAtom, false);
  editorJotaiStore.set(aoRenderingSchemeIdsAtom, []);

  editorJotaiStore.set(aoSuggestionPoolAtom, []);
  editorJotaiStore.set(aoSuggestionCombinationsAtom, []);
  editorJotaiStore.set(aoActiveCombinationIdAtom, null);
  editorJotaiStore.set(aoArchitectureStyleAtom, "standard");
  editorJotaiStore.set(aoSkipUpdateConfirmAtom, false);
  editorJotaiStore.set(aoEditingSuggestionIdAtom, null);
  editorJotaiStore.set(aoSuggestionSearchKeywordAtom, "");
  editorJotaiStore.set(aoShowArchivedSuggestionsAtom, false);
  editorJotaiStore.set(aoExpandedSuggestionIdsAtom, []);
  editorJotaiStore.set(aoSuggestionToastAtom, null);

  editorJotaiStore.set(aoIsPreviewPageAtom, false);
  editorJotaiStore.set(aoIsDrawerOpenAtom, false);
  editorJotaiStore.set(aoHighlightedSuggestionIdAtom, null);
  editorJotaiStore.set(aoViewportAtom, { x: 0, y: 0, zoom: 1 });
  editorJotaiStore.set(aoIsPanModeAtom, false);
  editorJotaiStore.set(aoShowConfigExampleAtom, false);
  editorJotaiStore.set(aoIsClearSchemesDialogOpenAtom, false);
  editorJotaiStore.set(aoClearSchemesOptionsAtom, {
    alsoClearSelected: false,
    alsoClearPool: false,
  });
};

describe("ArchitectureOptimizationDialog atoms", () => {
  beforeEach(() => {
    resetAllAtoms();
  });

  it("applies message reducer actions through aoDispatchMessagesAtom", () => {
    const message: Message = {
      id: "m1",
      role: "assistant",
      content: "hello",
      isGenerating: true,
    };

    editorJotaiStore.set(aoDispatchMessagesAtom, {
      type: "add",
      messages: [message],
    });
    expect(editorJotaiStore.get(aoMessagesAtom)).toEqual([message]);

    editorJotaiStore.set(aoDispatchMessagesAtom, {
      type: "append",
      id: "m1",
      chunk: " world",
    });
    expect(editorJotaiStore.get(aoMessagesAtom)[0]?.content).toBe(
      "hello world",
    );

    editorJotaiStore.set(aoDispatchMessagesAtom, {
      type: "update",
      id: "m1",
      patch: { isGenerating: false },
    });
    expect(editorJotaiStore.get(aoMessagesAtom)[0]?.isGenerating).toBe(false);
  });

  it("resolves active scheme from id and falls back to the latest scheme", () => {
    const s1 = makeScheme("scheme-1", 1);
    const s2 = makeScheme("scheme-2", 2);
    editorJotaiStore.set(aoSchemesAtom, [s1, s2]);

    expect(editorJotaiStore.get(aoActiveSchemeAtom)).toEqual(s2);

    editorJotaiStore.set(aoActiveSchemeIdAtom, s1.id);
    expect(editorJotaiStore.get(aoActiveSchemeAtom)).toEqual(s1);

    editorJotaiStore.set(aoActiveSchemeIdAtom, "missing-id");
    expect(editorJotaiStore.get(aoActiveSchemeAtom)).toEqual(s2);
  });

  it("stores workflow atoms with expected defaults and updates", () => {
    expect(editorJotaiStore.get(aoArchitectureStyleAtom)).toBe("standard");
    expect(editorJotaiStore.get(aoSuggestionPoolAtom)).toEqual([]);
    expect(editorJotaiStore.get(aoShowArchivedSuggestionsAtom)).toBe(false);

    editorJotaiStore.set(aoArchitectureStyleAtom, "detailed");
    editorJotaiStore.set(aoSuggestionSearchKeywordAtom, "gateway");
    editorJotaiStore.set(aoExpandedSuggestionIdsAtom, ["s-1", "s-2"]);
    editorJotaiStore.set(aoSuggestionToastAtom, "saved");

    expect(editorJotaiStore.get(aoArchitectureStyleAtom)).toBe("detailed");
    expect(editorJotaiStore.get(aoSuggestionSearchKeywordAtom)).toBe("gateway");
    expect(editorJotaiStore.get(aoExpandedSuggestionIdsAtom)).toEqual([
      "s-1",
      "s-2",
    ]);
    expect(editorJotaiStore.get(aoSuggestionToastAtom)).toBe("saved");
  });

  it("stores ui atoms with expected defaults and updates", () => {
    expect(editorJotaiStore.get(aoIsPreviewPageAtom)).toBe(false);
    expect(editorJotaiStore.get(aoViewportAtom)).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    });
    expect(editorJotaiStore.get(aoClearSchemesOptionsAtom)).toEqual({
      alsoClearSelected: false,
      alsoClearPool: false,
    });

    editorJotaiStore.set(aoIsPreviewPageAtom, true);
    editorJotaiStore.set(aoViewportAtom, { x: 12, y: -8, zoom: 0.8 });
    editorJotaiStore.set(aoClearSchemesOptionsAtom, {
      alsoClearSelected: true,
      alsoClearPool: true,
    });

    expect(editorJotaiStore.get(aoIsPreviewPageAtom)).toBe(true);
    expect(editorJotaiStore.get(aoViewportAtom)).toEqual({
      x: 12,
      y: -8,
      zoom: 0.8,
    });
    expect(editorJotaiStore.get(aoClearSchemesOptionsAtom)).toEqual({
      alsoClearSelected: true,
      alsoClearPool: true,
    });
  });
});
