import type {
  NormalizedVmRow,
  ServiceGroup,
} from "../../AIArchitectureGeneration";

export const buildServiceNamingMessages = (
  group: ServiceGroup,
  rows: NormalizedVmRow[],
) => {
  const sample = rows
    .filter((row) => group.rowIds.includes(row.rowId))
    .slice(0, 6)
    .map(
      (row) =>
        `row=${row.rowId},hostname=${row.vm.hostname},serviceName=${row.vm.serviceName},env=${row.vm.environment},cluster=${row.vm.cluster},region=${row.vm.region}`,
    )
    .join("\n");

  return [
    {
      role: "system" as const,
      content:
        "你是企业架构命名助手。只给出服务命名建议，不能修改事实数据。输出 JSON: {\"suggestions\":[\"name1\",\"name2\"]}",
    },
    {
      role: "user" as const,
      content: `为以下服务分组提供 2-4 个命名建议。\n分组名:${group.name}\n置信度:${group.confidence}\n样本:\n${sample}`,
    },
  ];
};


