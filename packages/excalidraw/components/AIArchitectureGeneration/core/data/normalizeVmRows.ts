/**
 * 数据标准化功能
 * 从原 importWorkflow/normalizeVmRows.ts 迁移
 */

import type {
  RawCsvRow,
  NormalizedVmRow,
  CanonicalVmRow,
  FieldMapping,
  CellEdits,
  IgnoredRows,
} from "../../types";

/** 标准化选项 */
export interface NormalizeOptions {
  cellEdits?: CellEdits;
  ignoredRows?: IgnoredRows;
  defaultValues?: Partial<CanonicalVmRow>;
}

/** 标准化行数据 */
export function normalizeVmRows(
  rows: RawCsvRow[],
  fieldMapping: FieldMapping,
  options: NormalizeOptions = {},
): NormalizedVmRow[] {
  const { cellEdits = {}, ignoredRows = [] } = options;
  
  return rows
    .filter((row) => !ignoredRows.includes(row.rowId))
    .map((row) => normalizeSingleRow(row, fieldMapping, cellEdits[row.rowId]));
}

/** 标准化单行数据 */
function normalizeSingleRow(
  row: RawCsvRow,
  mapping: FieldMapping,
  rowEdits?: Partial<Record<keyof CanonicalVmRow, string>>,
): NormalizedVmRow {
  const getValue = (field: keyof typeof mapping): string => {
    const header = mapping[field];
    if (!header) return "";
    
    // 优先使用编辑值
    if (rowEdits?.[field] !== undefined) {
      return rowEdits[field];
    }
    
    return row.values[header] ?? "";
  };
  
  const hostname = getValue("hostname").trim();
  const privateIp = getValue("privateIp").trim();
  const serviceName = getValue("serviceName").trim();
  const environment = getValue("environment").trim();
  const cluster = getValue("cluster").trim();
  const region = getValue("region").trim();
  
  // 解析数字字段
  const cpuCoresRaw = getValue("cpuCores");
  const memoryGbRaw = getValue("memoryGb");
  
  const cpuCores = cpuCoresRaw ? parseInt(cpuCoresRaw, 10) || null : null;
  const memoryGb = memoryGbRaw ? parseFloat(memoryGbRaw) || null : null;
  
  return {
    rowId: row.rowId,
    raw: row.raw,
    vm: {
      hostname,
      privateIp,
      serviceName: serviceName || "unknown",
      environment: environment || "production",
      cpuCores,
      memoryGb,
      cluster: cluster || "default",
      region: region || "unknown",
    },
  };
}

/** 规范化主机名 */
export function normalizeHostname(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** 规范化IP地址 */
export function normalizeIp(ip: string): string | null {
  const trimmed = ip.trim();
  
  // 基本格式验证
  if (!trimmed) return null;
  
  // 检查是否是有效的IPv4
  const parts = trimmed.split(".");
  if (parts.length !== 4) return null;
  
  const isValid = parts.every((part) => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255 && part === String(num);
  });
  
  return isValid ? trimmed : null;
}

/** 推断环境 */
export function inferEnvironment(hostname: string): string {
  const lower = hostname.toLowerCase();
  
  if (lower.includes("dev") || lower.includes("develop")) {
    return "development";
  }
  if (lower.includes("test") || lower.includes("qa")) {
    return "testing";
  }
  if (lower.includes("stg") || lower.includes("staging")) {
    return "staging";
  }
  if (lower.includes("prod") || lower.includes("prd")) {
    return "production";
  }
  
  return "production";
}

/** 推断服务名 */
export function inferServiceName(hostname: string): string {
  const normalized = normalizeHostname(hostname);
  const parts = normalized.split("-");
  
  // 尝试提取服务名（通常是第一部分）
  if (parts.length > 0 && parts[0]) {
    return parts[0];
  }
  
  return "unknown-service";
}

/** 验证规范化数据 */
export function validateNormalizedRow(row: NormalizedVmRow): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const { vm } = row;
  
  if (!vm.hostname) {
    errors.push("主机名不能为空");
  }
  
  if (!vm.privateIp) {
    errors.push("IP地址不能为空");
  } else if (!isValidIp(vm.privateIp)) {
    errors.push(`无效的IP地址: ${vm.privateIp}`);
  }
  
  if (vm.cpuCores !== null && (vm.cpuCores < 0 || vm.cpuCores > 512)) {
    errors.push(`CPU核数超出合理范围: ${vm.cpuCores}`);
  }
  
  if (vm.memoryGb !== null && (vm.memoryGb < 0 || vm.memoryGb > 4096)) {
    errors.push(`内存大小超出合理范围: ${vm.memoryGb}GB`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/** 验证IP地址 */
function isValidIp(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255 && part === String(num);
  });
}
