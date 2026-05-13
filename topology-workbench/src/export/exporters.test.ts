import { toPng } from "html-to-image";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  exportTopologyJson,
  exportTopologyPng,
  exportTopologySvg,
} from "./exporters";

import type { LayoutResult, Topology } from "../domain/types";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
}));

const topology: Topology = {
  nodes: [
    {
      id: "asset:api",
      label: "API <main> & Gateway",
      kind: "cloud_resource",
      layer: "application",
      sourceRows: ["row-1"],
      data: {},
    },
    {
      id: "asset:db",
      label: "Orders Database",
      kind: "data_resource",
      layer: "data",
      sourceRows: ["row-2"],
      data: {},
    },
  ],
  edges: [
    {
      id: "edge:api-db",
      sourceId: "asset:api",
      targetId: "asset:db",
      kind: "calls",
      sourceRows: ["row-1"],
      label: 'calls <primary> "db"',
    },
  ],
};

const layout: LayoutResult = {
  engine: "elk",
  nodes: [
    {
      ...topology.nodes[0],
      position: { x: 20, y: 40 },
    },
    {
      ...topology.nodes[1],
      position: { x: 280, y: 120 },
    },
  ],
  edges: topology.edges,
};

describe("topology exporters", () => {
  beforeEach(() => {
    vi.mocked(toPng).mockReset();
  });

  it("exports formatted JSON with topology metadata", () => {
    const exported = exportTopologyJson(topology);
    const parsed = JSON.parse(exported);

    expect(exported).toContain('\n  "metadata":');
    expect(parsed).toEqual({
      metadata: expect.objectContaining({
        schemaVersion: expect.any(String),
        nodeCount: 2,
        edgeCount: 1,
        exportedAt: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        ),
      }),
      topology,
    });
  });

  it("exports a complete SVG document with escaped node and edge labels", () => {
    const exported = exportTopologySvg(topology, layout);

    expect(exported).toMatch(
      /^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/,
    );
    expect(exported).toContain("API &lt;main&gt; &amp; Gateway");
    expect(exported).toContain("Orders Database");
    expect(exported).toContain("calls &lt;primary&gt; &quot;db&quot;");
    expect(exported).not.toContain("<main>");
    expect(exported).toContain("</svg>");
  });

  it("exports a DOM element to PNG data URL", async () => {
    const element = document.createElement("section");
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,topology");

    await expect(exportTopologyPng(element)).resolves.toBe(
      "data:image/png;base64,topology",
    );
    expect(toPng).toHaveBeenCalledWith(element);
  });
});
