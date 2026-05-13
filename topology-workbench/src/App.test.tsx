import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import App from "./App";

vi.mock("@xyflow/react", () => ({
  Background: () => null,
  Controls: () => null,
  ReactFlow: ({
    edges,
    nodes,
    onNodeClick,
  }: {
    readonly edges: Array<{ readonly id: string; readonly label?: string }>;
    readonly nodes: Array<{
      readonly id: string;
      readonly data: { readonly label: string; readonly kind: string };
    }>;
    readonly onNodeClick?: (
      event: unknown,
      node: {
        readonly id: string;
        readonly data: { readonly label: string; readonly kind: string };
      },
    ) => void;
  }) => (
    <div>
      <div data-testid="visible-node-count">{nodes.length}</div>
      <div data-testid="visible-edge-count">{edges.length}</div>
      {nodes.map((node) => (
        <button
          aria-label={`Topology node ${node.data.label}`}
          key={node.id}
          onClick={() => onNodeClick?.({}, node)}
          type="button"
        >
          {node.data.label}
        </button>
      ))}
    </div>
  ),
}));

const generateSampleTopology = async () => {
  const user = userEvent.setup();

  render(<App />);
  await user.click(screen.getByRole("button", { name: "Generate topology" }));
  await screen.findByRole("button", { name: "Topology node Checkout API" });

  return user;
};

describe("Topology Workbench", () => {
  it("imports the sample CSV and renders a topology", async () => {
    await generateSampleTopology();

    expect(
      await screen.findByRole("button", {
        name: "Topology node Checkout API",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Topology node Orders Database" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Topology node Edge WAF" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Topology node Core VPC" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Topology node IDC Direct Connect" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("visible-edge-count")).not.toHaveTextContent("0");
  });

  it("search and filters reduce visible nodes", async () => {
    const user = await generateSampleTopology();
    const originalCount = Number(
      screen.getByTestId("visible-node-count").textContent,
    );

    await user.type(
      screen.getByRole("searchbox", { name: "Search topology" }),
      "Orders",
    );

    const searchCount = Number(
      screen.getByTestId("visible-node-count").textContent,
    );
    expect(searchCount).toBeLessThan(originalCount);
    expect(
      screen.getByRole("button", { name: "Topology node Orders Database" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Topology node Checkout API" }),
    ).not.toBeInTheDocument();

    await user.clear(
      screen.getByRole("searchbox", { name: "Search topology" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Environment" }),
      "dev",
    );

    const filterCount = Number(
      screen.getByTestId("visible-node-count").textContent,
    );
    expect(filterCount).toBeLessThan(originalCount);
    expect(
      screen.getByRole("button", { name: "Topology node Settlement Worker" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Topology node Orders Database" }),
    ).not.toBeInTheDocument();
  });

  it("clicking a node opens the inspector with source row IDs", async () => {
    const user = await generateSampleTopology();

    await user.click(
      await screen.findByRole("button", {
        name: "Topology node Orders Database",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Orders Database" }),
    ).toBeInTheDocument();
    expect(screen.getByText("data_resource")).toBeInTheDocument();
    expect(screen.getByText("row-4")).toBeInTheDocument();
  });

  it("regenerating clears active filters", async () => {
    const user = await generateSampleTopology();
    const originalCount = Number(
      screen.getByTestId("visible-node-count").textContent,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Environment" }),
      "dev",
    );
    expect(
      Number(screen.getByTestId("visible-node-count").textContent),
    ).toBeLessThan(originalCount);

    await user.click(screen.getByRole("button", { name: "Generate topology" }));
    await screen.findByRole("button", { name: "Topology node Checkout API" });

    expect(screen.getByRole("combobox", { name: "Environment" })).toHaveValue(
      "",
    );
    expect(Number(screen.getByTestId("visible-node-count").textContent)).toBe(
      originalCount,
    );
  });

  it("batch accepts medium-confidence suggestions", async () => {
    const user = await generateSampleTopology();

    expect(
      screen.getByRole("button", { name: "Topology node Checkout API" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Medium confidence")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Accept medium-confidence suggestions",
      }),
    );

    expect(screen.queryByText("Medium confidence")).not.toBeInTheDocument();
    expect(screen.getByText("No reviewed assets waiting.")).toBeInTheDocument();
  });

  it("renders the import rail and canvas region", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Topology Workbench" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Import asset inventory")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Topology canvas" }),
    ).toBeInTheDocument();
  });
});
