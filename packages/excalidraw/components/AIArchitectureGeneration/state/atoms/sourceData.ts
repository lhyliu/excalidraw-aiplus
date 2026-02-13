/**
 * Layer 1: 原始数据源 (持久化)
 * 存储用户导入的原始数据
 */

import { atom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";
import type { ParsedCsv, FieldMapping, CellEdits, IgnoredRows, AliasStore } from "../../types";

const STORAGE_KEY_PREFIX = "excalidraw_ai_arch_gen_v2";
const fallbackMemoryStorage = new Map<string, string>();

const jsonStorage = createJSONStorage(() => {
  const candidate =
    typeof window !== "undefined"
      ? (window.localStorage as Storage | undefined)
      : undefined;
  if (
    candidate &&
    typeof candidate.getItem === "function" &&
    typeof candidate.setItem === "function" &&
    typeof candidate.removeItem === "function"
  ) {
    return candidate;
  }
  return {
    getItem: (key: string) => fallbackMemoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      fallbackMemoryStorage.set(key, value);
    },
    removeItem: (key: string) => {
      fallbackMemoryStorage.delete(key);
    },
  };
});

// ============================================
// 原始CSV数据 (Layer 1)
// ============================================

/** 原始CSV数据Atom */
export const sourceDataAtom = atomWithStorage<ParsedCsv | null>(
  `${STORAGE_KEY_PREFIX}_source`,
  null,
  jsonStorage,
);

/** 兼容导出: 非 null CSV Atom */
export const importedCsvAtom = atom(
  (get): ParsedCsv => get(sourceDataAtom) ?? { headers: [], rows: [] },
  (_get, set, value: ParsedCsv) => {
    if (value.headers.length === 0 && value.rows.length === 0) {
      set(sourceDataAtom, null);
      return;
    }
    set(sourceDataAtom, value);
  },
);

/** 设置原始数据 */
export const setSourceDataAtom = atom(
  null,
  (_get, set, data: ParsedCsv) => {
    set(sourceDataAtom, data);
  },
);

/** 清除原始数据 */
export const clearSourceDataAtom = atom(null, (_get, set) => {
  set(sourceDataAtom, null);
});

// ============================================
// 字段映射 (Layer 1)
// ============================================

/** 字段映射Atom */
export const fieldMappingAtom = atomWithStorage<FieldMapping>(
  `${STORAGE_KEY_PREFIX}_mapping`,
  {},
  jsonStorage,
);

/** 设置字段映射 */
export const setFieldMappingAtom = atom(
  null,
  (_get, set, mapping: FieldMapping) => {
    set(fieldMappingAtom, mapping);
  },
);

/** 更新单个字段映射 */
export const updateFieldMappingAtom = atom(
  null,
  (get, set, field: keyof FieldMapping, header: string | undefined) => {
    const current = get(fieldMappingAtom);
    if (header) {
      set(fieldMappingAtom, { ...current, [field]: header });
    } else {
      const { [field]: _, ...rest } = current;
      set(fieldMappingAtom, rest);
    }
  },
);

// ============================================
// 单元格编辑 (Layer 1)
// ============================================

/** 单元格编辑Atom */
export const cellEditsAtom = atomWithStorage<CellEdits>(
  `${STORAGE_KEY_PREFIX}_edits`,
  {},
  jsonStorage,
);

/** 兼容导出 */
export const editsAtom = cellEditsAtom;

/** 设置单元格值 */
export const setCellValueAtom = atom(
  null,
  (get, set, rowId: number, field: string, value: string | undefined) => {
    const current = get(cellEditsAtom);
    const rowEdits = current[rowId] || {};
    
    if (value === undefined) {
      const { [field]: _, ...restFields } = rowEdits;
      if (Object.keys(restFields).length === 0) {
        const { [rowId]: __, ...restRows } = current;
        set(cellEditsAtom, restRows);
      } else {
        set(cellEditsAtom, { ...current, [rowId]: restFields });
      }
    } else {
      set(cellEditsAtom, {
        ...current,
        [rowId]: { ...rowEdits, [field]: value },
      });
    }
  },
);

/** 清除所有编辑 */
export const clearCellEditsAtom = atom(null, (_get, set) => {
  set(cellEditsAtom, {});
});

// ============================================
// 忽略的行 (Layer 1)
// ============================================

/** 忽略的行Atom */
export const ignoredRowsAtom = atomWithStorage<IgnoredRows>(
  `${STORAGE_KEY_PREFIX}_ignored`,
  [],
  jsonStorage,
);

/** 切换行忽略状态 */
export const toggleRowIgnoredAtom = atom(null, (get, set, rowId: number) => {
  const current = get(ignoredRowsAtom);
  if (current.includes(rowId)) {
    set(ignoredRowsAtom, current.filter((id) => id !== rowId));
  } else {
    set(ignoredRowsAtom, [...current, rowId]);
  }
});

/** 设置忽略的行 */
export const setIgnoredRowsAtom = atom(
  null,
  (_get, set, rows: IgnoredRows) => {
    set(ignoredRowsAtom, rows);
  },
);

// ============================================
// 别名存储 (Layer 1)
// ============================================

/** 别名存储Atom */
export const aliasStoreAtom = atomWithStorage<AliasStore>(
  `${STORAGE_KEY_PREFIX}_aliases`,
  {},
  jsonStorage,
);

/** 添加别名 */
export const addAliasAtom = atom(
  null,
  (get, set, field: keyof AliasStore, alias: string) => {
    const current = get(aliasStoreAtom);
    const currentAliases = current[field] || [];
    if (!currentAliases.includes(alias)) {
      set(aliasStoreAtom, {
        ...current,
        [field]: [...currentAliases, alias],
      });
    }
  },
);
