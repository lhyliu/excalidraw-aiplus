import "@xyflow/react/dist/style.css";

import { Background, Controls, ReactFlow } from "@xyflow/react";

import type {
  LayoutResult,
  PositionedTopologyNode,
  TopologyEdge,
  TopologyNode,
} from "../domain/types";

type FlowNode = {
  readonly id: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly data: {
    readonly label: string;
    readonly kind: string;
    readonly layer: string;
  };
  readonly className: string;
};

type FlowEdge = {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly label?: string;
};

type TopologyCanvasProps = {
  readonly layout?: LayoutResult;
  readonly onSelectNode: (node: TopologyNode) => void;
};

const toFlowNode = (node: PositionedTopologyNode): FlowNode => ({
  id: node.id,
  position: node.position,
  data: {
    label: node.label,
    kind: node.kind,
    layer: node.layer,
  },
  className: `topology-node topology-node--${node.kind}`,
});

const toFlowEdge = (edge: TopologyEdge): FlowEdge => ({
  id: edge.id,
  source: edge.sourceId,
  target: edge.targetId,
  label: edge.label,
});

export function TopologyCanvas({ layout, onSelectNode }: TopologyCanvasProps) {
  const nodes = layout?.nodes.map(toFlowNode) ?? [];
  const edges = layout?.edges.map(toFlowEdge) ?? [];
  const nodesById = new Map(layout?.nodes.map((node) => [node.id, node]));

  return (
    <div className="canvas-region" role="region" aria-label="Topology canvas">
      {layout ? (
        <ReactFlow
          deleteKeyCode={null}
          edges={edges}
          fitView
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          onNodeClick={(_, node) => {
            const topologyNode = nodesById.get(node.id);
            if (topologyNode) {
              onSelectNode(topologyNode);
            }
          }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      ) : (
        <span>Topology canvas</span>
      )}
    </div>
  );
}
