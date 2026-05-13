import { useCallback, useEffect, useMemo, useState } from "react";

import { Inspector } from "./components/Inspector";
import { ImportPanel, SAMPLE_CSV } from "./components/ImportPanel";
import { ReadinessPanel } from "./components/ReadinessPanel";
import { ReviewQueue } from "./components/ReviewQueue";
import { Toolbar } from "./components/Toolbar";
import { TopologyCanvas } from "./components/TopologyCanvas";

import { parseCsvInventory } from "./import/csv";
import { mapImportFields, scoreImportReadiness } from "./import/mapping";
import { layoutTopology } from "./layout/layout";
import { classifyAssets } from "./pipeline/classify";
import { normalizeAssets } from "./pipeline/normalize";
import { buildTopology, filterTopology } from "./pipeline/topology";

import type {
  ClassifiedAsset,
  ClassificationIssue,
  DataQualityIssue,
  ImportReadinessReport,
  ImportWarning,
  LayoutResult,
  Topology,
  TopologyFilters,
  TopologyNode,
} from "./domain/types";

const uniqueSorted = (values: Array<string | undefined>) =>
  Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b));

const toLayout = async (topology: Topology) =>
  layoutTopology(topology, { preservePinned: true });

const filteredLayout = (
  layout: LayoutResult | undefined,
  topology: Topology | undefined,
  filters: TopologyFilters,
): LayoutResult | undefined => {
  if (!layout || !topology) {
    return undefined;
  }

  const filtered = filterTopology(topology, filters);
  const visibleNodeIds = new Set(filtered.nodes.map((node) => node.id));
  const visibleEdgeIds = new Set(filtered.edges.map((edge) => edge.id));

  return {
    ...layout,
    nodes: layout.nodes.filter((node) => visibleNodeIds.has(node.id)),
    edges: layout.edges.filter((edge) => visibleEdgeIds.has(edge.id)),
  };
};

export default function App() {
  const [csvInput, setCsvInput] = useState(SAMPLE_CSV);
  const [isGenerating, setIsGenerating] = useState(false);
  const [readiness, setReadiness] = useState<ImportReadinessReport>();
  const [importWarnings, setImportWarnings] = useState<ImportWarning[]>([]);
  const [normalizationIssues, setNormalizationIssues] = useState<
    DataQualityIssue[]
  >([]);
  const [classificationIssues, setClassificationIssues] = useState<
    ClassificationIssue[]
  >([]);
  const [generationError, setGenerationError] = useState<string>();
  const [classifiedAssets, setClassifiedAssets] = useState<ClassifiedAsset[]>(
    [],
  );
  const [topology, setTopology] = useState<Topology>();
  const [layout, setLayout] = useState<LayoutResult>();
  const [filters, setFilters] = useState<TopologyFilters>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string>();

  const options = useMemo(
    () => ({
      environments: uniqueSorted(
        topology?.nodes.map((node) => node.environment) ?? [],
      ),
      businessDomains: uniqueSorted(
        topology?.nodes.map((node) => node.businessDomain) ?? [],
      ),
      resourceTypes: uniqueSorted(
        topology?.nodes.map((node) => node.resourceType) ?? [],
      ),
    }),
    [topology],
  );

  const visibleLayout = useMemo(
    () => filteredLayout(layout, topology, filters),
    [filters, layout, topology],
  );

  const selectedNode = useMemo(() => {
    if (
      !selectedNodeId ||
      !topology ||
      !visibleLayout?.nodes.some((node) => node.id === selectedNodeId)
    ) {
      return undefined;
    }

    return topology.nodes.find((node) => node.id === selectedNodeId);
  }, [selectedNodeId, topology, visibleLayout]);

  useEffect(() => {
    if (
      selectedNodeId &&
      visibleLayout &&
      !visibleLayout.nodes.some((node) => node.id === selectedNodeId)
    ) {
      setSelectedNodeId(undefined);
    }
  }, [selectedNodeId, visibleLayout]);

  const rebuildTopology = useCallback(async (assets: ClassifiedAsset[]) => {
    const nextTopology = buildTopology(assets);
    const nextLayout = await toLayout(nextTopology);

    setTopology(nextTopology);
    setLayout(nextLayout);
  }, []);

  const generateTopology = useCallback(async () => {
    setIsGenerating(true);
    setGenerationError(undefined);
    try {
      const table = parseCsvInventory(csvInput);
      const mapping = mapImportFields(table.headers);
      const nextReadiness = scoreImportReadiness(table, mapping);
      const normalized = normalizeAssets(table, mapping);
      const classified = classifyAssets(normalized.assets);
      const nextTopology = buildTopology(classified.assets);
      const nextLayout = await toLayout(nextTopology);

      setReadiness(nextReadiness);
      setImportWarnings(table.warnings);
      setNormalizationIssues(normalized.issues);
      setClassificationIssues(classified.issues);
      setClassifiedAssets(classified.assets);
      setTopology(nextTopology);
      setLayout(nextLayout);
      setFilters({});
      setSelectedNodeId(undefined);
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "Failed to generate topology.",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [csvInput]);

  const acceptMediumConfidence = useCallback(async () => {
    const acceptedAssets = classifiedAssets.map((asset) =>
      asset.confidence === "medium"
        ? { ...asset, reviewRequired: false }
        : asset,
    );

    setClassifiedAssets(acceptedAssets);
    await rebuildTopology(acceptedAssets);
  }, [classifiedAssets, rebuildTopology]);

  const relayout = useCallback(async () => {
    if (topology) {
      setLayout(await toLayout(topology));
    }
  }, [topology]);

  const selectNode = useCallback((node: TopologyNode) => {
    setSelectedNodeId(node.id);
  }, []);

  return (
    <main className="topology-workbench">
      <aside className="import-rail" aria-label="Import controls">
        <ImportPanel
          csvInput={csvInput}
          isGenerating={isGenerating}
          onCsvInputChange={setCsvInput}
          onGenerate={generateTopology}
          onLoadSample={() => setCsvInput(SAMPLE_CSV)}
          readiness={readiness}
        />
        <ReadinessPanel
          classificationIssues={classificationIssues}
          generationError={generationError}
          importWarnings={importWarnings}
          normalizationIssues={normalizationIssues}
          readiness={readiness}
        />
        <ReviewQueue
          assets={classifiedAssets}
          onAcceptMedium={acceptMediumConfidence}
        />
      </aside>

      <section className="workspace" aria-labelledby="topology-title">
        <header className="workspace-header">
          <div>
            <p className="workspace-kicker">Cloud architecture</p>
            <h1 id="topology-title">Topology Workbench</h1>
          </div>
          <Toolbar
            businessDomains={options.businessDomains}
            environments={options.environments}
            filters={filters}
            onFiltersChange={setFilters}
            onRelayout={relayout}
            resourceTypes={options.resourceTypes}
          />
        </header>

        <TopologyCanvas layout={visibleLayout} onSelectNode={selectNode} />
      </section>

      <Inspector node={selectedNode} />
    </main>
  );
}
