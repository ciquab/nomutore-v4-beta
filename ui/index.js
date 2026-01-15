import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { DOM, toggleModal, showConfetti, showMessage, applyTheme, toggleDryDay } from './dom.js';
import { StateManager } from './state.js';

// 各UIモジュール
import { renderOrb } from './orb.js'; // 【変更】beerTank.js -> orb.js
import { renderLiverRank } from './liverRank.js';
import { renderCheckStatus } from './checkStatus.js';
import { renderWeeklyAndHeatUp, renderHeatmap } from './weekly.js';
import { renderChart } from './chart.js';
import { updateLogListView, toggleEditMode, toggleSelectAll, updateBulkCount, setFetchLogsHandler } from './logList.js';
import { 
    getBeerFormData, resetBeerForm, openBeerModal, switchBeerInputTab, 
    openCheckModal, openManualInput, openSettings, openHelp, openLogDetail,
    updateModeSelector, updateBeerSelectOptions, updateInputSuggestions, renderQuickButtons
} from './modal.js';

import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// UI集約オブジェクト
export const UI = {
    setFetchLogsHandler: (fn) => { setFetchLogsHandler(fn); },

    _fetchAllDataHandler: null,
    setFetchAllDataHandler: (fn) => { UI._fetchAllDataHandler = fn; },

    getTodayString: () => dayjs().format('YYYY-MM-DD'),

    initDOM: () => {
        DOM.init();
        UI.setupGlobalEventListeners();
    },
    
    setupGlobalEventListeners: () => {
        const logListEl = document.getElementById('log-list');
        if (logListEl) {
            logListEl.addEventListener('click', (e) => {
                const triggerBtn = e.target.closest('[data-action="trigger-beer-modal"]');
                if (triggerBtn) {
                    openBeerModal(null);
                }
            });
        }
    },

    toggleModal,
    showConfetti,
    showMessage,
    applyTheme,
    toggleDryDay,

    StateManager,

    updateLogListView, 
    toggleEditMode,
    toggleSelectAll,
    updateBulkCount,

    getBeerFormData,
    resetBeerForm,
    openBeerModal,
    switchBeerInputTab,
    openCheckModal,
    openManualInput,
    openSettings,
    openHelp,
    openLogDetail,
    updateModeSelector,

    // Action (Main Logic)
    setBeerMode: (mode) => {
        StateManager.setBeerMode(mode); 
        // Orbの色更新などは renderOrb 内で行われるため、ここでは再描画トリガーのみ
        refreshUI();
    },

    switchTab: (tabId) => {
        // ... (Step 2.2の実装を維持) ...
        // ID Mapping: 'home' -> 'tab-home', 'cellar' -> 'tab-cellar'
        const fullId = tabId.startsWith('tab-') ? tabId : `tab-${tabId}`;
        const navId = tabId.startsWith('nav-') ? tabId : `nav-${tabId.replace('tab-', '')}`;
        
        const tabs = ['tab-home', 'tab-cellar'];
        const navs = ['nav-home', 'nav-cellar'];

        tabs.forEach(t => {
            const el = document.getElementById(t);
            if (el) {
                if (t === fullId) {
                    el.classList.remove('hidden');
                    el.style.opacity = '0';
                    requestAnimationFrame(() => el.style.opacity = '1');
                } else {
                    el.classList.add('hidden');
                }
            }
        });

        navs.forEach(n => {
            const el = document.getElementById(n);
            if (el) {
                if (n === navId) {
                    el.classList.remove('text-text-mutedDark', 'dark:text-text-muted');
                    el.classList.add('text-accent');
                } else {
                    el.classList.add('text-text-mutedDark', 'dark:text-text-muted');
                    el.classList.remove('text-accent');
                }
            }
        });

        if (fullId === 'tab-cellar') {
            updateLogListView(false); 
            refreshUI(); 
        }
        
        window.scrollTo(0, 0);
    }
};

// 画面一括更新
export const refreshUI = async () => {
    if (!UI._fetchAllDataHandler) return;
    const { logs, checks } = await UI._fetchAllDataHandler();
    const profile = Store.getProfile();

    const currentKcalBalance = logs.reduce((sum, l) => {
        const val = l.kcal !== undefined ? l.kcal : (l.minutes * Calc.burnRate(6.0, profile));
        return sum + val;
    }, 0);

    // 【変更】BeerTank -> Orb
    renderOrb(currentKcalBalance);
    
    renderLiverRank(checks, logs);
    renderCheckStatus(checks, logs);
    renderWeeklyAndHeatUp(logs, checks);
    // renderQuickButtons(logs); // v4ではHomeにボタンエリアがないため除外、またはCellarへ移動
    renderChart(logs, checks);
    
    await updateLogListView(false);
    updateInputSuggestions(logs);
};

export { StateManager, updateBeerSelectOptions, toggleModal };