import { EXERCISE, CALORIES, SIZE_DATA, STYLE_METADATA, APP, CHECK_SCHEMA, CHECK_LIBRARY, CHECK_PRESETS, CHECK_DEFAULT_IDS } from '../constants.js';
import { Calc } from '../logic.js';
import { Store, db } from '../store.js';
import { StateManager } from './state.js';
import { DOM, toggleModal, escapeHtml, toggleDryDay, showMessage } from './dom.js';
import { Service } from '../service.js';
import { Timer } from './timer.js'; 
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

const getTodayString = () => dayjs().format('YYYY-MM-DD');

/* --- Action Menu (Phase 1.5 New) --- */
export const openActionMenu = (dateStr = null) => {
    const targetDate = dateStr || getTodayString();
    StateManager.setSelectedDate(targetDate);
    
    const label = document.getElementById('action-menu-date-label');
    if(label) label.textContent = dayjs(targetDate).format('MM/DD (ddd)');
    
    // 隠しフィールドがある場合（index.htmlに追加が必要だが、ない場合はselectedDateステートで動作するようフォールバック）
    const hiddenDate = document.getElementById('action-menu-target-date');
    if(hiddenDate) hiddenDate.value = targetDate;

    toggleModal('action-menu-modal', true);
};

export const handleActionSelect = (type) => {
    const hiddenDate = document.getElementById('action-menu-target-date');
    // 隠しフィールドがない場合はStateManagerから取得
    const dateStr = hiddenDate ? hiddenDate.value : (StateManager.selectedDate || getTodayString());
    
    toggleModal('action-menu-modal', false);

    if (type === 'beer') openBeerModal(null, dateStr);
    else if (type === 'exercise') openManualInput(dateStr);
    else if (type === 'check') openCheckModal(dateStr);
    else if (type === 'timer') openTimer(true);
};

/* --- Beer Modal Logic --- */

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

    return {
        timestamp: ts,
        brewery, brand, rating, memo,
        style, size, count,
        isCustom,
        abv: customAbv,
        ml: customMl,
        type: 'brew', // Custom時のデフォルト
        useUntappd
    };
};

export const resetBeerForm = (keepDate = false) => {
    if (!keepDate) document.getElementById('beer-date').value = dayjs().format('YYYY-MM-DD');
    
    const idField = document.getElementById('editing-log-id');
    if(idField) idField.value = '';
    
    document.getElementById('beer-count').value = 1;
    document.getElementById('beer-brewery').value = '';
    document.getElementById('beer-brand').value = '';
    document.getElementById('beer-rating').value = '0';
    document.getElementById('beer-memo').value = '';
    
    const untappdCheck = document.getElementById('untappd-check');
    if(untappdCheck) untappdCheck.checked = false;
    
    // Reset tabs
    switchBeerInputTab('preset');
};

export const searchUntappd = () => {
    const brewery = document.getElementById('beer-brewery').value;
    const brand = document.getElementById('beer-brand').value;
    if (!brand) { alert('Please enter a Beer Name to search.'); return; }
    const query = encodeURIComponent(`${brewery} ${brand}`.trim());
    window.open(`https://untappd.com/search?q=${query}`, '_blank');
};

export const openBeerModal = (e, dateStr = null, log = null) => {
    resetBeerForm();
    if (dateStr) document.getElementById('beer-date').value = dateStr;
    else if (log) document.getElementById('beer-date').value = dayjs(log.timestamp).format('YYYY-MM-DD');
    updateBeerSelectOptions();

    if (log) {
        const idField = document.getElementById('editing-log-id');
        if(idField) idField.value = log.id;
        document.getElementById('beer-count').value = log.count || 1;
        document.getElementById('beer-brewery').value = log.brewery || '';
        document.getElementById('beer-brand').value = log.brand || log.name || ''; 
        document.getElementById('beer-rating').value = log.rating || 0;
        document.getElementById('beer-memo').value = log.memo || '';
        
        if (log.isCustom || log.type === 'brew') {
            switchBeerInputTab('custom');
            document.getElementById('custom-abv').value = log.abv || 5.0;
            document.getElementById('custom-amount').value = log.rawAmount || log.ml || 350;
        } else {
            switchBeerInputTab('preset');
            const styleSel = document.getElementById('beer-select');
            const sizeSel = document.getElementById('beer-size');
            if (log.style) styleSel.value = log.style;
            if (log.size) sizeSel.value = log.size;
        }
    }
    
    const delBtn = document.getElementById('btn-delete-beer');
    if (delBtn) {
        if (log) { delBtn.classList.remove('hidden'); delBtn.classList.add('flex'); }
        else { delBtn.classList.add('hidden'); delBtn.classList.remove('flex'); }
    }
    toggleModal('beer-modal', true);
};

