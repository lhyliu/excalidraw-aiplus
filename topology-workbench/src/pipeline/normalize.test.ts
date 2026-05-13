import { mapImportFields } from "../import/mapping";
import { normalizeAssets } from "./normalize";
import type { RawAssetTable } from "../domain/types";

describe("normalizeAssets", () => {
  it("normalizes whitespace, aliases, network fields, tags, and relationships", () => {
    const table: RawAssetTable = {
      headers: [
        "instance_id",
        "hostname",
        "service_type",
        "private_ip",
        "cidr",
        "env",
        "cloud",
        "region",
        "业务域",
        "应用",
        "owner",
        "zone",
        "vpc",
        "subnet",
        "security_group",
        "gateway",
        "load_balancer",
        "tags",
        "risk",
        "criticality",
        "cost_center",
        "description",
        "depends_on",
        "connects_to",
        "calls",
      ],
      rows: [
        {
          rowId: "row-1",
          cells: {
            instance_id: " i-001 ",
            hostname: " API-01 ",
            service_type: " ECS ",
            private_ip: " 10.0.0.8 ",
            cidr: " 10.0.0.0/24 ",
            env: " 生产 ",
            cloud: " aliyun ",
            region: " cn-hangzhou ",
            业务域: "交易",
            应用: " checkout ",
            owner: " payments ",
            zone: " cn-hangzhou-h ",
            vpc: " vpc-1 ",
            subnet: " subnet-1 ",
            security_group: " sg-core ",
            gateway: " nat-1 ",
            load_balancer: " lb-1 ",
            tags: "team=pay, tier=core;critical",
            risk: " high ",
            criticality: " p0 ",
            cost_center: " cc-123 ",
            description: " checkout api ",
            depends_on: " db-1, redis-1 ",
            connects_to: " lb-1; nat-1 ",
            calls: " payment\ninventory ",
          },
        },
      ],
      warnings: [],
    };

    const result = normalizeAssets(table, mapImportFields(table.headers));

    expect(result.assets[0]).toMatchObject({
      rowId: "row-1",
      identity: "i-001",
      label: "API-01",
      resourceType: "ECS",
      privateIps: ["10.0.0.8"],
      cidrs: ["10.0.0.0/24"],
      environment: "prod",
      provider: "aliyun",
      region: "cn-hangzhou",
      businessDomain: "交易",
      application: "checkout",
      tags: {
        owner: "payments",
        zone: "cn-hangzhou-h",
        vpc: "vpc-1",
        subnet: "subnet-1",
        securityGroup: "sg-core",
        gateway: "nat-1",
        loadBalancer: "lb-1",
        team: "pay",
        tier: "core",
        critical: "true",
        risk: "high",
        criticality: "p0",
        costCenter: "cc-123",
        description: "checkout api",
      },
      relationships: {
        dependsOn: ["db-1", "redis-1"],
        connectsTo: ["lb-1", "nat-1"],
        calls: ["payment", "inventory"],
      },
    });
    expect(result.issues).toEqual([]);
  });

  it("parses colon-delimited and bare tags into a useful record", () => {
    const table: RawAssetTable = {
      headers: ["name", "type", "tags", "归属人"],
      rows: [
        {
          rowId: "row-1",
          cells: {
            name: "cache",
            type: "redis",
            tags: "team:pay;critical",
            归属人: " platform ",
          },
        },
      ],
      warnings: [],
    };

    const result = normalizeAssets(table, mapImportFields(table.headers));

    expect(result.assets[0].identity).toBe("cache");
    expect(result.assets[0].tags).toEqual({
      owner: "platform",
      team: "pay",
      critical: "true",
    });
  });

  it("reports duplicate identities and invalid IP/CIDR as warning issues", () => {
    const table: RawAssetTable = {
      headers: ["id", "name", "type", "private_ip", "cidr"],
      rows: [
        {
          rowId: "row-1",
          cells: {
            id: "asset-1",
            name: "api",
            type: "ecs",
            private_ip: "999.1.1.1",
            cidr: "10.0.0.0/40",
          },
        },
        {
          rowId: "row-2",
          cells: {
            id: "asset-1",
            name: "api-copy",
            type: "ecs",
            private_ip: "10.0.0.9",
            cidr: "",
          },
        },
      ],
      warnings: [],
    };

    const result = normalizeAssets(table, mapImportFields(table.headers));

    expect(result.assets).toHaveLength(2);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "invalid_ip",
          severity: "warning",
          rowId: "row-1",
          field: "private_ip",
        }),
        expect.objectContaining({
          kind: "invalid_cidr",
          severity: "warning",
          rowId: "row-1",
          field: "cidr",
        }),
        expect.objectContaining({
          kind: "duplicate_identity",
          severity: "warning",
          rowId: "row-2",
        }),
      ]),
    );
  });

  it("rejects CIDR values with extra slash segments", () => {
    const table: RawAssetTable = {
      headers: ["id", "name", "cidr"],
      rows: [
        {
          rowId: "row-1",
          cells: {
            id: "subnet-1",
            name: "subnet",
            cidr: "10.0.0.0/24/foo",
          },
        },
      ],
      warnings: [],
    };

    const result = normalizeAssets(table, mapImportFields(table.headers));

    expect(result.assets[0].cidrs).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        kind: "invalid_cidr",
        value: "10.0.0.0/24/foo",
      }),
    ]);
  });
});
