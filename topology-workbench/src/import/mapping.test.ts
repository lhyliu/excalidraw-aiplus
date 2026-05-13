import { mapImportFields, scoreImportReadiness } from "./mapping";
import type { RawAssetTable } from "../domain/types";

describe("mapImportFields", () => {
  it("maps English and Chinese aliases into canonical fields", () => {
    const mapping = mapImportFields([
      "resource_id",
      "hostname",
      "service_type",
      "private_ip",
      "公网IP",
      "业务域",
      "应用",
      "系统",
      "env",
      "云厂商",
      "区域",
      "账号",
      "网段",
      "calls",
      "可用区",
      "负责人",
      "vpc",
      "subnet",
      "安全组",
      "gateway",
      "负载均衡",
      "标签",
      "风险",
      "重要性",
      "成本中心",
      "描述",
    ]);

    expect(mapping.fields).toMatchObject({
      identity: "resource_id",
      label: "hostname",
      resourceType: "service_type",
      privateIp: "private_ip",
      publicIp: "公网IP",
      businessDomain: "业务域",
      application: "应用",
      system: "系统",
      environment: "env",
      provider: "云厂商",
      region: "区域",
      account: "账号",
      cidr: "网段",
      calls: "calls",
      zone: "可用区",
      owner: "负责人",
      vpc: "vpc",
      subnet: "subnet",
      securityGroup: "安全组",
      gateway: "gateway",
      loadBalancer: "负载均衡",
      tags: "标签",
      risk: "风险",
      criticality: "重要性",
      costCenter: "成本中心",
      description: "描述",
    });
  });

  it("uses hostname or name as identity fallback when explicit IDs are absent", () => {
    expect(mapImportFields(["hostname", "type"]).fields).toMatchObject({
      identity: "hostname",
      label: "hostname",
    });
    expect(mapImportFields(["name", "type"]).fields).toMatchObject({
      identity: "name",
      label: "name",
    });
  });
});

describe("scoreImportReadiness", () => {
  const table = (headers: string[], rows: Array<Record<string, string>>): RawAssetTable => ({
    headers,
    rows: rows.map((cells, index) => ({ rowId: `row-${index + 1}`, cells })),
    warnings: [],
  });

  it("scores high when most rows resolve identity, label, type, and environment", () => {
    const raw = table(["id", "name", "type", "env"], [
      { id: "i-1", name: "api", type: "ecs", env: "prod" },
      { id: "i-2", name: "db", type: "rds", env: "生产" },
      { id: "i-3", name: "cache", type: "redis", env: "" },
    ]);

    expect(scoreImportReadiness(raw, mapImportFields(raw.headers))).toMatchObject({
      level: "high",
    });
  });

  it("scores medium when identity and label resolve with type or environment", () => {
    const raw = table(["instance_id", "主机名", "环境"], [
      { instance_id: "i-1", 主机名: "api", 环境: "prod" },
      { instance_id: "i-2", 主机名: "worker", 环境: "test" },
    ]);

    expect(scoreImportReadiness(raw, mapImportFields(raw.headers))).toMatchObject({
      level: "medium",
      blockingIssues: [],
    });
  });

  it("scores low and reports blockers when identity or label is missing", () => {
    const raw = table(["type", "env"], [{ type: "ecs", env: "prod" }]);

    const report = scoreImportReadiness(raw, mapImportFields(raw.headers));

    expect(report.level).toBe("low");
    expect(report.blockingIssues).toContain("identity field is not mapped");
    expect(report.blockingIssues).toContain("label field is not mapped");
  });
});
