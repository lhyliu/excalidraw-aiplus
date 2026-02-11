import { vi } from "vitest";
import {
  COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX,
  randomId,
  reseed,
} from "@excalidraw/common";
import { type FileId } from "@excalidraw/element/types";

import * as blobModule from "../../data/blob";
import * as StaticScene from "../../renderer/staticScene";
import {
  checkpointHistory,
  GlobalTestState,
  unmountComponent,
} from "../test-utils";

export const h = window.h;

export const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

export const transparent = COLOR_PALETTE.transparent;
export const black = COLOR_PALETTE.black;
export const red = COLOR_PALETTE.red[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX];
export const blue = COLOR_PALETTE.blue[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX];
export const yellow =
  COLOR_PALETTE.yellow[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX];
export const violet =
  COLOR_PALETTE.violet[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX];

export const setupHistoryTest = () => {
  unmountComponent();
  renderStaticScene.mockClear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();

  reseed(7);

  const generateIdSpy = vi.spyOn(blobModule, "generateIdFromFile");
  const resizeFileSpy = vi.spyOn(blobModule, "resizeImageFile");

  generateIdSpy.mockImplementation(() => Promise.resolve(randomId() as FileId));
  resizeFileSpy.mockImplementation((file: File) => Promise.resolve(file));

  Object.assign(document, {
    elementFromPoint: () => GlobalTestState.canvas,
  });
};

export const checkpointHistoryState = (name: string) => {
  expect(renderStaticScene.mock.calls.length).toMatchSnapshot(
    `[${name}] number of renders`,
  );

  const {
    name: _ignoredName,
    scrolledOutside,
    selectedLinearElement,
    ...strippedAppState
  } = h.state;

  expect(strippedAppState).toMatchSnapshot(`[${name}] appState`);
  expect(h.elements.length).toMatchSnapshot(`[${name}] number of elements`);

  h.elements
    .map(({ seed, versionNonce, ...strippedElement }) => strippedElement)
    .forEach((element, i) =>
      expect(element).toMatchSnapshot(`[${name}] element ${i}`),
    );

  checkpointHistory(h.history, name);
};
