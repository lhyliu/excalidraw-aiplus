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
        "你是企业架构分析助手。请根据资产与分组数据推断业务分层并生成 Mermaid 架构图。\n" +
        "Mermaid 规则（必须遵守）：\n" +
        "- 使用 graph TD 或 graph LR\n" +
        "- 节点 ID 仅用英文和数字，不包含空格和特殊字符\n" +
        "- 中文标签放在方括号中，例如 A[\"中文标签\"]\n" +
        "- 子图语法：subgraph name[\"标签\"] ... end\n" +
        "- 连线使用 --> 或 ---\n" +
        "仅输出 JSON，不要输出额外文本。",
    },
    {
      role: "user" as const,
      content:
        `目标业务范围: ${scopeName}\n` +
        "请输出 JSON，格式如下：\n" +
        '{"summary":"一句话概述","layers":[{"name":"层名","description":"层职责","rowIds":[1,2],"reason":"依据"}],"mermaid":"graph TD\\n..."}\n' +
        "约束：\n" +
        "1) layers 为合理分层名称，不强制固定三层\n" +
        "2) rowIds 必须来自输入数据\n" +
        "3) mermaid 必须可渲染\n" +
        "4) 每个 subgraph 必须以 end 结束\n" +
        `服务分组样本:\n${groupSummary || "[]"}\n` +
        `资产样本:\n${rowSummary || "[]"}`,
    },
  ];
};
