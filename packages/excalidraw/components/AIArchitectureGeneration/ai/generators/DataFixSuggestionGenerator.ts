/**
 * 数据修复建议生成器
 * AI自动识别数据质量问题并给出修复建议
 */

import { BaseAIGenerator } from "./base";
import type {
  AIResult,
  Issue,
  NormalizedVmRow,
  DataFixSuggestion,
} from "../../types";

/** 修复建议输入 */
interface FixSuggestionInput {
  issues: Issue[];
  rows: NormalizedVmRow[];
}

/** 修复建议输出 */
interface FixSuggestionOutput {
  suggestions: DataFixSuggestion[];
  summary: {
    total: number;
    autoApplicable: number;
    requiresReview: number;
  };
}

/** 数据修复建议生成器 */
export class DataFixSuggestionGenerator extends BaseAIGenerator<
  FixSuggestionInput,
  FixSuggestionOutput
> {
  readonly id = "data-fix-suggestion";
  readonly name = "数据修复建议生成器";
  
  async generate(
    input: FixSuggestionInput,
  ): Promise<AIResult<FixSuggestionOutput>> {
    return this.generateWithRetry(async () => {
      const suggestions = this.generateSuggestions(input.issues, input.rows);
      
      return {
        suggestions,
        summary: {
          total: suggestions.length,
          autoApplicable: suggestions.filter((s) => s.autoApplicable).length,
          requiresReview: suggestions.filter((s) => !s.autoApplicable).length,
        },
      };
    });
  }
  
  validateOutput(output: unknown): output is FixSuggestionOutput {
    if (typeof output !== "object" || output === null) return false;
    
    const obj = output as Record<string, unknown>;
    
    return (
      Array.isArray(obj.suggestions) &&
      typeof obj.summary === "object" &&
      obj.summary !== null
    );
  }
  
  /** 生成修复建议 */
  private generateSuggestions(
    issues: Issue[],
    rows: NormalizedVmRow[],
  ): DataFixSuggestion[] {
    const suggestions: DataFixSuggestion[] = [];
    
    for (const issue of issues) {
      const suggestion = this.createSuggestionForIssue(issue, rows);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }
    
    return suggestions;
  }
  
  /** 为特定问题创建建议 */
  private createSuggestionForIssue(
    issue: Issue,
    rows: NormalizedVmRow[],
  ): DataFixSuggestion | null {
    const row = rows.find((r) => r.rowId === issue.rowId);
    if (!row) return null;
    
    switch (issue.code) {
      case "invalid_ip":
        return this.suggestIpFix(issue, row);
        
      case "missing_required":
        return this.suggestMissingFieldFix(issue, row, rows);
        
      case "duplicate_hostname":
        return this.suggestDuplicateFix(issue, row, rows, "hostname");
        
      case "duplicate_ip":
        return this.suggestDuplicateFix(issue, row, rows, "privateIp");
        
      case "unknown_environment":
        return this.suggestEnvironmentFix(issue, row);
        
      default:
        return null;
    }
  }
  
  /** 建议IP修复 */
  private suggestIpFix(
    issue: Issue,
    row: NormalizedVmRow,
  ): DataFixSuggestion {
    const currentIp = row.vm.privateIp;
    let suggestedValue = currentIp;
    
    // 尝试常见修复
    if (currentIp.includes(",")) {
      // 可能是多个IP，取第一个
      suggestedValue = currentIp.split(",")[0].trim();
    } else if (currentIp.includes(" ")) {
      // 有空格
      suggestedValue = currentIp.split(" ")[0].trim();
    } else if (!currentIp.startsWith("10.") && !currentIp.startsWith("192.168.")) {
      // 可能不是内网IP，标记需要人工审核
      return {
        issueId: issue.id,
        suggestedValue: currentIp,
        reason: "IP格式不符合内网地址规范，请人工确认",
        confidence: 0.3,
        autoApplicable: false,
      };
    }
    
    const isValid = this.isValidIp(suggestedValue);
    
    return {
      issueId: issue.id,
      suggestedValue,
      reason: isValid
        ? "已自动清理IP格式"
        : "IP格式仍有问题，请人工确认",
      confidence: isValid ? 0.9 : 0.4,
      autoApplicable: isValid,
    };
  }
  
  /** 建议缺失字段修复 */
  private suggestMissingFieldFix(
    issue: Issue,
    row: NormalizedVmRow,
    allRows: NormalizedVmRow[],
  ): DataFixSuggestion | null {
    if (!issue.field) return null;
    
    // 尝试从其他字段推断
    if (issue.field === "environment") {
      // 从主机名推断环境
      const hostname = row.vm.hostname.toLowerCase();
      let env = "production";
      
      if (hostname.includes("dev") || hostname.includes("develop")) {
        env = "development";
      } else if (hostname.includes("test") || hostname.includes("qa")) {
        env = "testing";
      } else if (hostname.includes("staging") || hostname.includes("stg")) {
        env = "staging";
      }
      
      return {
        issueId: issue.id,
        suggestedValue: env,
        reason: `基于主机名 "${row.vm.hostname}" 推断环境`,
        confidence: 0.7,
        autoApplicable: true,
      };
    }
    
    if (issue.field === "serviceName") {
      // 从主机名推断服务名
      const hostname = row.vm.hostname;
      const parts = hostname.split("-");
      const suggestedName = parts.length > 1 ? parts[0] : "unknown-service";
      
      return {
        issueId: issue.id,
        suggestedValue: suggestedName,
        reason: `基于主机名 "${hostname}" 推断服务名`,
        confidence: 0.6,
        autoApplicable: false, // 需要确认
      };
    }
    
    return null;
  }
  
  /** 建议重复项修复 */
  private suggestDuplicateFix(
    issue: Issue,
    row: NormalizedVmRow,
    allRows: NormalizedVmRow[],
    field: "hostname" | "privateIp",
  ): DataFixSuggestion {
    const currentValue = row.vm[field];
    
    // 添加序号后缀
    const duplicates = allRows.filter(
      (r) => r.vm[field] === currentValue && r.rowId !== row.rowId,
    );
    
    const suffix = duplicates.length + 1;
    let suggestedValue: string;
    
    if (field === "hostname") {
      suggestedValue = `${currentValue}-${suffix}`;
    } else {
      // IP地址不能直接加后缀，需要人工处理
      return {
        issueId: issue.id,
        suggestedValue: currentValue,
        reason: "重复的IP地址需要人工确认和修正",
        confidence: 0.2,
        autoApplicable: false,
      };
    }
    
    return {
      issueId: issue.id,
      suggestedValue,
      reason: `添加序号后缀以区分重复项`,
      confidence: 0.8,
      autoApplicable: true,
    };
  }
  
  /** 建议环境修复 */
  private suggestEnvironmentFix(
    issue: Issue,
    row: NormalizedVmRow,
  ): DataFixSuggestion {
    const validEnvs = ["production", "staging", "testing", "development"];
    
    return {
      issueId: issue.id,
      suggestedValue: "production",
      reason: `未知环境值，建议设置为 production 或选择: ${validEnvs.join(", ")}`,
      confidence: 0.5,
      autoApplicable: false,
    };
  }
  
  /** 验证IP格式 */
  private isValidIp(ip: string): boolean {
    const parts = ip.split(".");
    if (parts.length !== 4) return false;
    
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255 && part === String(num);
    });
  }
}

/** 批量应用自动修复 */
export async function applyAutoFixes(
  issues: Issue[],
  rows: NormalizedVmRow[],
  onApply: (issueId: string, value: string) => void,
): Promise<{ applied: number; skipped: number }> {
  const generator = new DataFixSuggestionGenerator();
  
  const result = await generator.generate({ issues, rows });
  
  if (!result.success) {
    return { applied: 0, skipped: issues.length };
  }
  
  let applied = 0;
  let skipped = 0;
  
  for (const suggestion of result.data.suggestions) {
    if (suggestion.autoApplicable && suggestion.confidence > 0.7) {
      onApply(suggestion.issueId, suggestion.suggestedValue);
      applied++;
    } else {
      skipped++;
    }
  }
  
  return { applied, skipped };
}
