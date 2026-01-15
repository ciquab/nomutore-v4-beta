import { EXERCISE, CALORIES, SIZE_DATA, STYLE_METADATA, APP } from '../constants.js';
import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { StateManager } from './state.js';
import { DOM, toggleModal, escapeHtml, toggleDryDay, showMessage } from './dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// UI.getTodayString() の代わり
const getTodayString = () => dayjs().format('YYYY-MM-DD');

// デフォルトのチェック項目スキーマ (v3互換 + 基本セット)
const DEFAULT_CHECK_SCHEMA = [
    { id: 'waistEase', label: 'ウエストに余裕あり', icon: '👖', condition: 'always', isSystem: true },
    { id: 'footLightness', label: '足が軽い・むくみなし', icon: '🦶', condition: 'always', isSystem: true },
    { id: 'fiberOk', label: '飲酒前の食物繊維', icon: '🥗', condition: 'drinking_only', isSystem: true },
    { id: 'waterOk', label: '飲酒中/後の水分補給', icon: '💧', condition: 'drinking_only', isSystem: true }
];

// ----------------------------------------------------------------------
// Form Data Helpers
// ----------------------------------------------------------------------

export const getBeerFormData = () => {
    const dateVal = document.getElementById('beer-date').value;
    const brewery = document.getElementById('beer-brewery').value;
    const brand = document.getElementById('beer-brand').value;
    const rating = parseInt(document.getElementById('beer-rating').value) || 0;
    const memo = document.getElementById('beer-memo').value;
    const useUntappd = document.getElementById('untappd-check').checked;
    const ts = dateVal ? dayjs(dateVal).startOf('day').add(12, 'hour').valueOf() : Date.now(); 

    const isCustom = !document.getElementById('beer-input-custom').classList.contains('hidden');
    
    const data = {
        timestamp: ts, brewery, brand, rating, memo, useUntappd, isCustom, isValid: false
    };

    if (isCustom) {
        data.abv = parseFloat(document.getElementById('custom-abv').value);
        data.ml = parseFloat(document.getElementById('custom-amount').value);
        const typeEls = document.getElementsByName('customType');
        let typeVal = 'dry';
        typeEls.forEach(el => { if(el.checked) typeVal = el.value; });
        data.type = typeVal;

        if (!isNaN(data.abv) && !isNaN(data.ml) && data.abv >= 0 && data.ml > 0) {
            data.isValid = true;
        }
    } else {
        data.style = document.getElementById('beer-select').value;
        data.size = document.getElementById('beer-size').value;
        data.count = parseFloat(document.getElementById('beer-count').value);
        data.userAbv = parseFloat(document.getElementById('preset-abv').value);
        
        if (data.style && data.size && data.count > 0 && !isNaN(data.userAbv)) {
            data.isValid = true;
        }
    }
    return data;
};

// 【新規】チェック項目のデータ収集
export const getCheckFormData = () => {
    const dateVal = document.getElementById('check-date').value;
    const isDryDay = document.getElementById('is-dry-day').checked;
    const w = document.getElementById('check-weight').value;
    
    let weightVal = null;
    if (w !== '') {
        weightVal = parseFloat(w);
    }

    // スキーマに基づいて値を取得
    const schema = Store.getCheckSchema() || DEFAULT_CHECK_SCHEMA;
    const custom = {};
    
    // v3互換フィールド用の一時変数
    let legacyData = { waistEase: false, footLightness: false, waterOk: false, fiberOk: false };

    schema.forEach(item => {
        const el = document.getElementById(`check-item-${item.id}`);
        const val = el ? el.checked : false;
        
        custom[item.id] = val;

        // v3互換フィールドへのマッピング
        if (['waistEase', 'footLightness', 'waterOk', 'fiberOk'].includes(item.id)) {
            legacyData[item.id] = val;
        }
    });

    return {
        date: dateVal,
        isDryDay,
        weight: weightVal,
        custom,
        ...legacyData, // v3互換のためルートにも展開
        isValid: !!dateVal
    };
};

