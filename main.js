import { APP, EXERCISE, SIZE_DATA, CALORIES } from './constants.js';
import { Store, ExternalApp, db } from './store.js'; 
import { Calc } from './logic.js';
import { UI, StateManager, updateBeerSelectOptions, refreshUI, toggleModal } from './ui/index.js';
import { Service } from './service.js';
// import { Timer, setTimerSaveHandler } from './timer.js'; // TimerはPhase 3で再実装
import { DataManager } from './dataManager.js';
import { initErrorHandler } from './errorHandler.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

/* ==========================================================================
   Initialization & Global State
   ========================================================================== */

initErrorHandler();

let editingLogId = null;
let editingCheckId = null;

const LAST_ACTIVE_KEY = 'nomutore_last_active_date';
let lastActiveDate = localStorage.getItem(LAST_ACTIVE_KEY) || dayjs().format('YYYY-MM-DD');

/* ==========================================================================
   Expose Functions to Window (for HTML onclick compatibility)
   ========================================================================== */
// index.html の onclick 属性から呼ばれる関数を公開
window.switchTab = UI.switchTab;
window.openMenu = () => toggleModal('record-menu', true);
window.closeMenu = () => toggleModal('record-menu', false);
window.openSettings = UI.openSettings;
window.closeSettings = () => toggleModal('settings-modal', false);
window.setTheme = (mode) => {
    // UI反映
    UI.applyTheme(mode);
    // 保存は[Done]ボタン押下時だが、即時反映のため仮設定
    // (本格的な保存は handleSaveSettings で行う)
};
window.openLogModal = (type) => {
    editingLogId = null; // 新規作成
    window.closeMenu();
    if (type === 'beer') UI.openBeerModal(null);
    else if (type === 'exercise') UI.openManualInput();
};

/* ==========================================================================
   Lifecycle Management
   ========================================================================== */

let isResuming = false;

const setupLifecycleListeners = () => {
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            await handleAppResume();
        }
    });

    setInterval(() => {
        const current = dayjs().format('YYYY-MM-DD');
        if (current !== lastActiveDate) {
            handleAppResume();
        }
    }, 60000);
};

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
            await Service.ensureTodayCheckRecord();
            await Service.checkPeriodRollover(); // v4: 期間ロールオーバーチェック
        }

        await refreshUI();
        
    } finally {
        isResuming = false;
    }
};

/* ==========================================================================
   Event Handlers (UI -> Service/Logic)
   ========================================================================== */

const handleSaveSettings = async () => {
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : null;
    };
    
    // settings-modal内のDOM IDがv4で変更されているか確認が必要だが、
    // dom.jsのIDリストを見る限り既存ID (weight-input等) を維持している想定。
    const w = parseFloat(getVal('weight-input'));
    const h = parseFloat(getVal('height-input'));
    const a = parseInt(getVal('age-input'));
    
    // v4設定画面の入力検証は簡易的に
    if (w > 0) { // 最低限体重があればOK
        const keys = APP.STORAGE_KEYS;
        localStorage.setItem(keys.WEIGHT, w);
        if(h) localStorage.setItem(keys.HEIGHT, h);
        if(a) localStorage.setItem(keys.AGE, a);
        localStorage.setItem(keys.GENDER, getVal('gender-input') || 'female');
        
        // v4 Theme Logic (DOMのクラスから現在のテーマを判定して保存)
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem(keys.THEME, isDark ? 'dark' : 'light');

        toggleModal('settings-modal', false);
        
        UI.updateModeSelector();
        updateBeerSelectOptions();
        await refreshUI();
        UI.showMessage('Settings saved', 'success');
    } else {
        UI.showMessage('Please check your input', 'error');
    }
};

const handleBeerSubmit = async (e) => {
    e.preventDefault();
    const inputData = UI.getBeerFormData();
    
    if (!inputData.isValid) {
        return UI.showMessage('入力値を確認してください', 'error');
    }

    await Service.saveBeerLog(inputData, editingLogId);

    editingLogId = null;
    toggleModal('beer-modal', false);
    UI.resetBeerForm();
    await refreshUI();

    if (inputData.useUntappd) {
        let term = inputData.brand;
        if (inputData.brewery) term = `${inputData.brewery} ${inputData.brand}`;
        if (!term) term = inputData.style;
        ExternalApp.searchUntappd(term);
    }
};

const handleSaveAndNext = async () => {
    const inputData = UI.getBeerFormData();
    if (!inputData.isValid) {
        return UI.showMessage('入力値を確認してください', 'error');
    }
    await Service.saveBeerLog(inputData, null);
    UI.resetBeerForm(true); 
    await refreshUI();
};

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
    await refreshUI();
};

