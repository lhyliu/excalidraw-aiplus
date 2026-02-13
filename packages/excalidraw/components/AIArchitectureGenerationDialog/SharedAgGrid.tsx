import React from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
} from "ag-grid-community";
import type { AgGridReactProps } from "ag-grid-react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

let sharedGridRegistered = false;
if (!sharedGridRegistered) {
  ModuleRegistry.registerModules([AllCommunityModule]);
  sharedGridRegistered = true;
}

interface SharedAgGridProps<TData> extends AgGridReactProps<TData> {
  containerClassName?: string;
}

export const SharedAgGrid = <TData,>({
  containerClassName,
  rowHeight = 38,
  headerHeight = 36,
  domLayout = "autoHeight",
  suppressRowHoverHighlight = true,
  suppressCellFocus = true,
  ...gridProps
}: SharedAgGridProps<TData>) => (
  <div
    className={[
      "ai-architecture-generation-dialog__ag-grid",
      "ag-theme-quartz",
      containerClassName ?? "",
    ]
      .filter(Boolean)
      .join(" ")}
  >
    <AgGridReact<TData>
      rowHeight={rowHeight}
      headerHeight={headerHeight}
      domLayout={domLayout}
      suppressRowHoverHighlight={suppressRowHoverHighlight}
      suppressCellFocus={suppressCellFocus}
      {...gridProps}
    />
  </div>
);