export const resetBeerForm = (keepDate = false) => {
    document.getElementById('beer-brewery').value = '';
    document.getElementById('beer-brand').value = '';
    document.getElementById('beer-rating').value = '0';
    document.getElementById('beer-memo').value = '';
    document.getElementById('untappd-check').checked = false;
    document.getElementById('beer-count').value = '1';
    
    if(document.getElementById('custom-abv')) document.getElementById('custom-abv').value = '';
    if(document.getElementById('custom-amount')) document.getElementById('custom-amount').value = '';

    const modalContent = document.querySelector('#beer-modal .modal-content');
    if (modalContent) modalContent.scrollTop = 0;
};

// ----------------------------------------------------------------------
// Modal Openers
// ----------------------------------------------------------------------

export const openBeerModal = (log = null, targetDate = null, isCopy = false) => {
    const dateEl = document.getElementById('beer-date');
    const styleSelect = document.getElementById('beer-select');
    const sizeSelect = document.getElementById('beer-size');
    const countInput = document.getElementById('beer-count');
    const abvInput = document.getElementById('preset-abv');
    const breweryInput = document.getElementById('beer-brewery');
    const brandInput = document.getElementById('beer-brand');
    const ratingInput = document.getElementById('beer-rating');
    const memoInput = document.getElementById('beer-memo');
    
    const submitBtn = document.getElementById('beer-submit-btn');
    const nextBtn = document.getElementById('btn-save-next');

    const isUpdateMode = log && !isCopy;

    if (dateEl) {
        if (targetDate) {
            dateEl.value = targetDate;
        } else if (isUpdateMode) {
            dateEl.value = dayjs(log.timestamp).format('YYYY-MM-DD');
        } else {
            dateEl.value = getTodayString();
        }
    }

    if (styleSelect) {
        const modes = Store.getModes();
        const currentMode = StateManager.beerMode; 
        const defaultStyle = currentMode === 'mode1' ? modes.mode1 : modes.mode2;
        styleSelect.value = defaultStyle || ''; 
    }
    if (sizeSelect) sizeSelect.value = '350';
    if (countInput) countInput.value = '1';
    if (abvInput) abvInput.value = '5.0';
    if (breweryInput) breweryInput.value = '';
    if (brandInput) brandInput.value = '';
    if (ratingInput) ratingInput.value = '0';
    if (memoInput) memoInput.value = '';
    
    const customAbv = document.getElementById('custom-abv');
    const customAmount = document.getElementById('custom-amount');
    if (customAbv) customAbv.value = '';
    if (customAmount) customAmount.value = '';

    if (submitBtn && nextBtn) {
        if (isUpdateMode) {
            submitBtn.innerHTML = '<span class="text-sm">更新して閉じる</span>';
            submitBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
            submitBtn.classList.add('bg-green-600', 'hover:bg-green-700', 'col-span-2'); 
            submitBtn.classList.remove('col-span-1');
            nextBtn.classList.add('hidden');
        } else {
            submitBtn.innerHTML = '<span class="text-sm">保存して閉じる</span>';
            submitBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700', 'col-span-1');
            submitBtn.classList.remove('bg-green-600', 'hover:bg-green-700', 'col-span-2');
            nextBtn.classList.remove('hidden');
        }
    }

    if (log) {
        if (breweryInput) breweryInput.value = log.brewery || '';
        if (brandInput) brandInput.value = log.brand || '';
        if (ratingInput) ratingInput.value = log.rating || 0;
        if (memoInput) memoInput.value = log.memo || '';

        const isCustom = log.style === 'Custom' || log.isCustom; 

        if (isCustom) {
            switchBeerInputTab('custom');
            if (customAbv) customAbv.value = log.abv || '';
            if (customAmount) customAmount.value = log.rawAmount || (parseInt(log.size) || '');
            
            const radios = document.getElementsByName('customType');
            if (log.customType) {
                radios.forEach(r => r.checked = (r.value === log.customType));
            }
        } else {
            switchBeerInputTab('preset');
            if (styleSelect) styleSelect.value = log.style || '';
            if (sizeSelect) sizeSelect.value = log.size || '350';
            if (countInput) countInput.value = log.count || 1;
            if (abvInput) abvInput.value = log.abv || 5.0;
        }
    } else {
        switchBeerInputTab('preset');
    }

    toggleModal('beer-modal', true);
};

