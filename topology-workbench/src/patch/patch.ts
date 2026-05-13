import type {
  PatchApplyResult,
  PatchValidationResult,
  PatchValidationRisk,
  Topology,
  TopologyEdge,
  TopologyEdgeKind,
  TopologyLayer,
  TopologyNode,
  TopologyNodeKind,
  TopologyPatch,
  TopologyPatchOperation,
} from "../domain/types";

const SUPPORTED_NODE_KINDS = new Set<TopologyNodeKind>([
  "business_domain",
  "application",
  "system",
  "service",
  "external_system",
  "cloud_resource",
  "data_resource",
  "network_resource",
  "boundary",
]);

const SUPPORTED_LAYERS = new Set<TopologyLayer>([
  "business",
  "application",
  "access",
  "middleware",
  "data",
  "network",
  "boundary",
  "unknown",
]);

const SUPPORTED_EDGE_KINDS = new Set<TopologyEdgeKind>([
  "calls",
  "depends_on",
  "connects_to",
  "data_flow",
  "deployed_on",
  "network_connects",
  "secured_by",
  "contains",
]);

const isEnabled = (operation: TopologyPatchOperation) =>
  operation.enabled !== false;

const clonePosition = (position: TopologyNode["position"]) =>
  position ? { ...position } : undefined;

const cloneValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        cloneValue(item),
      ]),
    );
  }

  return value;
};

const cloneData = (data: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, cloneValue(value)]),
  );

