> [!WARNING]
> Archived on 2026-02-16. This plan references the retired AIArchitectureGenerationDialog workflow.
> Current implementation uses page-oriented flow (/ai/csv-fix, /ai/draft-confirm) + SSE task API (/api/ai/tasks).
> See AI_ARCHITECTURE_ASSISTANT.md and ackend-proxy/README.md for active architecture.
# AI 鏋舵瀯鍔熻兘鏁存敼璁″垝 v2锛堝榻愮幇鐘朵笌鍙獙鏀剁増锛?
> 褰掓。璇存槑锛氳鏂囦欢涓烘墽琛岀増锛堝惈鐘舵€佷笌楠屾敹缁撴灉锛夈€?
> 鐘舵€侊細宸插畬鎴愶紙鏈疆鏁存敼锛? 
> 褰撳墠杩涘害锛歅0/P1/P2 鍏ㄩ儴钀藉湴锛岄獙鏀跺懡浠ら€氳繃锛?026-02-13锛?
鏈鍒掑厛淇鈥滄枃妗ｄ笌浠ｇ爜涓嶄竴鑷淬€侀獙鏀惰剼鏈け鐪熲€濈殑鍩虹闂锛屽啀鍋氱粍浠舵媶鍒嗐€佹牱寮忔ā鍧楀寲銆乁X 鎵撶（鍜屽伐绋嬪寲瀹屽杽銆?
---

## 0. 鍏叡鎺ュ彛涓庣被鍨嬪彉鏇?
- [x] `excalidraw-app/components/AppMainMenu.tsx` 绉婚櫎 `onOpenAIArchitectureGeneration` prop 涓庘€淎I鏋舵瀯鐢熸垚鈥濊彍鍗曢」锛屼粎淇濈暀鈥淎I鏋舵瀯鍔╂墜鈥濄€?- [x] `excalidraw-app/App.tsx` 鍒犻櫎瀵瑰簲鐘舵€佷笌鍥炶皟鍒嗘敮锛屼繚鐣欑粺涓€鍏ュ彛璋冪敤銆?- [x] `packages/excalidraw/components/ArchitectureAssistant.tsx` 淇濈暀 `defaultTab`锛岄粯璁よ涓轰粛涓?`optimize`銆?- [x] `scripts/test-architecture-fix.js` 鏍￠獙鍙ｅ緞鏀逛负 `renderingSchemeIds` 涓?`isPreparingInsert`銆?- [x] 涓嶅紩鍏ョ牬鍧忔€фā鍨嬪彉鏇达紝`Scheme`/`generationSnapshot`/鎸佷箙鍖栧瓧娈典繚鎸佸吋瀹广€?
---

## 1. 闃舵 P0锛氫簨瀹炲榻愪笌闂ㄧ淇锛堝繀椤诲厛瀹屾垚锛?
鐩爣锛氳鈥滄枃妗ｃ€佽剼鏈€佷唬鐮併€侀獙鏀剁粨鏋溾€濅竴鑷淬€?
- [x] 淇 `scripts/test-architecture-fix.js` 鏃у彉閲忔牎楠岋紙`renderingSchemes` -> `renderingSchemeIds`锛夈€?- [x] 鏇存柊 `plan20260214.md` 闃舵鐘舵€佷笌娴嬭瘯鍙ｅ緞锛岀Щ闄よ繃鏃垛€?5/24 鏂囦欢鈥濊鏁拌〃杈俱€?- [x] 鏇存柊 `AI_ARCHITECTURE_ASSISTANT.md` 澶辨晥鐨?`ai/generators` 涓庣ず渚嬩唬鐮侊紝鏀逛负 hook + `runAIStream` 鏋舵瀯銆?- [x] 鏀舵暃涓昏彍鍗曞叆鍙ｏ紝浠呬繚鐣欌€淎I鏋舵瀯鍔╂墜鈥濄€?
楠屾敹鍛戒护锛?
1. `yarn test:architecture`
2. `yarn test:app --watch=false packages/excalidraw/components/ArchitectureOptimizationDialog/ArchitectureOptimizationDialog.integration.test.ts packages/excalidraw/components/AIArchitectureGenerationDialog/AIArchitectureGenerationDialog.session.test.tsx`

