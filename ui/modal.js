import { EXERCISE, CALORIES, SIZE_DATA, STYLE_METADATA, APP, CHECK_SCHEMA } from '../constants.js';
import { Calc } from '../logic.js';
import { Store, db } from '../store.js';
import { StateManager } from './state.js';
import { DOM, toggleModal, escapeHtml, toggleDryDay, showMessage } from './dom.js';
import { Service } from '../service.js';
import { Timer } from './timer.js'; 
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

const getTodayString = () => dayjs().format('YYYY-MM-DD');

/* --- Action Menu (New) --- */
// ★追加: 統合メニューを開く関数
// dateStrがあれば、その日付で記録を開始する
export const openActionMenu = (dateStr = null) => {
    // 隠しフィールドに日付を一時保存（メニュー内のボタンがこれを使う）
    const targetDate = dateStr || getTodayString();
    StateManager.setSelectedDate(targetDate); // StateManagerに保存推奨だが、今回は属性で簡易対応
    
    // UI上の日付表示（メニューに「202X-XX-XX の記録」と出すため）
    const label = document.getElementById('action-menu-date-label');
    if(label) label.textContent = dayjs(targetDate).format('MM/DD (ddd)');
    
    // ボタンのonclick属性を動的に書き換えるのではなく、開く各モーダル側で StateManager.selectedDate を見るか、
    // あるいは単純にここで dateStr を渡すクロージャを作るのが理想だが、
    // 既存のHTML onclick="UI.openBeerModal()" との兼ね合いがあるため、
    // 今回は「各open関数が引数 dateStr を受け取る」形に統一する。
    
    // HTML側の onclick="UI.openBeerModal(null, 'YYYY-MM-DD')" のように動的にセットするのは難しいので、
    // 「メニューを開くときに、そのメニュー内のボタンが押されたらどうするか」を制御する。
    
    // 最もシンプルな実装: グローバル変数(StateManager)に日付をセットし、各Modalが開くときにそれを参照する。
    // StateManager.tempDate = targetDate; // ui/state.js に tempDate を追加する必要があるが、
    // ここでは DOM要素 (hidden input) を使うのが安全。
    
    const hiddenDate = document.getElementById('action-menu-target-date');
    if(hiddenDate) hiddenDate.value = targetDate;

    toggleModal('action-menu-modal', true);
};

// メニューから呼ばれるラッパー関数
export const handleActionSelect = (type) => {
    const hiddenDate = document.getElementById('action-menu-target-date');
    const dateStr = hiddenDate ? hiddenDate.value : getTodayString();
    
    toggleModal('action-menu-modal', false);

    if (type === 'beer') {
        openBeerModal(null, dateStr);
    } else if (type === 'exercise') {
        openManualInput(dateStr);
    } else if (type === 'check') {
        openCheckModal(dateStr);
    }
};

/* --- Existing Modals (Updated) --- */

export const getBeerFormData = () => {
    const dateVal = document.getElementById('beer-date').value;
    const brewery = document.getElementById('beer-brewery').value;
    const brand = document.getElementById('beer-brand').value;
    const rating = parseInt(document.getElementById('beer-rating').value) || 0;
    const memo = document.getElementById('beer-memo').value;
    
    const untappdCheck = document.getElementById('untappd-check');
    const useUntappd = untappdCheck ? untappdCheck.checked : false;

    const ts = dateVal ? dayjs(dateVal).startOf('day').add(12, 'hour').valueOf() : Date.now(); 

    const isCustom = !document.getElementById('beer-input-custom').classList.contains('hidden');
    
    const styleSel = document.getElementById('beer-select');
    const style = styleSel.options[styleSel.selectedIndex]?.value || '国産ピルスナー';
    
    const sizeSel = document.getElementById('beer-size');
    const size = sizeSel.options[sizeSel.selectedIndex]?.value || '350';
    
    const count = parseInt(document.getElementById('beer-count').value) || 1;

    const customAbv = parseFloat(document.getElementById('custom-abv').value) || 5.0;
    const customMl = parseInt(document.getElementById('custom-amount').value) || 350;
    const customType = 'brew'; 

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
    // ★修正: 引数で日付が渡されたらそれをセット
    if (dateStr) {
        document.getElementById('beer-date').value = dateStr;
    }
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

// ★修正: dateStrを受け取れるように変更
export const openCheckModal = (dateStr = null) => {
    const targetDate = dateStr || getTodayString();
    document.getElementById('check-date').value = targetDate;
    
    const container = document.getElementById('check-items-container');
    if (!container) {
        toggleModal('check-modal', true);
        return;
    }

    container.innerHTML = '';
    
    let currentSchema = CHECK_SCHEMA;
    try {
        const stored = localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA);
        if (stored) currentSchema = JSON.parse(stored);
    } catch(e) { console.error(e); }

    currentSchema.forEach(item => {
        const label = document.createElement('label');
        const visibilityClass = item.drinking_only ? 'drinking-only hidden' : '';
        
        label.className = `check-item p-3 border rounded-xl flex flex-col items-center gap-2 cursor-pointer hover:bg-base-50 dark:hover:bg-base-800 transition ${visibilityClass}`;
        label.innerHTML = `
            <span class="text-2xl">${item.icon}</span>
            <span class="text-xs font-bold">${item.label}</span>
            <input type="checkbox" id="check-${item.id}" class="accent-indigo-600">
        `;
        container.appendChild(label);
    });
    
    const isDryCheck = document.getElementById('check-is-dry');
    if (isDryCheck) {
        isDryCheck.checked = false;
        
        isDryCheck.onchange = (e) => {
            const isDry = e.target.checked;
            const items = document.querySelectorAll('.drinking-only');
            items.forEach(el => {
                if (isDry) { 
                    el.classList.add('hidden');
                } else { 
                    el.classList.remove('hidden');
                }
            });
        };
        isDryCheck.dispatchEvent(new Event('change'));
    }

    toggleModal('check-modal', true);
};

