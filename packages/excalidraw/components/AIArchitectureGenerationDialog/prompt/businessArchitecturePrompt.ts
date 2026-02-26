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
  topologySummary: string;
  mermaid: string;
  layers: BusinessArchitectureLayerSuggestion[];
}

export const buildBusinessArchitectureMessages = (
  scopeName: string,
  groups: ServiceGroup[],
  rows: NormalizedVmRow[],
  options?: {
    targetMode?: "panorama" | "focus";
    selectedScopeNames?: string[];
    detailLevel?: "service-level";
  },
) => {
  const targetMode = options?.targetMode ?? "panorama";
  const selectedScopeNames = options?.selectedScopeNames ?? [];
  const detailLevel = options?.detailLevel ?? "service-level";
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
        "- 默认输出全景视图，业务以 subgraph 分区组织\n" +
        "- 仅输出服务级节点，禁止实例级节点\n" +
        "- 每个业务保留 Top 3-5 个核心服务节点，避免过细\n" +
        "- 跨业务仅保留主路径，禁止输出密集双向细线\n" +
        "仅输出 JSON，不要输出额外文本。",
    },
    {
      role: "user" as const,
      content:
        `目标业务范围: ${scopeName}\n` +
        `目标模式: ${targetMode}\n` +
        `选择业务分区: ${selectedScopeNames.join(",") || "全部业务"}\n` +
        `细节粒度: ${detailLevel}\n` +
        "请输出 JSON，格式如下：\n" +
        '{"summary":"一句话概述","topologySummary":"主链路摘要","layers":[{"name":"层名","description":"层职责","rowIds":[1,2],"reason":"依据"}],"mermaid":"graph TD\\n..."}\n' +
        "约束：\n" +
        "1) layers 为合理分层名称，不强制固定三层\n" +
        "2) rowIds 必须来自输入数据\n" +
        "3) mermaid 必须可渲染\n" +
        "4) 每个 subgraph 必须以 end 结束\n" +
        "5) 业务聚焦模式下，非选中业务保留上下文但弱化细节\n" +
        `服务分组样本:\n${groupSummary || "[]"}\n` +
        `资产样本:\n${rowSummary || "[]"}`,
    },
  ];
};
