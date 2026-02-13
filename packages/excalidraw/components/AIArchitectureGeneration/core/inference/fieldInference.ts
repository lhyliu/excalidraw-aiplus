/**
 * 字段推断功能
 * 从原 importWorkflow/fieldInference.ts 迁移
 * 增强别名匹配算法
 */

import type { StandardField, FieldCandidate, FieldInferenceResult, ParsedCsv } from "../../types";

/** 标准字段别名 */
const FIELD_ALIASES: Record<StandardField, string[]> = {
  hostname: [
    "hostname",
    "host",
    "server",
    "name",
    "server_name",
    "主机名",
    "主机",
    "服务器",
    "名称",
  ],
  privateIp: [
    "private_ip",
    "privateip",
    "ip",
    "ip_address",
    "ipaddress",
    "internal_ip",
    "内网ip",
    "ip地址",
    "内部ip",
  ],
  serviceName: [
    "service",
    "service_name",
    "servicename",
    "app",
    "application",
    "app_name",
    "服务",
    "应用",
    "服务名",
    "应用名",
  ],
  environment: [
    "env",
    "environment",
    "stage",
    "env_name",
    "环境",
    "部署环境",
    "环境名",
  ],
  cpuCores: [
    "cpu",
    "cores",
    "cpu_cores",
    "cpucores",
    "cpu_count",
    "cpu核数",
    "核数",
    "cpu数量",
  ],
  memoryGb: [
    "memory",
    "mem",
    "ram",
    "memory_gb",
    "memorygb",
    "mem_gb",
    "内存",
    "内存大小",
    "内存gb",
  ],
  cluster: [
    "cluster",
    "cluster_name",
    "clustername",
    "cluster_id",
    "集群",
    "集群名",
    "集群id",
  ],
  region: [
    "region",
    "dc",
    "datacenter",
    "zone",
    "region_name",
    "区域",
    "数据中心",
    "可用区",
    "地域",
  ],
};

/** 推断字段映射 */
export function inferFieldMapping(parsed: ParsedCsv): FieldInferenceResult {
  const result: FieldInferenceResult = {};
  
  parsed.headers.forEach((header) => {
    const normalizedHeader = header.toLowerCase().trim();
    
    (Object.keys(FIELD_ALIASES) as StandardField[]).forEach((field) => {
      const score = calculateMatchScore(normalizedHeader, FIELD_ALIASES[field]);
      
      if (score > 0) {
        if (!result[field]) result[field] = [];
        
        result[field]!.push({
          field,
          header,
          score,
          reason: generateReason(normalizedHeader, FIELD_ALIASES[field]),
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
  
  // 完全匹配（忽略下划线/连字符）
  const normalizedHeader = header.replace(/[_-]/g, "");
  for (const alias of aliases) {
    if (alias.replace(/[_-]/g, "") === normalizedHeader) {
      return 0.95;
    }
  }
  
  // 开头匹配
  for (const alias of aliases) {
    if (header.startsWith(alias)) return 0.9;
    if (alias.startsWith(header)) return 0.85;
  }
  
  // 包含匹配
  for (const alias of aliases) {
    if (header.includes(alias)) return 0.8;
    if (alias.includes(header)) return 0.75;
  }
  
  // 编辑距离相似度
  for (const alias of aliases) {
    const similarity = calculateSimilarity(header, alias);
    if (similarity > 0.8) return similarity * 0.7;
  }
  
  return 0;
}

/** 生成匹配原因 */
function generateReason(header: string, aliases: string[]): string {
  const normalizedHeader = header.replace(/[_-]/g, "");
  
  for (const alias of aliases) {
    if (alias === header) return "完全匹配";
    if (alias.replace(/[_-]/g, "") === normalizedHeader) {
      return "忽略分隔符后匹配";
    }
    if (header.includes(alias)) return `包含 "${alias}"`;
  }
  
  return "相似度匹配";
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
  
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

/** 获取最佳字段映射 */
export function getBestFieldMapping(
  inference: FieldInferenceResult,
): Partial<Record<StandardField, string>> {
  const mapping: Partial<Record<StandardField, string>> = {};
  
  (Object.keys(inference) as StandardField[]).forEach((field) => {
    const candidates = inference[field];
    if (candidates && candidates.length > 0) {
      // 使用最高分的候选
      mapping[field] = candidates[0].header;
    }
  });
  
  return mapping;
}

/** 检查是否所有必填字段都有映射 */
export function hasRequiredFields(
  mapping: Partial<Record<StandardField, string>>,
): boolean {
  const requiredFields: StandardField[] = [
    "hostname",
    "privateIp",
    "serviceName",
  ];
  return requiredFields.every((field) => !!mapping[field]);
}

/** 计算推断置信度 */
export function calculateInferenceConfidence(
  inference: FieldInferenceResult,
): number {
  const fields = Object.keys(inference) as StandardField[];
  if (fields.length === 0) return 0;
  
  const totalScore = fields.reduce((sum, field) => {
    const bestMatch = inference[field]?.[0];
    return sum + (bestMatch?.score ?? 0);
  }, 0);
  
  return totalScore / fields.length;
}
