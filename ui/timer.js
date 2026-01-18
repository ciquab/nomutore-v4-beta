import { APP, EXERCISE } from '../constants.js';
import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { toggleModal } from './dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// タイマー状態
let timerInterval = null;
let isRunning = false;

// 内部関数: 時間整形
const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const Timer = {
    init: () => {
        // セレクトボックス生成 (Main.jsでやっているが、Modal内にもあるため)
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
        
        // 復帰処理
        Timer.checkResume();
    },

    checkResume: () => {
        const start = localStorage.getItem(APP.STORAGE_KEYS.TIMER_START);
        const accumulated = parseInt(localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED)) || 0;
        
        if (start) {
            // 計測中だった場合、自動再開しないがUIは「計測中」にする
            isRunning = true;
            Timer.startLoop(); 
            Timer.updateUI(true);
            // モーダルを開く
            toggleModal('timer-modal', true);
        } else if (accumulated > 0) {
            // 一時停止中
            isRunning = false;
            Timer.updateUI(false);
            // 値の表示更新だけする
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
        Timer.startLoop();
        Timer.updateUI(true);
    },

    pause: () => {
        if (!isRunning) return;

        const now = Date.now();
        const start = parseInt(localStorage.getItem(APP.STORAGE_KEYS.TIMER_START));
        const accumulated = parseInt(localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED)) || 0;
        
        // 経過時間を累積に加算
        const currentSession = now - start;
        localStorage.setItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED, accumulated + currentSession);
        localStorage.removeItem(APP.STORAGE_KEYS.TIMER_START);

        isRunning = false;
        if (timerInterval) cancelAnimationFrame(timerInterval);
        
        Timer.updateUI(false);
    },

    finish: async () => { // asyncは外しても良いがそのままでもOK
        Timer.pause(); // まず止める
        
        const totalMs = parseInt(localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED)) || 0;
        const minutes = Math.round(totalMs / 60000);

        if (minutes > 0) {
            const type = document.getElementById('timer-exercise-select').value;
            
            // ★修正: Service直接呼び出しをやめ、イベントを発火する
            // await Service.saveExerciseLog(type, minutes, dayjs().format('YYYY-MM-DD'), true);
            
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
        
        // UI Reset
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

        // UI更新
        const display = document.getElementById('timer-display');
        const kcalEl = document.getElementById('timer-kcal');
        const beerEl = document.getElementById('timer-beer');
        const typeSelect = document.getElementById('timer-exercise-select');

        if (display) display.textContent = formatTime(totalMs);

        // カロリー計算
        if (kcalEl && beerEl && typeSelect) {
            const profile = Store.getProfile();
            const type = typeSelect.value;
            const mets = EXERCISE[type] ? EXERCISE[type].mets : 3.0;
            const minutes = totalMs / 60000;
            
            const burned = Calc.calculateExerciseBurn(mets, minutes, profile);
            kcalEl.textContent = Math.floor(burned);
            
            // ビール換算 (350ml Lager基準)
            // convertKcalToBeerCount は本数文字列を返す
            const beers = Calc.convertKcalToBeerCount(burned, '国産ピルスナー');
            beerEl.textContent = beers;
        }
    },

    updateUI: (running) => {
        const toggleBtn = document.getElementById('btn-timer-toggle');
        const icon = document.getElementById('icon-timer-toggle');
        const finishBtn = document.getElementById('btn-timer-finish');
        const select = document.getElementById('timer-exercise-select');

        if (running) {
            toggleBtn.classList.remove('bg-indigo-500', 'hover:bg-indigo-600');
            toggleBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600', 'shadow-yellow-500/50');
            icon.className = 'ph-fill ph-pause text-3xl';
            finishBtn.classList.add('hidden');
            if(select) select.disabled = true;
        } else {
            toggleBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600', 'shadow-yellow-500/50');
            toggleBtn.classList.add('bg-indigo-500', 'hover:bg-indigo-600');
            icon.className = 'ph-fill ph-play text-3xl';
            
            // 一時停止中で、かつ時間が記録されていればFinishボタン表示
            const acc = localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);
            if (acc && parseInt(acc) > 0) {
                finishBtn.classList.remove('hidden');
            } else {
                finishBtn.classList.add('hidden');
            }
            
            if(select) select.disabled = false;
        }
    }
};