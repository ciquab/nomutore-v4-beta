import { APP, EXERCISE, SIZE_DATA, CALORIES } from './constants.js';
import { Store, ExternalApp, db } from './store.js'; 
import { Calc } from './logic.js';
import { UI, StateManager, updateBeerSelectOptions, refreshUI, toggleModal } from './ui/index.js';
import { Service } from './service.js';
import { Timer, setTimerSaveHandler } from './timer.js';
import { DataManager } from './dataManager.js';
import { initErrorHandler } from './errorHandler.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

/* ==========================================================================
   Initialization & Global State
   ========================================================================== */

// ★重要: HTMLのonclick属性から参照できるようにグローバルに公開
window.UI = UI;

// グローバルエラーハンドリングの初期化
initErrorHandler();

// 編集中のIDを保持する状態変数
let editingLogId = null;
let editingCheckId = null;

// ライフサイクル管理用: 最後にアクティブだった日付
const LAST_ACTIVE_KEY = 'nomutore_last_active_date';
let lastActiveDate = localStorage.getItem(LAST_ACTIVE_KEY) || dayjs().format('YYYY-MM-DD');

/* ==========================================================================
   Lifecycle Management
   ========================================================================== */

let isResuming = false;

/**
 * アプリのライフサイクルイベント（復帰、日跨ぎ）を監視・処理する
 */
const setupLifecycleListeners = () => {
    // 1. Visibility Change (スマホでのアプリ復帰時など)
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            await handleAppResume();
        }
    });

    // 2. 定期チェック (1分毎 - アプリを開いたまま日を跨いだ場合)
    setInterval(() => {
        const current = dayjs().format('YYYY-MM-DD');
        if (current !== lastActiveDate) {
            handleAppResume();
        }
    }, 60000);
};

/**
 * アプリ復帰・日付変更時の処理
 */
const handleAppResume = async () => {
    if (isResuming) return;
    isResuming = true;

    try {
        const today = dayjs().format('YYYY-MM-DD');
        const isNewDay = today !== lastActiveDate;

        if (isNewDay) {
            console.log(`[Lifecycle] Day changed: ${lastActiveDate} -> ${today}`);
            lastActiveDate = today;
            localStorage.setItem(LAST_ACTIVE_KEY, today);

            // 日付が変わったら今日のチェックインレコードを確保
            await Service.ensureTodayCheckRecord();
            
            // ヒートマップ等の表示更新のためにリロードを推奨する場合もあるが、
            // ここではSPAとして画面リフレッシュのみを行う
        }

        // 画面を最新状態に更新
        await refreshUI();
        
    } catch (e) {
        console.error('[Lifecycle] Resume error:', e);
    } finally {
        isResuming = false;
    }
};

/* ==========================================================================
   Event Handlers (UI -> Service/Logic)
   ========================================================================== */

// 設定保存
const handleSaveSettings = async () => {
    const getVal = (id) => document.getElementById(id).value;
    const w = parseFloat(getVal('weight-input'));
    const h = parseFloat(getVal('height-input'));
    const a = parseInt(getVal('age-input'));
    
    if (w > 0 && h > 0 && a > 0) {
        if (w > 300 || h > 300 || a > 150) {
            return UI.showMessage('入力値を確認してください', 'error');
        }

        const keys = APP.STORAGE_KEYS;
        localStorage.setItem(keys.WEIGHT, w);
        localStorage.setItem(keys.HEIGHT, h);
        localStorage.setItem(keys.AGE, a);
        localStorage.setItem(keys.GENDER, getVal('gender-input'));
        localStorage.setItem(keys.MODE1, getVal('setting-mode-1'));
        localStorage.setItem(keys.MODE2, getVal('setting-mode-2'));
        localStorage.setItem(keys.BASE_EXERCISE, getVal('setting-base-exercise'));
        localStorage.setItem(keys.THEME, getVal('theme-input'));
        localStorage.setItem(keys.DEFAULT_RECORD_EXERCISE, getVal('setting-default-record-exercise'));
        
        toggleModal('settings-modal', false);
        
        UI.updateModeSelector();
        updateBeerSelectOptions();
        
        // 運動種目選択のデフォルト値も更新
        const recordSelect = document.getElementById('exercise-select');
        if (recordSelect) recordSelect.value = getVal('setting-default-record-exercise');
        
        UI.applyTheme(getVal('theme-input'));
        await refreshUI();
        UI.showMessage('設定を保存しました', 'success');
    } else {
        UI.showMessage('すべての項目を正しく入力してください', 'error');
    }
};

