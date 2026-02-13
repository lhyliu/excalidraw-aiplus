import type {
  NormalizedVmRow,
  ServiceGroup,
} from "../../AIArchitectureGeneration";

export interface BusinessArchitectureLayerSuggestion {
  name: string;
  description: string;
  rowIds: number[];
  reason: string;
}

export interface BusinessArchitectureSuggestion {
  summary: string;
  mermaid: string;
  layers: BusinessArchitectureLayerSuggestion[];
}

export const buildBusinessArchitectureMessages = (
  scopeName: string,
  groups: ServiceGroup[],
  rows: NormalizedVmRow[],
) => {
  const groupSummary = groups
    .map((group) =>
      JSON.stringify({
        id: group.id,
        name: group.name,
        confidence: Number(group.confidence.toFixed(2)),
        rowIds: group.rowIds.slice(0, 20),
        reason: group.reason,
      }),
    )
    .join("\n");
  const rowSummary = rows
    .slice(0, 120)
    .map((row) =>
      JSON.stringify({
        rowId: row.rowId,
        hostname: row.vm.hostname,
        privateIp: row.vm.privateIp,
        serviceName: row.vm.serviceName,
        environment: row.vm.environment,
        cluster: row.vm.cluster,
        region: row.vm.region,
      }),
    )
    .join("\n");

  return [
    {
      role: "system" as const,
      content:
        "你是企业架构分析助手。请基于资产数据推断业务分层并输出 Mermaid 架构图。分层名称必须动态推断，不要固定模板。返回 JSON。",
    },
    {
      role: "user" as const,
      content:
        `目标业务范围: ${scopeName}\n` +
        "请输出 JSON，格式如下：\n" +
        '{"summary":"一句话概述","layers":[{"name":"层名","description":"层职责","rowIds":[1,2],"reason":"依据"}],"mermaid":"graph TD\\n..."}\n' +
        "约束：\n" +
        "1) layers 可为任意合理层级名称，不得硬编码为固定三层\n" +
        "2) rowIds 必须来自输入数据\n" +
        "3) mermaid 必须是可渲染的 graph/flowchart\n" +
        "4) 仅输出 JSON，不要额外解释\n" +
        `服务分组样本:\n${groupSummary || "[]"}\n` +
        `资产样本:\n${rowSummary || "[]"}`,
    },
  ];
};

