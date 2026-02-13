/**
 * 架构图生成提示词模板
 */

import type { DiagramStyle, ServiceGroup, NormalizedVmRow } from "../../types";

/** 架构图提示词参数 */
interface ArchitectureDiagramPromptParams {
  serviceGroups: ServiceGroup[];
  normalizedRows: NormalizedVmRow[];
  style: DiagramStyle;
  includeDetails: boolean;
}

/** 生成架构图提示词 */
export function generateArchitectureDiagramPrompt(
  params: ArchitectureDiagramPromptParams,
): string {
  const { serviceGroups, normalizedRows, style, includeDetails } = params;
  
  const styleDescriptions: Record<DiagramStyle, string> = {
    microservices: "微服务架构 - 展示独立的服务单元及其关系",
    monolith: "单体架构 - 展示整体应用结构",
    layered: "分层架构 - 按层级组织组件",
    network: "网络拓扑 - 展示服务器和网络连接",
  };
  
  const serviceDescriptions = serviceGroups
    .map((group) => {
      const rows = normalizedRows.filter((r) =>
        group.rowIds.includes(r.rowId),
      );
      const envs = [...new Set(rows.map((r) => r.vm.environment).filter(Boolean))];
      const clusters = [...new Set(rows.map((r) => r.vm.cluster).filter(Boolean))];
      
      return `- ${group.name}: ${rows.length} 台服务器` +
        (includeDetails 
          ? `, 环境: ${envs.join(", ") || "未知"}, 集群: ${clusters.join(", ") || "未知"}` 
          : "");
    })
    .join("\n");
  
  return `作为IT架构师，请根据以下服务器清单生成 ${style} 架构图。

## 架构风格
${styleDescriptions[style]}

## 服务分组
${serviceDescriptions}

## 要求
1. 使用 Mermaid 语法
2. ${includeDetails ? "包含详细的服务器IP和配置信息" : "仅展示服务分组关系"}
3. 清晰展示组件之间的关系
4. 添加适当的注释说明

请直接输出 Mermaid 代码块。`;
}

/** 生成微服务架构特定提示词 */
export function generateMicroservicesPrompt(
  serviceGroups: ServiceGroup[],
): string {
  return `设计微服务架构图，包含以下服务：

${serviceGroups.map((g) => `- ${g.name}: ${g.rowIds.length} 实例`).join("\n")}

要求：
1. 使用 Mermaid graph TD 语法
2. 区分 API 网关、服务、数据库
3. 展示服务间依赖关系
4. 使用 subgraph 组织相关服务`;
}