const handleCheckSubmit = async (e) => {
    e.preventDefault();
    const f = document.getElementById('check-form');
    const w = document.getElementById('check-weight').value;
    
    let weightVal = null;
    if (w !== '') {
        weightVal = parseFloat(w);
        if (weightVal <= 0) return UI.showMessage('体重は正の数で入力してください', 'error');
    }

    // Modal側で実装された getCheckFormData を使うのが理想だが、
    // ここでは簡易的にDOMから直接取得 (v3互換)
    // 実際には ui/modal.js の getCheckFormData を使うようリファクタリングが推奨される
    // 今回は既存コードを維持しつつ、v4のカスタムフィールド対応はService層に委ねる
    
    // ※注意: Phase 3.4で ui/modal.js に getCheckFormData が追加されたのでそれを使う
    // しかし main.js では import されていないため、今回は従来通り手動収集しつつ
    // UI.getCheckFormData があればそちらを使う形にする（未実装なら下記）

    const formData = {
        date: document.getElementById('check-date').value,
        isDryDay: document.getElementById('is-dry-day').checked,
        waistEase: f.elements['waistEase'] ? f.elements['waistEase'].checked : false,
        footLightness: f.elements['footLightness'] ? f.elements['footLightness'].checked : false,
        waterOk: f.elements['waterOk'] ? f.elements['waterOk'].checked : false,
        fiberOk: f.elements['fiberOk'] ? f.elements['fiberOk'].checked : false,
        weight: weightVal
    };
    
    // v4: カスタムフィールドの収集 (動的生成された要素)
    const schema = Store.getCheckSchema();
    if (schema) {
        formData.custom = {};
        schema.forEach(item => {
            const el = document.getElementById(`check-item-${item.id}`);
            if (el) formData.custom[item.id] = el.checked;
        });
    }

    await Service.saveDailyCheck(formData, editingCheckId);

    toggleModal('check-modal', false);
    document.getElementById('is-dry-day').checked = false;
    document.getElementById('check-weight').value = '';
    editingCheckId = null;
    await refreshUI();
};

// ----------------------------------------------------------------------
// Data Migration (Startup only)
// ----------------------------------------------------------------------

/**
 * v4: チェック項目スキーマの初期化
 * v3ユーザーや新規ユーザーのために、デフォルトのスキーマ定義を作成する
 */
const migrateChecks = () => {
    const key = APP.STORAGE_KEYS.CHECK_SCHEMA;
    // 既に設定があれば何もしない
    if (localStorage.getItem(key)) return;

    console.log('[Migration] Initializing default check schema for v4...');
    
    const defaultSchema = [
        { id: 'waistEase', label: 'ウエストに余裕あり', icon: '👖', condition: 'always', isSystem: true, default: false },
        { id: 'footLightness', label: '足が軽い・むくみなし', icon: '🦶', condition: 'always', isSystem: true, default: false },
        { id: 'fiberOk', label: '飲酒前の食物繊維', icon: '🥗', condition: 'drinking_only', isSystem: true, default: false },
        { id: 'waterOk', label: '飲酒中/後の水分補給', icon: '💧', condition: 'drinking_only', isSystem: true, default: false }
    ];
    
    localStorage.setItem(key, JSON.stringify(defaultSchema));
};

/**
 * データ移行と設定の初期化
 */
async function migrateData() {
    console.log('[Migration] Checking data integrity...');
    
    // 1. Check Schema Initialization
    migrateChecks();

    // 2. Settings Initialization (v4 New Keys)
    const defaults = {
        [APP.STORAGE_KEYS.PERIOD_MODE]: APP.DEFAULTS.PERIOD_MODE,
        [APP.STORAGE_KEYS.ORB_STYLE]: APP.DEFAULTS.ORB_STYLE,
        [APP.STORAGE_KEYS.UNIT_MODE]: APP.DEFAULTS.UNIT_MODE,
        [APP.STORAGE_KEYS.THEME]: APP.DEFAULTS.THEME,
        [APP.STORAGE_KEYS.BASE_EXERCISE]: APP.DEFAULTS.BASE_EXERCISE
    };

    let updated = false;
    Object.entries(defaults).forEach(([key, val]) => {
        if (localStorage.getItem(key) === null) {
            console.log(`[Migration] Setting default for ${key}:`, val);
            localStorage.setItem(key, val);
            updated = true;
        }
    });

    // 3. Period Start Initialization
    // まだ期間開始日がなければ、今日を開始日とする（Service.checkPeriodRolloverで処理されるが念のため）
    /*
    if (!localStorage.getItem(APP.STORAGE_KEYS.PERIOD_START)) {
        const now = dayjs().startOf('day').valueOf();
        localStorage.setItem(APP.STORAGE_KEYS.PERIOD_START, now);
        console.log('[Migration] Set initial period start to today.');
    }
    */
   
    if (updated) {
        console.log('[Migration] Settings initialized.');
    }
}

/* ==========================================================================
   Event Binding & Bootstrap
   ========================================================================== */