// ビール記録保存
const handleBeerSubmit = async (e) => {
    if(e) e.preventDefault(); // フォーム送信の場合はリロード防止
    
    const inputData = UI.getBeerFormData();
    if (!inputData.isValid) {
        return UI.showMessage('入力値を確認してください', 'error');
    }

    await Service.saveBeerLog(inputData, editingLogId);

    editingLogId = null;
    toggleModal('beer-modal', false);
    UI.resetBeerForm();
    // await refreshUI(); // Service内で呼ばれるため不要
};

// 続けて記録 (Save & Next)
const handleSaveAndNext = async (e) => {
    if(e) e.preventDefault();
    const inputData = UI.getBeerFormData();
    if (!inputData.isValid) return UI.showMessage('入力値を確認してください', 'error');
    
    await Service.saveBeerLog(inputData, null); // 新規登録強制
    UI.resetBeerForm(true); // 日付は維持
    // refreshUIはService内で呼ばれる
};

// 運動手動記録保存
const handleManualExerciseSubmit = async () => {
    const dateVal = document.getElementById('manual-date').value;
    const m = parseFloat(document.getElementById('manual-minutes').value);
    const applyBonus = document.getElementById('manual-apply-bonus').checked;
    const exKey = document.getElementById('exercise-select').value;

    if (!m || m <= 0) return UI.showMessage('正しい時間を入力してください', 'error');

    await Service.saveExerciseLog(exKey, m, dateVal, applyBonus, editingLogId);

    document.getElementById('manual-minutes').value = '';
    toggleModal('manual-exercise-modal', false);
    editingLogId = null;
    // await refreshUI(); // Service内で呼ばれるため不要
};

// デイリーチェック保存
const handleCheckSubmit = async (e) => {
    if(e) e.preventDefault();
    const f = document.getElementById('check-form');
    const w = document.getElementById('check-weight').value;
    
    let weightVal = null;
    if (w !== '') {
        weightVal = parseFloat(w);
        if (weightVal <= 0) return UI.showMessage('体重は正の数で入力してください', 'error');
    }

    const formData = {
        date: document.getElementById('check-date').value,
        isDryDay: document.getElementById('is-dry-day').checked,
        waistEase: f.elements['waistEase'].checked,
        footLightness: f.elements['footLightness'].checked,
        waterOk: f.elements['waterOk'].checked,
        fiberOk: f.elements['fiberOk'].checked,
        weight: weightVal
    };

    // editingCheckId を Service に渡す
    await Service.saveDailyCheck(formData, editingCheckId);

    toggleModal('check-modal', false);
    
    // フォームのリセット
    document.getElementById('is-dry-day').checked = false;
    document.getElementById('check-weight').value = '';
    f.reset();
    
    // UI状態リセット (drinking-only-section のスタイルを戻す)
    const drinkSec = document.getElementById('drinking-only-section');
    if(drinkSec) {
        drinkSec.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
    }
    
    editingCheckId = null;
    // await refreshUI(); // Service内で呼ばれるため不要
};

