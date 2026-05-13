import dagre from "@dagrejs/dagre";
import ELK from "elkjs/lib/elk.bundled.js";
import type {
  LayoutOptions,
  LayoutResult,
  PositionedTopologyNode,
  Topology,
  TopologyNode,
  TopologyPosition,
} from "../domain/types";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 72;

type LayoutEngine = LayoutResult["engine"];

const pinnedPosition = (node: TopologyNode): TopologyPosition | undefined =>
  node.pinnedPosition;

const withPinnedPositions = (
  nodes: PositionedTopologyNode[],
): PositionedTopologyNode[] =>
  nodes.map((node) => {
    const pinned = pinnedPosition(node);

    return pinned ? { ...node, position: pinned } : node;
  });

const toPositionedNode = (
  node: TopologyNode,
  position: TopologyPosition,
): PositionedTopologyNode => ({
  ...node,
  position,
});

const cloneEdges = (topology: Topology): LayoutResult["edges"] =>
  topology.edges.map((edge) => ({
    ...edge,
    sourceRows: [...edge.sourceRows],
    data: edge.data ? { ...edge.data } : undefined,
  }));

const layoutWithElk = async (
  topology: Topology,
): Promise<PositionedTopologyNode[]> => {
  const elk = new ELK();
  const graph = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "60",
      "elk.layered.spacing.nodeNodeBetweenLayers": "90",
    },
    children: topology.nodes.map((node) => ({
      id: node.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: topology.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.sourceId],
      targets: [edge.targetId],
    })),
  });
  const positions = new Map(
    graph.children?.map((node) => [
      node.id,
      { x: node.x ?? 0, y: node.y ?? 0 },
    ]) ?? [],
  );

  return topology.nodes.map((node) =>
    toPositionedNode(node, positions.get(node.id) ?? { x: 0, y: 0 }),
  );
};

const layoutWithDagre = (topology: Topology): PositionedTopologyNode[] => {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 90 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of topology.nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of topology.edges) {
    graph.setEdge(edge.sourceId, edge.targetId);
  }

  dagre.layout(graph);

  return topology.nodes.map((node) => {
    const dagreNode = graph.node(node.id);
    const position = dagreNode
      ? {
          x: dagreNode.x - NODE_WIDTH / 2,
          y: dagreNode.y - NODE_HEIGHT / 2,
        }
      : { x: 0, y: 0 };

    return toPositionedNode(node, position);
  });
};

export const layoutTopology = async (
  topology: Topology,
  options: LayoutOptions = {},
): Promise<LayoutResult> => {
  let engine: LayoutEngine = "elk";
  let nodes: PositionedTopologyNode[];

  if (options.forceFallback) {
    engine = "dagre";
    nodes = layoutWithDagre(topology);
  } else {
    try {
      nodes = await layoutWithElk(topology);
    } catch {
      engine = "dagre";
      nodes = layoutWithDagre(topology);
    }
  }

  return {
    nodes: options.preservePinned ? withPinnedPositions(nodes) : nodes,
    edges: cloneEdges(topology),
    engine,
  };
};
