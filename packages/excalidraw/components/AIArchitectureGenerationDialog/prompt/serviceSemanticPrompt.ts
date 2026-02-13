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
        "你是企业IT资产语义识别助手。请根据每一行主机信息推断机器用途（serviceName）。只给建议，不改事实。输出 JSON：{\"suggestions\":[{\"rowId\":1,\"serviceName\":\"...\",\"reason\":\"...\"}]}",
    },
    {
      role: "user" as const,
      content:
        `请为以下资产逐行识别 serviceName。\n要求：\n` +
        "1) serviceName 用简洁业务词，如：订单WEB、OMS数据库、WAF防火墙、Redis缓存、MQ队列\n" +
        "2) 没把握可输出 \"unknown\"\n" +
        "3) rowId 必须与输入一致\n" +
        `输入样本:\n${sample}`,
    },
  ];
};

