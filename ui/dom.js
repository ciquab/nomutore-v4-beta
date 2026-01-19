import { APP } from '../constants.js';
import confetti from 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/+esm';

// Web Share APIラッパー
const shareContent = async (text) => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Nomutore Log',
                text: text,
                // url: window.location.href // PWAのURLを含める場合はここ
            });
        } catch (err) {
            console.log('Share canceled or failed', err);
        }
    } else {
        // Fallback: クリップボードコピー
        navigator.clipboard.writeText(text).then(() => {
            alert('クリップボードにコピーしました！SNSに貼り付けてください。');
        });
    }
};

export const DOM = {
    isInitialized: false,
    elements: {},
    init: () => {
        if (DOM.isInitialized) return;
        
        const ids = [
            // --- Modals & Inputs ---
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
            
            'tank-liquid', 'tank-liquid-back',
            'tank-empty-icon', 'tank-cans', 'tank-minutes', 'tank-message',

            'log-list', 'history-base-label',

            'liver-rank-card', 'rank-title', 'dry-count', 'rank-progress', 'rank-next-msg',
            'check-status', 
            
            'streak-count', 'streak-badge',
            'heatmap-grid', 'heatmap-period-label', 'heatmap-prev', 'heatmap-next',
            'balanceChart', 'chart-filters',

            // --- Modals (Outer) ---
            'beer-modal', 'check-modal', 'exercise-modal', 'settings-modal', 'help-modal',
            'global-error-overlay', 'error-details', 'swipe-coach-mark',
            'check-library-modal', // ★追加
            'action-menu-modal'    // ★追加
        ];

        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) DOM.elements[id] = el;
            if (id === 'tank-liquid' && !el) {
                DOM.elements['tank-liquid'] = document.getElementById('orb-liquid-front');
            }
        });

        DOM.isInitialized = true;
    }
};

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

// --- Phase 1.5 Update: Action Button Support ---
export const showMessage = (text, type = 'info', action = null) => {
    const box = DOM.elements['message-box'] || document.getElementById('message-box');
    if (!box) return;

    // 基本スタイル
    const baseClass = "fixed top-6 left-1/2 transform -translate-x-1/2 pl-6 pr-2 py-2 rounded-full shadow-lg z-[9999] transition-all duration-300 text-sm font-bold flex items-center gap-3";
    let colorClass = 'bg-indigo-600 text-white';
    if (type === 'error') colorClass = 'bg-red-500 text-white';
    if (type === 'success') colorClass = 'bg-emerald-500 text-white';

    box.className = `${baseClass} ${colorClass}`;
    
    // コンテンツ生成 (テキスト + 任意のボタン)
    let content = `<span>${text}</span>`;
    
    // シェアボタンの追加
    if (action && action.type === 'share') {
        const shareText = action.text || text;
        // onclick属性に直接関数を入れるため、一意なIDでイベントリスナーを後付けする
        const btnId = `msg-btn-share-${Date.now()}`;
        content += `
            <button id="${btnId}" class="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full text-xs transition flex items-center gap-1">
                <i class="ph-bold ph-share-network"></i> Share
            </button>
        `;
        
        // メッセージ表示後にイベントバインド
        setTimeout(() => {
            const btn = document.getElementById(btnId);
            if(btn) {
                btn.onclick = () => shareContent(shareText);
            }
        }, 0);
    } else {
        // ボタンがない場合はpaddingを調整 (右側も広く)
        box.className = box.className.replace('pr-2', 'pr-6');
    }

    box.innerHTML = content;
    
    // 表示アニメーション
    box.classList.remove('translate-y-[-150%]', 'opacity-0');
    
    // 自動非表示 (ボタンがある場合は少し長く)
    setTimeout(() => {
        box.classList.add('translate-y-[-150%]', 'opacity-0');
    }, action ? 5000 : 3000);
};

export const toggleDryDay = (isDry) => {
    const section = document.getElementById('drinking-section');
    if (!section) return;

    const label = section.querySelector('span');
    const hint = section.querySelector('p');

    section.classList.remove('bg-orange-50', 'border-orange-100', 'bg-emerald-50', 'border-emerald-100');
    if (label) label.classList.remove('text-orange-800', 'text-emerald-800');
    if (hint) hint.classList.remove('text-orange-600/70', 'text-emerald-600/70');

    if (isDry) {
        section.classList.add('bg-emerald-50', 'border-emerald-100');
        if (label) label.classList.add('text-emerald-800');
        if (hint) {
            hint.classList.add('text-emerald-600/70');
            hint.textContent = "Great! Keeping your liver healthy. ✨";
        }
    } else {
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

    if (themeName === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
        root.classList.add('dark');
        root.classList.remove('light');
    } else {
        root.classList.remove('dark');
        root.classList.add('light');
    }

    const icon = document.getElementById('theme-icon');
    if (icon) {
        if (isDark) {
            icon.className = 'ph-fill ph-moon-stars text-lg text-yellow-400 transition-colors';
        } else {
            icon.className = 'ph-fill ph-sun text-lg text-orange-500 transition-colors';
        }
    }
};