/**
 * 服务命名建议生成器
 * 基于上下文生成更准确的服务命名建议
 */

import { BaseAIGenerator } from "./base";
import type { AIResult, NamingContext, ServiceGroup } from "../../types";

/** 命名建议输入 */
interface NamingInput {
  context: NamingContext;
  count?: number;
}

/** 命名建议输出 */
interface NamingOutput {
  suggestions: string[];
  reasoning: string;
}

/** 服务命名建议生成器 */
export class ServiceNamingGenerator extends BaseAIGenerator<
  NamingInput,
  NamingOutput
> {
  readonly id = "service-naming";
  readonly name = "服务命名建议生成器";
  
  async generate(input: NamingInput): Promise<AIResult<NamingOutput>> {
    return this.generateWithRetry(async () => {
      const suggestions = this.generateSuggestions(input.context, input.count ?? 3);
      
      return {
        suggestions,
        reasoning: this.generateReasoning(input.context),
      };
    });
  }
  
  validateOutput(output: unknown): output is NamingOutput {
    if (typeof output !== "object" || output === null) return false;
    
    const obj = output as Record<string, unknown>;
    
    return (
      Array.isArray(obj.suggestions) &&
      obj.suggestions.every((s) => typeof s === "string") &&
      typeof obj.reasoning === "string"
    );
  }
  
  /** 生成命名建议 */
  private generateSuggestions(
    context: NamingContext,
    count: number,
  ): string[] {
    const { serviceGroup, environment, cluster } = context;
    const baseName = this.sanitizeName(serviceGroup.name);
    
    const suggestions: string[] = [];
    
    // 基于环境生成
    if (environment) {
      suggestions.push(`${baseName}-${environment.toLowerCase()}`);
    }
    
    // 基于集群生成
    if (cluster) {
      suggestions.push(`${baseName}-${cluster.toLowerCase()}`);
    }
    
    // 组合环境+集群
    if (environment && cluster) {
      suggestions.push(
        `${baseName}-${environment.toLowerCase()}-${cluster.toLowerCase()}`,
      );
    }
    
    // 添加序号变体
    if (suggestions.length < count) {
      suggestions.push(`${baseName}-svc`);
    }
    
    if (suggestions.length < count) {
      suggestions.push(`${baseName}-service`);
    }
    
    // 去重并限制数量
    return [...new Set(suggestions)].slice(0, count);
  }
  
  /** 生成推理说明 */
  private generateReasoning(context: NamingContext): string {
    const parts: string[] = [];
    
    if (context.environment) {
      parts.push(`环境: ${context.environment}`);
    }
    
    if (context.cluster) {
      parts.push(`集群: ${context.cluster}`);
    }
    
    if (context.relatedServices.length > 0) {
      parts.push(`相关服务: ${context.relatedServices.join(", ")}`);
    }
    
    return parts.length > 0
      ? `基于${parts.join("，")}生成命名建议`
      : "基于服务分组名称生成命名建议";
  }
  
  /** 清理名称 */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
}

/** 批量生成命名建议 */
export async function generateBatchNamingSuggestions(
  groups: ServiceGroup[],
  getContext: (group: ServiceGroup) => NamingContext,
): Promise<Record<string, string[]>> {
  const generator = new ServiceNamingGenerator();
  const results: Record<string, string[]> = {};
  
  for (const group of groups) {
    const result = await generator.generate({
      context: getContext(group),
      count: 3,
    });
    
    if (result.success) {
      results[group.id] = result.data.suggestions;
    }
  }
  
  return results;
}