export const switchBeerInputTab = (mode) => {
    const preset = document.getElementById('beer-input-preset');
    const custom = document.getElementById('beer-input-custom');
    const btnPreset = document.getElementById('tab-beer-preset');
    const btnCustom = document.getElementById('tab-beer-custom');
    
    const activeClasses = ['bg-indigo-600', 'text-white', 'shadow-sm'];
    const inactiveClasses = ['text-gray-500', 'hover:bg-base-200', 'dark:hover:bg-base-800'];

    if (mode === 'preset') {
        preset.classList.remove('hidden'); custom.classList.add('hidden');
        btnPreset.classList.remove(...inactiveClasses); btnPreset.classList.add(...activeClasses);
        btnCustom.classList.remove(...activeClasses); btnCustom.classList.add(...inactiveClasses);
    } else {
        preset.classList.add('hidden'); custom.classList.remove('hidden');
        btnPreset.classList.remove(...activeClasses); btnPreset.classList.add(...inactiveClasses);
        btnCustom.classList.remove(...inactiveClasses); btnCustom.classList.add(...activeClasses);
    }
};

/* --- Check Modal Logic --- */

export const openCheckModal = async (dateStr) => {
    const d = dateStr ? dayjs(dateStr) : dayjs();
    const dateVal = d.format('YYYY-MM-DD');
    const dateInput = document.getElementById('check-date');
    if(dateInput) dateInput.value = dateVal;

    const container = document.getElementById('check-items-container');
    if (container) {
        container.innerHTML = '';
        let schema = CHECK_SCHEMA; // Default Fallback
        try {
            const stored = localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA);
            if (stored) schema = JSON.parse(stored);
            else {
                // 初回起動時などで未保存の場合、デフォルトIDからスキーマを構築して保存
                schema = getActiveSchemaFromIds(CHECK_DEFAULT_IDS);
                localStorage.setItem(APP.STORAGE_KEYS.CHECK_SCHEMA, JSON.stringify(schema));
            }
        } catch(e) {}

        schema.forEach(item => {
            const div = document.createElement('div');
            const visibilityClass = item.drinking_only ? 'drinking-only' : '';
            if (visibilityClass) div.className = visibilityClass;
            div.innerHTML = `
                <label class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer border border-transparent hover:border-indigo-200 dark:hover:border-indigo-700 transition h-full">
                    <input type="checkbox" id="check-${item.id}" class="rounded text-indigo-600 focus:ring-indigo-500 w-5 h-5 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                    <div class="flex flex-col">
                        <span class="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1">
                            <span>${item.icon}</span> ${item.label}
                        </span>
                        ${item.desc ? `<span class="text-[9px] text-gray-400">${item.desc}</span>` : ''}
                    </div>
                </label>
            `;
            container.appendChild(div);
        });
    }

    const syncDryDayUI = (isDry) => {
        const items = document.querySelectorAll('.drinking-only');
        items.forEach(el => {
            if (isDry) el.classList.add('hidden');
            else el.classList.remove('hidden');
        });
        toggleDryDay(isDry);
    };

    const isDryCheck = document.getElementById('check-is-dry');
    if (isDryCheck) {
        // リスナー重複防止のために一度cloneNode等するのがベストだが、ここではシンプルに毎回追加（少し無駄だが動作する）
        // 厳密には `onclick` で上書きする方が安全
        isDryCheck.onclick = (e) => syncDryDayUI(e.target.checked);
    }

    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.checked = !!val;
    };
    
    // Reset
    setCheck('check-is-dry', false);
    syncDryDayUI(false);
    
    const wEl = document.getElementById('check-weight');
    if(wEl) wEl.value = '';

    const isDryInput = document.getElementById('check-is-dry');
    const dryLabelContainer = isDryInput ? isDryInput.closest('#drinking-section') : null;
    const dryLabelText = dryLabelContainer ? dryLabelContainer.querySelector('span.font-bold') : null;

    // Reset Lock State
    if (dryLabelText) dryLabelText.innerHTML = "Is today a Dry Day?";
    if (isDryInput) isDryInput.disabled = false;
    if (dryLabelContainer) dryLabelContainer.classList.remove('opacity-50', 'pointer-events-none');

    try {
        const start = d.startOf('day').valueOf();
        const end = d.endOf('day').valueOf();
        
        // 並列取得
        const [existingLogs, beerLogs] = await Promise.all([
            db.checks.where('timestamp').between(start, end, true, true).toArray(),
            db.logs.where('timestamp').between(start, end, true, true).filter(l => l.type === 'beer').toArray()
        ]);

        const existing = existingLogs.length > 0 ? existingLogs[0] : null;
        const hasBeer = beerLogs.length > 0;

        if (existing) {
            setCheck('check-is-dry', existing.isDryDay);
            syncDryDayUI(existing.isDryDay);
            
            // スキーマに合わせてチェックボックスを埋める
            let schema = CHECK_SCHEMA;
            try {
                const s = localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA);
                if (s) schema = JSON.parse(s);
            } catch(e) {}
            
            schema.forEach(item => {
                if (existing[item.id] !== undefined) {
                    setCheck(`check-${item.id}`, existing[item.id]);
                }
            });
            if(wEl) wEl.value = existing.weight || '';
        }

        // ビール記録がある場合、休肝日を強制OFF＆ロック
        if (hasBeer) {
            setCheck('check-is-dry', false); 
            syncDryDayUI(false);             
            if (isDryInput) isDryInput.disabled = true;
            if (dryLabelContainer) dryLabelContainer.classList.add('opacity-50', 'pointer-events-none');
            if (dryLabelText) dryLabelText.innerHTML = "Is today a Dry Day? <span class='text-[10px] text-red-500 font-bold ml-2'>(Alcohol Recorded)</span>";
        }
    } catch (e) { console.error("Failed to fetch check data:", e); }

    toggleModal('check-modal', true);
};

