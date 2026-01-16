import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { DOM, toggleModal, showConfetti, showMessage, applyTheme, toggleDryDay } from './dom.js';
import { StateManager } from './state.js';

// --- UI Modules ---
// v4: BeerTank -> Orb に変更
import { updateOrb } from './orb.js'; 

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
    // 外部APIハンドラ (LogListモジュールへ委譲)
    setFetchLogsHandler: (fn) => { setFetchLogsHandler(fn); },

    _fetchAllDataHandler: null,
    setFetchAllDataHandler: (fn) => { UI._fetchAllDataHandler = fn; },

    getTodayString: () => dayjs().format('YYYY-MM-DD'),

    // DOM/Utility (dom.jsより)
    initDOM: () => {
        DOM.init();
        UI.setupGlobalEventListeners();
    },
    
    // イベント設定ロジック (既存維持)
    setupGlobalEventListeners: () => {
        // ログリストのエンプティステート内のボタン
        const logListEl = document.getElementById('log-list');
        if (logListEl) {
            logListEl.addEventListener('click', (e) => {
                const triggerBtn = e.target.closest('[data-action="trigger-beer-modal"]');
                if (triggerBtn) {
                    openBeerModal(null);
                }
            });
        }

        // 週間スタンプのクリックイベント
        const weeklyStampsEl = document.getElementById('weekly-calendar'); // ID修正: weekly-stamps -> weekly-calendar (v4)
        if (weeklyStampsEl) {
            weeklyStampsEl.addEventListener('click', (e) => {
                const cell = e.target.closest('[data-date]');
                if (cell) {
                    // 日付クリックでその日の詳細を開くなどの拡張余地
                    // 現状は既存動作(特になし)またはBeerModalを開く挙動があれば維持
                }
            });
        }
    },

    toggleModal,
    showConfetti,
    showMessage,
    applyTheme,
    toggleDryDay,

    // StateManager
    StateManager,

    // LogList
    updateLogListView, 
    toggleEditMode,
    toggleSelectAll,
    updateBulkCount,

    // Modal/Form
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
        
        const select = DOM.elements['home-mode-select'];
        if (select && select.value !== mode) {
            select.value = mode;
        }

        // v4: 古い tank-liquid へのクラス操作は削除 (orb.jsが描画時にスタイルを決定するため不要)
        refreshUI();
    },

    // v4対応: タブ切り替えロジック
    switchTab: (tabId) => {
        // IDマッピング: 古いID (main.js等からの呼び出し) を新しいIDに変換
        // tab-history -> tab-cellar
        // tab-record -> (廃止: record-menuへ) -> tab-home にフォールバック
        const mapping = {
            'tab-history': 'tab-cellar',
            'history': 'tab-cellar',
            'cellar': 'tab-cellar',
            'tab-record': 'tab-home', // 記録タブはないのでホームへ
            'record': 'tab-home',
            'tab-home': 'tab-home',
            'home': 'tab-home'
        };

        const targetId = mapping[tabId] || tabId;
        const targetTab = document.getElementById(targetId);
        
        // ナビゲーションアイコンのIDを作成 (tab-home -> nav-home)
        const navId = targetId.replace('tab-', 'nav-');
        const targetNav = document.getElementById(navId);

        if (!targetTab) return;
    
        // 1. タブコンテンツの表示切り替え
        document.querySelectorAll('.tab-content').forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('block'); // v4betaではblock/hiddenで制御
        });
        targetTab.classList.remove('hidden');
        targetTab.classList.add('block');
        
        // 2. ナビゲーションアイコンのスタイル切り替え
        // v4: active = text-accent, inactive = text-slate-500
        document.querySelectorAll('nav button').forEach(btn => { 
            // アイコン色リセット
            btn.classList.remove('text-accent');
            btn.classList.add('text-slate-500', 'hover:text-slate-300');
        });

        if (targetNav) {
            targetNav.classList.remove('text-slate-500', 'hover:text-slate-300');
            targetNav.classList.add('text-accent');
        }
        
        // 3. 履歴タブを開いた時のみリスト更新
        if (targetId === 'tab-cellar') {
            updateLogListView(false); // リセットして読み込み
            refreshUI(); 
        }
        
        // 4. スクロール位置リセット
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.scrollTo(0, 0);
        } else {
            window.scrollTo(0, 0);
        }
    }
};

// 画面一括更新
export const refreshUI = async () => {
    // 1. データ取得
    if (!UI._fetchAllDataHandler) {
        console.warn("UI._fetchAllDataHandler is not set.");
        return;
    }
    
    // main.js から注入されたハンドラを実行
    const { logs, checks } = await UI._fetchAllDataHandler();
    
    // プロフィール取得
    const profile = Store.getProfile();

    // 2. カロリー収支計算
    const currentKcalBalance = logs.reduce((sum, l) => {
        const val = l.kcal !== undefined ? l.kcal : (l.minutes * Calc.burnRate(6.0, profile));
        return sum + val;
    }, 0);

    // 3. 各コンポーネントの描画
    updateOrb(currentKcalBalance); // v4: オーブ更新 (renderBeerTankから変更)
    
    renderLiverRank(checks, logs);
    renderCheckStatus(checks, logs);
    renderWeeklyAndHeatUp(logs, checks);
    renderQuickButtons(logs); // modal.js内の関数だが、DOMがあれば描画される
    renderChart(logs, checks);
    
    // 4. ログリストのリセット (無限スクロールの頭出し)
    // ※ 無限ループ防止のため、現在のアクティブタブがCellarの場合のみ更新する手もあるが、
    // ここではデータの整合性を優先して呼び出す（内部でLogLoadingフラグ判定あり）
    await updateLogListView(false);

    // 5. ヒートマップ描画
    renderHeatmap(checks, logs);

    // 6. 入力サジェスト更新
    updateInputSuggestions(logs);
};

// 個別にexportするもの
export { StateManager, updateBeerSelectOptions, toggleModal };