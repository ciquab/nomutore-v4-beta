import { APP, EXERCISE, BEER_COLORS } from '../constants.js'; // BEER_COLORSを追加インポート
import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { StateManager } from './state.js';
import { toggleModal } from './dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// タイマー状態
let timerInterval = null;
let isRunning = false;
let lastBurnedKcal = 0; // ★修正: 整数Countではなく、小数のKcalで管理

// 内部関数: 時間整形
const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const Timer = {
    init: () => {
        const el = document.getElementById('timer-exercise-select');
        if (el && el.children.length === 0) {
            Object.keys(EXERCISE).forEach(k => {
                const o = document.createElement('option');
                o.value = k;
                o.textContent = EXERCISE[k].icon + ' ' + EXERCISE[k].label;
                el.appendChild(o);
            });
            el.value = Store.getDefaultRecordExercise();
        }
        Timer.checkResume();
    },

    checkResume: () => {
        const start = localStorage.getItem(APP.STORAGE_KEYS.TIMER_START);
        const accumulated = parseInt(localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED)) || 0;
        
        if (start) {
            isRunning = true;
            Timer.startLoop(); 
            Timer.updateUI(true);
            toggleModal('timer-modal', true);
        } else if (accumulated > 0) {
            isRunning = false;
            Timer.updateUI(false);
            Timer.tick(); 
        }
    },

    toggle: () => {
        if (isRunning) {
            Timer.pause();
        } else {
            Timer.start();
        }
    },

    start: () => {
        if (isRunning) return;
        
        const now = Date.now();
        localStorage.setItem(APP.STORAGE_KEYS.TIMER_START, now);
        
        isRunning = true;
        // 開始時にリセットせず、続きから計算するため lastBurnedKcal はリセットしない
        Timer.startLoop();
        Timer.updateUI(true);
        
        // ★演出: 開始時に景気付けの泡を出す
        setTimeout(() => Timer.createBubble(BEER_COLORS['gold']), 100);
    },

    pause: () => {
        if (!isRunning) return;

        const now = Date.now();
        const start = parseInt(localStorage.getItem(APP.STORAGE_KEYS.TIMER_START));
        const accumulated = parseInt(localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED)) || 0;
        
        const currentSession = now - start;
        localStorage.setItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED, accumulated + currentSession);
        localStorage.removeItem(APP.STORAGE_KEYS.TIMER_START);

        isRunning = false;
        if (timerInterval) cancelAnimationFrame(timerInterval);
        
        Timer.updateUI(false);
    },

    finish: async () => {
        Timer.pause();
        
        const totalMs = parseInt(localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED)) || 0;
        const minutes = Math.round(totalMs / 60000);

        if (minutes > 0) {
            const type = document.getElementById('timer-exercise-select').value;
            
            document.dispatchEvent(new CustomEvent('save-exercise', {
                detail: {
                    exerciseKey: type,
                    minutes: minutes,
                    date: dayjs().format('YYYY-MM-DD'),
                    applyBonus: true
                }
            }));
            
        } else {
            alert('1分未満のため記録しませんでした。');
        }

        Timer.reset();
        toggleModal('timer-modal', false);
    },

    reset: () => {
        isRunning = false;
        if (timerInterval) cancelAnimationFrame(timerInterval);
        localStorage.removeItem(APP.STORAGE_KEYS.TIMER_START);
        localStorage.removeItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);
        lastBurnedKcal = 0; // リセット
        
        const container = document.getElementById('timer-bubbles-container');
        if (container) container.innerHTML = '';
        const display = document.getElementById('timer-display');
        const kcalEl = document.getElementById('timer-kcal');
        const beerEl = document.getElementById('timer-beer');
        
        if (display) display.textContent = '00:00';
        if (kcalEl) kcalEl.textContent = '0';
        if (beerEl) beerEl.textContent = '0.0';
        
        Timer.updateUI(false);
    },

    startLoop: () => {
        const loop = () => {
            if (!isRunning) return;
            Timer.tick();
            timerInterval = requestAnimationFrame(loop);
        };
        timerInterval = requestAnimationFrame(loop);
    },

    tick: () => {
        const startStr = localStorage.getItem(APP.STORAGE_KEYS.TIMER_START);
        const accStr = localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);
        
        let totalMs = 0;
        if (accStr) totalMs += parseInt(accStr, 10);
        if (startStr) totalMs += (Date.now() - parseInt(startStr, 10));

        const display = document.getElementById('timer-display');
        const kcalEl = document.getElementById('timer-kcal');
        const beerEl = document.getElementById('timer-beer');
        const typeSelect = document.getElementById('timer-exercise-select');

        if (display) display.textContent = formatTime(totalMs);

        if (kcalEl && beerEl && typeSelect) {
            const profile = Store.getProfile();
            const type = typeSelect.value;
            const mets = EXERCISE[type] ? EXERCISE[type].mets : 3.0;
            const minutes = totalMs / 60000;
            const burned = Calc.calculateExerciseBurn(mets, minutes, profile);
            
            kcalEl.textContent = Math.floor(burned);

            const settings = { modes: Store.getModes(), baseExercise: Store.getBaseExercise() };
            const tankData = Calc.getTankDisplayData(0, StateManager.beerMode, settings, profile);

            const beers = Calc.convertKcalToBeerCount(burned, tankData.targetStyle);
            beerEl.textContent = beers;

            if (display) {
                const speed = Math.max(0.8, 3.5 - (mets / 3)); 
                display.style.animation = `timer-pulse ${speed}s ease-in-out infinite`;
                // 色適用を安全に
                const glowColor = tankData.liquidColor.includes('gradient') ? '#fbbf24' : tankData.liquidColor;
                display.style.textShadow = `0 0 20px ${glowColor}`;
            }

            // ★修正: 泡の発生判定 (0.1kcalごとに発生させる)
            // 前回記録したカロリーと、現在のカロリーの差が 0.1 以上あれば泡を出す
            if (burned - lastBurnedKcal >= 0.1) {
                Timer.createBubble(tankData.liquidColor);
                lastBurnedKcal = burned;
            }
        }
    },

    createBubble: (color) => {
        const container = document.getElementById('timer-bubbles-container');
        if (!container) return;

        // グラデーション文字列そのままだと background に適用できない場合があるためチェック
        // ただし CSS background は gradient を受け付けるので、z-index等の問題の可能性が高い
        // 念のため安全な色指定を行う
        const safeColor = color || '#fbbf24';

        const bubble = document.createElement('div');
        const size = Math.random() * 20 + 10; // 少し大きく
        const left = Math.random() * 90 + 5;  // 画面端すぎないように
        const duration = Math.random() * 3 + 2;

        bubble.className = "absolute rounded-full pointer-events-none";
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${left}%`;
        bubble.style.bottom = `-30px`; // スタート位置
        
        bubble.style.background = safeColor;
        
        bubble.style.opacity = "0.7";
        bubble.style.filter = "blur(1px)";
        // z-index問題を回避するため、コンテナ内での表示を強制
        bubble.style.zIndex = "1"; 
        
        bubble.style.animation = `timer-bubble-up ${duration}s ease-in forwards`;

        container.appendChild(bubble);
        setTimeout(() => bubble.remove(), duration * 1000);
    },

    updateUI: (running) => {
        const toggleBtn = document.getElementById('btn-timer-toggle');
        const icon = document.getElementById('icon-timer-toggle');
        const finishBtn = document.getElementById('btn-timer-finish');
        const select = document.getElementById('timer-exercise-select');
        const wrapper = select ? select.parentElement : null; // 親のdiv

        if (running) {
            toggleBtn.classList.remove('bg-indigo-500', 'hover:bg-indigo-600');
            toggleBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600', 'shadow-yellow-500/50');
            icon.className = 'ph-fill ph-pause text-3xl';
            finishBtn.classList.add('hidden');
            
            if(select) {
                select.disabled = true;
                // ★追加: 無効化されていることを視覚的に分かるようにする
                select.classList.add('opacity-50', 'cursor-not-allowed');
                if(wrapper) wrapper.classList.add('opacity-50');
            }
        } else {
            toggleBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600', 'shadow-yellow-500/50');
            toggleBtn.classList.add('bg-indigo-500', 'hover:bg-indigo-600');
            icon.className = 'ph-fill ph-play text-3xl';
            
            const acc = localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);
            if (acc && parseInt(acc) > 0) {
                finishBtn.classList.remove('hidden');
            } else {
                finishBtn.classList.add('hidden');
            }
            
            if(select) {
                select.disabled = false;
                select.classList.remove('opacity-50', 'cursor-not-allowed');
                if(wrapper) wrapper.classList.remove('opacity-50');
            }
        }
    }
};