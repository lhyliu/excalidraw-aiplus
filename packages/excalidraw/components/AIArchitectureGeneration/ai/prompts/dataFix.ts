/**
 * 数据修复建议提示词模板
 */

import type { Issue, NormalizedVmRow } from "../../types";

/** 数据修复提示词参数 */
interface DataFixPromptParams {
  issues: Issue[];
  rows: NormalizedVmRow[];
}

/** 生成数据修复提示词 */
export function generateDataFixPrompt(params: DataFixPromptParams): string {
  const { issues, rows } = params;
  
  const issueDescriptions = issues.map((issue) => {
    const row = rows.find((r) => r.rowId === issue.rowId);
    const rowInfo = row 
      ? `(${row.vm.hostname || "无主机名"}, ${row.vm.privateIp || "无IP"})` 
      : "";
    
    return `- [${issue.severity.toUpperCase()}] 行 ${issue.rowId + 1} ${rowInfo}: ${issue.message}` +
      (issue.suggestedValue ? ` -> 建议: ${issue.suggestedValue}` : "");
  }).join("\n");
  
  return `作为数据质量专家，请分析以下数据问题并提供修复建议：

## 发现的问题
${issueDescriptions}

## 修复要求
1. 对于每个问题，提供具体的修复建议
2. 标注哪些修复可以自动应用
3. 标注哪些修复需要人工确认
4. 解释修复的理由

请按以下格式输出：
1. [问题ID] - [修复建议] - [自动/人工] - [理由]
2. ...`;
}

/** 生成批量修复提示词 */
export function generateBatchFixPrompt(issues: Issue[]): string {
  const groupedByCode = issues.reduce((acc, issue) => {
    if (!acc[issue.code]) acc[issue.code] = [];
    acc[issue.code].push(issue);
    return acc;
  }, {} as Record<string, Issue[]>);
  
  const summary = Object.entries(groupedByCode)
    .map(([code, items]) => `- ${code}: ${items.length} 个`)
    .join("\n");
  
  return `分析数据质量问题并提供批量修复方案：

## 问题统计
${summary}

## 要求
1. 为每种问题类型提供通用修复策略
2. 提供正则表达式或规则（如适用）
3. 说明批量修复的风险和注意事项`;
}
