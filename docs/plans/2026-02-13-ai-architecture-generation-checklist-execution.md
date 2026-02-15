> [!WARNING]
> Archived on 2026-02-16. This plan references the retired AIArchitectureGenerationDialog workflow.
> Current implementation uses page-oriented flow (/ai/csv-fix, /ai/draft-confirm) + SSE task API (/api/ai/tasks).
> See AI_ARCHITECTURE_ASSISTANT.md and ackend-proxy/README.md for active architecture.
# AI 鏋舵瀯鐢熸垚鑱旇皟娓呭崟鎵ц璁板綍锛?026-02-13锛?
## 鎵ц鍛戒护

```bash
yarn vitest --run packages/excalidraw/components/ArchitectureOptimizationDialog/importWorkflow packages/excalidraw/components/AIArchitectureGenerationDialog
```

缁撴灉锛?- Test Files: `15 passed`
- Tests: `21 passed`

## 娓呭崟缁撴灉

### A. 鑷姩楠岃瘉閫氳繃

1. CSV 瀵煎叆涓庤В鏋愰摼璺彲鐢紙`parseCsv`锛夈€?2. 瀛楁鎺ㄦ柇銆佸瓧娈垫槧灏勬牎楠屽彲鐢紙`fieldInference`銆乣fieldMapping`锛夈€?3. 鏍囧噯鍖栨敮鎸?`ignoredRows`銆乣edits` 瑕嗙洊锛坄normalizeVmRows`锛夈€?4. Issues 妫€娴嬭鍒欏彲鐢紙缂哄け銆佹牸寮忋€侀噸澶嶃€佺幆澧冨紓甯革級銆?5. 鏈嶅姟鍒嗙粍鎺ㄦ柇鍙敤锛堟湇鍔″悕浼樺厛锛屼富鏈哄悕鍓嶇紑鍥為€€锛夈€?6. Draft 闃舵鍙Е鍙戝懡鍚嶅缓璁苟鎵嬪姩搴旂敤锛堜笉浼氳嚜鍔ㄥ啓浜嬪疄锛夈€?7. Calibrate 闃舵鍙€氳繃浠诲姟瀹屾垚鎺ㄨ繘鍒?`confirmed`銆?8. 浼氳瘽鎭㈠鍙敤锛坰tep銆乵ode銆乨raft filter銆乶aming suggestions锛夈€?
### B. 浠嶉渶浜哄伐鐐规

1. 鑿滃崟鍏ュ彛涓庨《閮ㄥ叆鍙ｄ氦浜掓祦鐣呭害锛堣瑙変笌鍙敤鎬э級銆?2. 澶?CSV 鏁版嵁閲忎笅 UI 鍝嶅簲锛堟粴鍔?缂栬緫/鍒囨崲姝ラ浣撻獙锛夈€?3. 娣辫壊/娴呰壊涓婚涓嬪彲璇绘€т笌瀵规瘮搴︺€?4. 娴忚鍣ㄥ埛鏂板悗鐨勮法姝ラ缁х画鎿嶄綔浣撻獙锛堥潪娴嬭瘯鐜鐪熷疄 localStorage锛夈€?
## 澶囨敞

- 褰撳墠鑷姩鍖栬鐩栦互閫昏緫涓庣粍浠惰涓轰负涓汇€?- 鑻ヨ繘鍏ュ彂甯冨墠闃舵锛屽缓璁ˉ 1 鏉＄湡瀹炴祻瑙堝櫒 E2E锛圥laywright 鎴?Cypress锛夎鐩栤€滃鍏ュ埌 confirmed鈥濅富娴佺▼銆?

