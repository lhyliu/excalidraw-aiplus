> [!WARNING]
> Archived on 2026-02-16. This plan references the retired AIArchitectureGenerationDialog workflow.
> Current implementation uses page-oriented flow (/ai/csv-fix, /ai/draft-confirm) + SSE task API (/api/ai/tasks).
> See AI_ARCHITECTURE_ASSISTANT.md and ackend-proxy/README.md for active architecture.
# AI 鏋舵瀯鐢熸垚鍙戝竷鍓嶈蛋鏌ヨ剼鏈紙鎸夊綋鍓?UI 鏇存柊锛?
鏃ユ湡锛?026-02-13  
鑼冨洿锛歚packages/excalidraw/components/AIArchitectureGenerationDialog*` 涓?`packages/excalidraw/components/AIArchitectureGeneration/*`

## 1. 鐩爣

1. 楠岃瘉鈥滄暟鎹伐浣滃彴 -> 鏋舵瀯鍥捐鍥?-> 鍙俊鐜扮姸鈥濅富閾捐矾銆?2. 楠岃瘉浣庤川閲?CSV 鍦?AI 鍒濊瘑鍒?+ 浜哄伐纭鍦烘櫙涓嬪彲绋冲畾浜у嚭涓氬姟鑽夊浘銆?3. 楠岃瘉璐ㄩ噺闂ㄧ瀵?`confirmed` 鐢熸晥銆?
## 2. 娴嬭瘯鍓嶅噯澶?
1. 鍚姩搴旂敤骞舵墦寮€ `AI鏋舵瀯鐢熸垚`銆?2. 寤鸿浣跨敤鏃犵棔绐楀彛锛岄伩鍏嶅巻鍙蹭細璇濆奖鍝嶇粨鏋溿€?3. 杩愯鑷姩鍖栧洖褰掞細
- `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog/GuidedWorkspaceStep.test.tsx packages/excalidraw/components/AIArchitectureGenerationDialog/ExpertEditOverlay.test.tsx`
- `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog/ImportStep.test.tsx packages/excalidraw/components/AIArchitectureGenerationDialog/DraftStep.test.tsx`

## 3. 鏍蜂緥 CSV 缁?
### A. 鏈€灏忓彲鍑哄浘鏁版嵁
```csv
Host,IP,Service
web-01,10.0.0.1,checkout
web-02,10.0.0.2,checkout
```

### B. 瀛楁鍚嶆贩涔?```csv
MachineName,InnerAddress,AppName,Stage
srv-a,10.1.0.10,order,prod
srv-b,10.1.0.11,order,prod
```

### C. 缂哄け+寮傚父
```csv
Host,IP,Service,Env
win-bastion,,ops,unknown
db-01,abc,db,prod
db-01,10.2.0.2,db,prod
```

### D. 鏈嶅姟鍚嶇己澶辫緝澶?```csv
Host,IP,Service,Env
app-01,10.3.0.1,,production
app-02,10.3.0.2,,production
app-03,10.3.0.3,,production
```

## 4. 鎵嬪伐楠屾敹姝ラ

### 4.1 鏁版嵁宸ヤ綔鍙板熀纭€鍙敤
1. 瀵煎叆 CSV B銆?2. 楠岃瘉涓績琛ㄦ牸鍙紪杈戯紝鍙充晶鎶藉眽鏀惰捣鎬佸彧鏈変竴涓€滃睍寮€寮曞鈥濆叆鍙ｃ€?3. 灞曞紑鎶藉眽鍚庯紝楠岃瘉瀛樺湪锛?- `璇绘噦浣犵殑琛ㄦ牸`
- `寰呯‘璁や簨椤筦
- `杩涘叆 Draft 棰勮`

### 4.2 鏈嶅姟鍚嶇О AI 璇嗗埆鍏ュ彛
1. 瀵煎叆 CSV D銆?2. 楠岃瘉鈥滄湇鍔″悕绉帮紙缁勪欢鐢ㄩ€旓級鈥濊〃澶村瓨鍦?`AI璇嗗埆` 灏忔寜閽€?3. 鐐瑰嚮鍚庨獙璇侊細
- 鍑虹幇璇嗗埆涓姸鎬?- 璇嗗埆缁撴灉鍐欏洖 serviceName
- 鏂板～鍏呭€兼湁涓存椂楂樹寒鎻愮ず

### 4.3 琛岀骇蹇€熻瘑鍒笌鎵嬪伐淇
1. 鍦ㄦ湇鍔″悕浠嶄负绌虹殑琛岀偣鍑?`Row x AI璇嗗埆`銆?2. 楠岃瘉鍗曡璇嗗埆鎴愬姛鍚庝粎褰卞搷瀵瑰簲 row銆?3. 鎵嬪伐淇敼鑻ュ共鍗曞厓鏍硷紝楠岃瘉 `issues` 缁熻涓庡紩瀵煎唴瀹瑰悓姝ュ彉鍖栥€?
### 4.4 鎵归噺缂栬緫宸ュ叿锛圤verlay锛?1. 鐐瑰嚮 `鎵撳紑鎵归噺缂栬緫宸ュ叿`銆?2. 楠岃瘉鏀寔锛?- 鑼冨洿锛堝凡鍕鹃€?鍏ㄩ儴锛?- 瑕嗙洊绛栫暐锛堜粎绌哄€?瑕嗙洊宸叉湁鍊硷級
- 鎵归噺濉厖/蹇界暐鎵€閫夎/鎾ら攢/鎭㈠
3. 鐐瑰嚮鈥滀繚瀛樺苟杩斿洖鏍″噯宸ヤ綔鍙扳€濓紝楠岃瘉鍙樻洿琚繚鐣欍€?
### 4.5 鏋舵瀯鍥捐鍥撅紙鎸変笟鍔¤寖鍥达級
1. 鐐瑰嚮 `杩涘叆 Draft 棰勮`銆?2. 楠岃瘉娴佺▼锛?- 鍙€夋嫨鈥滃綋鍓嶄笟鍔¤寖鍥粹€?- 鏀寔 `AI 閲嶆柊璇嗗埆鑼冨洿`
- 鏀寔 `AI 鍒嗘瀽鍒嗗眰`
- 鍙敓鎴愨€滃綋鍓嶄笟鍔℃灦鏋勫浘鈥?
### 4.6 鍙俊鐜扮姸闂ㄧ
1. 杩涘叆 `鍙俊鐜扮姸`銆?2. 楠岃瘉锛?- 鏈夋湭婊¤冻鏉′欢鏃朵笉鑳借鏍囪 `confirmed`
- 婊¤冻闂ㄦ鍚庡彲杩涘叆 confirmed 鐘舵€?
## 5. 閫氳繃鏍囧噯锛圧elease Gate锛?
1. P0锛?- 宸ヤ綔鍙伴摼璺棴鐜彲鐢?- 琛ㄥご AI 璇嗗埆鍙敤
- 鎵归噺缂栬緫 Overlay 鍙洖婊?- confirmed 鍙楅棬绂佹帶鍒?2. P1锛?- 涓氬姟鑼冨洿璇嗗埆涓庡垎灞傚缓璁彲鐢?- AI 鐢熸垚鏋舵瀯鍥惧彲鐢?3. 鑷姩鍖栫敤渚嬪叏缁匡紙绗?鑺傚懡浠わ級銆?
## 6. 缂洪櫡璁板綍妯℃澘
```md
- 鏍囬:
- 涓ラ噸绾у埆: blocker/high/medium/low
- 澶嶇幇姝ラ:
- 棰勬湡缁撴灉:
- 瀹為檯缁撴灉:
- 褰卞搷鑼冨洿:
- 鎴浘/褰曞睆:
- 寤鸿淇:
```

## 7. 涓婄嚎寤鸿

1. blocker/high > 0锛氫笉鍙戝竷銆?2. 浠?medium/low锛氬彲鐏板害鍙戝竷骞惰窡韪€?3. 棣栨涓婄嚎寤鸿寮€鍚涓烘棩蹇楅噰鏍凤紙涓嶈褰曟晱鎰?CSV 鍐呭锛夈€?
