import type {
  DataQualityIssue,
  ImportFieldMapping,
  NormalizationResult,
  NormalizedAsset,
  RawAssetRow,
  RawAssetTable,
} from "../domain/types";

const ENVIRONMENT_ALIASES = new Map([
  ["prod", "prod"],
  ["production", "prod"],
  ["生产", "prod"],
  ["prd", "prod"],
  ["dev", "dev"],
  ["development", "dev"],
  ["开发", "dev"],
  ["test", "test"],
  ["testing", "test"],
  ["测试", "test"],
  ["staging", "staging"],
  ["stage", "staging"],
  ["预发", "staging"],
]);

const PROVIDER_ALIASES = new Map([
  ["aliyun", "aliyun"],
  ["alibaba cloud", "aliyun"],
  ["阿里云", "aliyun"],
  ["aws", "aws"],
  ["amazon web services", "aws"],
  ["azure", "azure"],
  ["microsoft azure", "azure"],
  ["gcp", "gcp"],
  ["google cloud", "gcp"],
  ["tencent", "tencent"],
  ["tencent cloud", "tencent"],
  ["腾讯云", "tencent"],
  ["huawei", "huawei"],
  ["huawei cloud", "huawei"],
  ["华为云", "huawei"],
]);

const value = (
  row: RawAssetRow,
  fields: ImportFieldMapping["fields"],
  field: keyof ImportFieldMapping["fields"],
) => {
  const header = fields[field];

  return header ? row.cells[header]?.trim() ?? "" : "";
};

const normalizeAlias = (input: string, aliases: Map<string, string>) =>
  aliases.get(input.trim().toLowerCase()) ?? input.trim();

const parseList = (input: string) =>
  input
    .split(/[,;，；\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const isValidIp = (input: string) => {
  const parts = input.split(".");

  return (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^\d+$/.test(part)) {
        return false;
      }
      const number = Number(part);

      return number >= 0 && number <= 255 && String(number) === part;
    })
  );
};

const isValidCidr = (input: string) => {
  const parts = input.split("/");
  if (parts.length !== 2) {
    return false;
  }
  const [ip, prefix] = parts;
  const prefixNumber = Number(prefix);

  return (
    isValidIp(ip) &&
    /^\d+$/.test(prefix ?? "") &&
    prefixNumber >= 0 &&
    prefixNumber <= 32
  );
};

const collectIps = (
  row: RawAssetRow,
  field: string | undefined,
  kind: "privateIps" | "publicIps",
  issues: DataQualityIssue[],
) => {
  const raw = field ? row.cells[field]?.trim() ?? "" : "";
  const values = parseList(raw);
  const valid: string[] = [];

  for (const ip of values) {
    if (isValidIp(ip)) {
      valid.push(ip);
    } else {
      issues.push({
        kind: "invalid_ip",
        severity: "warning",
        message: `Invalid ${kind === "privateIps" ? "private" : "public"} IP`,
        rowId: row.rowId,
        field,
        value: ip,
      });
    }
  }

  return valid;
};

const collectCidrs = (
  row: RawAssetRow,
  field: string | undefined,
  issues: DataQualityIssue[],
) => {
  const raw = field ? row.cells[field]?.trim() ?? "" : "";
  const values = parseList(raw);
  const valid: string[] = [];

  for (const cidr of values) {
    if (isValidCidr(cidr)) {
      valid.push(cidr);
    } else {
      issues.push({
        kind: "invalid_cidr",
        severity: "warning",
        message: "Invalid CIDR",
        rowId: row.rowId,
        field,
        value: cidr,
      });
    }
  }

  return valid;
};

const optional = (input: string) => input || undefined;

const parseTags = (input: string) => {
  const tags: Record<string, string> = {};

  for (const segment of parseList(input)) {
    const separatorIndex = segment.search(/[=:：]/);
    if (separatorIndex === -1) {
      tags[segment] = "true";
      continue;
    }

    const key = segment.slice(0, separatorIndex).trim();
    const tagValue = segment.slice(separatorIndex + 1).trim();
    if (key) {
      tags[key] = tagValue || "true";
    }
  }

  return tags;
};

const addTag = (
  tags: Record<string, string>,
  key: string,
  tagValue: string,
) => {
  if (tagValue) {
    tags[key] = tagValue;
  }
};

const collectTags = (
  row: RawAssetRow,
  fields: ImportFieldMapping["fields"],
) => {
  const tags = parseTags(value(row, fields, "tags"));

  addTag(tags, "owner", value(row, fields, "owner"));
  addTag(tags, "zone", value(row, fields, "zone"));
  addTag(tags, "vpc", value(row, fields, "vpc"));
  addTag(tags, "subnet", value(row, fields, "subnet"));
  addTag(tags, "securityGroup", value(row, fields, "securityGroup"));
  addTag(tags, "gateway", value(row, fields, "gateway"));
  addTag(tags, "loadBalancer", value(row, fields, "loadBalancer"));
  addTag(tags, "risk", value(row, fields, "risk"));
  addTag(tags, "criticality", value(row, fields, "criticality"));
  addTag(tags, "costCenter", value(row, fields, "costCenter"));
  addTag(tags, "description", value(row, fields, "description"));

  return tags;
};

export const normalizeAssets = (
  table: RawAssetTable,
  mapping: ImportFieldMapping,
): NormalizationResult => {
  const issues: DataQualityIssue[] = [];
  const assets: NormalizedAsset[] = [];
  const seenIdentities = new Set<string>();
  const { fields } = mapping;

  for (const row of table.rows) {
    const identity = value(row, fields, "identity");
    const label = value(row, fields, "label");

    if (!identity) {
      issues.push({
        kind: "missing_identity",
        severity: "error",
        message: "Missing identity",
        rowId: row.rowId,
        field: fields.identity,
      });
    }
    if (!label) {
      issues.push({
        kind: "missing_label",
        severity: "error",
        message: "Missing label",
        rowId: row.rowId,
        field: fields.label,
      });
    }
    if (identity && seenIdentities.has(identity)) {
      issues.push({
        kind: "duplicate_identity",
        severity: "warning",
        message: `Duplicate identity: ${identity}`,
        rowId: row.rowId,
        field: fields.identity,
        value: identity,
      });
    }
    if (identity) {
      seenIdentities.add(identity);
    }

    assets.push({
      rowId: row.rowId,
      identity: identity || row.rowId,
      label: label || identity || row.rowId,
      resourceType: optional(value(row, fields, "resourceType")),
      privateIps: collectIps(row, fields.privateIp, "privateIps", issues),
      publicIps: collectIps(row, fields.publicIp, "publicIps", issues),
      cidrs: collectCidrs(row, fields.cidr, issues),
      businessDomain: optional(value(row, fields, "businessDomain")),
      application: optional(value(row, fields, "application")),
      system: optional(value(row, fields, "system")),
      environment: optional(
        normalizeAlias(value(row, fields, "environment"), ENVIRONMENT_ALIASES),
      ),
      provider: optional(
        normalizeAlias(value(row, fields, "provider"), PROVIDER_ALIASES),
      ),
      region: optional(value(row, fields, "region")),
      account: optional(value(row, fields, "account")),
      tags: collectTags(row, fields),
      relationships: {
        dependsOn: parseList(value(row, fields, "dependsOn")),
        connectsTo: parseList(value(row, fields, "connectsTo")),
        calls: parseList(value(row, fields, "calls")),
      },
      raw: row.cells,
    });
  }

  return { assets, issues };
};
