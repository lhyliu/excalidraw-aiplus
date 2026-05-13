import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";

import App from "./App";

describe("Topology Workbench shell", () => {
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