export const switchBeerInputTab = (mode) => {
    const presetTab = document.getElementById('tab-beer-preset');
    const customTab = document.getElementById('tab-beer-custom');
    const presetContent = document.getElementById('beer-input-preset');
    const customContent = document.getElementById('beer-input-custom');

    if (!presetTab || !customTab) return;

    const activeClass = "bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-300 shadow-sm";
    const inactiveClass = "text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-600";

    if (mode === 'preset') {
        presetTab.className = `flex-1 py-2 text-xs font-bold rounded-lg transition ${activeClass}`;
        customTab.className = `flex-1 py-2 text-xs font-bold rounded-lg transition ${inactiveClass}`;
        presetContent?.classList.remove('hidden');
        customContent?.classList.add('hidden');
    } else {
        customTab.className = `flex-1 py-2 text-xs font-bold rounded-lg transition ${activeClass}`;
        presetTab.className = `flex-1 py-2 text-xs font-bold rounded-lg transition ${inactiveClass}`;
        customContent?.classList.remove('hidden');
        presetContent?.classList.add('hidden');
    }
};

/**
 * 【改修】チェック項目を動的に生成する関数
 */
const renderCheckItems = (schema) => {
    // 既存のハードコード要素を削除し、コンテナを確保
    // ※ index.htmlの構造に依存: #check-form 内の構造を書き換える
    const form = document.getElementById('check-form');
    if (!form) return;

    // 既存の動的生成コンテナがあれば取得、なければ作成
    let container = document.getElementById('dynamic-check-items');
    
    if (!container) {
        // v3のハードコード部分 (#drinking-section等) を隠すか削除する必要があるが
        // 毎回DOM操作すると重いので、初回のみ form の中身を整理するアプローチ
        
        // 既存の特定IDを持つ要素を削除 (v3互換)
        const oldSections = form.querySelectorAll('#drinking-section, .bg-green-50');
        oldSections.forEach(el => el.remove());

        // 挿入位置: 日付・休肝日スイッチの後
        const insertTarget = form.querySelector('.space-y-4 > div:nth-child(2)'); // 休肝日スイッチの次
        
        container = document.createElement('div');
        container.id = 'dynamic-check-items';
        container.className = "space-y-3 mt-4";
        
        if (insertTarget && insertTarget.parentNode) {
            insertTarget.parentNode.insertBefore(container, insertTarget.nextSibling);
        } else {
            // フォールバック
            const target = form.querySelector('.space-y-4');
            if(target) target.appendChild(container);
        }
    }

    container.innerHTML = ''; // リセット

    // グループ化 (Condition別)
    const alwaysItems = schema.filter(i => i.condition === 'always');
    const drinkingItems = schema.filter(i => i.condition === 'drinking_only');

    // 1. Always Items
    if (alwaysItems.length > 0) {
        const groupDiv = document.createElement('div');
        groupDiv.className = "bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800";
        groupDiv.innerHTML = `<h4 class="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-3">🧘 コンディション</h4><div class="space-y-3" id="group-always"></div>`;
        container.appendChild(groupDiv);
        
        const list = groupDiv.querySelector('#group-always');
        alwaysItems.forEach(item => {
            list.insertAdjacentHTML('beforeend', createCheckItemHTML(item, 'green'));
        });
    }

    // 2. Drinking Only Items
    if (drinkingItems.length > 0) {
        const groupDiv = document.createElement('div');
        groupDiv.id = 'drinking-only-section'; // 制御用ID
        groupDiv.className = "bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 transition-opacity duration-300";
        groupDiv.innerHTML = `<h4 class="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-3">🛡️ 対策 (飲む前・飲酒中)</h4><div class="space-y-3" id="group-drinking"></div>`;
        container.appendChild(groupDiv);
        
        const list = groupDiv.querySelector('#group-drinking');
        drinkingItems.forEach(item => {
            list.insertAdjacentHTML('beforeend', createCheckItemHTML(item, 'indigo'));
        });
    }
};

