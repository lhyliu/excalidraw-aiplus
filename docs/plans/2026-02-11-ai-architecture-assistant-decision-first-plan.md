# AI Architecture Assistant Decision-First Flow Implementation Plan

## Status
- Date: 2026-02-11
- Overall: Implemented in current branch
- Notes: Core decision-first chain, snapshot validation/retry, preview transparency, prompt hardening, and interaction/UI refinements are landed. This plan is now a historical implementation record.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make AI Architecture Assistant fully decision-first: users choose exact optimization items, AI only executes selected items, and outputs auditable summary + architecture diagram.

**Architecture:** Split the workflow into two layers: Decision Layer (selection/combination/snapshot) and Generation Layer (model call/rendering/validation). Generation must consume immutable snapshot input, not mutable UI state or chat history. Add structured-output contract and post-generation validation to guarantee “selected-in, matched-out”.

**Tech Stack:** React + TypeScript, existing Excalidraw dialog state, AI service prompt layer (`aiService.ts`), Vitest.

---

### Task 1: Freeze generation input with immutable snapshot

**Files:**
- Modify: `packages/excalidraw/components/ArchitectureOptimizationDialog.tsx`
- Modify: `packages/excalidraw/components/ArchitectureOptimizationDialog/model.ts`
- Test: `packages/excalidraw/components/ArchitectureOptimizationDialog/planGenerationContext.test.ts`

**Step 1: Write failing test for snapshot immutability**

```ts
it("keeps generation input unchanged after user toggles selection", () => {
  // create snapshot from selected suggestions A,B
  // then mutate UI selection to C
  // expect generation payload still contains A,B
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test packages/excalidraw/components/ArchitectureOptimizationDialog/planGenerationContext.test.ts --watch=false`
Expected: FAIL (payload follows live state)

**Step 3: Implement `GenerationSnapshot` type + builder**

```ts
type GenerationSnapshot = {
  selectedIds: string[];
  selectedItems: Array<{id: string; category: string; content: string; note?: string}>;
  style: ArchitectureStyle;
  sourceSchemeId: string | null;
  createdAt: number;
};
```

**Step 4: Route `generateNewFromSelected` / `updateCurrentFromSelected` to snapshot input**

Run generation using snapshot only.

**Step 5: Re-run test**

Expected: PASS

**Step 6: Commit**

```bash
git add packages/excalidraw/components/ArchitectureOptimizationDialog.tsx packages/excalidraw/components/ArchitectureOptimizationDialog/model.ts packages/excalidraw/components/ArchitectureOptimizationDialog/planGenerationContext.test.ts
git commit -m "feat(architecture-assistant): add immutable generation snapshot"
```

### Task 2: Add pre-generation confirmation panel

**Files:**
- Modify: `packages/excalidraw/components/ArchitectureOptimizationDialog/WorkflowPage.tsx`
- Modify: `packages/excalidraw/components/ArchitectureOptimizationDialog.scss`
- Test: `packages/excalidraw/components/ArchitectureOptimizationDialog/WorkflowPage.test.tsx` (create if missing)

**Step 1: Write failing test for confirmation summary**

```ts
it("shows exact selected count and selected titles before generation", () => {
  // render workflow with 2 selected items
  // expect confirmation panel displays exactly those 2
});
```

**Step 2: Run failing test**

Run: `yarn test packages/excalidraw/components/ArchitectureOptimizationDialog/WorkflowPage.test.tsx --watch=false`
Expected: FAIL

**Step 3: Implement confirmation panel UI**
- Show: selected count, selected list, style, target mode (new/update)
- Show explicit hint: “不会自动包含未勾选建议”

**Step 4: Add disable rule when no selected items**

**Step 5: Re-run test**

Expected: PASS

**Step 6: Commit**

```bash
git add packages/excalidraw/components/ArchitectureOptimizationDialog/WorkflowPage.tsx packages/excalidraw/components/ArchitectureOptimizationDialog.scss packages/excalidraw/components/ArchitectureOptimizationDialog/WorkflowPage.test.tsx
git commit -m "feat(architecture-assistant): add pre-generation confirmation panel"
```

