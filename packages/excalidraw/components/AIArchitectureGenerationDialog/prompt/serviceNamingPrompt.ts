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
        "你是企业架构命名助手。根据主机名、IP、端口等上下文识别服务用途并给出规范命名。\n" +
        "命名规则：\n" +
        "- 采用 kebab-case（小写+连字符），如 order-api, user-db, gateway-nginx\n" +
        "- 包含业务语义 + 技术角色，如：payment-redis, oms-mysql-master\n" +
        "- 避免无意义后缀如 -svc, -service\n" +
        "输出 JSON: {\"suggestions\":[\"name1\",\"name2\",\"name3\"]}\n" +
        "示例：\n" +
        "输入: hostname=ord-web-01, Service=order, Env=prod\n" +
        "输出: {\"suggestions\":[\"order-web\",\"order-api-gateway\",\"order-frontend\"]}",
    },
    {
      role: "user" as const,
      content: `为以下服务分组提供 2-4 个命名建议。\n分组名:${group.name}\n置信度:${group.confidence}\n样本:\n${sample}`,
    },
  ];
};