const createCheckItemHTML = (item, color) => {
    return `
        <label class="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border border-${color}-100 dark:border-gray-700 hover:border-${color}-300 dark:hover:border-${color}-500 cursor-pointer transition">
            <span class="text-gray-700 dark:text-gray-300 font-bold text-sm flex items-center gap-2">
                <span>${item.icon}</span> ${escapeHtml(item.label)}
            </span>
            <input type="checkbox" id="check-item-${item.id}" name="${item.id}" class="h-5 w-5 text-${color}-600 rounded bg-gray-100 dark:bg-gray-700 dark:border-gray-600 focus:ring-${color}-500">
        </label>
    `;
};

// 【改修】Check Modal Open
export const openCheckModal = (check = null, dateStr = null) => { 
    const dateEl = document.getElementById('check-date');
    const isDryCb = document.getElementById('is-dry-day');
    const submitBtn = document.getElementById('check-submit-btn') || document.querySelector('#check-form button[type="submit"]');
    if (submitBtn) submitBtn.id = 'check-submit-btn';
    
    const weightInput = document.getElementById('check-weight');

    // 1. スキーマ読み込み & 動的生成
    const schema = Store.getCheckSchema() || DEFAULT_CHECK_SCHEMA;
    renderCheckItems(schema);

    // 2. 休肝日連動ロジック定義
    const handleDryDayChange = () => {
        const section = document.getElementById('drinking-only-section');
        if (section) {
            if (isDryCb.checked) {
                section.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
            } else {
                section.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
            }
        }
    };
    
    // イベントリスナー設定 (重複防止のため onchange プロパティを使用)
    isDryCb.onchange = handleDryDayChange;

    // 3. データ充填
    if (check) {
        if (dateEl) dateEl.value = dayjs(check.timestamp).format('YYYY-MM-DD');
        if (isDryCb) isDryCb.checked = check.isDryDay;
        
        if (weightInput) weightInput.value = check.weight || '';

        // 動的項目のチェック状態反映
        schema.forEach(item => {
            const el = document.getElementById(`check-item-${item.id}`);
            if (el) {
                // v4 custom または v3 互換フィールドから値を取得
                const val = (check.custom && check.custom[item.id]) || check[item.id] || false;
                el.checked = val;
            }
        });

        if (submitBtn) {
            submitBtn.textContent = '更新する';
            submitBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
            submitBtn.classList.add('bg-orange-500', 'hover:bg-orange-600');
        }
    } else {
        if (dateEl) dateEl.value = dateStr || getTodayString();
        
        // フォームリセット
        schema.forEach(item => {
            const el = document.getElementById(`check-item-${item.id}`);
            if(el) el.checked = item.default || false;
        });
        isDryCb.checked = false;
        if(weightInput) weightInput.value = '';

        if (submitBtn) {
            submitBtn.textContent = '完了';
            submitBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
            submitBtn.classList.remove('bg-orange-500', 'hover:bg-orange-600');
        }
    }

    // 初期状態の適用
    handleDryDayChange();
    toggleModal('check-modal', true); 
};