閫氳繃鏍囧噯锛?
1. 涓ゆ潯鍛戒护鍧囬€氳繃銆?2. 涓昏彍鍗曞彧鍑虹幇涓€涓?AI 涓诲叆鍙ｏ紝鍔熻兘閫氳繃 Assistant 鍐?Tab 鍒囨崲瑕嗙洊鍘熻兘鍔涖€?
---

## 2. 闃舵 P1锛氱粍浠舵媶鍒嗭紙ArchitectureOptimizationDialog锛?
鐩爣锛氬皢宸ㄥ瀷缁勪欢闄嶄负鈥滅紪鎺掑眰鈥濄€?
- [x] 鏂板 `packages/excalidraw/components/ArchitectureOptimizationDialog/ConfigurationWaitScreen.tsx`
- [x] 鏂板 `packages/excalidraw/components/ArchitectureOptimizationDialog/ClearSchemesConfirmDialog.tsx`
- [x] 鏂板 `packages/excalidraw/components/ArchitectureOptimizationDialog/SchemeUndoToast.tsx`
- [x] 鏂板 `packages/excalidraw/components/ArchitectureOptimizationDialog/hooks/useArchitecturePersistence.ts`
- [x] 鏂板 `packages/excalidraw/components/ArchitectureOptimizationDialog/hooks/usePreviewRenderer.ts`
- [x] 鏂板 `packages/excalidraw/components/ArchitectureOptimizationDialog/hooks/usePlanGeneration.ts`
- [x] 淇敼 `packages/excalidraw/components/ArchitectureOptimizationDialog.tsx`锛屼粎淇濈暀鐘舵€佺紪鎺掍笌瀛愮粍浠惰閰嶃€?- [x] 淇濇寔 `PreviewPage.tsx` 涓?`WorkflowPage.tsx` 浠ュ睍绀哄眰涓轰富銆?
閫氳繃鏍囧噯锛?
1. `ArchitectureOptimizationDialog.tsx` 琛屾暟鏄捐憲涓嬮檷锛堢洰鏍?< 1200 琛岋級銆?2. 琛屼负涓嶅彉锛岀幇鏈?integration/test 鍏ㄩ€氳繃銆?
---

## 3. 闃舵 P1锛氭牱寮忔ā鍧楀寲涓庢鏍峰紡娓呯悊

鐩爣锛氱粨鏉熷崟鏂囦欢 4000+ 琛屾牱寮忕淮鎶ゆā寮忋€?
- [x] 鏂板 `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_tokens.scss`
- [x] 鏂板 `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_layout.scss`
- [x] 鏂板 `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_chat.scss`
- [x] 鏂板 `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_workflow.scss`
- [x] 鏂板 `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_preview.scss`
- [x] 鏂板 `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_overlays.scss`
- [x] `ArchitectureOptimizationDialog.scss` 鏀舵暃涓?import + 灏戦噺鍏煎瑕嗙洊銆?- [x] 鍒犻櫎 `ArchitectureOptimizationDialog.layout.scss`锛岄伩鍏嶅弻鏍峰紡婧愩€?
閫氳繃鏍囧噯锛?
1. 鏍峰紡鐩綍鑱岃矗娓呮櫚銆?2. 瀵硅瘽銆佸缓璁〉銆侀瑙堥〉銆佹竻绌虹‘璁ゃ€佹湭閰嶇疆椤垫棤鍙鍥炲綊銆?
---

## 4. 闃舵 P2锛歎X 涓庢€ц兘鎵撶（

鐩爣锛氳ˉ榻愨€滄劅鐭ユ€ц兘鈥濆拰鈥滃け璐ュ彲鐞嗚В鎬р€濄€?
- [x] `PreviewPage.tsx` 澧炲姞娓叉煋涓鏋朵笌绌烘€佸尯鍒嗭紙鏃犳暟鎹?娓叉煋涓?澶辫触锛夈€?- [x] `WorkflowPage.tsx` 澧炲姞寤鸿姹犵┖鎬佷笌鎭㈠鎻愮ず鏂囨寮哄寲銆?- [x] `AIArchitectureGenerationDialog` 宸ヤ綔鍙拌矾寰勫鍔犵粺涓€鍔犺浇鍙嶉銆?- [x] 灏忓睆鏂偣鏁寸悊锛堜紭鍏?<=960 鍜?<=600锛夈€?
閫氳繃鏍囧噯锛?
1. 鐢ㄦ埛鍙槑纭尯鍒嗏€滅┖鐘舵€?vs 鍔犺浇涓?vs 閿欒鈥濄€?2. 绉诲姩绔叧閿搷浣滃彲瀹屾垚锛屼笉鍑虹幇鎸夐挳閬尅銆?
---

