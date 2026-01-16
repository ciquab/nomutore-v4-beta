import { EXERCISE, CALORIES, SIZE_DATA, STYLE_METADATA, APP, CHECK_SCHEMA } from '../constants.js';
import { Calc } from '../logic.js';
import { Store, db } from '../store.js';
import { StateManager } from './state.js';
import { DOM, toggleModal, escapeHtml, toggleDryDay, showMessage } from './dom.js';
import { Service } from '../service.js';
import { refreshUI } from './index.js';
import { Timer } from './timer.js'; // Timer追加
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// UI.getTodayString() の代わり
const getTodayString = () => dayjs().format('YYYY-MM-DD');

export const getBeerFormData = () => {
    const dateVal = document.getElementById('beer-date').value;
    const brewery = document.getElementById('beer-brewery').value;
    const brand = document.getElementById('beer-brand').value;
    const rating = parseInt(document.getElementById('beer-rating').value) || 0;
    const memo = document.getElementById('beer-memo').value;
    
    // v4: Untappdチェックボックスの状態を取得
    const untappdCheck = document.getElementById('untappd-check');
    const useUntappd = untappdCheck ? untappdCheck.checked : false;

    const ts = dateVal ? dayjs(dateVal).startOf('day').add(12, 'hour').valueOf() : Date.now(); 

    const isCustom = !document.getElementById('beer-input-custom').classList.contains('hidden');
    
    const styleSel = document.getElementById('beer-select');
    const style = styleSel.options[styleSel.selectedIndex]?.value || '国産ピルスナー';
    
    const sizeSel = document.getElementById('beer-size');
    const size = sizeSel.options[sizeSel.selectedIndex]?.value || '350';
    
    const count = parseInt(document.getElementById('beer-count').value) || 1;

    // Custom data
    const customAbv = parseFloat(document.getElementById('custom-abv').value) || 5.0;
    const customMl = parseInt(document.getElementById('custom-amount').value) || 350;
    const customType = 'brew'; // Default

    return {
        timestamp: ts,
        brewery, brand, rating, memo,
        style, size, count,
        isCustom,
        abv: customAbv,
        ml: customMl,
        type: customType,
        useUntappd
    };
};

export const resetBeerForm = () => {
    document.getElementById('beer-date').value = getTodayString();
    document.getElementById('beer-count').value = 1;
    document.getElementById('beer-brewery').value = '';
    document.getElementById('beer-brand').value = '';
    document.getElementById('beer-rating').value = '';
    document.getElementById('beer-memo').value = '';
    
    const untappdCheck = document.getElementById('untappd-check');
    if(untappdCheck) untappdCheck.checked = false;
};

// Untappd検索の実行
export const searchUntappd = () => {
    const brewery = document.getElementById('beer-brewery').value;
    const brand = document.getElementById('beer-brand').value;
    
    if (!brand) {
        alert('Please enter a Beer Name to search.');
        return;
    }
    
    const query = encodeURIComponent(`${brewery} ${brand}`.trim());
    const url = `https://untappd.com/search?q=${query}`;
    window.open(url, '_blank');
};

export const openBeerModal = (e, dateStr = null) => {
    resetBeerForm();
    if (dateStr) {
        document.getElementById('beer-date').value = dateStr;
    }
    // セレクトボックスが空なら初期化 (復元)
    updateBeerSelectOptions();
    toggleModal('beer-modal', true);
};

export const switchBeerInputTab = (mode) => {
    const preset = document.getElementById('beer-input-preset');
    const custom = document.getElementById('beer-input-custom');
    const btnPreset = document.getElementById('tab-beer-preset');
    const btnCustom = document.getElementById('tab-beer-custom');

    if (mode === 'preset') {
        preset.classList.remove('hidden');
        custom.classList.add('hidden');
        btnPreset.className = 'flex-1 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white shadow-sm transition';
        btnCustom.className = 'flex-1 py-2 text-xs font-bold rounded-xl text-gray-500 hover:bg-base-200 dark:hover:bg-base-800 transition';
    } else {
        preset.classList.add('hidden');
        custom.classList.remove('hidden');
        btnPreset.className = 'flex-1 py-2 text-xs font-bold rounded-xl text-gray-500 hover:bg-base-200 dark:hover:bg-base-800 transition';
        btnCustom.className = 'flex-1 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white shadow-sm transition';
    }
};

/**
 * 【改修】デイリーチェックモーダルを開く
 * - 動的チェック項目の生成
 */
export const openCheckModal = () => {
    document.getElementById('check-date').value = getTodayString();
    
    const container = document.getElementById('check-items-container');
    // コンテナがない場合（HTML更新漏れ等）のエラー回避
    if (!container) {
        console.warn('#check-items-container not found. Check index.html');
        // フォールバック: 既存の静的HTMLがあればそれを使う（エラーにしない）
        toggleModal('check-modal', true);
        return;
    }

    container.innerHTML = '';
    
    CHECK_SCHEMA.forEach(item => {
        // ラベル要素作成
        const label = document.createElement('label');
        // クラス定義: drinking_only の項目には識別クラスをつける
        // hidden-check ではなく Tailwind標準の hidden を使用して安全性を高める
        const visibilityClass = item.drinking_only ? 'drinking-only hidden' : '';
        
        label.className = `check-item p-3 border rounded-xl flex flex-col items-center gap-2 cursor-pointer hover:bg-base-50 dark:hover:bg-base-800 transition ${visibilityClass}`;
        label.innerHTML = `
            <span class="text-2xl">${item.icon}</span>
            <span class="text-xs font-bold">${item.label}</span>
            <input type="checkbox" id="check-${item.id}" class="accent-indigo-600">
        `;
        container.appendChild(label);
    });
    
    // 休肝日トグルとの連動初期化
    const isDryCheck = document.getElementById('check-is-dry');
    if (isDryCheck) {
        // Reset state
        isDryCheck.checked = false;
        toggleDryDay(false); // dom.js function
        
        // Re-bind to update dynamic items visibility
        isDryCheck.onchange = (e) => {
            const isDry = e.target.checked;
            toggleDryDay(isDry);
            
            // Custom Logic: Show/Hide items with drinking_only: true
            const items = document.querySelectorAll('.drinking-only');
            items.forEach(el => {
                if (isDry) { // Is Dry Day -> Hide drinking items (add hidden)
                    el.classList.add('hidden');
                } else { // Drank -> Show drinking items (remove hidden)
                    el.classList.remove('hidden');
                }
            });
        };
        // 初期状態の反映 (未チェック=飲んだ=表示)
        isDryCheck.dispatchEvent(new Event('change'));
    }

    toggleModal('check-modal', true);
};

