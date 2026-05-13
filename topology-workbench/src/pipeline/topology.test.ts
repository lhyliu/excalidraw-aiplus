import { buildTopology, filterTopology, getNodeSourceRows } from "./topology";
import type { ClassifiedAsset } from "../domain/types";

const asset = (
  overrides: Partial<ClassifiedAsset> & Pick<ClassifiedAsset, "identity" | "label">,
): ClassifiedAsset => {
  const { identity, label, ...rest } = overrides;

  return {
    rowId: `row-${identity}`,
    identity,
    label,
    resourceType: "ECS",
    privateIps: [],
    publicIps: [],
    cidrs: [],
    businessDomain: "Payments",
    application: "Checkout",
    system: undefined,
    environment: "prod",
    provider: "aliyun",
    region: "cn-hangzhou",
    account: "acct-1",
    tags: {},
    relationships: {
      dependsOn: [],
      connectsTo: [],
      calls: [],
    },
    raw: {},
    nodeKind: "cloud_resource",
    layer: "application",
    confidence: "high",
    reason: "test asset",
    reviewRequired: false,
    ...rest,
  };
};

describe("buildTopology", () => {
  it("turns classified assets into domain, application, system, resource, and boundary nodes", () => {
    const topology = buildTopology([
      asset({ identity: "ecs-1", label: "Checkout VM", system: "Billing" }),
      asset({
        identity: "fw-1",
        label: "Perimeter Firewall",
        resourceType: "Firewall",
        nodeKind: "boundary",
        layer: "boundary",
      }),
    ]);

    expect(topology.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "business-domain:payments",
          kind: "business_domain",
          label: "Payments",
          sourceRows: ["row-ecs-1", "row-fw-1"],
        }),
        expect.objectContaining({
          id: "application:payments:checkout",
          kind: "application",
          parentId: "business-domain:payments",
        }),
        expect.objectContaining({
          id: "system:payments:checkout:billing",
          kind: "system",
          parentId: "application:payments:checkout",
        }),
        expect.objectContaining({
          id: "asset:ecs-1",
          kind: "cloud_resource",
          parentId: "system:payments:checkout:billing",
          confidence: "high",
          reviewRequired: false,
        }),
        expect.objectContaining({
          id: "asset:fw-1",
          kind: "boundary",
          layer: "boundary",
        }),
      ]),
    );
  });

  it("converts relationships into semantic edges and resolves targets by identity or label", () => {
    const topology = buildTopology([
      asset({
        identity: "api",
        label: "API",
        relationships: {
          dependsOn: ["db"],
          connectsTo: ["Perimeter Firewall"],
          calls: ["worker"],
        },
      }),
      asset({
        identity: "db",
        label: "Database",
        resourceType: "RDS",
        nodeKind: "data_resource",
        layer: "data",
      }),
      asset({
        identity: "fw",
        label: "Perimeter Firewall",
        resourceType: "Firewall",
        nodeKind: "boundary",
        layer: "boundary",
      }),
      asset({ identity: "worker", label: "Worker" }),
    ]);

    expect(topology.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "asset:api",
          targetId: "asset:db",
          kind: "depends_on",
          sourceRows: ["row-api"],
        }),
        expect.objectContaining({
          sourceId: "asset:api",
          targetId: "asset:fw",
          kind: "network_connects",
          sourceRows: ["row-api"],
        }),
        expect.objectContaining({
          sourceId: "asset:api",
          targetId: "asset:worker",
          kind: "calls",
          sourceRows: ["row-api"],
        }),
      ]),
    );
    expect(topology.edges.some((edge) => edge.targetId.includes("missing"))).toBe(
      false,
    );
  });

  it("resolves relationship targets by exact identity before unambiguous label", () => {
    const topology = buildTopology([
      asset({
        identity: "api",
        label: "API",
        relationships: {
          dependsOn: ["shared-label"],
          connectsTo: [],
          calls: [],
        },
      }),
      asset({
        identity: "shared-label",
        label: "Database",
        resourceType: "RDS",
        nodeKind: "data_resource",
        layer: "data",
      }),
      asset({
        identity: "db-by-label",
        label: "shared-label",
        resourceType: "RDS",
        nodeKind: "data_resource",
        layer: "data",
      }),
    ]);

    expect(topology.edges).toEqual([
      expect.objectContaining({
        sourceId: "asset:api",
        targetId: "asset:shared-label",
        kind: "depends_on",
      }),
    ]);
  });

  it("skips relationship targets with ambiguous duplicate labels", () => {
    const topology = buildTopology([
      asset({
        identity: "api",
        label: "API",
        relationships: {
          dependsOn: ["Shared Database"],
          connectsTo: [],
          calls: [],
        },
      }),
      asset({
        identity: "db-a",
        label: "Shared Database",
        resourceType: "RDS",
        nodeKind: "data_resource",
        layer: "data",
      }),
      asset({
        identity: "db-b",
        label: "Shared Database",
        resourceType: "RDS",
        nodeKind: "data_resource",
        layer: "data",
      }),
    ]);

    expect(topology.edges).toEqual([]);
  });

  it("keeps duplicate labels ambiguous after more than two matches", () => {
    const topology = buildTopology([
      asset({
        identity: "api",
        label: "API",
        relationships: {
          dependsOn: ["Shared Database"],
          connectsTo: [],
          calls: [],
        },
      }),
      asset({
        identity: "db-a",
        label: "Shared Database",
        resourceType: "RDS",
        nodeKind: "data_resource",
        layer: "data",
      }),
      asset({
        identity: "db-b",
        label: "Shared Database",
        resourceType: "RDS",
        nodeKind: "data_resource",
        layer: "data",
      }),
      asset({
        identity: "db-c",
        label: "Shared Database",
        resourceType: "RDS",
        nodeKind: "data_resource",
        layer: "data",
      }),
    ]);

    expect(topology.edges).toEqual([]);
  });

  it("merges source row provenance for duplicate semantic edges", () => {
    const topology = buildTopology([
      asset({
        identity: "api-a",
        label: "API A",
        relationships: {
          dependsOn: ["db"],
          connectsTo: [],
          calls: [],
        },
      }),
      asset({
        identity: "api-a",
        label: "API A",
        rowId: "row-api-a-duplicate",
        relationships: {
          dependsOn: ["db"],
          connectsTo: [],
          calls: [],
        },
      }),
      asset({
        identity: "db",
        label: "Database",
        resourceType: "RDS",
        nodeKind: "data_resource",
        layer: "data",
      }),
    ]);

    expect(topology.edges).toEqual([
      expect.objectContaining({
        sourceId: "asset:api-a",
        targetId: "asset:db",
        kind: "depends_on",
        sourceRows: ["row-api-a", "row-api-a-duplicate"],
      }),
    ]);
  });

  it("keeps node source row provenance addressable by node id", () => {
    const topology = buildTopology([
      asset({ identity: "ecs-1", label: "Checkout VM" }),
      asset({ identity: "ecs-2", label: "Checkout VM 2" }),
    ]);

    expect(getNodeSourceRows(topology, "business-domain:payments")).toEqual([
      "row-ecs-1",
      "row-ecs-2",
    ]);
    expect(getNodeSourceRows(topology, "asset:unknown")).toEqual([]);
  });
});

