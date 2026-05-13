import { useCallback, useEffect, useMemo, useState } from "react";

import { Inspector } from "./components/Inspector";
import { ImportPanel, SAMPLE_CSV } from "./components/ImportPanel";
import { PatchReview } from "./components/PatchReview";
import { ReadinessPanel } from "./components/ReadinessPanel";
import { ReviewQueue } from "./components/ReviewQueue";
import { Toolbar } from "./components/Toolbar";
import { TopologyCanvas } from "./components/TopologyCanvas";

import { proposeTopologyPatch, summarizePatch } from "./ai/assistant";
import { parseCsvInventory } from "./import/csv";
import { mapImportFields, scoreImportReadiness } from "./import/mapping";
import { layoutTopology } from "./layout/layout";
import {
  applyTopologyPatch,
  rollbackTopologyPatch,
  validateTopologyPatch,
} from "./patch/patch";
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
  PatchApplyResult,
  Topology,
  TopologyFilters,
  TopologyNode,
  TopologyPatch,
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

const hasEnabledPatchOperations = (patch: TopologyPatch) =>
  patch.operations.some((operation) => operation.enabled !== false);

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
  const [patchInstruction, setPatchInstruction] = useState("");
  const [proposedPatch, setProposedPatch] = useState<TopologyPatch>();
  const [lastPatchResult, setLastPatchResult] = useState<PatchApplyResult>();

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

  const patchValidation = useMemo(
    () =>
      topology && proposedPatch
        ? validateTopologyPatch(topology, proposedPatch)
        : undefined,
    [proposedPatch, topology],
  );

  const patchSummary = useMemo(
    () =>
      topology && proposedPatch
        ? summarizePatch(topology, proposedPatch)
        : undefined,
    [proposedPatch, topology],
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
      setProposedPatch(undefined);
      setLastPatchResult(undefined);
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "Failed to generate topology.",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [csvInput]);

  const acceptMediumConfidence = useCallback(async () => {
    const acceptedAssetIds = new Set(
      classifiedAssets
        .filter((asset) => asset.confidence === "medium")
        .map((asset) => `asset:${asset.identity}`),
    );
    const acceptedAssets = classifiedAssets.map((asset) =>
      asset.confidence === "medium"
        ? { ...asset, reviewRequired: false }
        : asset,
    );

    setClassifiedAssets(acceptedAssets);
    setLastPatchResult(undefined);
    setProposedPatch(undefined);

    if (topology) {
      const nextTopology = {
        ...topology,
        nodes: topology.nodes.map((node) =>
          acceptedAssetIds.has(node.id)
            ? { ...node, reviewRequired: false }
            : node,
        ),
      };

      setTopology(nextTopology);
      setLayout(await toLayout(nextTopology));
    }
  }, [classifiedAssets, topology]);

  const relayout = useCallback(async () => {
    if (topology) {
      setLayout(await toLayout(topology));
    }
  }, [topology]);

  const selectNode = useCallback((node: TopologyNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const proposePatch = useCallback(() => {
    if (!topology || !patchInstruction.trim()) {
      return;
    }

    setProposedPatch(proposeTopologyPatch(topology, patchInstruction));
  }, [patchInstruction, topology]);

  const togglePatchOperation = useCallback(
    (operationId: string, enabled: boolean) => {
      setProposedPatch((current) =>
        current
          ? {
              ...current,
              operations: current.operations.map((operation) =>
                operation.id === operationId
                  ? { ...operation, enabled }
                  : operation,
              ),
            }
          : current,
      );
    },
    [],
  );

  const applyPatch = useCallback(async () => {
    if (
      !topology ||
      !proposedPatch ||
      !hasEnabledPatchOperations(proposedPatch)
    ) {
      return;
    }

    const result = applyTopologyPatch(topology, proposedPatch);

    if (!result.validation.valid) {
      return;
    }

    setTopology(result.topology);
    setLayout(await toLayout(result.topology));
    setLastPatchResult(result);
    setProposedPatch(undefined);
    setSelectedNodeId(undefined);
  }, [proposedPatch, topology]);

  const rejectPatch = useCallback(() => {
    setProposedPatch(undefined);
  }, []);

  const rollbackPatch = useCallback(async () => {
    if (!lastPatchResult) {
      return;
    }

    const rolledBackTopology = rollbackTopologyPatch(lastPatchResult);

    setTopology(rolledBackTopology);
    setLayout(await toLayout(rolledBackTopology));
    setLastPatchResult(undefined);
    setSelectedNodeId(undefined);
  }, [lastPatchResult]);

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
        <PatchReview
          canPropose={Boolean(topology && patchInstruction.trim())}
          canRollback={Boolean(lastPatchResult)}
          instruction={patchInstruction}
          onApply={applyPatch}
          onInstructionChange={setPatchInstruction}
          onPropose={proposePatch}
          onReject={rejectPatch}
          onRollback={rollbackPatch}
          onToggleOperation={togglePatchOperation}
          patch={proposedPatch}
          summary={patchSummary}
          validation={patchValidation}
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
