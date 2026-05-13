import type {
  ClassificationIssue,
  ClassificationResult,
  ClassificationSuggestion,
  NormalizedAsset,
  TopologyLayer,
  TopologyNodeKind,
} from "../domain/types";

type Rule = {
  readonly terms: readonly string[];
  readonly nodeKind: TopologyNodeKind;
  readonly layer: TopologyLayer;
  readonly confidence: ClassificationSuggestion["confidence"];
  readonly reason: string;
};

const RULES: readonly Rule[] = [
  {
    terms: ["firewall", "waf", "安全组"],
    nodeKind: "boundary",
    layer: "boundary",
    confidence: "high",
    reason: "security boundary resource",
  },
  {
    terms: ["idc", "vpn", "leased_line", "专线"],
    nodeKind: "boundary",
    layer: "boundary",
    confidence: "high",
    reason: "connectivity boundary resource",
  },
  {
    terms: ["vpc", "subnet", "router", "switch", "gateway", "nat"],
    nodeKind: "network_resource",
    layer: "network",
    confidence: "high",
    reason: "network resource",
  },
  {
    terms: ["rds", "mysql", "postgresql", "postgres", "database", "db"],
    nodeKind: "data_resource",
    layer: "data",
    confidence: "high",
    reason: "database resource",
  },
  {
    terms: ["redis", "cache", "memcached"],
    nodeKind: "data_resource",
    layer: "middleware",
    confidence: "high",
    reason: "cache or in-memory data resource",
  },
  {
    terms: ["mq", "kafka", "rabbitmq", "rocketmq"],
    nodeKind: "cloud_resource",
    layer: "middleware",
    confidence: "high",
    reason: "messaging middleware",
  },
  {
    terms: ["lb", "slb", "elb", "load_balancer", "load balancer"],
    nodeKind: "cloud_resource",
    layer: "access",
    confidence: "high",
    reason: "load balancing resource",
  },
  {
    terms: ["k8s", "kubernetes", "ack", "eks", "aks"],
    nodeKind: "cloud_resource",
    layer: "application",
    confidence: "high",
    reason: "container orchestration resource",
  },
  {
    terms: ["ecs", "vm", "host", "server", "主机", "虚拟机"],
    nodeKind: "cloud_resource",
    layer: "application",
    confidence: "high",
    reason: "compute resource",
  },
  {
    terms: ["service", "svc", "application"],
    nodeKind: "cloud_resource",
    layer: "application",
    confidence: "medium",
    reason: "application layer service",
  },
];

const unknownSuggestion: ClassificationSuggestion = {
  nodeKind: "cloud_resource",
  layer: "unknown",
  confidence: "low",
  reason: "no deterministic classification rule matched",
};

const tokenize = (input: string) =>
  input
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter(Boolean);

const hasCjk = (input: string) => /[\u4e00-\u9fff]/.test(input);

const includesTerm = (haystack: string, term: string) => {
  const normalizedTerm = term.toLowerCase();
  if (hasCjk(normalizedTerm)) {
    return haystack.includes(normalizedTerm);
  }

  const haystackTokens = tokenize(haystack);
  const termTokens = tokenize(normalizedTerm);
  if (termTokens.length === 0) {
    return false;
  }

  return haystackTokens.some((_, index) =>
    termTokens.every(
      (termToken, termIndex) => haystackTokens[index + termIndex] === termToken,
    ),
  );
};

const classifyAsset = (asset: NormalizedAsset): ClassificationSuggestion => {
  const searchable = [asset.resourceType, asset.label, asset.identity]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const rule = RULES.find(({ terms }) =>
    terms.some((term) => includesTerm(searchable, term.toLowerCase())),
  );

  return rule
    ? {
        nodeKind: rule.nodeKind,
        layer: rule.layer,
        confidence: rule.confidence,
        reason: rule.reason,
      }
    : unknownSuggestion;
};

export const classifyAssets = (
  assets: NormalizedAsset[],
): ClassificationResult => {
  const issues: ClassificationIssue[] = [];
  const classifiedAssets = assets.map((asset) => {
    const suggestion = classifyAsset(asset);
    const reviewRequired = suggestion.confidence !== "high";

    if (suggestion.confidence === "low") {
      issues.push({
        kind: "low_confidence_classification",
        severity: "warning",
        assetId: asset.identity,
        rowId: asset.rowId,
        message: `Low confidence classification for ${asset.identity}`,
      });
    }

    return {
      ...asset,
      ...suggestion,
      reviewRequired,
    };
  });

  return { assets: classifiedAssets, issues };
};
