import type { StandardField } from "../../AIArchitectureGeneration";

const fieldBusinessLabel: Record<StandardField, string> = {
  hostname: "主机名",
  privateIp: "内网IP",
  serviceName: "服务名称/机器用途",
  environment: "部署环境",
  cpuCores: "CPU核数",
  memoryGb: "内存(GB)",
  cluster: "集群",
  region: "地域/资源池",
};

export const buildFieldMappingSuggestionMessages = (
  field: StandardField,
  headers: string[],
  sampleRows: Record<string, string>[],
) => {
  const sample = sampleRows
    .slice(0, 6)
    .map((row, index) => `row${index + 1}: ${JSON.stringify(row)}`)
    .join("\n");

  return [
    {
      role: "system" as const,
      content:
        "你是企业资产表格识别助手。根据列名和样本数据，将 CSV 列映射到标准字段。\n" +
        "常见列名别名（仅供参考）：\n" +
        "- hostname: Host, 主机名, HostName, server_name, 机器名\n" +
        "- privateIp: IP, 内网IP, ip_address, InternalIP, PrivateIP\n" +
        "- serviceName: Service, 服务, AppName, 用途, ServiceCode, 应用名\n" +
        "- environment: Env, 环境, Environment, env_name, 部署环境\n" +
        "- cluster: Cluster, 集群, cluster_name, 集群名称\n" +
        "- region: Region, 地域, zone, 资源池, AZ, DataCenter\n" +
        "输出 JSON: {\"header\":\"...\",\"reason\":\"...\"}。header 必须来自候选列。",
    },
    {
      role: "user" as const,
      content: `请在候选列中为目标字段选择最可能的列名。\n目标字段: ${field} (${fieldBusinessLabel[field]})\n候选列: ${headers.join(", ")}\n样本行:\n${sample}\n要求:\n1) header 必须来自候选列，无法判断则返回空字符串\n2) reason 用一句话说明依据\n3) 不要输出额外文本`,
    },
  ];
};

