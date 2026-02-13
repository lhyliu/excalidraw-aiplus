/**
 * 工具函数
 */

import type { StandardField, ParsedCsv, FieldInferenceResult, FieldCandidate } from "../types";

/** 标准字段别名映射 */
const FIELD_ALIASES: Record<StandardField, string[]> = {
  hostname: ["hostname", "host", "server", "name", "主机名", "主机", "服务器"],
  privateIp: ["private_ip", "privateip", "ip", "ip_address", "ipaddress", "内网ip", "ip地址"],
  serviceName: ["service", "service_name", "servicename", "app", "application", "服务", "应用"],
  environment: ["env", "environment", "stage", "环境", "部署环境"],
  cpuCores: ["cpu", "cores", "cpu_cores", "cpucores", "cpu核数", "核数"],
  memoryGb: ["memory", "mem", "ram", "memory_gb", "memorygb", "内存", "内存大小"],
  cluster: ["cluster", "cluster_name", "集群", "集群名"],
  region: ["region", "dc", "datacenter", "zone", "区域", "数据中心", "可用区"],
};

/** 推断字段映射 */
export function inferFieldMapping(headers: string[]): FieldInferenceResult {
  const result: FieldInferenceResult = {};
  
  headers.forEach((header) => {
    const normalizedHeader = header.toLowerCase().trim();
    
    (Object.keys(FIELD_ALIASES) as StandardField[]).forEach((field) => {
      const aliases = FIELD_ALIASES[field];
      const score = calculateMatchScore(normalizedHeader, aliases);
      
      if (score > 0) {
        if (!result[field]) result[field] = [];
        result[field]!.push({
          field,
          header,
          score,
          reason: `匹配别名: ${aliases.find(a => normalizedHeader.includes(a)) || normalizedHeader}`,
        });
      }
    });
  });
  
  // 按分数排序
  (Object.keys(result) as StandardField[]).forEach((field) => {
    result[field]!.sort((a, b) => b.score - a.score);
  });
  
  return result;
}

/** 计算匹配分数 */
function calculateMatchScore(header: string, aliases: string[]): number {
  // 完全匹配
  if (aliases.includes(header)) return 1.0;
  
  // 包含匹配
  for (const alias of aliases) {
    if (header.includes(alias)) return 0.8;
    if (alias.includes(header)) return 0.6;
  }
  
  // 相似度匹配（简化版）
  for (const alias of aliases) {
    const similarity = calculateSimilarity(header, alias);
    if (similarity > 0.7) return similarity * 0.5;
  }
  
  return 0;
}

/** 计算字符串相似度（Levenshtein距离） */
function calculateSimilarity(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  
  const distance = matrix[b.length][a.length];
  const maxLength = Math.max(a.length, b.length);
  
  return 1 - distance / maxLength;
}

/** 生成唯一ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** 解析CSV文本 */
export function parseCSV(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  
  // 解析表头
  const headers = parseCSVLine(lines[0]);
  
  // 解析数据行
  const rows = lines.slice(1).map((line, index) => {
    const values = parseCSVLine(line);
    const rowData: Record<string, string> = {};
    
    headers.forEach((header, i) => {
      rowData[header] = values[i] || "";
    });
    
    return {
      rowId: index,
      values: rowData,
      raw: rowData,
    };
  });
  
  return { headers, rows };
}

/** 解析CSV行 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // 跳过下一个引号
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/** 验证IP地址 */
export function isValidIP(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255 && part === String(num);
  });
}

/** 验证数字 */
export function isValidNumber(value: string): boolean {
  return !isNaN(Number(value)) && value.trim() !== "";
}

/** 格式化数字 */
export function formatNumber(value: number | null, decimals = 0): string {
  if (value === null) return "-";
  return value.toFixed(decimals);
}

/** 防抖函数 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/** 节流函数 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
