import { validateTopologyPatch } from "../patch/patch";

import type {
  PatchSummary,
  PatchValidationRisk,
  Topology,
  TopologyNode,
  TopologyPatch,
  TopologyPatchOperation,
} from "../domain/types";

const slug = (input: string) =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "general";

const searchable = (node: TopologyNode) =>
  [
    node.id,
    node.label,
    node.resourceType,
    node.environment,
    node.businessDomain,
    node.application,
    node.system,
    node.kind,
    node.layer,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const normalizeSearchText = (input: string) =>
  input.toLowerCase().replace(/[_:-]+/g, " ");

const tokens = (input: string) =>
  normalizeSearchText(input)
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter(Boolean);

const includesTerm = (input: string, term: string) => {
  const normalizedInput = normalizeSearchText(input);
  const normalizedTerm = normalizeSearchText(term).trim();

  if (!normalizedTerm) {
    return false;
  }
  if (normalizedTerm.includes(" ")) {
    return normalizedInput.includes(normalizedTerm);
  }

  return tokens(normalizedInput).includes(normalizedTerm);
};

const includesAny = (input: string, terms: readonly string[]) =>
  terms.some((term) => includesTerm(input, term));

const hasEdge = (
  topology: Topology,
  sourceId: string,
  targetId: string,
  kind: string,
) =>
  topology.edges.some(
    (edge) =>
      edge.sourceId === sourceId &&
      edge.targetId === targetId &&
      edge.kind === kind,
  );

const businessDomainNode = (id: string, label: string) => ({
  id,
  label,
  kind: "business_domain" as const,
  layer: "business" as const,
  sourceRows: [],
  data: { proposedBy: "local-assistant" },
});

const findById = (topology: Topology, nodeId: string) =>
  topology.nodes.find((node) => node.id === nodeId);

const operationLabel = (
  topology: Topology,
  operation: TopologyPatchOperation,
) => {
  switch (operation.type) {
    case "addNode":
      return `Add node ${operation.node.label}`;
    case "updateNode": {
      const node = findById(topology, operation.nodeId);
      const label = node?.label ?? operation.nodeId;
      if (operation.changes.data?.hidden) {
        return `Hide ${label}`;
      }
      if (operation.changes.data?.validationRisk) {
        return `Annotate database risk on ${label}`;
      }
      if (operation.changes.layer === "middleware") {
        return `Move ${label} to middleware`;
      }
      if (operation.changes.businessDomain) {
        return `Move ${label} to ${operation.changes.businessDomain} domain`;
      }
      return `Update ${label}`;
    }
    case "removeNode":
      return `Remove node ${operation.nodeId}`;
    case "addEdge":
      return operation.edge.label
        ? operation.edge.label
        : `Add ${operation.edge.kind} edge`;
    case "updateEdge":
      return `Update edge ${operation.edgeId}`;
    case "removeEdge":
      return `Remove edge ${operation.edgeId}`;
  }
};

const operationWarning = (
  topology: Topology,
  operation: TopologyPatchOperation,
): PatchValidationRisk | undefined => {
  if (operation.type !== "updateNode" || !operation.changes.data) {
    return undefined;
  }

  const message =
    typeof operation.changes.data.validationRisk === "string"
      ? operation.changes.data.validationRisk
      : undefined;

  if (!message) {
    return undefined;
  }

  const node = findById(topology, operation.nodeId);

  return {
    severity: "warning",
    code: "operation_warning",
    operationId: operation.id,
    message: `${node?.label ?? operation.nodeId}: ${message}`,
  };
};

const redisCacheOperations = (topology: Topology): TopologyPatchOperation[] =>
  topology.nodes
    .filter((node) => includesAny(searchable(node), ["redis", "cache"]))
    .map((node) => ({
      id: `cache-layer-${slug(node.id)}`,
      type: "updateNode" as const,
      nodeId: node.id,
      changes: {
        layer: "middleware" as const,
        data: {
          role: "cache",
          patchReason: "Cache resources belong in the middleware layer.",
        },
      },
    }));

const paymentOrderOperations = (
  topology: Topology,
): TopologyPatchOperation[] => {
  const operations: TopologyPatchOperation[] = [];
  const nodeIds = new Set(topology.nodes.map((node) => node.id));

  if (!nodeIds.has("business-domain:payment")) {
    operations.push({
      id: "add-business-domain-payment",
      type: "addNode",
      node: businessDomainNode("business-domain:payment", "Payment"),
    });
  }

  if (!nodeIds.has("business-domain:order")) {
    operations.push({
      id: "add-business-domain-order",
      type: "addNode",
      node: businessDomainNode("business-domain:order", "Order"),
    });
  }

  for (const node of topology.nodes) {
    const haystack = searchable(node);
    const isPayment =
      includesAny(haystack, ["payment", "payments", "checkout"]) &&
      !node.id.startsWith("business-domain:");
    const isOrder =
      includesAny(haystack, ["order", "orders"]) &&
      !node.id.startsWith("business-domain:");

    if (isPayment) {
      operations.push({
        id: `payment-domain-${slug(node.id)}`,
        type: "updateNode",
        nodeId: node.id,
        changes: {
          businessDomain: "Payment",
          parentId: "business-domain:payment",
          data: { domainSplit: "payment" },
        },
      });
    } else if (isOrder) {
      operations.push({
        id: `order-domain-${slug(node.id)}`,
        type: "updateNode",
        nodeId: node.id,
        changes: {
          businessDomain: "Order",
          parentId: "business-domain:order",
          data: { domainSplit: "order" },
        },
      });
    }
  }

  return operations;
};

const leasedLineOperations = (topology: Topology): TopologyPatchOperation[] => {
  const idc = topology.nodes.find((node) =>
    includesAny(searchable(node), ["idc", "direct connect", "leased_line"]),
  );
  const vpc = topology.nodes.find((node) =>
    includesAny(searchable(node), ["vpc"]),
  );

  if (!idc || !vpc || hasEdge(topology, idc.id, vpc.id, "network_connects")) {
    return [];
  }

  return [
    {
      id: `leased-line-${slug(idc.id)}-to-${slug(vpc.id)}`,
      type: "addEdge",
      edge: {
        id: `edge:${slug(idc.id)}:leased-line:${slug(vpc.id)}`,
        sourceId: idc.id,
        targetId: vpc.id,
        kind: "network_connects",
        label: "leased line",
        sourceRows: [...new Set([...idc.sourceRows, ...vpc.sourceRows])],
        data: { connectionType: "leased_line" },
      },
    },
  ];
};

const databaseRiskOperations = (topology: Topology): TopologyPatchOperation[] =>
  topology.nodes
    .filter((node) =>
      includesAny(searchable(node), [
        "database",
        "db",
        "mysql",
        "postgres",
        "rds",
        "sql",
      ]),
    )
    .map((node) => ({
      id: `database-risk-${slug(node.id)}`,
      type: "updateNode" as const,
      nodeId: node.id,
      changes: {
        data: {
          risk: "database",
          riskLevel: "review",
          validationRisk:
            "Verify backups, encryption, and retention before production approval.",
        },
      },
    }));

const hideEnvironmentOperations = (
  topology: Topology,
): TopologyPatchOperation[] =>
  topology.nodes
    .filter((node) => {
      const environment = node.environment?.toLowerCase();

      return environment === "test" || environment === "dev";
    })
    .map((node) => ({
      id: `hide-environment-${slug(node.id)}`,
      type: "updateNode" as const,
      nodeId: node.id,
      changes: {
        data: {
          hidden: true,
          visibility: "hidden",
        },
      },
    }));

export const proposeTopologyPatch = (
  topology: Topology,
  instruction: string,
): TopologyPatch => {
  const normalized = instruction.toLowerCase();
  const operations: TopologyPatchOperation[] = [];

  if (includesAny(normalized, ["redis", "cache"])) {
    operations.push(...redisCacheOperations(topology));
  }

  if (
    includesAny(normalized, ["payment", "payments"]) &&
    includesAny(normalized, ["order", "orders", "domain"])
  ) {
    operations.push(...paymentOrderOperations(topology));
  }

  if (
    includesAny(normalized, [
      "idc",
      "direct connect",
      "leased-line",
      "leased line",
    ]) &&
    includesAny(normalized, ["vpc"])
  ) {
    operations.push(...leasedLineOperations(topology));
  }

  if (includesAny(normalized, ["database", "db", "rds", "risk"])) {
    operations.push(...databaseRiskOperations(topology));
  }

  if (
    includesAny(normalized, ["hide", "hidden"]) &&
    includesAny(normalized, ["test", "dev", "environment"])
  ) {
    operations.push(...hideEnvironmentOperations(topology));
  }

  return {
    id: `topology-patch-${slug(instruction).slice(0, 64)}`,
    instruction,
    operations,
  };
};

export const summarizePatch = (
  topology: Topology,
  patch: TopologyPatch,
): PatchSummary => {
  const enabledOperations = patch.operations.filter(
    (operation) => operation.enabled !== false,
  );
  const validation = validateTopologyPatch(topology, patch);
  const warnings = enabledOperations
    .map((operation) => operationWarning(topology, operation))
    .filter((item): item is PatchValidationRisk => Boolean(item));
  const operationLabels = enabledOperations.map((operation) =>
    operationLabel(topology, operation),
  );

  return {
    title: "Topology patch",
    description:
      enabledOperations.length > 0
        ? `Review ${enabledOperations.length} proposed topology operation(s).`
        : "No supported topology operations were found for this instruction.",
    operationCount: patch.operations.length,
    enabledOperationCount: enabledOperations.length,
    operationLabels,
    validationRisks: [...validation.risks, ...warnings],
  };
};