// シェア機能 (SNSへ投稿)
const handleShare = async () => {
    const { logs, checks } = await Service.getAllDataForUI();
    const profile = Store.getProfile();
    const gradeData = Calc.getRecentGrade(checks, logs, profile);
    const streak = Calc.getCurrentStreak(logs, checks, profile);
    const baseEx = Store.getBaseExercise();
    const baseExData = EXERCISE[baseEx] || EXERCISE['stepper'];

    const totalKcal = logs.reduce((sum, l) => {
        let val = l.kcal;
        if (val === undefined) {
            const exKey = l.exerciseKey || 'stepper';
            const met = (EXERCISE[exKey] || EXERCISE['stepper']).met;
            val = l.minutes * Calc.burnRate(met, profile);
        }
        return sum + val;
    }, 0);

    const mode1 = localStorage.getItem(APP.STORAGE_KEYS.MODE1) || APP.DEFAULTS.MODE1;
    const beerCount = Calc.convertKcalToBeerCount(Math.abs(totalKcal), mode1);
    const balanceMinutes = Calc.convertKcalToMinutes(Math.abs(totalKcal), baseEx, profile);

    const statusText = totalKcal >= 0
        ? `貯金: ${mode1}${beerCount}本分を返済！🍺`
        : `借金: ${mode1}${beerCount}本分が残ってます…🍺`;

    const text = `現在: ${gradeData.label} (${gradeData.rank})
| 連続: ${streak}日🔥
| ${statusText}
（${baseExData.label}${balanceMinutes}分換算）
#ノムトレ #飲んだら動く`;

    shareToSocial(text);
};

// 詳細からのシェア機能
const handleDetailShare = async () => {
    const modal = document.getElementById('log-detail-modal');
    if (!modal || !modal.dataset.id) return;
    
    const logs = await db.logs.toArray();
    const log = logs.find(l => l.id === parseInt(modal.dataset.id));
    if (!log) return;

    const profile = Store.getProfile();
    const baseEx = Store.getBaseExercise();
    const baseExData = EXERCISE[baseEx] || EXERCISE['stepper'];
    let text = '';

    const isDebt = (log.kcal !== undefined)
        ? log.kcal < 0
        : ((log.minutes < 0) || !!log.brand || !!log.style);

    if (isDebt) {
        let kcalVal = log.kcal;
        if (kcalVal === undefined) {
            const exKey = log.exerciseKey || 'stepper';
            const met = (EXERCISE[exKey] || EXERCISE['stepper']).met;
            kcalVal = log.minutes * Calc.burnRate(met, profile);
        }
        
        const debtMins = Calc.convertKcalToMinutes(Math.abs(kcalVal), baseEx, profile);
        const beerName = log.brand || log.style || 'ビール';
        text = `🍺 飲みました: ${beerName}\n| 借金発生: ${baseExData.label}換算で${debtMins}分…😱\n#ノムトレ`;
    } else {
        const exKey = log.exerciseKey || 'stepper';
        const exData = EXERCISE[exKey] || EXERCISE['stepper'];
        const mode1 = localStorage.getItem(APP.STORAGE_KEYS.MODE1) || APP.DEFAULTS.MODE1;
        const earnedKcal = log.kcal !== undefined ? log.kcal : 0;
        const beerCount = Calc.convertKcalToBeerCount(earnedKcal, mode1);
        text = `🏃‍♀️ 運動しました: ${exData.label}\n| 借金返済: ${mode1}${beerCount}本分を返済！🍺\n#ノムトレ`;
    }
    shareToSocial(text);
};

