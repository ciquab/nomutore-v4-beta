import { APP } from './constants.js';
import { db, Store } from './store.js';
import { Calc } from './logic.js';
import { UI, updateBeerSelectOptions, refreshUI } from './ui/index.js';

export const DataManager = {
    /**
     * CSVエクスポート (既存機能維持)
     * @param {string} type - 'logs' | 'checks'
     */
    exportCSV: async (type) => { 
        let data = [], content = "", filename = ""; 
        const escapeCSV = (s) => `"${String(s).replace(/"/g,'""')}"`; 
        
        if(type === 'logs'){ 
            data = await db.logs.toArray();
            data.sort((a,b) => a.timestamp - b.timestamp);
            
            const profile = Store.getProfile();

            content = "日時,内容,カロリー(kcal),換算分(ステッパー),実運動時間(分),ブルワリー,銘柄,評価,メモ\n" + 
                data.map(r => {
                    const rawMin = r.rawMinutes !== undefined ? r.rawMinutes : '-';
                    // kcalがない場合は補完
                    const kcal = r.kcal !== undefined ? Math.round(r.kcal) : Math.round(r.minutes * Calc.burnRate(6.0, profile));
                    return `${new Date(r.timestamp).toLocaleString()},${escapeCSV(r.name)},${kcal},${r.minutes},${rawMin},${escapeCSV(r.brewery)},${escapeCSV(r.brand)},${r.rating || 0},${escapeCSV(r.memo || '')}`;
                }).join('\n'); 
            filename = "beer-log"; 
        } else { 
            data = await db.checks.toArray();
            data.sort((a,b) => a.timestamp - b.timestamp); 
            content = "日時,休肝日,ウエスト,足,水分,繊維,体重\n" + 
                data.map(r => `${new Date(r.timestamp).toLocaleString()},${r.isDryDay},${r.waistEase||false},${r.footLightness||false},${r.waterOk||false},${r.fiberOk||false},${r.weight||''}`).join('\n'); 
            filename = "check-log"; 
        } 
        DataManager.download(content, `nomutore-${filename}.csv`, 'text/csv'); 
    },

    /**
     * 全データの取得（バックアップ用）
     * v4対応: period_archives と 新規LocalStorageキーを含める
     */
    getAllData: async () => {
        const logs = await db.logs.toArray();
        const checks = await db.checks.toArray();
        const archives = await db.period_archives.toArray(); // 【v4追加】
        
        const settings = {};
        Object.values(APP.STORAGE_KEYS).forEach(key => {
            const val = localStorage.getItem(key);
            if (val !== null) settings[key] = val;
        });
        
        return { 
            version: 4, // バックアップバージョン
            exportedAt: Date.now(),
            logs, 
            checks, 
            archives, // 【v4追加】
            settings 
        };
    },

    /**
     * JSONエクスポート (v4対応)
     */
    exportJSON: async () => { 
        const data = await DataManager.getAllData();
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
        DataManager.download(JSON.stringify(data, null, 2), `nomutore_backup_${dateStr}.json`, 'application/json'); 
    },

    copyToClipboard: async () => { 
        const data = await DataManager.getAllData();
        navigator.clipboard.writeText(JSON.stringify(data, null, 2))
            .then(() => UI.showMessage('コピーしました','success'))
            .catch(() => UI.showMessage('コピーに失敗しました', 'error')); 
    },

    /**
     * JSONインポート (v4対応)
     * settings, logs, checks, archives を復元する
     */
    importJSON: (inputElement) => { 
        const f = inputElement.files[0]; 
        if(!f) return; 
        
        const r = new FileReader(); 
        r.onload = async (e) => { 
            try { 
                const d = JSON.parse(e.target.result); 
                
                // バージョンチェックなどは厳密には行わないが、構造確認はする
                if (!d.logs && !d.checks && !d.settings) {
                    throw new Error('Invalid backup format');
                }

                if(confirm('データを復元しますか？\n※既存のデータと重複しないログのみ追加されます。\n※設定は上書きされます。')){ 
                    
                    // 1. Settings (LocalStorage) Restore
                    if (d.settings) {
                        Object.entries(d.settings).forEach(([k, v]) => localStorage.setItem(k, v));
                    }

                    // 2. Logs Restore
                    if (d.logs && Array.isArray(d.logs)) {
                        const existingLogs = await db.logs.toArray();
                        const existingTimestamps = new Set(existingLogs.map(l => l.timestamp));

                        // 重複チェック (timestamp基準)
                        const uniqueLogs = d.logs
                            .filter(l => !existingTimestamps.has(l.timestamp))
                            .map(l => {
                                const { id, ...rest } = l; // ID除外 (Auto Incrementのため)
                                return rest;
                            });
                        
                        const profile = Store.getProfile();

                        // インポート時のデータ補完 (v2以前のデータでkcalがない場合など)
                        const migratedLogs = uniqueLogs.map(l => {
                            if (l.kcal === undefined && l.minutes !== undefined) {
                                const stepperRate = Calc.burnRate(6.0, profile);
                                l.kcal = l.minutes * stepperRate;
                            }
                            return l;
                        });

                        if (migratedLogs.length > 0) {
                            await db.logs.bulkAdd(migratedLogs);
                            console.log(`[Import] ${migratedLogs.length} logs added.`);
                        }
                    }

                    // 3. Checks Restore
                    if (d.checks && Array.isArray(d.checks)) {
                        const existingChecks = await db.checks.toArray();
                        const existingCheckTimestamps = new Set(existingChecks.map(c => c.timestamp));
                        const uniqueChecks = d.checks
                            .filter(c => !existingCheckTimestamps.has(c.timestamp))
                            .map(c => {
                                const { id, ...rest } = c;
                                return rest;
                            });
                        if (uniqueChecks.length > 0) {
                            await db.checks.bulkAdd(uniqueChecks);
                            console.log(`[Import] ${uniqueChecks.length} checks added.`);
                        }
                    }

                    // 4. Archives Restore (v4 New)
                    if (d.archives && Array.isArray(d.archives)) {
                        const existingArchives = await db.period_archives.toArray();
                        // 開始日で重複チェック
                        const existingArchiveStarts = new Set(existingArchives.map(a => a.startDate));
                        
                        const uniqueArchives = d.archives
                            .filter(a => !existingArchiveStarts.has(a.startDate))
                            .map(a => {
                                const { id, ...rest } = a;
                                return rest;
                            });

                        if (uniqueArchives.length > 0) {
                            await db.period_archives.bulkAdd(uniqueArchives);
                            console.log(`[Import] ${uniqueArchives.length} archives added.`);
                        }
                    }

                    // UI更新
                    if (UI.updateModeSelector) UI.updateModeSelector();
                    if (typeof updateBeerSelectOptions === 'function') updateBeerSelectOptions(); 
                    
                    const theme = localStorage.getItem(APP.STORAGE_KEYS.THEME) || 'system';
                    if (UI.applyTheme) UI.applyTheme(theme);
                    
                    await refreshUI(); 
                    
                    UI.showMessage('復元しました','success'); 
                } 
            } catch(err) { 
                console.error(err);
                UI.showMessage('読込失敗: データ形式が不正です','error'); 
            } 
            inputElement.value = ''; 
        }; 
        r.readAsText(f); 
    },

    download: (data, filename, type) => { 
        const blob = new Blob([new Uint8Array([0xEF,0xBB,0xBF]), data], {type: type});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = filename; 
        a.click();
        URL.revokeObjectURL(url);
    }
};