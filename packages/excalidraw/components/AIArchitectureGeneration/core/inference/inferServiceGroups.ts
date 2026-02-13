/**
 * 服务分组推断功能
 * 从原 importWorkflow/inferServiceGroups.ts 迁移
 */

import type { ServiceGroup, NormalizedVmRow } from "../../types";

/** 分组选项 */
export interface GroupingOptions {
  strategy?: "serviceName" | "hostname" | "cluster" | "environment";
  minGroupSize?: number;
  maxGroups?: number;
}

/** 推断服务分组 */
export function inferServiceGroups(
  rows: NormalizedVmRow[],
  options: GroupingOptions = {},
): ServiceGroup[] {
  const { strategy = "serviceName", minGroupSize = 1 } = options;
  
  // 按策略分组
  const groups = new Map<string, number[]>();
  
  rows.forEach((row) => {
    let key: string;
    
    switch (strategy) {
      case "hostname":
        key = extractServiceFromHostname(row.vm.hostname);
        break;
      case "cluster":
        key = row.vm.cluster || "default";
        break;
      case "environment":
        key = row.vm.environment || "unknown";
        break;
      case "serviceName":
      default:
        key = row.vm.serviceName || "unknown";
        break;
    }
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row.rowId);
  });
  
  // 过滤小分组并转换为ServiceGroup
  let groupId = 0;
  const result: ServiceGroup[] = [];
  
  groups.forEach((rowIds, name) => {
    if (rowIds.length >= minGroupSize) {
      result.push({
        id: `group-${groupId}`,
        name,
        rowIds,
        confidence: calculateGroupConfidence(rowIds, rows, strategy),
        reason: generateGroupReason(name, rowIds.length, strategy),
      });
      groupId++;
    }
  });
  
  // 按大小排序
  result.sort((a, b) => b.rowIds.length - a.rowIds.length);
  
  return result;
}

/** 从主机名提取服务名 */
function extractServiceFromHostname(hostname: string): string {
  if (!hostname) return "unknown";
  
  const parts = hostname.toLowerCase().split(/[-.]/);
  
  // 移除常见的环境/序号后缀
  const envKeywords = ["prod", "dev", "test", "stg", "qa", "01", "02", "03"];
  const filtered = parts.filter((part) => 
    part && !envKeywords.some((kw) => part.includes(kw)),
  );
  
  if (filtered.length > 0) {
    return filtered[0];
  }
  
  return parts[0] || "unknown";
}

/** 计算分组置信度 */
function calculateGroupConfidence(
  rowIds: number[],
  allRows: NormalizedVmRow[],
  strategy: string,
): number {
  const groupRows = allRows.filter((r) => rowIds.includes(r.rowId));
  
  if (groupRows.length === 0) return 0;
  
  let confidence = 0.8; // 基础置信度
  
  // 如果所有行的服务名都一致，提高置信度
  const serviceNames = new Set(groupRows.map((r) => r.vm.serviceName));
  if (serviceNames.size === 1 && !serviceNames.has("unknown")) {
    confidence += 0.1;
  }
  
  // 如果环境一致，提高置信度
  const environments = new Set(groupRows.map((r) => r.vm.environment));
  if (environments.size === 1) {
    confidence += 0.05;
  }
  
  // 如果集群一致，提高置信度
  const clusters = new Set(groupRows.map((r) => r.vm.cluster));
  if (clusters.size === 1) {
    confidence += 0.05;
  }
  
  return Math.min(confidence, 1.0);
}

/** 生成分组原因 */
function generateGroupReason(
  name: string,
  count: number,
  strategy: string,
): string {
  const strategyLabels: Record<string, string> = {
    serviceName: "服务名称",
    hostname: "主机名前缀",
    cluster: "所属集群",
    environment: "部署环境",
  };
  
  return `基于${strategyLabels[strategy] || strategy} "${name}" 分组，共 ${count} 台服务器`;
}

/** 合并相似分组 */
export function mergeSimilarGroups(
  groups: ServiceGroup[],
  similarityThreshold = 0.8,
): ServiceGroup[] {
  if (groups.length < 2) return groups;
  
  const merged: ServiceGroup[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < groups.length; i++) {
    if (used.has(i)) continue;
    
    const group = groups[i];
    const toMerge: ServiceGroup[] = [group];
    
    for (let j = i + 1; j < groups.length; j++) {
      if (used.has(j)) continue;
      
      const other = groups[j];
      const similarity = calculateNameSimilarity(group.name, other.name);
      
      if (similarity >= similarityThreshold) {
        toMerge.push(other);
        used.add(j);
      }
    }
    
    if (toMerge.length === 1) {
      merged.push(group);
    } else {
      // 合并分组
      merged.push({
        id: group.id,
        name: group.name,
        rowIds: toMerge.flatMap((g) => g.rowIds),
        confidence: Math.min(...toMerge.map((g) => g.confidence)),
        reason: `合并相似分组: ${toMerge.map((g) => g.name).join(", ")}`,
      });
    }
    
    used.add(i);
  }
  
  return merged;
}

/** 计算名称相似度 */
function calculateNameSimilarity(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  
  // 完全匹配
  if (la === lb) return 1.0;
  
  // 一个是另一个的子串
  if (la.includes(lb) || lb.includes(la)) return 0.9;
  
  // 计算编辑距离
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(la, lb);
  return 1 - distance / maxLen;
}

/** Levenshtein距离 */
function levenshteinDistance(a: string, b: string): number {
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
  
  return matrix[b.length][a.length];
}
