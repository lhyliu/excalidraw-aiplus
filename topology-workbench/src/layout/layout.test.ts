import { layoutTopology } from "./layout";
import type { Topology } from "../domain/types";

const topology = (): Topology => ({
  nodes: [
    {
      id: "asset:api",
      label: "API",
      kind: "cloud_resource",
      layer: "application",
      sourceRows: ["row-api"],
      data: {},
    },
    {
      id: "asset:db",
      label: "DB",
      kind: "data_resource",
      layer: "data",
      sourceRows: ["row-db"],
      data: {},
    },
  ],
  edges: [
    {
      id: "asset:api->depends_on->asset:db",
      sourceId: "asset:api",
      targetId: "asset:db",
      kind: "depends_on",
      sourceRows: ["row-api"],
    },
  ],
});

describe("layoutTopology", () => {
  it("returns positioned nodes without changing topology semantics", async () => {
    const input = topology();
    const result = await layoutTopology(input);

    expect(result.engine).toBe("elk");
    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "asset:api",
          position: expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number),
          }),
        }),
        expect.objectContaining({
          id: "asset:db",
          position: expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number),
          }),
        }),
      ]),
    );
    expect(input.nodes[0]).not.toHaveProperty("position");
    expect(result.edges).toEqual(input.edges);
    expect(result.edges).not.toBe(input.edges);
  });

  it("does not preserve pinned positions unless requested", async () => {
    const input: Topology = {
      ...topology(),
      nodes: [
        {
          ...topology().nodes[0],
          pinnedPosition: { x: 320, y: 120 },
        },
        topology().nodes[1],
      ],
    };

    const result = await layoutTopology(input);

    expect(result.nodes.find((node) => node.id === "asset:api")?.position).not.toEqual({
      x: 320,
      y: 120,
    });
  });

  it("preserves pinned positions when requested", async () => {
    const input: Topology = {
      ...topology(),
      nodes: [
        {
          ...topology().nodes[0],
          pinnedPosition: { x: 320, y: 120 },
        },
        topology().nodes[1],
      ],
    };

    const result = await layoutTopology(input, { preservePinned: true });

    expect(result.nodes.find((node) => node.id === "asset:api")?.position).toEqual({
      x: 320,
      y: 120,
    });
  });

  it("keeps only pinned nodes fixed during local relayout", async () => {
    const input: Topology = {
      ...topology(),
      nodes: [
        {
          ...topology().nodes[0],
          position: { x: 12, y: 34 },
          pinnedPosition: { x: 12, y: 34 },
        },
        {
          ...topology().nodes[1],
          position: { x: 56, y: 78 },
        },
      ],
    };

    const result = await layoutTopology(input, { preservePinned: true });

    expect(result.nodes.find((node) => node.id === "asset:api")?.position).toEqual({
      x: 12,
      y: 34,
    });
    expect(result.nodes.find((node) => node.id === "asset:db")?.position).not.toEqual({
      x: 56,
      y: 78,
    });
  });

  it("uses Dagre fallback when requested", async () => {
    const result = await layoutTopology(topology(), { forceFallback: true });

    expect(result.engine).toBe("dagre");
    expect(result.nodes.every((node) => typeof node.position.x === "number")).toBe(
      true,
    );
  });
});
