import Papa from "papaparse";

import type { ImportWarning, RawAssetTable } from "../domain/types";

const parserRowToRowId = (parserRow: unknown) => {
  if (typeof parserRow !== "number" || !Number.isInteger(parserRow)) {
    return undefined;
  }

  return parserRow > 0 ? `row-${parserRow}` : undefined;
};

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

export const parseCsvInventory = (input: string): RawAssetTable => {
  const parsed = Papa.parse<string[]>(input, {
    skipEmptyLines: true,
  });
  const [rawHeaders = [], ...rawRows] = parsed.data;
  const { headers, warnings: headerWarnings } = sanitizeHeaders(
    rawHeaders.map((header) => String(header ?? "")),
  );
  const rows = rawRows.map((rawRow, index) => ({
    rowId: `row-${index + 1}`,
    cells: Object.fromEntries(
      headers.map((header, columnIndex) => [
        header,
        String(rawRow[columnIndex] ?? ""),
      ]),
    ),
  }));
  const warnings: ImportWarning[] = parsed.errors.map((error) => ({
    severity: "warning",
    message: error.message,
    column: error.code,
    rowId: parserRowToRowId(error.row),
  }));

  return { headers, rows, warnings: [...warnings, ...headerWarnings] };
};