### Task 3: Move plan generation to structured output contract

**Files:**
- Modify: `packages/excalidraw/services/aiService.ts`
- Modify: `packages/excalidraw/services/aiService.test.ts`
- Modify: `packages/excalidraw/components/ArchitectureOptimizationDialog.tsx`

**Step 1: Write failing test for structured parser**

```ts
it("parses JSON payload with changes and mermaid", () => {
  // mock model output JSON
  // expect parsed.changes and parsed.mermaid are present
});
```

**Step 2: Run test to verify fail**

Run: `yarn test packages/excalidraw/services/aiService.test.ts --watch=false`
Expected: FAIL

**Step 3: Add output schema in prompt**

```json
{
  "changes": [{"sourceSuggestionId":"...","category":"性能","title":"...","action":"..."}],
  "mermaid": "graph TD ...",
  "assumptions": ["..."]
}
```

**Step 4: Parse JSON first, fallback to legacy text only on parse failure**

**Step 5: Re-run service tests**

Expected: PASS

**Step 6: Commit**

```bash
git add packages/excalidraw/services/aiService.ts packages/excalidraw/services/aiService.test.ts packages/excalidraw/components/ArchitectureOptimizationDialog.tsx
git commit -m "feat(ai-service): use structured optimization output"
```

### Task 4: Enforce selected-to-summary mapping validation

**Files:**
- Modify: `packages/excalidraw/components/ArchitectureOptimizationDialog.tsx`
- Create: `packages/excalidraw/components/ArchitectureOptimizationDialog/validation.ts`
- Create: `packages/excalidraw/components/ArchitectureOptimizationDialog/validation.test.ts`

**Step 1: Write failing test for mismatch detection**

```ts
it("fails when summary count differs from selected suggestions", () => {
  // selected 1, output 3
  // expect validation error
});
```

**Step 2: Run test and verify fail**

Run: `yarn test packages/excalidraw/components/ArchitectureOptimizationDialog/validation.test.ts --watch=false`
Expected: FAIL

**Step 3: Implement validators**
- Count equality (`changes.length === snapshot.selectedItems.length`)
- Category whitelist
- Forbidden unselected leakage (keyword/source id check)
- Mermaid presence + minimal syntax check

**Step 4: Wire validation before scheme save**
- If fail: show explicit user-facing reason
- Do not overwrite scheme

**Step 5: Re-run test**

Expected: PASS

**Step 6: Commit**

```bash
git add packages/excalidraw/components/ArchitectureOptimizationDialog/validation.ts packages/excalidraw/components/ArchitectureOptimizationDialog/validation.test.ts packages/excalidraw/components/ArchitectureOptimizationDialog.tsx
git commit -m "feat(architecture-assistant): validate selected-to-output consistency"
```

### Task 5: Add automatic retry on contract violation

**Files:**
- Modify: `packages/excalidraw/components/ArchitectureOptimizationDialog.tsx`
- Modify: `packages/excalidraw/services/aiService.ts`
- Test: `packages/excalidraw/components/ArchitectureOptimizationDialog/validation.test.ts`

**Step 1: Write failing test for retry-on-violation**

```ts
it("retries once with correction prompt when output violates contract", async () => {
  // first response invalid, second valid
  // expect final success and retry count = 1
});
```

**Step 2: Run test and verify fail**

**Step 3: Implement one-pass corrective retry**
- Add correction prompt with exact validation errors
- Retry once only; then fail fast with message

**Step 4: Re-run test**

Expected: PASS

**Step 5: Commit**

```bash
git add packages/excalidraw/components/ArchitectureOptimizationDialog.tsx packages/excalidraw/services/aiService.ts packages/excalidraw/components/ArchitectureOptimizationDialog/validation.test.ts
git commit -m "feat(architecture-assistant): add corrective retry for invalid AI output"
```

