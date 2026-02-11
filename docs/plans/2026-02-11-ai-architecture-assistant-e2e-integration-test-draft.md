# AI Architecture Assistant E2E Integration Test Draft

## Status
- Date: 2026-02-11
- Current: Core integration contract tests are already implemented in `ArchitectureOptimizationDialog.integration.test.ts`.
- Remaining: Expand to full UI-driven interaction tests (selection toggles, clear-dialog checkbox branches, toast timing) as a follow-up.

## Scope
Convert manual acceptance cases (A-D) into automatable integration tests in Vitest + Testing Library level, with deterministic AI responses.

## Test Strategy
- Layer: integration tests around `ArchitectureOptimizationDialog` + service mocks.
- Determinism: mock `generateOptimizationPlan` / stream responses.
- Core invariant: generation consumes immutable snapshot, not live selection state.

## Proposed Test Files
- `packages/excalidraw/components/ArchitectureOptimizationDialog/ArchitectureOptimizationDialog.integration.test.tsx`
- `packages/excalidraw/components/ArchitectureOptimizationDialog/__fixtures__/mockPlanResponses.ts`
- Optional helper: `packages/excalidraw/components/ArchitectureOptimizationDialog/__testutils__/renderDialog.tsx`

## Shared Fixtures
1. Suggestion fixture
- S1: performance / "优化MySQL" / "实现读写分离"
- S2: performance / "扩展Redis集群" / "提升并发承载能力"
- S3: cost / "压缩日志保留" / "降低存储成本"

2. AI response fixture
- Valid 1-line summary + mermaid
- Valid 2-line summary + mermaid
- Invalid count (for retry path)
- Retry-fixed valid response

3. App fixture
- Minimal app wrapper with mock `elements`, fake refs, and deterministic timers.

## Case Mapping

### Case A: select 1 -> generate new
Test name: `generates one summary item when exactly one suggestion selected`

Steps:
1. Seed suggestion pool with S1,S2,S3; select only S1.
2. Mock AI response with 1 change.
3. Click `生成新方案`.

Asserts:
- confirmation area shows `已选 1 项`
- saved scheme summary has 1 bullet line
- coverage shows `已体现 1/1` or explicit missing state
- no S2/S3 keywords in summary

### Case B: select 2 -> update current
Test name: `updates current scheme with selected-count summary`

Steps:
1. Seed existing scheme.
2. Select S1,S2.
3. Mock AI response with 2 changes.
4. Click `更新当前方案`.

Asserts:
- active scheme id unchanged
- summary bullet count = 2
- coverage denominator = 2

### Case C: mutate selection during generation
Test name: `uses frozen snapshot when selection changes during in-flight generation`

Steps:
1. Select S1,S2; click generate.
2. Before mocked stream resolves, switch UI selection to S3.
3. Resolve stream.

Asserts:
- scheme.generationSnapshot.selectedIds == [S1,S2]
- final summary only references S1/S2 context
- does not include S3 keyword

### Case D: persistence export/import
Test name: `persists generationSnapshot across serialize/restore`

Steps:
1. Generate scheme with snapshot.
2. Call serialize path (`serializeAsJSON`) and then import path (`restore` in blob flow or parsed payload injection).

Asserts:
- `architectureSchemes[].generationSnapshot` exists and完整
- selectedIds/sourceCombinationId/createdAt preserved

## Retry Path Test (from Task 5)
Test name: `retries once when validation fails then succeeds`

Steps:
1. First AI response invalid count (3 lines for selected=1).
2. Second response valid count (1 line).

Asserts:
- service invoked twice
- final scheme saved
- no error toast

## Mocking Notes
- Mock module: `../services/aiService` for `generateOptimizationPlan`.
- For stream behavior: return promise with delayed resolve to allow mid-flight UI interactions.
- Use fake timers (`vi.useFakeTimers()`) where needed.

## Commands
- Single file: `yarn test packages/excalidraw/components/ArchitectureOptimizationDialog/ArchitectureOptimizationDialog.integration.test.tsx --watch=false`
- Related suite: `yarn test packages/excalidraw/components/ArchitectureOptimizationDialog/*.test.ts* --watch=false`

## Definition of Done
- 5 integration tests pass: Case A/B/C/D + retry path.
- No flaky timer/network dependency.
- Assertions verify user-intent contract (selected-only, count consistency, snapshot auditability).