// ★修正: dateStrを受け取れるように変更
export const openManualInput = (dateStr = null) => {
    const targetDate = dateStr || getTodayString();
    document.getElementById('manual-date').value = targetDate;
    toggleModal('exercise-modal', true);
};

export const openTimer = () => {
    Timer.init();
    toggleModal('timer-modal', true);
};

export const closeTimer = () => {
    const acc = localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);
    const start = localStorage.getItem(APP.STORAGE_KEYS.TIMER_START);
    if (start || (acc && parseInt(acc) > 0)) {
        if (!confirm('タイマーをバックグラウンドで実行したまま閉じますか？\n(計測は止まりません)')) {
            return;
        }
    }
    toggleModal('timer-modal', false);
};

export const renderSettings = () => {
    const currentMode = localStorage.getItem(APP.STORAGE_KEYS.PERIOD_MODE) || 'weekly';
    const periodSel = document.getElementById('setting-period-mode');
    if (periodSel) periodSel.value = currentMode;
    renderCheckEditor();
};

const renderCheckEditor = () => {
    const container = document.getElementById('check-editor-list');
    if (!container) return; 

    container.innerHTML = '';
    
    let schema = CHECK_SCHEMA;
    try {
        const stored = localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA);
        if (stored) schema = JSON.parse(stored);
    } catch(e) {}

    schema.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = "flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl mb-2";
        
        const isSystem = ['waistEase', 'footLightness', 'waterOk', 'fiberOk'].includes(item.id);
        const deleteBtn = isSystem 
            ? `<span class="text-gray-300 text-xs"><i class="ph-fill ph-lock-key"></i></span>`
            : `<button onclick="deleteCheckItem(${index})" class="text-red-500 hover:bg-red-100 p-1 rounded"><i class="ph-bold ph-trash"></i></button>`;

        div.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-xl">${item.icon}</span>
                <div>
                    <p class="text-xs font-bold text-gray-800 dark:text-gray-200">${item.label}</p>
                    <p class="text-[10px] text-gray-400">${item.desc || ''} ${item.drinking_only ? '<span class="text-orange-500">(Drink Only)</span>' : ''}</p>
                </div>
            </div>
            ${deleteBtn}
        `;
        container.appendChild(div);
    });
};

window.deleteCheckItem = (index) => {
    if(!confirm('この項目を削除しますか？')) return;
    let schema = CHECK_SCHEMA;
    try {
        const stored = localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA);
        if (stored) schema = JSON.parse(stored);
    } catch(e) {}
    schema.splice(index, 1);
    localStorage.setItem(APP.STORAGE_KEYS.CHECK_SCHEMA, JSON.stringify(schema));
    renderCheckEditor();
};

window.addNewCheckItem = () => {
    const label = prompt('項目名を入力してください (例: 筋トレ)');
    if(!label) return;
    const icon = prompt('アイコン絵文字を入力してください (例: 💪)', '💪');
    const desc = prompt('説明を入力してください (例: 30分以上やった)', '');
    const drinkingOnly = confirm('「お酒を飲んだ日」だけ表示しますか？\n(OK=はい / キャンセル=いいえ[毎日表示])');

    const id = `custom_${Date.now()}`;
    const newItem = {
        id, label, icon: icon || '✅', type: 'boolean', desc, drinking_only: drinkingOnly
    };

    let schema = CHECK_SCHEMA;
    try {
        const stored = localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA);
        if (stored) schema = JSON.parse(stored);
    } catch(e) {}
    schema.push(newItem);
    localStorage.setItem(APP.STORAGE_KEYS.CHECK_SCHEMA, JSON.stringify(schema));
    renderCheckEditor();
};

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
        
        const theme = document.getElementById('theme-input').value;
        localStorage.setItem(APP.STORAGE_KEYS.THEME, theme);

        showMessage('設定を保存しました', 'success');
        document.dispatchEvent(new CustomEvent('refresh-ui'));

    } catch(e) {
        console.error(e);
        showMessage('設定保存中にエラーが発生しました', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
};

export const openHelp = () => toggleModal('help-modal', true);
export const openLogDetail = (id) => { /* TODO */ };

export const updateModeSelector = () => { /* ... */ };
export const updateBeerSelectOptions = () => {
    const styleSel = document.getElementById('beer-select');
    const sizeSel = document.getElementById('beer-size');
    
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

export const updateInputSuggestions = () => { };
export const renderQuickButtons = () => { };
export const closeModal = (id) => toggleModal(id, false);
export const adjustBeerCount = (delta) => {
    const el = document.getElementById('beer-count');
    let v = parseInt(el.value) || 1;
    v = Math.max(1, v + delta);
    el.value = v;
};