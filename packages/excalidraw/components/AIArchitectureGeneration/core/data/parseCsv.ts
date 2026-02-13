/**
 * CSV解析功能
 * 从原 importWorkflow/parseCsv.ts 迁移
 */

import type { ParsedCsv, RawCsvRow } from "../../types";

/** CSV解析选项 */
export interface ParseCsvOptions {
  delimiter?: string;
  encoding?: string;
  skipEmptyLines?: boolean;
  maxRows?: number;
}

/** CSV解析错误 */
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

/** 解析CSV文本 */
export function parseCsv(
  text: string,
  options: ParseCsvOptions = {},
): ParsedCsv {
  const { delimiter = ",", skipEmptyLines = true, maxRows = 10000 } = options;

  const records = parseCsvRecords(text, delimiter);
  const rows: RawCsvRow[] = [];
  let headers: string[] = [];

  let recordIndex = 0;

  while (recordIndex < records.length) {
    const record = records[recordIndex];
    recordIndex++;
    const isEmpty = record.every((value) => value.trim().length === 0);
    if (isEmpty && skipEmptyLines) {
      continue;
    }
    headers = record.map((header) => header.trim());
    break;
  }

  if (headers.length === 0) {
    throw new CsvParseError("未找到有效的CSV表头");
  }

  while (recordIndex < records.length && rows.length < maxRows) {
    const values = records[recordIndex];
    recordIndex++;
    const isEmpty = values.every((value) => value.trim().length === 0);
    if (isEmpty && skipEmptyLines) {
      continue;
    }
    const rowData: Record<string, string> = {};
    headers.forEach((header, i) => {
      rowData[header] = values[i] ?? "";
    });
    rows.push({
      rowId: rows.length,
      values: rowData,
      raw: rowData,
    });
  }

  return { headers, rows };
}

/** 解析 CSV 记录，支持引号内换行 */
function parseCsvRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      currentRecord.push(current.trim());
      current = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRecord.push(current.trim());
      current = "";
      const isRecordEmpty = currentRecord.every((value) => value.length === 0);
      if (!isRecordEmpty) {
        records.push(currentRecord);
      }
      currentRecord = [];
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    throw new CsvParseError("CSV 引号未闭合");
  }

  if (current.length > 0 || currentRecord.length > 0) {
    currentRecord.push(current.trim());
    const isRecordEmpty = currentRecord.every((value) => value.length === 0);
    if (!isRecordEmpty) {
      records.push(currentRecord);
    }
  }

  return records;
}

/** 从文件读取CSV */
export function readCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = parseCsv(text);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new CsvParseError("文件读取失败"));
    };
    
    reader.readAsText(file);
  });
}

/** 验证CSV数据 */
export function validateCsvData(parsed: ParsedCsv): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (parsed.headers.length === 0) {
    errors.push("CSV文件缺少表头");
  }
  
  if (parsed.rows.length === 0) {
    errors.push("CSV文件没有数据行");
  }
  
  // 检查列数一致性
  const columnCount = parsed.headers.length;
  const inconsistentRows = parsed.rows.filter((row) => {
    const values = Object.keys(row.values);
    return values.length !== columnCount;
  });
  
  if (inconsistentRows.length > 0) {
    errors.push(`${inconsistentRows.length} 行数据列数与表头不匹配`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/** 检测CSV编码（简化版） */
export function detectEncoding(text: string): string {
  // 检查BOM
  if (text.charCodeAt(0) === 0xfeff) {
    return "UTF-8 with BOM";
  }
  
  // 简单启发式检测
  const utf8Regex = /[\u4e00-\u9fa5]/;
  if (utf8Regex.test(text)) {
    return "UTF-8";
  }
  
  return "ASCII";
}
