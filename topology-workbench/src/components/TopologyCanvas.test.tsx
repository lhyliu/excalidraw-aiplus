import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { TopologyCanvas } from "./TopologyCanvas";

import type { LayoutResult } from "../domain/types";

class ResizeObserverMock implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

const layout: LayoutResult = {
  engine: "elk",
  nodes: [
    {
      id: "asset:checkout",
      label: "Checkout API",
      kind: "cloud_resource",
      layer: "application",
      position: { x: 40, y: 80 },
      sourceRows: ["row-1"],
      data: { identity: "checkout" },
    },
  ],
  edges: [],
};

it("renders real React Flow nodes and selects a topology node", async () => {
  const onSelectNode = vi.fn();
  const { container } = render(
    <TopologyCanvas layout={layout} onSelectNode={onSelectNode} />,
  );

  expect(container.querySelector(".react-flow")).toBeInTheDocument();
  fireEvent.click(await screen.findByText("Checkout API"));

  expect(onSelectNode).toHaveBeenCalledWith(layout.nodes[0]);
});
