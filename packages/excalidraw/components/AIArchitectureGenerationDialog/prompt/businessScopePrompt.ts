import type {
  NormalizedVmRow,
  ServiceGroup,
} from "../../AIArchitectureGeneration";

export interface BusinessScopeSuggestionItem {
  name: string;
  groupIds: string[];
  reason: string;
}

export interface BusinessScopeSuggestion {
  scopes: BusinessScopeSuggestionItem[];
}

export const buildBusinessScopeMessages = (
  groups: ServiceGroup[],
  rows: NormalizedVmRow[],
) => {
  const groupSummary = groups
    .map((group) =>
      JSON.stringify({
        id: group.id,
        name: group.name,
        confidence: Number(group.confidence.toFixed(2)),
        rowIds: group.rowIds.slice(0, 30),
        reason: group.reason,
      }),
    )
    .join("\n");
  const rowSummary = rows
    .slice(0, 160)
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
        "你是企业 IT 资产分析助手。任务是按业务范围归并服务分组。只输出 JSON，不输出额外说明。",
    },
    {
      role: "user" as const,
      content:
        "请将输入的服务分组归并为业务范围，用于后续按范围生成架构图。\n" +
        "输出 JSON 格式：\n" +
        '{"scopes":[{"name":"业务范围名称","groupIds":["group-0","group-1"],"reason":"归类依据"}]}\n' +
        "约束：\n" +
        "1) groupIds 必须来自输入分组 id\n" +
        "2) 每个分组至少归属到一个 scope\n" +
        "3) scope 名称应是业务语义\n" +
        "4) 允许将共享基础能力单独归为一个 scope（例如中间件平台、共享网关）\n" +
        `服务分组输入:\n${groupSummary || "[]"}\n` +
        `资产样本:\n${rowSummary || "[]"}`,
    },
  ];
};