export const openManualInput = () => {
    document.getElementById('manual-date').value = getTodayString();
    toggleModal('exercise-modal', true);
};

// タイマー機能
export const openTimer = () => {
    Timer.init();
    toggleModal('timer-modal', true);
};

export const closeTimer = () => {
    // 実行中なら確認
    const acc = localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);
    const start = localStorage.getItem(APP.STORAGE_KEYS.TIMER_START);
    
    if (start || (acc && parseInt(acc) > 0)) {
        if (!confirm('タイマーをバックグラウンドで実行したまま閉じますか？\n(計測は止まりません)')) {
            return;
        }
    }
    toggleModal('timer-modal', false);
};

// 設定保存時に期間モード変更を処理
export const openSettings = () => {
    const currentMode = localStorage.getItem(APP.STORAGE_KEYS.PERIOD_MODE) || 'weekly';
    const periodSel = document.getElementById('setting-period-mode');
    if (periodSel) periodSel.value = currentMode;
    toggleModal('settings-modal', true);
};

// 設定保存ロジック
export const handleSaveSettings = async () => {
    const btn = document.getElementById('btn-save-settings');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const periodSel = document.getElementById('setting-period-mode');
        const newMode = periodSel ? periodSel.value : 'weekly';
        await Service.updatePeriodSettings(newMode);

        const w = document.getElementById('weight-input').value;
        const h = document.getElementById('height-input').value;
        const a = document.getElementById('age-input').value;
        const g = document.getElementById('gender-input').value;
        
        if(w) localStorage.setItem(APP.STORAGE_KEYS.WEIGHT, w);
        if(h) localStorage.setItem(APP.STORAGE_KEYS.HEIGHT, h);
        if(a) localStorage.setItem(APP.STORAGE_KEYS.AGE, a);
        if(g) localStorage.setItem(APP.STORAGE_KEYS.GENDER, g);

        const m1 = document.getElementById('setting-mode-1').value;
        const m2 = document.getElementById('setting-mode-2').value;
        const base = document.getElementById('setting-base-exercise').value;
        const defRec = document.getElementById('setting-default-record-exercise').value;

        localStorage.setItem(APP.STORAGE_KEYS.MODE1, m1);
        localStorage.setItem(APP.STORAGE_KEYS.MODE2, m2);
        localStorage.setItem(APP.STORAGE_KEYS.BASE_EXERCISE, base);
        localStorage.setItem(APP.STORAGE_KEYS.DEFAULT_RECORD_EXERCISE, defRec);
        
        // テーマ変更検知 (即時反映のため)
        const theme = document.getElementById('theme-input').value;
        localStorage.setItem(APP.STORAGE_KEYS.THEME, theme);

        showMessage('設定を保存しました', 'success');
        toggleModal('settings-modal', false);
        
        await refreshUI();

    } catch(e) {
        console.error(e);
        showMessage('設定保存中にエラーが発生しました', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
};

export const openHelp = () => toggleModal('help-modal', true);

// 簡易詳細表示
export const openLogDetail = async (id) => {
    try {
        const log = await db.logs.get(id);
        if (!log) return;

        const msg = `
【ログ詳細】
日時: ${dayjs(log.timestamp).format('YYYY/MM/DD HH:mm')}
品目: ${log.name}
サイズ: ${log.size || '-'}
Kcal: ${Math.round(log.kcal)}
メモ: ${log.memo || 'なし'}
        `.trim();
        alert(msg);
    } catch(e) {
        console.error(e);
    }
};

export const updateModeSelector = () => { /* main.jsで処理するため空でOK */ };

// 【重要】復元されたセレクトボックス生成ロジック (これを省略してはいけません)
export const updateBeerSelectOptions = () => {
    const styleSel = document.getElementById('beer-select');
    const sizeSel = document.getElementById('beer-size');
    
    // スタイル選択肢
    if (styleSel && styleSel.children.length === 0) {
        const source = (typeof STYLE_METADATA !== 'undefined') ? STYLE_METADATA : CALORIES.STYLES;
        const styles = Object.keys(source || {});
        
        styles.forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = key;
            styleSel.appendChild(opt);
        });
    }

    // サイズ選択肢
    if (sizeSel && sizeSel.children.length === 0) {
        Object.entries(SIZE_DATA).forEach(([key, val]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = val.label;
            sizeSel.appendChild(opt);
        });
        sizeSel.value = '350'; 
    }
};

export const updateInputSuggestions = () => { /* Untappd優先のため無効化 */ };
export const renderQuickButtons = () => { /* UI競合のため無効化 */ };

export const closeModal = (id) => toggleModal(id, false);
export const adjustBeerCount = (delta) => {
    const el = document.getElementById('beer-count');
    let v = parseInt(el.value) || 1;
    v = Math.max(1, v + delta);
    el.value = v;
};