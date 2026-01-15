import { APP } from '../constants.js';
import confetti from 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/+esm';

export const DOM = {
    isInitialized: false,
    elements: {},
    init: () => {
        if (DOM.isInitialized) return;
        
        // v4 ID Mapping (Craft & Flow Design)
        const ids = [
            // --- Header ---
            'header-period-label', 'header-day-label',
            'btn-notifications', 'btn-open-settings',
            
            // --- Tab: Home (Dashboard) ---
            'tab-home',
            'balance-val', 'status-text',
            'orb-liquid-front', 'orb-liquid-back',
            'redemption-text', 'btn-redemption',
            
            // Stats
            'rank-value', 'rank-label', 'rank-progress-bar', 'rank-next-text',
            'streak-value', 'streak-bonus-text',
            'weekly-rhythm-container',
            
            // --- Tab: Cellar (History) ---
            'tab-cellar',
            'cellar-total-count',
            'cellar-view-selector',
            'cellar-subview-logs', 'cellar-subview-beers', 'cellar-subview-archives',
            'log-list', 'cellar-grid', 'archive-list',

            // --- Navigation ---
            'nav-home', 'nav-cellar',
            'action-button', // Central FAB (Button itself inside floating dock)

            // --- Modals / Menus ---
            'record-menu', 'menu-items',
            'settings-modal', 'settings-content',
            
            // --- Inputs & Modal Elements (Legacy & New) ---
            'message-box',
            'beer-date', 'beer-select', 'beer-size', 'beer-count',
            'beer-input-preset', 'beer-input-custom',
            'custom-abv', 'custom-amount', 
            'tab-beer-preset', 'tab-beer-custom',
            'check-date', 'check-weight', 
            'manual-exercise-name', 'manual-date', 'manual-minutes', 'manual-apply-bonus',
            'weight-input', 'height-input', 'age-input', 'gender-input',
            'setting-mode-1', 'setting-mode-2', 'setting-base-exercise', 'theme-input', 'setting-default-record-exercise',
            'settings-profile-val',
            'theme-btn-dark', 'theme-btn-light',
            
            // Detail Modal
            'log-detail-modal', 'detail-icon', 'detail-title', 'detail-date', 'detail-minutes', 
            'detail-beer-info', 'detail-style', 'detail-size', 'detail-brand', 
            'detail-memo-container', 'detail-rating', 'detail-memo',
            'btn-detail-edit', 'btn-detail-delete', 'btn-detail-copy', 'btn-detail-share',
            
            // Action Buttons
            'beer-submit-btn', 'check-submit-btn', 'btn-submit-manual', 'btn-save-settings',
            'btn-toggle-edit-mode', 'bulk-action-bar', 'btn-bulk-delete', 'bulk-selected-count',
            'btn-select-all',
            
            // Forms
            'beer-form', 'check-form',
            'drinking-section', 'is-dry-day'
        ];

        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                DOM.elements[id] = el;
            } else {
                // Phase 2途中では一部要素が無い場合もあるためWarnに留める
                // console.warn(`[DOM.init] Element with id '${id}' not found.`);
            }
        });
    
        // プリセットABV入力欄の注入 (v3互換)
        injectPresetAbvInput();
        
        DOM.isInitialized = true;
    }
};

export const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]);
};

export const toggleModal = (id, show) => { 
    const el = document.getElementById(id);
    if (!el) return;

    if (show) {
        el.classList.remove('hidden');
        // アニメーション用のクラス操作 (v4 CSS依存)
        requestAnimationFrame(() => {
            el.classList.remove('opacity-0');
            const content = el.querySelector('.modal-content') || el.firstElementChild;
            if (content) {
                content.classList.remove('scale-95', 'translate-y-10');
                content.classList.add('scale-100', 'translate-y-0');
            }
        });
    } else {
        el.classList.add('opacity-0');
        const content = el.querySelector('.modal-content') || el.firstElementChild;
        if (content) {
            content.classList.remove('scale-100', 'translate-y-0');
            content.classList.add('scale-95', 'translate-y-10');
        }
        setTimeout(() => {
            el.classList.add('hidden');
        }, 300);
    }
};

