import { APP } from '../constants.js';
import confetti from 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/+esm';

export const DOM = {
    isInitialized: false,
    elements: {},
    init: () => {
        if (DOM.isInitialized) return;
        
        const ids = [
            // --- v4 Core: Orb & Status ---
            'balance-val', 'status-text',
            'orb-liquid-front', 'orb-liquid-back',
            'action-trigger', 'record-menu', 'close-record-menu', 'menu-items',
            'swipe-coach-mark',
            
            // --- v4 Navigation & Tabs ---
            'tab-home', 'tab-cellar',
            'nav-home', 'nav-cellar',
            
            // --- Dashboard Widgets ---
            'liver-rank-card', 'rank-title', 'dry-count', 'rank-progress', 'rank-next-msg',
            'check-status', 
            'weekly-calendar', 'streak-count', 'streak-badge',
            'chart-container', 'balanceChart', 'chart-filters',

            // --- Modal: Beer Record ---
            'beer-modal', 'beer-form',
            'beer-date', 'beer-select', 'beer-size', 'beer-count',
            'beer-input-preset', 'beer-input-custom',
            'custom-abv', 'custom-amount', 'beer-brewery', 'beer-brand',
            'beer-rating', 'beer-memo', 'untappd-check', 'beer-submit-btn', 'btn-save-next',
            'tab-beer-preset', 'tab-beer-custom',

            // --- Modal: Manual Exercise (with Timer) ---
            'manual-exercise-modal', 'manual-exercise-form',
            'manual-date', 'exercise-select', 'manual-exercise-name', 'manual-minutes',
            'manual-apply-bonus', 'btn-submit-manual',
            // Timer Elements
            'timer-display', 'timer-controls',
            'start-stepper-btn', 'pause-stepper-btn', 
            'resume-stepper-btn', 'stop-stepper-btn',

            // --- Modal: Check (Condition) ---
            'check-modal', 'check-form',
            'check-date', 'check-weight', 'is-dry-day',
            'drinking-section', 'check-submit-btn',

            // --- Modal: Settings ---
            'settings-modal',
            'height-input', 'weight-input', 'age-input', 'gender-input',
            'setting-base-exercise', 'setting-default-record-exercise', 'theme-input',
            'setting-mode-1', 'setting-mode-2', 'home-mode-select',
            'btn-save-settings',

            // --- Modal: Log Detail ---
            'log-detail-modal',
            'detail-icon', 'detail-title', 'detail-beer-info', 'detail-minutes', 'detail-date',
            'detail-style', 'detail-size', 'detail-brand',
            'detail-memo-container', 'detail-rating', 'detail-memo',
            'btn-detail-edit', 'btn-detail-copy', 'btn-detail-delete',

            // --- Modal: Help ---
            'help-modal',

            // --- Cellar (History) ---
            'log-list', 'log-container', 'history-base-label',
            'btn-toggle-edit-mode', 'btn-select-all',
            'bulk-action-bar', 'btn-bulk-delete', 'bulk-selected-count',

            // --- Heatmap (Inject Targets) ---
            'heatmap-wrapper', 'heatmap-grid', 'heatmap-prev', 'heatmap-next', 'heatmap-period-label',

            // --- Overlays & Others ---
            'global-error-overlay', 'global-error-message', 'message-box',
            'btn-open-settings', 'btn-open-help',
            
            // --- Export/Import ---
            'btn-export-logs', 'btn-export-checks', 'btn-copy-data', 
            'btn-download-json', 'btn-import-json', 'btn-reset-all'
        ];

        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                DOM.elements[id] = el;
            } else {
                // 開発時デバッグ用 (本番では無視)
                // console.warn(`[DOM] Element not found: #${id}`);
            }
        });

        // 必須機能の復元: 不足しているDOM要素をJS側で注入する
        injectPresetAbvInput();     // 度数入力欄の復元
        injectHeatmapContainer();   // ヒートマップの復元

        DOM.isInitialized = true;
    },

    // 簡易的なトースト表示
    showMessage: (msg, type = 'info') => {
        // v4betaのデザインに合わせたトーストを生成・表示
        let mb = document.getElementById('message-box');
        if (!mb) {
            mb = document.createElement('div');
            mb.id = 'message-box';
            document.body.appendChild(mb);
        }
        
        const bgColor = type === 'error' ? 'bg-red-500/90' : 'bg-emerald-500/90';
        mb.className = `fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-3 text-white rounded-full shadow-2xl z-[150] text-center font-bold text-sm backdrop-blur-md transition-all duration-300 ${bgColor}`;
        mb.textContent = msg;
        mb.classList.remove('hidden', 'opacity-0', '-translate-y-full');
        
        // 3秒後に消える
        setTimeout(() => {
            mb.classList.add('opacity-0', '-translate-y-full');
            setTimeout(() => mb.classList.add('hidden'), 300);
        }, 3000);
    },

    toggleModal: (modalId, show) => {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        if (show) {
            modal.classList.remove('hidden');
            // アニメーション用のクラス操作などが必要ならここに追加
        } else {
            modal.classList.add('hidden');
        }
    },
    
    // Confetti Effect
    showConfetti: () => {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FBBF24', '#34D399', '#60A5FA']
        });
    },

    // Dry Day Toggle Animation
    toggleDryDay: (cb) => {
        const section = document.getElementById('drinking-only-section');
        if (!section) return;

        if (cb.checked) {
            // 休肝日 ON: 飲酒対策項目(水分・野菜)は不要なので無効化
            section.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
            
            // 誤入力防止のため、内部のチェックも外す
            section.querySelectorAll('input[type="checkbox"]').forEach(input => {
                input.checked = false;
            });
        } else {
            // 休肝日 OFF (飲んだ): 入力可能にする
            section.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
        }
    },
    
    // Theme Application
    applyTheme: (theme) => {
        const html = document.documentElement;
        if (theme === 'dark') {
            html.classList.add('dark');
        } else if (theme === 'light') {
            html.classList.remove('dark');
        } else {
            // auto
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                html.classList.add('dark');
            } else {
                html.classList.remove('dark');
            }
        }
    },
    
    escapeHtml: (str) => {
        if(typeof str !== 'string') return str;
        return str.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m];
        });
    }
};