export const openManualInput = (log = null, isCopy = false) => { 
    const select = document.getElementById('exercise-select');
    const nameEl = DOM.elements['manual-exercise-name'];
    const dateEl = DOM.elements['manual-date'];
    const minInput = document.getElementById('manual-minutes');
    const bonusCheck = document.getElementById('manual-apply-bonus');
    const submitBtn = document.getElementById('btn-submit-manual');

    if (!select || !dateEl || !minInput || !bonusCheck || !submitBtn) return;

    if (log) {
        if (isCopy) {
            submitBtn.textContent = '記録する';
            submitBtn.classList.add('bg-green-500', 'hover:bg-green-600');
            submitBtn.classList.remove('bg-orange-500', 'hover:bg-orange-600');
            dateEl.value = getTodayString();
        } else {
            submitBtn.textContent = '更新する';
            submitBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
            submitBtn.classList.add('bg-orange-500', 'hover:bg-orange-600');
            dateEl.value = dayjs(log.timestamp).format('YYYY-MM-DD');
        }

        minInput.value = log.rawMinutes || '';
        
        let key = log.exerciseKey;
        if (!key) {
            const logName = log.name || '';
            const entry = Object.entries(EXERCISE).find(([k, v]) => logName.includes(v.label));
            if (entry) key = entry[0];
        }
        if (key && select.querySelector(`option[value="${key}"]`)) {
            select.value = key;
        }

        const hasBonus = log.memo && log.memo.includes('Bonus');
        bonusCheck.checked = hasBonus;

        if (nameEl) nameEl.textContent = EXERCISE[select.value]?.label || '運動';

    } else {
        submitBtn.textContent = '記録する';
        submitBtn.classList.add('bg-green-500', 'hover:bg-green-600');
        submitBtn.classList.remove('bg-orange-500', 'hover:bg-orange-600');
        
        dateEl.value = getTodayString();
        minInput.value = '';
        bonusCheck.checked = true; // デフォルトON
        
        const label = EXERCISE[select.value] ? EXERCISE[select.value].label : '運動';
        if (nameEl) nameEl.textContent = label; 
    }
    
    toggleModal('manual-exercise-modal', true); 
};

// 【新規】期間設定UIの動的注入
const injectPeriodSettingsUI = () => {
    // 挿入場所: "3. その他" (header containing "3. その他") の直前
    const settingsContent = document.querySelector('#settings-content .p-6');
    if (!settingsContent || document.getElementById('setting-period-section')) return;

    const sections = settingsContent.querySelectorAll('section');
    const targetSection = sections[sections.length - 1]; // 最後のセクションの手前に入れる

    if (!targetSection) return;

    const periodSection = document.createElement('section');
    periodSection.id = 'setting-period-section';
    periodSection.className = "mb-8";
    periodSection.innerHTML = `
        <h4 class="text-xs font-bold text-green-500 dark:text-green-400 mb-3 uppercase tracking-widest border-b border-green-100 dark:border-gray-700 pb-1">
            2.5 期間設定 (Period)
        </h4>
        <div class="mb-2">
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">区切りモード</label>
            <div class="bg-green-50 dark:bg-green-900/20 p-2 rounded-xl border border-green-200 dark:border-green-800">
                <select id="setting-period-mode" class="w-full p-3 bg-white dark:bg-gray-800 border border-green-200 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-green-500">
                    <option value="weekly">Weekly (1週間ごと)</option>
                    <option value="monthly">Monthly (1ヶ月ごと)</option>
                    <option value="permanent">Endless (区切りなし)</option>
                </select>
            </div>
            <p class="text-[10px] text-gray-400 mt-1.5 ml-1">
                ※変更すると、次回の起動時または日付変更時に新しい期間が開始されます。
            </p>
        </div>
    `;

    settingsContent.insertBefore(periodSection, targetSection);

    // main.js の handleSaveSettings は DOMの固定IDしか見ていないため、
    // ここで独自に保存イベントを追加する
    const saveBtn = document.getElementById('btn-save-settings');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const mode = document.getElementById('setting-period-mode').value;
            if (mode) {
                const current = Store.getPeriodMode();
                if (current !== mode) {
                    localStorage.setItem(APP.STORAGE_KEYS.PERIOD_MODE, mode);
                    // モード変更時は開始日をリセットして即座に新期間を開始させるフラグを立てる等の処理も考えられるが、
                    // Phase 3.3 ではシンプルに保存のみとし、次回の checkPeriodRollover に任せる
                    console.log(`[Settings] Period mode changed to: ${mode}`);
                }
            }
        });
    }
};

