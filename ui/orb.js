import { APP, CALORIES, BEER_COLORS, STYLE_COLOR_MAP } from '../constants.js';
import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { StateManager } from './state.js';
import { DOM, escapeHtml } from './dom.js';

/**
 * Liquid Orb Rendering Logic
 * デザインガイドライン 1.2 "Logic Inversion" 準拠
 * - 借金 (balance < 0): 液体が増える (Fill)
 * - 貯金 (balance >= 0): 液体が減る/消える (Drain -> Zen Mode)
 */
export function renderOrb(currentBalanceKcal) {
    const profile = Store.getProfile();
    const settings = {
        modes: Store.getModes(),
        baseExercise: Store.getBaseExercise()
    };

    // DOM Elements
    const elements = {
        liquidFront: document.getElementById('orb-liquid-front'),
        liquidBack: document.getElementById('orb-liquid-back'),
        balanceVal: document.getElementById('balance-val'),
        statusText: document.getElementById('status-text'),
        redemptionBtn: document.getElementById('btn-redemption'),
        redemptionText: document.getElementById('redemption-text'),
        orbContainer: document.querySelector('.fluid-sphere')
    };

    if (!elements.liquidFront || !elements.balanceVal) return;

    // 1. Calculate Debt & Capacity
    // 借金(負の値)を正の数として扱う
    const debt = currentBalanceKcal < 0 ? Math.abs(currentBalanceKcal) : 0;
    const isSavings = currentBalanceKcal >= 0;

    // 現在のモード（スタイル）に応じた基準カロリーを取得
    const currentMode = StateManager.beerMode || 'mode1'; // 'mode1' or 'mode2'
    const targetStyle = currentMode === 'mode1' ? settings.modes.mode1 : settings.modes.mode2;
    const unitKcal = CALORIES.STYLES[targetStyle] || 140; 
    
    const maxCapacityKcal = unitKcal * APP.TANK_MAX_CANS; 
    
    // 液体充填率
    let fillRatio = Math.min(debt / maxCapacityKcal, 1.0);
    if (debt > 0 && fillRatio < 0.05) fillRatio = 0.05; 

    // 2. Liquid Animation
    // Debt Mode: 100% (Empty) -> 0% (Full)
    // Savings Mode: 110% (Completely Empty/Hidden)
    const topPos = isSavings ? 110 : Math.round((1 - fillRatio) * 100);
    
    // スタイルに応じた液色の取得
    const colorKey = STYLE_COLOR_MAP[targetStyle] || 'gold';
    const liquidStyle = BEER_COLORS[colorKey] || BEER_COLORS['gold'];

    requestAnimationFrame(() => {
        // --- 液体制御 ---
        elements.liquidFront.style.top = `${topPos}%`;
        elements.liquidBack.style.top = `${topPos}%`;
        elements.liquidFront.style.background = liquidStyle;
        
        // --- 数値表示 ---
        const sign = currentBalanceKcal > 0 ? '+' : '';
        elements.balanceVal.textContent = `${sign}${Math.round(currentBalanceKcal)}`;
        
        elements.balanceVal.className = `text-5xl font-black tracking-tighter transition-colors ${
            isSavings ? 'text-emerald-500 dark:text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'text-gray-800 dark:text-white'
        }`;

        // --- ステータス & Zen Mode Effect ---
        const orbWrapper = elements.orbContainer;

        if (isSavings) {
            // Zen Mode (Purified)
            elements.statusText.textContent = "Zen Mode 🧘";
            elements.statusText.className = "text-xs font-semibold text-emerald-500 animate-pulse";
            
            // Orb Glow Effect
            // Tailwindのクラス操作で光彩効果を追加
            if (orbWrapper) {
                // 既存の影を上書きするような強いGlow
                orbWrapper.classList.add('shadow-[0_0_50px_rgba(16,185,129,0.3)]', 'brightness-110');
                
                // 背景にパーティクル演出用クラスを追加 (CSS側で対応が必要だが、ここではJSで簡易対応)
                if (!document.getElementById('zen-particles')) {
                    const particles = document.createElement('div');
                    particles.id = 'zen-particles';
                    particles.className = "absolute inset-0 z-0 pointer-events-none";
                    // 簡易的な光の粒
                    particles.innerHTML = `
                        <div class="absolute top-1/4 left-1/4 w-2 h-2 bg-emerald-400 rounded-full blur-[1px] animate-[ping_3s_infinite]"></div>
                        <div class="absolute top-3/4 right-1/4 w-1 h-1 bg-white rounded-full blur-[0px] animate-[ping_4s_infinite_1s]"></div>
                    `;
                    orbWrapper.appendChild(particles);
                }
            }

            // 提案ボタン
            if (elements.redemptionText) elements.redemptionText.textContent = "Maintain this flow!";
            if (elements.redemptionBtn) {
                const iconContainer = elements.redemptionBtn.querySelector('div.rounded-full');
                if (iconContainer) iconContainer.className = "w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500";
            }

        } else {
            // Debt Mode
            const debtCans = (debt / unitKcal).toFixed(1);
            elements.statusText.textContent = `${targetStyle} ${debtCans}杯分`;
            elements.statusText.className = "text-xs font-semibold text-accent";

            // Remove Zen Effects
            if (orbWrapper) {
                orbWrapper.classList.remove('shadow-[0_0_50px_rgba(16,185,129,0.3)]', 'brightness-110');
                const p = document.getElementById('zen-particles');
                if (p) p.remove();
            }

            // 罪滅ぼし提案
            const suggestion = Calc.getRedemptionSuggestion(currentBalanceKcal, profile);
            if (suggestion && elements.redemptionText) {
                elements.redemptionText.textContent = `${suggestion.label} ${suggestion.mins} min`;
                
                if (elements.redemptionBtn) {
                    const iconEl = elements.redemptionBtn.querySelector('i');
                    if (iconEl) {
                        iconEl.className = "ph-fill ph-sneaker-move text-xl"; 
                    }
                    const iconContainer = elements.redemptionBtn.querySelector('div.rounded-full');
                    if (iconContainer) iconContainer.className = "w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500";
                }
            }
        }
    });
}