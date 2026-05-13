import {
  applyTopologyPatch,
  rollbackTopologyPatch,
  validateTopologyPatch,
} from "./patch";

import type {
  Topology,
  TopologyPatch,
  TopologyPatchNodeChanges,
} from "../domain/types";

const node = (
  id: string,
  label = id,
  parentId?: string,
): Topology["nodes"][number] => ({
  id,
  label,
  kind: "service",
  layer: "application",
  parentId,
  sourceRows: [`row-${id}`],
  data: {},
});

const edge = (
  id: string,
  sourceId: string,
  targetId: string,
): Topology["edges"][number] => ({
  id,
  sourceId,
  targetId,
  kind: "calls",
  sourceRows: [`row-${id}`],
});

const baseTopology = (): Topology => ({
  nodes: [node("svc-a", "Service A"), node("svc-b", "Service B")],
  edges: [edge("svc-a-calls-svc-b", "svc-a", "svc-b")],
});

describe("validateTopologyPatch", () => {
  it("rejects invalid node references", () => {
    const patch: TopologyPatch = {
      id: "patch-invalid-reference",
      operations: [
        {
          id: "add-missing-edge",
          type: "addEdge",
          edge: {
            id: "missing-edge",
            sourceId: "svc-a",
            targetId: "missing-node",
            kind: "calls",
            sourceRows: [],
          },
        },
      ],
    };

    const result = validateTopologyPatch(baseTopology(), patch);

    expect(result.valid).toBe(false);
    expect(result.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_node_reference",
          operationId: "add-missing-edge",
        }),
      ]),
    );
  });

  it("rejects duplicate node and edge IDs", () => {
    const patch: TopologyPatch = {
      id: "patch-duplicate-ids",
      operations: [
        {
          id: "duplicate-node",
          type: "addNode",
          node: node("svc-a", "Duplicate service"),
        },
        {
          id: "duplicate-edge",
          type: "addEdge",
          edge: edge("svc-a-calls-svc-b", "svc-a", "svc-b"),
        },
      ],
    };

    const result = validateTopologyPatch(baseTopology(), patch);

    expect(result.valid).toBe(false);
    expect(result.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "duplicate_node_id",
          operationId: "duplicate-node",
        }),
        expect.objectContaining({
          code: "duplicate_edge_id",
          operationId: "duplicate-edge",
        }),
      ]),
    );
  });

  it("rejects parent cycles", () => {
    const patch: TopologyPatch = {
      id: "patch-parent-cycle",
      operations: [
        {
          id: "make-a-child-of-b",
          type: "updateNode",
          nodeId: "svc-a",
          changes: { parentId: "svc-b" },
        },
        {
          id: "make-b-child-of-a",
          type: "updateNode",
          nodeId: "svc-b",
          changes: { parentId: "svc-a" },
        },
      ],
    };

    const result = validateTopologyPatch(baseTopology(), patch);

    expect(result.valid).toBe(false);
    expect(result.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "parent_cycle" }),
      ]),
    );
  });

  it("rejects unsupported edge kinds", () => {
    const patch: TopologyPatch = {
      id: "patch-unsupported-edge-kind",
      operations: [
        {
          id: "unsupported-edge",
          type: "addEdge",
          edge: {
            ...edge("sync-edge", "svc-a", "svc-b"),
            kind: "syncs_with",
          } as unknown as Topology["edges"][number],
        },
      ],
    };

    const result = validateTopologyPatch(baseTopology(), patch);

    expect(result.valid).toBe(false);
    expect(result.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_edge_kind",
          operationId: "unsupported-edge",
        }),
      ]),
    );
  });

  it("rejects unsupported node kinds and layers", () => {
    const patch: TopologyPatch = {
      id: "patch-unsupported-node-semantics",
      operations: [
        {
          id: "invalid-kind",
          type: "addNode",
          node: {
            ...node("svc-invalid", "Invalid service"),
            kind: "queue_resource",
          } as unknown as Topology["nodes"][number],
        },
        {
          id: "invalid-layer",
          type: "updateNode",
          nodeId: "svc-a",
          changes: {
            layer: "storage",
          } as unknown as TopologyPatchNodeChanges,
        },
      ],
    };

    const result = validateTopologyPatch(baseTopology(), patch);

    expect(result.valid).toBe(false);
    expect(result.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_node_kind",
          operationId: "invalid-kind",
        }),
        expect.objectContaining({
          code: "unsupported_node_layer",
          operationId: "invalid-layer",
        }),
      ]),
    );
  });

  it("ignores disabled invalid operations", () => {
    const patch: TopologyPatch = {
      id: "patch-disabled-invalid-operation",
      operations: [
        {
          id: "invalid-disabled-edge",
          type: "addEdge",
          enabled: false,
          edge: {
            id: "disabled-edge",
            sourceId: "svc-a",
            targetId: "missing-node",
            kind: "calls",
            sourceRows: [],
          },
        },
        {
          id: "valid-update",
          type: "updateNode",
          nodeId: "svc-a",
          changes: { label: "Service A Reviewed" },
        },
      ],
    };

    const result = validateTopologyPatch(baseTopology(), patch);

    expect(result.valid).toBe(true);
    expect(result.risks).toEqual([]);
  });
});

describe("applyTopologyPatch", () => {
  it("applies valid patches and keeps rollback topology", () => {
    const topology = baseTopology();
    const patch: TopologyPatch = {
      id: "patch-apply-valid",
      operations: [
        {
          id: "add-cache",
          type: "addNode",
          node: {
            ...node("redis-cache", "Redis Cache"),
            kind: "data_resource",
            layer: "middleware",
            resourceType: "Redis",
          },
        },
        {
          id: "connect-cache",
          type: "addEdge",
          edge: {
            id: "svc-a-depends-redis-cache",
            sourceId: "svc-a",
            targetId: "redis-cache",
            kind: "depends_on",
            sourceRows: [],
            label: "depends_on",
          },
        },
      ],
    };

    const result = applyTopologyPatch(topology, patch);

    expect(result.validation.valid).toBe(true);
    expect(result.originalTopology).toEqual(topology);
    expect(result.topology.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "redis-cache", label: "Redis Cache" }),
      ]),
    );
    expect(result.topology.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "svc-a-depends-redis-cache" }),
      ]),
    );
    expect(rollbackTopologyPatch(result)).toEqual(topology);
  });

  it("deep clones nested node data for apply and rollback", () => {
    const topology: Topology = {
      nodes: [
        {
          ...node("svc-a", "Service A"),
          data: { tags: { owner: "platform" }, privateIps: ["10.0.0.1"] },
        },
      ],
      edges: [],
    };
    const patch: TopologyPatch = {
      id: "patch-data-clone",
      operations: [
        {
          id: "mark-reviewed",
          type: "updateNode",
          nodeId: "svc-a",
          changes: { data: { reviewed: true } },
        },
      ],
    };

    const result = applyTopologyPatch(topology, patch);
    const appliedTags = result.topology.nodes[0].data.tags as { owner: string };
    const rollbackTags = rollbackTopologyPatch(result).nodes[0].data.tags as {
      owner: string;
    };

    appliedTags.owner = "mutated";

    expect(
      (result.originalTopology.nodes[0].data.tags as { owner: string }).owner,
    ).toBe("platform");
    expect(rollbackTags.owner).toBe("platform");
    expect((topology.nodes[0].data.tags as { owner: string }).owner).toBe(
      "platform",
    );
  });
});
