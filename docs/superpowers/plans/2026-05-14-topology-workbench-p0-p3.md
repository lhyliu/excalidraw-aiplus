# Topology Workbench P0-P3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new asset-inventory-driven topology workbench beside the legacy Excalidraw app, covering P0 through P3 from the approved restart spec.

**Architecture:** Create a new `topology-workbench/` workspace with a structured topology domain model, deterministic import/normalization/classification pipeline, React Flow canvas, ELK/Dagre layout, reviewed AI patch workflow, and export/import extensions. The legacy Excalidraw code remains untouched except for workspace-level package metadata.

**Tech Stack:** Latest stable/LTS-compatible React 19, TypeScript, Vite, Vitest, `@xyflow/react`, `elkjs`, `@dagrejs/dagre`, `papaparse`, `read-excel-file`, `html-to-image`.

---

## File Structure

- Modify: `package.json` to add `topology-workbench` to Yarn workspaces and scripts.
- Modify: `tsconfig.json` to include `topology-workbench`.
- Create: `topology-workbench/package.json` with app scripts and runtime dependencies.
- Create: `topology-workbench/index.html`, `topology-workbench/tsconfig.json`, `topology-workbench/vite.config.mts`.
- Create: `topology-workbench/src/domain/types.ts` for canonical asset, topology, layout, patch, and UI-state types.
- Create: `topology-workbench/src/import/csv.ts` and `topology-workbench/src/import/xlsx.ts` for CSV/XLSX ingestion.
- Create: `topology-workbench/src/import/mapping.ts` for field alias mapping and readiness scoring.
- Create: `topology-workbench/src/pipeline/normalize.ts`, `classify.ts`, `topology.ts` for data processing.
- Create: `topology-workbench/src/layout/layout.ts` for ELK/Dagre layout conversion.
- Create: `topology-workbench/src/patch/patch.ts`, `topology-workbench/src/ai/assistant.ts` for patch validation, rollback, and deterministic natural-language patch proposal generation.
- Create: `topology-workbench/src/export/exporters.ts` for JSON/SVG/PNG export.
- Create: `topology-workbench/src/components/*` for import, review, canvas, inspector, patch review, and export UI.
- Create: `topology-workbench/src/App.tsx`, `topology-workbench/src/main.tsx`, `topology-workbench/src/styles.css`.
- Create tests beside implementation files as `*.test.ts` or `*.test.tsx`.

## Shared Acceptance Rules

- Do not modify legacy Excalidraw feature code while building the new workbench.
- Keep the canonical topology independent of React Flow, ELK, and AI provider APIs.
- Use test-first development for domain behavior.
- P0 must work without AI.
- P2 AI functionality may be deterministic/local for this implementation; it must still return reviewed `TopologyPatch` proposals.
- Exports must not require a backend service.

### Task 1: Workspace And App Shell

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `topology-workbench/package.json`
- Create: `topology-workbench/index.html`
- Create: `topology-workbench/tsconfig.json`
- Create: `topology-workbench/vite.config.mts`
- Create: `topology-workbench/src/main.tsx`
- Create: `topology-workbench/src/App.tsx`
- Create: `topology-workbench/src/styles.css`

- [ ] **Step 1: Add workspace metadata**

Add `topology-workbench` to root workspaces and scripts:

```json
{
  "workspaces": [
    "excalidraw-app",
    "packages/*",
    "examples/*",
    "topology-workbench"
  ],
  "scripts": {
    "start:topology": "yarn --cwd ./topology-workbench start",
    "build:topology": "yarn --cwd ./topology-workbench build",
    "test:topology": "yarn --cwd ./topology-workbench test --run",
    "test:topology:watch": "yarn --cwd ./topology-workbench test"
  }
}
```

- [ ] **Step 2: Create package shell**

Create `topology-workbench/package.json`:

```json
{
  "name": "topology-workbench",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.19.0"
  },
  "scripts": {
    "start": "vite --host 0.0.0.0",
    "build": "tsc --noEmit && vite build",
    "test": "vitest",
    "preview": "vite preview --host 0.0.0.0"
  },
  "dependencies": {
    "@dagrejs/dagre": "3.0.0",
    "@xyflow/react": "12.10.2",
    "elkjs": "0.11.1",
    "html-to-image": "1.11.13",
    "papaparse": "5.5.3",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "read-excel-file": "9.0.9"
  },
  "devDependencies": {
    "@testing-library/dom": "10.4.1",
    "@testing-library/jest-dom": "6.9.1",
    "@testing-library/react": "16.3.2",
    "@testing-library/user-event": "14.6.1",
    "@types/papaparse": "5.5.2",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.1",
    "jsdom": "29.1.1",
    "typescript": "6.0.3",
    "vite": "8.0.12",
    "vitest": "4.1.6"
  }
}
```

- [ ] **Step 3: Create minimal app**

Create a Vite React app that renders the title `Topology Workbench`, an import rail with the text `Import asset inventory`, and a canvas region with the text `Topology canvas`.

