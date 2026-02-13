import React from "react";

import type { ClearSchemesOptions } from "./atoms/uiAtoms";

interface ClearSchemesConfirmDialogProps {
  isOpen: boolean;
  options: ClearSchemesOptions;
  onChangeOptions: (updater: (prev: ClearSchemesOptions) => ClearSchemesOptions) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ClearSchemesConfirmDialog: React.FC<
  ClearSchemesConfirmDialogProps
> = ({ isOpen, options, onChangeOptions, onCancel, onConfirm }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="ao-inline-confirm">
      <div className="ao-inline-confirm__panel">
        <h3 className="ao-inline-confirm__title">清空方案</h3>
        <p className="ao-inline-confirm__desc">
          将清空所有方案，该操作不可恢复。请选择是否同时清理建议数据。
        </p>
        <label className="ao-inline-confirm__option">
          <input
            type="checkbox"
            checked={options.alsoClearSelected}
            onChange={(e) =>
              onChangeOptions((prev) => ({
                ...prev,
                alsoClearSelected: e.target.checked,
              }))
            }
          />
          清空已选建议
        </label>
        <label className="ao-inline-confirm__option">
          <input
            type="checkbox"
            checked={options.alsoClearPool}
            onChange={(e) => {
              const checked = e.target.checked;
              onChangeOptions((prev) => ({
                ...prev,
                alsoClearPool: checked,
                alsoClearSelected: checked ? true : prev.alsoClearSelected,
              }));
            }}
          />
          清空建议项目（建议流）
        </label>
        <div className="ao-inline-confirm__actions">
          <button type="button" onClick={onCancel}>
            取消
          </button>
          <button type="button" onClick={onConfirm}>
            确认清空
          </button>
        </div>
      </div>
    </div>
  );
};
