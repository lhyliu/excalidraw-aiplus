import type {
  NormalizedVmRow,
  ServiceGroup,
} from "../../AIArchitectureGeneration";

export type DraftGroupView = {
  id: string;
  name: string;
  confidence: number;
  reason: string;
  vmCount: number;
};

export const projectDraftGroups = (
  groups: ServiceGroup[],
  rows: NormalizedVmRow[],
): DraftGroupView[] => {
  const rowMap = new Map(rows.map((row) => [row.rowId, row]));
  return groups.map((group) => {
    const vmCount = group.rowIds.filter((rowId) => rowMap.has(rowId)).length;
    return {
      id: group.id,
      name: group.name,
      confidence: group.confidence,
      reason: group.reason,
      vmCount,
    };
  });
};