- [ ] **Step 4: Verify shell**

Run:

```bash
npx -y yarn@1.22.22 install
npx -y yarn@1.22.22 test:topology
npx -y yarn@1.22.22 build:topology
```

Expected: install succeeds, no tests fail, build succeeds.

### Task 2: P0/P1 Import Contract, Mapping, Normalization, Classification

**Files:**
- Create: `topology-workbench/src/domain/types.ts`
- Create: `topology-workbench/src/import/csv.ts`
- Create: `topology-workbench/src/import/xlsx.ts`
- Create: `topology-workbench/src/import/mapping.ts`
- Create: `topology-workbench/src/pipeline/normalize.ts`
- Create: `topology-workbench/src/pipeline/classify.ts`
- Test: `topology-workbench/src/import/*.test.ts`
- Test: `topology-workbench/src/pipeline/*.test.ts`

- [ ] **Step 1: Write failing import tests**

Tests must prove:

- CSV headers and rows parse with stable `rowId`.
- Common aliases such as `instance_id`, `resource_id`, `service_type`, `private_ip`, `业务域`, `应用` map into canonical fields.
- Readiness is `high`, `medium`, or `low`.
- XLSX rows can parse into the same `RawAssetTable`.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npx -y yarn@1.22.22 --cwd topology-workbench test src/import src/pipeline --run
```

Expected: tests fail because modules do not exist or functions are unimplemented.

- [ ] **Step 3: Implement import and mapping**

Expose these functions:

```ts
parseCsvInventory(input: string): RawAssetTable
parseXlsxInventory(file: File): Promise<RawAssetTable>
mapImportFields(headers: string[]): ImportFieldMapping
scoreImportReadiness(table: RawAssetTable, mapping: ImportFieldMapping): ImportReadinessReport
```

- [ ] **Step 4: Write failing normalization and classification tests**

Tests must prove:

- hostnames, IPs, CIDRs, environments, providers, regions, tags, and relationship columns normalize predictably.
- duplicate identity rows produce warning issues, not crashes.
- ECS/Kubernetes/LB/RDS/Redis/MQ/VPC/Subnet/Gateway/Firewall/IDC rows classify into correct topology node kinds, layers, and confidence tiers.

- [ ] **Step 5: Implement normalization and classification**

Expose these functions:

```ts
normalizeAssets(table: RawAssetTable, mapping: ImportFieldMapping): NormalizationResult
classifyAssets(assets: NormalizedAsset[]): ClassificationResult
```

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npx -y yarn@1.22.22 --cwd topology-workbench test src/import src/pipeline --run
```

Expected: all import, mapping, normalization, and classification tests pass.

### Task 3: P0/P1 Topology Core And Layout

**Files:**
- Create: `topology-workbench/src/pipeline/topology.ts`
- Create: `topology-workbench/src/layout/layout.ts`
- Test: `topology-workbench/src/pipeline/topology.test.ts`
- Test: `topology-workbench/src/layout/layout.test.ts`

- [ ] **Step 1: Write failing topology tests**

Tests must prove:

- classified assets become business/domain/application/resource/boundary nodes.
- `depends_on`, `connects_to`, and `calls` columns become semantic edges.
- source row provenance remains on nodes and edges.
- filters can select by environment, business domain, and resource type.

- [ ] **Step 2: Implement topology core**

Expose these functions:

```ts
buildTopology(classified: ClassifiedAsset[]): Topology
filterTopology(topology: Topology, filters: TopologyFilters): Topology
getNodeSourceRows(topology: Topology, nodeId: string): string[]
```

- [ ] **Step 3: Write failing layout tests**

Tests must prove:

- `layoutTopology()` returns positioned nodes.
- pinned node positions are preserved.
- local relayout can update only unpinned nodes.
- Dagre fallback returns positions if ELK fails.

- [ ] **Step 4: Implement layout engine**

Expose:

```ts
layoutTopology(topology: Topology, options?: LayoutOptions): Promise<LayoutResult>
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npx -y yarn@1.22.22 --cwd topology-workbench test src/pipeline/topology.test.ts src/layout/layout.test.ts --run
```

Expected: topology and layout tests pass.

### Task 4: P0/P1 React Flow Product UI

