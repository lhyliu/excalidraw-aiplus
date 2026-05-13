import { proposeTopologyPatch, summarizePatch } from "./assistant";

import type { Topology, TopologyPatchOperation } from "../domain/types";

const topology: Topology = {
  nodes: [
    {
      id: "asset:checkout-api",
      label: "Checkout API",
      kind: "service",
      layer: "application",
      businessDomain: "Commerce",
      application: "Checkout",
      system: "Order",
      environment: "prod",
      sourceRows: ["row-1"],
      data: { tags: { team: "payments" } },
    },
    {
      id: "asset:orders-api",
      label: "Orders API",
      kind: "service",
      layer: "application",
      businessDomain: "Commerce",
      application: "Orders",
      system: "Order",
      environment: "prod",
      sourceRows: ["row-2"],
      data: {},
    },
    {
      id: "asset:redis-session",
      label: "Session Redis",
      kind: "data_resource",
      layer: "data",
      resourceType: "Redis",
      businessDomain: "Commerce",
      application: "Checkout",
      environment: "prod",
      sourceRows: ["row-3"],
      data: {},
    },
    {
      id: "asset:rds-orders",
      label: "Orders Database",
      kind: "data_resource",
      layer: "data",
      resourceType: "RDS",
      businessDomain: "Commerce",
      application: "Orders",
      environment: "prod",
      sourceRows: ["row-4"],
      data: {},
    },
    {
      id: "asset:vpc-core",
      label: "Core VPC",
      kind: "network_resource",
      layer: "network",
      resourceType: "VPC",
      environment: "prod",
      sourceRows: ["row-5"],
      data: {},
    },
    {
      id: "asset:vpn-idc",
      label: "IDC Direct Connect",
      kind: "network_resource",
      layer: "network",
      resourceType: "leased_line",
      environment: "prod",
      sourceRows: ["row-6"],
      data: {},
    },
    {
      id: "asset:test-worker",
      label: "Test Worker",
      kind: "cloud_resource",
      layer: "application",
      resourceType: "ECS",
      environment: "test",
      sourceRows: ["row-7"],
      data: {},
    },
  ],
  edges: [],
};

const enabledOperations = (operations: readonly TopologyPatchOperation[]) =>
  operations.filter((operation) => operation.enabled !== false);

describe("proposeTopologyPatch", () => {
  it("moves Redis and cache resources into the middleware layer", () => {
    const patch = proposeTopologyPatch(
      topology,
      "Move Redis/cache resources to the cache middleware layer.",
    );

    expect(enabledOperations(patch.operations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "updateNode",
          nodeId: "asset:redis-session",
          changes: expect.objectContaining({
            layer: "middleware",
            data: expect.objectContaining({ role: "cache" }),
          }),
        }),
      ]),
    );
  });

  it("splits payment and order domains", () => {
    const patch = proposeTopologyPatch(
      topology,
      "Split payment and order domains for clearer ownership.",
    );

    expect(enabledOperations(patch.operations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "addNode",
          node: expect.objectContaining({
            id: "business-domain:payment",
            label: "Payment",
          }),
        }),
        expect.objectContaining({
          type: "addNode",
          node: expect.objectContaining({
            id: "business-domain:order",
            label: "Order",
          }),
        }),
        expect.objectContaining({
          type: "updateNode",
          nodeId: "asset:checkout-api",
          changes: expect.objectContaining({
            businessDomain: "Payment",
            parentId: "business-domain:payment",
          }),
        }),
        expect.objectContaining({
          type: "updateNode",
          nodeId: "asset:orders-api",
          changes: expect.objectContaining({
            businessDomain: "Order",
            parentId: "business-domain:order",
          }),
        }),
      ]),
    );
  });

  it("creates an IDC to VPC leased-line edge", () => {
    const patch = proposeTopologyPatch(
      topology,
      "Create leased-line edge from IDC to VPC.",
    );

    expect(enabledOperations(patch.operations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "addEdge",
          edge: expect.objectContaining({
            sourceId: "asset:vpn-idc",
            targetId: "asset:vpc-core",
            kind: "network_connects",
            label: "leased line",
          }),
        }),
      ]),
    );
  });

  it("annotates database risk", () => {
    const patch = proposeTopologyPatch(
      topology,
      "Annotate database risk for sensitive data stores.",
    );

    expect(enabledOperations(patch.operations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "updateNode",
          nodeId: "asset:rds-orders",
          changes: expect.objectContaining({
            data: expect.objectContaining({
              risk: "database",
              validationRisk: expect.stringContaining("backup"),
            }),
          }),
        }),
      ]),
    );
  });

  it("does not classify unrelated metadata text as database resources", () => {
    const patch = proposeTopologyPatch(
      {
        nodes: [
          {
            id: "asset:profile-api",
            label: "Profile API",
            kind: "service",
            layer: "application",
            resourceType: "service",
            environment: "prod",
            sourceRows: ["row-8"],
            data: {
              notes: "Discuss db ownership with payment and order teams.",
            },
          },
        ],
        edges: [],
      },
      "Annotate database risk.",
    );

    expect(patch.operations).toEqual([]);
  });

  it("hides the test environment", () => {
    const patch = proposeTopologyPatch(
      topology,
      "Hide test environment nodes from the topology.",
    );

    expect(enabledOperations(patch.operations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "updateNode",
          nodeId: "asset:test-worker",
          changes: expect.objectContaining({
            data: expect.objectContaining({
              hidden: true,
              visibility: "hidden",
            }),
          }),
        }),
      ]),
    );
  });
});

describe("summarizePatch", () => {
  it("summarizes operations and validation risks", () => {
    const patch = proposeTopologyPatch(
      topology,
      "Hide test environment and annotate database risk.",
    );

    const summary = summarizePatch(topology, patch);

    expect(summary.title).toContain("Topology patch");
    expect(summary.enabledOperationCount).toBeGreaterThan(0);
    expect(summary.operationLabels.length).toBe(summary.enabledOperationCount);
    expect(summary.validationRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "warning" }),
      ]),
    );
  });
});