### Task 6: Improve result transparency in preview

**Files:**
- Modify: `packages/excalidraw/components/ArchitectureOptimizationDialog/PreviewPage.tsx`
- Modify: `packages/excalidraw/components/ArchitectureOptimizationDialog.tsx`
- Modify: `packages/excalidraw/components/ArchitectureOptimizationDialog.scss`
- Test: `packages/excalidraw/components/ArchitectureOptimizationDialog/PreviewPage.test.tsx` (create if missing)

**Step 1: Write failing test for “selected coverage” badges**

```ts
it("shows matched/missing status for each selected suggestion", () => {
  // expect badges: Matched / Missing
});
```

**Step 2: Run test and verify fail**

**Step 3: Implement coverage panel**
- For each selected item: show matched summary line or “未体现”
- Show assumptions block separately

**Step 4: Re-run test**

Expected: PASS

**Step 5: Commit**

```bash
git add packages/excalidraw/components/ArchitectureOptimizationDialog/PreviewPage.tsx packages/excalidraw/components/ArchitectureOptimizationDialog.tsx packages/excalidraw/components/ArchitectureOptimizationDialog.scss packages/excalidraw/components/ArchitectureOptimizationDialog/PreviewPage.test.tsx
git commit -m "feat(architecture-assistant): add selected coverage transparency in preview"
```

### Task 7: Persist snapshot with scheme for full audit trail

**Files:**
- Modify: `packages/excalidraw/components/ArchitectureOptimizationDialog/model.ts`
- Modify: `packages/excalidraw/components/ArchitectureOptimizationDialog.tsx`
- Modify: `packages/excalidraw/data/json.ts`
- Test: `scripts/test-architecture-persistence.js`

**Step 1: Write failing persistence test for snapshot fields**

**Step 2: Run architecture persistence test and verify fail**

Run: `yarn test:architecture`
Expected: snapshot persistence check FAIL

**Step 3: Add snapshot fields into `Scheme` and persistence pipeline**
- save/load/export/import all include snapshot

**Step 4: Re-run architecture tests**

Expected: persistence checks PASS

**Step 5: Commit**

```bash
git add packages/excalidraw/components/ArchitectureOptimizationDialog/model.ts packages/excalidraw/components/ArchitectureOptimizationDialog.tsx packages/excalidraw/data/json.ts scripts/test-architecture-persistence.js
git commit -m "feat(architecture-assistant): persist generation snapshot for auditability"
```

### Task 8: Final verification and docs

**Files:**
- Modify: `AI_ARCHITECTURE_ASSISTANT.md`
- Modify: `README.md` (if flow contract is user-facing)

**Step 1: Add docs section: decision-first generation contract**
- User-selected-only generation
- Summary count follows selected count
- Validation/retry/preview coverage behavior

**Step 2: Run full relevant checks**

Run:
```bash
yarn test packages/excalidraw/services/aiService.test.ts --watch=false
yarn test packages/excalidraw/components/ArchitectureOptimizationDialog/planGenerationContext.test.ts --watch=false
yarn test packages/excalidraw/components/ArchitectureOptimizationDialog/inputComposer.test.ts --watch=false
yarn test:architecture
```

Expected: All relevant tests pass (or existing known unrelated failures documented)

**Step 3: Commit**

```bash
git add AI_ARCHITECTURE_ASSISTANT.md README.md
git commit -m "docs(architecture-assistant): document decision-first generation workflow"
```

## Risks and mitigations
- Model occasionally ignores structure: mitigate with JSON-first parser + one-shot corrective retry.
- UI state race during fast clicking: mitigate with snapshot freeze and button debounce while generating.
- Backward compatibility of old schemes: keep legacy parse/render fallback when snapshot missing.

## Acceptance criteria
- Generate/update uses only selected snapshot input.
- Summary count equals selected count when selected list exists.
- No unselected suggestion leakage from history in generation path.
- Preview shows per-selection coverage and missing items clearly.
- Each scheme can be audited back to exact user decisions.
