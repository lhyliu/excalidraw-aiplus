import type {
  ImportFieldMapping,
  ImportReadinessReport,
  RawAssetRow,
  RawAssetTable,
} from "../domain/types";

type CanonicalField = keyof ImportFieldMapping["fields"];

const ALIASES: Record<CanonicalField, readonly string[]> = {
  identity: ["asset_id", "resource_id", "instance_id", "id"],
  label: ["name", "hostname", "主机名", "名称"],
  resourceType: ["resource_type", "service_type", "type", "类型"],
  privateIp: ["private_ip", "内网ip"],
  publicIp: ["public_ip", "公网ip"],
  businessDomain: ["business_domain", "业务域"],
  application: ["application", "应用"],
  system: ["system", "系统"],
  environment: ["environment", "env", "环境"],
  provider: ["provider", "cloud", "云厂商"],
  region: ["region", "区域"],
  account: ["account", "账号"],
  cidr: ["cidr", "网段"],
  zone: ["zone", "availability_zone", "az", "可用区"],
  owner: ["owner", "负责人", "归属人"],
  vpc: ["vpc", "vpc_id"],
  subnet: ["subnet", "subnet_id"],
  securityGroup: ["security_group", "security_group_id", "sg", "安全组"],
  gateway: ["gateway", "gateway_id", "网关"],
  loadBalancer: ["load_balancer", "load_balancer_id", "lb", "负载均衡"],
  tags: ["tags", "tag", "标签"],
  risk: ["risk", "风险"],
  criticality: ["criticality", "importance", "重要性"],
  costCenter: ["cost_center", "cost centre", "成本中心"],
  description: ["description", "desc", "描述"],
  dependsOn: ["depends_on"],
  connectsTo: ["connects_to"],
  calls: ["calls"],
};

const normalizeHeader = (header: string) => header.trim().toLowerCase();

const hasValue = (row: RawAssetRow, header?: string) =>
  Boolean(header && row.cells[header]?.trim());

export const mapImportFields = (headers: string[]): ImportFieldMapping => {
  const normalizedHeaders = new Map(
    headers.map((header) => [normalizeHeader(header), header]),
  );
  const fields: Partial<Record<CanonicalField, string>> = {};

  for (const [field, aliases] of Object.entries(ALIASES) as Array<
    [CanonicalField, readonly string[]]
  >) {
    for (const alias of aliases) {
      const header = normalizedHeaders.get(normalizeHeader(alias));
      if (header) {
        fields[field] = header;
        break;
      }
    }
  }
  fields.identity ??= fields.label;

  const mapped = new Set(Object.values(fields));

  return {
    fields,
    unmappedHeaders: headers.filter((header) => !mapped.has(header)),
  };
};

export const scoreImportReadiness = (
  table: RawAssetTable,
  mapping: ImportFieldMapping,
): ImportReadinessReport => {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const { fields } = mapping;

  if (!fields.identity) {
    blockingIssues.push("identity field is not mapped");
  }
  if (!fields.label) {
    blockingIssues.push("label field is not mapped");
  }
  if (!fields.resourceType) {
    warnings.push("resource type field is not mapped");
  }
  if (!fields.environment) {
    warnings.push("environment field is not mapped");
  }

  const totalRows = table.rows.length;
  const fullRows = table.rows.filter(
    (row) =>
      hasValue(row, fields.identity) &&
      hasValue(row, fields.label) &&
      hasValue(row, fields.resourceType) &&
      hasValue(row, fields.environment),
  ).length;
  const partialRows = table.rows.filter(
    (row) =>
      hasValue(row, fields.identity) &&
      hasValue(row, fields.label) &&
      (hasValue(row, fields.resourceType) || hasValue(row, fields.environment)),
  ).length;
  const fullRatio = totalRows === 0 ? 0 : fullRows / totalRows;
  const partialRatio = totalRows === 0 ? 0 : partialRows / totalRows;
  const level =
    blockingIssues.length === 0 && fullRatio >= 2 / 3
      ? "high"
      : blockingIssues.length === 0 && partialRatio >= 2 / 3
        ? "medium"
        : "low";

  return {
    level,
    resolvedRows: level === "high" ? fullRows : partialRows,
    totalRows,
    blockingIssues,
    warnings,
  };
};