// --- 復元された注入関数 ---

/**
 * プリセット入力モード時に「度数(%)」を入力する欄を動的に生成する。
 * これがないと、プリセット選択時に度数を微調整できない。
 */
export const injectPresetAbvInput = () => {
    // 挿入先: beer-size の親要素、または beer-input-preset 内
    const sizeSelect = DOM.elements['beer-size'] || document.getElementById('beer-size');
    if (!sizeSelect || document.getElementById('preset-abv-container')) return;

    const container = document.createElement('div');
    container.id = 'preset-abv-container';
    container.className = "mb-4"; // v4スタイルに合わせたマージン
    container.innerHTML = `
        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">
            度数 (ABV %) <span class="text-[10px] font-normal text-gray-400">※変更でカロリー自動補正</span>
        </label>
        <div class="relative">
            <input type="number" id="preset-abv" step="0.1" placeholder="5.0" 
                class="w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-lg dark:text-white outline-none focus:ring-2 focus:ring-brand-DEFAULT">
            <span class="absolute right-4 top-3.5 text-gray-400 font-bold">%</span>
        </div>
    `;

    // sizeSelect の親コンテナ(grid)の後ろ、あるいは適切な場所に挿入
    // ここでは単純に sizeSelect の親要素(div)の直後に挿入する
    const parentDiv = sizeSelect.closest('.grid'); 
    if (parentDiv && parentDiv.parentNode) {
        parentDiv.parentNode.insertBefore(container, parentDiv.nextSibling);
    } else if (sizeSelect.parentNode) {
        sizeSelect.parentNode.parentNode.insertBefore(container, sizeSelect.parentNode.nextSibling);
    }

    DOM.elements['preset-abv'] = document.getElementById('preset-abv');
};

/**
 * チャートの上に表示する「月間ヒートマップ（カレンダー）」のコンテナを生成する。
 * v4では「Weekly Rhythm」があるが、月間ビューも残す。
 */
export const injectHeatmapContainer = () => {
    const target = document.getElementById('chart-container');
    // すでに存在する場合や、ターゲットが無い場合はスキップ
    if (!target || document.getElementById('heatmap-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'heatmap-wrapper';
    wrapper.className = "mb-4 glass-panel rounded-2xl p-4"; // v4スタイル (glass-panel)
    
    wrapper.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Continuity (Month)</h3>
            <div class="flex items-center gap-2">
                <button id="heatmap-prev" class="p-1 hover:bg-white/10 rounded text-gray-400 active:scale-95 transition">◀</button>
                <span id="heatmap-period-label" class="text-[10px] font-bold text-gray-500">Last Month</span>
                <button id="heatmap-next" class="p-1 hover:bg-white/10 rounded text-gray-400 active:scale-95 transition" disabled>▶</button>
            </div>
        </div>
        
        <div id="heatmap-grid" class="grid grid-cols-7 gap-1 mb-3"></div>

        <div class="flex flex-wrap justify-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
            <div class="flex items-center"><span class="w-2 h-2 rounded-sm bg-emerald-500 mr-1"></span>休肝+運動</div>
            <div class="flex items-center"><span class="w-2 h-2 rounded-sm bg-green-400 mr-1"></span>休肝日</div>
            <div class="flex items-center"><span class="w-2 h-2 rounded-sm bg-blue-400 mr-1"></span>飲酒+運動</div>
            <div class="flex items-center"><span class="w-2 h-2 rounded-sm bg-red-400 mr-1"></span>飲酒のみ</div>
        </div>
    `;

    // チャートコンテナの直前に挿入
    target.parentNode.insertBefore(wrapper, target);
    
    // 追加した要素をDOMキャッシュに登録
    DOM.elements['heatmap-wrapper'] = wrapper;
    DOM.elements['heatmap-grid'] = document.getElementById('heatmap-grid');
    DOM.elements['heatmap-prev'] = document.getElementById('heatmap-prev');
    DOM.elements['heatmap-next'] = document.getElementById('heatmap-next');
    DOM.elements['heatmap-period-label'] = document.getElementById('heatmap-period-label');
};

// ヘルパー関数のエクスポート（後方互換性のため）
export const toggleModal = DOM.toggleModal;
export const showConfetti = DOM.showConfetti;
export const showMessage = DOM.showMessage;
export const applyTheme = DOM.applyTheme;
export const toggleDryDay = DOM.toggleDryDay;
export const escapeHtml = DOM.escapeHtml;