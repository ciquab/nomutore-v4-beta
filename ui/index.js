import { Calc } from '../logic.js';
import { Store } from '../store.js';
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
    openCheckModal, openManualInput, renderSettings, openHelp, openLogDetail, // ★修正: openSettings -> renderSettings
    updateModeSelector, updateBeerSelectOptions, updateInputSuggestions, renderQuickButtons,
    closeModal, adjustBeerCount, searchUntappd,
    openTimer, closeTimer 
} from './modal.js';

import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// refreshUI の定義
export const refreshUI = async () => {
    if (!UI._fetchAllDataHandler) return;
    
    // ロード開始
    const { logs, checks } = await UI._fetchAllDataHandler();
    
    // 今の期間の収支計算 (簡易)
    const profile = Store.getProfile();
    let balance = 0;
    logs.forEach(l => {
        balance += (l.kcal || 0);
    });
    
    // 各コンポーネントの描画
    renderBeerTank(balance);
    renderLiverRank(checks, logs);
    renderCheckStatus(checks, logs);
    renderWeeklyAndHeatUp(logs, checks);
    renderChart(logs, checks);
    
    // Cellar View Update
    const cellarMode = StateManager.cellarViewMode;
    if (cellarMode === 'logs') {
        updateLogListView();
    } else if (cellarMode === 'stats') {
        renderBeerStats(logs);
    } else if (cellarMode === 'archives') {
        renderArchives();
    }
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

        // Navigation
        bind('nav-tab-home', 'click', () => UI.switchTab('home'));
        bind('nav-tab-record', 'click', () => UI.switchTab('record'));
        bind('nav-tab-cellar', 'click', () => UI.switchTab('cellar'));
        bind('nav-tab-settings', 'click', () => UI.switchTab('settings'));

        // Modals
        bind('btn-save-beer', 'click', () => {
            const data = getBeerFormData();
            const event = new CustomEvent('save-beer', { detail: data });
            document.dispatchEvent(event);
            toggleModal('beer-modal', false);
        });
        
        bind('btn-search-untappd', 'click', searchUntappd);

        bind('btn-save-check', 'click', () => {
            const date = document.getElementById('check-date').value;
            const isDryDay = !document.getElementById('check-is-dry').checked;
            const weight = document.getElementById('check-weight').value;
            
            const waistEase = document.getElementById('check-waistEase')?.checked || false;
            const footLightness = document.getElementById('check-footLightness')?.checked || false;
            const waterOk = document.getElementById('check-waterOk')?.checked || false;
            const fiberOk = document.getElementById('check-fiberOk')?.checked || false;

            const detail = { date, isDryDay, weight, waistEase, footLightness, waterOk, fiberOk };
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
        
        // Timer Controls
        bind('btn-timer-toggle', 'click', Timer.toggle);
        bind('btn-timer-finish', 'click', Timer.finish);

        applyTheme(Store.getTheme());
    },

    switchTab: (tabId) => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none'); 

        const target = document.getElementById(`tab-${tabId}`);
        if(target) {
            target.style.display = 'block';
            setTimeout(() => target.classList.add('active'), 10);
        }

        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('nav-pill-active');
            el.classList.add('p-3');
        });
        const activeNav = document.getElementById(`nav-tab-${tabId}`);
        if(activeNav) {
            activeNav.classList.add('nav-pill-active');
            activeNav.classList.remove('p-3');
        }

        if (tabId === 'cellar') {
            updateLogListView(false); 
            UI.switchCellarView(StateManager.cellarViewMode || 'logs');
        } else if (tabId === 'home') {
            refreshUI();
        } else if (tabId === 'settings') {
            // ★修正: 設定タブに切り替わった時にレンダリング処理を呼ぶ
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
    
    openBeerModal: (e, d) => openBeerModal(e, d),
    openCheckModal: openCheckModal,
    openManualInput: openManualInput,
    renderSettings: renderSettings, // ★修正: openSettings -> renderSettings
    openHelp: openHelp,
    closeModal: closeModal,
    adjustBeerCount: adjustBeerCount,
    toggleEditMode: toggleEditMode,
    toggleSelectAll: toggleSelectAll,
    switchCellarViewHTML: (mode) => UI.switchCellarView(mode),
    
    // Timer
    openTimer: openTimer,
    closeTimer: closeTimer,
    
    refreshUI: refreshUI 
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