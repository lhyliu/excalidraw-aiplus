> [!WARNING]
> Archived on 2026-02-16. This plan references the retired AIArchitectureGenerationDialog workflow.
> Current implementation uses page-oriented flow (/ai/csv-fix, /ai/draft-confirm) + SSE task API (/api/ai/tasks).
> See AI_ARCHITECTURE_ASSISTANT.md and ackend-proxy/README.md for active architecture.
# AI 鏋舵瀯鍔熻兘鏁存敼璁″垝 v2锛堝榻愮幇鐘朵笌鍙獙鏀剁増锛?
> 褰掓。璇存槑锛氳鏂囦欢涓哄師濮?v2 鑽夋鍩虹嚎鐗堟湰锛屼繚鐣欑敤浜庝笌鎵ц鐗堝鐓с€?
## 鎽樿
鏈鍒掑厛淇鈥滄枃妗ｄ笌浠ｇ爜涓嶄竴鑷淬€侀獙鏀惰剼鏈け鐪熲€濈殑鍩虹闂锛屽啀鍋氱粍浠舵媶鍒嗐€佹牱寮忔ā鍧楀寲銆乁X 鎵撶（鍜屽伐绋嬪寲瀹屽杽銆? 
宸茬‘璁ゅ叆鍙ｇ瓥鐣ラ噰鐢細涓昏彍鍗曞崟鍏ュ彛缁熶竴锛堜粎淇濈暀鈥淎I鏋舵瀯鍔╂墜鈥濓級銆?
## 鍏叡鎺ュ彛涓庣被鍨嬪彉鏇?1. `excalidraw-app/components/AppMainMenu.tsx` 绉婚櫎 `onOpenAIArchitectureGeneration` prop 鍜屸€淎I鏋舵瀯鐢熸垚鈥濊彍鍗曢」锛屼粎淇濈暀鈥淎I鏋舵瀯鍔╂墜鈥濄€?2. `excalidraw-app/App.tsx` 鍒犻櫎瀵瑰簲鍥炶皟涓庣姸鎬佸垎鏀紝浠呬繚鐣欑粺涓€鍏ュ彛璋冪敤銆?3. `packages/excalidraw/components/ArchitectureAssistant.tsx` 淇濈暀 `defaultTab`锛屼絾榛樿浠庣粺涓€鍏ュ彛杩涘叆 `optimize`銆?4. `scripts/test-architecture-fix.js` 鏍￠獙鍙ｅ緞鏇存柊涓?`renderingSchemeIds` 涓?`isPreparingInsert`锛屼笌鐜板疄鐜颁竴鑷淬€?5. 涓嶅紩鍏ョ牬鍧忔€ф暟鎹ā鍨嬪彉鏇达紝`Scheme`/`generationSnapshot`/鎸佷箙鍖栧瓧娈典繚鎸佸吋瀹广€?
## 闃舵 0锛氫簨瀹炲榻愪笌闂ㄧ淇锛圥0锛屽繀椤诲厛瀹屾垚锛?鐩爣锛氳鈥滄枃妗ｃ€佽剼鏈€佷唬鐮併€侀獙鏀剁粨鏋溾€濅竴鑷淬€?
鎵ц椤癸細
1. 淇 `scripts/test-architecture-fix.js` 鐨勬棫鍙橀噺鏍￠獙閫昏緫锛坄renderingSchemes` -> `renderingSchemeIds`锛夈€?2. 鏇存柊 `plan20260214.md` 闃舵鐘舵€佷笌娴嬭瘯鍙ｅ緞锛岀Щ闄よ繃鏃垛€?5/24 鏂囦欢鈥濊鏁拌〃杈俱€?3. 鏇存柊 `AI_ARCHITECTURE_ASSISTANT.md` 涓凡澶辨晥鐨?`ai/generators` 涓庣ず渚嬩唬鐮侊紝鏀逛负褰撳墠 hook + `runAIStream` 鏋舵瀯銆?4. 鏀舵暃涓昏彍鍗曞叆鍙ｏ細淇敼 `excalidraw-app/components/AppMainMenu.tsx` 涓?`excalidraw-app/App.tsx`锛屽彧淇濈暀鈥淎I鏋舵瀯鍔╂墜鈥濄€?
楠屾敹鍛戒护锛?1. `yarn test:architecture`
2. `yarn test:app --watch=false packages/excalidraw/components/ArchitectureOptimizationDialog/ArchitectureOptimizationDialog.integration.test.ts packages/excalidraw/components/AIArchitectureGenerationDialog/AIArchitectureGenerationDialog.session.test.tsx`

閫氳繃鏍囧噯锛?1. 涓ゆ潯鍛戒护鍧囬€氳繃銆?2. 涓昏彍鍗曞彧鍑虹幇涓€涓?AI 涓诲叆鍙ｏ紝鍔熻兘鍙€氳繃 Tab 鍒囨崲瑕嗙洊鍘熷弻鍏ュ彛鑳藉姏銆?
## 闃舵 1锛歚ArchitectureOptimizationDialog` 缁勪欢涓庨€昏緫鎷嗗垎锛圥1锛?鐩爣锛氭妸宸ㄥ瀷鏂囦欢闄嶄负鈥滅紪鎺掑眰鈥濓紝閬垮厤缁х画鑶ㄨ儉銆?
鏂板鏂囦欢锛?1. `packages/excalidraw/components/ArchitectureOptimizationDialog/ConfigurationWaitScreen.tsx`
2. `packages/excalidraw/components/ArchitectureOptimizationDialog/ClearSchemesConfirmDialog.tsx`
3. `packages/excalidraw/components/ArchitectureOptimizationDialog/SchemeUndoToast.tsx`
4. `packages/excalidraw/components/ArchitectureOptimizationDialog/hooks/useArchitecturePersistence.ts`
5. `packages/excalidraw/components/ArchitectureOptimizationDialog/hooks/usePreviewRenderer.ts`
6. `packages/excalidraw/components/ArchitectureOptimizationDialog/hooks/usePlanGeneration.ts`

