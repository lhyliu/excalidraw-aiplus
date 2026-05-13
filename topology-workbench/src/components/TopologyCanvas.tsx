import "@xyflow/react/dist/style.css";

import { Background, Controls, ReactFlow } from "@xyflow/react";

import type { Ref } from "react";
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
  readonly className?: string;
  readonly label?: string;
};

type TopologyCanvasProps = {
  readonly layout?: LayoutResult;
  readonly networkMode?: boolean;
  readonly rootRef?: Ref<HTMLDivElement>;
  readonly onSelectNode: (node: TopologyNode) => void;
};

const isNetworkNode = (node: TopologyNode) =>
  node.kind === "network_resource" || node.kind === "boundary";

const isNetworkEdge = (edge: TopologyEdge) => edge.kind === "network_connects";

const networkNodeClass = (node: TopologyNode, networkMode: boolean) => {
  if (!networkMode) {
    return "";
  }

  return isNetworkNode(node)
    ? " topology-node--network-focus"
    : " topology-node--dimmed";
};

const networkEdgeClass = (edge: TopologyEdge, networkMode: boolean) => {
  if (!networkMode) {
    return "";
  }

  return isNetworkEdge(edge)
    ? " topology-edge--network-focus"
    : " topology-edge--dimmed";
};

const toFlowNode = (
  node: PositionedTopologyNode,
  networkMode: boolean,
): FlowNode => ({
  id: node.id,
  position: node.position,
  data: {
    label: node.label,
    kind: node.kind,
    layer: node.layer,
  },
  className: `topology-node topology-node--${node.kind}${networkNodeClass(
    node,
    networkMode,
  )}`,
});

const toFlowEdge = (edge: TopologyEdge, networkMode: boolean): FlowEdge => ({
  id: edge.id,
  source: edge.sourceId,
  target: edge.targetId,
  className: `topology-edge${networkEdgeClass(edge, networkMode)}`,
  label: edge.label,
});

export function TopologyCanvas({
  layout,
  networkMode = false,
  rootRef,
  onSelectNode,
}: TopologyCanvasProps) {
  const nodes =
    layout?.nodes.map((node) => toFlowNode(node, networkMode)) ?? [];
  const edges =
    layout?.edges.map((edge) => toFlowEdge(edge, networkMode)) ?? [];
  const nodesById = new Map(layout?.nodes.map((node) => [node.id, node]));

  return (
    <div
      className="canvas-region"
      ref={rootRef}
      role="region"
      aria-label="Topology canvas"
    >
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