// シェア実行ヘルパー
const shareToSocial = async (text) => {
    if (navigator.share) {
        try { 
            await navigator.share({ title: 'ノムトレ', text: text }); 
        } catch (err) { 
            console.log('Share canceled'); 
        }
    } else {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`, '_blank');
    }
};

/* ==========================================================================
   Data Migration (Startup only)
   ========================================================================== */
async function migrateData() {
    const oldLogs = localStorage.getItem(APP.STORAGE_KEYS.LOGS);
    const oldChecks = localStorage.getItem(APP.STORAGE_KEYS.CHECKS);
    
    try {
        // LocalStorage -> IndexedDB 移行
        if (oldLogs) {
            const logs = JSON.parse(oldLogs); 
            if (logs.length > 0) await db.logs.bulkAdd(logs);
            localStorage.removeItem(APP.STORAGE_KEYS.LOGS);
            console.log('[Migration] Logs migrated to DB.');
        }
        if (oldChecks) {
            const checks = JSON.parse(oldChecks); 
            if (checks.length > 0) await db.checks.bulkAdd(checks);
            localStorage.removeItem(APP.STORAGE_KEYS.CHECKS);
            console.log('[Migration] Checks migrated to DB.');
        }

        // kcal未計算の古いログがあれば補完 (互換性維持)
        const logs = await db.logs.toArray();
        const needsUpdate = logs.filter(l => l.kcal === undefined && l.minutes !== undefined);
        if (needsUpdate.length > 0) {
            console.log(`[Migration] Updating ${needsUpdate.length} old logs with kcal data.`);
            const profile = Store.getProfile();
            for (const log of needsUpdate) {
                // exerciseKeyを尊重して再計算
                const key = log.exerciseKey || 'stepper';
                const exData = EXERCISE[key] || EXERCISE['stepper'];
                const met = exData.met || 6.0;
                const rate = Calc.burnRate(met, profile);
                await db.logs.update(log.id, { kcal: log.minutes * rate });
            }
        }
    } catch (e) {
        console.warn('[migrateData] Migration failed or partial:', e);
    }
}

/* ==========================================================================
   Event Binding & Bootstrap
   ========================================================================== */

let touchStartX = 0;
let touchStartY = 0;

// v4スワイプ判定: 2タブ構成 (Home, Cellar)
const handleTouchEnd = (e) => {
    const diffX = e.changedTouches[0].screenX - touchStartX;
    const diffY = e.changedTouches[0].screenY - touchStartY;
    
    // Y方向のブレが少ない場合のみスワイプと判定
    if (Math.abs(diffX) > 60 && Math.abs(diffY) < 50) { 
        // 現在表示されているタブを判定
        const homeTab = document.getElementById('tab-home');
        const isHomeActive = homeTab && !homeTab.classList.contains('hidden');

        if (diffX < 0) {
            // Left Swipe: Home -> Cellar
            if (isHomeActive) UI.switchTab('cellar');
        } else {
            // Right Swipe: Cellar -> Home
            if (!isHomeActive) UI.switchTab('home');
        }
    }
};

function bindEvents() {
    // ---------------------------------------------------------
    // 1. 一般的なUI操作 (Settings, Help, Mode Select)
    // ---------------------------------------------------------
    document.getElementById('btn-open-settings')?.addEventListener('click', UI.openSettings);
    document.getElementById('btn-save-settings')?.addEventListener('click', handleSaveSettings);
    document.getElementById('home-mode-select')?.addEventListener('change', (e) => UI.setBeerMode(e.target.value));
    document.getElementById('btn-open-help')?.addEventListener('click', UI.openHelp);

    // ---------------------------------------------------------
    // 2. 記録フォーム (Beer, Exercise, Check)
    // ---------------------------------------------------------
    // ビール記録 (フォーム送信 & ボタンクリック両対応)
    document.getElementById('beer-form')?.addEventListener('submit', handleBeerSubmit);
    document.getElementById('btn-save-beer')?.addEventListener('click', handleBeerSubmit); 
    document.getElementById('btn-save-next')?.addEventListener('click', handleSaveAndNext);
    
    // タブ切り替え
    document.getElementById('tab-beer-preset')?.addEventListener('click', () => UI.switchBeerInputTab('preset'));
    document.getElementById('tab-beer-custom')?.addEventListener('click', () => UI.switchBeerInputTab('custom'));

    // 運動記録
    document.getElementById('btn-submit-manual')?.addEventListener('click', handleManualExerciseSubmit);

    // デイリーチェック
    document.getElementById('check-form')?.addEventListener('submit', handleCheckSubmit);
    document.getElementById('check-submit-btn')?.addEventListener('click', handleCheckSubmit); 
    
    // 休肝日トグル連動
    document.getElementById('is-dry-day')?.addEventListener('change', function() { UI.toggleDryDay(this); });

    // ---------------------------------------------------------
    // 3. タイマー操作 (timer.js連携)
    // ---------------------------------------------------------
    document.getElementById('start-stepper-btn')?.addEventListener('click', Timer.start);
    document.getElementById('pause-stepper-btn')?.addEventListener('click', Timer.pause);
    document.getElementById('resume-stepper-btn')?.addEventListener('click', Timer.resume);
    document.getElementById('stop-stepper-btn')?.addEventListener('click', Timer.stop);

    // ---------------------------------------------------------
    // 4. モーダル制御 (閉じる, 背景クリック)
    // ---------------------------------------------------------
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            toggleModal(modal.id, false);
            editingLogId = null; editingCheckId = null;
        });
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                toggleModal(modal.id, false);
                editingLogId = null; editingCheckId = null;
            }
        });
    });

    // ---------------------------------------------------------
    // 5. ログリスト操作 (削除, 詳細, 編集)
    // ---------------------------------------------------------
    const logList = document.getElementById('log-list');
    logList?.addEventListener('click', async (e) => {
        // チェックボックスクリックは無視（別途changeイベントで拾う）
        if (e.target.classList.contains('log-checkbox')) return;
        
        // 削除ボタン (行内のゴミ箱)
        const deleteBtn = e.target.closest('.delete-log-btn');
        if (deleteBtn) {
            e.stopPropagation();
            await Service.deleteLog(deleteBtn.dataset.id);
            return;
        }
        
        // 行クリック（詳細表示）
        const row = e.target.closest('.log-item-row');
        if (row) {
            const log = await db.logs.get(parseInt(row.dataset.id));
            if(log) UI.openLogDetail(log);
        }
    });

    // 詳細モーダル内の操作ボタン
    document.getElementById('btn-detail-delete')?.addEventListener('click', async () => {
        const id = document.getElementById('log-detail-modal').dataset.id;
        if (id) {
            await Service.deleteLog(id);
            toggleModal('log-detail-modal', false);
            editingLogId = null;
        }
    });
    document.getElementById('btn-detail-edit')?.addEventListener('click', async () => {
        const id = parseInt(document.getElementById('log-detail-modal').dataset.id);
        const log = await db.logs.get(id);
        if (log) {
            editingLogId = id;
            toggleModal('log-detail-modal', false);
            const isDebt = (log.kcal !== undefined) ? log.kcal < 0 : ((log.minutes < 0) || !!log.brand);
            isDebt ? UI.openBeerModal(log) : UI.openManualInput(log);
        }
    });
    // 詳細からのシェア (v4ではボタン未実装の可能性が高いがロジックは保持)
    // document.getElementById('btn-detail-share')?.addEventListener('click', handleDetailShare);

    // 一括操作
    document.getElementById('btn-toggle-edit-mode')?.addEventListener('click', UI.toggleEditMode);
    document.getElementById('btn-select-all')?.addEventListener('click', UI.toggleSelectAll);
    document.getElementById('btn-bulk-delete')?.addEventListener('click', async () => {
        const ids = Array.from(document.querySelectorAll('.log-checkbox:checked')).map(cb => parseInt(cb.value));
        if (ids.length > 0) {
            await Service.bulkDeleteLogs(ids);
        }
    });

    // ---------------------------------------------------------
    // 6. ダッシュボード操作 (ヒートマップ, フィルタ)
    // ---------------------------------------------------------
    // ヒートマップ
    document.getElementById('heatmap-prev')?.addEventListener('click', () => { StateManager.incrementHeatmapOffset(); refreshUI(); });
    document.getElementById('heatmap-next')?.addEventListener('click', () => { if(StateManager.heatmapOffset > 0) { StateManager.decrementHeatmapOffset(); refreshUI(); }});

    document.getElementById('heatmap-grid')?.addEventListener('click', async (e) => {
        const cell = e.target.closest('.heatmap-cell');
        if (cell && cell.dataset.date) {
            const dateStr = cell.dataset.date;
            const checks = await db.checks.toArray();
            const target = checks.find(c => dayjs(c.timestamp).format('YYYY-MM-DD') === dateStr);
            editingCheckId = target ? target.id : null;
            UI.openCheckModal(target, dateStr);
        }
    });

    // ランクカードクリックで今日のチェックを開く
    document.getElementById('liver-rank-card')?.addEventListener('click', async () => {
        const todayStr = dayjs().format('YYYY-MM-DD');
        const checks = await db.checks.toArray();
        const target = checks.find(c => dayjs(c.timestamp).format('YYYY-MM-DD') === todayStr);
        editingCheckId = target ? target.id : null;
        UI.openCheckModal(target);
    });

    // チャートフィルタ
    document.getElementById('chart-filters')?.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            StateManager.setChartRange(e.target.dataset.range);
            refreshUI();
        }
    });

    // ---------------------------------------------------------
    // 7. 入力支援 (Select, Quick Buttons)
    // ---------------------------------------------------------
    document.getElementById('beer-select')?.addEventListener('change', updateBeerSelectOptions);
    document.getElementById('exercise-select')?.addEventListener('change', function() {
        const nameEl = document.getElementById('manual-exercise-name');
        if(nameEl && EXERCISE[this.value]) nameEl.textContent = EXERCISE[this.value].label;
    });

    // クイック量指定ボタン（もしあれば）
    document.querySelectorAll('.btn-quick-amount').forEach(btn => {
        btn.addEventListener('click', function() {
            const el = document.getElementById('custom-amount');
            if(el) el.value = this.dataset.amount;
        });
    });

    // ---------------------------------------------------------
    // 8. ユーティリティ (Swipe, Export, Theme)
    // ---------------------------------------------------------
    // スワイプ
    const swipeArea = document.getElementById('app-content') || document.body;
    if (swipeArea) {
        swipeArea.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, {passive: true});
        swipeArea.addEventListener('touchend', handleTouchEnd);
    }

    // テーマ変更検知
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if ((localStorage.getItem(APP.STORAGE_KEYS.THEME) || 'system') === 'system') {
            UI.applyTheme('system');
            refreshUI();
        }
    });

    // データエクスポート・インポート
    document.getElementById('btn-export-logs')?.addEventListener('click', () => DataManager.exportCSV('logs'));
    document.getElementById('btn-export-checks')?.addEventListener('click', () => DataManager.exportCSV('checks'));
    document.getElementById('btn-copy-data')?.addEventListener('click', DataManager.copyToClipboard);
    document.getElementById('btn-download-json')?.addEventListener('click', DataManager.exportJSON);
    document.getElementById('btn-import-json')?.addEventListener('change', function() { DataManager.importJSON(this); });
    
    // 初期化ボタン
    document.getElementById('btn-reset-all')?.addEventListener('click', async () => {
        if(confirm('本当に全てのデータを削除して初期化しますか？\nこの操作は取り消せません。')) {
            if(confirm('これまでの記録が全て消えます。よろしいですか？')) {
                await db.logs.clear(); await db.checks.clear();
                Object.values(APP.STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
                alert('初期化しました。'); location.reload();
            }
        }
    });
    
    // シェアボタン (もしHTMLにあれば)
    document.getElementById('btn-share-sns')?.addEventListener('click', handleShare);
}

/**
 * Main Bootstrap
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[App] Initializing v4 Craft & Flow...');

    // 1. 初期化: DOMとデータハンドラの接続
    UI.initDOM();
    UI.setFetchLogsHandler(Service.getLogsWithPagination);
    UI.setFetchAllDataHandler(Service.getAllDataForUI);
    
    // タイマー完了時の保存ハンドラ注入
    setTimerSaveHandler(async (type, minutes) => {
        // Timerから呼び出される保存処理
        await Service.saveExerciseLog(type, minutes, UI.getTodayString(), true, null);
    });

    // 2. データ準備: 移行と整合性チェック
    await migrateData();
    await Service.ensureTodayCheckRecord();

    // 3. イベント開始
    bindEvents();
    setupLifecycleListeners();

    // 4. UI構築: 初期設定と描画
    populateSelects();
    UI.applyTheme(localStorage.getItem(APP.STORAGE_KEYS.THEME) || APP.DEFAULTS.THEME);
    
    const p = Store.getProfile();
    ['weight-input', 'height-input', 'age-input'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = p[id.split('-')[0]];
    });
    const gEl = document.getElementById('gender-input');
    if(gEl) gEl.value = p.gender;

    // v4 Home Mode Selector
    UI.updateModeSelector();
    UI.setBeerMode('mode1');
    updateBeerSelectOptions();

    // 5. 状態復元と最終レンダリング
    if (Timer.restoreState()) {
        // タイマー動作中なら記録モーダルを自動オープン
        UI.openManualInput(); 
    } else {
        // 通常起動
        UI.switchTab('home');
        
        // 初回ユーザーへのガイド
        if (!localStorage.getItem(APP.STORAGE_KEYS.WEIGHT)) {
            setTimeout(() => {
                UI.openSettings();
                UI.showMessage('👋 ようこそ！まずはプロフィールを設定しましょう！', 'success');
            }, 800);
        } else {
            // スワイプガイドの表示
            const KEY = 'nomutore_seen_swipe_hint';
            if (!localStorage.getItem(KEY)) {
                setTimeout(() => showSwipeCoachMark(), 1000);
            }
        }
    }
    
    await refreshUI();
    console.log('[App] Ready.');
});

// ヘルパー: セレクトボックスの選択肢生成
function populateSelects() {
    const createOpts = (obj, targetId, useKeyAsVal = false) => {
        const el = document.getElementById(targetId);
        if(!el) return;
        el.innerHTML = '';
        Object.keys(obj).forEach(k => {
            const o = document.createElement('option');
            o.value = k;
            o.textContent = useKeyAsVal
                ? k
                : (obj[k].label 
                    ? (obj[k].icon ? `${obj[k].icon} ${obj[k].label}` : obj[k].label)
                    : obj[k].label);
            el.appendChild(o);
        });
    };

    createOpts(EXERCISE, 'exercise-select');
    createOpts(EXERCISE, 'setting-base-exercise');
    createOpts(EXERCISE, 'setting-default-record-exercise');
    createOpts(CALORIES.STYLES, 'setting-mode-1', true);
    createOpts(CALORIES.STYLES, 'setting-mode-2', true);
    createOpts(SIZE_DATA, 'beer-size');
    
    const defRec = Store.getDefaultRecordExercise();
    const exSel = document.getElementById('exercise-select');
    if(exSel && defRec) exSel.value = defRec;
    
    const bSize = document.getElementById('beer-size');
    if(bSize) bSize.value = '350';
}

// ヘルパー: スワイプコーチマーク表示
const showSwipeCoachMark = () => {
    const KEY = 'nomutore_seen_swipe_hint';
    if (localStorage.getItem(KEY)) return;
    const el = document.getElementById('swipe-coach-mark');
    if (!el) return;
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.remove('opacity-0'));
    
    // 数秒後に自動消去
    setTimeout(() => {
        el.classList.add('opacity-0');
        setTimeout(() => {
            el.classList.add('hidden');
            localStorage.setItem(KEY, 'true');
        }, 500);
    }, 3500);
};

// PWA ServiceWorker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}