## 5. 闃舵 P2锛氬伐绋嬪寲瀹屽杽

鐩爣锛氭彁鍗囩ǔ瀹氭€т笌鍙淮鎶ゆ€с€?
- [x] i18n 鎶藉彇锛氬皢 AI 鏋舵瀯妯″潡纭紪鐮佹枃妗堣縼绉诲埌 `packages/excalidraw/locales/en.json` 涓?`packages/excalidraw/locales/zh-CN.json`銆?- [x] Atoms 娴嬭瘯琛ラ綈锛氫负 `chatAtoms/schemeAtoms/workflowAtoms/uiAtoms` 娣诲姞绾€昏緫娴嬭瘯銆?- [x] 灞€閮ㄩ敊璇殧绂伙細涓?`ArchitectureAssistant` 澧炲姞灞€閮ㄩ敊璇竟鐣屻€?- [x] 鏂囨。闂幆锛氬悓姝ユ洿鏂?`plan20260214.md` 涓?`AI_ARCHITECTURE_ASSISTANT.md` 鐘舵€併€佸懡浠や笌楠屾敹娓呭崟銆?
閫氳繃鏍囧噯锛?
1. 鏂板娴嬭瘯绋冲畾閫氳繃銆?2. 鏂囨璧?i18n key锛屼笉鏂板纭紪鐮佷腑鏂囥€?3. 鏂囨。鍙洿鎺ヤ綔涓哄彂甯冮獙鏀朵緷鎹€?
---

## 6. 鍥炲綊楠屾敹娓呭崟

1. 缁熶竴鍏ュ彛锛氫富鑿滃崟鍗曞叆鍙ｅ彲杩涘叆鍔╂墜骞跺湪 Tab 闂村垏鎹袱绫昏兘鍔涖€?2. 鐢熸垚璇箟锛氭柊寤?鏇存柊璺宠浆銆佸揩鐓у喕缁撱€佺籂鍋忛噸璇曚繚鎸佹纭€?3. 鎸佷箙鍖栵細鑱婂ぉ/寤鸿姹?鏂规/椤甸潰鐘舵€佸彲鎭㈠銆?4. 棰勮浣撻獙锛氭覆鏌撲腑绂佺敤鎻掑叆锛屽畬鎴愬悗鍙彃鍏ワ紝绌烘€?閿欒鎻愮ず鏄庣‘銆?5. 闂ㄧ锛歚yarn test:architecture` 涓庡叧閿?`yarn test:app --watch=false ...` 閫氳繃銆?
---

## 7. 鎵ц鍋囪

1. 鑿滃崟閲囩敤鍗曞叆鍙ｇ粺涓€锛屼笉淇濈暀鈥淎I鏋舵瀯鐢熸垚鈥濈嫭绔嬭彍鍗曢」銆?2. 鏈疆涓嶆敼鍔ㄦ寔涔呭寲 schema锛屽彧鍋氬吋瀹规€у畨鍏ㄦ敼閫犮€?3. i18n 棣栨壒瑕嗙洊 `en` 涓?`zh-CN`锛屽叾浣欒绉嶆部鐢ㄥ洖閫€绛栫暐銆?4. 鏈疆鑱氱劍缁撴瀯閲嶆暣涓庝綋楠屼慨澶嶏紝涓嶆柊澧炰笟鍔¤兘鍔涖€?
---

## 8. 楠屾敹璁板綍锛?026-02-13锛?
1. `yarn test:architecture`锛氶€氳繃銆?2. `yarn test:app --watch=false packages/excalidraw/components/ArchitectureOptimizationDialog/ArchitectureOptimizationDialog.integration.test.ts packages/excalidraw/components/AIArchitectureGenerationDialog/AIArchitectureGenerationDialog.session.test.tsx`锛氶€氳繃銆?3. `yarn test:app --watch=false packages/excalidraw/components/ArchitectureOptimizationDialog/atoms/atoms.test.ts`锛氶€氳繃銆?4. `yarn test:app --watch=false`锛氶€氳繃锛?25 files / 1296 tests passed锛夈€?
