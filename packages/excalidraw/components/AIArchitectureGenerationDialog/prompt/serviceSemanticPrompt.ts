export interface ServiceSemanticContextRow {
  rowId: number;
  hostname: string;
  privateIp: string;
  environment: string;
  cpuCores: number | null;
  memoryGb: number | null;
  raw: Record<string, string>;
}

export const buildServiceSemanticMessages = (
  rows: ServiceSemanticContextRow[],
) => {
  const sample = rows
    .slice(0, 80)
    .map((row) =>
      JSON.stringify({
        rowId: row.rowId,
        hostname: row.hostname,
        privateIp: row.privateIp,
        environment: row.environment,
        cpuCores: row.cpuCores,
        memoryGb: row.memoryGb,
        raw: row.raw,
      }),
    )
    .join("\n");

  return [
    {
      role: "system" as const,
      content:
        "你是企业 IT 资产语义识别助手。请根据每一行主机信息推断机器用途（serviceName）。只输出建议，不改事实。输出严格 JSON：{\"suggestions\":[{\"rowId\":1,\"serviceName\":\"...\",\"reason\":\"...\"}]}",
    },
    {
      role: "user" as const,
      content:
        `请为以下资产逐行识别 serviceName。\n要求：\n` +
        "1) serviceName 使用简洁、可落地的组件/用途名，例如：业务应用服务器、MySQL数据库、WAF防火墙、Redis缓存、消息队列\n" +
        "2) 可综合 hostname、IP 段、环境、CPU、内存、原始字段语义做判断\n" +
        "3) 若无法判断可输出 \"unknown\"，但优先给出最可能候选\n" +
        "4) rowId 必须与输入一致，每行都返回一条 suggestions 项\n" +
        "5) 只输出 JSON，不要输出额外说明\n" +
        `输入样本:\n${sample}`,
    },
  ];
};
