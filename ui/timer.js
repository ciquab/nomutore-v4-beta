import { APP, EXERCISE, BEER_COLORS } from '../constants.js'; 
import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { toggleModal } from './dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// タイマー状態
let timerInterval = null;
let isRunning = false;
let lastBurnedKcal = 0;
let accumulatedTime = 0;
let currentBeerStyleName = null; // 現在のスタイル名を保持

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
        
        // スタイルが未設定ならランダム設定
        if (!currentBeerStyleName) {
            Timer.setRandomBeerBackground();
        }

        if (start) {
            Timer.start(); 
            toggleModal('timer-modal', true);
        } else if (accumulated > 0) {
            isRunning = false;
            Timer.updateUI(false);
            
            const totalMs = accumulated;
            const display = document.getElementById('timer-display');
            if(display) display.textContent = formatTime(totalMs);
            Timer.updateCalculations(totalMs);
        }
    },

    // ★重要: constantsの色を使って背景グラデーションを作る
    setRandomBeerBackground: () => {
        // BEER_COLORSが定義されていなければ安全策でゴールドを使用
        const colors = (typeof BEER_COLORS !== 'undefined') ? BEER_COLORS : { 'Golden Ale': 'linear-gradient(to top, #eab308, #facc15)' };
        
        // BEER_COLORSの値がすでに linear-gradient 文字列の場合はそのまま使う
        // 単色ヘックスコードの場合はグラデーション化する処理を入れる
        const styleKeys = Object.keys(colors);
        const randomKey = styleKeys[Math.floor(Math.random() * styleKeys.length)];
        let backgroundStyle = colors[randomKey];

        // もし単色コード(#...)ならグラデーションに変換（念のためのフォールバック）
        if (backgroundStyle.startsWith('#')) {
            backgroundStyle = `linear-gradient(to bottom right, ${backgroundStyle}, #1a1a1a)`;
        }
        
        currentBeerStyleName = randomKey;

        const modal = document.getElementById('timer-modal');
        if (modal) {
            // 背景グラデーションを適用
            modal.style.background = backgroundStyle;
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
        if (isRunning && timerInterval) return;
        
        // 背景セット（まだ無ければ）
        if (!currentBeerStyleName) Timer.setRandomBeerBackground();

        const now = Date.now();
        const startTimestamp = now - accumulatedTime;
        
        localStorage.setItem(APP.STORAGE_KEYS.TIMER_START, startTimestamp);
        
        isRunning = true;
        Timer.updateUI(true);

        timerInterval = setInterval(() => {
            const currentNow = Date.now();
            const diff = currentNow - startTimestamp;
            accumulatedTime = diff; 

            const display = document.getElementById('timer-display');
            if(display) display.textContent = formatTime(diff);

            Timer.updateCalculations(diff);

        }, 100); 
    },

    updateCalculations: (diffMs) => {
        const select = document.getElementById('timer-exercise-select');
        const exerciseKey = select ? select.value : 'other';
        const mets = EXERCISE[exerciseKey] ? EXERCISE[exerciseKey].mets : 3.0;

        const profile = Store.getProfile(); 
        const minutes = diffMs / 1000 / 60;
        
        const burned = Calc.calculateExerciseBurn(mets, minutes, profile);
        
        const kcalEl = document.getElementById('timer-kcal');
        if(kcalEl) kcalEl.textContent = burned.toFixed(1);

        const beerEl = document.getElementById('timer-beer');
        if(beerEl) {
            const cans = burned / 140;
            beerEl.textContent = cans.toFixed(1);
        }

        Timer.updateRing(burned);

        if (isRunning) {
            // カロリー消費の泡 (0.1kcalごと)
            if (burned - lastBurnedKcal > 0.1) { 
                Timer.createBubble(); 
                lastBurnedKcal = burned;
            }
            // アンビエント泡 (背景が液体になったので、少し多めに出す)
            if (Math.random() < 0.3) {
                Timer.createBubble(true);
            }
        }
    },

    updateRing: (burnedKcal) => {
        const ring = document.getElementById('timer-ring');
        if (!ring) return;

        const TARGET_KCAL = 140;
        const progress = (burnedKcal % TARGET_KCAL) / TARGET_KCAL * 100;
        
        // ★修正: 背景がビール色なので、リング（進捗）は「白（泡）」にする
        const ringColor = 'rgba(255, 255, 255, 0.9)'; 

        ring.style.background = `conic-gradient(
            ${ringColor} 0%, 
            ${ringColor} ${progress}%, 
            transparent ${progress}%, 
            transparent 100%
        )`;
    },

    // ★修正: 泡は「白」にする（リアルな気泡表現）
    createBubble: (isAmbient = false) => {
        // ★ここを修正！ id="timer-bubbles-container" (複数形sあり) に合わせる
        const container = document.getElementById('timer-bubbles-container');
        if (!container) return;

        const b = document.createElement('div');
        b.className = 'absolute rounded-full backdrop-blur-sm pointer-events-none animate-float-up';
        
        // 色は白固定
        b.style.backgroundColor = '#ffffff';
        
        // 透明度で奥行きを出す
        b.style.opacity = isAmbient ? (Math.random() * 0.3 + 0.1).toString() : '0.6';
        
        const size = isAmbient 
            ? Math.random() * 8 + 3 
            : Math.random() * 20 + 8;
            
        b.style.width = `${size}px`;
        b.style.height = `${size}px`;
        b.style.left = `${Math.random() * 100}%`;
        b.style.bottom = '-20px';
        
        const duration = isAmbient ? (Math.random() * 4 + 5) : (Math.random() * 2 + 2);
        b.style.animationDuration = `${duration}s`;
        b.style.zIndex = "1";

        container.appendChild(b);

        setTimeout(() => {
            if(b.parentNode) b.parentNode.removeChild(b);
        }, duration * 1000);
    },

    pause: () => {
        if (!isRunning) return;

        localStorage.setItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED, accumulatedTime);
        localStorage.removeItem(APP.STORAGE_KEYS.TIMER_START);

        isRunning = false;
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        
        Timer.updateUI(false);
    },

    finish: async () => {
        Timer.pause();
        
        const totalMs = accumulatedTime;
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
        Timer.pause();
        localStorage.removeItem(APP.STORAGE_KEYS.TIMER_START);
        localStorage.removeItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);
        
        accumulatedTime = 0;
        lastBurnedKcal = 0;
        currentBeerStyleName = null; // スタイルリセット
        
        const container = document.getElementById('timer-bubbles-container');
        if (container) container.innerHTML = '';
        
        const display = document.getElementById('timer-display');
        const kcalEl = document.getElementById('timer-kcal');
        const beerEl = document.getElementById('timer-beer');
        const ring = document.getElementById('timer-ring');
        
        // モーダルの背景色リセット
        const modal = document.getElementById('timer-modal');
        if (modal) modal.style.background = ''; // デフォルト(CSS定義)に戻す

        if (display) display.textContent = '00:00';
        if (kcalEl) kcalEl.textContent = '0.0';
        if (beerEl) beerEl.textContent = '0.0';
        if (ring) ring.style.background = 'transparent';
        
        Timer.updateUI(false);
    },

    updateUI: (running) => {
        const toggleBtn = document.getElementById('btn-timer-toggle');
        const icon = document.getElementById('icon-timer-toggle');
        const finishBtn = document.getElementById('btn-timer-finish');
        const select = document.getElementById('timer-exercise-select');
        const wrapper = select ? select.parentElement : null;

        if (running) {
            // 背景が濃いビール色になるため、ボタンは「白」系にして視認性を確保
            toggleBtn.classList.remove('bg-indigo-500', 'hover:bg-indigo-600');
            toggleBtn.classList.add('bg-white', 'text-yellow-600', 'hover:bg-gray-100');
            icon.className = 'ph-fill ph-pause text-3xl';
            finishBtn.classList.add('hidden');
            
            if(select) {
                select.disabled = true;
                select.classList.add('opacity-50', 'cursor-not-allowed');
                if(wrapper) wrapper.classList.add('opacity-50');
            }
        } else {
            toggleBtn.classList.remove('bg-white', 'text-yellow-600', 'hover:bg-gray-100');
            toggleBtn.classList.add('bg-indigo-500', 'text-white', 'hover:bg-indigo-600');
            icon.className = 'ph-fill ph-play text-3xl';
            
            if (accumulatedTime > 0) {
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