import { useCallback } from "react";

import { useAtom } from "../../../editor-jotai";
import { aliasStoreAtom, buildAliasStoreFromMapping } from "../../AIArchitectureGeneration";
import type { FieldMapping } from "../../AIArchitectureGeneration";

export const useAliasMemory = () => {
  const [aliasStore, setAliasStore] = useAtom(aliasStoreAtom);

  const rememberMapping = useCallback(
    (mapping: FieldMapping) => {
      setAliasStore(buildAliasStoreFromMapping(mapping, aliasStore));
    },
    [aliasStore, setAliasStore],
  );

  return {
    aliasStore,
    rememberMapping,
  };
};


