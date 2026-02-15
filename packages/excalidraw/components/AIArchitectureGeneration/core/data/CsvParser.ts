import Papa from "papaparse";

import type { ParsedCsv, RawCsvRow } from "../../types";

export interface ParseCsvOptions {
  delimiter?: string;
  encoding?: string;
  skipEmptyLines?: boolean;
  maxRows?: number;
}

export class CsvParseError extends Error {
  constructor(
    message: string,
    public lineNumber?: number,
    public rawLine?: string,
  ) {
    super(message);
    this.name = "CsvParseError";
  }
}

const WORKER_THRESHOLD = 5000;
const DEFAULT_MAX_ROWS = 10000;

function processResults(
  results: Papa.ParseResult<Record<string, string>>,
  options: ParseCsvOptions,
): ParsedCsv {
  if (results.errors.length > 0 && results.data.length === 0) {
    const firstError = results.errors[0];
    throw new CsvParseError(firstError.message, firstError.row, "");
  }

  const headers = results.meta.fields ?? [];
  if (headers.length === 0) {
    throw new CsvParseError("未找到有效的 CSV 表头");
  }

  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const data = results.data.length > maxRows ? results.data.slice(0, maxRows) : results.data;

  const rows: RawCsvRow[] = data.map((row, index) => ({
    rowId: index,
    values: row,
    raw: row,
  }));

  return { headers, rows };
}

export const CsvParser = {
  parse(text: string, options: ParseCsvOptions = {}): Promise<ParsedCsv> {
    const useWorker = text.length > WORKER_THRESHOLD;
    return new Promise((resolve, reject) => {
      const onComplete = (results: Papa.ParseResult<Record<string, string>>) => {
        try {
          resolve(processResults(results, options));
        } catch (error) {
          reject(error);
        }
      };

      if (useWorker) {
        Papa.parse<Record<string, string>>(text, {
          header: true,
          delimiter: options.delimiter,
          skipEmptyLines: options.skipEmptyLines ?? true,
          worker: true,
          complete: onComplete,
        });
      } else {
        const results = Papa.parse<Record<string, string>>(text, {
          header: true,
          delimiter: options.delimiter,
          skipEmptyLines: options.skipEmptyLines ?? true,
        });
        onComplete(results);
      }
    });
  },

  parseFile(file: File, options: ParseCsvOptions = {}): Promise<ParsedCsv> {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>, File>(file, {
        header: true,
        delimiter: options.delimiter,
        skipEmptyLines: options.skipEmptyLines ?? true,
        encoding: options.encoding,
        worker: file.size > WORKER_THRESHOLD,
        complete: (results: Papa.ParseResult<Record<string, string>>) => {
          try {
            resolve(processResults(results, options));
          } catch (error) {
            reject(error);
          }
        },
        error: (error: Error) => {
          reject(new CsvParseError(error.message));
        },
      });
    });
  },
};
