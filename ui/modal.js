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
    } else if (type === 'timer') { // ★追加
        openTimer(true); // 自動開始フラグをON
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

export const resetBeerForm = (keepDate = false) => {
    if (!keepDate) {
        document.getElementById('beer-date').value = dayjs().format('YYYY-MM-DD');
    }
    
    // ★追加: 編集IDをリセット
    const idField = document.getElementById('editing-log-id');
    if(idField) idField.value = '';

    document.getElementById('beer-count').value = 1;
    document.getElementById('beer-brewery').value = '';
    document.getElementById('beer-brand').value = '';
    
    const ratingEl = document.getElementById('beer-rating');
    if(ratingEl) ratingEl.value = '0';
    
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

export const openBeerModal = (e, dateStr = null, log = null) => {
    resetBeerForm();
    
    if (dateStr) {
        document.getElementById('beer-date').value = dateStr;
    } else if (log) {
        document.getElementById('beer-date').value = dayjs(log.timestamp).format('YYYY-MM-DD');
    }

    updateBeerSelectOptions();

    if (log) {
        // ★追加: 編集対象のIDをセット
        const idField = document.getElementById('editing-log-id');
        if(idField) idField.value = log.id;

        document.getElementById('beer-count').value = log.count || 1;
        document.getElementById('beer-brewery').value = log.brewery || '';
        document.getElementById('beer-brand').value = log.brand || log.name || ''; 
        document.getElementById('beer-rating').value = log.rating || 0;
        document.getElementById('beer-memo').value = log.memo || '';
        
        if (log.type === 'brew') {
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
        if (log) {
            // 編集モードなら表示
            delBtn.classList.remove('hidden');
            delBtn.classList.add('flex');
        } else {
            // 新規作成なら隠す
            delBtn.classList.add('hidden');
            delBtn.classList.remove('flex');
        }
    }

    toggleModal('beer-modal', true);
};

export const switchBeerInputTab = (mode) => {
    const preset = document.getElementById('beer-input-preset');
    const custom = document.getElementById('beer-input-custom');
    const btnPreset = document.getElementById('tab-beer-preset');
    const btnCustom = document.getElementById('tab-beer-custom');

    // スタイルの定義（アクティブ時と非アクティブ時）
    const activeClasses = ['bg-indigo-600', 'text-white', 'shadow-sm'];
    const inactiveClasses = ['text-gray-500', 'hover:bg-base-200', 'dark:hover:bg-base-800'];

    // 状態を切り替えるヘルパー関数
    const setActive = (el) => {
        el.classList.remove(...inactiveClasses);
        el.classList.add(...activeClasses);
    };

    const setInactive = (el) => {
        el.classList.remove(...activeClasses);
        el.classList.add(...inactiveClasses);
    };

    if (mode === 'preset') {
        preset.classList.remove('hidden');
        custom.classList.add('hidden');
        setActive(btnPreset);
        setInactive(btnCustom);
    } else {
        preset.classList.add('hidden');
        custom.classList.remove('hidden');
        setInactive(btnPreset);
        setActive(btnCustom);
    }
};

export const openCheckModal = async (dateStr) => {
    const d = dateStr ? dayjs(dateStr) : dayjs();
    const dateVal = d.format('YYYY-MM-DD');
    
    // 1. 日付セット
    const dateInput = document.getElementById('check-date');
    if(dateInput) dateInput.value = dateVal;

    // 2. チェック項目の生成
    const container = document.getElementById('check-items-container');
    if (container) {
        container.innerHTML = '';
        
        let schema = CHECK_SCHEMA;
        try {
            const stored = localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA);
            if (stored) schema = JSON.parse(stored);
        } catch(e) {}

        schema.forEach(item => {
            const div = document.createElement('div');
            // ★修正: drinking_only項目に識別用クラスを付与
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

    // 3. 表示制御用ヘルパー関数
    const syncDryDayUI = (isDry) => {
        // 項目の表示・非表示切り替え
        const items = document.querySelectorAll('.drinking-only');
        items.forEach(el => {
            if (isDry) el.classList.add('hidden');
            else el.classList.remove('hidden');
        });
        // UIの色変更 (dom.jsのtoggleDryDayを呼び出す)
        if (typeof toggleDryDay === 'function') {
            toggleDryDay(isDry);
        }
    };

    // トグルのイベント設定
    const isDryCheck = document.getElementById('check-is-dry');
    if (isDryCheck) {
        // インラインの onchange (UI.toggleDryDay) を優先し、
        // ここでは追加の同期処理だけをイベントリスナーとして登録する
        isDryCheck.addEventListener('change', (e) => syncDryDayUI(e.target.checked));
    }

    // 4. フォームリセットと初期状態の設定
    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.checked = !!val;
    };
    
    setCheck('check-is-dry', false);
    syncDryDayUI(false);
    
    const wEl = document.getElementById('check-weight');
    if(wEl) wEl.value = '';

    // ★追加: 制御用変数の定義
    const isDryInput = document.getElementById('check-is-dry');
    const dryLabelContainer = isDryInput ? isDryInput.closest('#drinking-section') : null; // closest('label')だと範囲が狭いのでsection全体を取得
    const dryLabelText = dryLabelContainer ? dryLabelContainer.querySelector('span.font-bold') : null;

    // ★追加: 初期化（前回開いた時の無効化状態をリセット）
    if (dryLabelText) dryLabelText.innerHTML = "Is today a Dry Day?";
    if (isDryInput) isDryInput.disabled = false;
    if (dryLabelContainer) dryLabelContainer.classList.remove('opacity-50', 'pointer-events-none');

    // 5. データ復元 & 整合性チェック
    try {
        const start = d.startOf('day').valueOf();
        const end = d.endOf('day').valueOf();
        
        // 並列で「既存チェック」と「ビールログ」を取得
        const [existingLogs, beerLogs] = await Promise.all([
            db.checks.where('timestamp').between(start, end, true, true).toArray(),
            db.logs.where('timestamp').between(start, end, true, true).filter(l => l.type === 'beer').toArray()
        ]);

        const existing = existingLogs.length > 0 ? existingLogs[0] : null;
        const hasBeer = beerLogs.length > 0;

        // 既存データの復元
        if (existing) {
            setCheck('check-is-dry', existing.isDryDay);
            syncDryDayUI(existing.isDryDay);
            
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

        // ★ ビール記録がある場合の強制オーバーライド処理
        if (hasBeer) {
            setCheck('check-is-dry', false); // 強制OFF
            syncDryDayUI(false);             // UIも飲酒モードへ
            
            // 定義した変数を使って操作
            if (isDryInput) isDryInput.disabled = true;
            
            if (dryLabelContainer) {
                dryLabelContainer.classList.add('opacity-50', 'pointer-events-none');
            }
            if (dryLabelText) {
                dryLabelText.innerHTML = "Is today a Dry Day? <span class='text-[10px] text-red-500 font-bold ml-2'>(Alcohol Recorded)</span>";
            }
        }

    } catch (e) {
        console.error("Failed to fetch check data:", e);
    }

    toggleModal('check-modal', true);
};

// ★修正: dateStrを受け取れるように変更
export const openManualInput = (dateStr = null, log = null) => {
    // 1. 要素取得
    const idField = document.getElementById('editing-exercise-id');
    const minField = document.getElementById('manual-minutes');
    const dateField = document.getElementById('manual-date');
    const bonusCheck = document.getElementById('manual-apply-bonus');
    
    // ★修正1: IDを index.html / index.js と一致させる
    const saveBtn = document.getElementById('btn-save-exercise'); 
    const deleteBtn = document.getElementById('btn-delete-exercise');

    // 2. リセット
    if(idField) idField.value = '';
    if(minField) minField.value = '';
    
    // 日付セット
    const targetDate = dateStr || (log ? dayjs(log.timestamp).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'));
    if(dateField) dateField.value = targetDate;

    // 3. モード別表示切り替え
    if (log) {
        // === 編集モード ===
        if(idField) idField.value = log.id;
        if(minField) minField.value = log.minutes || 30;
        
        const typeSel = document.getElementById('exercise-select');
        if (typeSel && log.exerciseKey) {
            typeSel.value = log.exerciseKey;
        }

        // 保存ボタンを「Update」に変更
        if (saveBtn) saveBtn.textContent = 'Update';

        // ★修正2: 削除ボタンは「表示するだけ」。onclickイベントは index.js で定義済みなので削除。
        if (deleteBtn) {
            deleteBtn.classList.remove('hidden');
        }

        // ボーナスチェック復元
        if (bonusCheck) {
            const hasBonus = (log.applyBonus !== undefined) 
                ? log.applyBonus 
                : (log.memo && log.memo.includes('Bonus'));
            bonusCheck.checked = !!hasBonus;
        }

    } else {
        // === 新規作成モード ===
        if (saveBtn) saveBtn.textContent = 'Record';
        
        // ★修正3: 削除ボタンを隠す
        if (deleteBtn) {
            deleteBtn.classList.add('hidden');
        }

        // ボーナスデフォルトON
        if (bonusCheck) bonusCheck.checked = true;
    }

    // 4. モーダルを表示
    toggleModal('exercise-modal', true);
};

export const openTimer = (autoStart = false) => {
    Timer.init();
    toggleModal('timer-modal', true);

    // すでに計測中の場合は何もしない（二重起動防止）
    const isRunning = localStorage.getItem(APP.STORAGE_KEYS.TIMER_START);
    
    if (autoStart && !isRunning) {
        // モーダルが開くアニメーションを少し待ってから開始ボタンを押す
        setTimeout(() => {
            const toggleBtn = document.getElementById('btn-timer-toggle');
            if (toggleBtn) {
                toggleBtn.click(); // Timer.toggle() を直接呼ぶより、ボタンクリックを模倣する方が安全
            }
        }, 300);
    }
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
    // ★追加: 期間設定の読み込み
    const durationInput = document.getElementById('setting-period-duration');
    const durationContainer = document.getElementById('setting-period-duration-container');
    const savedDuration = localStorage.getItem(APP.STORAGE_KEYS.PERIOD_DURATION) || APP.DEFAULTS.PERIOD_DURATION;

    if (periodSel) {
        periodSel.value = currentMode;
        
        // イベントリスナー定義 (モード変更時の表示切替)
        periodSel.onchange = () => {
            if (periodSel.value === 'custom') {
                durationContainer.classList.remove('hidden');
            } else {
                durationContainer.classList.add('hidden');
            }
        };
        
        // 初期表示状態の設定
        if (currentMode === 'custom') {
            durationContainer.classList.remove('hidden');
        } else {
            durationContainer.classList.add('hidden');
        }
    }
    
    if (durationInput) {
        durationInput.value = savedDuration;
    }

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

        // ★追加: 日数の保存
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

        // ★追加: ヘッダーのプルダウン表示を即時更新
        const headerSel = document.getElementById('header-mode-select');
        if(headerSel) {
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