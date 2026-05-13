import type {
  ClassifiedAsset,
  Topology,
  TopologyEdge,
  TopologyEdgeKind,
  TopologyFilters,
  TopologyLayer,
  TopologyNode,
  TopologyNodeKind,
} from "../domain/types";

type MutableTopologyNode = Omit<TopologyNode, "sourceRows"> & {
  readonly sourceRows: string[];
};

type MutableTopologyEdge = Omit<TopologyEdge, "sourceRows"> & {
  readonly sourceRows: string[];
};

const slug = (input: string) =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

const addSourceRow = (node: MutableTopologyNode, rowId: string) => {
  if (!node.sourceRows.includes(rowId)) {
    node.sourceRows.push(rowId);
  }
};

const addEdgeSourceRow = (edge: MutableTopologyEdge, rowId: string) => {
  if (!edge.sourceRows.includes(rowId)) {
    edge.sourceRows.push(rowId);
  }
};

const upsertNode = (
  nodes: Map<string, MutableTopologyNode>,
  node: MutableTopologyNode,
) => {
  const existing = nodes.get(node.id);

  if (existing) {
    for (const rowId of node.sourceRows) {
      addSourceRow(existing, rowId);
    }
    return existing;
  }

  nodes.set(node.id, node);
  return node;
};

const groupNode = ({
  id,
  label,
  kind,
  layer,
  rowId,
  parentId,
}: {
  readonly id: string;
  readonly label: string;
  readonly kind: TopologyNodeKind;
  readonly layer: TopologyLayer;
  readonly rowId: string;
  readonly parentId?: string;
}): MutableTopologyNode => ({
  id,
  label,
  kind,
  layer,
  parentId,
  sourceRows: [rowId],
  data: {},
});

const assetNode = (
  asset: ClassifiedAsset,
  parentId: string | undefined,
): MutableTopologyNode => ({
  id: `asset:${asset.identity}`,
  label: asset.label,
  kind: asset.nodeKind,
  layer: asset.layer,
  parentId,
  confidence: asset.confidence,
  reviewRequired: asset.reviewRequired,
  resourceType: asset.resourceType,
  environment: asset.environment,
  businessDomain: asset.businessDomain,
  application: asset.application,
  system: asset.system,
  sourceRows: [asset.rowId],
  data: {
    identity: asset.identity,
    privateIps: asset.privateIps,
    publicIps: asset.publicIps,
    cidrs: asset.cidrs,
    provider: asset.provider,
    region: asset.region,
    account: asset.account,
    tags: asset.tags,
  },
});

const normalizeLookup = (input: string) => input.trim().toLowerCase();

const addLabelLookup = (
  labels: Map<string, string | undefined>,
  label: string,
  nodeId: string,
) => {
  const key = normalizeLookup(label);
  if (!key) {
    return;
  }
  if (labels.has(key) && labels.get(key) === undefined) {
    return;
  }
  const existing = labels.get(key);

  if (existing === undefined) {
    labels.set(key, nodeId);
    return;
  }
  if (existing !== nodeId) {
    labels.set(key, undefined);
  }
};

const relationshipSpecs: ReadonlyArray<{
  readonly field: keyof ClassifiedAsset["relationships"];
  readonly kind: TopologyEdgeKind;
}> = [
  { field: "dependsOn", kind: "depends_on" },
  { field: "connectsTo", kind: "network_connects" },
  { field: "calls", kind: "calls" },
];

export const buildTopology = (classified: ClassifiedAsset[]): Topology => {
  const nodes = new Map<string, MutableTopologyNode>();
  const assetIdsByIdentity = new Map<string, string>();
  const assetIdsByLabel = new Map<string, string | undefined>();

  for (const asset of classified) {
    let parentId: string | undefined;

    if (asset.businessDomain) {
      parentId = upsertNode(
        nodes,
        groupNode({
          id: `business-domain:${slug(asset.businessDomain)}`,
          label: asset.businessDomain,
          kind: "business_domain",
          layer: "business",
          rowId: asset.rowId,
        }),
      ).id;
    }

    if (asset.application) {
      parentId = upsertNode(
        nodes,
        groupNode({
          id: `application:${slug(asset.businessDomain ?? "none")}:${slug(
            asset.application,
          )}`,
          label: asset.application,
          kind: "application",
          layer: "application",
          rowId: asset.rowId,
          parentId,
        }),
      ).id;
    }

    if (asset.system) {
      parentId = upsertNode(
        nodes,
        groupNode({
          id: `system:${slug(asset.businessDomain ?? "none")}:${slug(
            asset.application ?? "none",
          )}:${slug(asset.system)}`,
          label: asset.system,
          kind: "system",
          layer: "application",
          rowId: asset.rowId,
          parentId,
        }),
      ).id;
    }

    const node = upsertNode(nodes, assetNode(asset, parentId));
    assetIdsByIdentity.set(normalizeLookup(asset.identity), node.id);
    addLabelLookup(assetIdsByLabel, asset.label, node.id);
  }

  const edges = new Map<string, MutableTopologyEdge>();

  for (const asset of classified) {
    const sourceId = assetIdsByIdentity.get(normalizeLookup(asset.identity));
    if (!sourceId) {
      continue;
    }

    for (const { field, kind } of relationshipSpecs) {
      for (const target of asset.relationships[field]) {
        const targetKey = normalizeLookup(target);
        const targetId =
          assetIdsByIdentity.get(targetKey) ?? assetIdsByLabel.get(targetKey);
        if (!targetId || targetId === sourceId) {
          continue;
        }

        const id = `${sourceId}->${kind}->${targetId}`;
        const existing = edges.get(id);
        if (existing) {
          addEdgeSourceRow(existing, asset.rowId);
          continue;
        }

        edges.set(id, {
          id,
          sourceId,
          targetId,
          kind,
          sourceRows: [asset.rowId],
          label: kind,
        });
      }
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
  };
};

const matchesText = (node: TopologyNode, search: string) => {
  const haystack = [
    node.id,
    node.label,
    node.resourceType,
    node.environment,
    node.businessDomain,
    node.application,
    node.system,
    node.kind,
    node.layer,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.trim().toLowerCase());
};

const matchesFilter = (node: TopologyNode, filters: TopologyFilters) => {
  if (filters.search && !matchesText(node, filters.search)) {
    return false;
  }
  if (
    filters.networkOnly &&
    node.kind !== "network_resource" &&
    node.kind !== "boundary"
  ) {
    return false;
  }
  if (filters.environment && node.environment !== filters.environment) {
    return false;
  }
  if (
    filters.businessDomain &&
    node.businessDomain !== filters.businessDomain &&
    node.label !== filters.businessDomain
  ) {
    return false;
  }
  if (filters.resourceType && node.resourceType !== filters.resourceType) {
    return false;
  }
  if (filters.nodeKind && node.kind !== filters.nodeKind) {
    return false;
  }

  return true;
};

export const filterTopology = (
  topology: Topology,
  filters: TopologyFilters,
): Topology => {
  const nodes = topology.nodes.filter((node) => matchesFilter(node, filters));
  const visible = new Set(nodes.map((node) => node.id));

  return {
    nodes,
    edges: topology.edges.filter(
      (edge) => visible.has(edge.sourceId) && visible.has(edge.targetId),
    ),
  };
};

export const getNodeSourceRows = (topology: Topology, nodeId: string) =>
  topology.nodes.find((node) => node.id === nodeId)?.sourceRows ?? [];