const cloneOptionalData = (
  data: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => (data ? cloneData(data) : undefined);

const cloneNode = (node: TopologyNode): TopologyNode => ({
  ...node,
  sourceRows: [...node.sourceRows],
  position: clonePosition(node.position),
  pinnedPosition: clonePosition(node.pinnedPosition),
  data: cloneData(node.data),
});

const cloneEdge = (edge: TopologyEdge): TopologyEdge => ({
  ...edge,
  sourceRows: [...edge.sourceRows],
  data: cloneOptionalData(edge.data),
});

const cloneTopology = (topology: Topology): Topology => ({
  nodes: topology.nodes.map(cloneNode),
  edges: topology.edges.map(cloneEdge),
});

const risk = (
  code: PatchValidationRisk["code"],
  message: string,
  operationId?: string,
): PatchValidationRisk => ({
  severity: "error",
  code,
  message,
  operationId,
});

const nodeMap = (topology: Topology) =>
  new Map(topology.nodes.map((node) => [node.id, node]));

const edgeMap = (topology: Topology) =>
  new Map(topology.edges.map((edge) => [edge.id, edge]));

const hasSupportedEdgeKind = (kind: TopologyEdge["kind"]) =>
  SUPPORTED_EDGE_KINDS.has(kind);

const hasSupportedNodeKind = (kind: TopologyNode["kind"]) =>
  SUPPORTED_NODE_KINDS.has(kind);

const hasSupportedLayer = (layer: TopologyNode["layer"]) =>
  SUPPORTED_LAYERS.has(layer);

const replaceNode = (topology: Topology, nextNode: TopologyNode) => ({
  ...topology,
  nodes: topology.nodes.map((node) =>
    node.id === nextNode.id ? nextNode : node,
  ),
});

const replaceEdge = (topology: Topology, nextEdge: TopologyEdge) => ({
  ...topology,
  edges: topology.edges.map((edge) =>
    edge.id === nextEdge.id ? nextEdge : edge,
  ),
});

const applyEnabledOperation = (
  topology: Topology,
  operation: TopologyPatchOperation,
): Topology => {
  switch (operation.type) {
    case "addNode":
      return {
        ...topology,
        nodes: [...topology.nodes, cloneNode(operation.node)],
      };
    case "updateNode": {
      const node = topology.nodes.find((item) => item.id === operation.nodeId);

      if (!node) {
        return topology;
      }

      return replaceNode(topology, {
        ...node,
        ...operation.changes,
        data: {
          ...cloneData(node.data),
          ...(operation.changes.data ? cloneData(operation.changes.data) : {}),
        },
        position:
          operation.changes.position !== undefined
            ? clonePosition(operation.changes.position)
            : clonePosition(node.position),
        pinnedPosition:
          operation.changes.pinnedPosition !== undefined
            ? clonePosition(operation.changes.pinnedPosition)
            : clonePosition(node.pinnedPosition),
        sourceRows: operation.changes.sourceRows
          ? [...operation.changes.sourceRows]
          : [...node.sourceRows],
      });
    }
    case "removeNode":
      return {
        nodes: topology.nodes.filter((node) => node.id !== operation.nodeId),
        edges: topology.edges.filter(
          (edge) =>
            edge.sourceId !== operation.nodeId &&
            edge.targetId !== operation.nodeId,
        ),
      };
    case "addEdge":
      return {
        ...topology,
        edges: [...topology.edges, cloneEdge(operation.edge)],
      };
    case "updateEdge": {
      const edge = topology.edges.find((item) => item.id === operation.edgeId);

      if (!edge) {
        return topology;
      }

      return replaceEdge(topology, {
        ...edge,
        ...operation.changes,
        data: operation.changes.data
          ? {
              ...(edge.data ? cloneData(edge.data) : {}),
              ...cloneData(operation.changes.data),
            }
          : cloneOptionalData(edge.data),
        sourceRows: operation.changes.sourceRows
          ? [...operation.changes.sourceRows]
          : [...edge.sourceRows],
      });
    }
    case "removeEdge":
      return {
        ...topology,
        edges: topology.edges.filter((edge) => edge.id !== operation.edgeId),
      };
  }
};

const validateParentReferences = (
  topology: Topology,
  operationId: string | undefined,
) => {
  const nodes = nodeMap(topology);
  const risks: PatchValidationRisk[] = [];

  for (const node of topology.nodes) {
    if (node.parentId && !nodes.has(node.parentId)) {
      risks.push(
        risk(
          "invalid_node_reference",
          `Node ${node.id} references missing parent ${node.parentId}.`,
          operationId,
        ),
      );
    }
  }

  return risks;
};

const validateParentCycles = (topology: Topology) => {
  const nodes = nodeMap(topology);
  const risks: PatchValidationRisk[] = [];

  for (const node of topology.nodes) {
    const seen = new Set<string>();
    let current: TopologyNode | undefined = node;

    while (current?.parentId) {
      if (seen.has(current.id)) {
        risks.push(
          risk("parent_cycle", `Node ${node.id} is part of a parent cycle.`),
        );
        break;
      }

      seen.add(current.id);
      current = nodes.get(current.parentId);
    }
  }

  return risks.length > 0 ? [risks[0]] : [];
};

const validateEdgeReferences = (
  topology: Topology,
  edge: TopologyEdge,
  operationId: string,
) => {
  const nodes = nodeMap(topology);
  const risks: PatchValidationRisk[] = [];

  if (!nodes.has(edge.sourceId) || !nodes.has(edge.targetId)) {
    risks.push(
      risk(
        "invalid_node_reference",
        `Edge ${edge.id} references missing node(s).`,
        operationId,
      ),
    );
  }

  if (!hasSupportedEdgeKind(edge.kind)) {
    risks.push(
      risk(
        "unsupported_edge_kind",
        `Edge ${edge.id} uses unsupported kind ${edge.kind}.`,
        operationId,
      ),
    );
  }

  return risks;
};

const validateNodeSemantics = (
  node: TopologyNode,
  operationId: string,
): PatchValidationRisk[] => {
  const risks: PatchValidationRisk[] = [];

  if (!hasSupportedNodeKind(node.kind)) {
    risks.push(
      risk(
        "unsupported_node_kind",
        `Node ${node.id} uses unsupported kind ${node.kind}.`,
        operationId,
      ),
    );
  }
  if (!hasSupportedLayer(node.layer)) {
    risks.push(
      risk(
        "unsupported_node_layer",
        `Node ${node.id} uses unsupported layer ${node.layer}.`,
        operationId,
      ),
    );
  }

  return risks;
};

const validateOperation = (
  topology: Topology,
  operation: TopologyPatchOperation,
) => {
  const nodes = nodeMap(topology);
  const edges = edgeMap(topology);
  const risks: PatchValidationRisk[] = [];

  switch (operation.type) {
    case "addNode":
      risks.push(...validateNodeSemantics(operation.node, operation.id));
      if (nodes.has(operation.node.id)) {
        risks.push(
          risk(
            "duplicate_node_id",
            `Node ${operation.node.id} already exists.`,
            operation.id,
          ),
        );
      }
      if (operation.node.parentId && !nodes.has(operation.node.parentId)) {
        risks.push(
          risk(
            "invalid_node_reference",
            `Node ${operation.node.id} references missing parent ${operation.node.parentId}.`,
            operation.id,
          ),
        );
      }
      break;
    case "updateNode":
      if (!nodes.has(operation.nodeId)) {
        risks.push(
          risk(
            "missing_node",
            `Node ${operation.nodeId} does not exist.`,
            operation.id,
          ),
        );
      } else {
        risks.push(
          ...validateNodeSemantics(
            {
              ...nodes.get(operation.nodeId)!,
              ...operation.changes,
              data: {
                ...nodes.get(operation.nodeId)!.data,
                ...(operation.changes.data ?? {}),
              },
            },
            operation.id,
          ),
        );
      }
      if (
        operation.changes.parentId &&
        !nodes.has(operation.changes.parentId)
      ) {
        risks.push(
          risk(
            "invalid_node_reference",
            `Node ${operation.nodeId} references missing parent ${operation.changes.parentId}.`,
            operation.id,
          ),
        );
      }
      break;
    case "removeNode":
      if (!nodes.has(operation.nodeId)) {
        risks.push(
          risk(
            "missing_node",
            `Node ${operation.nodeId} does not exist.`,
            operation.id,
          ),
        );
      }
      break;
    case "addEdge":
      if (edges.has(operation.edge.id)) {
        risks.push(
          risk(
            "duplicate_edge_id",
            `Edge ${operation.edge.id} already exists.`,
            operation.id,
          ),
        );
      }
      risks.push(
        ...validateEdgeReferences(topology, operation.edge, operation.id),
      );
      break;
    case "updateEdge": {
      const existing = edges.get(operation.edgeId);

      if (!existing) {
        risks.push(
          risk(
            "missing_edge",
            `Edge ${operation.edgeId} does not exist.`,
            operation.id,
          ),
        );
        break;
      }

      risks.push(
        ...validateEdgeReferences(
          topology,
          { ...existing, ...operation.changes },
          operation.id,
        ),
      );
      break;
    }
    case "removeEdge":
      if (!edges.has(operation.edgeId)) {
        risks.push(
          risk(
            "missing_edge",
            `Edge ${operation.edgeId} does not exist.`,
            operation.id,
          ),
        );
      }
      break;
  }

  return risks;
};

export const validateTopologyPatch = (
  topology: Topology,
  patch: TopologyPatch,
): PatchValidationResult => {
  let nextTopology = cloneTopology(topology);
  const risks: PatchValidationRisk[] = [];

  for (const operation of patch.operations.filter(isEnabled)) {
    const operationRisks = validateOperation(nextTopology, operation);
    risks.push(...operationRisks);

    if (operationRisks.length === 0) {
      nextTopology = applyEnabledOperation(nextTopology, operation);
      risks.push(...validateParentReferences(nextTopology, operation.id));
    }
  }

  risks.push(...validateParentCycles(nextTopology));

  return {
    valid: !risks.some((item) => item.severity === "error"),
    risks,
  };
};

export const applyTopologyPatch = (
  topology: Topology,
  patch: TopologyPatch,
): PatchApplyResult => {
  const originalTopology = cloneTopology(topology);
  const validation = validateTopologyPatch(topology, patch);
  let nextTopology = cloneTopology(topology);
  const appliedOperationIds: string[] = [];

  if (validation.valid) {
    for (const operation of patch.operations.filter(isEnabled)) {
      nextTopology = applyEnabledOperation(nextTopology, operation);
      appliedOperationIds.push(operation.id);
    }
  }

  return {
    topology: nextTopology,
    originalTopology,
    appliedPatch: patch,
    appliedOperationIds,
    validation,
  };
};

export const rollbackTopologyPatch = (result: PatchApplyResult): Topology =>
  cloneTopology(result.originalTopology);