export const showMessage = (msg, type) => {
    // v4ではトースト通知の場所やスタイルが変わる可能性があるが、一旦既存ロジックを使用
    // ただしDOMがない場合は作成する
    let mb = document.getElementById('message-box');
    if (!mb) {
        mb = document.createElement('div');
        mb.id = 'message-box';
        document.body.appendChild(mb);
    }
    
    mb.textContent = msg; 
    mb.className = `fixed top-6 left-1/2 transform -translate-x-1/2 px-4 py-2 text-white rounded-full shadow-lg z-[100] text-center font-bold text-sm transition-all duration-300 ${type === 'error' ? 'bg-red-500 shadow-red-500/30' : 'bg-emerald-500 shadow-emerald-500/30'}`;
    mb.classList.remove('hidden', 'opacity-0', '-translate-y-10');
    
    setTimeout(() => {
        mb.classList.add('opacity-0', '-translate-y-10');
        setTimeout(() => mb.classList.add('hidden'), 300);
    }, 3000);
};

export const showConfetti = () => {
    const duration = 2000;
    const end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#10B981', '#F59E0B', '#FBBF24']
        });
        confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#10B981', '#F59E0B', '#FBBF24']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
};

export const applyTheme = (theme) => {
    const root = document.documentElement;
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const darkBtn = document.getElementById('theme-btn-dark');
    const lightBtn = document.getElementById('theme-btn-light');
    
    let isDark = false;
    if (theme === 'dark' || (theme === 'system' && isSystemDark)) {
        root.classList.add('dark');
        isDark = true;
    } else {
        root.classList.remove('dark');
        isDark = false;
    }

    // Toggle Button Styles (v4)
    if (darkBtn && lightBtn) {
        const activeClass = "bg-base-800 text-white shadow-sm";
        const inactiveClass = "text-text-mutedDark dark:text-text-muted hover:bg-white dark:hover:bg-base-800";
        
        if (isDark) {
            darkBtn.className = `flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${activeClass}`;
            lightBtn.className = `flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${inactiveClass}`;
        } else {
            lightBtn.className = `flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 bg-white text-black shadow-sm`;
            darkBtn.className = `flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${inactiveClass}`;
        }
    }
};

export const toggleDryDay = (cb) => {
    const section = document.getElementById('drinking-section');
    if (section) {
        if (cb.checked) {
            section.classList.add('opacity-30', 'pointer-events-none');
        } else {
            section.classList.remove('opacity-30', 'pointer-events-none');
        }
    }
};

export const injectPresetAbvInput = () => {
    const sizeSelect = DOM.elements['beer-size'] || document.getElementById('beer-size');
    if (!sizeSelect || document.getElementById('preset-abv-container')) return;

    const container = document.createElement('div');
    container.id = 'preset-abv-container';
    container.className = "mb-4";
    container.innerHTML = `
        <label class="block text-text-mutedDark dark:text-text-muted text-xs font-bold mb-1.5 uppercase tracking-wide">
            ABV (%) <span class="text-[10px] font-normal text-gray-500 ml-1">Auto-calc calories</span>
        </label>
        <div class="relative">
            <input type="number" id="preset-abv" step="0.1" placeholder="5.0" 
                class="w-full p-3 bg-base-50 dark:bg-base-700 border border-base-200 dark:border-base-600 rounded-xl focus:ring-2 focus:ring-accent outline-none text-text-dark dark:text-white font-bold transition">
            <span class="absolute right-3 top-3 text-text-mutedDark dark:text-text-muted font-bold">%</span>
        </div>
    `;

    if(sizeSelect.parentNode && sizeSelect.parentNode.parentNode) {
            sizeSelect.parentNode.parentNode.insertBefore(container, sizeSelect.parentNode.nextSibling); 
    }
    DOM.elements['preset-abv'] = document.getElementById('preset-abv');
};