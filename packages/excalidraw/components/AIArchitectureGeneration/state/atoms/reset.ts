import { atom } from "../../../../editor-jotai";

import { DEFAULT_SESSION_STATE } from "../../types";

import {
  aliasStoreAtom,
  cellEditsAtom,
  fieldMappingAtom,
  ignoredRowsAtom,
  sourceDataAtom,
} from "./sourceData";
import { sessionStateAtom } from "./session";

export const resetAIArchitectureWorkspaceAtom = atom(null, (_get, set) => {
  set(sourceDataAtom, null);
  set(fieldMappingAtom, {});
  set(cellEditsAtom, {});
  set(ignoredRowsAtom, []);
  set(aliasStoreAtom, {});
  set(sessionStateAtom, DEFAULT_SESSION_STATE);
});