淇敼鏂囦欢锛?1. `packages/excalidraw/components/ArchitectureOptimizationDialog.tsx` 浠呬繚鐣欑姸鎬佺紪鎺掍笌瀛愮粍浠惰閰嶃€?2. `packages/excalidraw/components/ArchitectureOptimizationDialog/PreviewPage.tsx` 涓?`WorkflowPage.tsx` 鍙繚鐣欏睍绀洪€昏緫銆?
閫氳繃鏍囧噯锛?1. `ArchitectureOptimizationDialog.tsx` 琛屾暟鏄捐憲涓嬮檷锛堢洰鏍?< 1200 琛岋級銆?2. 琛屼负涓嶅彉锛岀幇鏈?integration/test 鍏ㄩ€氳繃銆?
## 闃舵 2锛氭牱寮忔ā鍧楀寲涓庢鏍峰紡娓呯悊锛圥1锛?鐩爣锛氱粨鏉熷崟鏂囦欢 4000+ 琛屾牱寮忕淮鎶ゆā寮忋€?
鏂板鏍峰紡鏂囦欢锛?1. `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_tokens.scss`
2. `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_layout.scss`
3. `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_chat.scss`
4. `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_workflow.scss`
5. `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_preview.scss`
6. `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_overlays.scss`

鏀归€犵瓥鐣ワ細
1. `ArchitectureOptimizationDialog.scss` 浠呬繚鐣?import 涓庢瀬灏戞暟鍏煎瑕嗙洊銆?2. `ArchitectureOptimizationDialog.layout.scss` 鍐呭骞跺叆 `_layout.scss` 鍚庡垹闄わ紝閬垮厤鍙屽叆鍙ｆ牱寮忔簮銆?
閫氳繃鏍囧噯锛?1. 鏍峰紡鐩綍鑱岃矗娓呮櫚銆?2. UI 鍏抽敭璺緞鏃犲彲瑙佸洖褰掞紙瀵硅瘽銆佸缓璁〉銆侀瑙堥〉銆佹竻绌虹‘璁ゃ€佹湭閰嶇疆椤碉級銆?
## 闃舵 3锛歎X 涓庢€ц兘鎵撶（锛圥2锛?鐩爣锛氳ˉ榻愨€滄劅鐭ユ€ц兘鈥濆拰鈥滃け璐ュ彲鐞嗚В鎬р€濄€?
鎵ц椤癸細
1. 鍦?`PreviewPage.tsx` 澧炲姞娓叉煋涓鏋朵笌绌烘€佸尯鍒嗭紙鏃犳暟鎹?娓叉煋涓?澶辫触锛夈€?2. 鍦?`WorkflowPage.tsx` 澧炲姞寤鸿姹犵┖鎬佷笌鎭㈠鎻愮ず鍏ュ彛鏂囨寮哄寲銆?3. 鍦?`AIArchitectureGenerationDialog` 宸ヤ綔鍙拌矾寰勫鍔犵粺涓€鍔犺浇鍙嶉锛屼笉鏀瑰彉涓氬姟璇箟銆?4. 閽堝灏忓睆鏂偣鏁寸悊浜や簰锛堜紭鍏?<=960 鍜?<=600锛夈€?
閫氳繃鏍囧噯锛?1. 鐢ㄦ埛鑳芥槑纭垎杈ㄢ€滅┖鐘舵€?vs 鍔犺浇涓?vs 閿欒鈥濄€?2. 绉诲姩绔笅涓昏鎿嶄綔鍙畬鎴愶紝涓嶅嚭鐜板叧閿寜閽伄鎸°€?
## 闃舵 4锛氬伐绋嬪寲瀹屽杽锛圥2锛?鐩爣锛氳璇ユā鍧楄繘鍏ョǔ瀹氬彲缁存姢鐘舵€併€?
鎵ц椤癸細
1. i18n 鎶藉彇锛氭妸 AI 鏋舵瀯妯″潡纭紪鐮佹枃妗堣縼绉诲埌 `packages/excalidraw/locales/en.json` 涓?`packages/excalidraw/locales/zh-CN.json`銆?2. Atoms 娴嬭瘯琛ラ綈锛氫负 `chatAtoms/schemeAtoms/workflowAtoms/uiAtoms` 澧炲姞绾€昏緫娴嬭瘯銆?3. 灞€閮ㄩ敊璇殧绂伙細涓?Architecture Assistant 澧炲姞灞€閮ㄩ敊璇竟鐣岋紝閬垮厤鍗曟ā鍧楀紓甯稿奖鍝嶅叏灞€缂栬緫鍣ㄣ€?4. 鏂囨。闂幆锛氬悓姝ユ洿鏂?`plan20260214.md` 涓?`AI_ARCHITECTURE_ASSISTANT.md` 鐨勭姸鎬併€佸懡浠ゃ€侀獙鏀舵竻鍗曘€?
閫氳繃鏍囧噯锛?1. 鏂板娴嬭瘯绋冲畾閫氳繃銆?2. 鏂囨璧?i18n key锛屼笉鍐嶆柊澧炵‖缂栫爜涓枃銆?3. 鏂囨。鍙洿鎺ヤ綔涓哄彂甯冮獙鏀朵緷鎹€?
## 鍥炲綊娴嬭瘯涓庨獙鏀跺満鏅?1. 缁熶竴鍏ュ彛锛氫富鑿滃崟鍗曞叆鍙ｅ彲杩涘叆鍔╂墜骞跺湪 Tab 闂村垏鎹袱绫昏兘鍔涖€?2. 鐢熸垚涓庢洿鏂拌涔夛細鏂板缓/鏇存柊鏂规璺宠浆銆佸揩鐓у喕缁撱€侀噸璇曟牎楠屼繚鎸佹纭€?3. 鎸佷箙鍖栦笌瀵煎叆瀵煎嚭锛氳亰澶┿€佸缓璁睜銆佹柟妗堛€侀〉闈㈢姸鎬佸彲鎭㈠銆?4. 棰勮浣撻獙锛氭覆鏌撲腑绂佺敤鎻掑叆銆佸畬鎴愬悗鍙彃鍏ャ€佺┖鎬?閿欒鎬佹彁绀烘槑纭€?5. 闂ㄧ锛歚yarn test:architecture` 涓庡叧閿?`yarn test:app --watch=false ...` 閫氳繃銆?
## 鍋囪涓庨粯璁?1. 鑿滃崟鍏ュ彛閲囩敤鈥滃崟鍏ュ彛缁熶竴鈥濓紝涓嶅啀淇濈暀鈥淎I鏋舵瀯鐢熸垚鈥濈嫭绔嬭彍鍗曢」銆?2. 涓嶆敼鍔ㄧ幇鏈夋暟鎹瓨鍌?schema锛屼紭鍏堝仛鍏煎鎬у畨鍏ㄦ敼閫犮€?3. i18n 棣栨壒瑕嗙洊 `en` 涓?`zh-CN`锛屽叾浠栬绉嶆部鐢ㄧ幇鏈夊洖閫€鏈哄埗銆?4. 涓嶅湪鏈疆鍋氭柊鍔熻兘鎵╁睍锛屽彧鍋氱粨鏋勫寲閲嶆暣涓庝綋楠屼慨澶嶃€?
