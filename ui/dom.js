import { APP } from '../constants.js';
import confetti from 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/+esm';

export const DOM = {
    isInitialized: false,
    elements: {},
    init: () => {
        if (DOM.isInitialized) return;
        
        const ids = [
            // --- Modals & Inputs (Existing v3) ---
            'message-box', 'drinking-section', 
            'beer-date', 'beer-select', 'beer-size', 'beer-count',
            'beer-input-preset', 'beer-input-custom',
            'custom-abv', 'custom-amount', 
            'tab-beer-preset', 'tab-beer-custom',
            'check-date', 'check-weight', 
            'manual-exercise-name', 'manual-date', 
            'weight-input', 'height-input', 'age-input', 'gender-input',
            'setting-mode-1', 'setting-mode-2', 'setting-base-exercise', 'theme-input','setting-default-record-exercise',
            'home-mode-select', 
            
            // --- New v4 Orb Mapping ---
            // 'tank-liquid' は JS(beerTank.js) が高さを操作する対象。
            // v4では front liquid を操作対象としてマッピングする。
            'tank-liquid',      // Maps to #orb-liquid-front
            'tank-liquid-back', // New: Maps to #orb-liquid-back (for future parity)
            
            'tank-empty-icon', 
            'tank-cans',        // Maps to the new balance display text
            'tank-minutes',     // Maps to the minutes text
            'tank-message',     // Maps to the message area below orb

            // --- Log List & History ---
            'log-list', 'history-base-label',

            // --- Rank & Check ---
            'liver-rank-card', 'rank-title', 'dry-count', 'rank-progress', 'rank-next-msg',
            'check-status', 
            
            // --- Weekly / Heatmap ---
            'streak-count', 'streak-badge',
            'heatmap-grid', 'heatmap-period-label', 'heatmap-prev', 'heatmap-next',
            'balanceChart', 'chart-filters',

            // --- Modals (Outer) ---
            'beer-modal', 'check-modal', 'exercise-modal', 'settings-modal', 'profile-modal', 'log-detail-modal', 'help-modal',
            'global-error-overlay', 'error-details', 'swipe-coach-mark'
        ];

        // IDマッピングの実行
        ids.forEach(id => {
            const el = document.getElementById(id);
            // v4への移行期間中、一部IDが存在しない場合があるため警告は出さない
            if (el) DOM.elements[id] = el;
            
            // v4マッピング補完: tank-liquid が見つからない場合(IDが変わった場合)、orb-liquid-frontを探す
            if (id === 'tank-liquid' && !el) {
                DOM.elements['tank-liquid'] = document.getElementById('orb-liquid-front');
            }
        });

        DOM.isInitialized = true;
    }
};

// --- 以下、既存のHelper関数群は変更なし ---
export const escapeHtml = (str) => {
    if(typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
};

export const toggleModal = (modalId, show = true) => {
    const el = DOM.elements[modalId] || document.getElementById(modalId);
    if (!el) return;
    
    if (show) {
        el.classList.remove('hidden');
        el.classList.add('flex');
        setTimeout(() => {
            el.querySelector('div[class*="transform"]')?.classList.remove('scale-95', 'opacity-0');
            el.querySelector('div[class*="transform"]')?.classList.add('scale-100', 'opacity-100');
        }, 10);
    } else {
        el.querySelector('div[class*="transform"]')?.classList.remove('scale-100', 'opacity-100');
        el.querySelector('div[class*="transform"]')?.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            el.classList.add('hidden');
            el.classList.remove('flex');
        }, 200);
    }
};

export const showConfetti = () => {
    confetti({
        particleCount: 100, spread: 70, origin: { y: 0.6 },
        colors: ['#FBBF24', '#F59E0B', '#FFFFFF']
    });
};

export const showMessage = (text, type = 'info') => {
    const box = DOM.elements['message-box'] || document.getElementById('message-box');
    if (!box) return; // ガード

    box.textContent = text;
    box.className = `fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full shadow-lg z-[9999] transition-all duration-300 text-sm font-bold flex items-center gap-2 ${
        type === 'error' ? 'bg-red-500 text-white' : 
        type === 'success' ? 'bg-emerald-500 text-white' : 
        'bg-indigo-600 text-white'
    }`;
    
    box.classList.remove('translate-y-[-150%]', 'opacity-0');
    
    setTimeout(() => {
        box.classList.add('translate-y-[-150%]', 'opacity-0');
    }, 3000);
};

export const toggleDryDay = (isDry) => {
    const section = document.getElementById('drinking-section');
    if (!section) return;

    const label = section.querySelector('span');
    const hint = section.querySelector('p');

    // 以前の状態をリセット
    section.classList.remove('bg-orange-50', 'border-orange-100', 'bg-emerald-50', 'border-emerald-100');
    if (label) label.classList.remove('text-orange-800', 'text-emerald-800');
    if (hint) hint.classList.remove('text-orange-600/70', 'text-emerald-600/70');

    if (isDry) {
        // --- 休肝日モード (Green) ---
        section.classList.add('bg-emerald-50', 'border-emerald-100');
        if (label) label.classList.add('text-emerald-800');
        if (hint) {
            hint.classList.add('text-emerald-600/70');
            hint.textContent = "Great! Keeping your liver healthy. ✨";
        }
    } else {
        // --- 飲酒モード (Orange) ---
        section.classList.add('bg-orange-50', 'border-orange-100');
        if (label) label.classList.add('text-orange-800');
        if (hint) {
            hint.classList.add('text-orange-600/70');
            hint.textContent = "Switch ON if you didn't drink alcohol.";
        }
    }
};

export const applyTheme = (themeName) => {
    const root = document.documentElement;
    let isDark = themeName === 'dark';

    // System設定の場合の判定
    if (themeName === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // 1. HTMLタグのクラス切り替え
    if (isDark) {
        root.classList.add('dark');
        root.classList.remove('light'); // lightクラスがある場合も除去
    } else {
        root.classList.remove('dark');
        root.classList.add('light'); // 明示的にlightを入れる（Tailwind設定次第だが安全策）
    }

    // 2. アイコンの切り替え (新規追加)
    // index.html でアイコンに id="theme-icon" を振った前提
    const icon = document.getElementById('theme-icon');
    if (icon) {
        if (isDark) {
            // ダークモード: 黄色い月
            icon.className = 'ph-fill ph-moon-stars text-lg text-yellow-400 transition-colors';
        } else {
            // ライトモード: オレンジの太陽
            icon.className = 'ph-fill ph-sun text-lg text-orange-500 transition-colors';
        }
    }
};