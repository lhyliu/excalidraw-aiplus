/**
 * Layer 4: UI状态 (临时，不持久化)
 */

import { atom } from "jotai";
import type { UIState } from "../../types";

/** UI状态Atom */
export const uiStateAtom = atom<UIState>({
  isLoading: false,
  error: null,
  sidebarOpen: true,
  activeDetailRow: null,
  showHelp: false,
});

/** 加载状态 */
export const isLoadingAtom = atom(
  (get) => get(uiStateAtom).isLoading,
  (get, set, isLoading: boolean) => {
    const current = get(uiStateAtom);
    set(uiStateAtom, { ...current, isLoading });
  },
);

/** 错误状态 */
export const errorAtom = atom(
  (get) => get(uiStateAtom).error,
  (get, set, error: string | null) => {
    const current = get(uiStateAtom);
    set(uiStateAtom, { ...current, error });
  },
);

/** 侧边栏状态 */
export const sidebarOpenAtom = atom(
  (get) => get(uiStateAtom).sidebarOpen,
  (get, set, open: boolean) => {
    const current = get(uiStateAtom);
    set(uiStateAtom, { ...current, sidebarOpen: open });
  },
);

/** 活动详情行 */
export const activeDetailRowAtom = atom(
  (get) => get(uiStateAtom).activeDetailRow,
  (get, set, rowId: number | null) => {
    const current = get(uiStateAtom);
    set(uiStateAtom, { ...current, activeDetailRow: rowId });
  },
);

/** 帮助显示状态 */
export const showHelpAtom = atom(
  (get) => get(uiStateAtom).showHelp,
  (get, set, show: boolean) => {
    const current = get(uiStateAtom);
    set(uiStateAtom, { ...current, showHelp: show });
  },
);

/** 清除错误 */
export const clearErrorAtom = atom(null, (get, set) => {
  const current = get(uiStateAtom);
  set(uiStateAtom, { ...current, error: null });
});

/** 设置错误 */
export const setErrorAtom = atom(null, (get, set, error: string) => {
  const current = get(uiStateAtom);
  set(uiStateAtom, { ...current, error, isLoading: false });
});

/** 开始加载 */
export const startLoadingAtom = atom(null, (get, set) => {
  const current = get(uiStateAtom);
  set(uiStateAtom, { ...current, isLoading: true, error: null });
});

/** 结束加载 */
export const stopLoadingAtom = atom(null, (get, set) => {
  const current = get(uiStateAtom);
  set(uiStateAtom, { ...current, isLoading: false });
});
