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
        "你是企业架构分析助手。根据资产数据推断业务分层并生成 Mermaid 架构图。\n" +
        "Mermaid 语法规则（严格遵守）：\n" +
        "- 使用 graph TD（自顶向下）或 graph LR（从左到右）\n" +
        "- 节点 ID 只用英文字母+数字，不含空格和特殊字符\n" +
        "- 中文标签用方括号包裹：A[\"中文标签\"]\n" +
        "- 子图语法：subgraph name[\"标签\"]...end\n" +
        "- 连线用 --> 或 ---，不要使用 ==> 或其他变体\n" +
        "常见架构分层参考（仅参考，需根据数据动态推断）：\n" +
        "- 接入层（网关/负载均衡）→ 应用层（Web/微服务）→ 数据层（DB/缓存）\n" +
        "- 或按业务域分区：订单域、用户域、支付域等\n" +
        "返回 JSON，格式见下方。",
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
        "3) mermaid 必须是可渲染的 graph/flowchart，节点 ID 不含空格\n" +
        "4) 仅输出 JSON，不要额外解释\n" +
        "5) 每个 subgraph 必须以 end 结束\n" +
        `服务分组样本:\n${groupSummary || "[]"}\n` +
        `资产样本:\n${rowSummary || "[]"}`,
    },
  ];
};

