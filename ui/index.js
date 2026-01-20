import { Calc } from '../logic.js';
import { Store, db } from '../store.js';
import { Service } from '../service.js';
import { APP, CHECK_SCHEMA } from '../constants.js';
import { DOM, toggleModal, showConfetti, showMessage, applyTheme, toggleDryDay } from './dom.js';
import { StateManager } from './state.js';

import { renderBeerTank } from './beerTank.js';
import { renderLiverRank } from './liverRank.js';
import { renderCheckStatus } from './checkStatus.js';
import { renderWeeklyAndHeatUp, renderHeatmap } from './weekly.js';
import { renderChart } from './chart.js';
// 互換性のために維持
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
    openActionMenu, handleActionSelect,
    setupModalListeners // ★これが重要
} from './modal.js';

import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// UI Refresh Function
export const refreshUI = async () => {
    try {
        if (!DOM.isInitialized) DOM.init();

        // 1. データ取得
        const { logs, checks } = await Service.getAllDataForUI();
        
        // 2. 計算
        const profile = Store.getProfile();
        const currentBalance = logs.reduce((sum, l) => sum + (l.kcal || 0), 0);

        // 3. 描画
        renderBeerTank(currentBalance);
        renderLiverRank(checks, logs);
        renderCheckStatus(checks, logs);
        renderWeeklyAndHeatUp(logs, checks);
        renderChart(logs, checks);

        if (StateManager.cellarViewMode === 'logs') {
            updateLogListView();
        }

    } catch (e) {
        console.error("UI Refresh Failed:", e);
    }
};

// UI Main Controller
export const UI = {
    init: () => {
        DOM.init();
        setupModalListeners(); // ここで1回だけ確実にイベント設定する
    },

    switchTab: (tabId) => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
        
        const target = document.getElementById(`tab-${tabId}`);
        if(target) {
            target.style.display = 'block';
            requestAnimationFrame(() => target.classList.add('active'));
        }

        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('nav-pill-active');
            el.classList.add('text-gray-400');
        });
        
        const navBtn = document.getElementById(`nav-tab-${tabId}`);
        if(navBtn) {
            navBtn.classList.add('nav-pill-active');
            navBtn.classList.remove('text-gray-400');
        }
        
        if (tabId === 'cellar') {
            const mode = StateManager.cellarViewMode || 'logs';
            UI.switchCellarView(mode);
        } else if (tabId === 'settings') {
            renderSettings();
        } else if (tabId === 'home') {
            refreshUI(); 
        }
        
        const fab = document.getElementById('btn-fab-fixed');
        if(fab) {
            if(tabId === 'home') {
                fab.classList.remove('hidden', 'scale-0');
                fab.onclick = () => openActionMenu();
            } else {
                fab.classList.add('hidden', 'scale-0');
            }
        }
        
        window.scrollTo(0, 0);
    },

    switchCellarView: (mode) => {
        StateManager.cellarViewMode = mode;
        
        ['logs', 'stats', 'archives'].forEach(m => {
            const el = document.getElementById(`view-cellar-${m}`);
            const btn = document.getElementById(`btn-cellar-${m}`);
            if(el) el.classList.add('hidden');
            if(btn) {
                btn.classList.remove('bg-white', 'text-indigo-600', 'shadow-sm', 'dark:bg-gray-600', 'dark:text-white');
                btn.classList.add('text-gray-500');
            }
        });

        const targetEl = document.getElementById(`view-cellar-${mode}`);
        const targetBtn = document.getElementById(`btn-cellar-${mode}`);
        
        if(targetEl) targetEl.classList.remove('hidden');
        if(targetBtn) {
            targetBtn.classList.remove('text-gray-500');
            targetBtn.classList.add('bg-white', 'text-indigo-600', 'shadow-sm', 'dark:bg-gray-600', 'dark:text-white');
        }

        if (mode === 'logs') {
            updateLogListView();
        } else if (mode === 'stats') {
            Service.getAllDataForUI().then(({logs}) => {
                const start = Service.calculatePeriodStart(localStorage.getItem(APP.STORAGE_KEYS.PERIOD_MODE));
                const periodLogs = logs.filter(l => l.timestamp >= start);
                renderBeerStats(periodLogs, logs);
            });
        } else if (mode === 'archives') {
            renderArchives();
        }
    },

    applyTheme: applyTheme,
    toggleTheme: () => {
        const current = localStorage.getItem(APP.STORAGE_KEYS.THEME) || 'system';
        let next = 'system';
        if (current === 'system') next = 'light';
        else if (current === 'light') next = 'dark';
        else if (current === 'dark') next = 'system';
        
        localStorage.setItem(APP.STORAGE_KEYS.THEME, next);
        applyTheme(next);
        
        const modeName = next === 'system' ? 'System' : (next === 'light' ? 'Light' : 'Dark');
        showMessage(`Theme changed to ${modeName}`, 'success');
        
        const sel = document.getElementById('theme-input');
        if(sel) sel.value = next;
    },
    
    toggleDryDay: (checked) => toggleDryDay(checked),

    editLog: async (id) => {
        const log = await db.logs.get(id);
        if(!log) return;
        
        if(log.type === 'beer') {
            openBeerModal(null, dayjs(log.timestamp).format('YYYY-MM-DD'), log);
        } else if(log.type === 'exercise') {
            openManualInput(null, log);
        }
    },

    updateBulkCount: updateBulkCount,
    
    openBeerModal: (e, d, l) => openBeerModal(e, d, l),
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
    
    // 互換性維持
    setFetchAllDataHandler: (fn) => {}, 
    setFetchLogsHandler: (fn) => {},
};

export { 
    StateManager, 
    updateBeerSelectOptions, 
    // refreshUI, // UIオブジェクトでexport済み
    toggleModal, 
    renderBeerTank,
    renderLiverRank, 
    renderCheckStatus,
    renderWeeklyAndHeatUp,
    renderChart
};
