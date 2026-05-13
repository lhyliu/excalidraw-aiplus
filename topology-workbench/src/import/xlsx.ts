import { readSheet } from "read-excel-file/browser";

import type { ImportWarning, RawAssetTable } from "../domain/types";

const cellToString = (cell: unknown) => (cell == null ? "" : String(cell));

const sanitizeHeaders = (headers: string[]) => {
  const warnings: ImportWarning[] = [];
  const counts = new Map<string, number>();
  const sanitized = headers.map((header, index) => {
    const fallback = `column_${index + 1}`;
    const base = header === "" ? fallback : header;

    if (header === "") {
      warnings.push({
        severity: "warning",
        message: `Blank header renamed to ${fallback}`,
        column: fallback,
      });
    }

    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    if (seen === 0) {
      return base;
    }

    const renamed = `${base}_${seen + 1}`;
    warnings.push({
      severity: "warning",
      message: `Duplicate header renamed from ${base} to ${renamed}`,
      column: renamed,
    });

    return renamed;
  });

  return { headers: sanitized, warnings };
};

export const parseXlsxInventory = async (file: File): Promise<RawAssetTable> => {
  const sheet = await readSheet(file, 1);
  const [headerRow = [], ...bodyRows] = sheet;
  const { headers, warnings } = sanitizeHeaders(headerRow.map(cellToString));
  const rows = bodyRows
    .filter((row) => row.some((cell) => cell != null && String(cell) !== ""))
    .map((row, index) => ({
      rowId: `row-${index + 1}`,
      cells: Object.fromEntries(
        headers.map((header, columnIndex) => [
          header,
          cellToString(row[columnIndex]),
        ]),
      ),
    }));

  return { headers, rows, warnings };
};
