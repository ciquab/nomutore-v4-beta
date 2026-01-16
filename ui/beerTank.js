import { APP, EXERCISE } from '../constants.js';
import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { StateManager } from './state.js';
import { DOM, escapeHtml } from './dom.js';

export function renderBeerTank(currentBalanceKcal) {
    const profile = Store.getProfile();
    const settings = {
        modes: Store.getModes(),
        baseExercise: Store.getBaseExercise()
    };

    const { 
        canCount, 
        displayMinutes, 
        baseExData, 
        unitKcal, 
        targetStyle,
        liquidColor,
        isHazy 
    } = Calc.getTankDisplayData(currentBalanceKcal, StateManager.beerMode, settings, profile);

    const liquidFront = DOM.elements['tank-liquid'] || document.getElementById('orb-liquid-front');
    const liquidBack = DOM.elements['tank-liquid-back'] || document.getElementById('orb-liquid-back');
    const emptyIcon = DOM.elements['tank-empty-icon'] || document.getElementById('tank-empty-icon');
    const cansText = DOM.elements['tank-cans'] || document.getElementById('tank-cans');
    const minText = DOM.elements['tank-minutes'] || document.getElementById('tank-minutes');
    const msgContainer = DOM.elements['tank-message'] || document.getElementById('tank-message');
    const orbContainer = document.querySelector('.orb-container'); // Need explicit select
    
    if (!liquidFront || !liquidBack || !cansText || !minText || !msgContainer) return;
    
    let msgText = msgContainer.querySelector('p');
    if (!msgText) {
        msgText = document.createElement('p');
        msgContainer.appendChild(msgText);
    }

    requestAnimationFrame(() => {
        // --- Color & Hazy Effect ---
        liquidFront.style.background = liquidColor;
        liquidBack.style.background = liquidColor;
        
        if (isHazy) {
            liquidFront.style.filter = 'blur(1px) brightness(1.1)';
            liquidBack.style.filter = 'blur(2px) brightness(0.9)';
        } else {
            liquidFront.style.filter = 'none';
            liquidBack.style.filter = 'opacity(0.6)';
        }

        // --- Zen Mode Check (Positive Balance) ---
        if (orbContainer) {
            if (currentBalanceKcal >= 0) {
                orbContainer.classList.add('zen-mode');
            } else {
                orbContainer.classList.remove('zen-mode');
            }
        }

        let fillRatio = 0;

        if (currentBalanceKcal > 0) {
            emptyIcon.classList.add('hidden');
            const rawRatio = (canCount / APP.TANK_MAX_CANS) * 100;
            fillRatio = Math.max(5, Math.min(100, rawRatio));

            cansText.textContent = `+${canCount.toFixed(1)}`;
            cansText.className = "text-4xl font-black text-emerald-600 dark:text-emerald-400 drop-shadow-sm";
            
            const safeIcon = escapeHtml(baseExData.icon);
            minText.innerHTML = `+${Math.round(displayMinutes)} min <span class="text-[10px] font-normal opacity-70">(${safeIcon})</span>`;
            minText.className = 'text-sm font-bold text-emerald-600 dark:text-emerald-400';

            if (canCount < 0.5) {
                msgText.textContent = 'Good start! Keep going! 👍';
                msgText.className = 'text-sm font-bold text-emerald-600 dark:text-emerald-400';
            } else if (canCount < 2.0) {
                msgText.textContent = 'Great Condition! 🌿';
                msgText.className = 'text-sm font-bold text-emerald-600 dark:text-emerald-400 animate-pulse';
            } else {
                msgText.textContent = 'Perfect! You are GOD! 👼';
                msgText.className = 'text-sm font-bold text-purple-600 dark:text-purple-400 animate-bounce';
            }

        } else if (currentBalanceKcal < 0) {
            emptyIcon.classList.remove('hidden');
            fillRatio = 10; 

            cansText.textContent = canCount.toFixed(1);
            cansText.className = "text-4xl font-black text-red-500 dark:text-red-400 drop-shadow-sm";

            const safeIcon = escapeHtml(baseExData.icon);
            minText.innerHTML = `${Math.round(Math.abs(displayMinutes))} min <span class="text-[10px] font-normal opacity-70">to burn</span>`;
            minText.className = 'text-sm font-bold text-red-500 dark:text-red-400';
            
            const debtCansVal = Math.abs(canCount);
            if (debtCansVal > 1.5) {
                msgText.textContent = 'Heavy Debt... Move now! 😱';
                msgText.className = 'text-sm font-bold text-red-600 dark:text-red-400 animate-pulse';
            } else {
                msgText.textContent = `Recovery Needed... (${debtCansVal.toFixed(1)} cans) 💦`;
                msgText.className = 'text-sm font-bold text-orange-500 dark:text-orange-400';
            }

        } else {
            emptyIcon.classList.add('hidden');
            fillRatio = 50; 

            cansText.textContent = "0.0";
            cansText.className = "text-4xl font-black text-base-800 dark:text-white drop-shadow-sm";
            minText.textContent = "Perfect Balance";
            minText.className = "text-sm font-bold text-gray-400 dark:text-gray-500";
            msgText.textContent = "Ready for a drink? 🍺";
            msgText.className = "text-sm font-bold text-gray-400 dark:text-gray-500";
        }

        const topVal = 100 - fillRatio;
        liquidFront.style.top = `${topVal}%`;
        liquidBack.style.top = `${topVal + 2}%`; 
    });
}