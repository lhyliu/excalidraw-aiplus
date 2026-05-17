import type { LayoutResult, Topology, TopologyEdge } from "../domain/types";

const SCHEMA_VERSION = "topology-workbench.v1";
const NODE_WIDTH = 180;
const NODE_HEIGHT = 72;
const PADDING = 48;

const escapeText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const nodeCenter = (node: LayoutResult["nodes"][number]) => ({
  x: node.position.x + NODE_WIDTH / 2,
  y: node.position.y + NODE_HEIGHT / 2,
});

const edgeLabel = (edge: TopologyEdge) => edge.label ?? edge.kind;

export const exportTopologyJson = (topology: Topology): string =>
  JSON.stringify(
    {
      metadata: {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        nodeCount: topology.nodes.length,
        edgeCount: topology.edges.length,
      },
      topology,
    },
    null,
    2,
  );

export const exportTopologySvg = (
  topology: Topology,
  layout: LayoutResult,
): string => {
  const positioned = new Map(layout.nodes.map((node) => [node.id, node]));
  const bounds = layout.nodes.reduce(
    (current, node) => ({
      minX: Math.min(current.minX, node.position.x),
      minY: Math.min(current.minY, node.position.y),
      maxX: Math.max(current.maxX, node.position.x + NODE_WIDTH),
      maxY: Math.max(current.maxY, node.position.y + NODE_HEIGHT),
    }),
    {
      minX: 0,
      minY: 0,
      maxX: NODE_WIDTH,
      maxY: NODE_HEIGHT,
    },
  );
  const width = Math.ceil(bounds.maxX - bounds.minX + PADDING * 2);
  const height = Math.ceil(bounds.maxY - bounds.minY + PADDING * 2);
  const offsetX = PADDING - bounds.minX;
  const offsetY = PADDING - bounds.minY;
  const lines = topology.edges.flatMap((edge) => {
    const source = positioned.get(edge.sourceId);
    const target = positioned.get(edge.targetId);
    if (!source || !target) {
      return [];
    }

    const sourcePoint = nodeCenter(source);
    const targetPoint = nodeCenter(target);
    const labelX = (sourcePoint.x + targetPoint.x) / 2 + offsetX;
    const labelY = (sourcePoint.y + targetPoint.y) / 2 + offsetY - 8;

    return [
      `<line class="topology-edge topology-edge--${edge.kind}" x1="${
        sourcePoint.x + offsetX
      }" y1="${sourcePoint.y + offsetY}" x2="${targetPoint.x + offsetX}" y2="${
        targetPoint.y + offsetY
      }" />`,
      `<text class="topology-edge-label" x="${labelX}" y="${labelY}">${escapeText(
        edgeLabel(edge),
      )}</text>`,
    ];
  });
  const nodes = layout.nodes.map(
    (node) => `<g class="topology-node topology-node--${node.kind}">
  <rect x="${node.position.x + offsetX}" y="${
      node.position.y + offsetY
    }" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="8" />
  <text x="${node.position.x + offsetX + 14}" y="${
      node.position.y + offsetY + 32
    }">${escapeText(node.label)}</text>
  <text class="topology-node-kind" x="${node.position.x + offsetX + 14}" y="${
      node.position.y + offsetY + 52
    }">${escapeText(node.kind)}</text>
</g>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Topology export">
<style>
  .topology-edge { stroke: #64748b; stroke-width: 1.8; }
  .topology-edge-label { fill: #475569; font: 12px sans-serif; }
  .topology-node rect { fill: #ffffff; stroke: #2563eb; stroke-width: 2; }
  .topology-node--network_resource rect { stroke: #d97706; fill: #fff7e8; }
  .topology-node--boundary rect { stroke: #dc2626; fill: #fff0f0; }
  .topology-node--data_resource rect { stroke: #9333ea; fill: #faf0ff; }
  .topology-node text { fill: #172033; font: 700 13px sans-serif; }
  .topology-node-kind { fill: #64748b; font: 11px sans-serif; }
</style>
${lines.join("\n")}
${nodes.join("\n")}
</svg>`;
};

export const exportTopologyPng = async (
  element: HTMLElement,
): Promise<string> => {
  const { toPng } = await import("html-to-image");

  return toPng(element);
};
