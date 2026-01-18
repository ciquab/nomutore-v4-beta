import { Calc } from '../logic.js';
import { Store, db } from '../store.js';
import { Service } from '../service.js';
import { APP } from '../constants.js';
import { DOM, toggleModal, showConfetti, showMessage, applyTheme, toggleDryDay } from './dom.js';
import { StateManager } from './state.js';

import { renderBeerTank } from './beerTank.js';
import { renderLiverRank } from './liverRank.js';
import { renderCheckStatus } from './checkStatus.js';
import { renderWeeklyAndHeatUp, renderHeatmap } from './weekly.js';
import { renderChart } from './chart.js';
import { updateLogListView, toggleEditMode, toggleSelectAll, updateBulkCount, setFetchLogsHandler } from './logList.js';
import { renderBeerStats } from './beerStats.js';
import { renderArchives } from './archiveManager.js';
import { Timer } from './timer.js';

import { 
    getBeerFormData, resetBeerForm, openBeerModal, switchBeerInputTab, 
    openCheckModal, openManualInput, renderSettings, openHelp, openLogDetail, 
    updateModeSelector, updateBeerSelectOptions, updateInputSuggestions, renderQuickButtons,
    closeModal, adjustBeerCount, searchUntappd,
    openTimer, closeTimer,
    openActionMenu, handleActionSelect
} from './modal.js';

import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

export const refreshUI = async () => {
    if (!UI._fetchAllDataHandler) return;
    const { logs, checks } = await UI._fetchAllDataHandler();
    
    // データ整合性チェック等のために少し待つケースも考慮
    const profile = Store.getProfile();
    let balance = 0;
    logs.forEach(l => {
        balance += (l.kcal || 0);
    });
    
    // 各コンポーネント再描画
    renderBeerTank(balance);
    renderLiverRank(checks, logs);
    renderCheckStatus(checks, logs);
    renderWeeklyAndHeatUp(logs, checks);
    renderChart(logs, checks);
    
    const cellarMode = StateManager.cellarViewMode;
    if (cellarMode === 'logs') {
        updateLogListView();
    } else if (cellarMode === 'stats') {
        renderBeerStats(logs);
    } else if (cellarMode === 'archives') {
        renderArchives();
    }

    // ★追加: ヘッダーのモード選択プルダウンも更新
    updateModeSelector(); 
};