describe("filterTopology", () => {
  const topology = buildTopology([
    asset({
      identity: "api",
      label: "Checkout API",
      resourceType: "ECS",
      system: "Orders",
      relationships: {
        dependsOn: ["db"],
        connectsTo: ["vpc"],
        calls: [],
      },
    }),
    asset({
      identity: "db",
      label: "Orders Database",
      resourceType: "RDS",
      businessDomain: "Payments",
      application: "Checkout",
      environment: "prod",
      nodeKind: "data_resource",
      layer: "data",
    }),
    asset({
      identity: "vpc",
      label: "Prod VPC",
      resourceType: "VPC",
      businessDomain: "Platform",
      application: "Network",
      environment: "prod",
      nodeKind: "network_resource",
      layer: "network",
    }),
    asset({
      identity: "dev-api",
      label: "Sandbox API",
      businessDomain: "Sandbox",
      application: "Lab",
      environment: "dev",
    }),
  ]);

  it("filters by environment, business domain, resource type, node kind, search, and network mode", () => {
    expect(filterTopology(topology, { environment: "dev" }).nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "asset:dev-api" })]),
    );
    expect(
      filterTopology(topology, { environment: "dev" }).nodes.some(
        (node) => node.id === "asset:api",
      ),
    ).toBe(false);

    expect(
      filterTopology(topology, { businessDomain: "Platform" }).nodes,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: "asset:vpc" })]));

    expect(filterTopology(topology, { resourceType: "RDS" }).nodes).toEqual([
      expect.objectContaining({ id: "asset:db" }),
    ]);

    expect(filterTopology(topology, { nodeKind: "data_resource" }).nodes).toEqual([
      expect.objectContaining({ id: "asset:db" }),
    ]);

    expect(filterTopology(topology, { search: "database" }).nodes).toEqual([
      expect.objectContaining({ id: "asset:db" }),
    ]);

    expect(filterTopology(topology, { networkOnly: true }).nodes).toEqual([
      expect.objectContaining({ id: "asset:vpc" }),
    ]);
  });

  it("keeps only edges whose endpoints remain visible", () => {
    const filtered = filterTopology(topology, { resourceType: "RDS" });

    expect(filtered.nodes.map((node) => node.id)).toEqual(["asset:db"]);
    expect(filtered.edges).toEqual([]);
  });

  it("filters non-asset grouping nodes by node kind and search", () => {
    expect(filterTopology(topology, { nodeKind: "business_domain" }).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "business-domain:payments",
          kind: "business_domain",
        }),
        expect.objectContaining({
          id: "business-domain:platform",
          kind: "business_domain",
        }),
      ]),
    );

    expect(filterTopology(topology, { nodeKind: "application" }).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "application:payments:checkout",
          kind: "application",
        }),
        expect.objectContaining({
          id: "application:platform:network",
          kind: "application",
        }),
      ]),
    );

    expect(filterTopology(topology, { nodeKind: "system" }).nodes).toEqual([
      expect.objectContaining({
        id: "system:payments:checkout:orders",
        kind: "system",
      }),
    ]);

    expect(filterTopology(topology, { search: "platform" }).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "business-domain:platform" }),
        expect.objectContaining({ id: "application:platform:network" }),
      ]),
    );
  });

  it("combines networkOnly with the other applicable filters", () => {
    const filtered = filterTopology(topology, {
      networkOnly: true,
      environment: "dev",
    });

    expect(filtered.nodes).toEqual([]);
    expect(filtered.edges).toEqual([]);
  });
});