function bindEvents() {
    // --- Navigation (v4 New IDs) ---
    document.getElementById('nav-home')?.addEventListener('click', () => UI.switchTab('home'));
    document.getElementById('nav-cellar')?.addEventListener('click', () => UI.switchTab('cellar'));
    
    // FABはHTMLのonclick="openMenu()"で動作するが、JSからも制御できるようにする
    // Action Button (Center FAB) is triggered by onclick in HTML

    // --- Modals ---
    document.getElementById('beer-form')?.addEventListener('submit', handleBeerSubmit);
    document.getElementById('btn-save-next')?.addEventListener('click', (e) => { e.preventDefault(); handleSaveAndNext(); });
    document.getElementById('check-form')?.addEventListener('submit', handleCheckSubmit);
    document.getElementById('btn-submit-manual')?.addEventListener('click', handleManualExerciseSubmit);
    document.getElementById('btn-save-settings')?.addEventListener('click', handleSaveSettings);
    
    document.getElementById('is-dry-day')?.addEventListener('change', function() { UI.toggleDryDay(this); });

    // --- Data Management ---
    document.getElementById('btn-export-logs')?.addEventListener('click', () => DataManager.exportCSV('logs'));
    document.getElementById('btn-export-checks')?.addEventListener('click', () => DataManager.exportCSV('checks'));
    document.getElementById('btn-copy-data')?.addEventListener('click', DataManager.copyToClipboard);
    document.getElementById('btn-download-json')?.addEventListener('click', DataManager.exportJSON);
    document.getElementById('btn-import-json')?.addEventListener('change', function() { DataManager.importJSON(this); });
    
    document.getElementById('btn-reset-all')?.addEventListener('click', async () => {
        if(confirm('Warning: All data will be deleted. This cannot be undone.')) {
            await db.logs.clear(); await db.checks.clear(); await db.period_archives.clear();
            Object.values(APP.STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
            alert('Reset complete. Reloading...'); 
            location.reload();
        }
    });

    // --- List Interaction ---
    const logList = document.getElementById('log-list');
    logList?.addEventListener('click', async (e) => {
        // v4: リストアイテムクリック時の挙動
        const row = e.target.closest('.log-item-row'); // v3クラス名仮定、後でlogList.jsで修正が必要かも
        if (row) {
            const log = await db.logs.get(parseInt(row.dataset.id));
            if(log) UI.openLogDetail(log);
        }
    });

    // Detail Modal Actions
    document.getElementById('btn-detail-delete')?.addEventListener('click', async () => {
        const id = document.getElementById('log-detail-modal').dataset.id;
        if (id) {
            await Service.deleteLog(id);
            toggleModal('log-detail-modal', false);
            editingLogId = null;
            await refreshUI();
        }
    });

    document.getElementById('btn-detail-edit')?.addEventListener('click', async () => {
        const id = parseInt(document.getElementById('log-detail-modal').dataset.id);
        const log = await db.logs.get(id);
        if (log) {
            editingLogId = id;
            toggleModal('log-detail-modal', false);
            const isDebt = (log.type === 'beer');
            isDebt ? UI.openBeerModal(log) : UI.openManualInput(log);
        }
    });

    // --- Others ---
    document.getElementById('beer-select')?.addEventListener('change', updateBeerSelectOptions);
    
    // v4 Input Tabs
    document.getElementById('tab-beer-preset')?.addEventListener('click', () => UI.switchBeerInputTab('preset'));
    document.getElementById('tab-beer-custom')?.addEventListener('click', () => UI.switchBeerInputTab('custom'));
}

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
    // createOpts(CALORIES.STYLES, 'setting-mode-1', true); // v4設定画面にこれらがあるかDOM確認要だが一旦維持
    // createOpts(CALORIES.STYLES, 'setting-mode-2', true);
    createOpts(SIZE_DATA, 'beer-size');
    
    const defRec = Store.getDefaultRecordExercise();
    const exSel = document.getElementById('exercise-select');
    if(exSel && defRec) exSel.value = defRec;
    
    const bSize = document.getElementById('beer-size');
    if(bSize) bSize.value = '350';
}

/**
 * Main Bootstrap
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Init
    UI.initDOM();
    UI.setFetchLogsHandler(Service.getLogsWithPagination);
    UI.setFetchAllDataHandler(Service.getAllDataForUI);
    // TimerはPhase 3で対応

    // 2. Data Migration & Init
    await migrateData(); // 【追加】移行処理
    await Service.ensureTodayCheckRecord();

    // 3. Events
    bindEvents();
    setupLifecycleListeners();

    // 4. UI Init
    populateSelects();
    UI.applyTheme(localStorage.getItem(APP.STORAGE_KEYS.THEME) || APP.DEFAULTS.THEME);
    
    // Profile Init
    const p = Store.getProfile();
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    setVal('weight-input', p.weight);
    setVal('height-input', p.height);
    setVal('age-input', p.age);
    setVal('gender-input', p.gender);
    
    // Settings Profile Display (v4 Mock element)
    const profileDisplay = document.getElementById('settings-profile-val');
    if (profileDisplay) {
        profileDisplay.textContent = `${p.height}cm / ${p.weight}kg`;
    }

    UI.updateModeSelector();
    UI.setBeerMode('mode1'); 
    updateBeerSelectOptions();

    // 5. Initial Render
    UI.switchTab('home'); // v4 default
    
    // 期間ロールオーバーチェック (移行処理の後で実行)
    await Service.checkPeriodRollover(); 
    
    await refreshUI();
    
    localStorage.setItem(LAST_ACTIVE_KEY, dayjs().format('YYYY-MM-DD'));
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}