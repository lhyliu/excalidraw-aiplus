/**
 * 问题检测功能
 * 从原 importWorkflow/issues.ts 迁移
 */

import type {
  Issue,
  IssueCode,
  IssueSeverity,
  NormalizedVmRow,
  StandardField,
} from "../../types";

/** 检测选项 */
export interface DetectIssuesOptions {
  checkDuplicates?: boolean;
  checkIpFormat?: boolean;
  checkRequiredFields?: boolean;
  checkNumericFields?: boolean;
}

/** 检测数据问题 */
export function detectIssues(
  rows: NormalizedVmRow[],
  options: DetectIssuesOptions = {},
): Issue[] {
  const {
    checkDuplicates = true,
    checkIpFormat = true,
    checkRequiredFields = true,
    checkNumericFields = true,
  } = options;
  
  const issues: Issue[] = [];
  
  // 用于检测重复
  const seenHostnames = new Map<string, number>();
  const seenIps = new Map<string, number>();
  
  rows.forEach((row) => {
    const { vm, rowId } = row;
    
    // 检查必填字段
    if (checkRequiredFields) {
      if (!vm.hostname) {
        issues.push(createIssue(rowId, "missing_required", "error", "缺少主机名", "hostname"));
      }
      
      if (!vm.privateIp) {
        issues.push(createIssue(rowId, "missing_required", "error", "缺少IP地址", "privateIp"));
      }

      if (!vm.serviceName || vm.serviceName.trim() === "" || vm.serviceName === "unknown") {
        issues.push(
          createIssue(
            rowId,
            "missing_required",
            "warning",
            "缺少服务名称（组件用途）",
            "serviceName",
          ),
        );
      }
    }
    
    // 检查IP格式
    if (checkIpFormat && vm.privateIp) {
      if (!isValidIp(vm.privateIp)) {
        issues.push(createIssue(
          rowId,
          "invalid_ip",
          "error",
          `无效的IP地址格式: ${vm.privateIp}`,
          "privateIp",
          suggestIpFix(vm.privateIp),
        ));
      }
    }
    
    // 检查数字字段
    if (checkNumericFields) {
      const cpuRaw = getRawNumericCandidate(row.raw, "cpu");
      const memoryRaw = getRawNumericCandidate(row.raw, "memory");

      if (cpuRaw && vm.cpuCores === null) {
        issues.push(createIssue(
          rowId,
          "invalid_number",
          "warning",
          `CPU核数不是有效数字: ${cpuRaw}`,
          "cpuCores",
        ));
      }
      
      if (memoryRaw && vm.memoryGb === null) {
        issues.push(createIssue(
          rowId,
          "invalid_number",
          "warning",
          `内存大小不是有效数字: ${memoryRaw}`,
          "memoryGb",
        ));
      }
    }
    
    // 检查重复
    if (checkDuplicates) {
      if (vm.hostname) {
        const dupRowId = seenHostnames.get(vm.hostname);
        if (dupRowId !== undefined) {
          issues.push(createIssue(
            rowId,
            "duplicate_hostname",
            "error",
            `主机名 "${vm.hostname}" 与第 ${dupRowId + 1} 行重复`,
            "hostname",
            `${vm.hostname}-${rowId}`,
          ));
        } else {
          seenHostnames.set(vm.hostname, rowId);
        }
      }
      
      if (vm.privateIp) {
        const dupRowId = seenIps.get(vm.privateIp);
        if (dupRowId !== undefined) {
          issues.push(createIssue(
            rowId,
            "duplicate_ip",
            "error",
            `IP地址 "${vm.privateIp}" 与第 ${dupRowId + 1} 行重复`,
            "privateIp",
          ));
        } else {
          seenIps.set(vm.privateIp, rowId);
        }
      }
    }
    
    // 检查环境值
    if (vm.environment && !isValidEnvironment(vm.environment)) {
      issues.push(createIssue(
        rowId,
        "unknown_environment",
        "warning",
        `未知的环境值: ${vm.environment}`,
        "environment",
      ));
    }
  });
  
  return issues;
}

/** 创建问题对象 */
function createIssue(
  rowId: number,
  code: IssueCode,
  severity: IssueSeverity,
  message: string,
  field?: StandardField,
  suggestedValue?: string,
): Issue {
  return {
    id: `${code}-${rowId}-${field || "general"}`,
    rowId,
    code,
    severity,
    message,
    field,
    suggestedValue,
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

/** 建议IP修复 */
function suggestIpFix(ip: string): string | undefined {
  // 尝试常见修复
  if (ip.includes(",")) {
    return ip.split(",")[0].trim();
  }
  
  if (ip.includes(" ")) {
    return ip.split(" ")[0].trim();
  }
  
  // 如果已经是合理的格式但验证失败，可能是其他问题
  return undefined;
}

/** 验证环境值 */
function isValidEnvironment(env: string): boolean {
  const validEnvs = [
    "production",
    "staging",
    "testing",
    "development",
    "prod",
    "stg",
    "test",
    "dev",
  ];
  
  return validEnvs.includes(env.toLowerCase());
}

function getRawNumericCandidate(
  raw: Record<string, string>,
  kind: "cpu" | "memory",
): string | null {
  const keys = Object.keys(raw);
  const matcher =
    kind === "cpu" ? /(cpu|core|vcpu)/i : /(memory|mem|ram)/i;
  const key = keys.find((item) => matcher.test(item));
  if (!key) {
    return null;
  }
  const value = String(raw[key] ?? "").trim();
  return value.length > 0 ? value : null;
}

/** 统计问题 */
export function countIssues(issues: Issue[]): {
  total: number;
  errors: number;
  warnings: number;
} {
  return {
    total: issues.length,
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
  };
}

/** 检查是否有阻塞性问题 */
export function hasBlockingIssues(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

/** 按行分组问题 */
export function groupIssuesByRow(issues: Issue[]): Map<number, Issue[]> {
  const grouped = new Map<number, Issue[]>();
  
  issues.forEach((issue) => {
    if (!grouped.has(issue.rowId)) {
      grouped.set(issue.rowId, []);
    }
    grouped.get(issue.rowId)!.push(issue);
  });
  
  return grouped;
}

/** 按问题代码分组 */
export function groupIssuesByCode(issues: Issue[]): Map<IssueCode, Issue[]> {
  const grouped = new Map<IssueCode, Issue[]>();
  
  issues.forEach((issue) => {
    if (!grouped.has(issue.code)) {
      grouped.set(issue.code, []);
    }
    grouped.get(issue.code)!.push(issue);
  });
  
  return grouped;
}

/** 应用建议修复 */
export function applySuggestedFix(
  row: NormalizedVmRow,
  issue: Issue,
): NormalizedVmRow | null {
  if (!issue.suggestedValue || !issue.field) return null;
  
  const newVm = { ...row.vm };
  
  switch (issue.field) {
    case "hostname":
      newVm.hostname = issue.suggestedValue;
      break;
    case "privateIp":
      newVm.privateIp = issue.suggestedValue;
      break;
    case "environment":
      newVm.environment = issue.suggestedValue;
      break;
    case "serviceName":
      newVm.serviceName = issue.suggestedValue;
      break;
    default:
      return null;
  }
  
  return {
    ...row,
    vm: newVm,
  };
}