**Files:**
- Create: `topology-workbench/src/components/ImportPanel.tsx`
- Create: `topology-workbench/src/components/ReadinessPanel.tsx`
- Create: `topology-workbench/src/components/ReviewQueue.tsx`
- Create: `topology-workbench/src/components/TopologyCanvas.tsx`
- Create: `topology-workbench/src/components/Inspector.tsx`
- Create: `topology-workbench/src/components/Toolbar.tsx`
- Modify: `topology-workbench/src/App.tsx`
- Modify: `topology-workbench/src/styles.css`
- Test: `topology-workbench/src/App.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Tests must prove:

- importing the sample CSV renders a topology.
- search and filters reduce visible nodes.
- clicking a node opens the inspector with source row IDs.
- medium-confidence suggestions can be batch accepted.

- [ ] **Step 2: Implement UI**

Build a single-screen workbench with:

- left import/review rail
- center React Flow canvas
- top toolbar with search, filters, relayout, export actions
- right inspector

- [ ] **Step 3: Verify UI tests**

Run:

```bash
npx -y yarn@1.22.22 --cwd topology-workbench test src/App.test.tsx --run
```

Expected: UI tests pass.

### Task 5: P2 AI Patch And Patch Review

**Files:**
- Create: `topology-workbench/src/patch/patch.ts`
- Create: `topology-workbench/src/ai/assistant.ts`
- Create: `topology-workbench/src/components/PatchReview.tsx`
- Modify: `topology-workbench/src/App.tsx`
- Test: `topology-workbench/src/patch/patch.test.ts`
- Test: `topology-workbench/src/ai/assistant.test.ts`

- [ ] **Step 1: Write failing patch tests**

Tests must prove:

- invalid node references, duplicate IDs, parent cycles, and unsupported edge kinds are rejected.
- valid patches apply and create rollback entries.
- per-operation disablement keeps a patch valid when remaining operations are valid.

- [ ] **Step 2: Implement patch engine**

Expose:

```ts
validateTopologyPatch(topology: Topology, patch: TopologyPatch): PatchValidationResult
applyTopologyPatch(topology: Topology, patch: TopologyPatch): PatchApplyResult
rollbackTopologyPatch(result: PatchApplyResult): Topology
```

- [ ] **Step 3: Write failing assistant tests**

Tests must prove deterministic local instructions produce patches:

- Redis/cache layer movement.
- payment/order domain split.
- IDC to VPC leased-line edge creation.
- database risk annotation.
- hide test environment.

- [ ] **Step 4: Implement deterministic assistant**

Expose:

```ts
proposeTopologyPatch(topology: Topology, instruction: string): TopologyPatch
summarizePatch(topology: Topology, patch: TopologyPatch): PatchSummary
```

- [ ] **Step 5: Implement Patch Review UI**

Show patch summary, operation list, validation risks, per-operation toggles, apply, reject, and rollback.

- [ ] **Step 6: Verify P2**

Run:

```bash
npx -y yarn@1.22.22 --cwd topology-workbench test src/patch src/ai src/App.test.tsx --run
```

Expected: patch, assistant, and UI tests pass.

### Task 6: P3 Export, XLSX, Network Views, Polish

**Files:**
- Create: `topology-workbench/src/export/exporters.ts`
- Modify: `topology-workbench/src/import/xlsx.ts`
- Modify: `topology-workbench/src/components/Toolbar.tsx`
- Modify: `topology-workbench/src/components/TopologyCanvas.tsx`
- Modify: `topology-workbench/src/styles.css`
- Test: `topology-workbench/src/export/exporters.test.ts`
- Test: `topology-workbench/src/import/xlsx.test.ts`

- [ ] **Step 1: Write failing export tests**

Tests must prove:

- `exportTopologyJson()` returns formatted JSON with topology metadata.
- `exportTopologySvg()` returns an SVG document with node labels and edge labels.
- `exportTopologyPng()` returns a data URL when a DOM node is provided.

- [ ] **Step 2: Implement export functions**

Expose:

```ts
exportTopologyJson(topology: Topology): string
exportTopologySvg(topology: Topology, layout: LayoutResult): string
exportTopologyPng(element: HTMLElement): Promise<string>
```

- [ ] **Step 3: Write failing XLSX test**

Test that workbook rows become `RawAssetTable` with headers and stable row IDs.

- [ ] **Step 4: Finish XLSX import**

Use `read-excel-file` to parse the first sheet into `RawAssetTable`.

- [ ] **Step 5: Add network view controls**

Add a network-focused view preset that highlights `network_resource` nodes and `network_connects` edges while dimming unrelated objects.

- [ ] **Step 6: Verify P3**

Run:

```bash
npx -y yarn@1.22.22 --cwd topology-workbench test src/export src/import/xlsx.test.ts src/App.test.tsx --run
npx -y yarn@1.22.22 build:topology
```

Expected: tests and build pass.

### Task 7: Final Integration And Validation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-14-topology-workbench-restart-design.md` if implementation realities require clarifying notes

- [ ] **Step 1: Add docs**

Document:

- `npx -y yarn@1.22.22 start:topology`
- `npx -y yarn@1.22.22 test:topology`
- `npx -y yarn@1.22.22 build:topology`
- supported CSV template columns

- [ ] **Step 2: Run focused checks**

Run:

```bash
npx -y yarn@1.22.22 test:topology
npx -y yarn@1.22.22 build:topology
```

Expected: both pass.

- [ ] **Step 3: Run repo-level safety checks where feasible**

Run:

```bash
npx -y yarn@1.22.22 test:guard:imports
```

Expected: guard passes.

- [ ] **Step 4: Final review**

Review the final diff for:

- no legacy Excalidraw feature churn
- no hardcoded secrets
- no unrelated lockfile churn beyond dependency additions
- no canvas-specific mutation in topology core
