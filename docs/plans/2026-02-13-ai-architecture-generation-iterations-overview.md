> [!WARNING]
> Archived on 2026-02-16. This plan references the retired AIArchitectureGenerationDialog workflow.
> Current implementation uses page-oriented flow (/ai/csv-fix, /ai/draft-confirm) + SSE task API (/api/ai/tasks).
> See AI_ARCHITECTURE_ASSISTANT.md and ackend-proxy/README.md for active architecture.
# AI 鏋舵瀯鐢熸垚杩唬鎬昏锛堟寜褰撳墠瀹炵幇鏇存柊锛?
鏃ユ湡锛?026-02-13  
鑼冨洿锛歚packages/excalidraw/components/AIArchitectureGeneration*`

## 1. 鍏ュ彛涓庝富瀹瑰櫒

1. 鍔熻兘鍏ュ彛锛?- 涓昏彍鍗?`AI鏋舵瀯鐢熸垚`
- 椤堕儴鎸夐挳 `AI鏋舵瀯鐢熸垚`
2. 涓诲鍣細
- `packages/excalidraw/components/AIArchitectureGenerationDialog.tsx`

## 2. 褰撳墠绔埌绔祦绋?
褰撳墠宸叉敹鏁涗负涓夋涓绘祦绋嬶細

1. `鏁版嵁宸ヤ綔鍙帮紙workspace锛塦
2. `鏋舵瀯鍥捐鍥撅紙draft锛塦
3. `鍙俊鐜扮姸锛坈alibrate锛塦

璇存槑锛?
1. 鍘嗗彶姝ラ `import / mapping / issues` 浠呬綔鍏煎锛屼笉鍐嶄綔涓虹嫭绔嬪鑸楠ゃ€?2. 瀵煎叆涓庝慨姝ｅ湪鍚屼竴宸ヤ綔鍙板畬鎴愶紙鐢ㄦ埛鏃犻渶棰戠箒鍒囬〉锛夈€?
## 3. 鏁版嵁宸ヤ綔鍙帮紙workspace锛夌幇鐘?
鐩綍锛?- `packages/excalidraw/components/AIArchitectureGenerationDialog/GuidedWorkspaceStep.tsx`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/ExpertEditOverlay.tsx`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/SharedAgGrid.tsx`

鑳藉姏锛?
1. AG Grid 鍘熺敓缂栬緫銆佸師鐢熼€夋嫨銆佸垎椤垫祻瑙堛€?2. `鏈嶅姟鍚嶇О锛堢粍浠剁敤閫旓級` 琛ㄥご鍐呯疆 `AI璇嗗埆` 鎸夐挳锛堟壒閲忚ˉ鏈嶅姟鍚嶏級銆?3. 绌烘湇鍔″悕鏀寔琛岀骇 `AI璇嗗埆` 鍏ュ彛銆?4. 闂鎸夌被鍨嬭仛鍚堝苟鍦ㄥ彸渚ф娊灞夊紩瀵间慨姝ｃ€?5. 鎵归噺缂栬緫涓?Overlay 宸ュ叿锛屼笉鍐嶅崟鐙楠ら〉銆?
## 4. 鏋舵瀯鍥捐鍥撅紙draft锛夌幇鐘?
鐩綍锛?- `packages/excalidraw/components/AIArchitectureGenerationDialog/DraftStep.tsx`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/hooks/useBusinessScopeSuggestion.ts`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/hooks/useBusinessArchitectureSuggestion.ts`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/hooks/useServiceNamingSuggestion.ts`

鑳藉姏锛?
1. 姣忔鍙鐞嗕竴涓笟鍔¤寖鍥达紙鍏堥€夎寖鍥村啀鐢熸垚锛夈€?2. 涓氬姟鑼冨洿浼樺厛浣跨敤 LLM 璇嗗埆锛屽け璐ュ洖閫€鏈湴鍒嗙粍绛栫暐銆?3. 鏀寔 AI 鍒嗗眰寤鸿 + 浜哄伐鎷栨嫿璋冩暣銆?4. 鎸変笟鍔¤寖鍥寸敓鎴愭灦鏋勫浘鑽夌锛圡ermaid锛夈€?
## 5. 鍙俊鐜扮姸锛坈alibrate锛夌幇鐘?
鐩綍锛?- `packages/excalidraw/components/AIArchitectureGenerationDialog/CalibrateStep.tsx`

鑳藉姏锛?
1. 鍩轰簬鏍″噯浠诲姟鐨勮川閲忛棬鎺у埗銆?2. 浠呮弧瓒抽棬妲涘悗鎵嶅彲鏍囪 `confirmed`銆?
## 6. 鐘舵€佷笌鎸佷箙鍖?
鏍稿績妯″潡锛?- `packages/excalidraw/components/AIArchitectureGeneration/state/*`

鍏抽敭鐐癸細

1. 淇濈暀鍘熷 CSV锛坮aw 鏁版嵁锛?2. 鏀寔 `edits` 瑕嗙洊
3. 鏀寔 `ignoredRows`
4. 鏀寔 `aliasStore` 鍒楀悕璁板繂
5. Dialog 浼氳瘽鐘舵€佹寔涔呭寲锛?- `packages/excalidraw/components/AIArchitectureGenerationDialog/sessionState.ts`

## 7. LLM 浣跨敤杈圭晫锛堝綋鍓嶏級

浠呯敤浜庘€滃缓璁€濊€岄潪鈥滀簨瀹炶嚜鍔ㄨ惤搴撯€濓細

1. 瀛楁璇嗗埆寤鸿
2. 鏈嶅姟鍛藉悕/鏈嶅姟璇箟寤鸿
3. 涓氬姟鑼冨洿寤鸿
4. 涓氬姟鍒嗗眰涓庢灦鏋勫浘寤鸿

缁熶竴澶嶇敤浠撳簱鏃㈡湁 AI 璋冪敤鑳藉姏锛屼笉寮曞叆鏂?AI SDK銆?
## 8. 褰撳墠楠岃瘉鍛戒护

寤鸿鏈€灏戝洖褰掞細

1. `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog/GuidedWorkspaceStep.test.tsx packages/excalidraw/components/AIArchitectureGenerationDialog/ExpertEditOverlay.test.tsx`
2. `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog/ImportStep.test.tsx packages/excalidraw/components/AIArchitectureGenerationDialog/DraftStep.test.tsx`

濡傞渶鎵╁睍鍥炲綊锛?
1. `yarn test:architecture`

