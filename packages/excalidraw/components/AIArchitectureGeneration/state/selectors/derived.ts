/**
 * Layer 3: 派生数据层 (计算，不持久化)
 * 基于原始数据和编辑计算派生状态
 */

import { atom } from "jotai";
import {
  sourceDataAtom,
  fieldMappingAtom,
  cellEditsAtom,
  ignoredRowsAtom,
} from "../atoms/sourceData";
import { normalizeVmRows } from "../../core/data";
import { inferServiceGroups } from "../../core/inference";
import { detectIssues } from "../../core/validation";
import { STANDARD_FIELDS, type NormalizedVmRow } from "../../types";

// ============================================
// 派生数据选择器
// ============================================

/** 有效行数据 (排除忽略的行) */
export const validRowsAtom = atom((get) => {
  const sourceData = get(sourceDataAtom);
  const ignored = get(ignoredRowsAtom);
  
  if (!sourceData) return [];
  
  return sourceData.rows.filter((row) => !ignored.includes(row.rowId));
});

/** 规范化后的行数据 */
export const normalizedRowsAtom = atom<NormalizedVmRow[]>((get) => {
  const sourceData = get(sourceDataAtom);
  const mapping = get(fieldMappingAtom);
  const edits = get(cellEditsAtom);
  const ignoredRows = get(ignoredRowsAtom);
  
  if (!sourceData || !mapping || Object.keys(mapping).length === 0) {
    return [];
  }

  return normalizeVmRows(sourceData.rows, mapping, {
    cellEdits: edits,
    ignoredRows,
  });
});

/** 兼容导出 */
export const normalizedVmRowsAtom = normalizedRowsAtom;

/** 统计信息 */
export const dataStatsAtom = atom((get) => {
  const sourceData = get(sourceDataAtom);
  const validRows = get(validRowsAtom);
  const ignored = get(ignoredRowsAtom);
  const mapping = get(fieldMappingAtom);
  
  return {
    totalRows: sourceData?.rows.length || 0,
    validRows: validRows.length,
    ignoredRows: ignored.length,
    mappedFields: Object.keys(mapping).length,
    totalFields: STANDARD_FIELDS.length,
  };
});

/** 映射完成度 */
export const mappingCompletenessAtom = atom((get) => {
  const mapping = get(fieldMappingAtom);
  const requiredFields = ["hostname", "privateIp", "serviceName"] as const;
  const optionalFields = [
    "environment",
    "cpuCores",
    "memoryGb",
    "cluster",
    "region",
  ] as const;
  
  const requiredMapped = requiredFields.filter((f) => mapping[f]).length;
  const optionalMapped = optionalFields.filter((f) => mapping[f]).length;
  
  return {
    required: {
      mapped: requiredMapped,
      total: requiredFields.length,
      complete: requiredMapped === requiredFields.length,
    },
    optional: {
      mapped: optionalMapped,
      total: optionalFields.length,
    },
    overall: Math.round(
      ((requiredMapped + optionalMapped) /
        (requiredFields.length + optionalFields.length)) *
        100,
    ),
  };
});

/** 问题统计 */
export const issueStatsAtom = atom((get) => {
  const issues = get(issuesAtom);
  
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  
  return {
    total: issues.length,
    errors: errors.length,
    warnings: warnings.length,
    hasBlockingIssues: errors.length > 0,
  };
});

/** 问题列表 (派生计算) */
export const issuesAtom = atom((get) => detectIssues(get(normalizedRowsAtom)));

/** 服务分组 (派生计算) */
export const serviceGroupsAtom = atom((get) =>
  inferServiceGroups(get(normalizedRowsAtom)),
);