/* --- Exercise Modal Logic --- */

export const openManualInput = (dateStr = null, log = null) => {
    const idField = document.getElementById('editing-exercise-id');
    const minField = document.getElementById('manual-minutes');
    const dateField = document.getElementById('manual-date');
    const bonusCheck = document.getElementById('manual-apply-bonus');
    const saveBtn = document.getElementById('btn-save-exercise'); 
    const deleteBtn = document.getElementById('btn-delete-exercise');

    if(idField) idField.value = '';
    if(minField) minField.value = '';
    const targetDate = dateStr || (log ? dayjs(log.timestamp).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'));
    if(dateField) dateField.value = targetDate;

    if (log) {
        if(idField) idField.value = log.id;
        if(minField) minField.value = log.minutes || 30;
        const typeSel = document.getElementById('exercise-select');
        if (typeSel && log.exerciseKey) typeSel.value = log.exerciseKey;
        if (saveBtn) saveBtn.textContent = 'Update';
        if (deleteBtn) deleteBtn.classList.remove('hidden');
        if (bonusCheck) {
            const hasBonus = (log.applyBonus !== undefined) ? log.applyBonus : (log.memo && log.memo.includes('Bonus'));
            bonusCheck.checked = !!hasBonus;
        }
    } else {
        if (saveBtn) saveBtn.textContent = 'Record';
        if (deleteBtn) deleteBtn.classList.add('hidden');
        if (bonusCheck) bonusCheck.checked = true;
    }
    toggleModal('exercise-modal', true);
};

/* --- Timer Logic --- */

export const openTimer = (autoStart = false) => {
    Timer.init();
    toggleModal('timer-modal', true);
    const isRunning = localStorage.getItem(APP.STORAGE_KEYS.TIMER_START);
    if (autoStart && !isRunning) {
        setTimeout(() => {
            const toggleBtn = document.getElementById('btn-timer-toggle');
            if (toggleBtn) toggleBtn.click(); 
        }, 300);
    }
};

export const closeTimer = () => {
    const acc = localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);
    const start = localStorage.getItem(APP.STORAGE_KEYS.TIMER_START);
    if (start || (acc && parseInt(acc) > 0)) {
        if (!confirm('タイマーをバックグラウンドで実行したまま閉じますか？\n(計測は止まりません)')) return;
    }
    toggleModal('timer-modal', false);
};

/* --- Check Library Logic (Phase 1.5 New) --- */

