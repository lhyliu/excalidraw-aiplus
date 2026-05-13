import { classifyAssets } from "./classify";
import type { NormalizedAsset } from "../domain/types";

const asset = (
  identity: string,
  resourceType: string,
  label = resourceType,
): NormalizedAsset => ({
  rowId: `row-${identity}`,
  identity,
  label,
  resourceType,
  privateIps: [],
  publicIps: [],
  cidrs: [],
  tags: {},
  relationships: {
    dependsOn: [],
    connectsTo: [],
    calls: [],
  },
  raw: {},
});

describe("classifyAssets", () => {
  it("classifies common compute, data, middleware, network, and boundary assets", () => {
    const result = classifyAssets([
      asset("ecs", "ECS"),
      asset("k8s", "kubernetes"),
      asset("lb", "load_balancer"),
      asset("rds", "RDS MySQL"),
      asset("redis", "Redis"),
      asset("mq", "Kafka MQ"),
      asset("vpc", "VPC"),
      asset("subnet", "Subnet"),
      asset("gateway", "Gateway"),
      asset("firewall", "Firewall"),
      asset("idc", "IDC"),
      asset("vpn", "VPN"),
    ]);

    expect(Object.fromEntries(result.assets.map((item) => [item.identity, item.nodeKind]))).toMatchObject({
      ecs: "cloud_resource",
      k8s: "cloud_resource",
      lb: "cloud_resource",
      rds: "data_resource",
      redis: "data_resource",
      mq: "cloud_resource",
      vpc: "network_resource",
      subnet: "network_resource",
      gateway: "network_resource",
      firewall: "boundary",
      idc: "boundary",
      vpn: "boundary",
    });
    expect(Object.fromEntries(result.assets.map((item) => [item.identity, item.layer]))).toMatchObject({
      ecs: "application",
      k8s: "application",
      lb: "access",
      rds: "data",
      redis: "middleware",
      mq: "middleware",
      vpc: "network",
      subnet: "network",
      gateway: "network",
      firewall: "boundary",
      idc: "boundary",
      vpn: "boundary",
    });
  });

  it("marks high confidence classifications as auto-accepted and low confidence as review", () => {
    const result = classifyAssets([
      asset("known", "PostgreSQL"),
      asset("unknown", "mystery appliance"),
    ]);

    expect(result.assets[0]).toMatchObject({
      confidence: "high",
      reviewRequired: false,
    });
    expect(result.assets[1]).toMatchObject({
      confidence: "low",
      reviewRequired: true,
    });
    expect(result.issues).toEqual([
      expect.objectContaining({
        kind: "low_confidence_classification",
        assetId: "unknown",
      }),
    ]);
  });

  it("does not classify unrelated substrings as known resource types", () => {
    const result = classifyAssets([
      asset("serverless", "unknown", "serverless-report"),
      asset("cachet", "unknown", "cachet-status"),
      asset("gatewayed", "unknown", "gatewayed-process"),
      asset("hostile", "unknown", "hostile-name"),
    ]);

    expect(result.assets.map((item) => item.confidence)).toEqual([
      "low",
      "low",
      "low",
      "low",
    ]);
  });

  it("keeps matching common separated resource terms", () => {
    const result = classifyAssets([
      asset("lb", "load_balancer"),
      asset("rds", "RDS MySQL"),
      asset("redis", "redis-cache"),
      asset("ecs", "ecs"),
    ]);

    expect(result.assets.map((item) => item.confidence)).toEqual([
      "high",
      "high",
      "high",
      "high",
    ]);
  });
});
