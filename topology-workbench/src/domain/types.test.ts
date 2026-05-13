import type { TopologyEdgeKind, TopologyNodeKind } from "./types";

describe("topology domain unions", () => {
  it("accepts spec node and edge kinds", () => {
    const nodeKinds: TopologyNodeKind[] = ["service", "external_system"];
    const edgeKinds: TopologyEdgeKind[] = [
      "calls",
      "depends_on",
      "data_flow",
      "deployed_on",
      "network_connects",
      "secured_by",
      "contains",
    ];

    expect(nodeKinds).toEqual(["service", "external_system"]);
    expect(edgeKinds).toContain("network_connects");
  });
});
