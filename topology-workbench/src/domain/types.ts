export type ImportWarningSeverity = "warning" | "error";

export type RawAssetRow = {
  readonly rowId: string;
  readonly cells: Record<string, string>;
};

export type ImportWarning = {
  readonly severity: ImportWarningSeverity;
  readonly message: string;
  readonly rowId?: string;
  readonly column?: string;
  readonly field?: string;
};

export type RawAssetTable = {
  readonly headers: string[];
  readonly rows: RawAssetRow[];
  readonly warnings: ImportWarning[];
};

export type ImportFieldMapping = {
  readonly fields: {
    readonly identity?: string;
    readonly label?: string;
    readonly resourceType?: string;
    readonly privateIp?: string;
    readonly publicIp?: string;
    readonly businessDomain?: string;
    readonly application?: string;
    readonly system?: string;
    readonly environment?: string;
    readonly provider?: string;
    readonly region?: string;
    readonly account?: string;
    readonly cidr?: string;
    readonly zone?: string;
    readonly owner?: string;
    readonly vpc?: string;
    readonly subnet?: string;
    readonly securityGroup?: string;
    readonly gateway?: string;
    readonly loadBalancer?: string;
    readonly tags?: string;
    readonly risk?: string;
    readonly criticality?: string;
    readonly costCenter?: string;
    readonly description?: string;
    readonly dependsOn?: string;
    readonly connectsTo?: string;
    readonly calls?: string;
  };
  readonly unmappedHeaders: string[];
};

export type ImportReadinessLevel = "high" | "medium" | "low";

export type ImportReadinessReport = {
  readonly level: ImportReadinessLevel;
  readonly resolvedRows: number;
  readonly totalRows: number;
  readonly blockingIssues: string[];
  readonly warnings: string[];
};

export type DataQualityIssueKind =
  | "missing_identity"
  | "missing_label"
  | "duplicate_identity"
  | "invalid_ip"
  | "invalid_cidr";

export type DataQualityIssue = {
  readonly kind: DataQualityIssueKind;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly rowId: string;
  readonly field?: string;
  readonly value?: string;
};

export type NormalizedAsset = {
  readonly rowId: string;
  readonly identity: string;
  readonly label: string;
  readonly resourceType?: string;
  readonly privateIps: string[];
  readonly publicIps: string[];
  readonly cidrs: string[];
  readonly businessDomain?: string;
  readonly application?: string;
  readonly system?: string;
  readonly environment?: string;
  readonly provider?: string;
  readonly region?: string;
  readonly account?: string;
  readonly tags: Record<string, string>;
  readonly relationships: {
    readonly dependsOn: string[];
    readonly connectsTo: string[];
    readonly calls: string[];
  };
  readonly raw: Record<string, string>;
};

export type NormalizationResult = {
  readonly assets: NormalizedAsset[];
  readonly issues: DataQualityIssue[];
};

export type TopologyNodeKind =
  | "business_domain"
  | "application"
  | "system"
  | "service"
  | "external_system"
  | "cloud_resource"
  | "data_resource"
  | "network_resource"
  | "boundary";

export type TopologyEdgeKind =
  | "calls"
  | "depends_on"
  | "connects_to"
  | "data_flow"
  | "deployed_on"
  | "network_connects"
  | "secured_by"
  | "contains";

export type TopologyLayer =
  | "business"
  | "application"
  | "access"
  | "middleware"
  | "data"
  | "network"
  | "boundary"
  | "unknown";

export type ClassificationConfidence = "high" | "medium" | "low";

export type ClassificationSuggestion = {
  readonly nodeKind: TopologyNodeKind;
  readonly layer: TopologyLayer;
  readonly confidence: ClassificationConfidence;
  readonly reason: string;
};

export type ClassifiedAsset = NormalizedAsset &
  ClassificationSuggestion & {
    readonly reviewRequired: boolean;
  };

export type ClassificationIssue = {
  readonly kind: "low_confidence_classification";
  readonly severity: "warning";
  readonly assetId: string;
  readonly rowId: string;
  readonly message: string;
};

export type ClassificationResult = {
  readonly assets: ClassifiedAsset[];
  readonly issues: ClassificationIssue[];
};

export type TopologyPosition = {
  readonly x: number;
  readonly y: number;
};

export type TopologyNode = {
  readonly id: string;
  readonly label: string;
  readonly kind: TopologyNodeKind;
  readonly layer: TopologyLayer;
  readonly sourceRows: string[];
  readonly parentId?: string;
  readonly confidence?: ClassificationConfidence;
  readonly reviewRequired?: boolean;
  readonly resourceType?: string;
  readonly environment?: string;
  readonly businessDomain?: string;
  readonly application?: string;
  readonly system?: string;
  readonly position?: TopologyPosition;
  readonly pinnedPosition?: TopologyPosition;
  readonly data: Record<string, unknown>;
};

export type TopologyEdge = {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly kind: TopologyEdgeKind;
  readonly sourceRows: string[];
  readonly label?: string;
  readonly data?: Record<string, unknown>;
};

export type Topology = {
  readonly nodes: TopologyNode[];
  readonly edges: TopologyEdge[];
};

export type TopologyFilters = {
  readonly search?: string;
  readonly environment?: string;
  readonly businessDomain?: string;
  readonly resourceType?: string;
  readonly nodeKind?: TopologyNodeKind;
  readonly networkOnly?: boolean;
};

export type LayoutOptions = {
  readonly forceFallback?: boolean;
  readonly preservePinned?: boolean;
};

export type PositionedTopologyNode = TopologyNode & {
  readonly position: TopologyPosition;
};

export type LayoutResult = {
  readonly nodes: PositionedTopologyNode[];
  readonly edges: TopologyEdge[];
  readonly engine: "elk" | "dagre";
};