export const UI = {
    setFetchLogsHandler: (fn) => { setFetchLogsHandler(fn); },
    _fetchAllDataHandler: null,
    setFetchAllDataHandler: (fn) => { UI._fetchAllDataHandler = fn; },

    init: () => {
        DOM.init();
        
        const bind = (id, event, fn) => {
            const el = document.getElementById(id);
            if(el) el.addEventListener(event, fn);
        };

        bind('nav-tab-home', 'click', () => UI.switchTab('home'));
        bind('nav-tab-record', 'click', () => UI.switchTab('record'));
        bind('nav-tab-cellar', 'click', () => UI.switchTab('cellar'));
        bind('nav-tab-settings', 'click', () => UI.switchTab('settings'));

        bind('header-mode-select', 'change', (e) => {
            StateManager.setBeerMode(e.target.value);
            refreshUI();
        });

        // 初期値反映
        const modes = Store.getModes();
        const headerSel = document.getElementById('header-mode-select');
        if(headerSel && modes) {
            headerSel.options[0].text = modes.mode1 || 'Lager';
            headerSel.options[1].text = modes.mode2 || 'Ale';
            headerSel.value = StateManager.beerMode;
        }

        bind('btn-save-beer', 'click', () => {
            const data = getBeerFormData();
            const event = new CustomEvent('save-beer', { detail: data });
            document.dispatchEvent(event);
            toggleModal('beer-modal', false);
        });

        // 保存して次へ
        bind('btn-save-beer-next', 'click', () => {
            const data = getBeerFormData();
            const event = new CustomEvent('save-beer', { detail: data });
            document.dispatchEvent(event);
            
            showMessage('Saved! Ready for next.', 'success');
            resetBeerForm(true); // 日付維持
            const container = document.querySelector('#beer-modal .overflow-y-auto');
            if(container) container.scrollTop = 0;
        });
        
        bind('btn-search-untappd', 'click', searchUntappd);

// 運動記録の保存 (新規・編集対応)
        bind('btn-save-exercise', 'click', async () => {
            const date = document.getElementById('manual-date').value;
            const minutes = parseInt(document.getElementById('manual-minutes').value, 10);
            const key = document.getElementById('exercise-select').value;
            const applyBonus = document.getElementById('manual-bonus').checked;
            
            // ★追加: 編集IDの取得
            const idField = document.getElementById('editing-exercise-id');
            const editId = idField && idField.value ? parseInt(idField.value) : null;

            if (!date || !minutes || minutes <= 0) {
                showMessage('Date and Minutes are required.', 'error');
                return;
            }

            const data = {
                date,
                minutes,
                exerciseKey: key,
                applyBonus
            };

            if (editId) {
                // 更新処理 (dbを直接更新するか、Service経由で行う)
                // Service.updateExerciseLog がなければ db.logs.update を使用
                await db.logs.update(editId, {
                   timestamp: dayjs(date).valueOf(), // 日付が変わっている可能性
                   minutes: minutes,
                   exerciseKey: key,
                   // カロリー等の再計算が必要なため、Serviceを通すのが理想だが、
                   // 簡易的にはここで再計算ロジックを入れるか、Serviceにupdateを作る
                });
                
                // ※ 正確にはカロリー再計算が必要なので、一旦削除して登録し直すのが一番安全です
                await Service.deleteLog(editId);
                await Service.saveExerciseLog(data);
                
                showMessage('Workout Updated!', 'success');
            } else {
                // 新規作成
                await Service.saveExerciseLog(data);
                showMessage('Workout Logged!', 'success');
            }
            
            // フォームクリア
            document.getElementById('manual-minutes').value = '';
            idField.value = '';
            
            refreshUI();
        });

        bind('btn-save-check', 'click', () => {
            const date = document.getElementById('check-date').value;
            const isDryDay = !document.getElementById('check-is-dry').checked;
            const weight = document.getElementById('check-weight').value;
            const waistEase = document.getElementById('check-waistEase')?.checked || false;
            const footLightness = document.getElementById('check-footLightness')?.checked || false;
            const waterOk = document.getElementById('check-waterOk')?.checked || false;
            const fiberOk = document.getElementById('check-fiberOk')?.checked || false;
            const noHangover = document.getElementById('check-noHangover')?.checked || false;

            const detail = { date, isDryDay, weight, waistEase, footLightness, waterOk, fiberOk, noHangover };
            document.dispatchEvent(new CustomEvent('save-check', { detail }));
            toggleModal('check-modal', false);
        });

        bind('tab-beer-preset', 'click', () => switchBeerInputTab('preset'));
        bind('tab-beer-custom', 'click', () => switchBeerInputTab('custom'));
        
        const themeSel = document.getElementById('theme-input');
        if(themeSel) themeSel.addEventListener('change', (e) => {
            localStorage.setItem(APP.STORAGE_KEYS.THEME, e.target.value);
            applyTheme(e.target.value);
        });

        bind('heatmap-prev', 'click', () => {
            StateManager.setHeatmapOffset(StateManager.heatmapOffset + 1);
            refreshUI();
        });
        bind('heatmap-next', 'click', () => {
            if(StateManager.heatmapOffset > 0) {
                StateManager.setHeatmapOffset(StateManager.heatmapOffset - 1);
                refreshUI();
            }
        });

        const filters = document.getElementById('chart-filters');
        if(filters) {
            filters.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    StateManager.setChartRange(btn.dataset.range);
                    refreshUI();
                });
            });
        }
        
        bind('btn-timer-toggle', 'click', Timer.toggle);
        bind('btn-timer-finish', 'click', Timer.finish);
        
        bind('btn-fab-fixed', 'click', () => {
             openActionMenu(null); 
        });

        applyTheme(Store.getTheme());
    },

    switchTab: (tabId) => {
        document.querySelectorAll('.tab-content').forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none'; 
        });

        const target = document.getElementById(`tab-${tabId}`);
        if(target) {
            target.style.display = 'block';
            setTimeout(() => target.classList.add('active'), 10);
        }

        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('nav-pill-active'); 
            el.classList.add('p-3', 'hover:bg-base-100', 'dark:hover:bg-base-800', 'text-gray-400');
            const icon = el.querySelector('i');
            if(icon) icon.className = icon.className.replace('ph-fill', 'ph-bold'); 
        });

        const activeNav = document.getElementById(`nav-tab-${tabId}`);
        if(activeNav) {
            activeNav.classList.remove('p-3', 'hover:bg-base-100', 'dark:hover:bg-base-800', 'text-gray-400');
            activeNav.classList.add('nav-pill-active');
            const icon = activeNav.querySelector('i');
            if(icon) icon.className = icon.className.replace('ph-bold', 'ph-fill');
        }

        if (tabId === 'cellar') {
            updateLogListView(false); 
            UI.switchCellarView(StateManager.cellarViewMode || 'logs');
        } else if (tabId === 'home') {
            refreshUI();
        } else if (tabId === 'settings') {
            renderSettings(); 
        }
    },

    switchCellarView: (mode) => {
        StateManager.setCellarViewMode(mode);
        ['logs', 'stats', 'archives'].forEach(m => {
            const el = document.getElementById(`view-cellar-${m}`);
            const btn = document.getElementById(`btn-cellar-${m}`);
            if (el) el.classList.add('hidden');
            if (btn) {
                if (m === mode) {
                    btn.classList.add('bg-white', 'dark:bg-gray-700', 'text-indigo-600', 'dark:text-indigo-300', 'shadow-sm');
                    btn.classList.remove('text-gray-500', 'dark:text-gray-400', 'hover:bg-gray-200');
                } else {
                    btn.classList.remove('bg-white', 'dark:bg-gray-700', 'text-indigo-600', 'dark:text-indigo-300', 'shadow-sm');
                    btn.classList.add('text-gray-500', 'dark:text-gray-400', 'hover:bg-gray-200');
                }
            }
        });

        const activeEl = document.getElementById(`view-cellar-${mode}`);
        if (activeEl) {
            activeEl.classList.remove('hidden');
            (async () => {
                if (mode === 'stats') {
                    if(UI._fetchAllDataHandler) {
                        const { logs } = await UI._fetchAllDataHandler();
                        renderBeerStats(logs);
                    }
                } else if (mode === 'archives') {
                    renderArchives();
                }
            })();
        }
    },

    toggleTheme: () => {
        const current = localStorage.getItem(APP.STORAGE_KEYS.THEME) || 'system';
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem(APP.STORAGE_KEYS.THEME, next);
        applyTheme(next);
    },
    
    deleteLog: (id) => Service.deleteLog(id),
    editLog: async (id) => {
        if (StateManager.isEditMode) return;

        const log = await db.logs.get(id);
        if(!log) return;
        
        // 編集モード確認は不要（タップで編集、長押し選択のUXの場合）
        // ここでは即編集モーダルへ
        if(log.type === 'beer') {
            openBeerModal(null, dayjs(log.timestamp).format('YYYY-MM-DD'), log);
        } else if(log.type === 'exercise') {
            // ★修正: 第2引数に log を渡して、編集モードで開く
            openManualInput(null, log);
        }
    },

    updateBulkCount: updateBulkCount,
    
    openBeerModal: (e, d) => openBeerModal(e, d),
    openCheckModal: openCheckModal,
    openManualInput: openManualInput,
    renderSettings: renderSettings, 
    openHelp: openHelp,
    closeModal: closeModal,
    adjustBeerCount: adjustBeerCount,
    toggleEditMode: toggleEditMode,
    toggleSelectAll: toggleSelectAll,
    switchCellarViewHTML: (mode) => UI.switchCellarView(mode),
    
    openTimer: openTimer,
    closeTimer: closeTimer,
    refreshUI: refreshUI,
    
    showConfetti: showConfetti,
    showMessage: showMessage,
    
    openActionMenu: openActionMenu,
    handleActionSelect: handleActionSelect,
    
    // ★追加: これがないとDataManagerからの呼び出しでエラーになる
    updateModeSelector: updateModeSelector 
};

export { 
    renderBeerTank, 
    renderLiverRank, 
    renderCheckStatus, 
    renderWeeklyAndHeatUp, 
    renderChart, 
    updateLogListView, 
    updateModeSelector, 
    updateBeerSelectOptions,
    StateManager,
    toggleModal
};