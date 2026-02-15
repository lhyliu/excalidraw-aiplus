> [!WARNING]
> Archived on 2026-02-16. This plan references the retired AIArchitectureGenerationDialog workflow.
> Current implementation uses page-oriented flow (/ai/csv-fix, /ai/draft-confirm) + SSE task API (/api/ai/tasks).
> See AI_ARCHITECTURE_ASSISTANT.md and ackend-proxy/README.md for active architecture.
# AI 鏋舵瀯鐢熸垚浜や簰绠€鍖?Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 鎶婂綋鍓嶁€滃瓧娈佃瘑鍒?鏁版嵁鏍″噯鈥濇敼鎴愨€滃揩閫熷嚭鍒濈 + 浠呯‘璁や笉纭畾椤光€濈殑鍙噦娴佺▼銆?
**Architecture:** 涓嶆敼鏁版嵁缁撴瀯涓庤矾鐢憋紝鍙噸鎺掔幇鏈?`AIArchitectureGenerationDialog` 灞曠ず灞傘€備腑蹇冨尯浠モ€滆鎳備綘鐨勮〃鏍尖€濆拰鈥滃緟纭浜嬮」鍒嗙粍鍗＄墖鈥濅负涓伙紝淇濈暀涓撳妯″紡 Overlay 浣滀负鎵归噺鍏滃簳銆傞€氳繃鏈€灏忚涓哄彉鏇磋鐢ㄦ埛鍙互浠庡鍏ラ〉鐩存帴鐢熸垚鍒濈銆?
**Tech Stack:** React + TypeScript strict + Jotai + Vitest + Testing Library

---

### Task 1: 瀵煎叆涓庡瓧娈电悊瑙ｆ敼涓衡€滃厛鍑哄浘銆佸悗缁嗗寲鈥?
**Files:**
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/ImportStep.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/FieldMappingStep.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/FieldUnderstandingPanel.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/FieldMappingStep.test.tsx`
- Create: `packages/excalidraw/components/AIArchitectureGenerationDialog/ImportStep.test.tsx`

**Step 1: Write failing tests**
- `FieldMappingStep.test.tsx` 鏂█榛樿鎻愮ず鈥滀粎闇€纭涓嶇‘瀹氶」鈥濅互鍙娾€滄煡鐪?AI 宸茬‘璁ゅ瓧娈碘€濆叆鍙ｃ€?- `ImportStep.test.tsx` 鏂█ CSV 瑙ｆ瀽鍚庡彲鐩存帴鐐瑰嚮鈥滀竴閿敓鎴愬垵绋库€濄€?
**Step 2: Verify RED**
- Run: `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog/FieldMappingStep.test.tsx packages/excalidraw/components/AIArchitectureGenerationDialog/ImportStep.test.tsx`
- Expected: FAIL锛堢洰鏍囨枃妗?鎸夐挳灏氫笉瀛樺湪锛?
**Step 3: Write minimal implementation**
- `ImportStep` 澧炲姞 `onGenerateDraft`锛屽湪鏈夋暟鎹椂鏄剧ず鈥滀竴閿敓鎴愬垵绋库€濄€?- `FieldUnderstandingPanel` 榛樿浠呭睍绀轰綆鎶婃彙鎴栨湭璇嗗埆瀛楁锛涢珮鎶婃彙瀛楁鎶樺彔銆?- `FieldMappingStep` 澧炲姞鈥滅‘璁?AI 鐞嗚В骞剁户缁?鐩存帴鐢熸垚鍒濈鈥濆弻璺緞銆?
**Step 4: Verify GREEN**
- Run same tests锛岄鏈?PASS銆?
### Task 2: 寰呯‘璁ら〉鏀逛负鈥滅被鍨嬪崱鐗?+ 鎵归噺搴旂敤鈥?
**Files:**
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/IssuesStep.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/CalibrationTaskFlow.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/IssuesStep.test.tsx`

**Step 1: Write failing test**
- `IssuesStep.test.tsx` 鏂█鏄剧ず鈥滃緟纭浜嬮」 (N 绫?鈥濆苟鏀寔鈥滅‘璁ゅ苟搴旂敤 (count)鈥濄€?
**Step 2: Verify RED**
- Run: `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog/IssuesStep.test.tsx`
- Expected: FAIL锛堝綋鍓嶄粛鏄€愯杈撳叆鍗＄墖锛?
**Step 3: Write minimal implementation**
- 鎸夐棶棰樼被鍨嬫樉绀哄崱鐗囷紝缁欏嚭 AI 鍒嗘瀽涓庡缓璁€笺€?- 涓哄彲寤鸿绫诲瀷澧炲姞鎵归噺搴旂敤鎸夐挳銆?- 琛岀骇鍐呭鏀逛负鈥滈瑙堟秹鍙婁富鏈衡€濆睍寮€鍖猴紝淇濈暀涓撳妯″紡鍏ュ彛銆?
**Step 4: Verify GREEN**
- Run same test锛岄鏈?PASS銆?
### Task 3: 鍏ㄥ眬鏂囨涓庢憳瑕佸紩瀵?
**Files:**
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/CalibrationStepper.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/AiUnderstandingPanel.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog.scss`

**Step 1: Write failing assertions (宸叉湁瑕嗙洊)**
- 閫氳繃鐜版湁瀵硅瘽绾ф祴璇曢獙璇佸叧閿叆鍙ｄ粛鍙鑸€?
**Step 2: Write minimal implementation**
- 宸︿晶姝ラ鏂囨鏀逛负涓氬姟鍖栧懡鍚嶏紙瀵煎叆琛ㄦ牸/璇绘噦琛ㄦ牸/寰呯‘璁ら」/鍒濇鏋舵瀯鍥?鍙俊鐜扮姸锛夈€?- 鍙充晶鎽樿椤堕儴鏀逛负鈥滀笅涓€姝ュ缓璁€濄€?- 鏍峰紡琛ュ厖锛氬崱鐗囦紭鍏堢骇鏍囩銆佹壒閲忔搷浣滃尯銆佹姌鍙犻瑙堝尯銆?
**Step 3: Verify**
- Run: `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog`
- Expected: 鍏ㄩ儴 PASS銆?