// ライブラリからIDリストに基づいてSchemaオブジェクトを生成するヘルパー
const getActiveSchemaFromIds = (ids) => {
    const activeSchema = [];
    ids.forEach(id => {
        let item = null;
        // ライブラリを走査してIDに一致する定義を探す
        Object.values(CHECK_LIBRARY).forEach(category => {
            const found = category.find(i => i.id === id);
            if (found) item = found;
        });
        
        // ライブラリになければ（カスタム項目）、現在のスキーマから探す（または維持する）
        if (!item) {
            try {
                const current = JSON.parse(localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA) || '[]');
                item = current.find(i => i.id === id);
            } catch(e){}
        }

        if (item) {
            activeSchema.push(item);
        }
    });
    return activeSchema;
};

// 現在アクティブな項目IDのリストを取得
const getCurrentActiveIds = () => {
    try {
        const schema = JSON.parse(localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA) || '[]');
        return schema.map(i => i.id);
    } catch(e) {
        return CHECK_DEFAULT_IDS;
    }
};

// ライブラリモーダルのレンダリング
window.renderCheckLibrary = () => {
    const container = document.getElementById('library-content');
    if (!container) return;
    container.innerHTML = '';

    const activeIds = new Set(getCurrentActiveIds());

    // カテゴリごとに表示
    const categories = {
        'general': '基本・メンタル',
        'diet': 'ダイエット・食事',
        'alcohol': 'お酒・飲み会',
        'muscle': '筋トレ・運動'
    };

    Object.entries(categories).forEach(([key, label]) => {
        const items = CHECK_LIBRARY[key];
        if (!items) return;

        const section = document.createElement('div');
        section.className = "mb-4";
        section.innerHTML = `<h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 sticky top-0 bg-white dark:bg-base-900 py-2 z-10">${label}</h4>`;
        
        const grid = document.createElement('div');
        grid.className = "grid grid-cols-2 gap-2";

        items.forEach(item => {
            const isActive = activeIds.has(item.id);
            const btn = document.createElement('div');
            btn.className = `p-3 rounded-xl border-2 cursor-pointer transition flex items-center gap-3 ${
                isActive 
                ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-900/30 dark:border-indigo-500' 
                : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700 hover:border-gray-300'
            }`;
            
            btn.onclick = () => {
                const checkbox = document.getElementById(`lib-chk-${item.id}`);
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    // クラス更新
                    btn.className = checkbox.checked
                        ? 'p-3 rounded-xl border-2 cursor-pointer transition flex items-center gap-3 bg-indigo-50 border-indigo-500 dark:bg-indigo-900/30 dark:border-indigo-500'
                        : 'p-3 rounded-xl border-2 cursor-pointer transition flex items-center gap-3 bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700 hover:border-gray-300';
                    
                    // アイコン切り替え
                    const iconArea = btn.querySelector('.check-icon');
                    if (iconArea) {
                        iconArea.innerHTML = checkbox.checked 
                            ? '<i class="ph-fill ph-check-circle text-indigo-500"></i>' 
                            : '<i class="ph-bold ph-circle text-gray-300"></i>';
                    }
                }
            };

            btn.innerHTML = `
                <input type="checkbox" id="lib-chk-${item.id}" class="hidden" ${isActive ? 'checked' : ''} value="${item.id}">
                <span class="text-2xl">${item.icon}</span>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-base-900 dark:text-white truncate">${item.label}</p>
                    <p class="text-[9px] text-gray-400 truncate">${item.desc}</p>
                </div>
                <div class="check-icon">
                    ${isActive ? '<i class="ph-fill ph-check-circle text-indigo-500"></i>' : '<i class="ph-bold ph-circle text-gray-300"></i>'}
                </div>
            `;
            grid.appendChild(btn);
        });

        section.appendChild(grid);
        container.appendChild(section);
    });
};

window.applyLibraryChanges = () => {
    // チェックされているIDを収集
    const checkedInputs = document.querySelectorAll('#library-content input[type="checkbox"]:checked');
    const selectedIds = Array.from(checkedInputs).map(input => input.value);
    
    // 現在のスキーマから「カスタム項目（ライブラリにないもの）」を退避して維持する
    let currentSchema = [];
    try {
        currentSchema = JSON.parse(localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA) || '[]');
    } catch(e){}

    const libraryIds = new Set();
    Object.values(CHECK_LIBRARY).flat().forEach(i => libraryIds.add(i.id));

    const customItems = currentSchema.filter(item => !libraryIds.has(item.id));

    // ライブラリから選択された項目 + カスタム項目 で新しいスキーマを作成
    const newSchemaFromLibrary = getActiveSchemaFromIds(selectedIds);
    const finalSchema = [...newSchemaFromLibrary, ...customItems];

    localStorage.setItem(APP.STORAGE_KEYS.CHECK_SCHEMA, JSON.stringify(finalSchema));
    
    toggleModal('check-library-modal', false);
    renderCheckEditor(); // 設定画面のリスト更新
    showMessage('チェック項目を更新しました', 'success');
};