export const openSettings = () => {
    // UI注入
    injectPeriodSettingsUI();

    const p = Store.getProfile();
    const setVal = (key, val) => { if(DOM.elements[key]) DOM.elements[key].value = val; };
    
    setVal('weight-input', p.weight);
    setVal('height-input', p.height);
    setVal('age-input', p.age);
    setVal('gender-input', p.gender);
    
    const modes = Store.getModes();
    setVal('setting-mode-1', modes.mode1);
    setVal('setting-mode-2', modes.mode2);
    setVal('setting-base-exercise', Store.getBaseExercise());
    setVal('theme-input', Store.getTheme());
    setVal('setting-default-record-exercise', Store.getDefaultRecordExercise());        

    // Period Mode
    const periodModeEl = document.getElementById('setting-period-mode');
    if (periodModeEl) {
        periodModeEl.value = Store.getPeriodMode();
    }

    toggleModal('settings-modal', true);
};

export const openHelp = () => {
    toggleModal('help-modal', true);
};

export const updateModeSelector = () => {
    const modes = Store.getModes();
    const select = DOM.elements['home-mode-select'];
    if (!select) return;

    select.innerHTML = '';
    
    const opt1 = document.createElement('option');
    opt1.value = 'mode1';
    opt1.textContent = `${modes.mode1} 換算`;
    
    const opt2 = document.createElement('option');
    opt2.value = 'mode2';
    opt2.textContent = `${modes.mode2} 換算`;

    select.appendChild(opt1);
    select.appendChild(opt2);
    
    select.value = StateManager.beerMode;
};

export const openLogDetail = (log) => {
    if (!DOM.elements['log-detail-modal']) return;

    const isDebt = (log.kcal !== undefined ? log.kcal : log.minutes) < 0;
    
    let iconChar = isDebt ? '🍺' : '🏃‍♀️';
    if (isDebt && log.style && STYLE_METADATA[log.style]) {
        iconChar = STYLE_METADATA[log.style].icon;
    } else if (!isDebt) {
        const exKey = log.exerciseKey;
        if (exKey && EXERCISE[exKey]) iconChar = EXERCISE[exKey].icon;
        else if (log.name) {
            const exEntry = Object.values(EXERCISE).find(e => log.name.includes(e.label));
            if(exEntry) iconChar = exEntry.icon;
        }
    }
    
    DOM.elements['detail-icon'].textContent = iconChar;
    DOM.elements['detail-title'].textContent = log.name;
    DOM.elements['detail-date'].textContent = dayjs(log.timestamp).format('YYYY/MM/DD HH:mm');
    
    const typeText = isDebt ? '借金' : '返済';
    const signClass = isDebt ? 'text-red-500' : 'text-green-500';
    
    const baseEx = Store.getBaseExercise();
    const baseExData = EXERCISE[baseEx] || EXERCISE['stepper'];
    
    const profile = Store.getProfile();
    const kcal = log.kcal !== undefined ? log.kcal : (log.minutes * Calc.burnRate(6.0, profile));
    const displayMinutes = Calc.convertKcalToMinutes(Math.abs(kcal), baseEx, profile);

    DOM.elements['detail-minutes'].innerHTML = `<span class="${signClass}">${typeText} ${displayMinutes}分</span> <span class="text-xs text-gray-400 font-normal">(${baseExData.label})</span>`;

    if (isDebt && (log.style || log.size || log.brewery || log.brand)) {
        DOM.elements['detail-beer-info'].classList.remove('hidden');
        DOM.elements['detail-style'].textContent = log.style || '-';
        const sizeLabel = SIZE_DATA[log.size] ? SIZE_DATA[log.size].label : log.size;
        DOM.elements['detail-size'].textContent = sizeLabel || '-';
        
        const brewery = log.brewery ? `[${log.brewery}] ` : '';
        const brand = log.brand || '';
        DOM.elements['detail-brand'].textContent = (brewery + brand) || '-';
    } else {
        DOM.elements['detail-beer-info'].classList.add('hidden');
    }

    if (log.memo || log.rating > 0) {
        DOM.elements['detail-memo-container'].classList.remove('hidden');
        const stars = '★'.repeat(log.rating) + '☆'.repeat(5 - log.rating);
        DOM.elements['detail-rating'].textContent = log.rating > 0 ? stars : '';
        DOM.elements['detail-memo'].textContent = log.memo || '';
    } else {
        DOM.elements['detail-memo-container'].classList.add('hidden');
    }

    const copyBtn = DOM.elements['btn-detail-copy'] || document.getElementById('btn-detail-copy');
    if (copyBtn) {
        copyBtn.classList.remove('hidden');
        copyBtn.onclick = () => {
            toggleModal('log-detail-modal', false);
            if (isDebt) {
                openBeerModal(log, null, true);
            } else {
                openManualInput(log, true);
            }
        };
    }

    DOM.elements['log-detail-modal'].dataset.id = log.id;

    toggleModal('log-detail-modal', true);
};

