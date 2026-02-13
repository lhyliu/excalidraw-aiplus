/**
 * 服务命名建议提示词模板
 */

import type { NamingContext } from "../../types";

/** 服务命名提示词参数 */
interface ServiceNamingPromptParams {
  context: NamingContext;
  count: number;
}

/** 生成服务命名提示词 */
export function generateServiceNamingPrompt(
  params: ServiceNamingPromptParams,
): string {
  const { context, count } = params;
  
  return `你是一个专业的架构师，擅长为IT基础架构资源命名。

请为以下服务分组生成 ${count} 个命名建议：

## 服务信息
- 当前名称: ${context.serviceGroup.name}
- 包含服务器: ${context.serviceGroup.rowIds.length} 台
- 环境: ${context.environment || "未指定"}
- 集群: ${context.cluster || "未指定"}

## 命名规范
1. 使用小写字母和连字符(-)
2. 体现服务功能和部署环境
3. 保持简洁（建议2-4个词）
4. 避免使用特殊字符

## 相关服务参考
${context.relatedServices.length > 0 
  ? context.relatedServices.join("\n") 
  : "无相关服务"}

请生成 ${count} 个命名建议，按推荐程度排序。每个建议请简要说明理由。

格式要求：
1. [建议名称] - [理由]
2. [建议名称] - [理由]
...`;
}

/** 生成批量命名提示词 */
export function generateBatchNamingPrompt(
  contexts: NamingContext[],
): string {
  const servicesList = contexts
    .map((ctx, idx) => 
      `${idx + 1}. ${ctx.serviceGroup.name} (${ctx.environment || "未知环境"}, ${ctx.cluster || "未知集群"})`,
    )
    .join("\n");
  
  return `作为架构师，请为以下服务分组批量生成命名建议：

## 服务列表
${servicesList}

## 命名规范
1. 使用小写字母和连字符(-)
2. 格式: [服务名]-[环境]-[集群]
3. 保持命名一致性

请为每个服务提供 3 个命名建议。`;
}