window.applyPreset = (presetKey) => {
    const preset = CHECK_PRESETS[presetKey];
    if (!preset) return;

    if (!confirm(`「${preset.label}」プリセットを適用しますか？\n（現在のカスタム項目は維持されますが、ライブラリ選択項目は上書きされます）`)) return;

    const selectedIds = preset.ids;
    
    // UI上のチェックボックスを同期して保存処理を呼ぶ
    // （モーダルが開かれていない場合でも動くように、直接ロジックを再利用）
    
    // 現在のスキーマからカスタム項目退避
    let currentSchema = [];
    try {
        currentSchema = JSON.parse(localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA) || '[]');
    } catch(e){}
    const libraryIds = new Set();
    Object.values(CHECK_LIBRARY).flat().forEach(i => libraryIds.add(i.id));
    const customItems = currentSchema.filter(item => !libraryIds.has(item.id));

    // 新しいスキーマ
    const newSchemaFromLibrary = getActiveSchemaFromIds(selectedIds);
    const finalSchema = [...newSchemaFromLibrary, ...customItems];

    localStorage.setItem(APP.STORAGE_KEYS.CHECK_SCHEMA, JSON.stringify(finalSchema));
    
    // UI更新（もし開いていれば）
    if(document.getElementById('check-library-modal') && !document.getElementById('check-library-modal').classList.contains('hidden')) {
        window.renderCheckLibrary();
    }
    
    renderCheckEditor();
    showMessage(`プリセット「${preset.label}」を適用しました`, 'success');
};

export const openCheckLibrary = () => {
    window.renderCheckLibrary();
    toggleModal('check-library-modal', true);
};

/* --- Settings Logic --- */

export const renderSettings = () => {
    const currentMode = localStorage.getItem(APP.STORAGE_KEYS.PERIOD_MODE) || 'weekly';
    const periodSel = document.getElementById('setting-period-mode');
    const durationInput = document.getElementById('setting-period-duration');
    const durationContainer = document.getElementById('setting-period-duration-container');
    const savedDuration = localStorage.getItem(APP.STORAGE_KEYS.PERIOD_DURATION) || APP.DEFAULTS.PERIOD_DURATION;

    if (periodSel) {
        periodSel.value = currentMode;
        periodSel.onchange = () => {
            if (periodSel.value === 'custom') durationContainer.classList.remove('hidden');
            else durationContainer.classList.add('hidden');
        };
        if (currentMode === 'custom') durationContainer.classList.remove('hidden');
        else durationContainer.classList.add('hidden');
    }
    if (durationInput) durationInput.value = savedDuration;

    renderCheckEditor();
};

const renderCheckEditor = () => {
    const container = document.getElementById('check-editor-list');
    if (!container) return; 
    container.innerHTML = '';
    
    let schema = [];
    try {
        schema = JSON.parse(localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA) || '[]');
        if (schema.length === 0) {
            schema = getActiveSchemaFromIds(CHECK_DEFAULT_IDS);
            localStorage.setItem(APP.STORAGE_KEYS.CHECK_SCHEMA, JSON.stringify(schema));
        }
    } catch(e) {}

    schema.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = "flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl mb-2";
        
        // 削除ボタン (ライブラリ管理になるので、個別削除も可能にする)
        const deleteBtn = `<button onclick="deleteCheckItem(${index})" class="text-red-500 hover:bg-red-100 p-1 rounded"><i class="ph-bold ph-trash"></i></button>`;

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
    let schema = [];
    try { schema = JSON.parse(localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA)); } catch(e) {}
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

    let schema = [];
    try { schema = JSON.parse(localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA) || '[]'); } catch(e) {}
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
        const durationInput = document.getElementById('setting-period-duration');
        if (durationInput && durationInput.value) {
            localStorage.setItem(APP.STORAGE_KEYS.PERIOD_DURATION, durationInput.value);
        }
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

        // Headerのドロップダウンも更新
        const headerSel = document.getElementById('header-mode-select');
        if(headerSel) {
            // mode1, mode2のラベルを更新（valueはそのまま）
            headerSel.options[0].text = m1;
            headerSel.options[1].text = m2;
        }

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
export const openLogDetail = (id) => { /* TODO: 実装が必要であれば */ };
export const updateModeSelector = () => { /* Header selector update logic if separated */ };

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