export const updateBeerSelectOptions = () => {
    const s = document.getElementById('beer-select');
    if (!s) return;
    
    const currentVal = s.value;
    s.innerHTML = '';
    
    Object.keys(CALORIES.STYLES).forEach(k => {
        const o = document.createElement('option');
        o.value = k;
        o.textContent = k;
        s.appendChild(o);
    });
    
    const modes = Store.getModes();
    if (currentVal && CALORIES.STYLES[currentVal]) {
        s.value = currentVal;
    } else {
        s.value = StateManager.beerMode === 'mode1' ? modes.mode1 : modes.mode2;
    }
};

export const updateInputSuggestions = (logs) => {
    const breweries = new Set();
    const brands = new Set();

    logs.forEach(log => {
        if (log.brewery && typeof log.brewery === 'string' && log.brewery.trim() !== '') {
            breweries.add(log.brewery.trim());
        }
        if (log.brand && typeof log.brand === 'string' && log.brand.trim() !== '') {
            brands.add(log.brand.trim());
        }
    });

    const updateList = (id, set) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '';
        set.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            el.appendChild(opt);
        });
    };

    updateList('brewery-list', breweries);
    updateList('brand-list', brands);
};

export const renderQuickButtons = (logs) => {
    const container = document.getElementById('quick-input-area');
    if (!container) return;
    
    const counts = {};
    logs.forEach(l => {
        const isDebt = l.kcal !== undefined ? l.kcal < 0 : l.minutes < 0;
        if (isDebt && l.style && l.size) {
            const key = `${l.style}|${l.size}`;
            counts[key] = (counts[key] || 0) + 1;
        }
    });

    const topShortcuts = Object.keys(counts)
        .sort((a, b) => counts[b] - counts[a])
        .slice(0, 2)
        .map(key => {
            const [style, size] = key.split('|');
            return { style, size };
        });

    if (topShortcuts.length === 0) {
        container.innerHTML = ''; 
        return;
    }

    container.innerHTML = topShortcuts.map(item => {
        const sizeLabel = SIZE_DATA[item.size] ? SIZE_DATA[item.size].label.replace(/ \(.*\)/, '') : item.size;
        
        const styleEsc = escapeHtml(item.style);
        const sizeEsc = escapeHtml(sizeLabel);
        
        return `<button data-style="${styleEsc}" data-size="${item.size}" 
            class="quick-beer-btn flex-1 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-indigo-900 
            text-indigo-600 dark:text-indigo-300 font-bold py-4 rounded-2xl shadow-md 
            hover:bg-indigo-50 dark:hover:bg-gray-700 flex flex-col items-center justify-center 
            transition active:scale-95 active:border-indigo-500 relative overflow-hidden group">
            
            <span class="absolute top-0 right-0 bg-indigo-500 text-white text-[9px] px-2 py-0.5 rounded-bl-lg opacity-80">HISTORY</span>
            <span class="text-2xl mb-1 group-hover:scale-110 transition-transform">🍺</span>
            <span class="text-xs leading-tight">${styleEsc}</span>
            <span class="text-[10px] opacity-70">${sizeEsc}</span>
        </button>`;
    }).join('');
};